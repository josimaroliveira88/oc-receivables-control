const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');
const app = require('../src/app');
const prisma = require('../src/config/database');

// 1x1 transparent PNG used as a valid image payload in the upload tests.
const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

function uniqueOrderNumber(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

describe('Order attachments', () => {
  let authToken;
  let userId;
  let otherToken;
  let otherUserId;
  let createdOrderId;
  let testPersonId;
  let uploadsDir;

  beforeAll(async () => {
    uploadsDir = process.env.ATTACHMENTS_DIR;
    fs.mkdirSync(uploadsDir, { recursive: true });
    await prisma.$connect();

    const username = `attach_test_${Date.now()}`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username, password: 'testpass123' });
    userId = regRes.body.id;
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'testpass123' });
    authToken = loginRes.body.token;

    const otherReg = await request(app)
      .post('/api/auth/register')
      .send({
        username: `attach_other_${Date.now()}`,
        password: 'testpass123',
      });
    otherUserId = otherReg.body.id;
    const otherLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: otherReg.body.username, password: 'testpass123' });
    otherToken = otherLogin.body.token;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    if (otherUserId) {
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    if (createdOrderId) {
      await prisma.order
        .delete({ where: { id: createdOrderId } })
        .catch(() => {});
      createdOrderId = null;
    }
  });

  const createOrder = async (token = authToken) => {
    const person = await prisma.person.create({
      data: { name: 'Attachment Person', whatsapp: 'attach@test.com', userId },
    });
    testPersonId = person.id;
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderNumber: uniqueOrderNumber('ORD-ATTACH'),
        items: [
          {
            description: 'Item',
            chargedValue: 100.0,
            personId: person.id,
          },
        ],
      });
    createdOrderId = res.body.id;
    return res.body;
  };

  describe('POST /api/orders/:id/attachment', () => {
    it('should upload an image and store the filename', async () => {
      const order = await createOrder();

      const response = await request(app)
        .post(`/api/orders/${order.id}/attachment`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', PNG_BUFFER, {
          filename: 'print.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(200);
      expect(response.body.attachmentFilename).toMatch(/^[0-9a-f-]{36}\.png$/);

      const stored = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(stored.attachmentFilename).toBe(response.body.attachmentFilename);
      const filePath = path.join(uploadsDir, stored.attachmentFilename);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should replace an existing attachment and delete the old file', async () => {
      const order = await createOrder();

      const first = await request(app)
        .post(`/api/orders/${order.id}/attachment`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', PNG_BUFFER, {
          filename: 'print.png',
          contentType: 'image/png',
        });
      expect(first.status).toBe(200);
      const oldFile = path.join(uploadsDir, first.body.attachmentFilename);

      const second = await request(app)
        .post(`/api/orders/${order.id}/attachment`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', PNG_BUFFER, {
          filename: 'novo.png',
          contentType: 'image/png',
        });

      expect(second.status).toBe(200);
      expect(second.body.attachmentFilename).not.toBe(
        first.body.attachmentFilename,
      );
      expect(fs.existsSync(oldFile)).toBe(false);
      expect(
        fs.existsSync(path.join(uploadsDir, second.body.attachmentFilename)),
      ).toBe(true);
    });

    it('should reject an invalid file type', async () => {
      const order = await createOrder();

      const response = await request(app)
        .post(`/api/orders/${order.id}/attachment`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('%PDF-1.4 fake'), {
          filename: 'doc.pdf',
          contentType: 'application/pdf',
        });

      expect(response.status).toBe(400);
    });

    it('should reject a file over the size limit', async () => {
      const order = await createOrder();
      process.env.ATTACHMENT_MAX_BYTES = '100';

      try {
        const response = await request(app)
          .post(`/api/orders/${order.id}/attachment`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', Buffer.alloc(1024), {
            filename: 'big.png',
            contentType: 'image/png',
          });

        expect(response.status).toBe(400);
        const stored = await prisma.order.findUnique({
          where: { id: order.id },
        });
        expect(stored.attachmentFilename).toBeNull();
      } finally {
        delete process.env.ATTACHMENT_MAX_BYTES;
      }
    });

    it('should return 404 when the order does not belong to the user', async () => {
      const order = await createOrder();
      const otherPerson = await prisma.person.create({
        data: { name: 'Other Person', userId: otherUserId },
      });
      const otherOrder = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-ATTACH-OTHER'),
          items: [
            {
              description: 'Item',
              chargedValue: 10.0,
              personId: otherPerson.id,
            },
          ],
        });

      const response = await request(app)
        .post(`/api/orders/${otherOrder.body.id}/attachment`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', PNG_BUFFER, {
          filename: 'print.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(404);

      await prisma.person
        .delete({ where: { id: otherPerson.id } })
        .catch(() => {});
      await prisma.order
        .delete({ where: { id: otherOrder.body.id } })
        .catch(() => {});
      expect(order.id).toBe(createdOrderId);
    });

    it('should reject unauthenticated uploads', async () => {
      const order = await createOrder();

      const response = await request(app)
        .post(`/api/orders/${order.id}/attachment`)
        .attach('file', PNG_BUFFER, {
          filename: 'print.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/orders/:id/attachment', () => {
    it('should return the stored image bytes with the right content type', async () => {
      const order = await createOrder();
      await request(app)
        .post(`/api/orders/${order.id}/attachment`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', PNG_BUFFER, {
          filename: 'print.png',
          contentType: 'image/png',
        });

      const response = await request(app)
        .get(`/api/orders/${order.id}/attachment`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^image\/png/);
      expect(response.body).toEqual(PNG_BUFFER);
    });

    it('should return 404 when the order has no attachment', async () => {
      const order = await createOrder();

      const response = await request(app)
        .get(`/api/orders/${order.id}/attachment`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 for another user order', async () => {
      const order = await createOrder();
      const otherPerson = await prisma.person.create({
        data: { name: 'Other Person', userId: otherUserId },
      });
      const otherOrder = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-ATTACH-OTHER'),
          items: [
            {
              description: 'Item',
              chargedValue: 10.0,
              personId: otherPerson.id,
            },
          ],
        });

      const response = await request(app)
        .get(`/api/orders/${otherOrder.body.id}/attachment`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);

      await prisma.person
        .delete({ where: { id: otherPerson.id } })
        .catch(() => {});
      await prisma.order
        .delete({ where: { id: otherOrder.body.id } })
        .catch(() => {});
    });

    it('should reject unauthenticated reads', async () => {
      const order = await createOrder();

      const response = await request(app).get(
        `/api/orders/${order.id}/attachment`,
      );

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/orders/:id/attachment', () => {
    it('should remove the attachment file and clear the column', async () => {
      const order = await createOrder();
      const upload = await request(app)
        .post(`/api/orders/${order.id}/attachment`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', PNG_BUFFER, {
          filename: 'print.png',
          contentType: 'image/png',
        });
      const filePath = path.join(uploadsDir, upload.body.attachmentFilename);
      expect(fs.existsSync(filePath)).toBe(true);

      const response = await request(app)
        .delete(`/api/orders/${order.id}/attachment`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(fs.existsSync(filePath)).toBe(false);
      const stored = await prisma.order.findUnique({ where: { id: order.id } });
      expect(stored.attachmentFilename).toBeNull();
    });

    it('should return 404 when there is no attachment', async () => {
      const order = await createOrder();

      const response = await request(app)
        .delete(`/api/orders/${order.id}/attachment`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 for another user order', async () => {
      const order = await createOrder();
      const otherPerson = await prisma.person.create({
        data: { name: 'Other Person', userId: otherUserId },
      });
      const otherOrder = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          orderNumber: uniqueOrderNumber('ORD-ATTACH-OTHER'),
          items: [
            {
              description: 'Item',
              chargedValue: 10.0,
              personId: otherPerson.id,
            },
          ],
        });

      const response = await request(app)
        .delete(`/api/orders/${otherOrder.body.id}/attachment`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);

      await prisma.person
        .delete({ where: { id: otherPerson.id } })
        .catch(() => {});
      await prisma.order
        .delete({ where: { id: otherOrder.body.id } })
        .catch(() => {});
    });
  });

  describe('Order deletion cleanup', () => {
    it('should delete the attachment file when the order is deleted', async () => {
      const order = await createOrder();
      const upload = await request(app)
        .post(`/api/orders/${order.id}/attachment`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', PNG_BUFFER, {
          filename: 'print.png',
          contentType: 'image/png',
        });
      const filePath = path.join(uploadsDir, upload.body.attachmentFilename);
      expect(fs.existsSync(filePath)).toBe(true);

      const del = await request(app)
        .delete(`/api/orders/${order.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(del.status).toBe(200);
      expect(fs.existsSync(filePath)).toBe(false);
      createdOrderId = null;
    });
  });
});
