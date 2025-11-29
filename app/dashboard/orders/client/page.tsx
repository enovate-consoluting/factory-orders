/**
 * Client Orders Page - /dashboard/orders/client
 * Clean, minimal dashboard for client order review and approval
 * Features: Sample requests, product approvals, modern UI
 * Last Modified: Nov 26 2025
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Package, Clock, CheckCircle, Calendar, 
  ExternalLink, Loader2, ChevronDown, ChevronRight,
  FileText, DollarSign, Truck, Check, X,
  AlertCircle, Sparkles
} from 'lucide-react';

interface OrderProduct {
  id: string;
  product_order_number: string;
  description: string;
  product_status: string;
  routed_to: string;
  routed_at?: string;
  client_product_price?: number;
  client_shipping_air_price?: number;
  client_shipping_boat_price?: number;
  selected_shipping_method?: string;
  sample_fee?: number;
  sample_required?: boolean;
  order_items?: Array<{ quantity: number }>;
}

interface Order {
  id: string;
  order_number: string;
  order_name: string | null;
  created_at: string;
  sample_required?: boolean;
  sample_routed_to?: string;
  sample_status?: string;
  sample_fee?: number;
  sample_eta?: string;
  order_products: OrderProduct[];
  // Computed
  pending_count?: number;
  client_products?: number;
}

export default function ClientOrdersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [clientName, setClientName] = useState('');
  const [activeTab, setActiveTab] = useState<'samples' | 'products' | 'all'>('samples');
  const [approvingId, setApprovingId] = useState<string | null>(null);

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

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_name,
          created_at,
          sample_required,
          sample_routed_to,
          sample_status,
          sample_fee,
          sample_eta,
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

      // Process orders
      const processedOrders = (ordersData || []).map(order => {
        const allProducts = order.order_products || [];
        const clientProducts = allProducts.filter((p: any) => p.routed_to === 'client');
        const pendingProducts = clientProducts.filter((p: any) => 
          p.product_status === 'pending_client_approval'
        );

        return {
          ...order,
          pending_count: pendingProducts.length,
          client_products: clientProducts.length
        };
      });

      // Filter to orders that need client attention
      const relevantOrders = processedOrders.filter(order => 
        order.client_products > 0 || 
        (order.sample_required && order.sample_routed_to === 'client')
      );

      setOrders(relevantOrders);
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

  const handleApproveSample = async (orderId: string) => {
    setApprovingId(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          sample_status: 'sample_approved',
          sample_client_approved: true,
          sample_client_approved_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // Refresh orders
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        await fetchOrders(user.email);
      }
    } catch (error) {
      console.error('Error approving sample:', error);
      alert('Failed to approve sample. Please try again.');
    } finally {
      setApprovingId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const calculateProductTotal = (product: OrderProduct) => {
    let total = 0;
    
    if (product.sample_required && product.sample_fee) {
      total += parseFloat(String(product.sample_fee || 0));
    }
    
    const totalQty = product.order_items?.reduce((sum, item) => 
      sum + (item.quantity || 0), 0
    ) || 0;
    total += parseFloat(String(product.client_product_price || 0)) * totalQty;
    
    if (product.selected_shipping_method === 'air') {
      total += parseFloat(String(product.client_shipping_air_price || 0));
    } else if (product.selected_shipping_method === 'boat') {
      total += parseFloat(String(product.client_shipping_boat_price || 0));
    }
    
    return total;
  };

  // Stats
  const samplesNeedingApproval = orders.filter(o => 
    o.sample_required && 
    o.sample_routed_to === 'client' && 
    o.sample_status !== 'sample_approved'
  ).length;

  const productsNeedingApproval = orders.reduce((sum, order) => 
    sum + (order.pending_count || 0), 0
  );

  const totalApproved = orders.reduce((sum, order) => {
    const approved = order.order_products?.filter((p: any) => 
      p.product_status === 'client_approved'
    ).length || 0;
    return sum + approved;
  }, 0);

  // Filter orders based on active tab
  const getFilteredOrders = () => {
    switch (activeTab) {
      case 'samples':
        return orders.filter(o => 
          o.sample_required && 
          o.sample_routed_to === 'client' &&
          o.sample_status !== 'sample_approved'
        );
      case 'products':
        return orders.filter(o => (o.pending_count || 0) > 0);
      default:
        return orders;
    }
  };

  const filteredOrders = getFilteredOrders();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
          <p className="mt-3 text-gray-600">Loading your orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome back, {clientName}</h1>
              <p className="text-gray-500 mt-1">Review and approve your orders</p>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span className="text-sm text-gray-600">
                {samplesNeedingApproval + productsNeedingApproval} items need attention
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Samples */}
          <button
            onClick={() => setActiveTab('samples')}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              activeTab === 'samples'
                ? 'bg-amber-50 border-amber-400 shadow-md'
                : 'bg-white border-gray-200 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                activeTab === 'samples' ? 'bg-amber-500' : 'bg-amber-100'
              }`}>
                <FileText className={`w-5 h-5 ${activeTab === 'samples' ? 'text-white' : 'text-amber-600'}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Samples</p>
                <p className="text-2xl font-bold text-gray-900">{samplesNeedingApproval}</p>
              </div>
            </div>
            {samplesNeedingApproval > 0 && (
              <div className="mt-2 text-xs text-amber-600 font-medium">
                Awaiting your approval →
              </div>
            )}
          </button>

          {/* Products */}
          <button
            onClick={() => setActiveTab('products')}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              activeTab === 'products'
                ? 'bg-blue-50 border-blue-400 shadow-md'
                : 'bg-white border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                activeTab === 'products' ? 'bg-blue-500' : 'bg-blue-100'
              }`}>
                <Package className={`w-5 h-5 ${activeTab === 'products' ? 'text-white' : 'text-blue-600'}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Products</p>
                <p className="text-2xl font-bold text-gray-900">{productsNeedingApproval}</p>
              </div>
            </div>
            {productsNeedingApproval > 0 && (
              <div className="mt-2 text-xs text-blue-600 font-medium">
                Ready for review →
              </div>
            )}
          </button>

          {/* Approved */}
          <button
            onClick={() => setActiveTab('all')}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              activeTab === 'all'
                ? 'bg-green-50 border-green-400 shadow-md'
                : 'bg-white border-gray-200 hover:border-green-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                activeTab === 'all' ? 'bg-green-500' : 'bg-green-100'
              }`}>
                <CheckCircle className={`w-5 h-5 ${activeTab === 'all' ? 'text-white' : 'text-green-600'}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Approved</p>
                <p className="text-2xl font-bold text-gray-900">{totalApproved}</p>
              </div>
            </div>
            <div className="mt-2 text-xs text-green-600 font-medium">
              View all orders →
            </div>
          </button>
        </div>

        {/* Orders List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Tab Header */}
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-900">
              {activeTab === 'samples' && 'Sample Requests Awaiting Approval'}
              {activeTab === 'products' && 'Products Awaiting Approval'}
              {activeTab === 'all' && 'All Orders'}
            </h2>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">All caught up!</p>
              <p className="text-gray-400 text-sm mt-1">
                {activeTab === 'samples' && 'No sample requests need your approval'}
                {activeTab === 'products' && 'No products need your approval'}
                {activeTab === 'all' && 'No orders found'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredOrders.map((order) => {
                const isExpanded = expandedOrders.has(order.id);
                const clientProducts = order.order_products?.filter((p: any) => p.routed_to === 'client') || [];
                const hasSampleForClient = order.sample_required && order.sample_routed_to === 'client';
                const sampleNeedsApproval = hasSampleForClient && order.sample_status !== 'sample_approved';

                return (
                  <div key={order.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Order Row */}
                    <div 
                      className="px-5 py-4 cursor-pointer"
                      onClick={() => toggleOrderExpansion(order.id)}
                    >
                      <div className="flex items-center gap-4">
                        {/* Expand Arrow */}
                        <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          )}
                        </button>

                        {/* Order Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {order.order_name || 'Untitled Order'}
                            </h3>
                            <span className="text-xs text-gray-400">
                              #{order.order_number}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(order.created_at).toLocaleDateString()}
                            </span>
                            {sampleNeedsApproval && (
                              <span className="flex items-center gap-1 text-amber-600 font-medium">
                                <FileText className="w-3 h-3" />
                                Sample pending
                              </span>
                            )}
                            {(order.pending_count || 0) > 0 && (
                              <span className="flex items-center gap-1 text-blue-600 font-medium">
                                <Package className="w-3 h-3" />
                                {order.pending_count} product{order.pending_count !== 1 ? 's' : ''} pending
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2">
                          {sampleNeedsApproval && (
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                              Sample
                            </span>
                          )}
                          {(order.pending_count || 0) > 0 && (
                            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                              {order.pending_count} Products
                            </span>
                          )}
                        </div>

                        {/* View Link */}
                        <a
                          href={`/dashboard/orders/client/${order.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Open full order"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-0">
                        <div className="ml-10 space-y-3">
                          {/* Sample Request Card */}
                          {hasSampleForClient && (
                            <div className={`rounded-lg border-2 p-4 ${
                              sampleNeedsApproval 
                                ? 'bg-amber-50 border-amber-200' 
                                : 'bg-green-50 border-green-200'
                            }`}>
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                                    sampleNeedsApproval ? 'bg-amber-500' : 'bg-green-500'
                                  }`}>
                                    <FileText className="w-4 h-4 text-white" />
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-gray-900">Sample Request</h4>
                                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                                      {order.sample_fee && (
                                        <span className="flex items-center gap-1">
                                          <DollarSign className="w-3.5 h-3.5" />
                                          {formatCurrency(order.sample_fee)}
                                        </span>
                                      )}
                                      {order.sample_eta && (
                                        <span className="flex items-center gap-1">
                                          <Truck className="w-3.5 h-3.5" />
                                          ETA: {new Date(order.sample_eta).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                    {!sampleNeedsApproval && (
                                      <p className="text-sm text-green-600 font-medium mt-2">
                                        ✓ You approved this sample
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {sampleNeedsApproval && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApproveSample(order.id);
                                    }}
                                    disabled={approvingId === order.id}
                                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                  >
                                    {approvingId === order.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Check className="w-4 h-4" />
                                    )}
                                    Approve Sample
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Products */}
                          {clientProducts.length > 0 && (
                            <div className="space-y-2">
                              {clientProducts.map((product: any) => {
                                const totalQty = product.order_items?.reduce((sum: number, item: any) => 
                                  sum + (item.quantity || 0), 0
                                ) || 0;
                                const productTotal = calculateProductTotal(product);
                                const isPending = product.product_status === 'pending_client_approval';

                                return (
                                  <div 
                                    key={product.id}
                                    className={`rounded-lg border p-3 flex items-center justify-between ${
                                      isPending 
                                        ? 'bg-blue-50 border-blue-200' 
                                        : 'bg-white border-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <Package className="w-4 h-4 text-gray-400" />
                                      <div>
                                        <p className="font-medium text-gray-900 text-sm">
                                          {product.product_order_number}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {product.description || 'Product'} • Qty: {totalQty}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="font-semibold text-gray-900 text-sm">
                                        {formatCurrency(productTotal)}
                                      </span>
                                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                        isPending 
                                          ? 'bg-blue-100 text-blue-700' 
                                          : 'bg-green-100 text-green-700'
                                      }`}>
                                        {isPending ? 'Pending' : 'Approved'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* View Full Order Button */}
                          <a
                            href={`/dashboard/orders/client/${order.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors text-center"
                          >
                            View Full Order Details →
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Help */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Need help? Contact your account manager or email support@company.com
        </div>
      </div>
    </div>
  );
}