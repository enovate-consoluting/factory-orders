// /types/index.ts

export type UserRole = 
  | 'super_admin' 
  | 'admin' 
  | 'user' 
  | 'order_creator' 
  | 'order_approver' 
  | 'manufacturer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password?: string;
  is_active?: boolean;
  last_login?: string;
  created_at: string;
  updated_at?: string;
  updated_by?: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  token: string;
  ip_address?: string;
  user_agent?: string;
  last_activity: string;
  expires_at?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action_type: string;
  target_type: string;
  target_id: string;
  old_value?: string;
  new_value?: string;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  timestamp: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface Manufacturer {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface VariantType {
  id: string;
  name: string;
  created_at: string;
}

export interface VariantOption {
  id: string;
  type_id: string;
  value: string;
  created_at: string;
  variant_types?: VariantType;
}

export interface Product {
  id: string;
  title: string;
  description?: string;
  created_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_option_id: string;
  created_at: string;
  variant_options?: VariantOption;
}

export type OrderStatus = 
  | 'draft' 
  | 'submitted' 
  | 'in_progress' 
  | 'completed' 
  | 'rejected' 
  | 'pending';

export interface Order {
  id: string;
  order_number: string;
  client_id: string;
  manufacturer_id: string;
  status: OrderStatus;
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  clients?: Client;
  manufacturers?: Manufacturer;
  users?: User;
}

export interface OrderProduct {
  id: string;
  order_id: string;
  product_id: string;
  product_order_number: string;
  created_at: string;
  products?: Product;
}

export type ItemStatus = 'pending' | 'approved' | 'rejected';

export interface OrderItem {
  id: string;
  order_product_id: string;
  variant_combo: string;
  quantity: number;
  notes?: string;
  admin_status: ItemStatus;
  manufacturer_status: ItemStatus;
  standard_price?: number;
  bulk_price?: number;
  created_at: string;
}

export interface OrderMedia {
  id: string;
  order_product_id: string;
  file_url: string;
  file_type: string;
  uploaded_by: string;
  created_at: string;
}

// Utility types for forms and UI
export interface NotificationProps {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface FilterOptions {
  search?: string;
  status?: string;
  role?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Permission checking utility type
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