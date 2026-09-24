const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const env = require('./config/env');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler.middleware');
const { apiLimiter } = require('./middleware/rateLimiter.middleware');
const ApiError = require('./utils/apiError');

const app = express();

// Security HTTP headers
app.use(helmet());

// Enable CORS
app.use(
  cors({
    origin: env.CLIENT_URL || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-branch-id']
  })
);

// Request logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static directory for file uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rate Limiter for API endpoints
app.use('/api', apiLimiter);

// Main API Routes
app.use('/api', apiRoutes);

// Root greeting / health check
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Jewellery ERP API',
    version: '1.0.0',
    documentation: '/api/health',
    status: 'ONLINE'
  });
});

// 404 Route Handler
app.use((req, res, next) => {
  next(ApiError.notFound(`Endpoint not found: ${req.method} ${req.originalUrl}`));
});

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;
