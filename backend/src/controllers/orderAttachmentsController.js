const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { resolveAttachmentPath } = require('../middlewares/upload');

const prisma = new PrismaClient();

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const attachmentMaxBytes = () =>
  Number(process.env.ATTACHMENT_MAX_BYTES) || DEFAULT_MAX_BYTES;

const removeAttachmentFile = (filename) => {
  if (!filename) return;
  try {
    fs.unlinkSync(resolveAttachmentPath(filename));
  } catch (error) {
    // Ignore missing files (ENOENT); a stale DB reference must not break flows.
    if (error.code !== 'ENOENT') {
      console.error('Error removing attachment file:', error);
    }
  }
};

const findOwnedOrder = async (req, res) => {
  const { id } = req.params;
  const order = await prisma.order.findFirst({
    where: { id, userId: req.user.userId },
  });
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return null;
  }
  return order;
};

// POST /api/orders/:id/attachment — upload or replace the order attachment.
const uploadAttachment = async (req, res) => {
  try {
    const order = await findOwnedOrder(req, res);
    if (!order) return;

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    if (req.file.size > attachmentMaxBytes()) {
      removeAttachmentFile(req.file.filename);
      return res.status(400).json({ error: 'File is too large' });
    }

    if (order.attachmentFilename) {
      removeAttachmentFile(order.attachmentFilename);
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { attachmentFilename: req.file.filename },
    });

    res.status(200).json({ attachmentFilename: updated.attachmentFilename });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error uploading attachment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/orders/:id/attachment — stream the stored image to the caller.
const getAttachment = async (req, res) => {
  try {
    const order = await findOwnedOrder(req, res);
    if (!order) return;

    if (!order.attachmentFilename) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const filePath = resolveAttachmentPath(order.attachmentFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const extension = path.extname(order.attachmentFilename);
    const contentType =
      extension === '.png'
        ? 'image/png'
        : extension === '.webp'
          ? 'image/webp'
          : 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.sendFile(filePath);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error getting attachment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /api/orders/:id/attachment — remove the attachment and its file.
const deleteAttachment = async (req, res) => {
  try {
    const order = await findOwnedOrder(req, res);
    if (!order) return;

    if (!order.attachmentFilename) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    removeAttachmentFile(order.attachmentFilename);
    await prisma.order.update({
      where: { id: order.id },
      data: { attachmentFilename: null },
    });

    res.status(200).json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error deleting attachment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  uploadAttachment,
  getAttachment,
  deleteAttachment,
  removeAttachmentFile,
};
