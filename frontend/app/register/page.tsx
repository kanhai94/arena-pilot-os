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
  user: {
    id: string;
    tenantId: string;
    fullName: string;
    email: string;
    role: string;
  };
  accessToken: string;
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

type OrganizationType = 'SPORTS' | 'SCHOOL';
type PlanApiResponse = {
  id?: string;
  name: string;
  price?: number;
  monthlyPrice?: number;
  studentLimit: number | string | null;
  isRecommended?: boolean;
  note?: string;
};
type RegistrationPlan = {
  id: string;
  name: string;
  studentLimit: number | 'Unlimited' | null;
  monthlyPrice: number;
  note: string;
  isRecommended: boolean;
};
type FieldKey =
  | 'academyName'
  | 'ownerName'
  | 'academyEmail'
  | 'adminName'
  | 'adminEmail'
  | 'adminPassword'
  | 'confirmPassword';

const formatStudentLimit = (studentLimit: RegistrationPlan['studentLimit']) =>
  studentLimit === null || studentLimit === 'Unlimited' ? 'Unlimited students' : `Up to ${studentLimit} students`;

const buildPlanNote = (studentLimit: RegistrationPlan['studentLimit'], monthlyPrice: number) => {
  if (monthlyPrice <= 0) {
    return 'No payment required';
  }

  return formatStudentLimit(studentLimit);
};

