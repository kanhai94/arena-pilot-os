import React from 'react';
import { EmailIntegrationCard, type EmailIntegrationForm } from './EmailIntegrationCard';
import { SmsIntegrationCard, type SmsIntegrationForm } from './SmsIntegrationCard';
import { WhatsappIntegrationCard, type WhatsappIntegrationForm } from './WhatsappIntegrationCard';
import { RazorpayIntegrationCard, type RazorpayIntegrationForm } from './RazorpayIntegrationCard';

type Status = 'connected' | 'not_configured';

type IntegrationStatus = {
  email: Status;
  sms: Status;
  whatsapp: Status;
  razorpay: Status;
};

type Props = {
  email: EmailIntegrationForm;
  sms: SmsIntegrationForm;
  whatsapp: WhatsappIntegrationForm;
  razorpay: RazorpayIntegrationForm;
  status: IntegrationStatus;
  onEmailChange: (next: EmailIntegrationForm) => void;
  onSmsChange: (next: SmsIntegrationForm) => void;
  onWhatsappChange: (next: WhatsappIntegrationForm) => void;
  onRazorpayChange: (next: RazorpayIntegrationForm) => void;
  onSave: () => void;
  saving: boolean;
};

export const IntegrationsPage: React.FC<Props> = ({
  email,
  sms,
  whatsapp,
  razorpay,
  status,
  onEmailChange,
  onSmsChange,
  onWhatsappChange,
  onRazorpayChange,
  onSave,
  saving
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Integrations</h3>
          <p className="text-sm text-slate-600">Configure tenant-level providers for messaging and payments.</p>
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Integrations'}
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <EmailIntegrationCard value={email} status={status.email} onChange={onEmailChange} />
        <SmsIntegrationCard value={sms} status={status.sms} onChange={onSmsChange} />
        <WhatsappIntegrationCard value={whatsapp} status={status.whatsapp} onChange={onWhatsappChange} />
        <RazorpayIntegrationCard value={razorpay} status={status.razorpay} onChange={onRazorpayChange} />
      </div>
    </div>
  );
};
