const fs = require('fs');
const { resolveAttachmentPath } = require('../middlewares/upload');
const prisma = require('../config/database');
const { handleError } = require('../middlewares/errorResponse');
const {
  attachmentMaxBytes,
  attachmentContentType,
  removeAttachmentFile,
} = require('../utils/attachmentStorage');
const { badRequest, notFound } = require('../utils/httpError');

const findOwnedOrder = async (req) => {
  const { id } = req.params;
  const order = await prisma.order.findFirst({
    where: { id, userId: req.user.userId },
  });
  // Sale orders have no dōTERRA screenshot attachment; treat them as absent.
  if (!order || order.orderType !== 'COMPRA') {
    throw notFound('Order not found');
  }
  return order;
};

// POST /api/orders/:id/attachment — upload or replace the order attachment.
const uploadAttachment = async (req, res) => {
  try {
    const order = await findOwnedOrder(req);

    if (!req.file) {
      throw badRequest('No file provided');
    }

    if (req.file.size > attachmentMaxBytes()) {
      removeAttachmentFile(req.file.filename);
      throw badRequest('File is too large');
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
    handleError(res, error, { label: 'Error uploading attachment' });
  }
};

// GET /api/orders/:id/attachment — stream the stored image to the caller.
const getAttachment = async (req, res) => {
  try {
    const order = await findOwnedOrder(req);

    if (!order.attachmentFilename) {
      throw notFound('Attachment not found');
    }

    const filePath = resolveAttachmentPath(order.attachmentFilename);
    if (!fs.existsSync(filePath)) {
      throw notFound('Attachment not found');
    }

    res.setHeader(
      'Content-Type',
      attachmentContentType(order.attachmentFilename),
    );
    res.sendFile(filePath);
  } catch (error) {
    handleError(res, error, { label: 'Error getting attachment' });
  }
};

// DELETE /api/orders/:id/attachment — remove the attachment and its file.
const deleteAttachment = async (req, res) => {
  try {
    const order = await findOwnedOrder(req);

    if (!order.attachmentFilename) {
      throw notFound('Attachment not found');
    }

    removeAttachmentFile(order.attachmentFilename);
    await prisma.order.update({
      where: { id: order.id },
      data: { attachmentFilename: null },
    });

    res.status(200).json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    handleError(res, error, { label: 'Error deleting attachment' });
  }
};

module.exports = {
  uploadAttachment,
  getAttachment,
  deleteAttachment,
};