const normalizePlan = (plan: PlanApiResponse): RegistrationPlan => {
  const normalizedStudentLimit =
    plan.studentLimit === 'Unlimited' || plan.studentLimit === null || plan.studentLimit === undefined
      ? 'Unlimited'
      : Number(plan.studentLimit);
  const monthlyPrice = typeof plan.monthlyPrice === 'number' ? plan.monthlyPrice : Number(plan.price || 0);

  return {
    id: plan.id || plan.name.trim().toLowerCase().replace(/\s+/g, '-'),
    name: plan.name,
    studentLimit: Number.isFinite(normalizedStudentLimit as number) ? (normalizedStudentLimit as number) : 'Unlimited',
    monthlyPrice,
    note: plan.note || buildPlanNote(normalizedStudentLimit, monthlyPrice),
    isRecommended: Boolean(plan.isRecommended)
  };
};

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
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [planOptions, setPlanOptions] = useState<RegistrationPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState('');

  const [academyName, setAcademyName] = useState('');
  const [organizationType, setOrganizationType] = useState<OrganizationType>('SPORTS');
  const [selectedPlanId, setSelectedPlanId] = useState('');
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
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
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
  const selectedPlan = useMemo(() => planOptions.find((plan) => plan.id === selectedPlanId) || null, [planOptions, selectedPlanId]);

  const detailsSnapshot = useMemo(
    () =>
      JSON.stringify({
        academyName: academyName.trim(),
        organizationType,
        planName: selectedPlan?.name || '',
        ownerName: ownerName.trim(),
        academyEmail: academyEmail.trim().toLowerCase(),
        adminName: adminName.trim(),
        adminEmail: normalizedAdminEmail,
        adminPassword,
        confirmPassword
      }),
    [
      academyName,
      organizationType,
      selectedPlan,
      ownerName,
      academyEmail,
      adminName,
      normalizedAdminEmail,
      adminPassword,
      confirmPassword
    ]
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
    if (!selectedPlan) return 'Please select a plan to continue.';
    if (!detailChecks[0].pass) return 'Academy name required.';
    if (!detailChecks[1].pass) return 'Owner name required.';
    if (!detailChecks[2].pass) return 'Valid academy email required.';
    if (!detailChecks[3].pass) return 'Admin name required.';
    if (!detailChecks[4].pass) return 'Valid admin email required.';
    if (!detailChecks[5].pass) return 'Admin password must be at least 8 characters.';
    if (!detailChecks[6].pass) return 'Password and confirm password must match.';
    return null;
  }, [detailChecks, selectedPlan]);

  const detailsReady = !detailsError;
  const otpSnapshotMismatch = Boolean(otpSent && otpLockedSnapshot && otpLockedSnapshot !== detailsSnapshot);
  const paymentRequired = (selectedPlan?.monthlyPrice || 0) > 0;
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
  const otpBusy = sendingOtp || verifyingOtp;
  const otpDigitsEntered = otpCode.trim().length;

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
      setPlansLoading(true);
      setPlansError('');

      try {
        let plans: PlanApiResponse[] = [];

        try {
          plans = await apiGet<PlanApiResponse[]>('/plans');
        } catch {
          plans = await apiGet<PlanApiResponse[]>('/auth/registration-plans');
        }

        if (!mounted) return;

        const normalizedPlans = plans.map(normalizePlan);
        setPlanOptions(normalizedPlans);
        setSelectedPlanId((prev) => (normalizedPlans.some((plan) => plan.id === prev) ? prev : ''));
        if (normalizedPlans.length === 0) {
          setPlansError('Unable to load plans. Please try again.');
        }
      } catch {
        if (!mounted) return;
        setPlanOptions([]);
        setSelectedPlanId('');
        setPlansError('Unable to load plans. Please try again.');
      } finally {
        if (mounted) {
          setPlansLoading(false);
        }
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
  }, [selectedPlanId, normalizedAdminEmail, academyEmail, paymentRequired]);

  const sendOtp = async () => {
    if (!detailsReady) {
      markAllTouched();
      setError(detailsError || 'Please complete all required details.');
      return;
    }

    setError('');
    setMessage('');
    setSendingOtp(true);

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
      setSendingOtp(false);
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
    setVerifyingOtp(true);

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
      setVerifyingOtp(false);
    }
  };

  const handlePlanPayment = async (): Promise<RazorpayPaymentPayload> => {
    if (!selectedPlan) {
      throw new Error('Please select a plan first.');
    }

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
        planName: selectedPlan.name,
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
      if (!selectedPlan) {
        setError('Please select a plan first.');
        return;
      }

      const data = await apiPost<RegisterResponse>('/auth/register-tenant', {
        name: academyName.trim(),
        organizationType,
        planName: selectedPlan.name,
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
      localStorage.setItem(
        'currentUser',
        JSON.stringify({ ...loginData.user, accessToken: loginData.accessToken })
      );

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
    <main className="min-h-screen bg-[linear-gradient(180deg,#f3f8fc_0%,#fffaf1_46%,#ffffff_100%)] px-4 py-8 sm:px-6 lg:px-10">
      <section className="mx-auto grid w-full max-w-7xl items-start gap-5 lg:grid-cols-[0.82fr_1.58fr]">
        <aside className="relative self-start overflow-hidden rounded-[28px] bg-[#0f2742] p-6 text-white shadow-[0_24px_64px_rgba(15,39,66,0.22)] sm:p-6 lg:sticky lg:top-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.3),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.22),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]" />
          <div className="relative z-10">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-300">ArenaPilot Onboarding</p>
            <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight">Build Your Academy Setup In Two Clear Steps</h1>
            <p className="mt-3 text-sm leading-6 text-slate-200/95">
              Choose the right plan first, then complete registration, payment, and OTP verification without losing your place.
            </p>

            <div className="mt-5 rounded-[24px] border border-white/15 bg-white/10 p-4 backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Onboarding Readiness</p>
                <p className="text-xl font-black text-white">{completionPercent}%</p>
              </div>
              <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#7dd3fc_0%,#60a5fa_38%,#34d399_100%)] transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-5 space-y-2.5 rounded-[24px] border border-white/12 bg-white/5 p-4">
              {detailChecks.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${item.pass ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  <span className={item.pass ? 'text-slate-100' : 'text-slate-300'}>{item.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[24px] border border-white/12 bg-white/5 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Selected Plan</p>
                  <p className="mt-1 text-base font-bold text-white">{selectedPlan?.name || 'Choose a plan'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100">
                  {selectedPlan ? (selectedPlan.monthlyPrice === 0 ? 'Free' : `Rs ${selectedPlan.monthlyPrice}/mo`) : 'Pending'}
                </div>
              </div>
              <div className="space-y-2">
              {plansLoading
                ? Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-10 animate-pulse rounded-xl bg-white/10" />
                  ))
                : planOptions.map((plan) => (
                    <div
                      key={plan.id}
                      className={`rounded-2xl border px-3.5 py-2.5 text-sm transition ${
                        selectedPlanId === plan.id
                          ? 'border-white/30 bg-white/18 text-white'
                          : 'border-white/10 bg-white/6 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{plan.name}</span>
                        <span className="text-xs text-slate-300">{formatStudentLimit(plan.studentLimit)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </aside>

        <section className="glass-panel rounded-[28px] border border-white/70 bg-white/92 p-5 shadow-[0_24px_64px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Registration Workspace</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Create your academy account</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                A cleaner onboarding experience with dynamic plan selection, guided setup, payment, and OTP verification.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${currentStep === 1 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                Step 1: Plan
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${currentStep === 2 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                Step 2: Setup
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  otpVerified ? 'bg-emerald-100 text-emerald-700' : otpSent ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {otpVerified ? 'OTP Verified' : otpSent ? 'OTP Sent' : 'OTP Pending'}
              </span>
            </div>
          </div>

          <div className="mb-6 rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#fffdf7_0%,#ffffff_100%)] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Step 1</p>
                <h3 className="mt-2 text-[2rem] font-black tracking-tight text-slate-900">Choose the plan that fits your academy</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  These plans load from backend data, so pricing and student limits always stay current.
                </p>
              </div>
              {currentStep === 2 && selectedPlan ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Change Plan
                </button>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {plansLoading
                ? Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="animate-pulse rounded-[24px] border border-slate-200 bg-white p-5">
                      <div className="h-4 w-24 rounded bg-slate-200" />
                      <div className="mt-5 h-9 w-28 rounded bg-slate-200" />
                      <div className="mt-4 h-4 w-32 rounded bg-slate-200" />
                      <div className="mt-7 h-10 rounded-2xl bg-slate-200" />
                    </div>
                  ))
                : planOptions.map((plan) => {
                    const isSelected = selectedPlanId === plan.id;

                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => {
                          setSelectedPlanId(plan.id);
                          setError('');
                          setMessage('');
                        }}
                        className={`group relative overflow-hidden rounded-[24px] border p-5 text-left transition duration-300 ${
                          isSelected
                            ? 'scale-[1.02] border-sky-500 bg-sky-50 shadow-[0_20px_50px_rgba(14,165,233,0.18)]'
                            : plan.isRecommended
                              ? 'border-amber-300 bg-amber-50/70 shadow-[0_18px_45px_rgba(245,158,11,0.14)] hover:-translate-y-1 hover:border-amber-400'
                              : 'border-slate-200 bg-white hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]'
                        }`}
                      >
                        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#38bdf8_0%,#f59e0b_50%,#34d399_100%)] opacity-80" />
                        {plan.isRecommended ? (
                          <span className="absolute right-5 top-5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">
                            Recommended
                          </span>
                        ) : null}

                        <p className="text-lg font-bold text-slate-900">{plan.name}</p>
                        <p className="mt-3 text-[2.45rem] font-black tracking-tight text-slate-900">
                          {plan.monthlyPrice === 0 ? 'Free' : `\u20B9${plan.monthlyPrice}`}
                          {plan.monthlyPrice > 0 ? <span className="ml-1 text-sm font-medium text-slate-500">/month</span> : null}
                        </p>
                        <p className="mt-3 text-sm font-medium text-slate-700">{formatStudentLimit(plan.studentLimit)}</p>
                        <p className="mt-2 min-h-[38px] text-sm leading-6 text-slate-600">{plan.note}</p>

                        <div
                          className={`mt-5 flex items-center justify-between rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
                            isSelected
                              ? 'border-sky-200 bg-white text-sky-700'
                              : 'border-slate-200 bg-slate-50 text-slate-600 group-hover:border-slate-300 group-hover:bg-white'
                          }`}
                        >
                          <span>{isSelected ? 'Selected for onboarding' : 'Click to select plan'}</span>
                          <span
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                              isSelected ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300 bg-white text-transparent'
                            }`}
                          >
                            {'\u2713'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
            </div>

            {plansError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                Unable to load plans. Please try again.
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-slate-200 bg-white px-4 py-3.5">
              <div className="text-sm text-slate-600">
                {selectedPlan ? (
                  <>
                    Selected plan: <span className="font-semibold text-slate-900">{selectedPlan.name}</span>
                  </>
                ) : (
                  'Select a plan to continue to Step 2.'
                )}
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={!selectedPlan || plansLoading || Boolean(plansError)}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>

          {currentStep === 2 && selectedPlan ? (
            <div className="mb-5 rounded-[24px] border border-sky-100 bg-sky-50/80 px-5 py-4 text-sm text-sky-800">
              Step 2 is unlocked. <span className="font-semibold">{selectedPlan.name}</span> is selected, so you can finish setup, payment, and OTP verification below.
            </div>
          ) : null}

          {currentStep === 2 && selectedPlan ? (
            <>
          <div className="mb-5 grid gap-3 sm:grid-cols-[140px_1fr]">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Progress</p>
              <p className="mt-1 text-3xl font-black text-slate-900">{completionPercent}%</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#0f172a_0%,#0ea5e9_55%,#34d399_100%)] transition-all duration-500"
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
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm">
              <div>
                <p className="font-semibold text-slate-900">Plan Payment Required</p>
                <p className="mt-1 text-slate-700">Pay INR {selectedPlan.monthlyPrice} to continue with {selectedPlan.name}.</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setError('');
                  setMessage('');
                  try {
                    await handlePlanPayment();
                    setMessage(
                      'Congratulations! Your payment was successful. You can now verify your OTP to complete academy creation.'
                    );
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Payment failed');
                  }
                }}
                disabled={paymentLoading || paymentDone}
                className="rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {paymentLoading ? 'Opening Checkout...' : paymentDone ? 'Payment Done' : `Pay INR ${selectedPlan.monthlyPrice}`}
              </button>
            </div>
          ) : (
            <div className="mb-5 rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
              {selectedPlan.name} selected. No payment required.
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

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Organization Type</label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setOrganizationType('SPORTS')}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    organizationType === 'SPORTS'
                      ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">Sports Academy</p>
                  <p className="mt-1 text-xs text-slate-600">Use batches, coaches, training, and sports workflows.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setOrganizationType('SCHOOL')}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    organizationType === 'SCHOOL'
                      ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">School</p>
                  <p className="mt-1 text-xs text-slate-600">Use classes, teachers, subjects, and school workflows.</p>
                </button>
              </div>
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

          <section className="mt-6 rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">OTP Verification</h3>
                <p className="mt-1 text-sm text-slate-600">OTP will be sent to admin email: {normalizedAdminEmail || '-'}</p>
              </div>
              <button
                type="button"
                onClick={sendOtp}
                disabled={sendingOtp || verifyingOtp || !detailsReady}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendingOtp ? 'Sending OTP...' : otpSent ? 'Resend OTP' : 'Send OTP'}
              </button>
            </div>

            <div className="mt-5 grid gap-4 rounded-[24px] border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Validate OTP</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      otpVerified
                        ? 'bg-emerald-100 text-emerald-700'
                        : otpSent
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {otpVerified ? 'Verified' : otpSent ? 'Awaiting code' : 'Send first'}
                  </span>
                </div>
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Enter 6 digit OTP"
                  className={`w-full rounded-2xl border bg-white px-4 py-3 text-lg tracking-[0.35em] outline-none transition ${
                    otpVerified
                      ? 'border-emerald-300 focus:border-emerald-500'
                      : otpDigitsEntered === 6
                        ? 'border-indigo-300 focus:border-indigo-500'
                        : 'border-slate-300 focus:border-slate-500'
                  }`}
                />
                <div className="flex items-center justify-between gap-3 text-xs">
                  <p className="text-slate-500">
                    {otpSent ? 'Use the 6-digit code sent to the admin email.' : 'Send OTP after all required details are complete.'}
                  </p>
                  <p className={`font-semibold ${otpDigitsEntered === 6 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {otpDigitsEntered}/6
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={verifyOtp}
                disabled={otpBusy || !otpSent || otpCode.length !== 6 || otpVerified}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verifyingOtp ? 'Verifying OTP...' : otpVerified ? 'OTP Verified' : 'Verify OTP'}
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
            className="mt-6 w-full rounded-[24px] bg-[linear-gradient(90deg,#0f172a_0%,#0ea5e9_52%,#10b981_100%)] px-5 py-4 text-sm font-bold text-white shadow-[0_18px_40px_rgba(14,165,233,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
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
          </>
          ) : null}
        </section>
      </section>
    </main>
  );
}
