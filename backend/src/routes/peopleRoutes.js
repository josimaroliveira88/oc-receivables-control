import express from 'express';
import * as peopleController from '../controllers/peopleController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/people
router.get('/', peopleController.getPeople);

// GET /api/people/:id
router.get('/:id', peopleController.getPersonById);

// GET /api/people/:id/summary
router.get('/:id/summary', peopleController.getPersonSummary);

// GET /api/people/:id/purchases
router.get('/:id/purchases', peopleController.getPersonPurchases);

// POST /api/people
router.post('/', peopleController.createPerson);

// POST /api/people/self
router.post('/self', peopleController.getOrCreateSelfPerson);

// PUT /api/people/:id
router.put('/:id', peopleController.updatePerson);

// DELETE /api/people/:id
router.delete('/:id', peopleController.deletePerson);

export default router;
