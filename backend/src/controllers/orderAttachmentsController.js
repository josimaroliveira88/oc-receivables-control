import fs from 'fs';
import { resolveAttachmentPath } from '../middlewares/upload.js';
import prisma from '../config/database.js';
import { handleError } from '../middlewares/errorResponse.js';
import {
  attachmentMaxBytes,
  attachmentContentType,
  removeAttachmentFile,
} from '../utils/attachmentStorage.js';
import { badRequest, notFound } from '../utils/httpError.js';

// Orders of any type (COMPRA purchase screenshots and VENDA sale photos) may
// hold one attachment, stored on the shared `Order.attachmentFilename` column.
// Ownership is always scoped to the authenticated user, so the controller can
// be mounted under both `/api/orders` and `/api/sales`.
const findOwnedOrder = async (req) => {
  const { id } = req.params;
  const order = await prisma.order.findFirst({
    where: { id, userId: req.user.userId },
  });
  if (!order) {
    throw notFound('Pedido não encontrado');
  }
  return order;
};

// POST /api/orders/:id/attachment — upload or replace the order attachment.
const uploadAttachment = async (req, res) => {
  try {
    const order = await findOwnedOrder(req);

    if (!req.file) {
      throw badRequest('Nenhum arquivo foi enviado');
    }

    if (req.file.size > attachmentMaxBytes()) {
      removeAttachmentFile(req.file.filename);
      throw badRequest('O arquivo excede o tamanho máximo permitido');
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
      throw notFound('Anexo não encontrado');
    }

    const filePath = resolveAttachmentPath(order.attachmentFilename);
    if (!fs.existsSync(filePath)) {
      throw notFound('Anexo não encontrado');
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
      throw notFound('Anexo não encontrado');
    }

    removeAttachmentFile(order.attachmentFilename);
    await prisma.order.update({
      where: { id: order.id },
      data: { attachmentFilename: null },
    });

    res.status(200).json({ message: 'Anexo excluído com sucesso' });
  } catch (error) {
    handleError(res, error, { label: 'Error deleting attachment' });
  }
};

export { uploadAttachment, getAttachment, deleteAttachment };
