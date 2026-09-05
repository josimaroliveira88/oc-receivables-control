const prisma = require('../config/database');
const { handleError } = require('../middlewares/errorResponse');
const { notFound } = require('../utils/httpError');
const {
  syncOrderStatusesForPersons,
  personFinancialSummary,
} = require('../utils/receivables');
const { personSchema } = require('../validators/peopleValidator');
const {
  SORTABLE_PERSON_FIELDS,
  classificationToFlags,
} = require('../utils/classification');
const { findIdsByTextSearch } = require('../utils/search');

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

    const field = SORTABLE_PERSON_FIELDS.includes(sortBy) ? sortBy : 'name';
    const direction = sortDir === 'desc' ? 'desc' : 'asc';

    const people = await prisma.person.findMany({
      where,
      orderBy: { [field]: direction },
    });
    res.status(200).json(people);
  } catch (error) {
    handleError(res, error, { label: 'Error fetching people' });
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
      throw notFound('Person not found');
    }

    res.status(200).json(person);
  } catch (error) {
    handleError(res, error, { label: 'Error fetching person' });
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
      throw notFound('Person not found');
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

    res
      .status(200)
      .json(personFinancialSummary(items, payments, { isSelf: person.isSelf }));
  } catch (error) {
    handleError(res, error, { label: 'Error fetching person summary' });
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
    handleError(res, error, { label: 'Error creating person' });
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
      throw notFound('Person not found');
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
    handleError(res, error, { label: 'Error updating person' });
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
    handleError(res, error, { label: 'Error getting or creating self person' });
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
      throw notFound('Person not found');
    }

    await prisma.person.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Person deleted successfully' });
  } catch (error) {
    handleError(res, error, { label: 'Error deleting person' });
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
