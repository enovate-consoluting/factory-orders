/**
 * Order List Types
 * TypeScript interfaces for Orders Listing page
 * Location: app/dashboard/orders/types/orderList.types.ts
 * UPDATED: Added 'client_requests' tab for client order requests
 * UPDATED: Added 'ready_to_ship' as parent-level TabType
 * UPDATED: Added estimated_ship_date to OrderProduct
 * UPDATED: Added 'sample_in_production' sub-tab
 * Last Modified: Dec 4 2025
 */

export interface OrderProduct {
  id: string;
  product_order_number: string;
  description: string;
  product_status: string;
  routed_to: string;
  routed_at?: string;
  sample_fee?: number;
  sample_status?: string;
  client_product_price?: number;
  product_price?: number;
  client_shipping_air_price?: number;
  client_shipping_boat_price?: number;
  shipping_air_price?: number;
  shipping_boat_price?: number;
  selected_shipping_method?: string;
  estimated_ship_date?: string;  // For ready to ship queue
  product?: {
    title: string;
  };
  order_items?: Array<{
    quantity: number;
  }>;
}

export interface Order {
  id: string;
  order_number: string;
  order_name: string | null;
  status: string;
  workflow_status: string;
  created_at: string;
  // Sample request fields (order-level routing)
  sample_routed_to?: string;
  sample_required?: boolean;
  sample_workflow_status?: string;
  sample_status?: string;  // The actual sample status (pending, sample_approved, etc.)
  sample_shipped_date?: string;  // Date when sample was shipped (YYYY-MM-DD)
  sample_tracking_number?: string;  // Tracking number for shipped sample
  sample_shipping_carrier?: string;  // Shipping carrier for shipped sample
  client?: {
    id: string;
    name: string;
    email: string;
  };
  manufacturer?: {
    id: string;
    name: string;
    email: string;
  };
  order_products?: OrderProduct[];
}

// UPDATED: Added 'client_requests' for client order request workflow
export type TabType = 'my_orders' | 'client_requests' | 'invoice_approval' | 'sent_to_other' | 'production_status' | 'ready_to_ship' | 'shipped';

// Production sub-tabs - UPDATED: Added 'sample_in_production'
export type ProductionSubTab = 'sample_approved' | 'sample_in_production' | 'approved_for_production' | 'in_production';

export interface TabCounts {
  my_orders: number;
  client_requests: number;
  invoice_approval: number;
  sent_to_other: number;
  sample_approved: number;
  sample_in_production: number;  // NEW: Count for samples in production
  approved_for_production: number;
  in_production: number;
  ready_to_ship: number;
  shipped: number;
  production_total: number;
}

export interface RoutingStatus {
  status: string;
  label: string;
  color: string;
}