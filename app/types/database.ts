// Database type definitions for the Factory Order System

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'order_creator' | 'order_approver' | 'manufacturer' | 'client';
  created_at: string;
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
  type?: VariantType;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  created_at: string;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_option_id: string;
  created_at: string;
  variant_option?: VariantOption;
}

export type OrderStatus = 
  | 'pending'  // Added this to fix the build error
  | 'draft'
  | 'submitted'
  | 'submitted_to_manufacturer'
  | 'manufacturer_processed'
  | 'submitted_to_client'
  | 'client_reviewed'
  | 'approved_by_client'
  | 'submitted_for_sample'
  | 'sample_in_production'
  | 'sample_delivered'
  | 'sample_approved'
  | 'in_production'
  | 'partially_in_production'
  | 'completed'
  | 'rejected'
  | 'revision_requested';  // Also added this one we're using

export interface Order {
  id: string;
  order_number: string;
  client_id: string;
  manufacturer_id: string;
  sub_manufacturer_id?: string;
  status: OrderStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  client?: Client;
  manufacturer?: Manufacturer;
  created_by_user?: User;
  products?: OrderProduct[];
}

export type ProductStatus = 
  | 'pending'
  | 'manufacturer_review'
  | 'sample_required'
  | 'sample_requested'  // Added
  | 'sample_pending'
  | 'sample_approved'
  | 'client_review'
  | 'pending_client_approval'  // Added
  | 'client_approved'
  | 'approved'
  | 'in_production'
  | 'completed'
  | 'on_hold'
  | 'revision_requested'  // Added
  | 'rejected';  // Added

export interface OrderProduct {
  id: string;
  order_id: string;
  product_id: string;
  product_order_number: string;
  created_at: string;
  
  // New fields for product-level workflow
  product_status: ProductStatus;
  requires_sample: boolean;
  requires_client_approval: boolean;
  is_locked: boolean;
  locked_at?: string;
  locked_by?: string;
  
  // Notes
  manufacturer_notes?: string;
  admin_notes?: string;
  
  // Sample pricing and timing
  sample_fee?: number;
  sample_eta?: string;
  sample_status?: string;  // Added
  sample_shipping_method?: 'air' | 'land';
  sample_shipping_cost?: number;
  
  // Full order pricing and timing
  full_order_eta?: string;
  full_shipping_method?: 'air' | 'land';
  full_shipping_cost?: number;
  standard_price?: number;
  bulk_price?: number;
  shipping_air?: number;  // Added
  shipping_boat?: number;  // Added
  production_time?: string;  // Added
  
  // Relations
  product?: Product;
  order?: Order;
  items?: OrderItem[];
  media?: OrderMedia[];
  locked_by_user?: User;
}

export interface OrderItem {
  id: string;
  order_product_id: string;
  variant_combo: string;
  quantity: number;
  notes?: string;
  admin_status: 'pending' | 'approved' | 'rejected';
  manufacturer_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  order_product?: OrderProduct;
}

export interface OrderMedia {
  id: string;
  order_product_id: string;
  file_url: string;
  file_type: string;
  uploaded_by: string;
  created_at: string;
  order_product?: OrderProduct;
  uploaded_by_user?: User;
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
  timestamp: string;
  user?: User;
}

export type NotificationType = 
  | 'new_order' 
  | 'product_update' 
  | 'sample_ready' 
  | 'approval_needed';

export interface Notification {
  id: string;
  user_id: string;
  order_id?: string;
  order_product_id?: string;
  type: NotificationType;
  is_read: boolean;
  message: string;
  created_at: string;
  user?: User;
  order?: Order;
  order_product?: OrderProduct;
}

export interface ProductCommunication {
  id: string;
  order_product_id: string;
  user_id: string;
  message: string;
  is_internal: boolean;
  created_at: string;
  order_product?: OrderProduct;
  user?: User;
}

// Helper type for form states
export interface OrderFormData {
  client_id: string;
  manufacturer_id: string;
  products: {
    product_id: string;
    items: {
      variant_combo: string;
      quantity: number;
      notes?: string;
    }[];
    media?: File[];
  }[];
}

// Helper type for status badge colors
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-gray-500',  // Added
  draft: 'bg-gray-500',
  submitted: 'bg-blue-500',
  submitted_to_manufacturer: 'bg-purple-500',
  manufacturer_processed: 'bg-indigo-500',
  submitted_to_client: 'bg-pink-500',
  client_reviewed: 'bg-orange-500',
  approved_by_client: 'bg-teal-500',
  submitted_for_sample: 'bg-yellow-500',
  sample_in_production: 'bg-amber-500',
  sample_delivered: 'bg-lime-500',
  sample_approved: 'bg-green-500',
  in_production: 'bg-cyan-500',
  partially_in_production: 'bg-sky-500',
  completed: 'bg-emerald-500',
  rejected: 'bg-red-500',
  revision_requested: 'bg-orange-500',  // Added
};

export const PRODUCT_STATUS_COLORS: Record<ProductStatus, string> = {
  pending: 'bg-gray-500',
  manufacturer_review: 'bg-purple-500',
  sample_required: 'bg-yellow-500',
  sample_requested: 'bg-yellow-500',  // Added
  sample_pending: 'bg-amber-500',
  sample_approved: 'bg-lime-500',
  client_review: 'bg-pink-500',
  pending_client_approval: 'bg-purple-500',  // Added
  client_approved: 'bg-teal-500',
  approved: 'bg-green-500',
  in_production: 'bg-cyan-500',
  completed: 'bg-emerald-500',
  on_hold: 'bg-orange-500',
  revision_requested: 'bg-orange-500',  // Added
  rejected: 'bg-red-500',  // Added
};