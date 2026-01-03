'use client';

/**
 * Product Performance Report - /dashboard/reports/products
 * Interactive report showing product analytics with drill-down
 * Roles: Super Admin, Admin
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp,
  ArrowLeft,
  Filter,
  ChevronDown,
  ChevronRight,
  Package,
  DollarSign,
  ShoppingCart,
  Users,
  Calendar,
  Loader2,
  X,
  ExternalLink,
  BarChart3
} from 'lucide-react';

interface ProductSummary {
  product_title: string;
  product_id: string | null;
  count: number;
  total_revenue: number;
  unique_clients: number;
  unique_orders: number;
}

interface ProductDetail {
  id: string;
  description: string;
  order_number: string;
  order_name: string;
  order_id: string;
  client_name: string;
  client_id: string;
  created_at: string;
  quantity: number;
  client_price: number;
  product_status: string;
}

interface Client {
  id: string;
  name: string;
}

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    'pending': 'bg-gray-100 text-gray-700',
    'pending_client_approval': 'bg-amber-100 text-amber-700',
    'client_approved': 'bg-blue-100 text-blue-700',
    'approved_for_production': 'bg-indigo-100 text-indigo-700',
    'in_production': 'bg-purple-100 text-purple-700',
    'shipped': 'bg-green-100 text-green-700',
    'completed': 'bg-green-100 text-green-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
};

const formatStatus = (status: string): string => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export default function ProductPerformanceReport() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);

  // Filter states
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d' | '1y' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(true);

  // Data states
  const [productSummaries, setProductSummaries] = useState<ProductSummary[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [productDetails, setProductDetails] = useState<ProductDetail[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Stats
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);

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
    fetchClients();
    fetchProductData();
  }, [router]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .order('name');
    setClients(data || []);
  };

  const getDateFilter = () => {
    const now = new Date();
    let startDate: Date | null = null;

    switch (dateRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        return { start: customStartDate, end: customEndDate };
      default:
        return null;
    }

    return startDate ? { start: startDate.toISOString().split('T')[0], end: now.toISOString().split('T')[0] } : null;
  };

  const fetchProductData = async () => {
    setLoading(true);
    try {
      // Build query (excluding soft-deleted products)
      let query = supabase
        .from('order_products')
        .select(`
          id,
          description,
          product_id,
          client_product_price,
          product_status,
          created_at,
          product:products(id, title),
          order:orders(id, order_number, order_name, created_at, client_id, client:clients(id, name))
        `)
        .is('deleted_at', null);

      // Apply date filter
      const dateFilter = getDateFilter();
      if (dateFilter) {
        query = query.gte('created_at', dateFilter.start).lte('created_at', dateFilter.end + 'T23:59:59');
      }

      // Apply client filter via order
      if (selectedClient !== 'all') {
        query = query.eq('order.client_id', selectedClient);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching product data:', error);
        setLoading(false);
        return;
      }

      // Filter out null orders (from client filter)
      const filteredData = selectedClient !== 'all'
        ? (data || []).filter((item: any) => item.order !== null)
        : (data || []);

      // Get quantity from order_items
      const orderProductIds = filteredData.map((op: any) => op.id);
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('order_product_id, quantity')
        .in('order_product_id', orderProductIds);

      const quantityMap: Record<string, number> = {};
      (itemsData || []).forEach((item: any) => {
        quantityMap[item.order_product_id] = (quantityMap[item.order_product_id] || 0) + item.quantity;
      });

      // Group by product
      const productMap: Record<string, {
        product_title: string;
        product_id: string | null;
        count: number;
        total_revenue: number;
        clients: Set<string>;
        orders: Set<string>;
      }> = {};

      filteredData.forEach((item: any) => {
        const productTitle = item.product?.title || item.description || 'Unknown Product';
        const productId = item.product?.id || null;
        const key = productTitle;

        if (!productMap[key]) {
          productMap[key] = {
            product_title: productTitle,
            product_id: productId,
            count: 0,
            total_revenue: 0,
            clients: new Set(),
            orders: new Set(),
          };
        }

        const quantity = quantityMap[item.id] || 1;
        const price = parseFloat(item.client_product_price || 0);

        productMap[key].count++;
        productMap[key].total_revenue += price * quantity;
        if (item.order?.client?.id) productMap[key].clients.add(item.order.client.id);
        if (item.order?.id) productMap[key].orders.add(item.order.id);
      });

      // Convert to array and sort
      const summaries: ProductSummary[] = Object.values(productMap)
        .map(p => ({
          product_title: p.product_title,
          product_id: p.product_id,
          count: p.count,
          total_revenue: p.total_revenue,
          unique_clients: p.clients.size,
          unique_orders: p.orders.size,
        }))
        .sort((a, b) => b.count - a.count);

      setProductSummaries(summaries);
      setTotalProducts(summaries.reduce((sum, p) => sum + p.count, 0));
      setTotalRevenue(summaries.reduce((sum, p) => sum + p.total_revenue, 0));
      setTotalOrders(new Set(filteredData.map((item: any) => item.order?.id).filter(Boolean)).size);

    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductDetails = async (productTitle: string) => {
    setDetailsLoading(true);
    setSelectedProduct(productTitle);
    setProductDetails([]);

    try {
      let query = supabase
        .from('order_products')
        .select(`
          id,
          description,
          product_id,
          client_product_price,
          product_status,
          created_at,
          product:products(id, title),
          order:orders(id, order_number, order_name, created_at, client_id, client:clients(id, name))
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      const dateFilter = getDateFilter();
      if (dateFilter) {
        query = query.gte('created_at', dateFilter.start).lte('created_at', dateFilter.end + 'T23:59:59');
      }

      if (selectedClient !== 'all') {
        query = query.eq('order.client_id', selectedClient);
      }

      const { data } = await query;

      // Filter by product title
      const filtered = (data || []).filter((item: any) => {
        const title = item.product?.title || item.description || 'Unknown Product';
        return title === productTitle && (selectedClient === 'all' || item.order !== null);
      });

      // Get quantities
      const orderProductIds = filtered.map((op: any) => op.id);
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('order_product_id, quantity')
        .in('order_product_id', orderProductIds);

      const quantityMap: Record<string, number> = {};
      (itemsData || []).forEach((item: any) => {
        quantityMap[item.order_product_id] = (quantityMap[item.order_product_id] || 0) + item.quantity;
      });

      const details: ProductDetail[] = filtered.map((item: any) => ({
        id: item.id,
        description: item.description || 'No description',
        order_number: item.order?.order_number || '',
        order_name: item.order?.order_name || '',
        order_id: item.order?.id || '',
        client_name: item.order?.client?.name || 'Unknown',
        client_id: item.order?.client?.id || '',
        created_at: item.created_at,
        quantity: quantityMap[item.id] || 1,
        client_price: parseFloat(item.client_product_price || 0),
        product_status: item.product_status || 'pending',
      }));

      setProductDetails(details);
    } catch (error) {
      console.error('Error fetching details:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setSelectedProduct(null);
    setProductDetails([]);
    fetchProductData();
  };

  const handleClearFilters = () => {
    setDateRange('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSelectedClient('all');
    setSelectedProduct(null);
    setProductDetails([]);
    setTimeout(() => fetchProductData(), 0);
  };

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
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Product Performance</h1>
              <p className="text-sm text-gray-500">Analyze product trends, top sellers, and order details</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-900">Filters</span>
              {(dateRange !== 'all' || selectedClient !== 'all') && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  Active
                </span>
              )}
            </div>
            {showFilters ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          </button>

          {showFilters && (
            <div className="px-4 pb-4 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                {/* Date Range */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date Range</label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Time</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                    <option value="1y">Last Year</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>

                {/* Custom Date Range */}
                {dateRange === 'custom' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </>
                )}

                {/* Client Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Client</label>
                  <select
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Clients</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Filter Actions */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={handleApplyFilters}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Apply Filters
                </button>
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 text-gray-600 text-sm font-medium hover:text-gray-900 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-gray-500">Total Products</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-500">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold text-green-600">${formatCurrency(totalRevenue)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500">Orders</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product Summary Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-gray-900">Top Products</h3>
              </div>
              <span className="text-xs text-gray-500">{productSummaries.length} products</span>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              </div>
            ) : productSummaries.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No products found for the selected filters</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {productSummaries.map((product, index) => (
                  <button
                    key={product.product_title}
                    onClick={() => fetchProductDetails(product.product_title)}
                    className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left ${
                      selectedProduct === product.product_title ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-xs font-bold text-gray-500">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{product.product_title}</p>
                        <p className="text-xs text-gray-500">
                          {product.unique_clients} client{product.unique_clients !== 1 ? 's' : ''} • {product.unique_orders} order{product.unique_orders !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <p className="font-bold text-gray-900">{product.count}</p>
                      <p className="text-xs text-green-600">${formatCurrency(product.total_revenue)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 ml-2" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details Panel */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-gray-900">
                  {selectedProduct ? `${selectedProduct} Details` : 'Select a Product'}
                </h3>
              </div>
              {selectedProduct && (
                <button
                  onClick={() => { setSelectedProduct(null); setProductDetails([]); }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            {!selectedProduct ? (
              <div className="p-8 text-center text-gray-500">
                <ChevronRight className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>Click a product to see order details</p>
              </div>
            ) : detailsLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              </div>
            ) : productDetails.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No details found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {productDetails.map((detail) => (
                  <div key={detail.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">{detail.description}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${getStatusColor(detail.product_status)}`}>
                        {formatStatus(detail.product_status)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-2">
                      <div className="flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" />
                        <Link
                          href={`/dashboard/orders/${detail.order_id}`}
                          className="text-blue-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {detail.order_number}
                        </Link>
                        {detail.order_name && <span>- {detail.order_name}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{detail.client_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(detail.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        <span>Qty: {detail.quantity}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <span className="text-sm font-semibold text-green-600">
                        ${formatCurrency(detail.client_price * detail.quantity)}
                      </span>
                      <Link
                        href={`/dashboard/orders/${detail.order_id}`}
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        View Order <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
