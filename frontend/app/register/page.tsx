'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { apiPost } from '../../lib/api';

type RegisterResponse = {
  tenant: {
    id: string;
    name: string;
    ownerName: string;
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

type RegisterStep = 'details' | 'otp';

export default function RegisterPage() {
  const [step, setStep] = useState<RegisterStep>('details');

  const [academyName, setAcademyName] = useState('');
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

  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const normalizedAdminEmail = useMemo(() => adminEmail.trim().toLowerCase(), [adminEmail]);

  const detailsSnapshot = useMemo(
    () =>
      JSON.stringify({
        academyName: academyName.trim(),
        ownerName: ownerName.trim(),
        academyEmail: academyEmail.trim().toLowerCase(),
        adminName: adminName.trim(),
        adminEmail: normalizedAdminEmail,
        adminPassword,
        confirmPassword
      }),
    [academyName, ownerName, academyEmail, adminName, normalizedAdminEmail, adminPassword, confirmPassword]
  );

  const validateDetails = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (academyName.trim().length < 2) return 'Academy name required.';
    if (ownerName.trim().length < 2) return 'Owner name required.';
    if (!emailRegex.test(academyEmail.trim())) return 'Valid academy email required.';
    if (adminName.trim().length < 2) return 'Admin name required.';
    if (!emailRegex.test(normalizedAdminEmail)) return 'Valid admin email required.';
    if (adminPassword.length < 8) return 'Admin password minimum 8 chars hona chahiye.';
    if (adminPassword !== confirmPassword) return 'Password and confirm password match nahi kar rahe.';

    return null;
  };

  const sendOtp = async () => {
    const detailsError = validateDetails();
    if (detailsError) {
      setError(detailsError);
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
      setStep('otp');

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
      setError('Pehle details complete karke OTP send karo.');
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
      setMessage('OTP verified. Register Academy button ab active hai.');
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

    const detailsError = validateDetails();
    if (detailsError) {
      setError(detailsError);
      setStep('details');
      return;
    }

    if (!otpSent || !otpVerified || !otpCode.trim()) {
      setError('Pehle OTP verify karo.');
      setStep('otp');
      return;
    }

    if (otpLockedSnapshot !== detailsSnapshot) {
      setError('Details change hue hain. OTP dobara send and verify karo.');
      setOtpSent(false);
      setOtpVerified(false);
      setOtpCode('');
      setStep('details');
      return;
    }

    setLoading(true);

    try {
      const data = await apiPost<RegisterResponse>('/auth/register-tenant', {
        name: academyName.trim(),
        ownerName: ownerName.trim(),
        email: academyEmail.trim().toLowerCase(),
        adminName: adminName.trim(),
        adminEmail: normalizedAdminEmail,
        adminPassword,
        otpCode: otpCode.trim()
      });

      setMessage(`Academy ${data.tenant.name} registered. Login with ${data.adminUser.email}.`);

      setAcademyName('');
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
      setStep('details');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-5 py-10 sm:px-8">
      <section className="grid w-full gap-5 lg:grid-cols-[1.1fr_1.6fr]">
        <aside className="relative overflow-hidden rounded-3xl bg-slate-900 p-7 text-white soft-shadow">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#38bdf8_0%,transparent_40%),radial-gradient(circle_at_bottom_left,#22c55e_0%,transparent_45%)] opacity-40" />
          <div className="relative z-10">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Academy Onboarding</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight">Register Academy In Two Secure Steps</h1>
            <p className="mt-3 text-sm text-slate-200">
              Step 1: complete business + admin details. Step 2: verify OTP on admin email.
            </p>

            <div className="mt-7 space-y-3">
              <div className={`rounded-xl px-3 py-2 text-sm ${step === 'details' ? 'bg-white/20' : 'bg-white/10'}`}>
                1. Fill Academy Details
              </div>
              <div className={`rounded-xl px-3 py-2 text-sm ${step === 'otp' ? 'bg-white/20' : 'bg-white/10'}`}>
                2. OTP Verification & Final Submit
              </div>
            </div>
          </div>
        </aside>

        <section className="glass-panel soft-shadow rounded-3xl p-6 sm:p-8">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Register Academy</h2>
              <p className="mt-1 text-sm text-slate-600">Production-ready tenant onboarding</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {step === 'details' ? 'Step 1 of 2' : 'Step 2 of 2'}
            </span>
          </div>

          {step === 'details' ? (
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

              <button
                type="button"
                onClick={sendOtp}
                disabled={otpLoading}
                className="sm:col-span-2 mt-1 w-full rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {otpLoading ? 'Sending OTP...' : 'Continue & Send OTP'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Verification Email</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{normalizedAdminEmail}</p>
                <p className="mt-2 text-xs text-slate-500">Agar email galat hai toh back jaake edit karo.</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">Enter 6 digit OTP</label>
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-500"
                />

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('details');
                      setError('');
                      setMessage('');
                    }}
                    className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700"
                  >
                    Back to Details
                  </button>
                  <button
                    type="button"
                    onClick={sendOtp}
                    disabled={otpLoading}
                    className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold"
                  >
                    {otpLoading ? 'Sending...' : 'Resend OTP'}
                  </button>
                  <button
                    type="button"
                    onClick={verifyOtp}
                    disabled={otpLoading || otpCode.length !== 6}
                    className="rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {otpLoading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={registerAcademy}
                  disabled={loading || !otpSent || !otpVerified}
                  className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {loading ? 'Registering...' : 'Register Academy'}
                </button>
              </div>
            </div>
          )}

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
