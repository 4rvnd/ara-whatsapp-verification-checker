require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const bodyParser = require('body-parser');

const { connectDB, logger } = require('./config/database');
const verificationRoutes = require('./routes/verificationRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// API routes
app.use('/api', verificationRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'WhatsApp Message Verification Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      verify: 'POST /api/verify',
      verifySingle: 'POST /api/verify/single',
      verifyFirstMessages: 'POST /api/verify/first-messages',
      health: 'GET /api/health'
    }
  });
});

// Error handling
app.use(errorHandler.notFound);
app.use(errorHandler.handleError);

module.exports = app;