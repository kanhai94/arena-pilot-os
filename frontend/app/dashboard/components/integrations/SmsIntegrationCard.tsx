import React from 'react';

export type SmsIntegrationForm = {
  type: 'api' | 'curl';
  api: {
    endpoint: string;
    apiKey: string;
    headers: string;
  };
  curlTemplate: string;
};

type Status = 'connected' | 'not_configured';

type Props = {
  value: SmsIntegrationForm;
  status: Status;
  onChange: (next: SmsIntegrationForm) => void;
};

export const SmsIntegrationCard: React.FC<Props> = ({ value, status, onChange }) => {
  const setField = (path: keyof SmsIntegrationForm['api'] | 'curlTemplate', nextValue: string) => {
    if (value.type === 'api') {
      onChange({
        ...value,
        api: { ...value.api, [path]: nextValue }
      });
    } else {
      onChange({
        ...value,
        curlTemplate: nextValue
      });
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-slate-900">SMS Notifications</h3>
          <p className="text-xs text-slate-500">Configure SMS provider or CURL template.</p>
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
          onClick={() => onChange({ ...value, type: 'api' })}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            value.type === 'api' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          Direct API
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...value, type: 'curl' })}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            value.type === 'curl' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          CURL Template
        </button>
      </div>

      {value.type === 'api' ? (
        <div className="mt-4 grid gap-3">
          <input
            value={value.api.endpoint}
            onChange={(e) => setField('endpoint', e.target.value)}
            placeholder="SMS API endpoint"
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
        </div>
      ) : (
        <div className="mt-4">
          <textarea
            value={value.curlTemplate}
            onChange={(e) => setField('curlTemplate', e.target.value)}
            placeholder="Paste CURL template. Use {{phone}} and {{message}} variables."
            className="min-h-[120px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      )}
    </section>
  );
};
