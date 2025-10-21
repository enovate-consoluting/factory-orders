'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  Activity, 
  Clock, 
  User, 
  FileText, 
  TrendingUp,
  Calendar,
  Filter,
  Download,
  Search,
  ChevronRight,
  LogIn,
  LogOut,
  Package,
  Edit,
  Trash2,
  Check,
  X,
  Upload,
  DollarSign,
  AlertCircle,
  ShoppingCart
} from 'lucide-react';

interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action_type: string;
  target_type: string;
  target_id: string;
  old_value?: string;
  new_value?: string;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  timestamp: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function ActivityDashboard() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7days');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [stats, setStats] = useState({
    totalActions: 0,
    activeUsers: 0,
    ordersCreated: 0,
    mostActiveUser: ''
  });

  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  useEffect(() => {
    filterLogs();
  }, [auditLogs, selectedUser, selectedAction, searchTerm]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Get date range
      const startDate = getStartDate(dateRange);
      
      // Fetch audit logs
      const { data: logs, error: logsError } = await supabase
        .from('audit_log')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false });

      if (logsError) throw logsError;
      setAuditLogs(logs || []);

      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('name');

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Calculate stats
      if (logs) {
        calculateStats(logs);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStartDate = (range: string): Date => {
    const now = new Date();
    switch (range) {
      case '24hours':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7days':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30days':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90days':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  };

  const calculateStats = (logs: AuditLog[]) => {
    const userActions = logs.reduce((acc, log) => {
      acc[log.user_id] = (acc[log.user_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostActive = Object.entries(userActions)
      .sort(([, a], [, b]) => b - a)[0];

    setStats({
      totalActions: logs.length,
      activeUsers: Object.keys(userActions).length,
      ordersCreated: logs.filter(log => log.action_type === 'CREATE_ORDER').length,
      mostActiveUser: logs.find(log => log.user_id === mostActive?.[0])?.user_name || 'N/A'
    });
  };

  const filterLogs = () => {
    let filtered = [...auditLogs];

    if (selectedUser !== 'all') {
      filtered = filtered.filter(log => log.user_id === selectedUser);
    }

    if (selectedAction !== 'all') {
      filtered = filtered.filter(log => log.action_type === selectedAction);
    }

    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.target_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.target_id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
    setCurrentPage(1);
  };

  const getActionIcon = (action: string) => {
    const icons: Record<string, any> = {
      LOGIN: LogIn,
      LOGOUT: LogOut,
      CREATE_ORDER: ShoppingCart,
      UPDATE_ORDER: Edit,
      DELETE_ORDER: Trash2,
      SUBMIT_ORDER: Check,
      APPROVE_ORDER: Check,
      REJECT_ORDER: X,
      CREATE_PRODUCT: Package,
      UPDATE_PRODUCT: Edit,
      DELETE_PRODUCT: Trash2,
      CREATE_USER: User,
      UPDATE_USER: Edit,
      DELETE_USER: Trash2,
      UPLOAD_MEDIA: Upload,
      SET_PRICING: DollarSign,
      UPDATE_STATUS: AlertCircle
    };
    const Icon = icons[action] || Activity;
    return <Icon className="w-4 h-4" />;
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      LOGIN: 'bg-green-100 text-green-800',
      LOGOUT: 'bg-gray-100 text-gray-800',
      CREATE_ORDER: 'bg-blue-100 text-blue-800',
      UPDATE_ORDER: 'bg-yellow-100 text-yellow-800',
      DELETE_ORDER: 'bg-red-100 text-red-800',
      SUBMIT_ORDER: 'bg-indigo-100 text-indigo-800',
      APPROVE_ORDER: 'bg-green-100 text-green-800',
      REJECT_ORDER: 'bg-red-100 text-red-800',
      CREATE_PRODUCT: 'bg-purple-100 text-purple-800',
      UPDATE_PRODUCT: 'bg-yellow-100 text-yellow-800',
      DELETE_PRODUCT: 'bg-red-100 text-red-800',
      CREATE_USER: 'bg-blue-100 text-blue-800',
      UPDATE_USER: 'bg-yellow-100 text-yellow-800',
      DELETE_USER: 'bg-red-100 text-red-800',
      UPLOAD_MEDIA: 'bg-indigo-100 text-indigo-800',
      SET_PRICING: 'bg-green-100 text-green-800',
      UPDATE_STATUS: 'bg-orange-100 text-orange-800'
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else if (diffHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'User', 'Action', 'Target Type', 'Target ID', 'IP Address'];
    const csvData = filteredLogs.map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.user_name,
      log.action_type,
      log.target_type,
      log.target_id,
      log.ip_address || 'N/A'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const uniqueActionTypes = [...new Set(auditLogs.map(log => log.action_type))];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Activity Dashboard</h1>
        <p className="text-gray-600 mt-1">Monitor user actions and system activity</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Actions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalActions}</p>
            </div>
            <Activity className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeUsers}</p>
            </div>
            <User className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Orders Created</p>
              <p className="text-2xl font-bold text-gray-900">{stats.ordersCreated}</p>
            </div>
            <ShoppingCart className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Most Active</p>
              <p className="text-lg font-bold text-gray-900 truncate">{stats.mostActiveUser}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Date Range */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="24hours">Last 24 Hours</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
          </select>
          
          {/* User Filter */}
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Users</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
          
          {/* Action Filter */}
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Actions</option>
            {uniqueActionTypes.map(action => (
              <option key={action} value={action}>
                {action.replace('_', ' ')}
              </option>
            ))}
          </select>
          
          {/* Export Button */}
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Activity Log */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Loading activity logs...
          </div>
        ) : paginatedLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No activity found for the selected filters
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          {formatTimestamp(log.timestamp)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{log.user_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getActionColor(log.action_type)}`}>
                          {getActionIcon(log.action_type)}
                          {log.action_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{log.target_type}</span>
                          <ChevronRight className="w-3 h-3" />
                          <span className="text-gray-500">{log.target_id.substring(0, 8)}...</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {log.new_value && (
                          <span className="truncate max-w-xs block">
                            {JSON.parse(log.new_value)?.status || 
                             JSON.parse(log.new_value)?.role || 
                             'View details'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-200">
              {paginatedLogs.map((log) => (
                <div key={log.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getActionColor(log.action_type)}`}>
                        {getActionIcon(log.action_type)}
                        {log.action_type.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(log.timestamp)}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-900">{log.user_name}</span>
                    <span className="text-gray-500"> • </span>
                    <span className="text-gray-600">{log.target_type}</span>
                  </div>
                  {log.new_value && (
                    <div className="mt-1 text-xs text-gray-500">
                      {JSON.parse(log.new_value)?.status || 
                       JSON.parse(log.new_value)?.role || 
                       'Details available'}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
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