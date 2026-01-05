// lib/auth/types.ts
// Auth types - shared between factory-orders and client portal

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'user'
  | 'order_creator'
  | 'order_approver'
  | 'manufacturer'
  | 'manufacturer_team_member'
  | 'sub_manufacturer'
  | 'manufacturer_inventory_manager'
  | 'warehouse'
  | 'client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone_number?: string;
  logo_url?: string;
  manufacturer_id?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface Session {
  user: AuthUser;
  expiresAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

export interface ResetPasswordResult {
  success: boolean;
  error?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  userId?: string;
  error?: string;
}

// Permission types
export type Permission = {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canManageUsers: boolean;
  canManageProducts: boolean;
  canViewAuditLog: boolean;
};

// Helper function to get permissions based on role
export function getUserPermissions(role: UserRole): Permission {
  switch (role) {
    case 'super_admin':
      return {
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canApprove: true,
        canManageUsers: true,
        canManageProducts: true,
        canViewAuditLog: true,
      };
    case 'admin':
      return {
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canApprove: true,
        canManageUsers: true,
        canManageProducts: false,
        canViewAuditLog: true,
      };
    case 'order_approver':
      return {
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canApprove: true,
        canManageUsers: false,
        canManageProducts: false,
        canViewAuditLog: false,
      };
    case 'order_creator':
      return {
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canApprove: false,
        canManageUsers: false,
        canManageProducts: false,
        canViewAuditLog: false,
      };
    case 'manufacturer':
    case 'manufacturer_team_member':
    case 'sub_manufacturer':
    case 'manufacturer_inventory_manager':
      return {
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canApprove: false,
        canManageUsers: false,
        canManageProducts: false,
        canViewAuditLog: false,
      };
    case 'client':
      return {
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canApprove: false,
        canManageUsers: false,
        canManageProducts: false,
        canViewAuditLog: false,
      };
    case 'user':
    default:
      return {
        canCreate: true,
        canEdit: false,
        canDelete: false,
        canApprove: false,
        canManageUsers: false,
        canManageProducts: false,
        canViewAuditLog: false,
      };
  }
}

// Allowed roles for each portal
export const ADMIN_PORTAL_ROLES: UserRole[] = [
  'super_admin',
  'admin',
  'order_creator',
  'order_approver',
  'manufacturer',
  'manufacturer_team_member',
  'sub_manufacturer',
  'manufacturer_inventory_manager',
  'warehouse',
];

export const CLIENT_PORTAL_ROLES: UserRole[] = [
  'client',
];
