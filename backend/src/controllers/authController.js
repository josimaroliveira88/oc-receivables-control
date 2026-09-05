import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config.js';
import prisma from '../config/database.js';
import { handleError } from '../middlewares/errorResponse.js';
import { loginSchema, registerSchema } from '../validators/authValidator.js';

const login = async (req, res) => {
  try {
    // Validate input
    const { username, password } = loginSchema.parse(req.body);

    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    // Return token and expiration
    res.status(200).json({
      token,
      expiresIn: JWT_EXPIRES_IN,
    });
  } catch (error) {
    handleError(res, error, { label: 'Login error' });
  }
};

const register = async (req, res) => {
  try {
    const { username, password } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
      },
      select: {
        id: true,
        username: true,
        createdAt: true,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    handleError(res, error, { label: 'Register error' });
  }
};

export { login, register };
