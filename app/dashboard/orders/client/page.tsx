/**
 * Client Orders Page - /dashboard/orders/client
 * Shows orders with products awaiting client approval
 * Features: Smaller dashboard cards, click-to-filter, collapsed by default
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Package, Clock, CheckCircle, Calendar, 
  ExternalLink, Loader2, ChevronDown, ChevronRight,
  AlertCircle
} from 'lucide-react';

export default function ClientOrdersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [clientName, setClientName] = useState('');
  const [activeFilter, setActiveFilter] = useState<'pending' | 'all'>('pending');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== 'client') {
      router.push('/dashboard');
      return;
    }

    fetchOrders(user.email);
  }, [router]);

  const fetchOrders = async (email: string) => {
    try {
      setLoading(true);

      // Get client info
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, name')
        .eq('email', email)
        .single();

      if (clientError || !clientData) {
        console.error('Error finding client:', clientError);
        setLoading(false);
        return;
      }

      setClientName(clientData.name);

      // Fetch orders with products
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_name,
          created_at,
          order_products(
            id,
            product_order_number,
            description,
            product_status,
            routed_to,
            routed_at,
            client_product_price,
            client_shipping_air_price,
            client_shipping_boat_price,
            selected_shipping_method,
            sample_fee,
            sample_required,
            order_items(quantity)
          )
        `)
        .eq('client_id', clientData.id)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        setLoading(false);
        return;
      }

      // Process orders to include product counts
      const processedOrders = ordersData.map(order => {
        const allProducts = order.order_products || [];
        const clientProducts = allProducts.filter((p: any) => p.routed_to === 'client');
        const pendingProducts = clientProducts.filter((p: any) => 
          p.product_status === 'pending_client_approval'
        );

        return {
          ...order,
          total_products: allProducts.length,
          client_products: clientProducts.length,
          pending_count: pendingProducts.length,
          routed_at: clientProducts[0]?.routed_at
        };
      });

      // Filter to only orders with products routed to client
      const filteredOrders = processedOrders.filter(order => order.client_products > 0);

      setOrders(filteredOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
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

  const calculateProductTotal = (product: any) => {
    let total = 0;
    
    if (product.sample_required && product.sample_fee) {
      total += parseFloat(product.sample_fee || 0);
    }
    
    const totalQty = product.order_items?.reduce((sum: number, item: any) => 
      sum + (item.quantity || 0), 0
    ) || 0;
    total += parseFloat(product.client_product_price || 0) * totalQty;
    
    if (product.selected_shipping_method === 'air') {
      total += parseFloat(product.client_shipping_air_price || 0);
    } else if (product.selected_shipping_method === 'boat') {
      total += parseFloat(product.client_shipping_boat_price || 0);
    }
    
    return total;
  };

  const calculateOrderTotal = (order: any) => {
    const clientProducts = order.order_products?.filter((p: any) => p.routed_to === 'client') || [];
    return clientProducts.reduce((sum: number, product: any) => 
      sum + calculateProductTotal(product), 0
    );
  };

  const daysSince = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Stats
  const totalOrders = orders.length;
  const pendingProducts = orders.reduce((sum, order) => sum + order.pending_count, 0);
  const approvedProducts = orders.reduce((sum, order) => {
    const approved = order.order_products?.filter((p: any) => 
      p.routed_to === 'client' && p.product_status === 'client_approved'
    ).length || 0;
    return sum + approved;
  }, 0);

  // Filter orders
  const displayOrders = activeFilter === 'pending' 
    ? orders.filter(order => order.pending_count > 0)
    : orders;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
        <p className="text-sm text-gray-600 mt-1">Review and approve products</p>
      </div>

      {/* Smaller Dashboard Cards - Clickable */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Pending - Clickable */}
        <button
          onClick={() => setActiveFilter('pending')}
          className={`text-left bg-white rounded-lg shadow border-2 p-4 transition-all ${
            activeFilter === 'pending' 
              ? 'border-amber-400 ring-2 ring-amber-200' 
              : 'border-gray-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            {pendingProducts > 0 && (
              <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full animate-pulse">
                ACTION
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-1">Awaiting Approval</p>
          <p className="text-2xl font-bold text-amber-600">{pendingProducts}</p>
        </button>

        {/* Approved */}
        <button
          onClick={() => setActiveFilter('all')}
          className={`text-left bg-white rounded-lg shadow border-2 p-4 transition-all ${
            activeFilter === 'all' 
              ? 'border-green-400 ring-2 ring-green-200' 
              : 'border-gray-200 hover:border-green-300'
          }`}
        >
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-xs text-gray-500 mb-1">Approved</p>
          <p className="text-2xl font-bold text-green-600">{approvedProducts}</p>
        </button>

        {/* Total Orders */}
        <button
          onClick={() => setActiveFilter('all')}
          className={`text-left bg-white rounded-lg shadow border-2 p-4 transition-all ${
            activeFilter === 'all' 
              ? 'border-blue-400 ring-2 ring-blue-200' 
              : 'border-gray-200 hover:border-blue-300'
          }`}
        >
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-xs text-gray-500 mb-1">Total Orders</p>
          <p className="text-2xl font-bold text-blue-600">{totalOrders}</p>
        </button>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            {activeFilter === 'pending' ? 'Orders Needing Your Attention' : 'All Your Orders'}
          </h2>
        </div>

        <div className="divide-y divide-gray-200">
          {displayOrders.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-500">
                {activeFilter === 'pending' 
                  ? 'No orders need your attention right now'
                  : 'No orders found'
                }
              </p>
            </div>
          ) : (
            displayOrders.map((order) => {
              const isExpanded = expandedOrders.has(order.id);
              const daysWaiting = order.routed_at ? daysSince(order.routed_at) : 0;
              const clientProducts = order.order_products?.filter((p: any) => p.routed_to === 'client') || [];

              return (
                <div key={order.id} className="hover:bg-gray-50 transition-colors">
                  {/* Order Header - Collapsed by default */}
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => toggleOrderExpansion(order.id)}
                    onDoubleClick={() => toggleOrderExpansion(order.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleOrderExpansion(order.id);
                          }}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-500" />
                          )}
                        </button>

                        <div className="flex-1">
                          {/* Order Name (large, black) */}
                          <h3 className="text-base font-bold text-gray-900">
                            {order.order_name || 'Order'}
                          </h3>
                          
                          {/* Order Number (small, gray) */}
                          <p className="text-xs text-gray-500 mt-0.5">
                            #{order.order_number}
                          </p>

                          {/* Order Info */}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(order.created_at).toLocaleDateString()}
                            </span>
                            
                            {daysWaiting > 0 && order.pending_count > 0 && (
                              <span className="flex items-center gap-1 text-amber-600 font-medium">
                                <Clock className="w-3 h-3" />
                                {daysWaiting} day{daysWaiting !== 1 ? 's' : ''} waiting
                              </span>
                            )}

                            {/* Product Count Indicator */}
                            <span className="font-semibold text-gray-900">
                              {isExpanded ? `${clientProducts.length} products` : `${order.pending_count} of ${clientProducts.length} products`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Side - Total & Actions */}
                      <div className="flex items-center gap-3 ml-4">
                        {/* Pending Badge */}
                        {order.pending_count > 0 && (
                          <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                            {order.pending_count} pending
                          </span>
                        )}

                        {/* Order Total */}
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Order Total</p>
                          <p className="text-base font-bold text-green-700">
                            {formatCurrency(calculateOrderTotal(order))}
                          </p>
                        </div>

                        {/* View Full Order Link */}
                        <a
                          href={`/dashboard/orders/${order.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                          title="View Full Order"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Products */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50">
                      <div className="space-y-2">
                        {clientProducts.map((product: any) => {
                          const totalQty = product.order_items?.reduce((sum: number, item: any) => 
                            sum + (item.quantity || 0), 0
                          ) || 0;
                          const productTotal = calculateProductTotal(product);

                          return (
                            <div 
                              key={product.id}
                              className="bg-white rounded-lg p-3 border border-gray-200 hover:border-blue-300 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-900">
                                      {product.product_order_number}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-0.5">
                                      {product.description || 'Product'}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                      <span>Qty: {totalQty}</span>
                                      <span className={`px-2 py-0.5 rounded-full font-medium ${
                                        product.product_status === 'pending_client_approval'
                                          ? 'bg-amber-100 text-amber-700'
                                          : 'bg-green-100 text-green-700'
                                      }`}>
                                        {product.product_status === 'pending_client_approval' 
                                          ? 'Needs Approval' 
                                          : 'Approved'
                                        }
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <p className="text-sm font-bold text-gray-900">
                                    {formatCurrency(productTotal)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* View Full Order Button */}
                      <a
                        href={`/dashboard/orders/${order.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 block w-full px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors text-center"
                      >
                        View Full Order & Take Action →
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}