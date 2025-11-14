'use client';

import React, { useState, useEffect } from 'react';
import { 
  Save, Percent, AlertCircle, CheckCircle, Package, 
  ChevronDown, ChevronRight, Edit, DollarSign
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
    product?: {
      title: string;
    };
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
  const [defaultShippingMargin, setDefaultShippingMargin] = useState(0);
useEffect(() => {
    checkUserRole();
    loadDefaultMargins(); // ADDED: Load margins from system_config
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

  // ADDED: Load default margins from system_config
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
            setDefaultShippingMargin(parseFloat(config.config_value) || 0);
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
            product:products(title)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch order margins
      const { data: marginData } = await supabase
        .from('order_margins')
        .select('order_id, margin_percentage, shipping_margin_percentage');

      // Combine data - FIX: Handle client and product as arrays from Supabase
      const ordersWithMargins = (data || []).map(order => {
        const orderMargin = marginData?.find(m => m.order_id === order.id);
        return {
          id: order.id,
          order_number: order.order_number,
          order_name: order.order_name,
          status: order.status,
          created_at: order.created_at,
          // FIX: Handle client being an array from Supabase
          client: Array.isArray(order.client) ? order.client[0] : order.client,
          // FIX: Handle products array and nested product arrays
          order_products: (order.order_products || []).map((p: any) => ({
            ...p,
            product: Array.isArray(p.product) ? p.product[0] : p.product
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
                                     order.order_margin?.margin_percentage?.toString() || defaultProductMargin.toString();
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

      // Save order margin
      const { error } = await supabase
        .from('order_margins')
        .upsert({
          order_id: orderId,
          margin_percentage: productMargin,
          shipping_margin_percentage: shippingMargin,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'order_id'
        });

      if (error) throw error;

      // Clear product-level overrides for this order
      const { error: clearError } = await supabase
        .from('order_products')
        .update({
          product_margin_override: null,
          shipping_margin_override: null
        })
        .eq('order_id', orderId);

      if (clearError) throw clearError;

      setMessage({ [orderId]: 'Saved!' });
      setEditingOrder(null);
      await fetchOrders();
      
      setTimeout(() => {
        setMessage({});
      }, 2000);
    } catch (error) {
      console.error('Error saving margin:', error);
      setMessage({ [orderId]: 'Error saving' });
    } finally {
      setSaving(null);
    }
  };

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

      // Save product-specific margin override
      const { error } = await supabase
        .from('order_products')
        .update({
          product_margin_override: margin
        })
        .eq('id', productId);

      if (error) throw error;

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

  const calculateClientPrice = (manufacturerPrice: number, marginPercent: number) => {
    return manufacturerPrice * (1 + marginPercent / 100);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Order Margins Management</h1>
          <Link
            href="/dashboard/settings/finance"
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            ← Back to Settings
          </Link>
        </div>
        <p className="text-gray-600">
          View and override margin percentages for specific orders and products
        </p>
      </div>
{/* Orders List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">All Orders</h2>
            <div className="text-sm text-gray-500">
              {orders.length} total orders
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {orders.map(order => {
            const isExpanded = expandedOrders.has(order.id);
            const isEditingOrder = editingOrder === order.id;
            const totalProducts = order.order_products?.length || 0;
            const totalValue = order.order_products?.reduce((sum, p) => 
              sum + (p.client_product_price || 0), 0) || 0;
            return (
              <div key={order.id} className="hover:bg-gray-50">
                {/* Order Row */}
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    {/* Left side - Order Info */}
                    <div className="flex items-center gap-3 flex-1">
                      <button
                        onClick={() => toggleOrderExpansion(order.id)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
 <div className="flex-1">
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="font-medium text-gray-900">
                              {formatOrderNumber(order.order_number)}
                              {order.order_name && (
                                <span className="text-sm text-gray-500 ml-2">
                                  {order.order_name}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {order.client?.name} • {totalProducts} products • 
                              Total: ${totalValue.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right side - Margin Controls */}
                    <div className="flex items-center gap-4">
                      {!isEditingOrder ? (
                        <>
                          <div className="text-sm">
                            <span className="text-gray-500">Product Margin:</span>
                            <span className="ml-2 font-semibold text-gray-900">
                              {orderMargins[order.id]?.product || defaultProductMargin}%
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-500">Shipping:</span>
                            <span className="ml-2 font-semibold text-gray-900">
                              {orderMargins[order.id]?.shipping || defaultShippingMargin}%
                            </span>
                          </div>
                          <button
                            onClick={() => setEditingOrder(order.id)}
                            className="text-blue-600 hover:text-blue-800 p-1"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <label className="text-xs text-gray-500">Product:</label>
                            <div className="relative">
                              <input
                                type="number"
                                value={orderMargins[order.id].product}
                                onChange={(e) => setOrderMargins(prev => ({
                                  ...prev,
                                  [order.id]: { ...prev[order.id], product: e.target.value }
                                }))}
                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
                                min="0"
                                max="500"
                              />
                              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <label className="text-xs text-gray-500">Ship:</label>
                            <div className="relative">
                              <input
                                type="number"
                                value={orderMargins[order.id].shipping}
                                onChange={(e) => setOrderMargins(prev => ({
                                  ...prev,
                                  [order.id]: { ...prev[order.id], shipping: e.target.value }
                                }))}
                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
                                min="0"
                                max="500"
                              />
                              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => handleSaveOrderMargin(order.id)}
                            disabled={saving === order.id}
                            className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700 disabled:bg-gray-400"
                          >
                            {saving === order.id ? '...' : 'Save All'}
                          </button>
                          
                          <button
                            onClick={() => setEditingOrder(null)}
                            className="text-gray-600 hover:text-gray-800 px-2 py-1 text-sm"
                          >
                            Cancel
                          </button>
                          
                          {message[order.id] && (
                            <span className={`text-xs ${
                              message[order.id] === 'Saved!' ? 'text-green-600' : 'text-red-600'
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
                  <div className="bg-gray-50 px-4 pb-4">
                    <div className="ml-8 space-y-2">
                      {order.order_products.map(product => {
                        const isEditingProduct = editingProduct === product.id;
                        const effectiveMargin = product.product_margin_override || 
                                               orderMargins[order.id]?.product || '80';
                        
                        return (
                          <div key={product.id} className="bg-white p-3 rounded border border-gray-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <Package className="w-4 h-4 text-gray-400" />
                                <div>
                                  <div className="text-sm font-medium text-gray-700">
                                    {product.product_order_number}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {product.description || product.product?.title}
                                  </div>
                                </div>
                                
                                {product.product_price && (
                                  <div className="text-xs text-gray-500 ml-4">
                                    Mfr: ${product.product_price.toFixed(2)} → 
                                    Client: ${(product.client_product_price || 0).toFixed(2)}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {!isEditingProduct ? (
                                  <>
                                    <div className="text-sm">
                                      <span className="text-gray-500">Margin:</span>
                                      <span className={`ml-2 font-semibold ${
                                        product.product_margin_override 
                                          ? 'text-orange-600' 
                                          : 'text-gray-900'
                                      }`}>
                                        {effectiveMargin}%
                                        {product.product_margin_override && (
                                          <span className="text-xs text-orange-500 ml-1">(custom)</span>
                                        )}
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
                                      className="text-blue-600 hover:text-blue-800 p-1"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="relative">
                                      <input
                                        type="number"
                                        value={productMargins[product.id]}
                                        onChange={(e) => setProductMargins(prev => ({
                                          ...prev,
                                          [product.id]: e.target.value
                                        }))}
                                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                                        min="0"
                                        max="500"
                                      />
                                      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                                    </div>
                                    
                                    <button
                                      onClick={() => handleSaveProductMargin(product.id, order.id)}
                                      disabled={saving === product.id}
                                      className="bg-green-600 text-white px-2 py-1 text-xs rounded hover:bg-green-700 disabled:bg-gray-400"
                                    >
                                      {saving === product.id ? '...' : 'Save'}
                                    </button>
                                    
                                    <button
                                      onClick={() => setEditingProduct(null)}
                                      className="text-gray-600 hover:text-gray-800 px-2 py-1 text-xs"
                                    >
                                      Cancel
                                    </button>
                                    
                                    {message[product.id] && (
                                      <span className={`text-xs ${
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
          <div className="p-12 text-center text-gray-500">
            No orders found
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Quick Guide:</p>
            <ul className="list-disc ml-5 space-y-1">
              <li><strong>Order-level margins:</strong> Click Edit on any order to set margins for ALL products in that order</li>
              <li><strong>Product-level margins:</strong> Expand an order and edit individual products for custom margins</li>
              <li><strong>Orange text:</strong> Indicates a custom product margin that overrides the order default</li>
              <li><strong>Changes are instant:</strong> Margins recalculate client prices immediately upon saving</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}