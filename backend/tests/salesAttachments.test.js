import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../src/app.js';
import prisma from '../src/config/database.js';

// 1x1 transparent PNG used as a valid image payload in the upload tests.
const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

const registerUser = async (prefix) => {
  const username = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ username, password: 'testpass123' });
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'testpass123' });
  return { userId: regRes.body.id, token: loginRes.body.token };
};

describe('Sale attachments', () => {
  let user;
  let otherUser;
  let client;
  let product;
  let createdSaleId;
  let uploadsDir;

  beforeAll(async () => {
    uploadsDir = process.env.ATTACHMENTS_DIR;
    fs.mkdirSync(uploadsDir, { recursive: true });
    await prisma.$connect();

    user = await registerUser('saleattach');
    otherUser = await registerUser('saleattach2');

    client = await prisma.person.create({
      data: { name: 'Cliente Anexo', userId: user.userId },
    });
    product = await prisma.product.create({
      data: {
        code: `TESTSALEATT${Date.now()}`,
        name: 'Produto Anexo',
        size: '60 ml',
        status: 'ATIVO',
        prices: { create: { regularPrice: 100, memberPrice: 75, pv: 10 } },
      },
    });
    for (const owner of [user, otherUser]) {
      await prisma.inventory.upsert({
        where: {
          userId_productId: { userId: owner.userId, productId: product.id },
        },
        create: { userId: owner.userId, productId: product.id, quantity: 1000 },
        update: { quantity: 1000 },
      });
    }
  });

  afterAll(async () => {
    if (product) {
      await prisma.stockMovement
        .deleteMany({ where: { productId: product.id } })
        .catch(() => {});
      await prisma.inventory
        .deleteMany({ where: { productId: product.id } })
        .catch(() => {});
    }
    for (const owner of [user, otherUser]) {
      if (owner) {
        await prisma.user
          .delete({ where: { id: owner.userId } })
          .catch(() => {});
      }
    }
    await prisma.product.delete({ where: { id: product.id } }).catch(() => {});
    await prisma.$disconnect();
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    if (createdSaleId) {
      await prisma.order
        .delete({ where: { id: createdSaleId } })
        .catch(() => {});
      createdSaleId = null;
    }
    await prisma.stockMovement
      .deleteMany({ where: { productId: product.id } })
      .catch(() => {});
    await prisma.inventory
      .updateMany({
        where: { productId: product.id },
        data: { quantity: 1000 },
      })
      .catch(() => {});
  });

  const createSale = async () => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        clientPersonId: client.id,
        items: [{ productId: product.id, chargedValue: 100, quantity: 1 }],
      });
    createdSaleId = res.body.id;
    return res.body;
  };

  const uploadAttachment = (saleId, token = user.token) =>
    request(app)
      .post(`/api/sales/${saleId}/attachment`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', PNG_BUFFER, {
        filename: 'foto.png',
        contentType: 'image/png',
      });

  describe('POST /api/sales/:id/attachment', () => {
    it('should upload an image and store the filename', async () => {
      const sale = await createSale();

      const response = await uploadAttachment(sale.id);

      expect(response.status).toBe(200);
      expect(response.body.attachmentFilename).toMatch(/^[0-9a-f-]{36}\.png$/);

      const stored = await prisma.order.findUnique({ where: { id: sale.id } });
      expect(stored.attachmentFilename).toBe(response.body.attachmentFilename);
      expect(
        fs.existsSync(path.join(uploadsDir, stored.attachmentFilename)),
      ).toBe(true);
    });

    it('should replace an existing attachment and delete the old file', async () => {
      const sale = await createSale();

      const first = await uploadAttachment(sale.id);
      const oldFile = path.join(uploadsDir, first.body.attachmentFilename);

      const second = await uploadAttachment(sale.id);

      expect(second.status).toBe(200);
      expect(second.body.attachmentFilename).not.toBe(
        first.body.attachmentFilename,
      );
      expect(fs.existsSync(oldFile)).toBe(false);
    });

    it('should reject an invalid file type', async () => {
      const sale = await createSale();

      const response = await request(app)
        .post(`/api/sales/${sale.id}/attachment`)
        .set('Authorization', `Bearer ${user.token}`)
        .attach('file', Buffer.from('%PDF-1.4 fake'), {
          filename: 'doc.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(400);
    });

    it('should return 404 when the sale does not belong to the user', async () => {
      const sale = await createSale();

      const response = await uploadAttachment(sale.id, otherUser.token);

      expect(response.status).toBe(404);
    });

    it('should reject unauthenticated uploads', async () => {
      const sale = await createSale();

      const response = await request(app)
        .post(`/api/sales/${sale.id}/attachment`)
        .attach('file', PNG_BUFFER, {
          filename: 'foto.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/sales/:id/attachment', () => {
    it('should return the stored image bytes with the right content type', async () => {
      const sale = await createSale();
      await uploadAttachment(sale.id);

      const response = await request(app)
        .get(`/api/sales/${sale.id}/attachment`)
        .set('Authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^image\/png/);
      expect(response.body).toEqual(PNG_BUFFER);
    });

    it('should return 404 when the sale has no attachment', async () => {
      const sale = await createSale();

      const response = await request(app)
        .get(`/api/sales/${sale.id}/attachment`)
        .set('Authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/sales/:id/attachment', () => {
    it('should remove the attachment file and clear the column', async () => {
      const sale = await createSale();
      const upload = await uploadAttachment(sale.id);
      const filePath = path.join(uploadsDir, upload.body.attachmentFilename);
      expect(fs.existsSync(filePath)).toBe(true);

      const response = await request(app)
        .delete(`/api/sales/${sale.id}/attachment`)
        .set('Authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(200);
      expect(fs.existsSync(filePath)).toBe(false);
      const stored = await prisma.order.findUnique({ where: { id: sale.id } });
      expect(stored.attachmentFilename).toBeNull();
    });
  });

  describe('Sale deletion cleanup', () => {
    it('should delete the attachment file when the sale is deleted', async () => {
      const sale = await createSale();
      const upload = await uploadAttachment(sale.id);
      const filePath = path.join(uploadsDir, upload.body.attachmentFilename);
      expect(fs.existsSync(filePath)).toBe(true);

      const del = await request(app)
        .delete(`/api/sales/${sale.id}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(del.status).toBe(200);
      expect(fs.existsSync(filePath)).toBe(false);
      createdSaleId = null;
    });
  });
});
