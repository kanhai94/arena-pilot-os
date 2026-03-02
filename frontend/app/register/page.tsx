'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiPost } from '../../lib/api';

type RegisterResponse = {
  tenant: {
    id: string;
    name: string;
    ownerName: string;
    academySize: number | null;
    requestedPlanName: 'Starter' | 'Growth' | 'Pro';
    email: string;
    subscriptionStatus: string;
    createdAt: string;
  };
  adminUser: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
};

type OtpResponse = {
  sent: boolean;
  expiresInMinutes: number;
  devOtp?: string;
};

type CreateOrderResponse = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  planName: PlanName;
};

type RazorpayPaymentPayload = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

type PlanName = 'Starter' | 'Growth' | 'Pro';

const PLAN_OPTIONS: Array<{
  name: PlanName;
  label: string;
  studentLimit: number | null;
  monthlyPrice: number;
  note: string;
}> = [
  { name: 'Starter', label: 'Starter', studentLimit: 10, monthlyPrice: 0, note: 'Launch with core academy workflows' },
  { name: 'Growth', label: 'Growth', studentLimit: 50, monthlyPrice: 1999, note: 'Scale with stronger operations' },
  { name: 'Pro', label: 'Pro', studentLimit: null, monthlyPrice: 4999, note: 'Unlimited student capacity and scale' }
];

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, callback: (response: unknown) => void) => void;
    };
  }
}

