/**
 * Order Calculations Utility
 * Handles all order total and pricing calculations
 * Used across order detail and other components
 * Last Modified: December 2024
 */

interface OrderProduct {
  product_price?: number;
  client_product_price?: number;  // Added client price fields
  sample_fee?: number;
  shipping_air_price?: number;
  client_shipping_air_price?: number;  // Added
  shipping_boat_price?: number;
  client_shipping_boat_price?: number;  // Added
  selected_shipping_method?: string;
  order_items?: Array<{ quantity?: number }>;
  routed_to?: string;
  product_status?: string;
  payment_status?: string;
}

interface Order {
  order_products?: OrderProduct[];
  sample_fee?: number;
}

/**
 * Format currency with proper accounting format
 * ALWAYS shows 2 decimal places and commas for proper money display
 * @param amount - The number to format
 * @returns Formatted string with commas and 2 decimal places (e.g., "15,150.60")
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  // Handle null/undefined/empty
  if (amount === null || amount === undefined || amount === '') return '0.00';
  
  // Convert string to number if needed
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Handle NaN
  if (isNaN(num)) return '0.00';
  
  // Round to 2 decimal places to avoid floating point issues
  const rounded = Math.round(num * 100) / 100;
  
  // ALWAYS format with 2 decimal places and commas for proper accounting
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format currency with dollar sign
 * @param amount - The number to format
 * @returns Formatted string with $ and proper formatting (e.g., "$15,150.60")
 */
export function formatDollar(amount: number | string | null | undefined): string {
  return `$${formatCurrency(amount)}`;
}

export function calculateOrderTotal(
  order: Order | null,
  userRole: string,
  productMargin: number = 80,
  shippingMargin: number = 5
): number {
  if (!order?.order_products) return 0;
  
  let total = 0;
  const isManufacturer = userRole === 'manufacturer';
  
  order.order_products.forEach((product: OrderProduct) => {
    const totalQty = product.order_items?.reduce((sum: number, item) => 
      sum + (item.quantity || 0), 0) || 0;
    
    let productPrice = 0;
    let sampleFee = 0;
    let shippingPrice = 0;
    
    if (isManufacturer) {
      // Manufacturer sees cost prices (no change needed here)
      productPrice = parseFloat(String(product.product_price || 0));
      sampleFee = parseFloat(String(product.sample_fee || 0));
      
      if (product.selected_shipping_method === 'air') {
        shippingPrice = parseFloat(String(product.shipping_air_price || 0));
      } else if (product.selected_shipping_method === 'boat') {
        shippingPrice = parseFloat(String(product.shipping_boat_price || 0));
      }
    } else {
      // FIXED: Admin/Client see client prices if available, otherwise calculate with markup
      
      // Product price - use client price if available
      if (product.client_product_price !== undefined && product.client_product_price !== null) {
        productPrice = parseFloat(String(product.client_product_price));
      } else {
        // Only apply markup if no client price exists
        const mfgProductPrice = parseFloat(String(product.product_price || 0));
        productPrice = mfgProductPrice * (1 + productMargin / 100);
      }
      
      // Sample fee - for now still use margin calculation (no client_sample_fee field)
      const mfgSampleFee = parseFloat(String(product.sample_fee || 0));
      sampleFee = mfgSampleFee * (1 + productMargin / 100);
      
      // Shipping price - use client shipping prices if available
      if (product.selected_shipping_method === 'air') {
        if (product.client_shipping_air_price !== undefined && product.client_shipping_air_price !== null) {
          shippingPrice = parseFloat(String(product.client_shipping_air_price));
        } else {
          // Only apply margin if no client price exists
          const mfgShipping = parseFloat(String(product.shipping_air_price || 0));
          shippingPrice = mfgShipping * (1 + shippingMargin / 100);
        }
      } else if (product.selected_shipping_method === 'boat') {
        if (product.client_shipping_boat_price !== undefined && product.client_shipping_boat_price !== null) {
          shippingPrice = parseFloat(String(product.client_shipping_boat_price));
        } else {
          // Only apply margin if no client price exists
          const mfgShipping = parseFloat(String(product.shipping_boat_price || 0));
          shippingPrice = mfgShipping * (1 + shippingMargin / 100);
        }
      }
    }
    
    total += productPrice * totalQty;
    total += sampleFee;
    total += shippingPrice;
  });
  
  // Add order-level sample fee
  if (order.sample_fee) {
    const orderSampleAmount = parseFloat(String(order.sample_fee));
    if (isManufacturer) {
      total += orderSampleAmount;
    } else {
      total += orderSampleAmount * (1 + productMargin / 100);
    }
  }
  
  return total;
}

export function getProductCounts(order: Order | null) {
  if (!order?.order_products) {
    return { 
      total: 0, 
      withAdmin: 0, 
      withManufacturer: 0, 
      inProduction: 0, 
      completed: 0, 
      visible: 0 
    };
  }
  
  const products = order.order_products;
  
  return {
    total: products.length,
    withAdmin: products.filter((p: OrderProduct) => 
      (p.routed_to === 'admin' || !p.routed_to) && 
      p.product_status !== 'completed' && 
      p.product_status !== 'in_production'
    ).length,
    withManufacturer: products.filter((p: OrderProduct) => 
      p.routed_to === 'manufacturer' && 
      p.product_status !== 'in_production' && 
      p.product_status !== 'completed'
    ).length,
    inProduction: products.filter((p: OrderProduct) => 
      p.product_status === 'in_production'
    ).length,
    completed: products.filter((p: OrderProduct) => 
      p.product_status === 'completed'
    ).length,
    visible: products.length
  };
}

export function checkAllProductsPaid(order: Order | null): boolean {
  if (!order?.order_products || order.order_products.length === 0) return false;
  
  return order.order_products.every((p: OrderProduct) => 
    p.payment_status === 'paid'
  );
}