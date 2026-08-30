const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const prisma = new PrismaClient();
const { syncOrderStatusesForPersons } = require('../utils/receivables');
const { toCents, lineValueCents } = require('../utils/money');
const { findIdsByTextSearch } = require('../utils/search');

const MAX_DAYS_BY_MONTH = {
  1: 31,
  2: 29,
  3: 31,
  4: 30,
  5: 31,
  6: 30,
  7: 31,
  8: 31,
  9: 30,
  10: 31,
  11: 30,
  12: 31,
};

// Validates a "DD/MM" birthday (no year). February 29th is accepted because
// the year is unknown.
const isValidBirthday = (value) => {
  const [day, month] = value.split('/').map(Number);
  if (!Number.isInteger(day) || !Number.isInteger(month)) return false;
  return (
    month >= 1 && month <= 12 && day >= 1 && day <= MAX_DAYS_BY_MONTH[month]
  );
};

// Zod schema for person validation
const personSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  whatsapp: z.string().optional().nullable(),
  commonGroups: z.string().max(255).optional().nullable(),
  instagram: z.string().max(255).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  observacao: z
    .string()
    .max(2000, 'Observação deve ter no máximo 2000 caracteres')
    .optional()
    .nullable(),
  birthday: z
    .string()
    .regex(/^\d{2}\/\d{2}$/, 'Aniversário deve estar no formato DD/MM')
    .refine(isValidBirthday, 'Data de aniversário inválida')
    .optional()
    .nullable(),
  isVip: z.boolean().optional(),
  isDoterraMember: z.boolean().optional(),
  isSelf: z.boolean().optional(),
});

const SORTABLE_FIELDS = [
  'name',
  'whatsapp',
  'commonGroups',
  'instagram',
  'address',
  'isVip',
  'isDoterraMember',
  'createdAt',
  'updatedAt',
];

// Maps the frontend classification filter onto the isVip/isDoterraMember flags.
const classificationToFlags = (classification) => {
  switch (classification) {
    case 'vip':
      return { isVip: true, isDoterraMember: false };
    case 'member':
      return { isVip: false, isDoterraMember: true };
    case 'vip_member':
      return { isVip: true, isDoterraMember: true };
    case 'none':
      return { isVip: false, isDoterraMember: false };
    default:
      return null;
  }
};

// Get all people
const getPeople = async (req, res) => {
  try {
    const { q, classification, sortBy, sortDir } = req.query;

    const where = { userId: req.user.userId };

    if (q && q.trim()) {
      const matchingIds = await findIdsByTextSearch({
        table: 'Person',
        columns: ['name', 'whatsapp', 'observacao'],
        q,
      });
      if (matchingIds !== null) {
        if (matchingIds.length === 0) {
          return res.status(200).json([]);
        }
        where.id = { in: matchingIds };
      }
    }

    const flags = classificationToFlags(classification);
    if (flags) Object.assign(where, flags);

    const field = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'name';
    const direction = sortDir === 'desc' ? 'desc' : 'asc';

    const people = await prisma.person.findMany({
      where,
      orderBy: { [field]: direction },
    });
    res.status(200).json(people);
  } catch (error) {
    console.error('Error fetching people:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get person by ID
const getPersonById = async (req, res) => {
  try {
    const { id } = req.params;
    const person = await prisma.person.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!person) {
      return res.status(404).json({ error: 'Person not found' });
    }

    res.status(200).json(person);
  } catch (error) {
    console.error('Error fetching person:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Financial summary for a single person. Team orders are excluded because
// they never participate in receivables. Values are returned in integer cents.
const getPersonSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const person = await prisma.person.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!person) {
      return res.status(404).json({ error: 'Person not found' });
    }

    const [items, payments] = await Promise.all([
      prisma.item.findMany({
        where: { personId: id, order: { isTeamOrder: false } },
        select: {
          chargedValue: true,
          chargedValueMode: true,
          quantity: true,
          orderId: true,
        },
      }),
      prisma.payment.findMany({
        where: { personId: id, order: { isTeamOrder: false } },
        select: { amount: true },
      }),
    ]);

    const orderIds = new Set();
    let totalItemsCents = 0;
    for (const item of items) {
      totalItemsCents += lineValueCents(item);
      orderIds.add(item.orderId);
    }
    const totalPaidCents = payments.reduce(
      (sum, payment) => sum + toCents(payment.amount),
      0,
    );
    const totalOpenCents = person.isSelf
      ? 0
      : Math.max(0, totalItemsCents - totalPaidCents);

    res.status(200).json({
      ordersCount: orderIds.size,
      totalItemsCents,
      totalPaidCents,
      totalOpenCents,
    });
  } catch (error) {
    console.error('Error fetching person summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create new person
const createPerson = async (req, res) => {
  try {
    const validatedData = personSchema.parse(req.body);
    const person = await prisma.$transaction(async (tx) => {
      if (validatedData.isSelf) {
        // At most one self person per user
        await tx.person.updateMany({
          where: { userId: req.user.userId, isSelf: true },
          data: { isSelf: false },
        });
      }
      return tx.person.create({
        data: {
          ...validatedData,
          userId: req.user.userId,
        },
      });
    });
    res.status(201).json(person);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating person:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update person
const updatePerson = async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = personSchema.parse(req.body);

    // Check if person exists and belongs to user
    const existingPerson = await prisma.person.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!existingPerson) {
      return res.status(404).json({ error: 'Person not found' });
    }

    let displacedSelfId = null;
    const person = await prisma.$transaction(async (tx) => {
      if (validatedData.isSelf) {
        // Unset any other self person for this user
        const displaced = await tx.person.findFirst({
          where: { userId: req.user.userId, isSelf: true, id: { not: id } },
        });
        if (displaced) {
          displacedSelfId = displaced.id;
          await tx.person.update({
            where: { id: displaced.id },
            data: { isSelf: false },
          });
        }
      }
      return tx.person.update({
        where: { id },
        data: validatedData,
      });
    });

    // When the self flag changes for this person or a displaced one, affected
    // orders' statuses must be recomputed (self items count as received).
    const selfChanged =
      Boolean(existingPerson.isSelf) !== Boolean(person.isSelf);
    const affectedIds = [];
    if (selfChanged) affectedIds.push(id);
    if (displacedSelfId) affectedIds.push(displacedSelfId);
    if (affectedIds.length > 0) {
      await syncOrderStatusesForPersons(prisma, req.user.userId, affectedIds);
    }

    res.status(200).json(person);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error updating person:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get or create the self person (the logged-in user) for the current user.
const getOrCreateSelfPerson = async (req, res) => {
  try {
    const existing = await prisma.person.findFirst({
      where: { userId: req.user.userId, isSelf: true },
    });

    if (existing) {
      return res.status(200).json(existing);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    const person = await prisma.person.create({
      data: {
        name: user.username,
        isSelf: true,
        userId: req.user.userId,
      },
    });

    res.status(201).json(person);
  } catch (error) {
    console.error('Error getting or creating self person:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete person
const deletePerson = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if person exists and belongs to user
    const existingPerson = await prisma.person.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!existingPerson) {
      return res.status(404).json({ error: 'Person not found' });
    }

    await prisma.person.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Person deleted successfully' });
  } catch (error) {
    console.error('Error deleting person:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getPeople,
  getPersonById,
  getPersonSummary,
  createPerson,
  updatePerson,
  deletePerson,
  getOrCreateSelfPerson,
};
