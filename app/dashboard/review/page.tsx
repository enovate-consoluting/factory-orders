'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { CheckCircle, XCircle, Clock, AlertCircle, ArrowLeft, Package, User, Building2, Calendar, Eye, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Order, OrderProduct, Product, Client, Manufacturer } from '@/app/types/database';
import { OrderStatusBadge } from '@/app/components/StatusBadge';
import { createNotification } from '@/app/hooks/useNotifications';

// Fix: Don't extend Order, define the full interface
interface OrderWithDetails {
  id: string;
  order_number: string;
  client_id: string;
  manufacturer_id: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  client?: { name: string; email: string };
  manufacturer?: { name: string; email: string };
  products?: OrderProduct[];
}

interface OrderItem {
  id: string;
  order_product_id: string;
  variant_combo: string;
  quantity: number;
  notes?: string;
  admin_status: 'pending' | 'approved' | 'rejected';
  manufacturer_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export default function ReviewPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [orderItems, setOrderItems] = useState<{ [key: string]: OrderItem[] }>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) {
      router.push('/');
      return;
    }
    const user = JSON.parse(userStr);
    setCurrentUser(user);
    fetchOrdersForReview(user);
  }, []);

  const fetchOrdersForReview = async (user: any) => {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          client:clients(name, email),
          manufacturer:manufacturers(name, email),
          products:order_products(
            id,
            product_id,
            product_status,
            requires_client_approval,
            product:products(id, title)
          )
        `);

      // Filter based on user role
      if (user.role === 'client') {
        // Clients see orders submitted to them
        query = query.eq('client_id', user.id)
                    .eq('status', 'submitted_to_client');
      } else if (user.role === 'manufacturer') {
        // Manufacturers see orders submitted to them
        query = query.eq('manufacturer_id', user.id)
                    .in('status', ['submitted_to_manufacturer', 'submitted_for_sample']);
      } else if (user.role === 'super_admin' || user.role === 'admin' || user.role === 'order_approver') {
        // Admins see all orders needing review
        query = query.in('status', ['submitted', 'manufacturer_processed', 'client_reviewed']);
      } else {
        // Other roles don't have review access
        setOrders([]);
        setLoading(false);
        return;
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data || []);

      // Fetch items for each order product
      for (const order of (data || [])) {
        for (const product of (order.products || [])) {
          await fetchOrderItems(product.id);
        }
      }
    } catch (error) {
      console.error('Error fetching orders for review:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderItems = async (orderProductId: string) => {
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_product_id', orderProductId);

      if (error) throw error;

      setOrderItems(prev => ({
        ...prev,
        [orderProductId]: data || []
      }));
    } catch (error) {
      console.error('Error fetching order items:', error);
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

  const handleApproveItem = async (itemId: string, orderProductId: string) => {
    setProcessing(itemId);
    try {
      const updateField = currentUser.role === 'manufacturer' 
        ? { manufacturer_status: 'approved' }
        : { admin_status: 'approved' };

      const { error } = await supabase
        .from('order_items')
        .update(updateField)
        .eq('id', itemId);

      if (error) throw error;

      // Refresh items
      await fetchOrderItems(orderProductId);
      
      // Create notification
      // TODO: Fix notification function signature
      // await createNotification({
      //   user_id: currentUser.id,
      //   type: 'product_update',
      //   message: `Item approved by ${currentUser.name || currentUser.email}`,
      //   order_product_id: orderProductId
      // });
    } catch (error) {
      console.error('Error approving item:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectItem = async (itemId: string, orderProductId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    setProcessing(itemId);
    try {
      const updateField = currentUser.role === 'manufacturer' 
        ? { manufacturer_status: 'rejected' }
        : { admin_status: 'rejected' };

      const { error } = await supabase
        .from('order_items')
        .update(updateField)
        .eq('id', itemId);

      if (error) throw error;

      // Refresh items
      await fetchOrderItems(orderProductId);
      
      // Create notification with reason
      // TODO: Fix notification function signature
      // await createNotification({
      //   user_id: currentUser.id,
      //   type: 'product_update',
      //   message: `Item rejected by ${currentUser.name || currentUser.email}: ${reason}`,
      //   order_product_id: orderProductId
      // });
    } catch (error) {
      console.error('Error rejecting item:', error);
    } finally {
      setProcessing(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const canApproveItems = currentUser?.role === 'super_admin' || 
                         currentUser?.role === 'admin' || 
                         currentUser?.role === 'order_approver' ||
                         currentUser?.role === 'manufacturer' ||
                         currentUser?.role === 'client';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">No Orders to Review</h2>
          <p className="text-gray-500">There are no orders requiring your review at this time.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Review Orders</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <p className="text-gray-600 mt-2">
          {currentUser?.role === 'client' && 'Review and approve orders from manufacturers'}
          {currentUser?.role === 'manufacturer' && 'Review order details and set pricing'}
          {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && 'Review and approve pending orders'}
        </p>
      </div>

      <div className="space-y-6">
        {orders.map(order => {
          const isExpanded = expandedOrders.has(order.id);
          
          return (
            <div key={order.id} className="bg-white rounded-lg shadow">
              {/* Order Header */}
              <div 
                className="p-6 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleOrderExpansion(order.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-gray-900">
                          {order.order_number}
                        </h2>
                        <OrderStatusBadge status={order.status as any} />
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {order.client?.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-4 h-4" />
                          {order.manufacturer?.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(order.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/orders/${order.id}`);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Order Products - Expandable */}
              {isExpanded && (
                <div className="border-t px-6 py-4 bg-gray-50">
                  <h3 className="font-medium text-gray-900 mb-4">Products for Review</h3>
                  <div className="space-y-4">
                    {order.products?.map(product => {
                      const items = orderItems[product.id] || [];
                      
                      return (
                        <div key={product.id} className="bg-white rounded-lg p-4">
                          <h4 className="font-medium text-gray-900 mb-3">
                            {(product as any).product?.title || 'Product'}
                          </h4>
                          <div className="space-y-2">
                            {items.map(item => {
                              const status = currentUser?.role === 'manufacturer' 
                                ? item.manufacturer_status 
                                : item.admin_status;
                              
                              return (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                  <div className="flex items-center gap-3">
                                    {getStatusIcon(status)}
                                    <div>
                                      <div className="font-medium">{item.variant_combo}</div>
                                      <div className="text-sm text-gray-600">
                                        Quantity: {item.quantity}
                                        {item.notes && ` • Notes: ${item.notes}`}
                                      </div>
                                    </div>
                                  </div>
                                  {canApproveItems && status === 'pending' && (
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleApproveItem(item.id, product.id)}
                                        disabled={processing === item.id}
                                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                      >
                                        {processing === item.id ? 'Processing...' : 'Approve'}
                                      </button>
                                      <button
                                        onClick={() => handleRejectItem(item.id, product.id)}
                                        disabled={processing === item.id}
                                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  )}
                                  {status !== 'pending' && (
                                    <span className={`px-3 py-1 rounded text-sm font-medium ${
                                      status === 'approved' 
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}>
                                      {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
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
    </div>
  );
}