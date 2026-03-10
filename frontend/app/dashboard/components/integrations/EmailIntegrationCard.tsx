import React from 'react';

export type EmailIntegrationForm = {
  type: 'smtp' | 'api';
  smtp: {
    host: string;
    port: string;
    user: string;
    password: string;
    fromEmail: string;
  };
  api: {
    endpoint: string;
    apiKey: string;
    headers: string;
    exampleCurl: string;
  };
};

type Status = 'connected' | 'not_configured';

type Props = {
  value: EmailIntegrationForm;
  status: Status;
  onChange: (next: EmailIntegrationForm) => void;
};

export const EmailIntegrationCard: React.FC<Props> = ({ value, status, onChange }) => {
  const setField = (path: keyof EmailIntegrationForm['smtp'] | keyof EmailIntegrationForm['api'], nextValue: string) => {
    if (value.type === 'smtp') {
      onChange({
        ...value,
        smtp: { ...value.smtp, [path]: nextValue }
      });
    } else {
      onChange({
        ...value,
        api: { ...value.api, [path]: nextValue }
      });
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Email Broadcast</h3>
          <p className="text-xs text-slate-500">Configure SMTP or API-based email delivery.</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {status === 'connected' ? 'Connected' : 'Not Configured'}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...value, type: 'smtp' })}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            value.type === 'smtp' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          SMTP Credentials
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...value, type: 'api' })}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            value.type === 'api' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          API / CURL
        </button>
      </div>

      {value.type === 'smtp' ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={value.smtp.host}
            onChange={(e) => setField('host', e.target.value)}
            placeholder="SMTP host"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={value.smtp.port}
            onChange={(e) => setField('port', e.target.value.replace(/\D/g, ''))}
            placeholder="SMTP port"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={value.smtp.user}
            onChange={(e) => setField('user', e.target.value)}
            placeholder="SMTP user"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={value.smtp.password}
            onChange={(e) => setField('password', e.target.value)}
            placeholder="SMTP password (leave blank to keep current)"
            type="password"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={value.smtp.fromEmail}
            onChange={(e) => setField('fromEmail', e.target.value)}
            placeholder="From email"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <input
            value={value.api.endpoint}
            onChange={(e) => setField('endpoint', e.target.value)}
            placeholder="API endpoint"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={value.api.apiKey}
            onChange={(e) => setField('apiKey', e.target.value)}
            placeholder="API key (leave blank to keep current)"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={value.api.headers}
            onChange={(e) => setField('headers', e.target.value)}
            placeholder='Headers JSON (e.g., {"Authorization":"Bearer ..."})'
            className="min-h-[90px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={value.api.exampleCurl}
            onChange={(e) => setField('exampleCurl', e.target.value)}
            placeholder="Example CURL request"
            className="min-h-[90px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      )}
    </section>
  );
};
