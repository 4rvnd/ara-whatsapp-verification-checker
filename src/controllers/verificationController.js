const verificationService = require('../services/verificationService');
const { logger } = require('../config/database');

class VerificationController {
  /**
   * Verify messages endpoint
   * POST /api/verify
   */
  async verifyMessages(req, res) {
    try {
      const {
        dateFrom,
        dateTo,
        phoneNumbers,
        phoneNumberRange,
        businessId,
        organizationId,
        matchingThreshold = 0.9,
        messageRole = 'both',
        includeDetails = true,
        userIds
      } = req.body;
      
      // Validate required parameters
      if (!dateFrom || !dateTo) {
        return res.status(400).json({
          success: false,
          error: 'dateFrom and dateTo are required parameters'
        });
      }
      
      // Phone numbers are optional if businessId or organizationId is provided
      if (!phoneNumbers && !phoneNumberRange && !businessId && !organizationId) {
        return res.status(400).json({
          success: false,
          error: 'Either phoneNumbers, phoneNumberRange, businessId, or organizationId is required'
        });
      }
      
      if (!userIds || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'userIds array is required with at least one user ID'
        });
      }
      
      // Validate date format
      const fromDate = new Date(dateFrom);
      const toDate = new Date(dateTo);
      
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Please use ISO 8601 format'
        });
      }
      
      if (fromDate > toDate) {
        return res.status(400).json({
          success: false,
          error: 'dateFrom cannot be after dateTo'
        });
      }
      
      // Validate matching threshold
      if (matchingThreshold < 0.9 || matchingThreshold > 1) {
        return res.status(400).json({
          success: false,
          error: 'matchingThreshold must be between 0.9 and 1.0'
        });
      }
      
      logger.info('Starting message verification', {
        dateFrom,
        dateTo,
        phoneNumbersCount: phoneNumbers?.length || 0,
        phoneNumberRange
      });
      
      // Call verification service
      const result = await verificationService.verifyMessages({
        dateFrom,
        dateTo,
        phoneNumbers,
        phoneNumberRange,
        businessId,
        organizationId,
        matchingThreshold,
        messageRole,
        includeDetails,
        userIds
      });
      
      res.json(result);
      
    } catch (error) {
      logger.error('Verification controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }
  
  /**
   * Verify single phone number
   * POST /api/verify/single
   */
  async verifySingleNumber(req, res) {
    try {
      const {
        phoneNumber,
        dateFrom,
        dateTo,
        includeDetails = true,
        userIds
      } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'phoneNumber is required'
        });
      }
      
      if (!userIds || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'userIds array is required with at least one user ID'
        });
      }
      
      const result = await verificationService.verifyMessages({
        dateFrom,
        dateTo,
        phoneNumbers: [phoneNumber],
        includeDetails,
        matchingThreshold: 0.9,
        messageRole: 'both',
        userIds
      });
      
      res.json(result);
      
    } catch (error) {
      logger.error('Single verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }
  
  /**
   * Get verification report for first messages
   * POST /api/verify/first-messages
   */
  async verifyFirstMessages(req, res) {
    try {
      const {
        dateFrom,
        dateTo,
        businessId,
        organizationId,
        userIds
      } = req.body;
      
      if (!dateFrom || !dateTo) {
        return res.status(400).json({
          success: false,
          error: 'dateFrom and dateTo are required parameters'
        });
      }
      
      if (!userIds || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'userIds array is required with at least one user ID'
        });
      }
      
      // Fetch all first messages from database
      const Messages = require('../models/Messages');
      const query = {
        sent_date: {
          $gte: new Date(dateFrom),
          $lte: new Date(dateTo)
        },
        type_of_message: 'first_message'
      };
      
      if (businessId) query.business_id = businessId;
      if (organizationId) query.organization_id = organizationId;
      
      const firstMessages = await Messages.find(query).lean();
      
      // Get unique phone numbers
      const uniquePhoneNumbers = [...new Set(firstMessages.map(m => m.phone_number))];
      
      // Verify messages for these phone numbers
      const result = await verificationService.verifyMessages({
        dateFrom,
        dateTo,
        phoneNumbers: uniquePhoneNumbers,
        businessId,
        organizationId,
        matchingThreshold: 0.9,
        messageRole: 'assistant',
        includeDetails: true,
        userIds
      });
      
      // Add first message specific analysis
      result.report.firstMessageAnalysis = {
        totalFirstMessages: firstMessages.length,
        uniquePhoneNumbers: uniquePhoneNumbers.length,
        unmatchedFirstMessages: result.report.summary.firstMessageStats.unmatched,
        failureRate: ((result.report.summary.firstMessageStats.unmatched / firstMessages.length) * 100).toFixed(2) + '%'
      };
      
      res.json(result);
      
    } catch (error) {
      logger.error('First messages verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }
  
  /**
   * Health check endpoint
   * GET /api/health
   */
  async healthCheck(req, res) {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'WhatsApp Message Verification Service'
    });
  }
}

module.exports = new VerificationController();