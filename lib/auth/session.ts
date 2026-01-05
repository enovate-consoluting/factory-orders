// lib/auth/session.ts
// Client-side session management

import type { AuthUser, Session } from './types';

const USER_STORAGE_KEY = 'user';
const SESSION_EXPIRY_KEY = 'sessionExpiry';
const REMEMBERED_EMAIL_KEY = 'rememberedEmail';

// Session duration in days
const SESSION_DURATION_DAYS = 7;

/**
 * Get the current session from localStorage
 * @returns The current session or null if not logged in
 */
export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;

  try {
    const userData = localStorage.getItem(USER_STORAGE_KEY);
    const expiryData = localStorage.getItem(SESSION_EXPIRY_KEY);

    if (!userData) return null;

    const user = JSON.parse(userData) as AuthUser;
    const expiresAt = expiryData || '';

    return { user, expiresAt };
  } catch (error) {
    console.error('Error reading session:', error);
    return null;
  }
}

/**
 * Get the current user from session
 * @returns The current user or null if not logged in
 */
export function getCurrentUser(): AuthUser | null {
  const session = getSession();
  return session?.user || null;
}

/**
 * Check if the session is valid (exists and not expired)
 * @returns True if session is valid
 */
export function isSessionValid(): boolean {
  if (typeof window === 'undefined') return false;

  const session = getSession();
  if (!session) return false;

  if (session.expiresAt) {
    const expiry = new Date(session.expiresAt);
    if (expiry < new Date()) {
      // Session expired - clear it
      clearSession();
      return false;
    }
  }

  return true;
}

/**
 * Set the session (store user in localStorage)
 * @param user - The user to store
 */
export function setSession(user: AuthUser): void {
  if (typeof window === 'undefined') return;

  try {
    // Remove password from stored user data for security
    const { ...userWithoutPassword } = user;
    delete (userWithoutPassword as any).password;

    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userWithoutPassword));

    // Set session expiry
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + SESSION_DURATION_DAYS);
    localStorage.setItem(SESSION_EXPIRY_KEY, expiryDate.toISOString());
  } catch (error) {
    console.error('Error setting session:', error);
  }
}

/**
 * Clear the session (logout)
 */
export function clearSession(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(SESSION_EXPIRY_KEY);
}

/**
 * Get remembered email (for "Remember me" feature)
 * @returns The remembered email or null
 */
export function getRememberedEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REMEMBERED_EMAIL_KEY);
}

/**
 * Set remembered email
 * @param email - The email to remember
 */
export function setRememberedEmail(email: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
}

/**
 * Clear remembered email
 */
export function clearRememberedEmail(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REMEMBERED_EMAIL_KEY);
}

/**
 * Logout helper - clears session and optionally redirects
 * @param redirectUrl - Optional URL to redirect to after logout
 */
export function logout(redirectUrl?: string): void {
  clearSession();

  if (typeof window !== 'undefined' && redirectUrl) {
    window.location.href = redirectUrl;
  }
}
