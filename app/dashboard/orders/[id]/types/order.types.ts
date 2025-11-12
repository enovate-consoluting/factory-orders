// app/dashboard/orders/[id]/types/order.types.ts

export interface Order {
  id: string;
  order_number: string;
  workflow_status: WorkflowStatus;
  status: OrderStatus;
  is_paid: boolean;
  client_id: string;
  manufacturer_id: string;
  sub_manufacturer_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  client_approved: boolean;
  manufacturer_accepted: boolean;
  client?: Client;
  manufacturer?: Manufacturer;
  sub_manufacturer?: User;
  order_products?: OrderProduct[];
}

export interface OrderProduct {
  id: string;
  order_id: string;
  product_id: string;
  product_order_number: string;
  production_start_date?: string;
  production_end_date?: string;
  estimated_completion?: string;
  manufacturer_notes?: string;
  internal_notes?: string;
  client_notes?: string;
  product?: Product;
  order_items?: OrderItem[];
  order_media?: OrderMedia[];
}

export interface OrderItem {
  id: string;
  order_product_id: string;
  variant_combo: string;
  quantity: number;
  notes?: string;
  admin_status: ApprovalStatus;
  manufacturer_status: ApprovalStatus;
  manufacturer_standard_price?: number;
  manufacturer_bulk_price?: number;
  cost_price?: number;
  client_price?: number;
  margin_percentage?: number;
}

export interface OrderMedia {
  id: string;
  order_product_id: string;
  file_url: string;
  file_type: string;
  uploaded_by: string;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
}

export interface Manufacturer {
  id: string;
  name: string;
  email: string;
}

export interface Product {
  id: string;
  title: string;
  description?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  reset_token?: string;
  reset_token_expires?: string;
}

export type UserRole = 'super_admin' | 'admin' | 'order_creator' | 'order_approver' | 'manufacturer' | 'manufacturer_team_member' | 'sub_manufacturer' | 'client';

export type OrderStatus = 'draft' | 'submitted' | 'pending' | 'in_progress' | 'completed' | 'rejected';

export type WorkflowStatus = 
  | 'draft'
  | 'submitted_to_manufacturer'
  | 'priced_by_manufacturer'
  | 'submitted_to_client'
  | 'client_approved'
  | 'ready_for_production'
  | 'in_production'
  | 'completed';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface OrderPermissions {
  canViewCosts: boolean;
  canEditCosts: boolean;
  canViewClientPricing: boolean;
  canEditClientPricing: boolean;
  canApprove: boolean;
  canViewInternalNotes: boolean;
  canEditInternalNotes: boolean;
}