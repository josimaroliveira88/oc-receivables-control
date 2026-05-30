const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { ZodError } = require('zod');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes will be mounted here
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Auth routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Centralized error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({ error: error.errors });
  }
  // Default to 500 if no status code
  const status = error.status || 500;
  const message = error.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

module.exports = app;