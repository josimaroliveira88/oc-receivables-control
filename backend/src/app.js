const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { ZodError } = require('zod');

if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}

const app = express();

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms - origin: :req[origin]'));
}

// Middleware
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : true;
app.use(cors({
  origin: corsOrigins,
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

// People routes
const peopleRoutes = require('./routes/peopleRoutes');
app.use('/api/people', peopleRoutes);

// Orders routes
const ordersRoutes = require('./routes/ordersRoutes');
app.use('/api/orders', ordersRoutes);

// Dashboard routes
const dashboardRoutes = require('./routes/dashboardRoutes');
app.use('/api/dashboard', dashboardRoutes);

// Centralized error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', {
    message: error.message,
    stack: error.stack,
    method: req.method,
    url: req.originalUrl,
    origin: req.get('origin'),
    ip: req.ip
  });
  if (error instanceof ZodError) {
    return res.status(400).json({ error: error.errors });
  }
  // Default to 500 if no status code
  const status = error.status || 500;
  const message = error.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

module.exports = app;