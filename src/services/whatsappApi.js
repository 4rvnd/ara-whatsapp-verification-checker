const axios = require('axios');
const { WHATSAPP_BEARER_TOKEN, WHATSAPP_API } = require('../config/constants');
const { logger } = require('../config/database');

class WhatsAppAPIService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: WHATSAPP_API.BASE_URL,
      headers: {
        'Authorization': WHATSAPP_BEARER_TOKEN,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Fetch WhatsApp messages from the API with progressive limit handling
   * @param {string} userId - User ID for the API endpoint
   * @param {Date} fromDate - Start date for messages
   * @param {Date} toDate - End date for messages
   * @param {number} initialLimit - Initial number of messages to fetch
   */
  async fetchWhatsAppMessages(userId, fromDate, toDate, initialLimit = 50) {
    try {
      let allMessages = [];
      let currentLimit = initialLimit;

      // Try progressively larger limits to get all messages
      for (const limit of WHATSAPP_API.PAGINATION_LIMITS) {
        if (limit < currentLimit) continue;

        const cacheKey = `${userId}_${fromDate.getTime()}_${toDate.getTime()}_${limit}`;

        // Check cache
        if (this.cache.has(cacheKey)) {
          const cached = this.cache.get(cacheKey);
          if (Date.now() - cached.timestamp < this.cacheExpiry) {
            logger.info(`Returning cached WhatsApp messages (limit: ${limit})`);
            return cached.data;
          }
          this.cache.delete(cacheKey);
        }

        const endpoint = WHATSAPP_API.ENDPOINTS.RECENT_CHATS.replace(':userId', userId);

        try {
          const response = await this.apiClient.get(endpoint, {
            params: {
              simplify: true,
              includeMessages: true,
              limit,
              fromDate: fromDate.toISOString(),
              toDate: toDate.toISOString()
            }
          });

          allMessages = response.data || [];

          // Cache the response
          this.cache.set(cacheKey, {
            data: allMessages,
            timestamp: Date.now()
          });

          logger.info(`Fetched ${allMessages.length} conversations with limit ${limit} for user ${userId}`);

          // If we got fewer messages than the limit, we have all messages
          if (allMessages.length < limit) {
            break;
          }

          // If we're at max limit and still getting full results, log a warning
          if (limit === WHATSAPP_API.MAX_LIMIT && allMessages.length === limit) {
            logger.warn(`Reached maximum limit (${limit}), there might be more messages`);
          }

          currentLimit = limit;

        } catch (error) {
          logger.warn(`Failed to fetch with limit ${limit}, trying next limit`, error.message);
          continue;
        }
      }

      return allMessages;

    } catch (error) {
      logger.error('Error fetching WhatsApp messages:', error.message);
      if (error.response) {
        logger.error('API Response Error:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      throw error;
    }
  }

  /**
   * Fetch messages for a specific phone number, trying all userIds until messages found
   * @param {Array<string>} userIds - User IDs to try
   * @param {string} phoneNumber - Phone number to fetch messages for
   * @param {Date} fromDate - Start date for messages
   * @param {Date} toDate - End date for messages
   */
  async fetchMessagesByPhoneNumber(userIds, phoneNumber, fromDate, toDate) {
    for (const userId of userIds) {
      try {
        const cacheKey = `${userId}_${phoneNumber}_${fromDate.getTime()}_${toDate.getTime()}`;

        // Check cache
        if (this.cache.has(cacheKey)) {
          const cached = this.cache.get(cacheKey);
          if (Date.now() - cached.timestamp < this.cacheExpiry) {
            if (cached.data && cached.data.messages && cached.data.messages.length > 0) {
              logger.info(`Returning cached messages for phone ${phoneNumber} from user ${userId}`);
              return { data: cached.data, userId };
            }
          }
          this.cache.delete(cacheKey);
        }

        const endpoint = WHATSAPP_API.ENDPOINTS.CHATS_BY_PHONE.replace(':userId', userId);

        const response = await this.apiClient.get(endpoint, {
          params: {
            phoneNumber: phoneNumber,
            simplify: true,
            includeMessages: true,
            fromDate: fromDate.toISOString(),
            toDate: toDate.toISOString()
          }
        });

        // Cache the response
        this.cache.set(cacheKey, {
          data: response.data,
          timestamp: Date.now()
        });

        console.log(response.data);
        // Check if messages array is not empty
        if (response.data && response.data.messages && response.data.messages.length > 0) {
          logger.info(`Found messages for phone ${phoneNumber} via user ${userId}`);
          return { data: response.data, userId };
        } else {
          logger.info(`No messages found for phone ${phoneNumber} via user ${userId}, trying next user`);
        }

      } catch (error) {
        logger.warn(`Error fetching messages for phone ${phoneNumber} via user ${userId}:`, error.message);
        continue;
      }
    }

    logger.warn(`No messages found for phone ${phoneNumber} across all ${userIds.length} users`);
    return null;
  }

  /**
   * Fetch messages for multiple phone numbers and users
   * @param {Array<string>} phoneNumbers - Array of phone numbers
   * @param {Array<string>} userIds - Array of user IDs to fetch messages for
   * @param {Date} fromDate - Start date
   * @param {Date} toDate - End date
   */
  async fetchMessagesForPhoneNumbers(phoneNumbers, userIds, fromDate, toDate) {
    const allMessages = [];
    const errors = [];

    // If no userIds provided, return error
    if (!userIds || userIds.length === 0) {
      errors.push({
        error: 'No user IDs provided',
        success: false
      });
      return { messages: allMessages, errors };
    }

    // Create a set to track which phone numbers we've found
    const foundPhoneNumbers = new Set();

    // Fetch messages for each user ID
    for (const userId of userIds) {
      try {
        logger.info(`Fetching messages for user: ${userId}`);
        const apiResponse = await this.fetchWhatsAppMessages(userId, fromDate, toDate, 50);

        // Process the API response based on the sample format
        // Response is an array of conversations with messages
        for (const conversation of apiResponse) {
          const phoneNumber = conversation.to || conversation.id?.replace('@c.us', '');

          // Check if this phone number is in our list (or include all if no specific numbers provided)
          if (phoneNumbers.length === 0 || phoneNumbers.includes(phoneNumber)) {
            foundPhoneNumbers.add(phoneNumber);

            // Transform messages to a consistent format
            const transformedMessages = conversation.messages?.map(msg => ({
              body: msg.body,
              message: msg.body,
              timestamp: new Date(msg.timestamp * 1000), // Convert Unix timestamp to Date
              role: msg.role,
              from: msg.from,
              to: msg.to,
              type: msg.type,
              hasMedia: msg.hasMedia,
              userId: userId // Include userId in the message for tracking
            })) || [];

            // Check if we already have messages for this phone number
            const existingEntry = allMessages.find(m => m.phoneNumber === phoneNumber);
            if (existingEntry) {
              // Merge messages from different users
              existingEntry.messages.push(...transformedMessages);
            } else {
              allMessages.push({
                phoneNumber,
                messages: transformedMessages,
                success: true
              });
            }
          }
        }

      } catch (error) {
        logger.error(`Error fetching messages for user ${userId}:`, error);
        errors.push({
          userId,
          error: error.message,
          success: false
        });
      }
    }

    // After processing all users, try phone-specific endpoint for missing numbers
    if (phoneNumbers.length > 0) {
      const missingPhoneNumbers = phoneNumbers.filter(phone => !foundPhoneNumbers.has(phone));

      for (const phoneNumber of missingPhoneNumbers) {
        logger.info(`Phone ${phoneNumber} not found in recent chats, trying phone-specific endpoint with all users`);

        const phoneResponse = await this.fetchMessagesByPhoneNumber(userIds, phoneNumber, fromDate, toDate);

        if (phoneResponse) {
          foundPhoneNumbers.add(phoneNumber);

          // Transform the response (single conversation object)
          const transformedMessages = phoneResponse.data.messages?.map(msg => ({
            body: msg.body,
            message: msg.body,
            timestamp: msg.timestamp ? new Date(msg.timestamp * 1000) : new Date(),
            role: msg.role,
            from: msg.from,
            to: msg.to,
            type: msg.type,
            hasMedia: msg.hasMedia,
            userId: phoneResponse.userId // Use the userId that had the messages
          })) || [];

          // Check if we already have messages for this phone number
          const existingEntry = allMessages.find(m => m.phoneNumber === phoneNumber);
          if (existingEntry) {
            existingEntry.messages.push(...transformedMessages);
          } else {
            allMessages.push({
              phoneNumber,
              messages: transformedMessages,
              success: true
            });
          }
        } else {
          // No messages found across all users
          logger.warn(`No messages found for phone ${phoneNumber} across all users and endpoints`);
          allMessages.push({
            phoneNumber,
            messages: [],
            success: true
          });
        }
      }
    }

    return { messages: allMessages, errors };
  }

  /**
   * Clear API cache
   */
  clearCache() {
    this.cache.clear();
    logger.info('WhatsApp API cache cleared');
  }
}

module.exports = new WhatsAppAPIService();