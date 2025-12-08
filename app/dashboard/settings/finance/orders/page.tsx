/**
 * Finance Orders Page - /dashboard/settings/finance/orders
 * View and override margin percentages for specific orders and products
 * FIXED: Now properly recalculates client prices when margins are saved
 * ADDED: Custom margin badges to identify non-default margins
 * Roles: Super Admin only
 * Last Modified: Dec 8 2025
 */

'use client';

import React, { useState, useEffect } from 'react';
import { 
  Save, Percent, AlertCircle, CheckCircle, Package, 
  ChevronDown, ChevronRight, Edit, DollarSign, TrendingUp, Truck,
  Star, Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatOrderNumber } from '@/lib/utils/orderUtils';

interface OrderWithMargins {
  id: string;
  order_number: string;
  order_name: string | null;
  status: string;
  created_at: string;
  client?: {
    id: string;
    name: string;
  };
  order_margin?: {
    margin_percentage: number;
    shipping_margin_percentage: number;
  };
  order_products?: Array<{
    id: string;
    product_order_number: string;
    description: string;
    product_price: number;
    client_product_price: number;
    product_margin_override: number | null;
    shipping_margin_override: number | null;
    margin_applied: number;
    margin_percentage: number | null;
    shipping_air_price?: number;
    shipping_boat_price?: number;
    selected_shipping_method?: string;
    client_shipping_air_price?: number;
    client_shipping_boat_price?: number;
    product?: {
      title: string;
    };
    order_items?: Array<{
      quantity: number;
    }>;
  }>;
}

