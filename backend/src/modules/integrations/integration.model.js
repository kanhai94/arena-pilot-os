import mongoose from 'mongoose';

const emailIntegrationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['smtp', 'api'],
      default: 'smtp'
    },
    smtp: {
      host: { type: String, default: '' },
      port: { type: Number, default: 587 },
      user: { type: String, default: '' },
      passwordEnc: { type: String, default: '' },
      fromEmail: { type: String, default: '' }
    },
    api: {
      endpoint: { type: String, default: '' },
      apiKeyEnc: { type: String, default: '' },
      headersEnc: { type: String, default: '' },
      exampleCurl: { type: String, default: '' }
    }
  },
  { _id: false }
);

const smsIntegrationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['api', 'curl'],
      default: 'api'
    },
    api: {
      endpoint: { type: String, default: '' },
      apiKeyEnc: { type: String, default: '' },
      headersEnc: { type: String, default: '' }
    },
    curlTemplateEnc: { type: String, default: '' }
  },
  { _id: false }
);

const whatsappIntegrationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['api', 'curl'],
      default: 'api'
    },
    api: {
      endpoint: { type: String, default: '' },
      apiKeyEnc: { type: String, default: '' },
      headersEnc: { type: String, default: '' }
    },
    curlTemplateEnc: { type: String, default: '' }
  },
  { _id: false }
);

const razorpayIntegrationSchema = new mongoose.Schema(
  {
    keyId: { type: String, default: '' },
    secretEnc: { type: String, default: '' }
  },
  { _id: false }
);

const tenantIntegrationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true
    },
    email: emailIntegrationSchema,
    sms: smsIntegrationSchema,
    whatsapp: whatsappIntegrationSchema,
    razorpay: razorpayIntegrationSchema
  },
  { timestamps: true }
);

tenantIntegrationSchema.set('toJSON', { virtuals: true });
tenantIntegrationSchema.set('toObject', { virtuals: true });

export const TenantIntegration = mongoose.model('TenantIntegration', tenantIntegrationSchema);
