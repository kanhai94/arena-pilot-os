import { logger } from '../config/logger.js';

export const mockWhatsAppAdapter = {
  async sendMessage(phoneNumber, messageContent) {
    logger.info(
      {
        provider: 'mock-whatsapp',
        phoneNumber,
        messagePreview: messageContent.slice(0, 80)
      },
      'Mock WhatsApp message sent'
    );

    return {
      providerMessageId: `mock-${Date.now()}`,
      accepted: true
    };
  }
};
