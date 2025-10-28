'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        // Sign up new user
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name,
            }
          }
        });

        if (signUpError) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }

        // Create user record in users table
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: authData.user?.id,
            email: email,
            name: name,
            role: 'order_creator' // Default role for new users
          });

        if (userError) {
          console.log('User record may already exist, continuing...');
        }

        setError('Check your email to confirm your account!');
        setLoading(false);
        return;
      } else {
        // Sign in existing user
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) {
          setError(signInError.message);
          setLoading(false);
          return;
        }

        // Get user details from users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user?.id)
          .single();

        if (userError || !userData) {
          // Try to get by email as fallback
          const { data: userByEmail } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

          if (userByEmail) {
            localStorage.setItem('user', JSON.stringify(userByEmail));
            router.push('/dashboard');
            return;
          }

          // If user doesn't exist in users table, create one
          const { data: newUser } = await supabase
            .from('users')
            .insert({
              id: authData.user?.id,
              email: authData.user?.email,
              name: authData.user?.user_metadata?.name || email.split('@')[0],
              role: 'order_creator'
            })
            .select()
            .single();

          if (newUser) {
            localStorage.setItem('user', JSON.stringify(newUser));
          } else {
            // Use basic user data
            const basicUser = {
              id: authData.user?.id,
              email: authData.user?.email,
              name: authData.user?.user_metadata?.name || email.split('@')[0],
              role: 'order_creator'
            };
            localStorage.setItem('user', JSON.stringify(basicUser));
          }
        } else {
          localStorage.setItem('user', JSON.stringify(userData));
        }

        // Redirect to dashboard
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError('An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-2">
            Factory Order System
          </h1>
          <p className="text-gray-600">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={isSignUp}
                disabled={loading}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50 disabled:bg-gray-50"
                placeholder="Enter your name"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50 disabled:bg-gray-50"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50 disabled:bg-gray-50"
              placeholder={isSignUp ? 'Create a password' : 'Enter your password'}
              minLength={isSignUp ? 6 : undefined}
            />
            {isSignUp && (
              <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
            )}
          </div>

          {error && (
            <div className={`border rounded-lg p-3 text-sm ${
              error.includes('Check your email') 
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-medium py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01] active:scale-[0.99] shadow-sm"
          >
            {loading 
              ? (isSignUp ? 'Creating account...' : 'Signing in...') 
              : (isSignUp ? 'Create Account' : 'Sign In')
            }
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              {isSignUp 
                ? 'Already have an account? Sign in' 
                : "Don't have an account? Sign up"
              }
            </button>
          </div>
        </form>

        {!isSignUp && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs font-medium text-gray-700 mb-2">Test Accounts:</p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• admin@test.com (Super Admin)</li>
              <li>• man@test.com (Manufacturer)</li>
              <li>• client@test.com (Client)</li>
              <li>• creator@test.com (Order Creator)</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}