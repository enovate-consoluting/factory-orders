// lib/auth/login.ts
// Login logic - server-side and client-side helpers

import { supabase } from './supabase';
import { verifyPassword, hashPassword, isPasswordHashed } from './password';
import { setSession, setRememberedEmail, clearRememberedEmail } from './session';
import type { AuthUser, LoginCredentials, LoginResult, UserRole } from './types';

/**
 * Authenticate a user with email and password
 * This is meant to be called from the client-side login page
 * @param credentials - Email, password, and optional rememberMe flag
 * @returns LoginResult with success status and user or error
 */
export async function loginUser(credentials: LoginCredentials): Promise<LoginResult> {
  const { email, password, rememberMe } = credentials;

  try {
    // Fetch user from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (userError || !userData) {
      return { success: false, error: 'Invalid email or password' };
    }

    // Verify password (handles both hashed and legacy plain text)
    const isValid = await verifyPassword(password, userData.password);
    if (!isValid) {
      return { success: false, error: 'Invalid email or password' };
    }

    // Build the user object (exclude password)
    const user: AuthUser = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role as UserRole,
      phone_number: userData.phone_number,
      logo_url: userData.logo_url,
      manufacturer_id: userData.manufacturer_id,
      created_by: userData.created_by,
      created_at: userData.created_at,
      updated_at: userData.updated_at,
    };

    // For manufacturers, fetch manufacturer_id from manufacturers table
    if (user.role === 'manufacturer' && !user.manufacturer_id) {
      const { data: manufacturerData } = await supabase
        .from('manufacturers')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (manufacturerData) {
        user.manufacturer_id = manufacturerData.id;
      }
    }

    // Handle "Remember me"
    if (rememberMe) {
      setRememberedEmail(email);
    } else {
      clearRememberedEmail();
    }

    // Store session
    setSession(user);

    return { success: true, user };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'An error occurred during authentication' };
  }
}

/**
 * Server-side login verification (for API routes)
 * Returns user data without setting session
 */
export async function verifyLogin(
  email: string,
  password: string
): Promise<LoginResult> {
  try {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (userError || !userData) {
      return { success: false, error: 'Invalid email or password' };
    }

    const isValid = await verifyPassword(password, userData.password);
    if (!isValid) {
      return { success: false, error: 'Invalid email or password' };
    }

    const user: AuthUser = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role as UserRole,
      phone_number: userData.phone_number,
      logo_url: userData.logo_url,
      manufacturer_id: userData.manufacturer_id,
      created_by: userData.created_by,
      created_at: userData.created_at,
      updated_at: userData.updated_at,
    };

    return { success: true, user };
  } catch (error) {
    console.error('Verify login error:', error);
    return { success: false, error: 'An error occurred during authentication' };
  }
}

/**
 * Upgrade a legacy plain text password to hashed
 * Call this after successful login if password was plain text
 * @param userId - The user ID
 * @param plainPassword - The plain text password to upgrade
 */
export async function upgradePasswordToHashed(
  userId: string,
  plainPassword: string
): Promise<void> {
  try {
    const hashedPassword = await hashPassword(plainPassword);

    // Use a direct update - this should be called from a context with proper permissions
    const { error } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', userId);

    if (error) {
      console.error('Failed to upgrade password:', error);
    } else {
      console.log('Password upgraded to hashed for user:', userId);
    }
  } catch (error) {
    console.error('Error upgrading password:', error);
  }
}
