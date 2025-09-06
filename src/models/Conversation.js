const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema(
  {
    customer_id: {
      required: [true, 'Customer ID is required, cannot be null or empty'],
      type: mongoose.Schema.Types.ObjectId,
    },
    business_id: {
      required: [true, 'Business ID is required, cannot be null or empty'],
      type: mongoose.Schema.Types.ObjectId,
    },
    portfolio_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    organization_id: {
      required: [true, 'Organization ID is required, cannot be null or empty'],
      type: mongoose.Schema.Types.ObjectId,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    is_ai_enabled: {
      type: Boolean,
      default: true,
    },
    ai_stop_reason: {
      type: String,
      trim: true,
    },
    is_poc: {
      type: Boolean,
      default: false,
    },
    phone_number: {
      required: [true, 'Phone Number is required, cannot be null or empty'],
      type: String,
      trim: true,
    },
    next_followup_date: {
      type: Date,
      default: null,
    },
    whatsapp_account_id: {
      required: [
        true,
        'WhatsApp Account ID is required, cannot be null or empty',
      ],
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WhatsappAccount',
    },
    validations: {
      ic_number: {
        type: String,
        enum: ['valid', 'pending', 'invalid'],
        default: 'pending',
        trim: true,
      },
      user_name: {
        type: String,
        enum: ['valid', 'pending', 'invalid'],
        default: 'pending',
        trim: true,
      },
    },
    available_functions: [
      {
        type: String,
        enum: ['userNameValidation', 'icValidation'],
      },
    ],
    use_funnel_architecture: {
      type: Boolean,
      default: true,
    },
    current_stage: {
      type: String,
      enum: [
        'engagement',
        'verification',
        'promise_to_pay',
        'collection',
        'hold',
        'closure',
        'escalation',
      ],
      default: 'engagement',
      index: true,
    },
    stage_history: [
      {
        stage: {
          type: String,
          enum: [
            'engagement',
            'verification',
            'promise_to_pay',
            'collection',
            'hold',
            'closure',
            'escalation',
          ],
          required: true,
        },
        entered_at: {
          type: Date,
          default: Date.now,
        },
        trigger_type: {
          type: String,
          enum: [
            'ai_router',
            'business_event',
            'manual_override',
            'dpd_routing',
            'payment_plan',
            'payment_received',
            'external_payment_hold',
            'auto_advance',
            'max_reminders',
          ],
          required: true,
        },
        trigger_details: {
          type: Object,
        },
        agent_type: {
          type: String,
          enum: [
            'engagement',
            'collection',
            'reminder',
            'verification',
            'legal',
            'dispute',
            'closure',
            'escalation',
            'system',
          ],
        },
        dpd_value: { type: Number },
        metadata: { type: mongoose.Schema.Types.Mixed },
      },
    ],
    last_debtor_response_at: {
      type: Date,
    },
    escalation_flags: [
      {
        type: String,
      },
    ],
    outstanding_balance: {
      type: Number,
      default: 0,
    },
    payment_plan_active: {
      type: Boolean,
      default: false,
    },
    promise_to_pay_extensions: {
      type: Number,
      default: 0,
    },
    last_paid_claim_escalation_at: {
      type: Date,
      default: null,
    },
    payment_claim_count: {
      type: Number,
      default: 0,
    },
    is_on_payment_hold: {
      type: Boolean,
      default: false,
      index: true,
    },
    dpd_integration: {
      last_dpd_value: { type: Number, default: 0 },
      last_dpd_check: { type: Date, default: Date.now },
      dpd_routing_enabled: { type: Boolean, default: true },
    },
    hold_status: {
      is_on_hold: { type: Boolean, default: false },
      hold_reason: { type: String, enum: ['external_payment', 'manual_hold'] },
      hold_start: { type: Date },
      hold_end: { type: Date },
      hold_metadata: { type: mongoose.Schema.Types.Mixed },
    },
    version: { type: Number, default: 1 },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
ConversationSchema.index({ business_id: 1 }, { name: 'queryBy_business' });
ConversationSchema.index({ customer_id: 1 }, { name: 'queryBy_customer' });
ConversationSchema.index({ is_active: 1 }, { name: 'queryBy_isActive' });
ConversationSchema.index({ portfolio_id: 1 }, { name: 'queryBy_portfolio' });
ConversationSchema.index({ current_stage: 1 }, { name: 'queryBy_currentStage' });
ConversationSchema.index({ last_debtor_response_at: 1 }, { name: 'queryBy_lastDebtorResponse' });
ConversationSchema.index({ use_funnel_architecture: 1 }, { name: 'queryBy_funnelFlag' });
ConversationSchema.index({ current_stage: 1, is_active: 1 }, { name: 'queryBy_stage_active' });
ConversationSchema.index({ customer_id: 1, current_stage: 1 }, { name: 'queryBy_customer_stage' });
ConversationSchema.index({ 'dpd_integration.last_dpd_value': 1 }, { name: 'queryBy_lastDpd' });
ConversationSchema.index({ 'dpd_integration.dpd_routing_enabled': 1, is_active: 1 }, { name: 'queryBy_dpdRouting_active' });
ConversationSchema.index({ 'hold_status.is_on_hold': 1, 'hold_status.hold_end': 1 }, { name: 'queryBy_holdStatus' });
ConversationSchema.index({ promise_to_pay_extensions: 1 }, { name: 'queryBy_p2pExtensions' });
ConversationSchema.index({ business_id: 1, current_stage: 1, is_active: 1 }, { name: 'queryBy_business_stage_active' });
ConversationSchema.index({ portfolio_id: 1, current_stage: 1 }, { name: 'queryBy_portfolio_stage' });

ConversationSchema.virtual('last_message', {
  ref: 'Messages',
  localField: '_id',
  foreignField: 'conversation_id',
  options: { sort: { sent_date: -1 } },
  justOne: true,
});

module.exports = mongoose.model('Conversation', ConversationSchema);