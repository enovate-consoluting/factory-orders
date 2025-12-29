'use client';

/**
 * Sales Summary Report - /dashboard/reports/sales
 * Revenue, orders, and payment analytics
 * Roles: Super Admin only
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  FileText,
  Users,
  Calendar,
  Filter,
  ChevronDown,
  ChevronRight,
  Loader2,
  CreditCard,
  Clock,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface MonthlyStat {
  month: string;
  monthLabel: string;
  orders: number;
  revenue: number;
  collected: number;
  outstanding: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  paid_amount: number;
  status: string;
  due_date: string;
  created_at: string;
  order?: { order_number: string; order_name: string };
  client?: { name: string };
}

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function SalesSummaryReport() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [dateRange, setDateRange] = useState<'ytd' | '1y' | '6m' | '3m' | 'all'>('ytd');
  const [showFilters, setShowFilters] = useState(true);

  // Data states
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalCollected: 0,
    totalOutstanding: 0,
    overdueAmount: 0,
    overdueCount: 0,
    avgOrderValue: 0,
    collectionRate: 0
  });
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [topClients, setTopClients] = useState<{ name: string; revenue: number; orders: number }[]>([]);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'super_admin') {
      router.push('/dashboard');
      return;
    }
    setUser(parsedUser);
    fetchSalesData();
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchSalesData();
    }
  }, [dateRange]);

  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;

    switch (dateRange) {
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case '6m':
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '3m':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        return null;
    }

    return { start: startDate.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
  };

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      const dateFilter = getDateRange();

      // Fetch orders
      let ordersQuery = supabase
        .from('orders')
        .select('id, created_at, client_id, order_number');

      if (dateFilter) {
        ordersQuery = ordersQuery.gte('created_at', dateFilter.start);
      }

      const { data: orders } = await ordersQuery;

      // Fetch invoices with client and order info
      let invoicesQuery = supabase
        .from('invoices')
        .select(`
          id, invoice_number, amount, paid_amount, status, due_date, created_at, client_id,
          order:orders(order_number, order_name),
          client:clients(name)
        `)
        .or('voided.is.null,voided.eq.false');

      if (dateFilter) {
        invoicesQuery = invoicesQuery.gte('created_at', dateFilter.start);
      }

      const { data: invoices } = await invoicesQuery;

      // Fetch clients for top clients
      const { data: clients } = await supabase.from('clients').select('id, name');

      const clientMap: Record<string, string> = {};
      (clients || []).forEach(c => { clientMap[c.id] = c.name; });

      // Calculate monthly stats
      const monthlyMap: Record<string, MonthlyStat> = {};
      const now = new Date();

      // Initialize months
      const monthsToShow = dateRange === 'all' ? 24 : dateRange === '1y' || dateRange === 'ytd' ? 12 : dateRange === '6m' ? 6 : 3;
      for (let i = monthsToShow - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        monthlyMap[monthKey] = { month: monthKey, monthLabel, orders: 0, revenue: 0, collected: 0, outstanding: 0 };
      }

      // Count orders by month
      (orders || []).forEach(order => {
        const date = new Date(order.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyMap[monthKey]) {
          monthlyMap[monthKey].orders++;
        }
      });

      // Calculate invoice stats by month
      let totalRevenue = 0;
      let totalCollected = 0;
      let totalOutstanding = 0;
      let overdueAmount = 0;
      let overdueCount = 0;
      const today = new Date();

      const clientRevenue: Record<string, { name: string; revenue: number; orders: number }> = {};

      (invoices || []).forEach((inv: any) => {
        const amount = parseFloat(inv.amount || 0);
        const paidAmount = parseFloat(inv.paid_amount || 0);
        const date = new Date(inv.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        totalRevenue += amount;

        if (inv.status === 'paid') {
          totalCollected += paidAmount || amount;
          if (monthlyMap[monthKey]) {
            monthlyMap[monthKey].collected += paidAmount || amount;
          }
        } else if (inv.status === 'sent') {
          totalOutstanding += amount;
          if (monthlyMap[monthKey]) {
            monthlyMap[monthKey].outstanding += amount;
          }

          // Check if overdue
          if (inv.due_date && new Date(inv.due_date) < today) {
            overdueAmount += amount;
            overdueCount++;
          }
        }

        if (monthlyMap[monthKey]) {
          monthlyMap[monthKey].revenue += amount;
        }

        // Track client revenue
        const clientName = inv.client?.name || 'Unknown';
        const clientId = inv.client_id || 'unknown';
        if (!clientRevenue[clientId]) {
          clientRevenue[clientId] = { name: clientName, revenue: 0, orders: 0 };
        }
        clientRevenue[clientId].revenue += amount;
        clientRevenue[clientId].orders++;
      });

      // Convert monthly map to array
      const monthlyArray = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
      setMonthlyStats(monthlyArray);

      // Calculate totals
      const totalOrders = orders?.length || 0;
      setTotalStats({
        totalOrders,
        totalRevenue,
        totalCollected,
        totalOutstanding,
        overdueAmount,
        overdueCount,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        collectionRate: totalRevenue > 0 ? (totalCollected / totalRevenue) * 100 : 0
      });

      // Top clients
      const sortedClients = Object.values(clientRevenue)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      setTopClients(sortedClients);

      // Recent invoices (last 10)
      const recent = (invoices || [])
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)
        .map((inv: any) => ({
          ...inv,
          order: Array.isArray(inv.order) ? inv.order[0] : inv.order,
          client: Array.isArray(inv.client) ? inv.client[0] : inv.client
        }));
      setRecentInvoices(recent);

    } catch (error) {
      console.error('Error fetching sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  const maxRevenue = Math.max(...monthlyStats.map(m => m.revenue), 1);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/reports"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Sales Summary</h1>
              <p className="text-sm text-gray-500">Revenue, orders, and payment analytics</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Time Period:</span>
            {[
              { value: 'ytd', label: 'Year to Date' },
              { value: '1y', label: 'Last 12 Months' },
              { value: '6m', label: 'Last 6 Months' },
              { value: '3m', label: 'Last 3 Months' },
              { value: 'all', label: 'All Time' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setDateRange(option.value as any)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  dateRange === option.value
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-green-500" />
                  <span className="text-xs text-gray-500">Total Revenue</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">${formatCurrency(totalStats.totalRevenue)}</p>
                <p className="text-xs text-gray-500 mt-1">{totalStats.totalOrders} orders</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-xs text-gray-500">Collected</span>
                </div>
                <p className="text-2xl font-bold text-green-600">${formatCurrency(totalStats.totalCollected)}</p>
                <p className="text-xs text-green-600 mt-1">{totalStats.collectionRate.toFixed(1)}% collection rate</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <span className="text-xs text-gray-500">Outstanding</span>
                </div>
                <p className="text-2xl font-bold text-amber-600">${formatCurrency(totalStats.totalOutstanding)}</p>
                <p className="text-xs text-gray-500 mt-1">Awaiting payment</p>
              </div>

              <div className={`bg-white rounded-xl border p-4 ${totalStats.overdueCount > 0 ? 'border-red-200' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className={`w-5 h-5 ${totalStats.overdueCount > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                  <span className="text-xs text-gray-500">Overdue</span>
                </div>
                <p className={`text-2xl font-bold ${totalStats.overdueCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  ${formatCurrency(totalStats.overdueAmount)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{totalStats.overdueCount} invoice{totalStats.overdueCount !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* Additional Stats Row */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart className="w-5 h-5 text-blue-500" />
                  <span className="text-xs text-gray-500">Average Order Value</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">${formatCurrency(totalStats.avgOrderValue)}</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-indigo-500" />
                  <span className="text-xs text-gray-500">Orders This Period</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{totalStats.totalOrders}</p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Monthly Revenue Chart */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Monthly Revenue</h3>
                <div className="h-48 flex items-end gap-1">
                  {monthlyStats.map((month, index) => (
                    <div key={month.month} className="flex-1 flex flex-col items-center">
                      <div className="w-full flex flex-col items-center justify-end h-40">
                        <div
                          className="w-full bg-green-500 rounded-t transition-all hover:bg-green-600"
                          style={{ height: `${(month.revenue / maxRevenue) * 100}%`, minHeight: month.revenue > 0 ? '4px' : '0' }}
                          title={`$${formatCurrency(month.revenue)}`}
                        />
                      </div>
                      <p className="text-[9px] text-gray-500 mt-1 truncate w-full text-center">{month.monthLabel}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Clients */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Top Clients by Revenue</h3>
                {topClients.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">No data yet</div>
                ) : (
                  <div className="space-y-3">
                    {topClients.map((client, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-xs font-bold text-gray-500">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{client.name}</p>
                          <p className="text-xs text-gray-500">{client.orders} invoice{client.orders !== 1 ? 's' : ''}</p>
                        </div>
                        <span className="text-sm font-bold text-green-600">${formatCurrency(client.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Collection Progress */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">Collection Progress</h3>
              <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-green-500 transition-all"
                  style={{ width: `${totalStats.collectionRate}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-sm font-medium">
                  <span className={totalStats.collectionRate > 50 ? 'text-white' : 'text-gray-700'}>
                    {totalStats.collectionRate.toFixed(1)}% Collected
                  </span>
                </div>
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>Collected: ${formatCurrency(totalStats.totalCollected)}</span>
                <span>Outstanding: ${formatCurrency(totalStats.totalOutstanding)}</span>
              </div>
            </div>

            {/* Recent Invoices */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-900">Recent Invoices</h3>
                </div>
                <Link href="/dashboard/invoices" className="text-xs text-blue-600 hover:text-blue-700">
                  View All
                </Link>
              </div>
              <div className="divide-y divide-gray-100">
                {recentInvoices.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">No invoices found</div>
                ) : (
                  recentInvoices.map((invoice: any) => (
                    <div key={invoice.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{invoice.invoice_number}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {invoice.client?.name || 'Unknown'} • {invoice.order?.order_number || ''}
                        </p>
                      </div>
                      <div className="text-right ml-3">
                        <p className="text-sm font-semibold text-gray-900">${formatCurrency(parseFloat(invoice.amount || 0))}</p>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                          invoice.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {invoice.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
