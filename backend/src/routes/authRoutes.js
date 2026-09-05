import express from 'express';
import * as authController from '../controllers/authController.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/register
router.post('/register', authController.register);

export default router;
