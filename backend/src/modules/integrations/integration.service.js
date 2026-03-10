/* global fetch */
import nodemailer from 'nodemailer';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';
import { TenantContext } from '../../core/context/tenantContext.js';
import { encryptSecret, decryptSecret } from '../../utils/secretCipher.js';
import { sendAutomationEmail } from '../../adapters/email.adapter.js';

const mask = (value) => (value ? '******' : null);
const safeTrim = (value) => (typeof value === 'string' ? value.trim() : '');

const parseHeaders = (rawHeaders) => {
  if (!rawHeaders) return {};
  try {
    const parsed = JSON.parse(rawHeaders);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
};

const isEmailConfigured = (email) => {
  if (!email) return false;
  if (email.type === 'smtp') {
    return Boolean(email.smtp?.host && email.smtp?.user && email.smtp?.passwordEnc && email.smtp?.fromEmail);
  }
  if (email.type === 'api') {
    return Boolean(email.api?.endpoint && email.api?.apiKeyEnc);
  }
  return false;
};

const isSmsConfigured = (sms) => {
  if (!sms) return false;
  if (sms.type === 'api') {
    return Boolean(sms.api?.endpoint && sms.api?.apiKeyEnc);
  }
  if (sms.type === 'curl') {
    return Boolean(sms.curlTemplateEnc);
  }
  return false;
};

const isWhatsappConfigured = (whatsapp) => {
  if (!whatsapp) return false;
  if (whatsapp.type === 'api') {
    return Boolean(whatsapp.api?.endpoint && whatsapp.api?.apiKeyEnc);
  }
  if (whatsapp.type === 'curl') {
    return Boolean(whatsapp.curlTemplateEnc);
  }
  return false;
};

const isRazorpayConfigured = (razorpay) => Boolean(razorpay?.keyId && razorpay?.secretEnc);

const parseCurlTemplate = (template, variables) => {
  if (!template) return null;
  const raw = Object.entries(variables).reduce((acc, [key, value]) => {
    const safeVal = value === undefined || value === null ? '' : String(value);
    return acc.replaceAll(`{{${key}}}`, safeVal);
  }, template);

  const urlMatch = raw.match(/https?:\/\/[^\s'"]+/);
  if (!urlMatch) {
    return null;
  }
  const url = urlMatch[0];

  const methodMatch = raw.match(/-X\s+([A-Z]+)/i);
  const method = methodMatch ? methodMatch[1].toUpperCase() : 'POST';

  const headerRegex = /-H\s+['"]([^'"]+)['"]/gi;
  const headers = {};
  let headerMatch;
  while ((headerMatch = headerRegex.exec(raw)) !== null) {
    const [key, ...rest] = headerMatch[1].split(':');
    if (key && rest.length > 0) {
      headers[key.trim()] = rest.join(':').trim();
    }
  }

  const dataMatch = raw.match(/--data-raw\s+['"]([^'"]+)['"]|--data\s+['"]([^'"]+)['"]|-d\s+['"]([^'"]+)['"]/i);
  const body = dataMatch ? dataMatch.slice(1).find(Boolean) : null;

  return { url, method, headers, body };
};

const buildMaskedResponse = (record) => {
  if (!record) {
    return {
      email: { type: 'smtp', smtp: {}, api: {} },
      sms: { type: 'api', api: {}, curlTemplate: null },
      whatsapp: { type: 'api', api: {}, curlTemplate: null },
      razorpay: { keyId: null, secret: null },
      status: {
        email: 'not_configured',
        sms: 'not_configured',
        whatsapp: 'not_configured',
        razorpay: 'not_configured'
      }
    };
  }

  return {
    email: {
      type: record.email?.type || 'smtp',
      smtp: {
        host: record.email?.smtp?.host || '',
        port: record.email?.smtp?.port || 587,
        user: record.email?.smtp?.user || '',
        password: mask(record.email?.smtp?.passwordEnc),
        fromEmail: record.email?.smtp?.fromEmail || ''
      },
      api: {
        endpoint: record.email?.api?.endpoint || '',
        apiKey: mask(record.email?.api?.apiKeyEnc),
        headers: mask(record.email?.api?.headersEnc),
        exampleCurl: record.email?.api?.exampleCurl || ''
      }
    },
    sms: {
      type: record.sms?.type || 'api',
      api: {
        endpoint: record.sms?.api?.endpoint || '',
        apiKey: mask(record.sms?.api?.apiKeyEnc),
        headers: mask(record.sms?.api?.headersEnc)
      },
      curlTemplate: mask(record.sms?.curlTemplateEnc)
    },
    whatsapp: {
      type: record.whatsapp?.type || 'api',
      api: {
        endpoint: record.whatsapp?.api?.endpoint || '',
        apiKey: mask(record.whatsapp?.api?.apiKeyEnc),
        headers: mask(record.whatsapp?.api?.headersEnc)
      },
      curlTemplate: mask(record.whatsapp?.curlTemplateEnc)
    },
    razorpay: {
      keyId: record.razorpay?.keyId || null,
      secret: mask(record.razorpay?.secretEnc)
    },
    status: {
      email: isEmailConfigured(record.email) ? 'connected' : 'not_configured',
      sms: isSmsConfigured(record.sms) ? 'connected' : 'not_configured',
      whatsapp: isWhatsappConfigured(record.whatsapp) ? 'connected' : 'not_configured',
      razorpay: isRazorpayConfigured(record.razorpay) ? 'connected' : 'not_configured'
    }
  };
};

const buildIntegrationPayload = (existing, payload) => {
  const next = existing ? { ...existing } : {};

  if (payload.email) {
    const email = { ...(existing?.email || {}) };
    if (payload.email.type) email.type = payload.email.type;
    if (payload.email.smtp) {
      email.smtp = {
        ...(email.smtp || {}),
        ...(payload.email.smtp.host ? { host: safeTrim(payload.email.smtp.host) } : {}),
        ...(payload.email.smtp.port ? { port: Number(payload.email.smtp.port) } : {}),
        ...(payload.email.smtp.user ? { user: safeTrim(payload.email.smtp.user) } : {}),
        ...(payload.email.smtp.fromEmail ? { fromEmail: safeTrim(payload.email.smtp.fromEmail) } : {})
      };
      if (payload.email.smtp.password) {
        email.smtp.passwordEnc = encryptSecret(safeTrim(payload.email.smtp.password));
      }
    }
    if (payload.email.api) {
      email.api = {
        ...(email.api || {}),
        ...(payload.email.api.endpoint ? { endpoint: safeTrim(payload.email.api.endpoint) } : {}),
        ...(payload.email.api.exampleCurl ? { exampleCurl: payload.email.api.exampleCurl } : {})
      };
      if (payload.email.api.apiKey) {
        email.api.apiKeyEnc = encryptSecret(safeTrim(payload.email.api.apiKey));
      }
      if (payload.email.api.headers) {
        email.api.headersEnc = encryptSecret(payload.email.api.headers);
      }
    }
    next.email = email;
  }

  if (payload.sms) {
    const sms = { ...(existing?.sms || {}) };
    if (payload.sms.type) sms.type = payload.sms.type;
    if (payload.sms.api) {
      sms.api = {
        ...(sms.api || {}),
        ...(payload.sms.api.endpoint ? { endpoint: safeTrim(payload.sms.api.endpoint) } : {})
      };
      if (payload.sms.api.apiKey) {
        sms.api.apiKeyEnc = encryptSecret(safeTrim(payload.sms.api.apiKey));
      }
      if (payload.sms.api.headers) {
        sms.api.headersEnc = encryptSecret(payload.sms.api.headers);
      }
    }
    if (payload.sms.curlTemplate) {
      sms.curlTemplateEnc = encryptSecret(payload.sms.curlTemplate);
    }
    next.sms = sms;
  }

  if (payload.whatsapp) {
    const whatsapp = { ...(existing?.whatsapp || {}) };
    if (payload.whatsapp.type) whatsapp.type = payload.whatsapp.type;
    if (payload.whatsapp.api) {
      whatsapp.api = {
        ...(whatsapp.api || {}),
        ...(payload.whatsapp.api.endpoint ? { endpoint: safeTrim(payload.whatsapp.api.endpoint) } : {})
      };
      if (payload.whatsapp.api.apiKey) {
        whatsapp.api.apiKeyEnc = encryptSecret(safeTrim(payload.whatsapp.api.apiKey));
      }
      if (payload.whatsapp.api.headers) {
        whatsapp.api.headersEnc = encryptSecret(payload.whatsapp.api.headers);
      }
    }
    if (payload.whatsapp.curlTemplate) {
      whatsapp.curlTemplateEnc = encryptSecret(payload.whatsapp.curlTemplate);
    }
    next.whatsapp = whatsapp;
  }

  if (payload.razorpay) {
    const razorpay = { ...(existing?.razorpay || {}) };
    if (payload.razorpay.keyId) razorpay.keyId = safeTrim(payload.razorpay.keyId);
    if (payload.razorpay.secret) {
      razorpay.secretEnc = encryptSecret(safeTrim(payload.razorpay.secret));
    }
    next.razorpay = razorpay;
  }

  return next;
};

export const createIntegrationService = (repository, dependencies = {}) => {
  const { notificationService } = dependencies;
  const resolveTenantId = (tenantId = null) => TenantContext.requireTenantId(tenantId);

  const getDispatchConfig = async (tenantId) => {
    const scopedTenantId = resolveTenantId(tenantId);
    const record = await repository.getByTenantId(scopedTenantId);
    if (!record) return null;

    const decoded = {
      email: record.email || null,
      sms: record.sms || null,
      whatsapp: record.whatsapp || null,
      razorpay: record.razorpay || null
    };

    if (decoded.email?.smtp?.passwordEnc) {
      try {
        decoded.email.smtp.password = decryptSecret(decoded.email.smtp.passwordEnc);
      } catch {
        decoded.email.smtp.password = '';
      }
    }
    if (decoded.email?.api?.apiKeyEnc) {
      try {
        decoded.email.api.apiKey = decryptSecret(decoded.email.api.apiKeyEnc);
      } catch {
        decoded.email.api.apiKey = '';
      }
    }
    if (decoded.email?.api?.headersEnc) {
      try {
        decoded.email.api.headers = decryptSecret(decoded.email.api.headersEnc);
      } catch {
        decoded.email.api.headers = '';
      }
    }

    if (decoded.sms?.api?.apiKeyEnc) {
      try {
        decoded.sms.api.apiKey = decryptSecret(decoded.sms.api.apiKeyEnc);
      } catch {
        decoded.sms.api.apiKey = '';
      }
    }
    if (decoded.sms?.api?.headersEnc) {
      try {
        decoded.sms.api.headers = decryptSecret(decoded.sms.api.headersEnc);
      } catch {
        decoded.sms.api.headers = '';
      }
    }
    if (decoded.sms?.curlTemplateEnc) {
      try {
        decoded.sms.curlTemplate = decryptSecret(decoded.sms.curlTemplateEnc);
      } catch {
        decoded.sms.curlTemplate = '';
      }
    }

    if (decoded.whatsapp?.api?.apiKeyEnc) {
      try {
        decoded.whatsapp.api.apiKey = decryptSecret(decoded.whatsapp.api.apiKeyEnc);
      } catch {
        decoded.whatsapp.api.apiKey = '';
      }
    }
    if (decoded.whatsapp?.api?.headersEnc) {
      try {
        decoded.whatsapp.api.headers = decryptSecret(decoded.whatsapp.api.headersEnc);
      } catch {
        decoded.whatsapp.api.headers = '';
      }
    }
    if (decoded.whatsapp?.curlTemplateEnc) {
      try {
        decoded.whatsapp.curlTemplate = decryptSecret(decoded.whatsapp.curlTemplateEnc);
      } catch {
        decoded.whatsapp.curlTemplate = '';
      }
    }

    if (decoded.razorpay?.secretEnc) {
      try {
        decoded.razorpay.secret = decryptSecret(decoded.razorpay.secretEnc);
      } catch {
        decoded.razorpay.secret = '';
      }
    }

    return decoded;
  };

  const sendViaCurlTemplate = async (template, variables) => {
    const request = parseCurlTemplate(template, variables);
    if (!request) return { sent: false };
    const headers = { ...request.headers };
    if (!headers['content-type'] && request.body) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
    }
    const response = await fetch(request.url, {
      method: request.method || 'POST',
      headers,
      body: request.body || undefined
    });
    return { sent: response.ok, status: response.status };
  };

  return {
    async getTenantIntegrations() {
      const tenantId = resolveTenantId();
      const record = await repository.getByTenantId(tenantId);
      return buildMaskedResponse(record);
    },

    async updateTenantIntegrations(payload) {
      const tenantId = resolveTenantId();
      const existing = await repository.getByTenantId(tenantId);
      const next = buildIntegrationPayload(existing, payload);
      const updated = await repository.upsertByTenantId(tenantId, next);
      return buildMaskedResponse(updated);
    },

    async sendTenantEmail({ tenantId, to, subject, text, html }) {
      const config = await getDispatchConfig(tenantId);
      if (!config?.email || !isEmailConfigured(config.email)) {
        return { sent: false };
      }

      if (config.email.type === 'smtp') {
        const smtp = config.email.smtp || {};
        if (!smtp.host || !smtp.user || !smtp.password || !smtp.fromEmail) {
          return { sent: false };
        }

        const transporter = nodemailer.createTransport({
          host: smtp.host,
          port: smtp.port || 587,
          secure: false,
          auth: {
            user: smtp.user,
            pass: smtp.password
          }
        });

        await transporter.sendMail({
          from: smtp.fromEmail,
          to,
          subject,
          text,
          html
        });
        return { sent: true };
      }

      if (config.email.type === 'api') {
        const api = config.email.api || {};
        if (!api.endpoint) return { sent: false };

        const headers = {
          'content-type': 'application/json',
          ...parseHeaders(api.headers)
        };
        if (api.apiKey && !headers.Authorization) {
          headers.Authorization = `Bearer ${api.apiKey}`;
        }

        const response = await fetch(api.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ to, subject, text, html })
        });
        return { sent: response.ok, status: response.status };
      }

      return { sent: false };
    },

    async sendTenantWhatsapp({ tenantId, phoneNumber, message }) {
      const config = await getDispatchConfig(tenantId);
      if (!config?.whatsapp || !isWhatsappConfigured(config.whatsapp)) {
        return { sent: false };
      }

      if (config.whatsapp.type === 'api') {
        const api = config.whatsapp.api || {};
        if (!api.endpoint) return { sent: false };
        const headers = {
          'content-type': 'application/json',
          ...parseHeaders(api.headers)
        };
        if (api.apiKey && !headers.Authorization) {
          headers.Authorization = `Bearer ${api.apiKey}`;
        }
        const response = await fetch(api.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone: phoneNumber, message })
        });
        return { sent: response.ok, status: response.status };
      }

      if (config.whatsapp.type === 'curl') {
        return sendViaCurlTemplate(config.whatsapp.curlTemplate, {
          phone: phoneNumber,
          message
        });
      }

      return { sent: false };
    },

    async sendTenantSms({ tenantId, phoneNumber, message }) {
      const config = await getDispatchConfig(tenantId);
      if (!config?.sms || !isSmsConfigured(config.sms)) {
        return { sent: false };
      }

      if (config.sms.type === 'api') {
        const api = config.sms.api || {};
        if (!api.endpoint) return { sent: false };
        const headers = {
          'content-type': 'application/json',
          ...parseHeaders(api.headers)
        };
        if (api.apiKey && !headers.Authorization) {
          headers.Authorization = `Bearer ${api.apiKey}`;
        }
        const response = await fetch(api.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone: phoneNumber, message })
        });
        return { sent: response.ok, status: response.status };
      }

      if (config.sms.type === 'curl') {
        return sendViaCurlTemplate(config.sms.curlTemplate, {
          phone: phoneNumber,
          message
        });
      }

      return { sent: false };
    },

    async sendWhatsappWithFallback({ tenantId, studentId, phoneNumber, messageType, messageContent }) {
      const attempt = await this.sendTenantWhatsapp({ tenantId, phoneNumber, message: messageContent });
      if (attempt.sent) {
        return attempt;
      }
      if (!notificationService) {
        throw new AppError('Notification service unavailable', StatusCodes.SERVICE_UNAVAILABLE);
      }
      await notificationService.sendCustomNotification({ tenantId, studentId, phoneNumber, messageType, messageContent });
      return { sent: true, fallback: true };
    },

    async sendEmailWithFallback({ tenantId, to, subject, text, html }) {
      const attempt = await this.sendTenantEmail({ tenantId, to, subject, text, html });
      if (attempt.sent) {
        return attempt;
      }
      return sendAutomationEmail({ to, subject, text, html });
    }
  };
};
