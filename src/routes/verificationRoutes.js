const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationController');

// Main verification endpoint
router.post('/verify', verificationController.verifyMessages);

// Single phone number verification
router.post('/verify/single', verificationController.verifySingleNumber);

// First messages verification
router.post('/verify/first-messages', verificationController.verifyFirstMessages);

// Health check
router.get('/health', verificationController.healthCheck);

module.exports = router;