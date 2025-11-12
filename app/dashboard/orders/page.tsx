'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Search, Filter, Eye, Package, Users, 
  Calendar, ChevronRight, Edit, Building,
  ChevronDown, Send, AlertCircle
} from 'lucide-react';
import { StatusBadge } from './[id]/components/shared/StatusBadge';
import { formatOrderNumber } from '@/lib/utils/orderUtils';

interface Order {
  id: string;
  order_number: string;
  order_name: string | null;
  status: string;
  workflow_status: string;
  created_at: string;
  client?: {
    id: string;
    name: string;
    email: string;
  };
  manufacturer?: {
    id: string;
    name: string;
    email: string;
  };
  order_products?: Array<{
    id: string;
    product_order_number: string;
    description: string;
    product_status: string;
    routed_to: string;
    product?: {
      title: string;
    };
  }>;
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }
    
    const user = JSON.parse(userData);
    setUserRole(user.role);
    fetchOrders(user);
  }, [router]);

  useEffect(() => {
    filterOrders();
  }, [searchTerm, statusFilter, orders]);

  const fetchOrders = async (user: any) => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('orders')
        .select(`
          *,
          client:clients(id, name, email),
          manufacturer:manufacturers(id, name, email),
          order_products(
            id,
            product_order_number,
            description,
            product_status,
            routed_to,
            product:products(title)
          )
        `)
        .order('created_at', { ascending: false });

      // Filter based on user role
      if (user.role === 'manufacturer') {
        const { data: manufacturerData } = await supabase
          .from('manufacturers')
          .select('id')
          .eq('email', user.email)
          .single();
        
        if (manufacturerData) {
          query = query.eq('manufacturer_id', manufacturerData.id);
        }
      } else if (user.role === 'manufacturer_team_member') {
        // Team members see same orders as manufacturer
        // Find the manufacturer user this team member belongs to
        const { data: manufacturerUser } = await supabase
          .from('users')
          .select('created_by')
          .eq('id', user.id)
          .single();
        if (manufacturerUser?.created_by) {
          const { data: manufacturerData } = await supabase
            .from('manufacturers')
            .select('id')
            .eq('user_id', manufacturerUser.created_by)
            .single();
          if (manufacturerData) {
            query = query.eq('manufacturer_id', manufacturerData.id);
          }
        }
      } else if (user.role === 'sub_manufacturer') {
        // Sub manufacturer sees only orders assigned to them
        query = query.eq('sub_manufacturer_id', user.id);
      } else if (user.role === 'client') {
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('email', user.email)
          .single();
        
        if (clientData) {
          query = query.eq('client_id', clientData.id);
        }
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      setOrders(data || []);
      setFilteredOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];
    
    if (searchTerm) {
      filtered = filtered.filter(order => 
        formatOrderNumber(order.order_number).toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.client?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.manufacturer?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }
    
    setFilteredOrders(filtered);
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

  // Calculate order routing status
  const getOrderRoutingStatus = (order: Order) => {
    if (!order.order_products || order.order_products.length === 0) {
      return { status: 'no_products', label: 'No Products', color: 'gray' };
    }

    const products = order.order_products;
    const allWithAdmin = products.every(p => p.routed_to === 'admin');
    const allWithManufacturer = products.every(p => p.routed_to === 'manufacturer');
    const allCompleted = products.every(p => p.product_status === 'completed');
    const allInProduction = products.every(p => p.product_status === 'in_production');

    if (allCompleted) {
      return { status: 'completed', label: 'All Completed', color: 'green' };
    }
    if (allInProduction) {
      return { status: 'in_production', label: 'All In Production', color: 'blue' };
    }
    if (allWithAdmin) {
      return { status: 'all_with_admin', label: 'All With Admin', color: 'purple' };
    }
    if (allWithManufacturer) {
      return { status: 'all_with_manufacturer', label: 'All With Manufacturer', color: 'indigo' };
    }

    // Count where products are
    const withAdmin = products.filter(p => p.routed_to === 'admin').length;
    const withManufacturer = products.filter(p => p.routed_to === 'manufacturer').length;
    
    return { 
      status: 'split', 
      label: `Split (${withAdmin} Admin / ${withManufacturer} Mfr)`, 
      color: 'yellow' 
    };
  };

  // Get product routing badge
  const getProductRoutingBadge = (product: any) => {
    const isWithMe = (userRole === 'manufacturer' && product.routed_to === 'manufacturer') ||
                     (userRole !== 'manufacturer' && product.routed_to === 'admin');

    if (product.product_status === 'completed') {
      return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">Completed</span>;
    }
    if (product.product_status === 'in_production') {
      return <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">In Production</span>;
    }
    
    return (
      <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
        isWithMe 
          ? 'bg-green-100 text-green-700' 
          : 'bg-gray-100 text-gray-600'
      }`}>
        {product.routed_to === 'admin' ? (
          <>
            <Users className="w-3 h-3" />
            With Admin
          </>
        ) : (
          <>
            <Building className="w-3 h-3" />
            With Manufacturer
          </>
        )}
        {product.product_status === 'question_for_admin' && (
          <AlertCircle className="w-3 h-3 text-amber-500" />
        )}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          {(userRole === 'admin' || userRole === 'super_admin' || userRole === 'order_creator') && (
            <Link
              href="/dashboard/orders/create"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              New Order
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Orders Table - Responsive */}
      <div className="bg-white rounded-lg shadow">
        {/* Mobile View - Cards */}
        <div className="block lg:hidden">
          {filteredOrders.map((order) => {
            const routingStatus = getOrderRoutingStatus(order);
            const isExpanded = expandedOrders.has(order.id);
            
            return (
              <div key={order.id} className="border-b border-gray-200 p-4">
                {/* Order Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {order.order_products && order.order_products.length > 0 && (
                      <button
                        onClick={() => toggleOrderExpansion(order.id)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                    )}
                    <div>
                      <div className="font-medium text-gray-900">
                        {formatOrderNumber(order.order_number)}
                      </div>
                      {order.order_name && (
                        <div className="text-xs text-gray-500">{order.order_name}</div>
                      )}
                      {order.order_products && (
                        <div className="text-xs text-gray-400">
                          {order.order_products.length} product{order.order_products.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {order.status === 'draft' && (userRole === 'admin' || userRole === 'super_admin' || userRole === 'order_creator') && (
                      <Link
                        href={`/dashboard/orders/edit/${order.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit className="w-5 h-5" />
                      </Link>
                    )}
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      <Eye className="w-5 h-5" />
                    </Link>
                  </div>
                </div>

                {/* Order Info */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Client:</span>
                    <span className="text-gray-900">{order.client?.name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Manufacturer:</span>
                    <span className="text-gray-900">{order.manufacturer?.name || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Status:</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Products:</span>
                    <span className={`px-2 py-1 text-xs rounded-full bg-${routingStatus.color}-100 text-${routingStatus.color}-700`}>
                      {routingStatus.label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Created:</span>
                    <span className="text-gray-900">{new Date(order.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Expanded Products */}
                {isExpanded && order.order_products && order.order_products.length > 0 && (
                  <div className="mt-4 pl-4 space-y-2 border-t pt-3">
                    {order.order_products.map((product) => (
                      <div key={product.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-700 truncate">
                              {product.product_order_number}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {product.description || product.product?.title || 'Product'}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 ml-2">
                          <StatusBadge status={product.product_status} />
                          {getProductRoutingBadge(product)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop View - Table (Responsive without scroll) */}
        <div className="hidden lg:block">
          <div className="overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client/Mfr
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                    Products
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden 2xl:table-cell">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => {
              const routingStatus = getOrderRoutingStatus(order);
              const isExpanded = expandedOrders.has(order.id);
              
              return (
                <React.Fragment key={order.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {order.order_products && order.order_products.length > 0 && (
                          <button
                            onClick={() => toggleOrderExpansion(order.id)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {formatOrderNumber(order.order_number)}
                          </div>
                          {order.order_name && (
                            <div className="text-xs text-gray-500">{order.order_name}</div>
                          )}
                          {order.order_products && (
                            <div className="text-xs text-gray-400">
                              {order.order_products.length} product{order.order_products.length !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm text-gray-900">{order.client?.name || '-'}</div>
                        <div className="text-xs text-gray-500">{order.manufacturer?.name || '-'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full bg-${routingStatus.color}-100 text-${routingStatus.color}-700`}>
                        {routingStatus.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {order.status === 'draft' && (userRole === 'admin' || userRole === 'super_admin' || userRole === 'order_creator') && (
                          <Link
                            href={`/dashboard/orders/edit/${order.id}`}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit className="w-5 h-5" />
                          </Link>
                        )}
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          <Eye className="w-5 h-5" />
                        </Link>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Products Row */}
                  {isExpanded && order.order_products && order.order_products.length > 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-2 bg-gray-50">
                        <div className="pl-8 space-y-1">
                          {order.order_products.map((product) => (
                            <div key={product.id} className="flex items-center justify-between py-1.5 px-3 bg-white rounded border border-gray-200">
                              <div className="flex items-center gap-3">
                                <Package className="w-4 h-4 text-gray-400" />
                                <div>
                                  <span className="text-sm font-medium text-gray-700">
                                    {product.product_order_number}
                                  </span>
                                  <span className="text-xs text-gray-500 ml-2">
                                    {product.description || product.product?.title || 'Product'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <StatusBadge status={product.product_status} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
              </tbody>
            </table>
          </div>
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No orders</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your filters'
                : 'Get started by creating a new order'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}