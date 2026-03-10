import React from 'react';

export type RazorpayIntegrationForm = {
  keyId: string;
  secret: string;
};

type Status = 'connected' | 'not_configured';

type Props = {
  value: RazorpayIntegrationForm;
  status: Status;
  onChange: (next: RazorpayIntegrationForm) => void;
};

export const RazorpayIntegrationCard: React.FC<Props> = ({ value, status, onChange }) => {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Razorpay Payments</h3>
          <p className="text-xs text-slate-500">Connect tenant Razorpay account for payments.</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {status === 'connected' ? 'Connected' : 'Not Configured'}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          value={value.keyId}
          onChange={(e) => onChange({ ...value, keyId: e.target.value })}
          placeholder="Razorpay Key ID"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={value.secret}
          onChange={(e) => onChange({ ...value, secret: e.target.value })}
          placeholder="Razorpay Secret (leave blank to keep current)"
          type="password"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
    </section>
  );
};
