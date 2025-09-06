module.exports = {
  WHATSAPP_BEARER_TOKEN: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZXJ2aWNlIjp7InNlcnZpY2VOYW1lIjoibm90b3dhLXNlcnZpY2UiLCJpc1NlcnZpY2VUb2tlbiI6dHJ1ZSwic2VydmljZV9pZCI6Im5vdG93YS1zZXJ2aWNlIn0sImlhdCI6MTc1NjM2ODQzNCwiZXhwIjoxOTE0MTU2NDM0fQ.5gePx1AuhCxtLigxVfu_DIXiiV83zM-Xt69iiV_ltCs',
  
  // API Configuration
  WHATSAPP_API: {
    BASE_URL: 'https://api.ara-pay.com',
    ENDPOINTS: {
      RECENT_CHATS: '/ara/notowa/users/:userId/chats/recent',
      CHATS_BY_PHONE: '/ara/notowa/users/:userId/chats/by-phone-number'
    },
    DEFAULT_PARAMS: {
      simplify: true,
      includeMessages: true,
      limit: 50
    },
    MAX_LIMIT: 1000,
    PAGINATION_LIMITS: [50, 100, 200, 500, 1000]
  },
  
  // Matching Configuration
  MATCHING: {
    SIMILARITY_THRESHOLD: 0.90, // 90% similarity minimum
    MAX_SIMILARITY_THRESHOLD: 1.0, // 100% similarity maximum
    BATCH_SIZE: 100, // Process messages in batches
    CACHE_TTL: 300000 // 5 minutes cache TTL
  },
  
  // Message Types
  MESSAGE_TYPES: {
    FIRST_MESSAGE: 'first_message',
    FOLLOW_UP: 'follow_up',
    PAYMENT_REMINDER: 'payment_reminder',
    USER_REPLY: 'user_reply'
  },
  
  // Message Roles
  MESSAGE_ROLES: {
    USER: 'user',
    ASSISTANT: 'assistant',
    SYSTEM: 'system',
    ADMIN: 'admin'
  },
  
  // Stage Types
  STAGES: [
    'engagement',
    'verification',
    'promise_to_pay',
    'collection',
    'hold',
    'closure',
    'escalation'
  ]
};