import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { ZodError } from 'zod';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './docs/swagger.js';
import { SERVE_STATIC, STATIC_DIR } from './config.js';
import { registerFrontend } from './utils/serveFrontend.js';

if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

const app = express();

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(
    morgan(
      ':method :url :status :res[content-length] - :response-time ms - origin: :req[origin]',
    ),
  );
}

// Middleware
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : true;
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);
app.use(express.json());

// Swagger UI e spec bruta — públicas (o JWT entra pelo botão "Authorize" da UI)
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Receivables Control API',
    swaggerOptions: {
      persistAuthorization: true,
    },
  }),
);
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));

// Routes will be mounted here
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Auth routes
import authRoutes from './routes/authRoutes.js';
app.use('/api/auth', authRoutes);

// People routes
import peopleRoutes from './routes/peopleRoutes.js';
app.use('/api/people', peopleRoutes);

// Orders routes
import ordersRoutes from './routes/ordersRoutes.js';
app.use('/api/orders', ordersRoutes);

// Sales routes (sale orders)
import salesRoutes from './routes/salesRoutes.js';
app.use('/api/sales', salesRoutes);

// Finances routes (categories, transactions, settlements)
import financesRoutes from './routes/financesRoutes.js';
app.use('/api/finances', financesRoutes);

// Product routes
import productRoutes from './routes/productRoutes.js';
app.use('/api/products', productRoutes);

// Stock routes
import stockRoutes from './routes/stockRoutes.js';
app.use('/api/stock', stockRoutes);

// Production: serve the built SPA on the same origin as the API
if (SERVE_STATIC && registerFrontend(app, STATIC_DIR)) {
  console.log(`Serving frontend from ${STATIC_DIR}`);
}

// Centralized error handling middleware
app.use((error, req, res, _next) => {
  console.error('Unhandled error:', {
    message: error.message,
    stack: error.stack,
    method: req.method,
    url: req.originalUrl,
    origin: req.get('origin'),
    ip: req.ip,
  });
  if (error instanceof ZodError) {
    return res.status(400).json({ error: error.errors });
  }
  // Default to 500 if no status code
  const status = error.status || 500;
  const message = error.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

export default app;
