const Messages = require('../models/Messages');
const Conversation = require('../models/Conversation');
const whatsappApi = require('./whatsappApi');
const messageMatcher = require('./messageMatcher');
const { logger } = require('../config/database');

class VerificationService {
  /**
   * Main verification function
   * @param {Object} params - Verification parameters
   */
  async verifyMessages(params) {
    const {
      dateFrom,
      dateTo,
      phoneNumbers,
      phoneNumberRange,
      businessId,
      organizationId,
      matchingThreshold = 0.9,
      messageRole,
      includeDetails = true,
      userIds
    } = params;
    
    try {
      // Step 1: Get phone numbers to verify
      const numbersToVerify = await this.getPhoneNumbers(
        phoneNumbers, 
        phoneNumberRange, 
        businessId, 
        organizationId, 
        dateFrom, 
        dateTo
      );
      
      // Step 2: Fetch messages from database
      const dbMessages = await this.fetchDatabaseMessages({
        dateFrom,
        dateTo,
        phoneNumbers: numbersToVerify,
        businessId,
        organizationId,
        messageRole
      });
      
      // Step 3: Fetch messages from WhatsApp API
      const apiResponse = await whatsappApi.fetchMessagesForPhoneNumbers(
        numbersToVerify,
        userIds || [],
        new Date(dateFrom),
        new Date(dateTo)
      );
      
      // Step 4: Flatten API messages
      const allApiMessages = this.flattenApiMessages(apiResponse.messages);
      
      // Step 5: Match messages
      const matchResults = await messageMatcher.batchMatchMessages(
        dbMessages,
        allApiMessages
      );
      
      // Step 6: Generate report
      const report = this.generateVerificationReport(
        matchResults,
        includeDetails,
        dateFrom,
        dateTo,
        numbersToVerify
      );
      
      return {
        success: true,
        report,
        errors: apiResponse.errors
      };
      
    } catch (error) {
      logger.error('Verification service error:', error);
      throw error;
    }
  }
  
  /**
   * Get phone numbers based on input parameters
   * If no phone numbers provided, fetch all from conversations
   */
  async getPhoneNumbers(phoneNumbers, phoneNumberRange, businessId, organizationId, dateFrom, dateTo) {
    let numbers = [];
    
    if (phoneNumbers && phoneNumbers.length > 0) {
      numbers = phoneNumbers;
    } else if (phoneNumberRange) {
      numbers = this.generatePhoneNumberRange(
        phoneNumberRange.start,
        phoneNumberRange.end
      );
    } else if (businessId || organizationId) {
      // If no specific phone numbers provided, get all phone numbers from conversations
      numbers = await this.fetchPhoneNumbersFromConversations(businessId, organizationId, dateFrom, dateTo);
    }
    
    return numbers;
  }
  
  /**
   * Fetch all phone numbers from conversations for a business/organization
   * Optionally filter by conversations that have messages in the date range
   */
  async fetchPhoneNumbersFromConversations(businessId, organizationId, dateFrom, dateTo) {
    const query = {};
    
    if (businessId) {
      query.business_id = businessId;
    }
    
    if (organizationId) {
      query.organization_id = organizationId;
    }
    
    // Get all active conversations
    query.is_active = true;
    
    logger.info('Fetching phone numbers from conversations', { businessId, organizationId });
    
    // First get all conversations
    const conversations = await Conversation.find(query)
      .select('_id phone_number')
      .lean();
    
    let phoneNumbers = [];
    
    if (dateFrom && dateTo) {
      // If date range is provided, filter conversations that have messages in that range
      const conversationIds = conversations.map(c => c._id);
      
      const Messages = require('../models/Messages');
      const messagesInRange = await Messages.find({
        conversation_id: { $in: conversationIds },
        sent_date: {
          $gte: new Date(dateFrom),
          $lte: new Date(dateTo)
        }
      }).distinct('conversation_id');
      
      // Filter conversations that have messages in the date range
      const activeConversations = conversations.filter(c => 
        messagesInRange.some(id => id.toString() === c._id.toString())
      );
      
      phoneNumbers = [...new Set(activeConversations.map(c => c.phone_number).filter(Boolean))];
      logger.info(`Found ${phoneNumbers.length} phone numbers with messages in date range from ${activeConversations.length} conversations`);
    } else {
      // No date filtering, use all conversations
      phoneNumbers = [...new Set(conversations.map(c => c.phone_number).filter(Boolean))];
      logger.info(`Found ${phoneNumbers.length} unique phone numbers from ${conversations.length} conversations`);
    }
    
    return phoneNumbers;
  }
  
  /**
   * Generate phone number range
   */
  generatePhoneNumberRange(start, end) {
    const numbers = [];
    const startNum = parseInt(start.replace(/\D/g, ''));
    const endNum = parseInt(end.replace(/\D/g, ''));
    
    for (let i = startNum; i <= endNum; i++) {
      // Preserve the format of the original number
      const formattedNumber = start.replace(/\d+/, i.toString());
      numbers.push(formattedNumber);
    }
    
    return numbers;
  }
  
