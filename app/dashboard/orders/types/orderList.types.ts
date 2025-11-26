/**
 * Order List Types
 * TypeScript interfaces for Orders Listing page
 * Location: app/dashboard/orders/types/orderList.types.ts
 * Last Modified: Nov 26 2025
 */

export interface OrderProduct {
  id: string;
  product_order_number: string;
  description: string;
  product_status: string;
  routed_to: string;
  routed_at?: string;
  sample_fee?: number;
  client_product_price?: number;
  product_price?: number;
  client_shipping_air_price?: number;
  client_shipping_boat_price?: number;
  shipping_air_price?: number;
  shipping_boat_price?: number;
  selected_shipping_method?: string;
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

export type TabType = 'my_orders' | 'invoice_approval' | 'sent_to_other' | 'production_status';

export type ProductionSubTab = 'approved_for_production' | 'in_production' | 'shipped';

export interface TabCounts {
  my_orders: number;
  invoice_approval: number;
  sent_to_other: number;
  approved_for_production: number;
  in_production: number;
  shipped: number;
  production_total: number;
}

export interface RoutingStatus {
  status: string;
  label: string;
  color: string;
}
