// lib/auth/password.ts
// Secure password hashing using bcrypt

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Hash a plain text password
 * @param plainPassword - The plain text password to hash
 * @returns The hashed password
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Verify a plain text password against a hash
 * @param plainPassword - The plain text password to verify
 * @param hashedPassword - The hashed password to compare against
 * @returns True if the password matches, false otherwise
 */
export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  // Handle legacy plain text passwords (for migration period)
  // If the stored password doesn't look like a bcrypt hash, do direct comparison
  // bcrypt hashes start with $2a$, $2b$, or $2y$
  if (!hashedPassword.startsWith('$2')) {
    // This is a legacy plain text password - compare directly
    // After successful login, the password should be upgraded to hashed
    return plainPassword === hashedPassword;
  }

  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Check if a password is already hashed (bcrypt format)
 * @param password - The password to check
 * @returns True if the password appears to be hashed
 */
export function isPasswordHashed(password: string): boolean {
  return password.startsWith('$2');
}

/**
 * Validate password strength
 * @param password - The password to validate
 * @returns Object with valid status and error message if invalid
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  error?: string;
} {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters' };
  }

  // Add more rules as needed:
  // if (!/[A-Z]/.test(password)) {
  //   return { valid: false, error: 'Password must contain at least one uppercase letter' };
  // }
  // if (!/[0-9]/.test(password)) {
  //   return { valid: false, error: 'Password must contain at least one number' };
  // }

  return { valid: true };
}
