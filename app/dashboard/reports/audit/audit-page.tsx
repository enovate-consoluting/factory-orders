'use client';

/**
 * Audit Log Page - /dashboard/reports/audit
 * View all system activity including deletions, changes, and status updates
 * Roles: Super Admin, Admin
 * Last Modified: December 2025
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  ArrowLeft,
  Search,
  Filter,
  Calendar,
  User,
  Package,
  FileText,
  Trash2,
  Edit,
  Send,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  Download,
  X,
} from 'lucide-react';

interface AuditEntry {
  id: string;
  order_id: string;
  user_id: string;
  user_name: string;
  action_type: string;
  target_type: string;
  target_id: string;
  old_value: any;
  new_value: any;
  created_at: string;
  order?: {
    order_number: string;
  };
}

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'product_deleted', label: 'Product Deleted' },
  { value: 'product_added', label: 'Product Added' },
  { value: 'product_updated', label: 'Product Updated' },
  { value: 'status_changed', label: 'Status Changed' },
  { value: 'routed', label: 'Routed' },
  { value: 'price_updated', label: 'Price Updated' },
  { value: 'order_created', label: 'Order Created' },
  { value: 'order_deleted', label: 'Order Deleted' },
  { value: 'invoice_created', label: 'Invoice Created' },
  { value: 'invoice_sent', label: 'Invoice Sent' },
  { value: 'payment_received', label: 'Payment Received' },
];

const TARGET_TYPES = [
  { value: '', label: 'All Targets' },
  { value: 'order', label: 'Orders' },
  { value: 'order_product', label: 'Products' },
  { value: 'order_item', label: 'Variants' },
  { value: 'invoice', label: 'Invoices' },
  { value: 'user', label: 'Users' },
];

export default function AuditLogPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  const [user, setUser] = useState<any>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState('');
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
    if (parsed.role !== 'super_admin' && parsed.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    setUser(parsed);
    fetchAuditLog();
  }, []);

  useEffect(() => {
    if (user) {
      fetchAuditLog();
    }
  }, [page, actionFilter, targetFilter, dateFrom, dateTo, userFilter]);

  const fetchAuditLog = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('audit_log')
        .select(`
          *,
          order:orders(order_number)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      // Apply filters
      if (actionFilter) {
        query = query.eq('action_type', actionFilter);
      }
      if (targetFilter) {
        query = query.eq('target_type', targetFilter);
      }
      if (dateFrom) {
        query = query.gte('created_at', `${dateFrom}T00:00:00`);
      }
      if (dateTo) {
        query = query.lte('created_at', `${dateTo}T23:59:59`);
      }
      if (userFilter) {
        query = query.ilike('user_name', `%${userFilter}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      setEntries(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching audit log:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAuditLog();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActionFilter('');
    setTargetFilter('');
    setDateFrom('');
    setDateTo('');
    setUserFilter('');
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

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'product_deleted':
      case 'order_deleted':
        return <Trash2 className="w-4 h-4 text-red-500" />;
      case 'product_added':
      case 'order_created':
        return <Package className="w-4 h-4 text-green-500" />;
      case 'product_updated':
      case 'price_updated':
        return <Edit className="w-4 h-4 text-blue-500" />;
      case 'routed':
        return <Send className="w-4 h-4 text-purple-500" />;
      case 'status_changed':
        return <CheckCircle className="w-4 h-4 text-amber-500" />;
      case 'invoice_created':
      case 'invoice_sent':
        return <FileText className="w-4 h-4 text-indigo-500" />;
      case 'payment_received':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActionColor = (actionType: string) => {
    if (actionType.includes('deleted')) return 'bg-red-50 border-red-200';
    if (actionType.includes('created') || actionType.includes('added')) return 'bg-green-50 border-green-200';
    if (actionType.includes('updated') || actionType.includes('price')) return 'bg-blue-50 border-blue-200';
    if (actionType.includes('routed')) return 'bg-purple-50 border-purple-200';
    if (actionType.includes('invoice') || actionType.includes('payment')) return 'bg-indigo-50 border-indigo-200';
    return 'bg-gray-50 border-gray-200';
  };

  const formatActionType = (actionType: string) => {
    return actionType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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

  const renderValueDiff = (oldValue: any, newValue: any) => {
    if (!oldValue && !newValue) return null;

    return (
      <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {oldValue && (
          <div className="bg-red-50 rounded-lg p-3 border border-red-200">
            <div className="text-xs font-medium text-red-700 mb-2 flex items-center gap-1">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              Previous Value
            </div>
            <pre className="text-xs text-red-900 whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto">
              {typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue, null, 2)}
            </pre>
          </div>
        )}
        {newValue && (
          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
            <div className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              New Value
            </div>
            <pre className="text-xs text-green-900 whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto">
              {typeof newValue === 'string' ? newValue : JSON.stringify(newValue, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  // Filter entries by search query (client-side)
  const filteredEntries = entries.filter(entry => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.user_name?.toLowerCase().includes(query) ||
      entry.action_type?.toLowerCase().includes(query) ||
      entry.order?.order_number?.toLowerCase().includes(query) ||
      JSON.stringify(entry.old_value)?.toLowerCase().includes(query) ||
      JSON.stringify(entry.new_value)?.toLowerCase().includes(query)
    );
  });

  const totalPages = Math.ceil(totalCount / pageSize);
  const hasActiveFilters = actionFilter || targetFilter || dateFrom || dateTo || userFilter;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Audit Log</h1>
                <p className="text-sm text-gray-500">
                  {totalCount} total entries
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                  showFilters || hasActiveFilters
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {hasActiveFilters && (
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                )}
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by user, action, order number, or content..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">Filters</h3>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear all
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Action Type
                  </label>
                  <select
                    value={actionFilter}
                    onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  >
                    {ACTION_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Target Type
                  </label>
                  <select
                    value={targetFilter}
                    onChange={(e) => { setTargetFilter(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  >
                    {TARGET_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    User
                  </label>
                  <input
                    type="text"
                    value={userFilter}
                    onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
                    placeholder="Filter by user..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No audit entries found</h3>
            <p className="text-gray-500">
              {hasActiveFilters
                ? 'Try adjusting your filters'
                : 'Activity will appear here as changes are made'}
            </p>
          </div>
        ) : (
          <>
            {/* Entries List */}
            <div className="space-y-3">
              {filteredEntries.map((entry) => {
                const isExpanded = expandedEntries.has(entry.id);
                
                return (
                  <div
                    key={entry.id}
                    className={`rounded-lg border overflow-hidden ${getActionColor(entry.action_type)}`}
                  >
                    {/* Entry Header */}
                    <div
                      className="p-4 cursor-pointer hover:bg-white/50 transition-colors"
                      onClick={() => toggleExpanded(entry.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {getActionIcon(entry.action_type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-medium text-gray-900">
                                {formatActionType(entry.action_type)}
                              </span>
                              <span className="text-gray-600 mx-2">by</span>
                              <span className="font-medium text-gray-900">
                                {entry.user_name || 'System'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500 flex-shrink-0">
                              <span title={formatDate(entry.created_at)}>
                                {formatRelativeTime(entry.created_at)}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm">
                            {entry.order?.order_number && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/80 rounded text-gray-700">
                                <Package className="w-3 h-3" />
                                {entry.order.order_number}
                              </span>
                            )}
                            <span className="px-2 py-0.5 bg-white/80 rounded text-gray-600">
                              {entry.target_type}
                            </span>
                            
                            {/* Quick preview of old_value for deletions */}
                            {entry.action_type.includes('deleted') && entry.old_value && (
                              <span className="text-gray-600">
                                {typeof entry.old_value === 'object' 
                                  ? entry.old_value.description || entry.old_value.product_order_number || ''
                                  : ''
                                }
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-gray-200/50 bg-white/30">
                        <div className="pt-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-3">
                            <div>
                              <span className="text-gray-500 block">Target ID</span>
                              <span className="font-mono text-xs text-gray-700 break-all">
                                {entry.target_id || 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 block">Order ID</span>
                              <span className="font-mono text-xs text-gray-700 break-all">
                                {entry.order_id || 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 block">User ID</span>
                              <span className="font-mono text-xs text-gray-700 break-all">
                                {entry.user_id || 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 block">Timestamp</span>
                              <span className="text-gray-700">
                                {formatDate(entry.created_at)}
                              </span>
                            </div>
                          </div>
                          
                          {/* Order Link */}
                          {entry.order?.order_number && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/orders/${entry.order_id}`);
                              }}
                              className="mb-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View Order
                            </button>
                          )}
                          
                          {/* Value Diff */}
                          {renderValueDiff(entry.old_value, entry.new_value)}
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
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
