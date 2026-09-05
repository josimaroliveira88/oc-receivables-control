const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const prisma = new PrismaClient();
const {
  createSaleSchema,
  updateSaleSchema,
} = require('../validators/salesValidator');
const salesService = require('../services/salesService');

const getSales = async (req, res) => {
  try {
    const result = await salesService.getSales(prisma, {
      userId: req.user.userId,
      query: req.query,
    });
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await salesService.getSaleById(prisma, {
      id,
      userId: req.user.userId,
    });
    res.status(200).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error fetching sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createSale = async (req, res) => {
  try {
    const validatedData = createSaleSchema.parse(req.body);

    const result = await salesService.createSale(prisma, {
      userId: req.user.userId,
      payload: validatedData,
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error creating sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateSale = async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateSaleSchema.parse(req.body);

    const result = await salesService.updateSale(prisma, {
      id,
      userId: req.user.userId,
      payload: validatedData,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error updating sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteSale = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await salesService.deleteSale(prisma, {
      id,
      userId: req.user.userId,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error deleting sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getSales,
  getSaleById,
  createSale,
  updateSale,
  deleteSale,
};
