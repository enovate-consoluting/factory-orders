// lib/auth/reset-password.ts
// Password reset logic

import crypto from 'crypto';
import { supabase, getSupabaseAdmin, isAdminClientAvailable } from './supabase';
import { hashPassword } from './password';
import type { ResetPasswordResult, TokenValidationResult } from './types';

// Token expiry time in minutes
const TOKEN_EXPIRY_MINUTES = 30;

/**
 * Generate a secure reset token
 * @returns A random hex string token
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Calculate token expiry time
 * @returns ISO string of expiry time
 */
export function getTokenExpiry(): string {
  return new Date(Date.now() + 1000 * 60 * TOKEN_EXPIRY_MINUTES).toISOString();
}

/**
 * Request a password reset (creates token and returns it)
 * Note: Email sending should be handled separately
 * @param email - The user's email address
 * @returns Object with success status and token (for email) or error
 */
export async function requestPasswordReset(email: string): Promise<{
  success: boolean;
  token?: string;
  userId?: string;
  userName?: string;
  error?: string;
}> {
  if (!isAdminClientAvailable()) {
    return { success: false, error: 'Server configuration error' };
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Find user
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, email, name')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (userError || !user) {
    return { success: false, error: 'No user found with that email' };
  }

  // Generate token
  const token = generateResetToken();
  const expires = getTokenExpiry();

  // Store token in user record
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ reset_token: token, reset_token_expires: expires })
    .eq('id', user.id);

  if (updateError) {
    return { success: false, error: 'Failed to set reset token' };
  }

  return {
    success: true,
    token,
    userId: user.id,
    userName: user.name,
  };
}

/**
 * Validate a reset token
 * @param token - The reset token to validate
 * @returns Validation result with userId if valid
 */
export async function validateResetToken(token: string): Promise<TokenValidationResult> {
  if (!token) {
    return { valid: false, error: 'Token is required' };
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, reset_token_expires')
    .eq('reset_token', token)
    .single();

  if (userError || !user) {
    return { valid: false, error: 'Invalid or expired token' };
  }

  // Check expiry
  if (new Date(user.reset_token_expires) < new Date()) {
    return { valid: false, error: 'Token has expired' };
  }

  return { valid: true, userId: user.id };
}

/**
 * Reset password with token
 * @param token - The reset token
 * @param newPassword - The new password
 * @returns Result with success status or error
 */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<ResetPasswordResult> {
  // Validate token first
  const validation = await validateResetToken(token);
  if (!validation.valid || !validation.userId) {
    return { success: false, error: validation.error };
  }

  // Hash the new password
  const hashedPassword = await hashPassword(newPassword);

  // Update password and clear token
  const { error: updateError } = await supabase
    .from('users')
    .update({
      password: hashedPassword,
      reset_token: null,
      reset_token_expires: null,
    })
    .eq('id', validation.userId);

  if (updateError) {
    return { success: false, error: 'Failed to reset password' };
  }

  return { success: true };
}

/**
 * Reset password by user ID (admin function)
 * @param userId - The user ID
 * @param newPassword - The new password
 * @returns Result with success status or error
 */
export async function resetPasswordByUserId(
  userId: string,
  newPassword: string
): Promise<ResetPasswordResult> {
  if (!isAdminClientAvailable()) {
    return { success: false, error: 'Server configuration error' };
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Hash the new password
  const hashedPassword = await hashPassword(newPassword);

  // Update password
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ password: hashedPassword })
    .eq('id', userId);

  if (updateError) {
    return { success: false, error: 'Failed to reset password' };
  }

  return { success: true };
}
