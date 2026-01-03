'use client'

/**
 * Dashboard Page - /dashboard
 * Role-based dashboard with stats, charts, and recent activity
 * Roles: Super Admin, Admin (full stats), Client (limited), Manufacturer (basic)
 * Mobile responsive
 * Last Modified: December 2024
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  Package, FileText, Clock, CheckCircle, 
  AlertCircle, Calendar, ExternalLink, Loader2,
  ShoppingCart, DollarSign, Users, TrendingUp,
  Truck, Play, ArrowUpRight, Activity, Box
} from 'lucide-react';

// Format currency helper
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Get week label (e.g., "Dec 9")
const getWeekLabel = (weeksAgo: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - (weeksAgo * 7));
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  
  // Client dashboard states
  const [clientStats, setClientStats] = useState({
    pendingProducts: 0,
    approvedProducts: 0,
    totalOrders: 0,
    pendingInvoices: 0
  });
  const [clientName, setClientName] = useState('');
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  // Admin dashboard states
  const [adminStats, setAdminStats] = useState({
    totalOrders: 0,
    activeOrders: 0,
    outstandingInvoices: 0,
    outstandingAmount: 0,
    revenueCollected: 0,
    productsInProduction: 0,
    samplesInProduction: 0,
    shippedThisMonth: 0,
    totalClients: 0,
    overdueInvoices: 0,
    overdueAmount: 0,
    activeProducts: 0,
    activeSamples: 0
  });
  const [weeklyOrders, setWeeklyOrders] = useState<{ week: string; count: number; orders: { id: string; order_number: string; order_name: string }[] }[]>([]);
  const [topClients, setTopClients] = useState<{ name: string; orderCount: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; count: number }[]>([]);
  const [recentAdminOrders, setRecentAdminOrders] = useState<any[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [overdueInvoicesList, setOverdueInvoicesList] = useState<any[]>([]);
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }
    
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    setUserRole(parsedUser.role);
    
    if (parsedUser.role === 'client') {
      fetchClientDashboard(parsedUser);
    } else if (parsedUser.role === 'super_admin' || parsedUser.role === 'admin') {
      fetchAdminDashboard(parsedUser);
    } else {
      setLoading(false);
    }
  }, [router]);

  // ============ CLIENT DASHBOARD ============
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
      console.error('Error fetching client dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============ ADMIN DASHBOARD ============
  const fetchAdminDashboard = async (user: any) => {
    try {
      // Fetch all stats in parallel
      const [
        ordersResult,
        invoicesResult,
        clientsResult,
        productsResult,
        orderProductsResult
      ] = await Promise.all([
        supabase.from('orders').select('id, status, workflow_status, created_at, client_id, order_number, order_name, sample_status'),
        supabase.from('invoices').select('id, status, amount, paid_amount, due_date, invoice_number, created_at, voided, order_id, order:orders(order_number, order_name)').or('voided.is.null,voided.eq.false'),
        supabase.from('clients').select('id, name'),
        supabase.from('order_products').select('id, product_status, shipped_date').is('deleted_at', null).in('product_status', ['approved_for_production', 'in_production', 'shipped']),
        supabase.from('order_products').select('id, description, product_status, product:products(title)').is('deleted_at', null)
      ]);

      const orders = ordersResult.data || [];
      const invoices = invoicesResult.data || [];
      const clients = clientsResult.data || [];
      const products = productsResult.data || [];
      const allOrderProducts = orderProductsResult.data || [];

      // Calculate stats
      const totalOrders = orders.length;
      const activeOrders = orders.filter(o =>
        o.workflow_status !== 'completed' && o.workflow_status !== 'cancelled'
      ).length;

      const sentInvoices = invoices.filter(i => i.status === 'sent');
      const paidInvoices = invoices.filter(i => i.status === 'paid');

      const outstandingAmount = sentInvoices.reduce((sum, i) =>
        sum + parseFloat(i.amount || 0), 0
      );

      const revenueCollected = paidInvoices.reduce((sum, i) =>
        sum + parseFloat(i.paid_amount || i.amount || 0), 0
      );

      // Overdue invoices
      const today = new Date();
      const overdueInvoices = sentInvoices.filter(i =>
        i.due_date && new Date(i.due_date) < today
      );
      const overdueAmount = overdueInvoices.reduce((sum, i) =>
        sum + parseFloat(i.amount || 0), 0
      );

      // Store overdue invoices for tooltip
      setOverdueInvoicesList(overdueInvoices.map(i => ({
        invoice_number: i.invoice_number,
        order_id: (i as any).order_id || '',
        order_number: (i as any).order?.order_number || '',
        order_name: (i as any).order?.order_name || '',
        amount: parseFloat(i.amount || 0),
        due_date: i.due_date
      })));

      // Products stats - include samples
      const productsInProduction = products.filter(p =>
        p.product_status === 'approved_for_production' || p.product_status === 'in_production'
      ).length;

      // Samples in production (approved or in_production)
      const samplesInProduction = orders.filter(o =>
        o.sample_status === 'sample_approved' ||
        o.sample_status === 'approved' ||
        o.sample_status === 'sample_in_production' ||
        o.sample_status === 'in_production'
      ).length;

      // Active products (not shipped/completed)
      const activeProducts = allOrderProducts.filter((p: any) =>
        p.product_status &&
        p.product_status !== 'shipped' &&
        p.product_status !== 'completed'
      ).length;

      // Active samples (any sample that's not shipped)
      const activeSamples = orders.filter(o =>
        o.sample_status &&
        o.sample_status !== 'shipped' &&
        o.sample_status !== 'none' &&
        o.sample_status !== ''
      ).length;

      // Shipped this month
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const shippedThisMonth = products.filter(p =>
        p.product_status === 'shipped' &&
        p.shipped_date &&
        new Date(p.shipped_date) >= startOfMonth
      ).length;

      setAdminStats({
        totalOrders,
        activeOrders,
        outstandingInvoices: sentInvoices.length,
        outstandingAmount,
        revenueCollected,
        productsInProduction: productsInProduction + samplesInProduction,
        samplesInProduction,
        shippedThisMonth,
        totalClients: clients.length,
        overdueInvoices: overdueInvoices.length,
        overdueAmount,
        activeProducts,
        activeSamples
      });

      // Weekly orders (last 8 weeks) - include order details for tooltip
      const weeklyData: { week: string; count: number; orders: { id: string; order_number: string; order_name: string }[] }[] = [];
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (i * 7) - 6);
        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() - (i * 7));

        const weekOrders = orders.filter(o => {
          const created = new Date(o.created_at);
          return created >= weekStart && created <= weekEnd;
        });

        weeklyData.push({
          week: getWeekLabel(i),
          count: weekOrders.length,
          orders: weekOrders.slice(0, 10).map(o => ({
            id: o.id,
            order_number: o.order_number,
            order_name: o.order_name || ''
          }))
        });
      }
      setWeeklyOrders(weeklyData);

      // Top 5 clients by order count
      const clientOrderCounts: Record<string, { name: string; count: number }> = {};
      orders.forEach(order => {
        if (order.client_id) {
          const client = clients.find(c => c.id === order.client_id);
          if (client) {
            if (!clientOrderCounts[client.id]) {
              clientOrderCounts[client.id] = { name: client.name, count: 0 };
            }
            clientOrderCounts[client.id].count++;
          }
        }
      });
      
      const sortedClients = Object.values(clientOrderCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(c => ({ name: c.name, orderCount: c.count }));
      setTopClients(sortedClients);

      // Top 10 products
      const productCounts: Record<string, { name: string; count: number }> = {};
      allOrderProducts.forEach((op: any) => {
        const productName = op.product?.title || op.description || 'Unknown Product';
        if (!productCounts[productName]) {
          productCounts[productName] = { name: productName, count: 0 };
        }
        productCounts[productName].count++;
      });

      const sortedProducts = Object.values(productCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      setTopProducts(sortedProducts);

      // Recent orders (last 5)
      const recentOrders = orders
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map(order => ({
          ...order,
          client_name: clients.find(c => c.id === order.client_id)?.name || 'Unknown'
        }));
      setRecentAdminOrders(recentOrders);

      // Recent invoices (last 5) - exclude drafts
      const recentInvs = invoices
        .filter(i => i.status === 'sent' || i.status === 'paid')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
      setRecentInvoices(recentInvs);

    } catch (error) {
      console.error('Error fetching admin dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  // ============ CLIENT DASHBOARD RENDER ============
  if (userRole === 'client') {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Welcome back, {clientName}
            </h1>
            <p className="text-sm text-gray-500 mt-1">Here's what needs your attention</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className={`bg-white rounded-xl shadow-sm p-4 ${clientStats.pendingProducts > 0 ? 'ring-2 ring-amber-400' : 'border border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-5 h-5 text-amber-500" />
                {clientStats.pendingProducts > 0 && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
                    ACTION
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">Awaiting Approval</p>
              <p className="text-2xl font-bold text-gray-900">{clientStats.pendingProducts}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <CheckCircle className="w-5 h-5 text-green-500 mb-2" />
              <p className="text-xs text-gray-500">Approved</p>
              <p className="text-2xl font-bold text-gray-900">{clientStats.approvedProducts}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <Package className="w-5 h-5 text-blue-500 mb-2" />
              <p className="text-xs text-gray-500">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{clientStats.totalOrders}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <FileText className="w-5 h-5 text-purple-500 mb-2" />
              <p className="text-xs text-gray-500">Pending Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{clientStats.pendingInvoices}</p>
            </div>
          </div>

          {/* Orders Needing Attention */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <h2 className="font-semibold text-gray-900">Orders Needing Attention</h2>
            </div>
            
            <div className="p-4">
              {recentOrders.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No orders need your attention</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentOrders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/dashboard/orders/client`}
                      className="block p-3 bg-gray-50 rounded-lg hover:bg-amber-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-gray-900 truncate">
                            {order.order_name || 'Order'} - {order.order_number}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">
                              {new Date(order.created_at).toLocaleDateString()}
                            </span>
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                              {order.pending_count} pending
                            </span>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ ADMIN/SUPER ADMIN DASHBOARD RENDER ============
  if (userRole === 'super_admin' || userRole === 'admin') {
    // Calculate Y-axis scale for weekly chart
    const maxWeeklyCount = Math.max(...weeklyOrders.map(w => w.count), 1);
    const yAxisMax = Math.ceil(maxWeeklyCount / 5) * 5 + 5; // Round up to nearest 5, add buffer
    const yAxisSteps = [0, Math.round(yAxisMax / 4), Math.round(yAxisMax / 2), Math.round(yAxisMax * 3 / 4), yAxisMax];

    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Welcome back, {user?.name || 'Admin'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          {/* Primary Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
            {/* Total Orders */}
            <Link href="/dashboard/orders" className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <ShoppingCart className="w-5 h-5 text-blue-500" />
                <ArrowUpRight className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{adminStats.totalOrders}</p>
              <p className="text-xs text-blue-600 mt-1">{adminStats.activeOrders} active</p>
            </Link>

            {/* Outstanding */}
            <Link href="/dashboard/invoices" className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <FileText className="w-5 h-5 text-amber-500" />
                <ArrowUpRight className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500">Outstanding</p>
              <p className="text-2xl font-bold text-amber-600">${formatCurrency(adminStats.outstandingAmount)}</p>
              <p className="text-xs text-amber-600 mt-1">{adminStats.outstandingInvoices} invoices</p>
            </Link>

            {/* Revenue */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-green-500" />
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-xs text-gray-500">Revenue Collected</p>
              <p className="text-2xl font-bold text-green-600">${formatCurrency(adminStats.revenueCollected)}</p>
              <p className="text-xs text-gray-500 mt-1">All time</p>
            </div>

            {/* Clients */}
            <Link href="/dashboard/clients" className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-5 h-5 text-purple-500" />
                <ArrowUpRight className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500">Total Clients</p>
              <p className="text-2xl font-bold text-gray-900">{adminStats.totalClients}</p>
            </Link>
          </div>

          {/* Secondary Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-indigo-500" />
                <div>
                  <p className="text-xs text-gray-500">In Production</p>
                  <p className="text-lg font-bold text-gray-900">{adminStats.productsInProduction}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-cyan-500" />
                <div>
                  <p className="text-xs text-gray-500">Shipped (Month)</p>
                  <p className="text-lg font-bold text-gray-900">{adminStats.shippedThisMonth}</p>
                </div>
              </div>
            </div>

            <div className={`bg-white rounded-lg shadow-sm border p-3 relative group ${adminStats.overdueInvoices > 0 ? 'border-red-300' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <AlertCircle className={`w-4 h-4 ${adminStats.overdueInvoices > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                <div>
                  <p className="text-xs text-gray-500">Overdue</p>
                  <p className={`text-lg font-bold ${adminStats.overdueInvoices > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {adminStats.overdueInvoices}
                  </p>
                </div>
              </div>
              {/* Overdue Tooltip */}
              {overdueInvoicesList.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-80">
                  <div className="bg-white text-gray-900 text-xs rounded-xl p-3 shadow-xl border border-gray-200">
                    <p className="font-semibold mb-2 text-gray-700">Overdue Invoices:</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {overdueInvoicesList.slice(0, 8).map((inv: any, idx) => (
                        <Link
                          key={idx}
                          href={inv.order_id ? `/dashboard/orders/${inv.order_id}` : '#'}
                          className="flex justify-between gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-gray-900">{inv.invoice_number}</span>
                            {inv.order_number && (
                              <span className="text-gray-500 ml-1">• {inv.order_number}</span>
                            )}
                          </div>
                          <span className="text-red-600 font-semibold flex-shrink-0">${formatCurrency(inv.amount)}</span>
                        </Link>
                      ))}
                      {overdueInvoicesList.length > 8 && (
                        <p className="text-gray-400 text-center pt-1">+{overdueInvoicesList.length - 8} more</p>
                      )}
                    </div>
                    <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-white border-r border-b border-gray-200 rotate-45"></div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-orange-500" />
                <div>
                  <p className="text-xs text-gray-500">Active Products</p>
                  <p className="text-lg font-bold text-gray-900">
                    {adminStats.activeProducts} <span className="text-sm font-normal text-gray-500">/ {adminStats.activeSamples} samples</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Weekly Orders Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 text-sm">Weekly Orders</h3>
                <span className="text-xs text-gray-500">Last 8 weeks</span>
              </div>
              <div className="flex">
                {/* Y-Axis */}
                <div className="flex flex-col justify-between pr-2 text-right h-32 sm:h-40">
                  {yAxisSteps.slice().reverse().map((step, i) => (
                    <span key={i} className="text-[10px] text-gray-400">{step}</span>
                  ))}
                </div>
                {/* Bars */}
                <div className="flex-1 flex items-end justify-between gap-1 sm:gap-2 h-32 sm:h-40 border-l border-b border-gray-200 pl-2 pb-1">
                  {weeklyOrders.map((week, index) => (
                    <div
                      key={index}
                      className="flex-1 flex flex-col items-center justify-end h-full relative group"
                      onMouseEnter={() => setHoveredWeek(index)}
                      onMouseLeave={() => setHoveredWeek(null)}
                    >
                      <div
                        className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600 min-w-[8px] max-w-[40px] cursor-pointer"
                        style={{
                          height: `${Math.max((week.count / yAxisMax) * 100, 2)}%`
                        }}
                      />
                      <p className="text-[8px] sm:text-[10px] text-gray-500 mt-1 truncate w-full text-center">{week.week}</p>
                      {/* Weekly Orders Tooltip */}
                      {hoveredWeek === index && week.count > 0 && (
                        <div className="absolute bottom-full mb-2 z-50 w-72 -left-28">
                          <div className="bg-white text-gray-900 text-xs rounded-xl p-3 shadow-xl border border-gray-200">
                            <p className="font-semibold mb-2 text-gray-700">Week of {week.week} ({week.count} orders)</p>
                            <div className="space-y-0.5 max-h-40 overflow-y-auto">
                              {week.orders.map((o, idx) => (
                                <Link
                                  key={idx}
                                  href={`/dashboard/orders/${o.id}`}
                                  className="block p-1.5 rounded-lg hover:bg-gray-100 transition-colors truncate"
                                >
                                  <span className="font-medium text-gray-900">{o.order_number}</span>
                                  {o.order_name && <span className="text-gray-500 ml-1">- {o.order_name}</span>}
                                </Link>
                              ))}
                              {week.count > 10 && (
                                <p className="text-gray-400 text-center pt-1">+{week.count - 10} more</p>
                              )}
                            </div>
                            <div className="absolute -bottom-1.5 left-1/2 -ml-1.5 w-3 h-3 bg-white border-r border-b border-gray-200 rotate-45"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Clients */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 text-sm">Top Clients</h3>
                <span className="text-xs text-gray-500">By orders</span>
              </div>
              {topClients.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-sm">No data yet</div>
              ) : (
                <div className="space-y-3">
                  {topClients.map((client, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 w-4">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{client.name}</p>
                      </div>
                      <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {client.orderCount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row - 3 columns on large screens */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Products */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <Box className="w-4 h-4 text-indigo-500" />
                <h3 className="font-semibold text-gray-900 text-sm">Top Products</h3>
              </div>
              <div className="p-4">
                {topProducts.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">No data yet</div>
                ) : (
                  <div className="space-y-2">
                    {topProducts.map((product, index) => (
                      <div key={index} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-xs font-bold text-gray-400">{index + 1}</span>
                          <p className="text-sm text-gray-700 truncate">{product.name}</p>
                        </div>
                        <span className="text-xs font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded ml-2">
                          {product.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-blue-500" />
                  <h3 className="font-semibold text-gray-900 text-sm">Recent Orders</h3>
                </div>
                <Link href="/dashboard/orders" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                  View All
                </Link>
              </div>
              <div className="divide-y divide-gray-100">
                {recentAdminOrders.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">No orders yet</div>
                ) : (
                  recentAdminOrders.map((order) => (
                    <Link 
                      key={order.id} 
                      href={`/dashboard/orders/${order.id}`}
                      className="p-3 hover:bg-gray-50 transition-colors flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {order.order_name || order.order_number}
                        </p>
                        <p className="text-xs text-gray-500">
                          {order.client_name}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 ml-2">
                        {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Recent Invoices */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-green-500" />
                  <h3 className="font-semibold text-gray-900 text-sm">Recent Invoices</h3>
                </div>
                <Link href="/dashboard/invoices" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                  View All
                </Link>
              </div>
              <div className="divide-y divide-gray-100">
                {recentInvoices.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">No invoices yet</div>
                ) : (
                  recentInvoices.map((invoice) => (
                    <div key={invoice.id} className="p-3 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{invoice.invoice_number}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(invoice.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="text-sm font-semibold text-gray-900">
                          ${formatCurrency(parseFloat(invoice.amount || 0))}
                        </p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          invoice.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {invoice.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ OTHER ROLES - Basic Dashboard ============
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome, {user?.name || 'User'}</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Welcome!</h2>
          <p className="text-sm text-gray-600">
            Use the navigation menu to get started.
          </p>
        </div>
      </div>
    </div>
  );
}