  /**
   * Fetch messages from database
   */
  async fetchDatabaseMessages(filters) {
    const query = {
      sent_date: {
        $gte: new Date(filters.dateFrom),
        $lte: new Date(filters.dateTo)
      }
    };
    
    if (filters.phoneNumbers && filters.phoneNumbers.length > 0) {
      query.phone_number = { $in: filters.phoneNumbers };
    }
    
    if (filters.businessId) {
      query.business_id = filters.businessId;
    }
    
    if (filters.organizationId) {
      query.organization_id = filters.organizationId;
    }
    
    if (filters.messageRole) {
      if (filters.messageRole === 'both') {
        query.role = { $in: ['user', 'assistant', 'system'] };
      } else {
        query.role = filters.messageRole;
      }
    } else {
      // Default to both user and outbound messages
      query.role = { $in: ['user', 'assistant', 'system'] };
    }
    
    const messages = await Messages.find(query)
      .sort({ sent_date: 1 })
      .lean();
    
    logger.info(`Fetched ${messages.length} messages from database`);
    return messages;
  }
  
  /**
   * Flatten API messages from multiple phone numbers
   */
  flattenApiMessages(apiResponses) {
    const allMessages = [];
    
    for (const response of apiResponses) {
      if (response.success && response.messages) {
        allMessages.push(...response.messages);
      }
    }
    
    return allMessages;
  }
  
  /**
   * Generate detailed verification report
   */
  generateVerificationReport(matchResults, includeDetails, dateFrom, dateTo, phoneNumbers) {
    const report = {
      summary: {
        verificationPeriod: {
          from: dateFrom,
          to: dateTo
        },
        phoneNumbersVerified: phoneNumbers.length,
        phoneNumbers: phoneNumbers,
        totalMessagesInDB: matchResults.statistics.totalDbMessages,
        totalMessagesInAPI: matchResults.statistics.totalApiMessages,
        matchedMessages: matchResults.statistics.matchedCount,
        unmatchedMessages: matchResults.statistics.unmatchedCount,
        matchRate: ((matchResults.statistics.matchedCount / matchResults.statistics.totalDbMessages) * 100).toFixed(2) + '%',
        averageConfidence: matchResults.statistics.averageConfidence,
        firstMessageStats: {
          total: matchResults.statistics.firstMessageStats.total,
          matched: matchResults.statistics.firstMessageStats.matched,
          unmatched: matchResults.statistics.firstMessageStats.unmatched,
          unmatchedRate: matchResults.statistics.firstMessageStats.total > 0
            ? ((matchResults.statistics.firstMessageStats.unmatched / matchResults.statistics.firstMessageStats.total) * 100).toFixed(2) + '%'
            : '0%'
        }
      }
    };
    
    if (includeDetails) {
      report.details = {
        matchedMessages: matchResults.matched,
        unmatchedMessages: matchResults.unmatched
      };
      
      // Group unmatched messages by type
      report.analysis = {
        unmatchedByType: this.groupUnmatchedByType(matchResults.unmatched),
        unmatchedByPhoneNumber: this.groupUnmatchedByPhoneNumber(matchResults.unmatched),
        unmatchedByDate: this.groupUnmatchedByDate(matchResults.unmatched)
      };
    }
    
    return report;
  }
  
  /**
   * Group unmatched messages by type
   */
  groupUnmatchedByType(unmatchedMessages) {
    const grouped = {};
    
    for (const msg of unmatchedMessages) {
      const type = msg.dbMessage.type || 'unknown';
      if (!grouped[type]) {
        grouped[type] = {
          count: 0,
          messages: []
        };
      }
      grouped[type].count++;
      grouped[type].messages.push(msg);
    }
    
    return grouped;
  }
  
  /**
   * Group unmatched messages by phone number
   */
  groupUnmatchedByPhoneNumber(unmatchedMessages) {
    const grouped = {};
    
    for (const msg of unmatchedMessages) {
      const phoneNumber = msg.dbMessage.phoneNumber;
      if (!grouped[phoneNumber]) {
        grouped[phoneNumber] = {
          count: 0,
          messages: []
        };
      }
      grouped[phoneNumber].count++;
      grouped[phoneNumber].messages.push(msg);
    }
    
    return grouped;
  }
  
  /**
   * Group unmatched messages by date
   */
  groupUnmatchedByDate(unmatchedMessages) {
    const grouped = {};
    
    for (const msg of unmatchedMessages) {
      const date = new Date(msg.dbMessage.sentDate).toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = {
          count: 0,
          messages: []
        };
      }
      grouped[date].count++;
      grouped[date].messages.push(msg);
    }
    
    return grouped;
  }
}

module.exports = new VerificationService();