'use client';

/**
 * Deleted Items Report - /dashboard/reports/deleted
 * View all soft-deleted products and orders for accountability
 * Roles: Super Admin, Admin only
 * Last Modified: January 2025
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Search,
  Filter,
  Trash2,
  Package,
  ExternalLink,
  RefreshCw,
  Calendar,
  User,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';

interface DeletedProduct {
  id: string;
  product_order_number: string;
  description: string;
  deleted_at: string;
  deleted_by: string;
  deleted_by_name: string;
  deletion_reason: string;
  order_id: string;
  orders: {
    order_number: string;
    clients: {
      name: string;
    } | null;
  } | null;
}

export default function DeletedItemsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [deletedProducts, setDeletedProducts] = useState<DeletedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deletedByFilter, setDeletedByFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  // Expanded entries
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }
    const parsed = JSON.parse(userData);
    // Only system_admin can access deleted items report
    if (parsed.role !== 'system_admin') {
      router.push('/dashboard/reports');
      return;
    }
    setUser(parsed);
    fetchDeletedItems();
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchDeletedItems();
    }
  }, [page, dateFrom, dateTo, deletedByFilter]);

  const fetchDeletedItems = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('order_products')
        .select(`
          id,
          product_order_number,
          description,
          deleted_at,
          deleted_by,
          deleted_by_name,
          deletion_reason,
          order_id,
          orders(
            order_number,
            clients(name)
          )
        `, { count: 'exact' })
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      // Apply filters
      if (dateFrom) {
        query = query.gte('deleted_at', `${dateFrom}T00:00:00`);
      }
      if (dateTo) {
        query = query.lte('deleted_at', `${dateTo}T23:59:59`);
      }
      if (deletedByFilter) {
        query = query.ilike('deleted_by_name', `%${deletedByFilter}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      // Transform the nested data structure
      const transformed = (data || []).map((item: any) => ({
        ...item,
        orders: item.orders ? {
          order_number: item.orders.order_number,
          clients: item.orders.clients || null
        } : null
      })) as DeletedProduct[];

      setDeletedProducts(transformed);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching deleted items:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDeletedItems();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setDeletedByFilter('');
    setPage(1);
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedEntries(newExpanded);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  // Filter entries by search query (client-side)
  const filteredProducts = deletedProducts.filter(product => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.product_order_number?.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query) ||
      product.orders?.order_number?.toLowerCase().includes(query) ||
      product.orders?.clients?.name?.toLowerCase().includes(query) ||
      product.deleted_by_name?.toLowerCase().includes(query) ||
      product.deletion_reason?.toLowerCase().includes(query)
    );
  });

  const totalPages = Math.ceil(totalCount / pageSize);
  const hasActiveFilters = dateFrom || dateTo || deletedByFilter;

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Deleted Items</h1>
                <p className="text-sm text-gray-500">{totalCount} deleted item{totalCount !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
          <div className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by product, order, client, or reason..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                  showFilters || hasActiveFilters
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {hasActiveFilters && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
              </button>
            </div>

            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Filter Options</span>
                  {hasActiveFilters && (
                    <button onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-700">
                      Clear all
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="From"
                  />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="To"
                  />
                  <input
                    type="text"
                    value={deletedByFilter}
                    onChange={(e) => { setDeletedByFilter(e.target.value); setPage(1); }}
                    placeholder="Deleted by..."
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Trash2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <h3 className="font-medium text-gray-900 mb-1">No deleted items found</h3>
            <p className="text-sm text-gray-500">
              {hasActiveFilters || searchQuery ? 'Try adjusting your filters' : 'Deleted items will appear here'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {filteredProducts.map((product) => {
                const isExpanded = expandedEntries.has(product.id);

                return (
                  <div
                    key={product.id}
                    className="rounded-xl border border-red-200 bg-red-50 overflow-hidden"
                  >
                    <div
                      className="p-4 cursor-pointer hover:bg-red-100/50 transition-colors"
                      onClick={() => toggleExpanded(product.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-semibold text-gray-900">
                                {product.product_order_number}
                              </span>
                              <span className="text-gray-500 mx-2">-</span>
                              <span className="text-gray-700">
                                {product.description || 'No description'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500 flex-shrink-0">
                              <span title={formatDate(product.deleted_at)}>
                                {formatRelativeTime(product.deleted_at)}
                              </span>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                            <span className="px-2 py-0.5 bg-white/80 rounded text-gray-600 flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              Order {product.orders?.order_number}
                            </span>
                            <span className="text-gray-500">
                              {product.orders?.clients?.name}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-red-200/50 bg-white/30">
                        <div className="pt-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-3">
                            <div>
                              <span className="text-gray-500 block text-xs flex items-center gap-1">
                                <User className="w-3 h-3" />
                                Deleted By
                              </span>
                              <span className="text-gray-900 font-medium">
                                {product.deleted_by_name || 'Unknown'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-xs flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Deleted At
                              </span>
                              <span className="text-gray-700">
                                {formatDate(product.deleted_at)}
                              </span>
                            </div>
                            <div className="sm:col-span-2">
                              <span className="text-gray-500 block text-xs">Reason</span>
                              <span className="text-gray-700">
                                {product.deletion_reason || 'No reason provided'}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Link
                              href={`/dashboard/orders/${product.order_id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3" />
                              View Order
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Trash2 className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-900">About Deleted Items</h4>
              <p className="text-sm text-amber-700 mt-1">
                Deleted items are soft-deleted and kept for audit purposes. They are hidden from normal views
                but can be recovered if needed. Contact support if you need to restore a deleted item.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
