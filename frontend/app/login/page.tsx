'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { apiPost } from '../../lib/api';

type LoginResponse = {
  user: {
    id: string;
    tenantId: string;
    fullName: string;
    email: string;
    role: string;
  };
};

type OtpSendResponse = {
  sent: boolean;
  expiresInMinutes: number;
  devOtp?: string;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiPost<LoginResponse>('/auth/login', { email, password });

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const requestForgotOtp = async () => {
    const normalizedEmail = resetEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setForgotMsg('Enter your registered email to receive OTP.');
      return;
    }
    setForgotLoading(true);
    setForgotMsg('');

    try {
      const data = await apiPost<OtpSendResponse>('/auth/request-forgot-password-otp', { email: normalizedEmail });
      setForgotMsg(
        data.devOtp
          ? `OTP sent. Dev OTP: ${data.devOtp}`
          : `OTP sent to ${normalizedEmail}. Valid for ${data.expiresInMinutes} minutes.`
      );
    } catch (err) {
      setForgotMsg(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setForgotLoading(false);
    }
  };

  const resetPassword = async () => {
    const normalizedEmail = resetEmail.trim().toLowerCase();
    const normalizedOtp = resetOtp.trim();

    if (!normalizedEmail || !normalizedOtp || !newPassword) {
      setForgotMsg('Email, OTP, and new password are required.');
      return;
    }

    if (!/^\d{6}$/.test(normalizedOtp)) {
      setForgotMsg('OTP must be exactly 6 digits.');
      return;
    }

    if (newPassword.length < 8) {
      setForgotMsg('New password must be at least 8 characters.');
      return;
    }

    setForgotLoading(true);
    setForgotMsg('');

    try {
      await apiPost('/auth/reset-password-with-otp', {
        email: normalizedEmail,
        otpCode: normalizedOtp,
        newPassword
      });
      setForgotMsg('Password reset successful. You can now login with new password.');
      setResetOtp('');
      setNewPassword('');
    } catch (err) {
      setForgotMsg(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center gap-8 px-6 py-10">
      <section className="hidden w-1/2 rounded-3xl bg-slate-900 p-10 text-white lg:block">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-300">Sports Academy SaaS</p>
        <h1 className="mt-3 text-4xl font-bold leading-tight">Secure Ops Portal For Modern Multi-Tenant Academies</h1>
        <p className="mt-4 text-slate-300">Students, batches, attendance, fees, notifications and billing on one production-ready backbone.</p>
        <ul className="mt-8 space-y-3 text-sm text-slate-200">
          <li>OTP secured sign-up and password reset</li>
          <li>Role-based access with tenant isolation</li>
          <li>Event-driven notifications and queue workers</li>
        </ul>
      </section>

      <section className="glass-panel soft-shadow w-full rounded-3xl p-8 lg:w-1/2">
        <h2 className="text-3xl font-bold text-slate-900">Welcome Back</h2>
        <p className="mt-1 text-sm text-slate-600">Login to your command center</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-500"
              placeholder="admin@academy.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-500"
              placeholder="********"
            />
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowForgot((v) => !v)}
              className="text-sm font-medium text-indigo-700 underline"
            >
              Forgot password?
            </button>
            <Link href="/register" className="text-sm font-medium text-slate-700 underline">
              Create academy account
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {showForgot ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-lg font-semibold text-slate-900">Reset Password via OTP</h3>
            <div className="mt-3 grid gap-2">
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="Registered email"
                className="rounded-xl border border-slate-300 px-3 py-2"
              />
              <div className="flex gap-2">
                <input
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value)}
                  placeholder="6 digit OTP"
                  className="w-1/2 rounded-xl border border-slate-300 px-3 py-2"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  className="w-1/2 rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={forgotLoading}
                  onClick={requestForgotOtp}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
                >
                  Send OTP
                </button>
                <button
                  type="button"
                  disabled={forgotLoading}
                  onClick={resetPassword}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                >
                  Reset Password
                </button>
              </div>
              {forgotMsg ? <p className="text-sm text-indigo-700">{forgotMsg}</p> : null}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
