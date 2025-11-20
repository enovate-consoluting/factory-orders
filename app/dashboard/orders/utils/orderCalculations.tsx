/**
 * Order Calculations Utility
 * Handles all order total and pricing calculations
 * Used across order detail and other components
 * Last Modified: November 2025
 */

interface OrderProduct {
  product_price?: number;
  sample_fee?: number;
  shipping_air_price?: number;
  shipping_boat_price?: number;
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
      // Manufacturer sees cost prices
      productPrice = parseFloat(String(product.product_price || 0));
      sampleFee = parseFloat(String(product.sample_fee || 0));
      
      if (product.selected_shipping_method === 'air') {
        shippingPrice = parseFloat(String(product.shipping_air_price || 0));
      } else if (product.selected_shipping_method === 'boat') {
        shippingPrice = parseFloat(String(product.shipping_boat_price || 0));
      }
    } else {
      // Admin/Client see prices with markup
      const mfgProductPrice = parseFloat(String(product.product_price || 0));
      const mfgSampleFee = parseFloat(String(product.sample_fee || 0));
      
      productPrice = mfgProductPrice * (1 + productMargin / 100);
      sampleFee = mfgSampleFee * (1 + productMargin / 100);
      
      if (product.selected_shipping_method === 'air') {
        const mfgShipping = parseFloat(String(product.shipping_air_price || 0));
        shippingPrice = mfgShipping * (1 + shippingMargin / 100);
      } else if (product.selected_shipping_method === 'boat') {
        const mfgShipping = parseFloat(String(product.shipping_boat_price || 0));
        shippingPrice = mfgShipping * (1 + shippingMargin / 100);
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