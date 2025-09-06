const stringSimilarity = require('string-similarity');
const { MATCHING, MESSAGE_TYPES } = require('../config/constants');
const { logger } = require('../config/database');

class MessageMatcher {
  /**
   * Calculate similarity between two messages
   * @param {string} dbMessage - Message from database
   * @param {string} apiMessage - Message from WhatsApp API
   * @returns {number} Similarity score between 0 and 1
   */
  calculateSimilarity(dbMessage, apiMessage) {
    if (!dbMessage || !apiMessage) return 0;
    
    // Normalize messages for comparison
    const normalizedDb = this.normalizeMessage(dbMessage);
    const normalizedApi = this.normalizeMessage(apiMessage);
    
    // Use string-similarity library for matching
    return stringSimilarity.compareTwoStrings(normalizedDb, normalizedApi);
  }
  
  /**
   * Normalize message for comparison
   * @param {string} message - Message to normalize
   * @returns {string} Normalized message
   */
  normalizeMessage(message) {
    return message
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
  }
  
  /**
   * Match database messages with WhatsApp API messages
   * @param {Array} dbMessages - Messages from database
   * @param {Array} apiMessages - Messages from WhatsApp API
   * @returns {Object} Matching results
   */
  matchMessages(dbMessages, apiMessages) {
    const results = {
      matched: [],
      unmatched: [],
      statistics: {
        totalDbMessages: dbMessages.length,
        totalApiMessages: apiMessages.length,
        matchedCount: 0,
        unmatchedCount: 0,
        averageConfidence: 0,
        firstMessageStats: {
          total: 0,
          matched: 0,
          unmatched: 0
        }
      }
    };
    
    const apiMessagesCopy = [...apiMessages];
    const matchedApiIndices = new Set();
    
    for (const dbMsg of dbMessages) {
      let bestMatch = null;
      let bestScore = 0;
      let bestIndex = -1;
      
      // Track first messages
      if (dbMsg.type_of_message === MESSAGE_TYPES.FIRST_MESSAGE) {
        results.statistics.firstMessageStats.total++;
      }
      
      // Find best matching API message
      for (let i = 0; i < apiMessagesCopy.length; i++) {
        if (matchedApiIndices.has(i)) continue;
        
        const apiMsg = apiMessagesCopy[i];
        
        // Check if DB message was sent before API message
        const dbDate = new Date(dbMsg.sent_date);
        const apiDate = new Date(apiMsg.timestamp || apiMsg.sent_date);
        
        if (dbDate > apiDate) {
          continue; // DB message should exist before API message
        }
        
        const similarity = this.calculateSimilarity(dbMsg.message, apiMsg.message || apiMsg.body);
        
        if (similarity > bestScore && similarity >= MATCHING.SIMILARITY_THRESHOLD) {
          bestScore = similarity;
          bestMatch = apiMsg;
          bestIndex = i;
        }
      }
      
      if (bestMatch && bestScore >= MATCHING.SIMILARITY_THRESHOLD) {
        matchedApiIndices.add(bestIndex);
        
        results.matched.push({
          dbMessage: {
            id: dbMsg._id,
            message: dbMsg.message,
            phoneNumber: dbMsg.phone_number,
            sentDate: dbMsg.sent_date,
            role: dbMsg.role,
            type: dbMsg.type_of_message
          },
          apiMessage: {
            message: bestMatch.message || bestMatch.body,
            timestamp: bestMatch.timestamp || bestMatch.sent_date
          },
          confidenceScore: bestScore,
          similarityPercentage: (bestScore * 100).toFixed(2) + '%'
        });
        
        results.statistics.matchedCount++;
        
        if (dbMsg.type_of_message === MESSAGE_TYPES.FIRST_MESSAGE) {
          results.statistics.firstMessageStats.matched++;
        }
      } else {
        results.unmatched.push({
          dbMessage: {
            id: dbMsg._id,
            message: dbMsg.message,
            phoneNumber: dbMsg.phone_number,
            sentDate: dbMsg.sent_date,
            role: dbMsg.role,
            type: dbMsg.type_of_message
          },
          bestMatchScore: bestScore,
          reason: bestScore > 0 ? 'Below similarity threshold' : 'No matching message found'
        });
        
        results.statistics.unmatchedCount++;
        
        if (dbMsg.type_of_message === MESSAGE_TYPES.FIRST_MESSAGE) {
          results.statistics.firstMessageStats.unmatched++;
        }
      }
    }
    
    // Calculate average confidence
    if (results.matched.length > 0) {
      const totalConfidence = results.matched.reduce((sum, match) => sum + match.confidenceScore, 0);
      results.statistics.averageConfidence = (totalConfidence / results.matched.length * 100).toFixed(2) + '%';
    }
    
    // Log summary
    logger.info('Message matching completed', {
      matched: results.statistics.matchedCount,
      unmatched: results.statistics.unmatchedCount,
      firstMessageStats: results.statistics.firstMessageStats
    });
    
    return results;
  }
  
  /**
   * Batch process messages for matching
   * @param {Array} dbMessages - Database messages
   * @param {Array} apiMessages - API messages
   * @param {number} batchSize - Size of each batch
   */
  async batchMatchMessages(dbMessages, apiMessages, batchSize = MATCHING.BATCH_SIZE) {
    const allResults = {
      matched: [],
      unmatched: [],
      statistics: {
        totalDbMessages: dbMessages.length,
        totalApiMessages: apiMessages.length,
        matchedCount: 0,
        unmatchedCount: 0,
        averageConfidence: 0,
        firstMessageStats: {
          total: 0,
          matched: 0,
          unmatched: 0
        }
      }
    };
    
    // Process in batches
    for (let i = 0; i < dbMessages.length; i += batchSize) {
      const batch = dbMessages.slice(i, i + batchSize);
      const batchResults = this.matchMessages(batch, apiMessages);
      
      // Merge batch results
      allResults.matched.push(...batchResults.matched);
      allResults.unmatched.push(...batchResults.unmatched);
      
      // Update statistics
      allResults.statistics.matchedCount += batchResults.statistics.matchedCount;
      allResults.statistics.unmatchedCount += batchResults.statistics.unmatchedCount;
      allResults.statistics.firstMessageStats.total += batchResults.statistics.firstMessageStats.total;
      allResults.statistics.firstMessageStats.matched += batchResults.statistics.firstMessageStats.matched;
      allResults.statistics.firstMessageStats.unmatched += batchResults.statistics.firstMessageStats.unmatched;
    }
    
    // Recalculate average confidence
    if (allResults.matched.length > 0) {
      const totalConfidence = allResults.matched.reduce((sum, match) => sum + match.confidenceScore, 0);
      allResults.statistics.averageConfidence = (totalConfidence / allResults.matched.length * 100).toFixed(2) + '%';
    }
    
    return allResults;
  }
}

module.exports = new MessageMatcher();