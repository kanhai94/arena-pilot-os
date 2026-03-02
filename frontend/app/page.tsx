'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    setIsLoggedIn(Boolean(token));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">Sports Academy Management SaaS</h1>
      <p className="mt-4 text-lg text-slate-600">All phases are connected. Use dashboard to operate modules end-to-end.</p>

      <div className="mt-8 flex flex-wrap gap-3">
        {isLoggedIn ? (
          <Link
            href="/dashboard"
            className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
          >
            Open Dashboard
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
            >
              Go to Login
            </Link>
            <Link
              href="/register"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-900 hover:bg-slate-100"
            >
              Register Academy
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
