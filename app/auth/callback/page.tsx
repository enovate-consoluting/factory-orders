/**
 * SSO Callback Page
 * Handles incoming SSO tokens from Admin app
 * Last Modified: January 2026
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setError('No token provided');
        setTimeout(() => router.push('/'), 2000);
        return;
      }

      try {
        const response = await fetch('/api/auth/verify-sso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const result = await response.json();

        if (result.success && result.user) {
          // Store session in localStorage (same as regular login)
          const sessionData = {
            user: result.user,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
          };
          localStorage.setItem('factory_session', JSON.stringify(sessionData));

          // Redirect to dashboard
          router.push('/dashboard');
        } else {
          setError(result.error || 'Authentication failed');
          setTimeout(() => router.push('/'), 2000);
        }
      } catch (err) {
        console.error('SSO callback error:', err);
        setError('Authentication failed');
        setTimeout(() => router.push('/'), 2000);
      }
    };

    verifyToken();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        {error ? (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-600 font-medium">{error}</p>
            <p className="text-gray-500 text-sm mt-2">Redirecting to login...</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Signing you in...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