export default function RegisterPage() {
  const [academyName, setAcademyName] = useState('');
  const [planName, setPlanName] = useState<PlanName>('Starter');
  const [ownerName, setOwnerName] = useState('');
  const [academyEmail, setAcademyEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLockedSnapshot, setOtpLockedSnapshot] = useState('');
  const [paymentDone, setPaymentDone] = useState(false);
  const [paymentPayload, setPaymentPayload] = useState<RazorpayPaymentPayload | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const normalizedAdminEmail = useMemo(() => adminEmail.trim().toLowerCase(), [adminEmail]);
  const selectedPlan = useMemo(
    () => PLAN_OPTIONS.find((plan) => plan.name === planName) || PLAN_OPTIONS[0],
    [planName]
  );

  const detailsSnapshot = useMemo(
    () =>
      JSON.stringify({
        academyName: academyName.trim(),
        planName,
        ownerName: ownerName.trim(),
        academyEmail: academyEmail.trim().toLowerCase(),
        adminName: adminName.trim(),
        adminEmail: normalizedAdminEmail,
        adminPassword,
        confirmPassword
      }),
    [academyName, planName, ownerName, academyEmail, adminName, normalizedAdminEmail, adminPassword, confirmPassword]
  );

  const detailChecks = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return [
      { label: 'Academy name', pass: academyName.trim().length >= 2 },
      { label: 'Owner name', pass: ownerName.trim().length >= 2 },
      { label: 'Academy email', pass: emailRegex.test(academyEmail.trim()) },
      { label: 'Admin name', pass: adminName.trim().length >= 2 },
      { label: 'Admin email', pass: emailRegex.test(normalizedAdminEmail) },
      { label: 'Password strength', pass: adminPassword.length >= 8 },
      { label: 'Password confirmation', pass: adminPassword === confirmPassword && confirmPassword.length > 0 }
    ];
  }, [academyName, ownerName, academyEmail, adminName, normalizedAdminEmail, adminPassword, confirmPassword]);

  const detailsError = useMemo(() => {
    if (!detailChecks[0].pass) return 'Academy name required.';
    if (!detailChecks[1].pass) return 'Owner name required.';
    if (!detailChecks[2].pass) return 'Valid academy email required.';
    if (!detailChecks[3].pass) return 'Admin name required.';
    if (!detailChecks[4].pass) return 'Valid admin email required.';
    if (!detailChecks[5].pass) return 'Admin password minimum 8 chars hona chahiye.';
    if (!detailChecks[6].pass) return 'Password and confirm password match nahi kar rahe.';
    return null;
  }, [detailChecks]);

  const detailsReady = !detailsError;
  const otpSnapshotMismatch = Boolean(otpSent && otpLockedSnapshot && otpLockedSnapshot !== detailsSnapshot);
  const paymentRequired = selectedPlan.monthlyPrice > 0;
  const paymentReady = !paymentRequired || paymentDone;

  useEffect(() => {
    const scriptId = 'razorpay-checkout-js';
    if (document.getElementById(scriptId)) return;

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (otpSnapshotMismatch && otpVerified) {
      setOtpVerified(false);
    }
  }, [otpSnapshotMismatch, otpVerified]);

  useEffect(() => {
    if (!paymentRequired) {
      setPaymentDone(false);
      setPaymentPayload(null);
      return;
    }

    setPaymentDone(false);
    setPaymentPayload(null);
  }, [planName, normalizedAdminEmail, academyEmail, paymentRequired]);

  const sendOtp = async () => {
    if (!detailsReady) {
      setError(detailsError || 'Please complete all required details.');
      return;
    }

    setError('');
    setMessage('');
    setOtpLoading(true);

    try {
      const data = await apiPost<OtpResponse>('/auth/request-signup-otp', {
        email: normalizedAdminEmail
      });

      setOtpSent(true);
      setOtpVerified(false);
      setOtpCode('');
      setOtpLockedSnapshot(detailsSnapshot);

      setMessage(
        data.devOtp
          ? `OTP sent to ${normalizedAdminEmail}. Dev OTP: ${data.devOtp}`
          : `OTP sent to ${normalizedAdminEmail}. Valid for ${data.expiresInMinutes} minutes.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    const normalizedOtp = otpCode.trim();

    if (!otpSent) {
      setError('Pehle OTP send karo.');
      return;
    }

    if (otpSnapshotMismatch) {
      setError('Details change hue hain. OTP resend karke verify karo.');
      return;
    }

    if (!/^\d{6}$/.test(normalizedOtp)) {
      setError('OTP 6 digit ka hona chahiye.');
      return;
    }

    setError('');
    setMessage('');
    setOtpLoading(true);

    try {
      await apiPost('/auth/verify-signup-otp', {
        email: normalizedAdminEmail,
        otpCode: normalizedOtp
      });

      setOtpVerified(true);
      setMessage('OTP verified. Ab directly academy create kar sakte ho.');
    } catch (err) {
      setOtpVerified(false);
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setOtpLoading(false);
    }
  };

  const registerAcademy = async () => {
    setError('');
    setMessage('');

    if (!detailsReady) {
      setError(detailsError || 'Please complete all required details.');
      return;
    }

    if (!otpSent || !otpVerified || !otpCode.trim()) {
      setError('Pehle OTP verify karo.');
      return;
    }

    if (otpSnapshotMismatch) {
      setError('Details change hue hain. OTP dobara send and verify karo.');
      setOtpSent(false);
      setOtpVerified(false);
      setOtpCode('');
      setOtpLockedSnapshot('');
      return;
    }

    if (!paymentReady) {
      setError('Paid plan ke liye payment complete karo.');
      return;
    }

    setLoading(true);

    try {
      const data = await apiPost<RegisterResponse>('/auth/register-tenant', {
        name: academyName.trim(),
        planName,
        ownerName: ownerName.trim(),
        email: academyEmail.trim().toLowerCase(),
        adminName: adminName.trim(),
        adminEmail: normalizedAdminEmail,
        adminPassword,
        otpCode: otpCode.trim(),
        ...(paymentPayload ? { payment: paymentPayload } : {})
      });

      setMessage(`Academy ${data.tenant.name} registered. Login with ${data.adminUser.email}.`);

      setAcademyName('');
      setPlanName('Starter');
      setOwnerName('');
      setAcademyEmail('');
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
      setConfirmPassword('');
      setOtpCode('');
      setOtpSent(false);
      setOtpVerified(false);
      setOtpLockedSnapshot('');
      setPaymentDone(false);
      setPaymentPayload(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanPayment = async () => {
    if (!paymentRequired) {
      return;
    }

    if (!detailsReady) {
      setError(detailsError || 'Please complete all required details before payment.');
      return;
    }

    if (!window.Razorpay) {
      setError('Razorpay SDK load nahi hua. Page refresh karke retry karo.');
      return;
    }

    setError('');
    setMessage('');
    setPaymentLoading(true);

    try {
      const order = await apiPost<CreateOrderResponse>('/auth/create-registration-order', {
        planName,
        academyEmail: academyEmail.trim().toLowerCase(),
        adminEmail: normalizedAdminEmail
      });

      const payment = await new Promise<RazorpayPaymentPayload>((resolve, reject) => {
        const RazorpayCtor = window.Razorpay;
        if (!RazorpayCtor) {
          reject(new Error('Unable to initialize Razorpay checkout'));
          return;
        }

        const instance = new RazorpayCtor({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amount,
          currency: order.currency,
          name: 'ArenaPilot OS',
          description: `${order.planName} plan onboarding`,
          prefill: {
            name: adminName.trim(),
            email: normalizedAdminEmail
          },
          theme: {
            color: '#334155'
          },
          handler: (response: any) => {
            resolve({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled'))
          }
        });

        instance.open();
      });

      setPaymentDone(true);
      setPaymentPayload(payment);
      setMessage('Payment successful. Ab Create Academy click karo.');
    } catch (err) {
      setPaymentDone(false);
      setPaymentPayload(null);
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-5 py-10 sm:px-8">
      <section className="grid w-full gap-5 lg:grid-cols-[1.02fr_1.58fr]">
        <aside className="relative overflow-hidden rounded-3xl bg-slate-900 p-7 text-white soft-shadow">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#38bdf8_0%,transparent_40%),radial-gradient(circle_at_bottom_left,#22c55e_0%,transparent_45%)] opacity-35" />
          <div className="relative z-10">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-300">ArenaPilot Onboarding</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight">Register Academy In One Flow</h1>
            <p className="mt-3 text-sm text-slate-200">
              Fill details, pick plan, verify OTP, and create your academy from this single screen.
            </p>

            <div className="mt-6 space-y-2 rounded-2xl border border-white/15 bg-white/5 p-4">
              {detailChecks.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${item.pass ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  <span className={item.pass ? 'text-slate-100' : 'text-slate-300'}>{item.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-2">
              {PLAN_OPTIONS.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-xl px-3 py-2 text-sm ${
                    planName === plan.name ? 'bg-white/25 text-white' : 'bg-white/10 text-slate-200'
                  }`}
                >
                  {plan.label} - {plan.studentLimit === null ? 'Unlimited Students' : `Up to ${plan.studentLimit} Students`}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="glass-panel soft-shadow rounded-3xl p-6 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Register Academy</h2>
              <p className="mt-1 text-sm text-slate-600">One-screen onboarding with inline OTP verification</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                otpVerified ? 'bg-emerald-100 text-emerald-700' : otpSent ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {otpVerified ? 'OTP Verified' : otpSent ? 'OTP Sent' : 'OTP Pending'}
            </span>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {PLAN_OPTIONS.map((plan) => (
              <button
                key={plan.name}
                type="button"
                onClick={() => setPlanName(plan.name)}
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  planName === plan.name
                    ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">{plan.label}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {plan.studentLimit === null ? 'Unlimited students' : `${plan.studentLimit} students`}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-700">
                  {plan.monthlyPrice === 0 ? 'Free' : `INR ${plan.monthlyPrice}/month`}
                </p>
              </button>
            ))}
          </div>

          <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-700">
            Selected Plan: <span className="font-semibold">{selectedPlan.label}</span> - {selectedPlan.note}
          </div>

          {paymentRequired ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              <div>
                <p className="font-semibold text-slate-900">Plan Payment Required</p>
                <p className="text-slate-700">Pay INR {selectedPlan.monthlyPrice} to continue with {selectedPlan.label}.</p>
              </div>
              <button
                type="button"
                onClick={handlePlanPayment}
                disabled={paymentLoading || paymentDone}
                className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                {paymentLoading ? 'Opening Checkout...' : paymentDone ? 'Payment Done' : `Pay INR ${selectedPlan.monthlyPrice}`}
              </button>
            </div>
          ) : (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Starter plan selected. No payment required.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Academy Name</label>
              <input
                type="text"
                value={academyName}
                onChange={(e) => setAcademyName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-500"
                placeholder="Elite Sports Academy"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Owner Name</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Academy Email</label>
              <input
                type="email"
                value={academyEmail}
                onChange={(e) => setAcademyEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Admin Name</label>
              <input
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Admin Email</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Admin Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-500"
                placeholder="Minimum 8 characters"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-500"
                placeholder="Repeat password"
              />
            </div>
          </div>

          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-slate-900">OTP Verification</h3>
              <button
                type="button"
                onClick={sendOtp}
                disabled={otpLoading || !detailsReady}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {otpLoading ? 'Sending...' : otpSent ? 'Resend OTP' : 'Send OTP'}
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-600">OTP will be sent to admin email: {normalizedAdminEmail || '-'}</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6 digit OTP"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 tracking-[0.2em] outline-none focus:border-slate-500"
              />
              <button
                type="button"
                onClick={verifyOtp}
                disabled={otpLoading || !otpSent || otpCode.length !== 6}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {otpLoading ? 'Verifying...' : 'Verify OTP'}
              </button>
            </div>

            {otpSnapshotMismatch ? (
              <p className="mt-2 text-xs font-semibold text-amber-700">
                Details changed after OTP. Please resend OTP and verify again.
              </p>
            ) : null}
          </section>

          <button
            type="button"
            onClick={registerAcademy}
            disabled={loading || !otpVerified || otpSnapshotMismatch || !paymentReady}
            className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Registering...' : paymentRequired ? 'Pay + Create Academy' : 'Create Academy'}
          </button>

          {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
          {message ? <p className="mt-4 text-sm font-medium text-indigo-700">{message}</p> : null}

          <p className="mt-5 text-sm text-slate-600">
            Already have account?{' '}
            <Link href="/login" className="font-semibold text-slate-900 underline">
              Login
            </Link>
          </p>
        </section>
      </section>
    </main>
  );
}
