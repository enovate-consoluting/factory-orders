'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  Plus, 
  Search, 
  Filter, 
  Package,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Edit,
  Trash2,
  ChevronRight,
  Lock,
  Loader2
} from 'lucide-react';
import { Order, OrderProduct, User, OrderStatus } from '@/app/types/database';
import { OrderStatusBadge } from '@/app/components/StatusBadge';
import { notify } from '@/app/hooks/useUINotification';

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

export default function OrdersPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<OrderWithDetails | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
    fetchOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, searchTerm, statusFilter]);

  const fetchOrders = async () => {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          client:clients(name, email),
          manufacturer:manufacturers(name, email),
          products:order_products(
            id,
            product_status,
            is_locked,
            product:products(title)
          )
        `)
        .order('created_at', { ascending: false });

      // Filter based on user role
      if (currentUser?.role === 'manufacturer') {
        // Manufacturers only see non-draft orders assigned to them
        query = query.neq('status', 'draft');
      } else if (currentUser?.role === 'client') {
        // Clients only see orders submitted to them or beyond
        query = query.in('status', [
          'submitted_to_client',
          'client_reviewed',
          'approved_by_client',
          'submitted_for_sample',
          'sample_in_production',
          'sample_delivered',
          'sample_approved',
          'in_production',
          'partially_in_production',
          'completed'
        ]);
      }

      const { data, error } = await query;

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      notify.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.client?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.manufacturer?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    setFilteredOrders(filtered);
  };

  const handleDeleteOrder = async () => {
    if (!deleteConfirm) return;
    
    setProcessingId(deleteConfirm.id);

    try {
      // Delete order and all related data (cascade will handle related records)
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', deleteConfirm.id);

      if (error) throw error;

      notify.success(`Order "${deleteConfirm.order_number}" has been permanently deleted.`);
      await fetchOrders();
      setDeleteConfirm(null);
    } catch (error: any) {
      console.error('Error deleting order:', error);
      notify.error(`Failed to delete order. ${error.message || 'Please try again.'}`);
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusIcon = (status: OrderStatus) => {
    if (status === 'completed') return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (status === 'rejected') return <XCircle className="w-5 h-5 text-red-500" />;
    if (status.includes('in_production')) return <Package className="w-5 h-5 text-cyan-500" />;
    if (status.includes('sample')) return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    return <Clock className="w-5 h-5 text-blue-500" />;
  };

  const canEditOrder = (order: OrderWithDetails) => {
    if (currentUser?.role === 'super_admin' || currentUser?.role === 'admin') return true;
    if (currentUser?.role === 'order_approver') return true;
    if (order.status === 'draft' && order.created_by === currentUser?.id) return true;
    return false;
  };

  const canDeleteOrder = () => {
    return currentUser?.role === 'super_admin' || currentUser?.role === 'admin';
  };

  const getProductsSummary = (products: OrderProduct[] | undefined) => {
    if (!products || products.length === 0) return 'No products';
    
    const total = products.length;
    const locked = products.filter(p => p.is_locked).length;
    const inProduction = products.filter(p => p.product_status === 'in_production').length;
    const completed = products.filter(p => p.product_status === 'completed').length;
    
    if (locked > 0) {
      return `${total} product${total > 1 ? 's' : ''} (${locked} locked)`;
    }
    if (inProduction > 0) {
      return `${total} product${total > 1 ? 's' : ''} (${inProduction} in production)`;
    }
    if (completed > 0) {
      return `${total} product${total > 1 ? 's' : ''} (${completed} completed)`;
    }
    
    return `${total} product${total > 1 ? 's' : ''}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Orders</h1>
          <p className="text-gray-500 mt-2">
            Manage and track all orders
          </p>
        </div>
        {(currentUser?.role !== 'manufacturer' && currentUser?.role !== 'client') && (
          <Link
            href="/dashboard/orders/create"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Order
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted_to_manufacturer">With Manufacturer</option>
            <option value="submitted_to_client">With Client</option>
            <option value="sample_in_production">Sample Production</option>
            <option value="in_production">In Production</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Results count */}
          <div className="flex items-center justify-end text-gray-600">
            <span className="text-sm font-medium">
              {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} found
            </span>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="grid gap-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg border p-12 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">No orders found</p>
            <p className="text-gray-400 text-sm mt-1">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your filters'
                : 'Create your first order to get started'}
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-lg border p-6 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  {/* Status Icon */}
                  <div className="hidden md:block">
                    {getStatusIcon(order.status as any)}
                  </div>

                  {/* Order Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {order.status === 'draft' ? (
                          <>
                            <span className="text-gray-500">DRAFT - </span>
                            {order.order_name || order.order_number}
                          </>
                        ) : (
                          order.order_number
                        )}
                      </h3>
                      <OrderStatusBadge status={order.status as any} />
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Client:</span>
                        <span>{order.client?.name}</span>
                      </div>
                      <span className="text-gray-400">•</span>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Manufacturer:</span>
                        <span>{order.manufacturer?.name}</span>
                      </div>
                      <span className="text-gray-400">•</span>
                      <span>{getProductsSummary(order.products)}</span>
                      <span className="text-gray-400">•</span>
                      <span>{new Date(order.created_at).toLocaleDateString()}</span>
                    </div>

                    {/* Products with locked status */}
                    {order.products && order.products.some(p => p.is_locked) && (
                      <div className="mt-3 flex items-center gap-2 text-xs">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full">
                          <Lock className="w-3 h-3" />
                          <span className="font-medium">
                            {order.products.filter(p => p.is_locked).length} product(s) locked for production
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {canEditOrder(order) && order.status === 'draft' && (
                    <Link
                      href={`/dashboard/orders/edit/${order.id}`}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Order"
                    >
                      <Edit className="w-5 h-5" />
                    </Link>
                  )}
                  {canDeleteOrder() && (
                    <button
                      onClick={() => setDeleteConfirm(order)}
                      disabled={processingId === order.id}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete Order"
                    >
                      {processingId === order.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Trash2 className="w-5 h-5" />
                      )}
                    </button>
                  )}
                  {/* Only show View button for non-draft orders */}
                  {order.status !== 'draft' && (
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="flex items-center gap-1 px-3 py-2 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                      title="View Order"
                    >
                      <Eye className="w-5 h-5" />
                      <span className="text-sm">View</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Order?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700 mb-2">
                You are about to permanently delete:
              </p>
              <div className="space-y-1">
                <p className="font-semibold text-gray-900">{deleteConfirm.order_number}</p>
                <p className="text-sm text-gray-600">Client: {deleteConfirm.client?.name}</p>
                <p className="text-sm text-gray-600">Manufacturer: {deleteConfirm.manufacturer?.name}</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              All products, items, and media associated with this order will be permanently removed.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={processingId === deleteConfirm.id}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteOrder}
                disabled={processingId === deleteConfirm.id}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processingId === deleteConfirm.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Order
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}