const express = require('express');
const router = express.Router();
const peopleController = require('../controllers/peopleController');
const { authenticateToken } = require('../middlewares/auth');

// All routes require authentication
router.use(authenticateToken);

// GET /api/people
router.get('/', peopleController.getPeople);

// GET /api/people/:id
router.get('/:id', peopleController.getPersonById);

// POST /api/people
router.post('/', peopleController.createPerson);

// PUT /api/people/:id
router.put('/:id', peopleController.updatePerson);

// DELETE /api/people/:id
router.delete('/:id', peopleController.deletePerson);

module.exports = router;
