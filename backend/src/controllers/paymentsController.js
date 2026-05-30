const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const prisma = new PrismaClient();

// Zod schema for payment validation
const paymentSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  personId: z.string().uuid('Person ID must be a valid UUID'),
  notes: z.string().optional(),
});

// Create a new payment for an order
const createPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const validatedData = paymentSchema.parse(req.body);

    // Execute in a transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find the order with items and payments
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              person: true,
            },
          },
          payments: true,
        },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      // 2. Verify person exists
      const person = await tx.person.findUnique({
        where: { id: validatedData.personId },
      });

      if (!person) {
        throw new Error('Person not found');
      }

      // 3. Sum total items cost for this person
      const itemSum = order.items
        .filter(item => item.personId === validatedData.personId)
        .reduce((sum, item) => sum + parseFloat(item.value), 0);

      // 4. Sum all historical payments for this person/order
      const paymentSum = order.payments
        .filter(payment => payment.personId === validatedData.personId)
        .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

      // 5. Calculate pending balance
      const pending = itemSum - paymentSum;

      // 6. Validate input
      if (validatedData.amount <= 0) {
        throw new Error('Amount must be greater than zero');
      }

      if (validatedData.amount > pending) {
        throw new Error('Amount exceeds pending balance');
      }

      // 7. Create the payment record
      const payment = await tx.payment.create({
        data: {
          amount: validatedData.amount,
          orderId: orderId,
          personId: validatedData.personId,
          notes: validatedData.notes,
        },
      });

      // 8. Re-evaluate overall order health status (including the new payment)
      const personIds = [...new Set(order.items.map(item => item.personId))];

      let allPaid = true;
      let hasAnyPayment = false;

      for (const pid of personIds) {
        if (!pid) continue;

        const personItemSum = order.items
          .filter(item => item.personId === pid)
          .reduce((sum, item) => sum + parseFloat(item.value), 0);

        let personPaymentSum = order.payments
          .filter(payment => payment.personId === pid)
          .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

        // Include the new payment if it belongs to this person
        if (pid === validatedData.personId) {
          personPaymentSum += validatedData.amount;
        }

        const personPending = personItemSum - personPaymentSum;

        if (personPending > 0) {
          allPaid = false;
        }

        if (personPaymentSum > 0) {
          hasAnyPayment = true;
        }
      }

      let newStatus;
      if (allPaid) {
        newStatus = 'QUITADO';
      } else if (hasAnyPayment) {
        newStatus = 'PARCIAL';
      } else {
        newStatus = 'PENDENTE';
      }

      // 10. Update order status if changed
      if (newStatus !== order.status) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: newStatus },
        });
      }

      // Return the created payment and updated order info
      return {
        payment,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: newStatus,
        },
      };
    });

    res.status(201).json({
      message: 'Payment created successfully',
      payment: result.payment,
      order: result.order,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating payment:', error);
    res.status(400).json({ error: error.message });
  }
};

// Get balance breakdown for an order
const getOrderBalance = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find order with items and payments
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            person: true,
          },
        },
        payments: {
          include: {
            person: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Group by person to calculate balances
    const personMap = new Map();

    // Process items
    order.items.forEach(item => {
      const personId = item.personId;
      if (!personId) return; // Skip items without person

      if (!personMap.has(personId)) {
        const person = item.person;
        personMap.set(personId, {
          personId,
          personName: person ? person.name : 'Unknown',
          itemTotal: 0,
          paymentTotal: 0,
        });
      }

      const current = personMap.get(personId);
      personMap.set(personId, {
        ...current,
        itemTotal: current.itemTotal + parseFloat(item.value),
      });
    });

    // Process payments
    order.payments.forEach(payment => {
      const personId = payment.personId;
      if (!personId) return; // Skip payments without person

      if (!personMap.has(personId)) {
        const person = payment.person;
        personMap.set(personId, {
          personId,
          personName: person ? person.name : 'Unknown',
          itemTotal: 0,
          paymentTotal: 0,
        });
      }

      const current = personMap.get(personId);
      personMap.set(personId, {
        ...current,
        paymentTotal: current.paymentTotal + parseFloat(payment.amount),
      });
    });

    // Convert to array and calculate pending
    const balances = Array.from(personMap.values()).map(personData => ({
      ...personData,
      pending: personData.itemTotal - personData.paymentTotal,
    }));

    // Sort by person name for consistent output
    balances.sort((a, b) => a.personName.localeCompare(b.personName));

    res.status(200).json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      balances,
    });
  } catch (error) {
    console.error('Error fetching order balance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createPayment,
  getOrderBalance,
};