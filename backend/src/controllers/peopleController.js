const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const prisma = new PrismaClient();
const { syncOrderStatusesForPersons } = require('../utils/receivables');
const { findIdsByTextSearch } = require('../utils/search');

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
  createPerson,
  updatePerson,
  deletePerson,
  getOrCreateSelfPerson,
};
