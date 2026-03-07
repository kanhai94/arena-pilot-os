'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../lib/api';

type RegisterResponse = {
  tenant: {
    id: string;
    name: string;
    ownerName: string;
    academySize: number | null;
    requestedPlanName: string;
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

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    tenantId: string;
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
  planName: string;
};

type RazorpayPaymentPayload = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

type PlanName = string;
type RegistrationPlan = {
  name: string;
  studentLimit: number | null;
  monthlyPrice: number;
  note: string;
};
type FieldKey =
  | 'academyName'
  | 'ownerName'
  | 'academyEmail'
  | 'adminName'
  | 'adminEmail'
  | 'adminPassword'
  | 'confirmPassword';

const DEFAULT_PLAN_OPTIONS: RegistrationPlan[] = [
  { name: 'Starter', studentLimit: 10, monthlyPrice: 0, note: 'Launch with core academy workflows' },
  { name: 'Growth', studentLimit: 50, monthlyPrice: 1999, note: 'Scale with stronger operations' },
  { name: 'Pro', studentLimit: null, monthlyPrice: 4999, note: 'Unlimited student capacity and scale' }
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
  const router = useRouter();
  const [planOptions, setPlanOptions] = useState<RegistrationPlan[]>(DEFAULT_PLAN_OPTIONS);

  const [academyName, setAcademyName] = useState('');
  const [planName, setPlanName] = useState<PlanName>(DEFAULT_PLAN_OPTIONS[0].name);
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
  const [touchedFields, setTouchedFields] = useState<Record<FieldKey, boolean>>({
    academyName: false,
    ownerName: false,
    academyEmail: false,
    adminName: false,
    adminEmail: false,
    adminPassword: false,
    confirmPassword: false
  });

  const normalizedAdminEmail = useMemo(() => adminEmail.trim().toLowerCase(), [adminEmail]);
  const selectedPlan = useMemo(
    () => planOptions.find((plan) => plan.name === planName) || planOptions[0] || DEFAULT_PLAN_OPTIONS[0],
    [planName, planOptions]
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
    if (!detailChecks[5].pass) return 'Admin password must be at least 8 characters.';
    if (!detailChecks[6].pass) return 'Password and confirm password must match.';
    return null;
  }, [detailChecks]);

  const detailsReady = !detailsError;
  const otpSnapshotMismatch = Boolean(otpSent && otpLockedSnapshot && otpLockedSnapshot !== detailsSnapshot);
  const paymentRequired = selectedPlan.monthlyPrice > 0;
  const completedChecks = detailChecks.filter((check) => check.pass).length;
  const completionPercent = Math.round((completedChecks / detailChecks.length) * 100);
  const fieldErrors = useMemo<Record<FieldKey, string>>(
    () => ({
      academyName: academyName.trim().length >= 2 ? '' : 'Academy name must be at least 2 characters.',
      ownerName: ownerName.trim().length >= 2 ? '' : 'Owner name must be at least 2 characters.',
      academyEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(academyEmail.trim()) ? '' : 'Valid academy email required.',
      adminName: adminName.trim().length >= 2 ? '' : 'Admin name must be at least 2 characters.',
      adminEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedAdminEmail) ? '' : 'Valid admin email required.',
      adminPassword: adminPassword.length >= 8 ? '' : 'Password must be at least 8 characters.',
      confirmPassword:
        adminPassword === confirmPassword && confirmPassword.length > 0 ? '' : 'Password confirmation mismatch.'
    }),
    [academyName, ownerName, academyEmail, adminName, normalizedAdminEmail, adminPassword, confirmPassword]
  );
  const touchedInvalidCount = (Object.keys(touchedFields) as FieldKey[]).filter(
    (key) => touchedFields[key] && fieldErrors[key]
  ).length;

  const markTouched = (field: FieldKey) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  const markAllTouched = () => {
    setTouchedFields({
      academyName: true,
      ownerName: true,
      academyEmail: true,
      adminName: true,
      adminEmail: true,
      adminPassword: true,
      confirmPassword: true
    });
  };

  const inputClassName = (field: FieldKey) =>
    `w-full rounded-xl border bg-white px-3 py-2.5 outline-none transition ${
      touchedFields[field] && fieldErrors[field]
        ? 'border-rose-300 focus:border-rose-500'
        : touchedFields[field] && !fieldErrors[field]
          ? 'border-emerald-300 focus:border-emerald-500'
          : 'border-slate-300 focus:border-indigo-500'
    }`;

  useEffect(() => {
    let mounted = true;
    const loadRegistrationPlans = async () => {
      try {
        const plans = await apiGet<RegistrationPlan[]>('/auth/registration-plans');
        if (!mounted || !plans?.length) {
          return;
        }

        setPlanOptions(plans);
        setPlanName((prev) => (plans.some((plan) => plan.name === prev) ? prev : plans[0].name));
      } catch {
        // Keep default fallback plans if API load fails.
      }
    };

    loadRegistrationPlans();
    return () => {
      mounted = false;
    };
  }, []);

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
      markAllTouched();
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
      setError('Please send OTP first.');
      return;
    }

    if (otpSnapshotMismatch) {
      setError('Details have changed. Please resend OTP and verify again.');
      return;
    }

    if (!/^\d{6}$/.test(normalizedOtp)) {
      setError('OTP must be exactly 6 digits.');
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
      setMessage('OTP verified. Creating academy and signing you in...');
      await completeRegistrationAndLogin(normalizedOtp);
    } catch (err) {
      setOtpVerified(false);
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setOtpLoading(false);
    }
  };

  const handlePlanPayment = async (): Promise<RazorpayPaymentPayload> => {
    if (!paymentRequired) {
      throw new Error('Payment not required for selected plan.');
    }

    if (!detailsReady) {
      throw new Error(detailsError || 'Please complete all required details before payment.');
    }

    if (!window.Razorpay) {
      throw new Error('Razorpay SDK failed to load. Please refresh the page and try again.');
    }

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
      return payment;
    } finally {
      setPaymentLoading(false);
    }
  };

  const completeRegistrationAndLogin = async (verifiedOtpCode: string) => {
    setError('');
    setMessage('');

    if (!detailsReady) {
      markAllTouched();
      setError(detailsError || 'Please complete all required details.');
      return;
    }

    if (otpSnapshotMismatch) {
      setError('Details have changed. Please resend OTP and verify again.');
      setOtpSent(false);
      setOtpVerified(false);
      setOtpCode('');
      setOtpLockedSnapshot('');
      return;
    }

    let registrationPaymentPayload = paymentPayload;

    if (paymentRequired && !registrationPaymentPayload) {
      try {
        registrationPaymentPayload = await handlePlanPayment();
      } catch (err) {
        setPaymentDone(false);
        setPaymentPayload(null);
        setError(err instanceof Error ? err.message : 'Payment failed');
        return;
      }
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
        otpCode: verifiedOtpCode,
        ...(registrationPaymentPayload ? { payment: registrationPaymentPayload } : {})
      });

      const loginData = await apiPost<LoginResponse>('/auth/login', {
        email: normalizedAdminEmail,
        password: adminPassword
      });

      localStorage.setItem('accessToken', loginData.accessToken);
      localStorage.setItem('refreshToken', loginData.refreshToken);
      localStorage.setItem('currentUser', JSON.stringify(loginData.user));

      setMessage(`Academy ${data.tenant.name} created. Redirecting to dashboard...`);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration/Login failed');
    } finally {
      setLoading(false);
    }
  };

  const registerAcademy = async () => {
    if (!otpSent || !otpVerified || !otpCode.trim()) {
      setError('Please verify OTP first.');
      return;
    }

    await completeRegistrationAndLogin(otpCode.trim());
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

            <div className="mt-5 rounded-2xl border border-white/20 bg-white/10 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Onboarding Readiness</p>
                <p className="text-lg font-bold text-white">{completionPercent}%</p>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-indigo-300 to-emerald-300 transition-all"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-6 space-y-2 rounded-2xl border border-white/15 bg-white/5 p-4">
              {detailChecks.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${item.pass ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  <span className={item.pass ? 'text-slate-100' : 'text-slate-300'}>{item.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-2">
              {planOptions.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-xl px-3 py-2 text-sm ${
                    planName === plan.name ? 'bg-white/25 text-white' : 'bg-white/10 text-slate-200'
                  }`}
                >
                  {plan.name} - {plan.studentLimit === null ? 'Unlimited Students' : `Up to ${plan.studentLimit} Students`}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="glass-panel soft-shadow rounded-3xl p-6 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Register Academy</h2>
              <p className="mt-1 text-sm text-slate-600">Premium onboarding with live field validation and inline OTP verification</p>
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
            {planOptions.map((plan) => (
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
                <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
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
            Selected Plan: <span className="font-semibold">{selectedPlan.name}</span> - {selectedPlan.note}
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-[120px_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Progress</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{completionPercent}%</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2">
              <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 transition-all"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-600">
                {completedChecks}/{detailChecks.length} required checks complete
              </p>
            </div>
          </div>

          {touchedInvalidCount > 0 ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {touchedInvalidCount} field{touchedInvalidCount > 1 ? 's' : ''} need attention before OTP.
            </div>
          ) : null}

          {paymentRequired ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              <div>
                <p className="font-semibold text-slate-900">Plan Payment Required</p>
                <p className="text-slate-700">Pay INR {selectedPlan.monthlyPrice} to continue with {selectedPlan.name}.</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setError('');
                  setMessage('');
                  try {
                    await handlePlanPayment();
                    setMessage('Payment successful. Verify OTP to automatically create your academy.');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Payment failed');
                  }
                }}
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
                onBlur={() => markTouched('academyName')}
                className={inputClassName('academyName')}
                placeholder="Elite Sports Academy"
              />
              {touchedFields.academyName && fieldErrors.academyName ? (
                <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.academyName}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Owner Name</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                onBlur={() => markTouched('ownerName')}
                className={inputClassName('ownerName')}
              />
              {touchedFields.ownerName && fieldErrors.ownerName ? (
                <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.ownerName}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Academy Email</label>
              <input
                type="email"
                value={academyEmail}
                onChange={(e) => setAcademyEmail(e.target.value)}
                onBlur={() => markTouched('academyEmail')}
                className={inputClassName('academyEmail')}
              />
              {touchedFields.academyEmail && fieldErrors.academyEmail ? (
                <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.academyEmail}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Admin Name</label>
              <input
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                onBlur={() => markTouched('adminName')}
                className={inputClassName('adminName')}
              />
              {touchedFields.adminName && fieldErrors.adminName ? (
                <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.adminName}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Admin Email</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                onBlur={() => markTouched('adminEmail')}
                className={inputClassName('adminEmail')}
              />
              {touchedFields.adminEmail && fieldErrors.adminEmail ? (
                <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.adminEmail}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Admin Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onBlur={() => markTouched('adminPassword')}
                className={inputClassName('adminPassword')}
                placeholder="Minimum 8 characters"
              />
              {touchedFields.adminPassword && fieldErrors.adminPassword ? (
                <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.adminPassword}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Use at least 8 characters.</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => markTouched('confirmPassword')}
                className={inputClassName('confirmPassword')}
                placeholder="Repeat password"
              />
              {touchedFields.confirmPassword && fieldErrors.confirmPassword ? (
                <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.confirmPassword}</p>
              ) : touchedFields.confirmPassword && !fieldErrors.confirmPassword ? (
                <p className="mt-1 text-xs font-medium text-emerald-600">Passwords matched.</p>
              ) : null}
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
            disabled={loading || !otpVerified || otpSnapshotMismatch}
            className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Creating Academy...' : 'Create Academy'}
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
