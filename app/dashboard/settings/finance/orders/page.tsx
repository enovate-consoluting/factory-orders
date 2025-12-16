/**
 * Finance Orders Page - /dashboard/settings/finance/orders
 * View and override margin percentages for specific orders and products
 * UPDATED: Added clothing fee support and recalculate modal
 * Roles: Super Admin only
 * Last Modified: December 2025
 */

'use client';

import React, { useState, useEffect } from 'react';
import { 
  Save, Percent, AlertCircle, CheckCircle, Package, 
  ChevronDown, ChevronRight, Edit, DollarSign, TrendingUp, Truck,
  Star, Sparkles, RefreshCw, X, Shirt, Tag, FileBox
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
    sample_fee?: number;
    client_sample_fee?: number;
    clothing_fee_override?: number | null;
    product?: {
      id: string;
      title: string;
      is_clothing: boolean;
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
  const [productClothingFees, setProductClothingFees] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<Record<string, string>>({});
  
  // Default settings from system_config
  const [defaultProductMargin, setDefaultProductMargin] = useState(80);
  const [defaultShippingMargin, setDefaultShippingMargin] = useState(5);
  const [defaultSampleMargin, setDefaultSampleMargin] = useState(80);
  const [defaultClothingFee, setDefaultClothingFee] = useState(0);
  const [defaultAccessoryMargin, setDefaultAccessoryMargin] = useState(100);

  // Recalculate modal state
  const [showRecalcModal, setShowRecalcModal] = useState(false);
  const [recalcOrderId, setRecalcOrderId] = useState<string | null>(null);
  const [recalcOptions, setRecalcOptions] = useState({
    regularProducts: false,
    clothingProducts: false,
    samples: false,
    shipping: false,
    accessories: false
  });
  const [recalculating, setRecalculating] = useState(false);
  
  // Custom values for recalculation (can override defaults)
  const [recalcValues, setRecalcValues] = useState({
    productMargin: '',
    clothingFee: '',
    sampleMargin: '',
    shippingMargin: '',
    accessoryMargin: ''
  });

  useEffect(() => {
    checkUserRole();
    loadDefaultSettings();
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

  const loadDefaultSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_config')
        .select('config_key, config_value')
        .in('config_key', [
          'default_margin_percentage', 
          'default_shipping_margin_percentage',
          'default_sample_margin_percentage',
          'clothing_product_fee',
          'accessory_margin_percentage'
        ]);
      
      if (data) {
        data.forEach(config => {
          if (config.config_key === 'default_margin_percentage') {
            setDefaultProductMargin(parseFloat(config.config_value) || 80);
          } else if (config.config_key === 'default_shipping_margin_percentage') {
            setDefaultShippingMargin(parseFloat(config.config_value) || 5);
          } else if (config.config_key === 'default_sample_margin_percentage') {
            setDefaultSampleMargin(parseFloat(config.config_value) || 80);
          } else if (config.config_key === 'clothing_product_fee') {
            setDefaultClothingFee(parseFloat(config.config_value) || 0);
          } else if (config.config_key === 'accessory_margin_percentage') {
            setDefaultAccessoryMargin(parseFloat(config.config_value) || 100);
          }
        });
      }
    } catch (error) {
      console.error('Error loading default settings:', error);
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
            sample_fee,
            client_sample_fee,
            clothing_fee_override,
            product:products(id, title, is_clothing),
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

      // Initialize margin and fee values for editing
      const margins: Record<string, { product: string, shipping: string }> = {};
      const prodMargins: Record<string, string> = {};
      const prodFees: Record<string, string> = {};
      
      ordersWithMargins.forEach(order => {
        margins[order.id] = {
          product: order.order_margin?.margin_percentage?.toString() || defaultProductMargin.toString(),
          shipping: order.order_margin?.shipping_margin_percentage?.toString() || defaultShippingMargin.toString()
        };
        
        order.order_products?.forEach(product => {
          prodMargins[product.id] = product.product_margin_override?.toString() || 
                                     order.order_margin?.margin_percentage?.toString() || 
                                     defaultProductMargin.toString();
          prodFees[product.id] = product.clothing_fee_override?.toString() || defaultClothingFee.toString();
        });
      });
      
      setOrderMargins(margins);
      setProductMargins(prodMargins);
      setProductClothingFees(prodFees);
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

  // Check if order has custom margins
  const hasCustomOrderMargin = (order: OrderWithMargins): boolean => {
    if (!order.order_margin) return false;
    const productMargin = order.order_margin.margin_percentage;
    const shippingMargin = order.order_margin.shipping_margin_percentage;
    return productMargin !== defaultProductMargin || shippingMargin !== defaultShippingMargin;
  };

  // Check if order has clothing products
  const hasClothingProducts = (order: OrderWithMargins): boolean => {
    return order.order_products?.some(p => p.product?.is_clothing) || false;
  };

  // Check if any product has custom margin/fee override
  const hasCustomProductOverride = (order: OrderWithMargins): boolean => {
    return order.order_products?.some(p => 
      p.product_margin_override !== null || p.clothing_fee_override !== null
    ) || false;
  };

  // Calculate order totals
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

  // Open recalculate modal
  const openRecalcModal = (orderId: string) => {
    setRecalcOrderId(orderId);
    setRecalcOptions({
      regularProducts: false,
      clothingProducts: false,
      samples: false,
      shipping: false,
      accessories: false
    });
    // Initialize with system defaults
    setRecalcValues({
      productMargin: defaultProductMargin.toString(),
      clothingFee: defaultClothingFee.toString(),
      sampleMargin: defaultSampleMargin.toString(),
      shippingMargin: defaultShippingMargin.toString(),
      accessoryMargin: defaultAccessoryMargin.toString()
    });
    setShowRecalcModal(true);
  };

  // Handle recalculation
  const handleRecalculate = async () => {
    if (!recalcOrderId) return;
    
    setRecalculating(true);
    try {
      const order = orders.find(o => o.id === recalcOrderId);
      if (!order) throw new Error('Order not found');

      // Parse custom values (use system defaults if empty/invalid)
      const useProductMargin = parseFloat(recalcValues.productMargin) || defaultProductMargin;
      const useClothingFee = parseFloat(recalcValues.clothingFee) || defaultClothingFee;
      const useSampleMargin = parseFloat(recalcValues.sampleMargin) || defaultSampleMargin;
      const useShippingMargin = parseFloat(recalcValues.shippingMargin) || defaultShippingMargin;
      const useAccessoryMargin = parseFloat(recalcValues.accessoryMargin) || defaultAccessoryMargin;

      // Check if using custom values (different from defaults)
      const isCustomClothingFee = useClothingFee !== defaultClothingFee;

      let updatedCount = 0;

      for (const product of order.order_products || []) {
        const isClothing = product.product?.is_clothing || false;
        const updates: any = {};
        let shouldUpdate = false;

        // Regular Products (non-clothing)
        if (recalcOptions.regularProducts && !isClothing && product.product_price) {
          updates.client_product_price = Math.round(product.product_price * (1 + useProductMargin / 100) * 100) / 100;
          updates.margin_percentage = useProductMargin;
          // Set override if different from system default
          updates.product_margin_override = useProductMargin !== defaultProductMargin ? useProductMargin : null;
          shouldUpdate = true;
        }

        // Clothing Products
        if (recalcOptions.clothingProducts && isClothing && product.product_price) {
          updates.client_product_price = Math.round((product.product_price + useClothingFee) * 100) / 100;
          // Set override if different from system default
          updates.clothing_fee_override = isCustomClothingFee ? useClothingFee : null;
          shouldUpdate = true;
        }

        // Samples
        if (recalcOptions.samples && product.sample_fee) {
          updates.client_sample_fee = Math.round(product.sample_fee * (1 + useSampleMargin / 100) * 100) / 100;
          shouldUpdate = true;
        }

        // Shipping
        if (recalcOptions.shipping) {
          if (product.shipping_air_price) {
            updates.client_shipping_air_price = Math.round(product.shipping_air_price * (1 + useShippingMargin / 100) * 100) / 100;
          }
          if (product.shipping_boat_price) {
            updates.client_shipping_boat_price = Math.round(product.shipping_boat_price * (1 + useShippingMargin / 100) * 100) / 100;
          }
          updates.shipping_margin_override = useShippingMargin !== defaultShippingMargin ? useShippingMargin : null;
          if (product.shipping_air_price || product.shipping_boat_price) {
            shouldUpdate = true;
          }
        }

        if (shouldUpdate) {
          const { error } = await supabase
            .from('order_products')
            .update(updates)
            .eq('id', product.id);

          if (!error) updatedCount++;
        }
      }

      // Recalculate Accessories if selected
      if (recalcOptions.accessories) {
        // Get client_id and manufacturer_id from the order
        const orderData = await supabase
          .from('orders')
          .select('client_id, manufacturer_id')
          .eq('id', recalcOrderId)
          .single();

        if (orderData.data?.client_id) {
          // Get all accessories for this client (and manufacturer if set)
          let accessoryQuery = supabase
            .from('manufacturer_accessories_inventory')
            .select('id, unit_cost')
            .eq('client_id', orderData.data.client_id)
            .not('unit_cost', 'is', null);

          if (orderData.data.manufacturer_id) {
            accessoryQuery = accessoryQuery.eq('manufacturer_id', orderData.data.manufacturer_id);
          }

          const { data: accessories } = await accessoryQuery;

          for (const acc of accessories || []) {
            if (acc.unit_cost) {
              const clientUnitCost = Math.round(acc.unit_cost * (1 + useAccessoryMargin / 100) * 100) / 100;
              const { error } = await supabase
                .from('manufacturer_accessories_inventory')
                .update({ client_unit_cost: clientUnitCost })
                .eq('id', acc.id);
              
              if (!error) {
                updatedCount++;
                console.log(`✅ Accessory ${acc.id}: $${acc.unit_cost} × ${useAccessoryMargin}% = $${clientUnitCost}`);
              }
            }
          }
        }
      }

      console.log(`✅ Recalculated ${updatedCount} items for order ${recalcOrderId}`);
      
      setShowRecalcModal(false);
      setRecalcOrderId(null);
      await fetchOrders();
      
      setMessage({ [recalcOrderId]: `Recalculated ${updatedCount} items!` });
      setTimeout(() => setMessage({}), 3000);
    } catch (error) {
      console.error('Error recalculating:', error);
      setMessage({ [recalcOrderId!]: 'Error recalculating' });
    } finally {
      setRecalculating(false);
    }
  };

  // Save order-level margin
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

      // Save order margin record
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

      // Get all products for this order
      const { data: products, error: fetchError } = await supabase
        .from('order_products')
        .select('id, product_price, shipping_air_price, shipping_boat_price, product_margin_override, clothing_fee_override, product:products(is_clothing)')
        .eq('order_id', orderId);

      if (fetchError) throw fetchError;

      // Recalculate each product
      for (const product of products || []) {
        const isClothing = (product as any).product?.is_clothing || false;
        const updates: any = {};

        if (product.product_price && product.product_price > 0) {
          if (isClothing) {
            // Clothing: use fee (override or default)
            const fee = product.clothing_fee_override ?? defaultClothingFee;
            updates.client_product_price = Math.round((product.product_price + fee) * 100) / 100;
          } else {
            // Regular: use margin (override or order margin)
            const effectiveMargin = product.product_margin_override ?? productMargin;
            updates.client_product_price = Math.round(product.product_price * (1 + effectiveMargin / 100) * 100) / 100;
            updates.margin_percentage = effectiveMargin;
          }
        }

        if (product.shipping_air_price && product.shipping_air_price > 0) {
          updates.client_shipping_air_price = Math.round(product.shipping_air_price * (1 + shippingMargin / 100) * 100) / 100;
        }
        if (product.shipping_boat_price && product.shipping_boat_price > 0) {
          updates.client_shipping_boat_price = Math.round(product.shipping_boat_price * (1 + shippingMargin / 100) * 100) / 100;
        }

        if (Object.keys(updates).length > 0) {
          await supabase.from('order_products').update(updates).eq('id', product.id);
        }
      }

      setMessage({ [orderId]: 'Saved & Recalculated!' });
      setEditingOrder(null);
      await fetchOrders();
      
      setTimeout(() => setMessage({}), 3000);
    } catch (error) {
      console.error('Error saving margin:', error);
      setMessage({ [orderId]: 'Error saving' });
    } finally {
      setSaving(null);
    }
  };

  // Save product-level margin or fee
  const handleSaveProductOverride = async (productId: string, orderId: string, isClothing: boolean) => {
    setSaving(productId);
    setMessage({});
    
    try {
      // Get current product data
      const { data: product, error: fetchError } = await supabase
        .from('order_products')
        .select('product_price, shipping_air_price, shipping_boat_price')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;

      const updates: any = {};

      if (isClothing) {
        // Save clothing fee override
        const fee = parseFloat(productClothingFees[productId]);
        if (isNaN(fee) || fee < 0) {
          setMessage({ [productId]: 'Invalid fee' });
          setSaving(null);
          return;
        }
        updates.clothing_fee_override = fee;
        if (product.product_price) {
          updates.client_product_price = Math.round((product.product_price + fee) * 100) / 100;
        }
      } else {
        // Save margin override
        const margin = parseFloat(productMargins[productId]);
        if (isNaN(margin) || margin < 0 || margin > 500) {
          setMessage({ [productId]: 'Invalid margin' });
          setSaving(null);
          return;
        }
        updates.product_margin_override = margin;
        updates.margin_percentage = margin;
        if (product.product_price) {
          updates.client_product_price = Math.round(product.product_price * (1 + margin / 100) * 100) / 100;
        }
      }

      // Get order's shipping margin
      const order = orders.find(o => o.id === orderId);
      const shippingMargin = order?.order_margin?.shipping_margin_percentage ?? defaultShippingMargin;

      if (product.shipping_air_price) {
        updates.client_shipping_air_price = Math.round(product.shipping_air_price * (1 + shippingMargin / 100) * 100) / 100;
      }
      if (product.shipping_boat_price) {
        updates.client_shipping_boat_price = Math.round(product.shipping_boat_price * (1 + shippingMargin / 100) * 100) / 100;
      }

      const { error } = await supabase
        .from('order_products')
        .update(updates)
        .eq('id', productId);

      if (error) throw error;

      setMessage({ [productId]: 'Saved!' });
      setEditingProduct(null);
      await fetchOrders();
      
      setTimeout(() => setMessage({}), 2000);
    } catch (error) {
      console.error('Error saving product override:', error);
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
          View and override margins/fees for specific orders and products
        </p>
        
        {/* Default settings info */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 bg-blue-100 rounded-lg text-blue-700">
            Product: <strong>{defaultProductMargin}%</strong>
          </span>
          <span className="px-2 py-1 bg-purple-100 rounded-lg text-purple-700">
            Clothing: <strong>${defaultClothingFee.toFixed(2)}</strong>
          </span>
          <span className="px-2 py-1 bg-amber-100 rounded-lg text-amber-700">
            Sample: <strong>{defaultSampleMargin}%</strong>
          </span>
          <span className="px-2 py-1 bg-green-100 rounded-lg text-green-700">
            Shipping: <strong>{defaultShippingMargin}%</strong>
          </span>
          <span className="px-2 py-1 bg-indigo-100 rounded-lg text-indigo-700">
            Accessory: <strong>{defaultAccessoryMargin}%</strong>
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
            const hasClothing = hasClothingProducts(order);
            const hasCustomProduct = hasCustomProductOverride(order);
            
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
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col gap-1">
                          <div>
                            <div className="font-medium text-gray-900 text-sm sm:text-base flex items-center gap-2 flex-wrap">
                              {formatOrderNumber(order.order_number)}
                              {order.order_name && (
                                <span className="text-xs sm:text-sm text-gray-500">{order.order_name}</span>
                              )}
                              {/* Badges */}
                              {hasCustomOrder && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-medium rounded">
                                  <Sparkles className="w-3 h-3" />
                                  Custom
                                </span>
                              )}
                              {hasClothing && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-pink-100 text-pink-700 text-[10px] font-medium rounded">
                                  <Shirt className="w-3 h-3" />
                                  Clothing
                                </span>
                              )}
                            </div>
                            <div className="text-xs sm:text-sm text-gray-500">
                              {order.client?.name} • {totalProducts} products
                            </div>
                            {/* Totals */}
                            <div className="text-xs text-gray-600 mt-1 flex flex-wrap items-center gap-1 sm:gap-3">
                              <span>Mfr: <strong>${totals.mfrTotal.toFixed(2)}</strong></span>
                              <span className="text-gray-400">→</span>
                              <span>Client: <strong>${totals.clientTotal.toFixed(2)}</strong></span>
                              {totals.shippingTotal > 0 && (
                                <>
                                  <span className="text-gray-400">+</span>
                                  <span>Ship: <strong>${totals.shippingTotal.toFixed(2)}</strong></span>
                                </>
                              )}
                              <span className="text-gray-400">=</span>
                              <span className="text-green-600 font-semibold">${totals.grandTotal.toFixed(2)}</span>
                              <span className="text-gray-500">({totals.margin}%)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right side - Controls */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                      {!isEditingOrder ? (
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="text-xs sm:text-sm">
                            <span className="text-gray-500">Product:</span>
                            <span className={`ml-1 font-semibold ${hasCustomOrder ? 'text-purple-600' : 'text-gray-900'}`}>
                              {orderMargins[order.id]?.product || defaultProductMargin}%
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm">
                            <span className="text-gray-500">Ship:</span>
                            <span className={`ml-1 font-semibold ${hasCustomOrder ? 'text-purple-600' : 'text-gray-900'}`}>
                              {orderMargins[order.id]?.shipping || defaultShippingMargin}%
                            </span>
                          </div>
                          <button
                            onClick={() => setEditingOrder(order.id)}
                            className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg p-2"
                            title="Edit margins"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openRecalcModal(order.id)}
                            className="text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 rounded-lg p-2"
                            title="Recalculate prices"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto w-full sm:w-auto">
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <label className="text-xs text-gray-500 font-medium">Product:</label>
                            <div className="relative">
                              <input
                                type="number"
                                value={orderMargins[order.id].product}
                                onChange={(e) => setOrderMargins(prev => ({
                                  ...prev,
                                  [order.id]: { ...prev[order.id], product: e.target.value }
                                }))}
                                className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-900"
                                min="0"
                                max="500"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <label className="text-xs text-gray-500 font-medium">Ship:</label>
                            <div className="relative">
                              <input
                                type="number"
                                value={orderMargins[order.id].shipping}
                                onChange={(e) => setOrderMargins(prev => ({
                                  ...prev,
                                  [order.id]: { ...prev[order.id], shipping: e.target.value }
                                }))}
                                className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-900"
                                min="0"
                                max="500"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleSaveOrderMargin(order.id)}
                            disabled={saving === order.id}
                            className="bg-blue-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium whitespace-nowrap"
                          >
                            {saving === order.id ? '...' : 'Save'}
                          </button>

                          <button
                            onClick={() => setEditingOrder(null)}
                            className="text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 text-sm rounded-lg font-medium"
                          >
                            Cancel
                          </button>

                          {message[order.id] && (
                            <span className={`text-xs font-medium ${message[order.id].includes('Saved') ? 'text-green-600' : 'text-red-600'}`}>
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
                  <div className="bg-gray-50 pb-3 sm:px-4">
                    <div className="space-y-2">
                      {order.order_products.map(product => {
                        const isEditingProd = editingProduct === product.id;
                        const isClothing = product.product?.is_clothing || false;
                        const totalQuantity = product.order_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
                        const hasOverride = isClothing 
                          ? product.clothing_fee_override !== null 
                          : product.product_margin_override !== null;
                        
                        // Calculate display values
                        const effectiveMargin = product.product_margin_override ?? orderMargins[order.id]?.product ?? defaultProductMargin;
                        const effectiveFee = product.clothing_fee_override ?? defaultClothingFee;
                        
                        return (
                          <div key={product.id} className={`bg-white p-3 rounded border ${
                            hasOverride ? 'border-orange-300 bg-orange-50/30' : 
                            isClothing ? 'border-pink-200' : 'border-gray-200'
                          }`}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <Package className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-700 flex items-center gap-2 flex-wrap">
                                    {product.product_order_number}
                                    {isClothing && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-pink-100 text-pink-700 text-[10px] font-medium rounded">
                                        <Shirt className="w-2.5 h-2.5" />
                                        Clothing
                                      </span>
                                    )}
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
                                  
                                  {/* Pricing info */}
                                  {product.product_price && (
                                    <div className="text-xs text-gray-600 mt-1">
                                      {isClothing ? (
                                        <span>
                                          ${product.product_price.toFixed(2)} + ${effectiveFee.toFixed(2)} fee = ${(product.client_product_price || 0).toFixed(2)}
                                        </span>
                                      ) : (
                                        <span>
                                          ${product.product_price.toFixed(2)} × {effectiveMargin}% = ${(product.client_product_price || 0).toFixed(2)}
                                        </span>
                                      )}
                                      {totalQuantity > 0 && (
                                        <span className="ml-2">
                                          × {totalQuantity} = ${((product.client_product_price || 0) * totalQuantity).toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Edit controls */}
                              <div className="flex items-center gap-2 justify-end">
                                {!isEditingProd ? (
                                  <>
                                    {isClothing ? (
                                      <div className="text-xs sm:text-sm flex items-center gap-2">
                                        <span className="text-gray-400 line-through">{effectiveMargin}%</span>
                                        <span className="text-gray-500">Fee:</span>
                                        <span className={`font-semibold ${hasOverride ? 'text-orange-600' : 'text-pink-600'}`}>
                                          ${effectiveFee.toFixed(2)}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="text-xs sm:text-sm">
                                        <span className="text-gray-500">Margin:</span>
                                        <span className={`ml-1 font-semibold ${hasOverride ? 'text-orange-600' : 'text-gray-900'}`}>
                                          {effectiveMargin}%
                                        </span>
                                      </div>
                                    )}
                                    <button
                                      onClick={() => {
                                        setEditingProduct(product.id);
                                        if (isClothing) {
                                          setProductClothingFees(prev => ({
                                            ...prev,
                                            [product.id]: effectiveFee.toString()
                                          }));
                                        } else {
                                          setProductMargins(prev => ({
                                            ...prev,
                                            [product.id]: effectiveMargin.toString()
                                          }));
                                        }
                                      }}
                                      className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg p-2"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    {isClothing ? (
                                      <>
                                        <span className="text-xs text-gray-400 line-through">{effectiveMargin}%</span>
                                        <div className="relative">
                                          <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                          <input
                                            type="number"
                                            value={productClothingFees[product.id]}
                                            onChange={(e) => setProductClothingFees(prev => ({
                                              ...prev,
                                              [product.id]: e.target.value
                                            }))}
                                            className="w-20 pl-6 pr-2 py-1.5 text-sm border border-pink-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-pink-500"
                                            min="0"
                                            step="0.01"
                                          />
                                        </div>
                                      </>
                                    ) : (
                                      <div className="relative">
                                        <input
                                          type="number"
                                          value={productMargins[product.id]}
                                          onChange={(e) => setProductMargins(prev => ({
                                            ...prev,
                                            [product.id]: e.target.value
                                          }))}
                                          className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                                          min="0"
                                          max="500"
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                                      </div>
                                    )}

                                    <button
                                      onClick={() => handleSaveProductOverride(product.id, order.id, isClothing)}
                                      disabled={saving === product.id}
                                      className="bg-green-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium"
                                    >
                                      {saving === product.id ? '...' : 'Save'}
                                    </button>

                                    <button
                                      onClick={() => setEditingProduct(null)}
                                      className="text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 text-sm rounded-lg font-medium"
                                    >
                                      Cancel
                                    </button>

                                    {message[product.id] && (
                                      <span className={`text-xs font-medium ${message[product.id] === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>
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
          <div className="p-12 text-center text-gray-500">
            No orders found
          </div>
        )}
      </div>

      {/* Recalculate Modal */}
      {showRecalcModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-green-600" />
                Recalculate Prices
              </h3>
              <button
                onClick={() => {
                  setShowRecalcModal(false);
                  setRecalcOrderId(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                Select which items to recalculate using current Finance Settings:
              </p>

              <div className="space-y-3">
                {/* Regular Products */}
                <div className={`p-3 rounded-lg border ${recalcOptions.regularProducts ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recalcOptions.regularProducts}
                      onChange={(e) => setRecalcOptions(prev => ({ ...prev, regularProducts: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <Package className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-900">Regular Products</span>
                  </label>
                  {recalcOptions.regularProducts && (
                    <div className="mt-2 ml-7 flex items-center gap-2">
                      <span className="text-xs text-gray-600">Margin:</span>
                      <div className="relative w-20">
                        <input
                          type="number"
                          value={recalcValues.productMargin}
                          onChange={(e) => setRecalcValues(prev => ({ ...prev, productMargin: e.target.value }))}
                          className="w-full px-2 py-1 text-sm border border-blue-300 rounded text-gray-900"
                          min="0"
                          max="500"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                      </div>
                      {parseFloat(recalcValues.productMargin) !== defaultProductMargin && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">Custom</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Clothing Products */}
                <div className={`p-3 rounded-lg border ${recalcOptions.clothingProducts ? 'bg-pink-50 border-pink-300' : 'bg-gray-50 border-gray-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recalcOptions.clothingProducts}
                      onChange={(e) => setRecalcOptions(prev => ({ ...prev, clothingProducts: e.target.checked }))}
                      className="w-4 h-4 text-pink-600 rounded"
                    />
                    <Shirt className="w-4 h-4 text-pink-600" />
                    <span className="text-sm font-medium text-gray-900">Clothing Products</span>
                  </label>
                  {recalcOptions.clothingProducts && (
                    <div className="mt-2 ml-7 flex items-center gap-2">
                      <span className="text-xs text-gray-600">Fee:</span>
                      <div className="relative w-20">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                        <input
                          type="number"
                          value={recalcValues.clothingFee}
                          onChange={(e) => setRecalcValues(prev => ({ ...prev, clothingFee: e.target.value }))}
                          className="w-full pl-6 pr-2 py-1 text-sm border border-pink-300 rounded text-gray-900"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      {parseFloat(recalcValues.clothingFee) !== defaultClothingFee && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">Custom</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Samples */}
                <div className={`p-3 rounded-lg border ${recalcOptions.samples ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recalcOptions.samples}
                      onChange={(e) => setRecalcOptions(prev => ({ ...prev, samples: e.target.checked }))}
                      className="w-4 h-4 text-amber-600 rounded"
                    />
                    <FileBox className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-gray-900">Samples</span>
                  </label>
                  {recalcOptions.samples && (
                    <div className="mt-2 ml-7 flex items-center gap-2">
                      <span className="text-xs text-gray-600">Margin:</span>
                      <div className="relative w-20">
                        <input
                          type="number"
                          value={recalcValues.sampleMargin}
                          onChange={(e) => setRecalcValues(prev => ({ ...prev, sampleMargin: e.target.value }))}
                          className="w-full px-2 py-1 text-sm border border-amber-300 rounded text-gray-900"
                          min="0"
                          max="500"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                      </div>
                      {parseFloat(recalcValues.sampleMargin) !== defaultSampleMargin && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">Custom</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Shipping */}
                <div className={`p-3 rounded-lg border ${recalcOptions.shipping ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recalcOptions.shipping}
                      onChange={(e) => setRecalcOptions(prev => ({ ...prev, shipping: e.target.checked }))}
                      className="w-4 h-4 text-green-600 rounded"
                    />
                    <Truck className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-900">Shipping</span>
                  </label>
                  {recalcOptions.shipping && (
                    <div className="mt-2 ml-7 flex items-center gap-2">
                      <span className="text-xs text-gray-600">Margin:</span>
                      <div className="relative w-20">
                        <input
                          type="number"
                          value={recalcValues.shippingMargin}
                          onChange={(e) => setRecalcValues(prev => ({ ...prev, shippingMargin: e.target.value }))}
                          className="w-full px-2 py-1 text-sm border border-green-300 rounded text-gray-900"
                          min="0"
                          max="500"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                      </div>
                      {parseFloat(recalcValues.shippingMargin) !== defaultShippingMargin && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">Custom</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Accessories */}
                <div className={`p-3 rounded-lg border ${recalcOptions.accessories ? 'bg-indigo-50 border-indigo-300' : 'bg-gray-50 border-gray-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recalcOptions.accessories}
                      onChange={(e) => setRecalcOptions(prev => ({ ...prev, accessories: e.target.checked }))}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <Tag className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-medium text-gray-900">Accessories</span>
                  </label>
                  {recalcOptions.accessories && (
                    <div className="mt-2 ml-7 flex items-center gap-2">
                      <span className="text-xs text-gray-600">Margin:</span>
                      <div className="relative w-20">
                        <input
                          type="number"
                          value={recalcValues.accessoryMargin}
                          onChange={(e) => setRecalcValues(prev => ({ ...prev, accessoryMargin: e.target.value }))}
                          className="w-full px-2 py-1 text-sm border border-indigo-300 rounded text-gray-900"
                          min="0"
                          max="500"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                      </div>
                      {parseFloat(recalcValues.accessoryMargin) !== defaultAccessoryMargin && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">Custom</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    <strong>Warning:</strong> This will overwrite existing client prices for selected items. Custom overrides will be cleared.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRecalcModal(false);
                  setRecalcOrderId(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleRecalculate}
                disabled={recalculating || !Object.values(recalcOptions).some(v => v)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                {recalculating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Recalculating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Recalculate Selected
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Quick Guide:</p>
            <ul className="list-disc ml-5 space-y-1 text-xs">
              <li><strong>Edit button:</strong> Modify order-level margins (applies to all non-overridden products)</li>
              <li><strong>Recalculate button:</strong> Reapply current Finance Settings to selected item types</li>
              <li><span className="inline-flex items-center gap-1 px-1 bg-pink-100 text-pink-700 text-[10px] rounded"><Shirt className="w-2.5 h-2.5"/>Clothing</span> = Product uses flat fee instead of margin %</li>
              <li><span className="inline-flex items-center gap-1 px-1 bg-orange-100 text-orange-700 text-[10px] rounded"><Star className="w-2.5 h-2.5"/>Custom</span> = Product has override (different from order/system defaults)</li>
              <li>Expand orders to edit individual product margins/fees</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
