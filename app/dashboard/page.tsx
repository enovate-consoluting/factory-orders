'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  Package, FileText, Clock, CheckCircle, 
  AlertCircle, Calendar, ExternalLink, Loader2
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [clientStats, setClientStats] = useState({
    pendingProducts: 0,
    approvedProducts: 0,
    totalOrders: 0,
    pendingInvoices: 0
  });
  const [clientName, setClientName] = useState('');
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }
    
    const user = JSON.parse(userData);
    setUserRole(user.role);
    
    if (user.role === 'client') {
      fetchClientDashboard(user);
    } else {
      setLoading(false);
    }
  }, [router]);

  const fetchClientDashboard = async (user: any) => {
    try {
      const { data: clientData } = await supabase
        .from('clients')
        .select('id, name')
        .eq('email', user.email)
        .single();
      
      if (!clientData) {
        setLoading(false);
        return;
      }
      
      setClientName(clientData.name);
      
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_name,
          created_at,
          order_products(
            id,
            product_status,
            routed_to
          )
        `)
        .eq('client_id', clientData.id)
        .order('created_at', { ascending: false });
      
      if (!orders) {
        setLoading(false);
        return;
      }
      
      let pendingProducts = 0;
      let approvedProducts = 0;
      const ordersWithPending: any[] = [];
      
      orders.forEach(order => {
        const clientProducts = order.order_products?.filter((p: any) => 
          p.routed_to === 'client'
        ) || [];
        
        const pending = clientProducts.filter((p: any) => 
          p.product_status === 'pending_client_approval'
        ).length;
        
        const approved = clientProducts.filter((p: any) => 
          p.product_status === 'client_approved'
        ).length;
        
        pendingProducts += pending;
        approvedProducts += approved;
        
        if (pending > 0) {
          ordersWithPending.push({
            ...order,
            pending_count: pending
          });
        }
      });
      
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('client_id', clientData.id)
        .eq('status', 'sent');
      
      setClientStats({
        pendingProducts,
        approvedProducts,
        totalOrders: orders.length,
        pendingInvoices: invoices?.length || 0
      });
      
      setRecentOrders(ordersWithPending.slice(0, 5));
      
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  // CLIENT DASHBOARD
  if (userRole === 'client') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {clientName}
          </h1>
          <p className="text-gray-600 mt-2">Here's what needs your attention</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg border-2 border-amber-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              {clientStats.pendingProducts > 0 && (
                <span className="px-2 py-1 bg-amber-500 text-white text-xs font-bold rounded-full animate-pulse">
                  ACTION NEEDED
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-1">Awaiting Your Approval</p>
            <p className="text-3xl font-bold text-amber-600">{clientStats.pendingProducts}</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm text-gray-500 mb-1">Approved</p>
            <p className="text-3xl font-bold text-green-600">{clientStats.approvedProducts}</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-sm text-gray-500 mb-1">Total Orders</p>
            <p className="text-3xl font-bold text-blue-600">{clientStats.totalOrders}</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <p className="text-sm text-gray-500 mb-1">Pending Invoices</p>
            <p className="text-3xl font-bold text-purple-600">{clientStats.pendingInvoices}</p>
          </div>
        </div>

        {/* Orders Needing Attention */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-amber-600" />
              Orders Needing Your Attention
            </h2>
          </div>
          
          <div className="p-6">
            {recentOrders.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-gray-500">No orders need your attention right now</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <a
                    key={order.id}
                    href={`/dashboard/orders/${order.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {order.order_name || 'Order'} - {order.order_number}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(order.created_at).toLocaleDateString()}
                          </span>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                            {order.pending_count} pending
                          </span>
                        </div>
                      </div>
                      <ExternalLink className="w-5 h-5 text-gray-400" />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ADMIN/MANUFACTURER DASHBOARD (original)
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-gray-500 text-sm font-medium mb-2">Total Orders</h3>
          <p className="text-3xl font-bold text-gray-900">0</p>
        </div>
        
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-gray-500 text-sm font-medium mb-2">Pending Approval</h3>
          <p className="text-3xl font-bold text-yellow-600">0</p>
        </div>
        
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-gray-500 text-sm font-medium mb-2">Completed</h3>
          <p className="text-3xl font-bold text-green-600">0</p>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Welcome!</h2>
        <p className="text-gray-600">
          Your factory order management system is ready. Use the navigation menu to get started.
        </p>
      </div>
    </div>
  );
}