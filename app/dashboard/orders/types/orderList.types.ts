/**
 * Order List Types
 * TypeScript interfaces for Orders Listing page
 * Location: app/dashboard/orders/types/orderList.types.ts
 * UPDATED: Added 'ready_to_ship' as parent-level TabType
 * UPDATED: Added estimated_ship_date to OrderProduct
 * Last Modified: Nov 28 2025
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
  estimated_ship_date?: string;  // NEW: For ready to ship queue
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

// UPDATED: Added 'ready_to_ship' between production_status and shipped
export type TabType = 'my_orders' | 'invoice_approval' | 'sent_to_other' | 'production_status' | 'ready_to_ship' | 'shipped';

// Production sub-tabs (unchanged)
export type ProductionSubTab = 'sample_approved' | 'approved_for_production' | 'in_production';

export interface TabCounts {
  my_orders: number;
  invoice_approval: number;
  sent_to_other: number;
  sample_approved: number;
  approved_for_production: number;
  in_production: number;
  ready_to_ship: number;  // NEW: Count for ready to ship queue
  shipped: number;
  production_total: number;
}

export interface RoutingStatus {
  status: string;
  label: string;
  color: string;
}