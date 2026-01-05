// lib/auth/index.ts
// Main exports for auth module

// Types
export type {
  UserRole,
  AuthUser,
  Session,
  LoginCredentials,
  LoginResult,
  ResetPasswordResult,
  TokenValidationResult,
  Permission,
} from './types';

export {
  getUserPermissions,
  ADMIN_PORTAL_ROLES,
  CLIENT_PORTAL_ROLES,
} from './types';

// Supabase clients
export {
  supabase,
  getSupabaseAdmin,
  isAdminClientAvailable,
} from './supabase';

// Password utilities
export {
  hashPassword,
  verifyPassword,
  isPasswordHashed,
  validatePasswordStrength,
} from './password';

// Session management
export {
  getSession,
  getCurrentUser,
  isSessionValid,
  setSession,
  clearSession,
  getRememberedEmail,
  setRememberedEmail,
  clearRememberedEmail,
  logout,
} from './session';

// Login
export {
  loginUser,
  verifyLogin,
  upgradePasswordToHashed,
} from './login';

// Password reset
export {
  generateResetToken,
  getTokenExpiry,
  requestPasswordReset,
  validateResetToken,
  resetPasswordWithToken,
  resetPasswordByUserId,
} from './reset-password';
