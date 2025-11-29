/**
 * Order List Calculations
 * Helper functions for order list calculations and formatting
 * Location: app/dashboard/orders/utils/orderListCalculations.ts
 * Last Modified: Nov 26 2025
 */

import { formatCurrency as formatCurrencyUtil } from './orderCalculations';
import { Order, OrderProduct } from '../types/orderList.types';
import { Language } from './orderListTranslations';

/**
 * Format currency with language support
 * Converts to CNY for Chinese language
 */
export const formatCurrencyWithLanguage = (amount: number, language: Language = 'en'): string => {
  if (language === 'zh') {
    // Convert USD to CNY (approximate rate 1 USD = 7.2 CNY)
    const cnyAmount = amount * 7.2;
    return `¥${formatCurrencyUtil(cnyAmount)}`;
  }
  return `$${formatCurrencyUtil(amount)}`;
};

/**
 * Calculate days since a product was routed (invoice ready)
 */
export const daysSinceInvoiceReady = (routedAt: string | undefined): number => {
  if (!routedAt) return 0;
  const ready = new Date(routedAt);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - ready.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Calculate fees for a single product (always uses client prices)
 */
export const calculateProductFees = (product: OrderProduct): number => {
  let fees = 0;
  
  // Add sample fee
  fees += parseFloat(product.sample_fee?.toString() || '0');
  
  // Add product price (client price preferred)
  const clientPrice = parseFloat(
    product.client_product_price?.toString() || 
    product.product_price?.toString() || 
    '0'
  );
  const totalQty = product.order_items?.reduce((sum, item) => 
    sum + (item.quantity || 0), 0) || 0;
  fees += clientPrice * totalQty;
  
  // Add shipping
  if (product.selected_shipping_method === 'air') {
    fees += parseFloat(
      product.client_shipping_air_price?.toString() || 
      product.shipping_air_price?.toString() || 
      '0'
    );
  } else if (product.selected_shipping_method === 'boat') {
    fees += parseFloat(
      product.client_shipping_boat_price?.toString() || 
      product.shipping_boat_price?.toString() || 
      '0'
    );
  }
  
  return fees;
};

/**
 * Calculate total fees for an order (invoice approval - products routed to admin)
 */
export const calculateOrderFees = (order: Order): number => {
  if (!order.order_products || order.order_products.length === 0) return 0;
  
  let totalFees = 0;
  order.order_products.forEach(product => {
    // Only count products routed to admin with fees
    if (product.routed_to === 'admin') {
      totalFees += calculateProductFees(product);
    }
  });
  
  return totalFees;
};

/**
 * Check if product has shipping selected with a price
 */
export const hasShippingSelected = (product: OrderProduct): boolean => {
  return !!(
    product.selected_shipping_method && 
    (
      (product.selected_shipping_method === 'air' && (product.client_shipping_air_price || 0) > 0) ||
      (product.selected_shipping_method === 'boat' && (product.client_shipping_boat_price || 0) > 0)
    )
  );
};

/**
 * Calculate product total based on user role
 * Admin/Super Admin see CLIENT prices
 * Manufacturer sees COST prices
 */
export const calculateProductTotal = (product: OrderProduct, userRole: string | null): number => {
  const totalQty = product.order_items?.reduce((sum, item) => 
    sum + (item.quantity || 0), 0) || 0;
  
  let productPrice = 0;
  let shippingPrice = 0;
  
  // Admin and Super Admin ALWAYS see CLIENT prices
  if (userRole === 'admin' || userRole === 'super_admin') {
    productPrice = parseFloat(product.client_product_price?.toString() || '0');
    
    if (product.selected_shipping_method === 'air') {
      shippingPrice = parseFloat(product.client_shipping_air_price?.toString() || '0');
    } else if (product.selected_shipping_method === 'boat') {
      shippingPrice = parseFloat(product.client_shipping_boat_price?.toString() || '0');
    }
  } else if (userRole === 'manufacturer') {
    // Manufacturer sees their cost prices only
    productPrice = parseFloat(product.product_price?.toString() || '0');
    
    if (product.selected_shipping_method === 'air') {
      shippingPrice = parseFloat(product.shipping_air_price?.toString() || '0');
    } else if (product.selected_shipping_method === 'boat') {
      shippingPrice = parseFloat(product.shipping_boat_price?.toString() || '0');
    }
  }
  
  // Add sample fee
  const sampleFee = parseFloat(product.sample_fee?.toString() || '0');
  
  return (productPrice * totalQty) + shippingPrice + sampleFee;
};

/**
 * Calculate total for an entire order
 */
export const calculateOrderTotal = (order: Order, userRole: string | null): number => {
  if (!order.order_products || order.order_products.length === 0) return 0;
  
  let total = 0;
  order.order_products.forEach(product => {
    total += calculateProductTotal(product, userRole);
  });
  
  return total;
};

/**
 * Get earliest invoice ready date for an order
 * Returns the earliest routed_at date for invoiceable products
 */
export const getEarliestInvoiceReadyDate = (order: Order): Date | null => {
  if (!order.order_products) return null;
  
  const invoiceableProducts = order.order_products.filter(p => 
    p.routed_to === 'admin' && 
    (parseFloat(p.sample_fee?.toString() || '0') > 0 || 
     parseFloat(p.client_product_price?.toString() || p.product_price?.toString() || '0') > 0) &&
    p.product_status !== 'approved_for_production' &&
    p.product_status !== 'in_production' &&
    p.product_status !== 'shipped'
  );
  
  if (invoiceableProducts.length === 0) return null;
  
  const dates = invoiceableProducts
    .map(p => p.routed_at ? new Date(p.routed_at) : null)
    .filter((d): d is Date => d !== null);
  
  if (dates.length === 0) return null;
  
  return new Date(Math.min(...dates.map(d => d.getTime())));
};

/**
 * Get product quantity total
 */
export const getProductQuantity = (product: OrderProduct): number => {
  return product.order_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
};

/**
 * Check if product has fees (sample fee or product price)
 */
export const productHasFees = (product: OrderProduct): boolean => {
  return (
    parseFloat(product.sample_fee?.toString() || '0') > 0 || 
    parseFloat(product.client_product_price?.toString() || product.product_price?.toString() || '0') > 0
  );
};
