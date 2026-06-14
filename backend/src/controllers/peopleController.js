const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const prisma = new PrismaClient();

// Zod schema for person validation
const personSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact: z.string().optional().nullable(),
});

// Get all people
const getPeople = async (req, res) => {
  try {
    const people = await prisma.person.findMany({
      where: { userId: req.user.userId },
      orderBy: { name: 'asc' },
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
    const person = await prisma.person.create({
      data: {
        ...validatedData,
        userId: req.user.userId,
      },
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

    const person = await prisma.person.update({
      where: { id },
      data: validatedData,
    });

    res.status(200).json(person);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error updating person:', error);
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
};