export default function FinanceOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderWithMargins[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [orderMargins, setOrderMargins] = useState<Record<string, { product: string, shipping: string }>>({});
  const [productMargins, setProductMargins] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<Record<string, string>>({});
  const [defaultProductMargin, setDefaultProductMargin] = useState(80);
  const [defaultShippingMargin, setDefaultShippingMargin] = useState(5);

  useEffect(() => {
    checkUserRole();
    loadDefaultMargins();
    fetchOrders();
  }, []);

  const checkUserRole = () => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/dashboard');
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  };

  const loadDefaultMargins = async () => {
    try {
      const { data } = await supabase
        .from('system_config')
        .select('config_key, config_value')
        .in('config_key', ['default_margin_percentage', 'default_shipping_margin_percentage']);
      
      if (data) {
        data.forEach(config => {
          if (config.config_key === 'default_margin_percentage') {
            setDefaultProductMargin(parseFloat(config.config_value) || 80);
          } else if (config.config_key === 'default_shipping_margin_percentage') {
            setDefaultShippingMargin(parseFloat(config.config_value) || 5);
          }
        });
      }
    } catch (error) {
      console.error('Error loading default margins:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_name,
          status,
          created_at,
          client:clients(id, name),
          order_products(
            id,
            product_order_number,
            description,
            product_price,
            client_product_price,
            product_margin_override,
            shipping_margin_override,
            margin_applied,
            margin_percentage,
            shipping_air_price,
            shipping_boat_price,
            selected_shipping_method,
            client_shipping_air_price,
            client_shipping_boat_price,
            product:products(title),
            order_items(quantity)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch order margins
      const { data: marginData } = await supabase
        .from('order_margins')
        .select('order_id, margin_percentage, shipping_margin_percentage');

      // Combine data
      const ordersWithMargins = (data || []).map(order => {
        const orderMargin = marginData?.find(m => m.order_id === order.id);
        return {
          id: order.id,
          order_number: order.order_number,
          order_name: order.order_name,
          status: order.status,
          created_at: order.created_at,
          client: Array.isArray(order.client) ? order.client[0] : order.client,
          order_products: (order.order_products || []).map((p: any) => ({
            ...p,
            product: Array.isArray(p.product) ? p.product[0] : p.product,
            order_items: p.order_items || []
          })),
          order_margin: orderMargin
        };
      });

      setOrders(ordersWithMargins);

      // Initialize margin values for editing
      const margins: Record<string, { product: string, shipping: string }> = {};
      const prodMargins: Record<string, string> = {};
      
      ordersWithMargins.forEach(order => {
        margins[order.id] = {
          product: order.order_margin?.margin_percentage?.toString() || defaultProductMargin.toString(),
          shipping: order.order_margin?.shipping_margin_percentage?.toString() || defaultShippingMargin.toString()
        };
        
        order.order_products?.forEach(product => {
          prodMargins[product.id] = product.product_margin_override?.toString() || 
                                     order.order_margin?.margin_percentage?.toString() || 
                                     defaultProductMargin.toString();
        });
      });
      
      setOrderMargins(margins);
      setProductMargins(prodMargins);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  // Check if order has custom margins (different from defaults)
  const hasCustomOrderMargin = (order: OrderWithMargins): boolean => {
    if (!order.order_margin) return false;
    const productMargin = order.order_margin.margin_percentage;
    const shippingMargin = order.order_margin.shipping_margin_percentage;
    return productMargin !== defaultProductMargin || shippingMargin !== defaultShippingMargin;
  };

  // Check if any product has custom margin override
  const hasCustomProductMargin = (order: OrderWithMargins): boolean => {
    return order.order_products?.some(p => p.product_margin_override !== null) || false;
  };

  // Calculate order totals including quantities
  const calculateOrderTotals = (order: OrderWithMargins) => {
    let mfrTotal = 0;
    let clientTotal = 0;
    let shippingTotal = 0;

    order.order_products?.forEach(product => {
      const totalQuantity = product.order_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
      
      mfrTotal += (product.product_price || 0) * totalQuantity;
      clientTotal += (product.client_product_price || 0) * totalQuantity;
      
      if (product.selected_shipping_method === 'air') {
        shippingTotal += product.client_shipping_air_price || 0;
      } else if (product.selected_shipping_method === 'boat') {
        shippingTotal += product.client_shipping_boat_price || 0;
      }
    });

    const grandTotal = clientTotal + shippingTotal;
    const margin = mfrTotal > 0 ? ((clientTotal - mfrTotal) / mfrTotal * 100).toFixed(1) : '0';

    return { mfrTotal, clientTotal, shippingTotal, grandTotal, margin };
  };

  /**
   * Save order-level margin AND recalculate all client prices
   */
  const handleSaveOrderMargin = async (orderId: string) => {
    setSaving(orderId);
    setMessage({});
    
    try {
      const margins = orderMargins[orderId];
      const productMargin = parseFloat(margins.product);
      const shippingMargin = parseFloat(margins.shipping);
      
      if (isNaN(productMargin) || productMargin < 0 || productMargin > 500) {
        setMessage({ [orderId]: 'Invalid product margin' });
        setSaving(null);
        return;
      }
      
      if (isNaN(shippingMargin) || shippingMargin < 0 || shippingMargin > 500) {
        setMessage({ [orderId]: 'Invalid shipping margin' });
        setSaving(null);
        return;
      }

      // 1. Save/update order margin record
      const { error: marginError } = await supabase
        .from('order_margins')
        .upsert({
          order_id: orderId,
          margin_percentage: productMargin,
          shipping_margin_percentage: shippingMargin,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'order_id'
        });

      if (marginError) throw marginError;

      // 2. Get all products for this order to recalculate prices
      const { data: products, error: fetchError } = await supabase
        .from('order_products')
        .select('id, product_price, shipping_air_price, shipping_boat_price, product_margin_override')
        .eq('order_id', orderId);

      if (fetchError) throw fetchError;

      // 3. Recalculate and update each product's client prices
      for (const product of products || []) {
        // Use product override if exists, otherwise use order margin
        const effectiveProductMargin = product.product_margin_override ?? productMargin;
        
        const updates: any = {
          margin_percentage: effectiveProductMargin,
          // Clear overrides when setting order-level margin (unless product has its own override)
          product_margin_override: product.product_margin_override, // Keep if already set
          shipping_margin_override: null // Clear shipping override
        };

        // Recalculate client_product_price if product_price exists
        if (product.product_price && product.product_price > 0) {
          updates.client_product_price = Math.round(product.product_price * (1 + effectiveProductMargin / 100) * 100) / 100;
        }

        // Recalculate client_shipping_air_price if shipping_air_price exists
        if (product.shipping_air_price && product.shipping_air_price > 0) {
          updates.client_shipping_air_price = Math.round(product.shipping_air_price * (1 + shippingMargin / 100) * 100) / 100;
        }

        // Recalculate client_shipping_boat_price if shipping_boat_price exists
        if (product.shipping_boat_price && product.shipping_boat_price > 0) {
          updates.client_shipping_boat_price = Math.round(product.shipping_boat_price * (1 + shippingMargin / 100) * 100) / 100;
        }

        const { error: updateError } = await supabase
          .from('order_products')
          .update(updates)
          .eq('id', product.id);

        if (updateError) {
          console.error('Error updating product:', product.id, updateError);
        }
      }

      console.log(`✅ Order ${orderId}: Updated margins and recalculated ${products?.length || 0} products`);
      
      setMessage({ [orderId]: 'Saved & Recalculated!' });
      setEditingOrder(null);
      await fetchOrders();
      
      setTimeout(() => {
        setMessage({});
      }, 3000);
    } catch (error) {
      console.error('Error saving margin:', error);
      setMessage({ [orderId]: 'Error saving' });
    } finally {
      setSaving(null);
    }
  };

  /**
   * Save product-level margin override AND recalculate client price
   */
  const handleSaveProductMargin = async (productId: string, orderId: string) => {
    setSaving(productId);
    setMessage({});
    
    try {
      const margin = parseFloat(productMargins[productId]);
      
      if (isNaN(margin) || margin < 0 || margin > 500) {
        setMessage({ [productId]: 'Invalid margin' });
        setSaving(null);
        return;
      }

      // 1. Get current product data
      const { data: product, error: fetchError } = await supabase
        .from('order_products')
        .select('product_price, shipping_air_price, shipping_boat_price')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;

      // 2. Get order's shipping margin for shipping calculation
      const order = orders.find(o => o.id === orderId);
      const shippingMargin = order?.order_margin?.shipping_margin_percentage ?? defaultShippingMargin;

      // 3. Calculate new client prices
      const updates: any = {
        product_margin_override: margin,
        margin_percentage: margin
      };

      // Recalculate client_product_price
      if (product.product_price && product.product_price > 0) {
        updates.client_product_price = Math.round(product.product_price * (1 + margin / 100) * 100) / 100;
      }

      // Also update shipping with order's shipping margin (in case it wasn't set)
      if (product.shipping_air_price && product.shipping_air_price > 0) {
        updates.client_shipping_air_price = Math.round(product.shipping_air_price * (1 + shippingMargin / 100) * 100) / 100;
      }
      if (product.shipping_boat_price && product.shipping_boat_price > 0) {
        updates.client_shipping_boat_price = Math.round(product.shipping_boat_price * (1 + shippingMargin / 100) * 100) / 100;
      }

      // 4. Save to database
      const { error } = await supabase
        .from('order_products')
        .update(updates)
        .eq('id', productId);

      if (error) throw error;

      console.log(`✅ Product ${productId}: Set margin to ${margin}%, client price to $${updates.client_product_price}`);

      setMessage({ [productId]: 'Saved!' });
      setEditingProduct(null);
      await fetchOrders();
      
      setTimeout(() => {
        setMessage({});
      }, 2000);
    } catch (error) {
      console.error('Error saving product margin:', error);
      setMessage({ [productId]: 'Error' });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Order Margins Management</h1>
          <Link
            href="/dashboard/settings/finance"
            className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm"
          >
            ← Back to Settings
          </Link>
        </div>
        <p className="text-sm sm:text-base text-gray-600">
          View and override margin percentages for specific orders and products
        </p>
        
        {/* Default margins info */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs sm:text-sm">
          <span className="px-2 py-1 bg-gray-100 rounded-lg text-gray-700">
            Default Product Margin: <strong>{defaultProductMargin}%</strong>
          </span>
          <span className="px-2 py-1 bg-gray-100 rounded-lg text-gray-700">
            Default Shipping Margin: <strong>{defaultShippingMargin}%</strong>
          </span>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-3 sm:p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">All Orders</h2>
            <div className="text-xs sm:text-sm text-gray-500">
              {orders.length} total orders
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {orders.map(order => {
            const isExpanded = expandedOrders.has(order.id);
            const isEditingOrder = editingOrder === order.id;
            const totalProducts = order.order_products?.length || 0;
            const totals = calculateOrderTotals(order);
            const hasCustomOrder = hasCustomOrderMargin(order);
            const hasCustomProduct = hasCustomProductMargin(order);
            
            return (
              <div key={order.id} className="hover:bg-gray-50">
                {/* Order Row */}
                <div className="p-3 sm:p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    {/* Left side - Order Info */}
                    <div className="flex items-start gap-2 sm:gap-3 flex-1">
                      <button
                        onClick={() => toggleOrderExpansion(order.id)}
                        className="p-1 hover:bg-gray-200 rounded flex-shrink-0 mt-0.5"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col gap-1">
                          <div>
                            <div className="font-medium text-gray-900 text-sm sm:text-base flex items-center gap-2 flex-wrap">
                              {formatOrderNumber(order.order_number)}
                              {order.order_name && (
                                <span className="text-xs sm:text-sm text-gray-500">
                                  {order.order_name}
                                </span>
                              )}
                              {/* Custom margin badges */}
                              {hasCustomOrder && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] sm:text-xs font-medium rounded">
                                  <Sparkles className="w-3 h-3" />
                                  Custom Order
                                </span>
                              )}
                              {hasCustomProduct && !hasCustomOrder && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] sm:text-xs font-medium rounded">
                                  <Star className="w-3 h-3" />
                                  Custom Products
                                </span>
                              )}
                            </div>
                            <div className="text-xs sm:text-sm text-gray-500">
                              {order.client?.name} • {totalProducts} products
                            </div>
                            {/* Detailed totals display */}
                            <div className="text-xs text-gray-600 mt-1 flex flex-wrap items-center gap-1 sm:gap-3">
                              <span className="flex items-center gap-1">
                                <span className="text-gray-500">Mfr Cost:</span>
                                <span className="font-medium">${totals.mfrTotal.toFixed(2)}</span>
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className="flex items-center gap-1">
                                <span className="text-gray-500">Client:</span>
                                <span className="font-medium">${totals.clientTotal.toFixed(2)}</span>
                              </span>
                              {totals.shippingTotal > 0 && (
                                <>
                                  <span className="text-gray-400 hidden sm:inline">+</span>
                                  <span className="flex items-center gap-1">
                                    <Truck className="w-3 h-3 text-gray-400" />
                                    <span className="text-gray-500">Ship:</span>
                                    <span className="font-medium">${totals.shippingTotal.toFixed(2)}</span>
                                  </span>
                                </>
                              )}
                              <span className="text-gray-400 hidden sm:inline">=</span>
                              <span className="flex items-center gap-1">
                                <span className="text-gray-500">Total:</span>
                                <span className="font-semibold text-green-600">
                                  ${totals.grandTotal.toFixed(2)}
                                </span>
                                <span className="text-xs text-gray-500">
                                  ({totals.margin}% margin)
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right side - Margin Controls */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 lg:ml-auto">
                      {!isEditingOrder ? (
                        <>
                          <div className="flex items-center gap-2 sm:gap-4">
                            <div className="text-xs sm:text-sm">
                              <span className="text-gray-500">Product Margin:</span>
                              <span className={`ml-1 sm:ml-2 font-semibold ${
                                hasCustomOrder && order.order_margin?.margin_percentage !== defaultProductMargin
                                  ? 'text-purple-600'
                                  : 'text-gray-900'
                              }`}>
                                {orderMargins[order.id]?.product || defaultProductMargin}%
                              </span>
                            </div>
                            <div className="text-xs sm:text-sm">
                              <span className="text-gray-500">Shipping:</span>
                              <span className={`ml-1 sm:ml-2 font-semibold ${
                                hasCustomOrder && order.order_margin?.shipping_margin_percentage !== defaultShippingMargin
                                  ? 'text-purple-600'
                                  : 'text-gray-900'
                              }`}>
                                {orderMargins[order.id]?.shipping || defaultShippingMargin}%
                              </span>
                            </div>
                            <button
                              onClick={() => setEditingOrder(order.id)}
                              className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg p-2 sm:p-2.5"
                            >
                              <Edit className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto w-full sm:w-auto">
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <label className="text-xs sm:text-sm text-gray-500 font-medium whitespace-nowrap">Product:</label>
                            <div className="relative">
                              <input
                                type="number"
                                value={orderMargins[order.id].product}
                                onChange={(e) => setOrderMargins(prev => ({
                                  ...prev,
                                  [order.id]: { ...prev[order.id], product: e.target.value }
                                }))}
                                className="w-14 sm:w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                                min="0"
                                max="500"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <label className="text-xs sm:text-sm text-gray-500 font-medium whitespace-nowrap">Ship:</label>
                            <div className="relative">
                              <input
                                type="number"
                                value={orderMargins[order.id].shipping}
                                onChange={(e) => setOrderMargins(prev => ({
                                  ...prev,
                                  [order.id]: { ...prev[order.id], shipping: e.target.value }
                                }))}
                                className="w-14 sm:w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                                min="0"
                                max="500"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleSaveOrderMargin(order.id)}
                            disabled={saving === order.id}
                            className="bg-blue-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium whitespace-nowrap flex-shrink-0"
                          >
                            {saving === order.id ? '...' : 'Save All'}
                          </button>

                          <button
                            onClick={() => setEditingOrder(null)}
                            className="text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-3 sm:px-4 py-1.5 sm:py-2 text-sm rounded-lg font-medium whitespace-nowrap flex-shrink-0"
                          >
                            Cancel
                          </button>

                          {message[order.id] && (
                            <span className={`text-xs sm:text-sm font-medium whitespace-nowrap flex-shrink-0 ${
                              message[order.id].includes('Saved') ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {message[order.id]}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Products */}
                {isExpanded && order.order_products && (
                  <div className="bg-gray-50 pb-3 sm:pb-4">
                    <div className="space-y-2 sm:px-4">
                      {order.order_products.map(product => {
                        const isEditingProduct = editingProduct === product.id;
                        const effectiveMargin = product.product_margin_override || 
                                               orderMargins[order.id]?.product || defaultProductMargin.toString();
                        const totalQuantity = product.order_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
                        const hasOverride = product.product_margin_override !== null;
                        
                        return (
                          <div key={product.id} className={`bg-white p-2 sm:p-3 rounded border ${
                            hasOverride ? 'border-orange-300 bg-orange-50/30' : 'border-gray-200'
                          }`}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                                <Package className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs sm:text-sm font-medium text-gray-700 truncate flex items-center gap-2">
                                    {product.product_order_number}
                                    {hasOverride && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-medium rounded">
                                        <Star className="w-2.5 h-2.5" />
                                        Custom
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">
                                    {product.description || product.product?.title}
                                  </div>
                                </div>

                                {product.product_price && (
                                  <div className="text-xs text-gray-500">
                                    <div className="whitespace-nowrap">
                                      Unit: ${product.product_price.toFixed(2)} → ${(product.client_product_price || 0).toFixed(2)}
                                    </div>
                                    {totalQuantity > 0 && (
                                      <div className="text-gray-600 whitespace-nowrap">
                                        Qty: {totalQuantity} |
                                        Total: ${(product.product_price * totalQuantity).toFixed(2)} →
                                        ${((product.client_product_price || 0) * totalQuantity).toFixed(2)}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 justify-end sm:justify-start">
                                {!isEditingProduct ? (
                                  <>
                                    <div className="text-xs sm:text-sm">
                                      <span className="text-gray-500">Margin:</span>
                                      <span className={`ml-1 sm:ml-2 font-semibold ${
                                        hasOverride ? 'text-orange-600' : 'text-gray-900'
                                      }`}>
                                        {effectiveMargin}%
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setEditingProduct(product.id);
                                        setProductMargins(prev => ({
                                          ...prev,
                                          [product.id]: effectiveMargin.toString()
                                        }));
                                      }}
                                      className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg p-2 sm:p-2.5"
                                    >
                                      <Edit className="w-5 h-5 sm:w-6 sm:h-6" />
                                    </button>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-2 sm:gap-2.5">
                                    <div className="relative">
                                      <input
                                        type="number"
                                        value={productMargins[product.id]}
                                        onChange={(e) => setProductMargins(prev => ({
                                          ...prev,
                                          [product.id]: e.target.value
                                        }))}
                                        className="w-16 sm:w-18 px-2 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-green-500"
                                        min="0"
                                        max="500"
                                      />
                                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                                    </div>

                                    <button
                                      onClick={() => handleSaveProductMargin(product.id, order.id)}
                                      disabled={saving === product.id}
                                      className="bg-green-600 text-white px-3 sm:px-4 py-1.5 text-sm rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium"
                                    >
                                      {saving === product.id ? '...' : 'Save'}
                                    </button>

                                    <button
                                      onClick={() => setEditingProduct(null)}
                                      className="text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-3 sm:px-4 py-1.5 text-sm rounded-lg font-medium"
                                    >
                                      Cancel
                                    </button>

                                    {message[product.id] && (
                                      <span className={`text-xs sm:text-sm font-medium ${
                                        message[product.id] === 'Saved!' ? 'text-green-600' : 'text-red-600'
                                      }`}>
                                        {message[product.id]}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {orders.length === 0 && (
          <div className="p-8 sm:p-12 text-center text-gray-500 text-sm sm:text-base">
            No orders found
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-4 sm:mt-6 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs sm:text-sm text-blue-900">
            <p className="font-semibold mb-1">Quick Guide:</p>
            <ul className="list-disc ml-4 sm:ml-5 space-y-1">
              <li><strong>Order-level margins:</strong> Click Edit on any order to set margins for ALL products in that order</li>
              <li><strong>Product-level margins:</strong> Expand an order and edit individual products for custom margins</li>
              <li>
                <span className="inline-flex items-center gap-1 px-1 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-medium rounded">
                  <Sparkles className="w-2.5 h-2.5" />Custom Order
                </span> = Order has margins different from defaults ({defaultProductMargin}% product, {defaultShippingMargin}% shipping)
              </li>
              <li>
                <span className="inline-flex items-center gap-1 px-1 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-medium rounded">
                  <Star className="w-2.5 h-2.5" />Custom
                </span> = Product has its own margin override
              </li>
              <li><strong>Changes are instant:</strong> Saving margins now automatically recalculates all client prices!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}