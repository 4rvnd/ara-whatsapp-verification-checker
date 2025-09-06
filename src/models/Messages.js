const mongoose = require('mongoose');

const MessagesSchema = new mongoose.Schema(
  {
    conversation_id: {
      required: [true, 'Conversation ID is required, cannot be null or empty'],
      type: mongoose.Schema.Types.ObjectId,
    },
    customer_id: {
      required: [true, 'Customer ID is required, cannot be null or empty'],
      type: mongoose.Schema.Types.ObjectId,
    },
    business_id: {
      required: [true, 'Business ID is required, cannot be null or empty'],
      type: mongoose.Schema.Types.ObjectId,
    },
    organization_id: {
      required: [true, 'Organization ID is required, cannot be null or empty'],
      type: mongoose.Schema.Types.ObjectId,
    },
    phone_number: {
      required: [true, 'Phone Number is required, cannot be null or empty'],
      type: String,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['text', 'media'],
      default: 'text',
    },
    media_url: {
      type: String,
      trim: true,
    },
    sent_date: {
      type: Date,
      default: Date.now,
    },
    messageId: {
      type: String,
      trim: true,
    },
    external_message_id: {
      type: String,
      trim: true,
      sparse: true,
    },
    status_updates: {
      sent: Date,
      delivered: Date,
      read: Date,
      failed: Date,
    },
    error: {
      type: String,
    },
    attachments: [{
      file_type: String,
      file_name: String,
      file_size: String,
      file_url: String,
    }],
    status: {
      type: String,
      enum: ['pending', 'queued', 'sent', 'failed'],
      default: 'pending',
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system', 'admin'],
      default: 'assistant',
    },
    type_of_message: {
      type: String,
      enum: ['first_message', 'follow_up', 'payment_reminder', 'user_reply'],
    },
    agent_type: {
      type: String,
      enum: ['verification', 'negotiation', 'legal', 'dispute', 'followup', 'closure', 'escalation'],
      sparse: true,
    },
    stage_context: {
      stage: {
        type: String,
        enum: ['engagement', 'verification', 'promise_to_pay', 'collection', 'closure', 'escalation'],
      },
      is_reminder: {
        type: Boolean,
        default: false,
      },
      hours_since_last_response: {
        type: Number,
      },
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

MessagesSchema.index({ business_id: 1 }, { name: 'queryBy_business' });
MessagesSchema.index({ customer_id: 1 }, { name: 'queryBy_customer' });
MessagesSchema.index({ sent_date: 1 }, { name: 'queryBy_sendDate' });
MessagesSchema.index({ agent_type: 1 }, { name: 'queryBy_agentType' });
MessagesSchema.index({ 'stage_context.stage': 1 }, { name: 'queryBy_stage' });
MessagesSchema.index({ conversation_id: 1, sent_date: -1 });
MessagesSchema.index({ phone_number: 1, sent_date: -1 });
MessagesSchema.index({ type_of_message: 1, sent_date: -1 });

module.exports = mongoose.model('Messages', MessagesSchema);