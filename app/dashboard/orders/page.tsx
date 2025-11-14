'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Search, Filter, Eye, Package, Users, 
  Calendar, ChevronRight, Edit, Building,
  ChevronDown, Send, AlertCircle, Trash2, Shield, DollarSign,
  Inbox, SendHorizontal, Factory, Truck
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

type ManufacturerTab = 'my_orders' | 'sent_to_admin' | 'in_production' | 'shipped';

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [deletingOrder, setDeletingOrder] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // NEW: Tab state for manufacturers
  const [activeTab, setActiveTab] = useState<ManufacturerTab>('my_orders');

  // State for finance margins
  const [productMargin, setProductMargin] = useState(80); // Default 80%
  const [shippingMargin, setShippingMargin] = useState(0); // Default 0%
  const [marginsLoaded, setMarginsLoaded] = useState(false);

  // State for tracking orders with unread notifications
  const [ordersWithUnreadNotifications, setOrdersWithUnreadNotifications] = useState<Set<string>>(new Set());
  const [manufacturerId, setManufacturerId] = useState<string | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }
    const user = JSON.parse(userData);
    setUserRole(user.role);
    fetchOrders(user);
    loadMargins(); // Load margins for price calculations

    // Load unread notifications for manufacturer
    let unsubscribe: (() => void) | undefined;
    if (user.role === 'manufacturer') {
      loadManufacturerData(user).then(cleanup => {
        unsubscribe = cleanup;
      });
    }

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [router]);

  // Load manufacturer data and unread notifications
  const loadManufacturerData = async (user: any): Promise<(() => void) | undefined> => {
    try {
      // Get manufacturer ID
      const { data: manufacturer } = await supabase
        .from('manufacturers')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!manufacturer) return undefined;

      setManufacturerId(manufacturer.id);

      // Load unread notifications
      await loadUnreadNotifications(manufacturer.id);

      // Subscribe to real-time updates and return cleanup function
      return subscribeToNotificationUpdates(manufacturer.id);
    } catch (error) {
      console.error('Error loading manufacturer data:', error);
      return undefined;
    }
  };

  // Load unread notifications for manufacturer
  const loadUnreadNotifications = async (manufacturerId: string) => {
    try {
      console.log('Loading unread notifications for manufacturer:', manufacturerId);
      const { data: unreadNotifs } = await supabase
        .from('manufacturer_notifications')
        .select('order_id')
        .eq('manufacturer_id', manufacturerId)
        .eq('is_read', false);

      console.log('Unread notifications:', unreadNotifs);

      if (unreadNotifs) {
        const unreadOrderIds = new Set(unreadNotifs.map(n => n.order_id));
        console.log('Setting unread order IDs:', unreadOrderIds);
        setOrdersWithUnreadNotifications(unreadOrderIds);
      }
    } catch (error) {
      console.error('Error loading unread notifications:', error);
    }
  };

  // Subscribe to notification changes
  const subscribeToNotificationUpdates = (manufacturerId: string): (() => void) => {
    console.log('Subscribing to notification updates for manufacturer:', manufacturerId);

    const channel = supabase
      .channel(`orders-page-notifications-${manufacturerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'manufacturer_notifications',
          filter: `manufacturer_id=eq.${manufacturerId}`,
        },
        (payload) => {
          console.log('Notification change detected on orders page:', payload);
          // Reload unread notifications when any change happens
          loadUnreadNotifications(manufacturerId);
        }
      )
      .subscribe((status) => {
        console.log('Orders page notification subscription status:', status);
      });

    return () => {
      console.log('Cleaning up orders page notification subscription');
      supabase.removeChannel(channel);
    };
  };

  useEffect(() => {
    filterOrders();
  }, [searchTerm, statusFilter, orders, activeTab]);

  // Load finance margins from database
  const loadMargins = async () => {
    try {
      const { data } = await supabase
        .from('system_config')
        .select('config_key, config_value')
        .in('config_key', ['default_margin_percentage', 'default_shipping_margin_percentage']);
      
      if (data) {
        data.forEach(config => {
          if (config.config_key === 'default_margin_percentage') {
            setProductMargin(parseFloat(config.config_value) || 80);
          } else if (config.config_key === 'default_shipping_margin_percentage') {
            setShippingMargin(parseFloat(config.config_value) || 0);
          }
        });
      }
      setMarginsLoaded(true);
    } catch (error) {
      console.error('Error loading margins:', error);
      setMarginsLoaded(true); // Use defaults
    }
  };

  // Calculate product total with margins for admin view
  const calculateProductTotal = (product: any): number => {
    if (!product.product_price && !product.sample_fee) return 0;
    
    const totalQty = product.order_items?.reduce((sum: number, item: any) => 
      sum + (item.quantity || 0), 0) || 0;
    
    let productPrice = 0;
    let sampleFee = 0;
    let shippingPrice = 0;
    
    // For admin/super admin, apply margins
    if (userRole === 'admin' || userRole === 'super_admin') {
      const mfgProductPrice = parseFloat(product.product_price || 0);
      const mfgSampleFee = parseFloat(product.sample_fee || 0);
      
      // Apply product margin (80%)
      productPrice = mfgProductPrice * (1 + productMargin / 100);
      sampleFee = mfgSampleFee * (1 + productMargin / 100);
      
      // Apply shipping margin (0%)
      if (product.selected_shipping_method === 'air') {
        const mfgShipping = parseFloat(product.shipping_air_price || 0);
        shippingPrice = mfgShipping * (1 + shippingMargin / 100);
      } else if (product.selected_shipping_method === 'boat') {
        const mfgShipping = parseFloat(product.shipping_boat_price || 0);
        shippingPrice = mfgShipping * (1 + shippingMargin / 100);
      }
    } else {
      // For other roles, use raw prices
      productPrice = parseFloat(product.product_price || 0);
      sampleFee = parseFloat(product.sample_fee || 0);
      
      if (product.selected_shipping_method === 'air') {
        shippingPrice = parseFloat(product.shipping_air_price || 0);
      } else if (product.selected_shipping_method === 'boat') {
        shippingPrice = parseFloat(product.shipping_boat_price || 0);
      }
    }
    
    const total = (productPrice * totalQty) + sampleFee + shippingPrice;
    return total;
  };

  // Calculate order total
  const calculateOrderTotal = (order: Order): number => {
    if (!order.order_products || order.order_products.length === 0) return 0;
    
    let total = 0;
    order.order_products.forEach(product => {
      total += calculateProductTotal(product);
    });
    
    return total;
  };

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
            product:products(title),
            product_price,
            sample_fee,
            shipping_air_price,
            shipping_boat_price,
            selected_shipping_method,
            order_items(quantity)
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
          // Get ALL orders assigned to this manufacturer (including drafts now)
          query = query.eq('manufacturer_id', manufacturerData.id);
        }
      } else if (user.role === 'manufacturer_team_member') {
        // Team members see same orders as manufacturer
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
      // Admin and super_admin see all orders (no additional filtering)

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

  // NEW: Filter orders based on tab for manufacturers
  const getTabFilteredOrders = (ordersToFilter: Order[]): Order[] => {
    if (userRole !== 'manufacturer') {
      return ordersToFilter;
    }

    switch (activeTab) {
      case 'my_orders':
        // Orders with ANY products still routed to manufacturer
        return ordersToFilter.filter(order => {
          if (!order.order_products || order.order_products.length === 0) return false;
          return order.order_products.some(p => 
            p.routed_to === 'manufacturer' && 
            p.product_status !== 'in_production' && 
            p.product_status !== 'shipped' &&
            p.product_status !== 'completed'
          );
        });

      case 'sent_to_admin':
        // Orders where ALL products are routed to admin (but not shipped/completed)
        return ordersToFilter.filter(order => {
          if (!order.order_products || order.order_products.length === 0) return false;
          const hasProductsRoutedToAdmin = order.order_products.some(p => p.routed_to === 'admin');
          const hasNoProductsWithManufacturer = !order.order_products.some(p => 
            p.routed_to === 'manufacturer' && 
            p.product_status !== 'in_production' && 
            p.product_status !== 'shipped' &&
            p.product_status !== 'completed'
          );
          return hasProductsRoutedToAdmin && hasNoProductsWithManufacturer;
        });

      case 'in_production':
        // Orders with products in production
        return ordersToFilter.filter(order => {
          if (!order.order_products || order.order_products.length === 0) return false;
          return order.order_products.some(p => p.product_status === 'in_production');
        });

      case 'shipped':
        // Orders with shipped/completed products
        return ordersToFilter.filter(order => {
          if (!order.order_products || order.order_products.length === 0) return false;
          return order.order_products.some(p => 
            p.product_status === 'shipped' || p.product_status === 'completed'
          );
        });

      default:
        return ordersToFilter;
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
    
    // Apply tab filtering for manufacturers
    filtered = getTabFilteredOrders(filtered);
    
    setFilteredOrders(filtered);
  };

  // Get tab counts for manufacturers
  const getTabCounts = () => {
    if (userRole !== 'manufacturer') return {};
    
    return {
      my_orders: getTabFilteredOrders(orders.filter(o => statusFilter === 'all' || o.status === statusFilter)).length,
      sent_to_admin: orders.filter(order => {
        if (!order.order_products || order.order_products.length === 0) return false;
        const hasProductsRoutedToAdmin = order.order_products.some(p => p.routed_to === 'admin');
        const hasNoProductsWithManufacturer = !order.order_products.some(p => 
          p.routed_to === 'manufacturer' && 
          p.product_status !== 'in_production' && 
          p.product_status !== 'shipped' &&
          p.product_status !== 'completed'
        );
        return hasProductsRoutedToAdmin && hasNoProductsWithManufacturer;
      }).length,
      in_production: orders.filter(order => {
        if (!order.order_products || order.order_products.length === 0) return false;
        return order.order_products.some(p => p.product_status === 'in_production');
      }).length,
      shipped: orders.filter(order => {
        if (!order.order_products || order.order_products.length === 0) return false;
        return order.order_products.some(p => 
          p.product_status === 'shipped' || p.product_status === 'completed'
        );
      }).length
    };
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

  // Navigate to order detail view
  const navigateToOrder = (orderId: string) => {
    router.push(`/dashboard/orders/${orderId}`);
  };

  // Check if user can delete the order
  const canDeleteOrder = (order: Order): boolean => {
    if (userRole === 'super_admin') {
      return true; // Super admins can delete any order
    }
    if (userRole === 'admin' && order.status === 'draft') {
      return true; // Admins can only delete draft orders
    }
    return false;
  };

  // Delete order function (same as before)
  const handleDeleteOrder = async (orderId: string) => {
    try {
      setDeletingOrder(orderId);
      
      // First, get all order_products for this order
      const { data: orderProducts, error: fetchError } = await supabase
        .from('order_products')
        .select('id')
        .eq('order_id', orderId);

      if (fetchError) {
        console.error('Error fetching order products:', fetchError);
        throw fetchError;
      }

      const productIds = orderProducts?.map(p => p.id) || [];

      // Delete in correct order to avoid foreign key constraints
      
      // 1. Delete order_media (files)
      if (productIds.length > 0) {
        const { error: mediaError } = await supabase
          .from('order_media')
          .delete()
          .in('order_product_id', productIds);
        
        if (mediaError) {
          console.error('Error deleting media:', mediaError);
        }
      }

      // 2. Delete order_items (variants)
      if (productIds.length > 0) {
        const { error: itemsError } = await supabase
          .from('order_items')
          .delete()
          .in('order_product_id', productIds);
        
        if (itemsError) {
          console.error('Error deleting items:', itemsError);
        }
      }

      // 3. Delete audit_log entries related to this order
      const { error: auditError } = await supabase
        .from('audit_log')
        .delete()
        .or(`target_id.eq.${orderId},target_id.in.(${productIds.join(',')})`);
      
      if (auditError) {
        console.error('Error deleting audit logs:', auditError);
      }

      // 4. Delete notifications
      const { error: notifError } = await supabase
        .from('notifications')
        .delete()
        .eq('order_id', orderId);
      
      if (notifError) {
        console.error('Error deleting notifications:', notifError);
      }

      // 5. Try to delete manufacturer_notifications (may not exist)
      try {
        await supabase
          .from('manufacturer_notifications')
          .delete()
          .eq('order_id', orderId);
      } catch (e) {
        // Table might not exist, continue
      }

      // 6. Try to delete workflow_log (may not exist)
      try {
        await supabase
          .from('workflow_log')
          .delete()
          .eq('order_id', orderId);
      } catch (e) {
        // Table might not exist, continue
      }

      // 7. Delete order_products
      const { error: productsError } = await supabase
        .from('order_products')
        .delete()
        .eq('order_id', orderId);

      if (productsError) {
        console.error('Error deleting products:', productsError);
        throw productsError;
      }

      // 8. Finally delete the order itself
      const { error: orderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (orderError) {
        console.error('Error deleting order:', orderError);
        throw orderError;
      }

      // Remove from local state
      setOrders(prev => prev.filter(order => order.id !== orderId));
      setFilteredOrders(prev => prev.filter(order => order.id !== orderId));
      
      setShowDeleteConfirm(null);
    } catch (error: any) {
      console.error('Error deleting order:', error);
      
      // Show more specific error message
      let errorMessage = 'Error deleting order. ';
      if (error?.message?.includes('foreign key')) {
        errorMessage += 'There are still related records that need to be deleted first.';
      } else if (error?.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please try again.';
      }
      
      alert(errorMessage);
    } finally {
      setDeletingOrder(null);
    }
  };

  // Calculate order routing status
  const getOrderRoutingStatus = (order: Order) => {
    if (!order.order_products || order.order_products.length === 0) {
      return { status: 'no_products', label: 'No Products', color: 'gray' };
    }

    const products = order.order_products;
    
    // For manufacturers in different tabs, show relevant info
    if (userRole === 'manufacturer') {
      if (activeTab === 'my_orders') {
        const manufacturerProducts = products.filter(p => 
          p.routed_to === 'manufacturer' && 
          p.product_status !== 'in_production' && 
          p.product_status !== 'shipped'
        );
        if (manufacturerProducts.length > 0) {
          return { 
            status: 'with_manufacturer', 
            label: `${manufacturerProducts.length} Need Action`, 
            color: 'indigo' 
          };
        }
      } else if (activeTab === 'sent_to_admin') {
        const adminProducts = products.filter(p => p.routed_to === 'admin');
        return { 
          status: 'with_admin', 
          label: `${adminProducts.length} With Admin`, 
          color: 'purple' 
        };
      } else if (activeTab === 'in_production') {
        const inProdProducts = products.filter(p => p.product_status === 'in_production');
        return { 
          status: 'in_production', 
          label: `${inProdProducts.length} In Production`, 
          color: 'blue' 
        };
      } else if (activeTab === 'shipped') {
        const shippedProducts = products.filter(p => 
          p.product_status === 'shipped' || p.product_status === 'completed'
        );
        return { 
          status: 'shipped', 
          label: `${shippedProducts.length} Shipped`, 
          color: 'green' 
        };
      }
    }
    
    // For admin/super_admin - show full status
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
    if (product.product_status === 'shipped') {
      return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">Shipped</span>;
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

  const tabCounts = getTabCounts();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Delete</h3>
              {userRole === 'super_admin' && (
                <div className="flex items-center gap-2 mb-3 text-amber-600">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm">Super Admin Override</span>
                </div>
              )}
              <p className="text-gray-600">
                Are you sure you want to delete order{' '}
                <strong>{formatOrderNumber(orders.find(o => o.id === showDeleteConfirm)?.order_number || '')}</strong>?
              </p>
              <p className="text-red-600 text-sm mt-2">
                This will permanently delete the order and all associated products, variants, and media files.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={deletingOrder === showDeleteConfirm}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteOrder(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                disabled={deletingOrder === showDeleteConfirm}
              >
                {deletingOrder === showDeleteConfirm ? 'Deleting...' : 'Delete Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {userRole === 'manufacturer' ? 'Your Orders' : 'Orders'}
          </h1>
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

        {/* NEW: Tabs for Manufacturers */}
        {userRole === 'manufacturer' && (
          <div className="border-b border-gray-200 mb-4">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('my_orders')}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'my_orders'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Inbox className="w-4 h-4" />
                My Orders
                {tabCounts.my_orders !== undefined && tabCounts.my_orders > 0 && (
                  <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs">
                    {tabCounts.my_orders}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('sent_to_admin')}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'sent_to_admin'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <SendHorizontal className="w-4 h-4" />
                Sent to Admin
                {tabCounts.sent_to_admin !== undefined && tabCounts.sent_to_admin > 0 && (
                  <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-xs">
                    {tabCounts.sent_to_admin}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('in_production')}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'in_production'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Factory className="w-4 h-4" />
                In Production
                {tabCounts.in_production !== undefined && tabCounts.in_production > 0 && (
                  <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-xs">
                    {tabCounts.in_production}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('shipped')}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'shipped'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Truck className="w-4 h-4" />
                Shipped
                {tabCounts.shipped !== undefined && tabCounts.shipped > 0 && (
                  <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-xs">
                    {tabCounts.shipped}
                  </span>
                )}
              </button>
            </nav>
          </div>
        )}

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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
              />
            </div>
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Orders Table - Responsive (rest of the component remains the same) */}
      <div className="bg-white rounded-lg shadow">
        {/* Mobile View - Cards */}
        <div className="block lg:hidden">
          {filteredOrders.map((order) => {
            const routingStatus = getOrderRoutingStatus(order);
            const isExpanded = expandedOrders.has(order.id);
            const canDelete = canDeleteOrder(order);
            const orderTotal = calculateOrderTotal(order);
            const hasUnreadNotification = ordersWithUnreadNotifications.has(order.id);

            // Show all products in expanded view regardless of tab
            const visibleProducts = order.order_products;

            return (
              <div
                key={order.id}
                className={`border-b border-gray-200 p-4 cursor-pointer transition-all ${
                  hasUnreadNotification
                    ? 'bg-blue-50 border-l-4 border-l-blue-500 shadow-sm'
                    : ''
                }`}
                onDoubleClick={() => navigateToOrder(order.id)}
              >
                {/* Order Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {visibleProducts && visibleProducts.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleOrderExpansion(order.id);
                        }}
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
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        {formatOrderNumber(order.order_number)}
                        {hasUnreadNotification && (
                          <span className="inline-flex items-center justify-center w-2 h-2 bg-blue-600 rounded-full animate-pulse" title="New notification"></span>
                        )}
                      </div>
                      {order.order_name && (
                        <div className="text-xs text-gray-500">{order.order_name}</div>
                      )}
                      {visibleProducts && (
                        <div className="text-xs text-gray-400">
                          {visibleProducts.length} product{visibleProducts.length !== 1 ? 's' : ''}
                        </div>
                      )}
                      {(userRole === 'admin' || userRole === 'super_admin') && orderTotal > 0 && (
                        <div className="text-xs font-semibold text-green-600 mt-1">
                          Est. Total: ${orderTotal.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {order.status === 'draft' && (userRole === 'admin' || userRole === 'super_admin' || userRole === 'order_creator') && (
                      <Link
                        href={`/dashboard/orders/edit/${order.id}`}
                        className="text-blue-600 hover:text-blue-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Edit className="w-5 h-5" />
                      </Link>
                    )}
                    {canDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(order.id);
                        }}
                        className={`${
                          userRole === 'super_admin' 
                            ? 'text-red-600 hover:text-red-800' 
                            : 'text-gray-500 hover:text-red-600'
                        }`}
                        title={userRole === 'super_admin' ? 'Delete (Super Admin)' : 'Delete (Draft Only)'}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="text-gray-600 hover:text-gray-800"
                      onClick={(e) => e.stopPropagation()}
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
                  {userRole !== 'manufacturer' && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Manufacturer:</span>
                      <span className="text-gray-900">{order.manufacturer?.name || '-'}</span>
                    </div>
                  )}
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
                {isExpanded && visibleProducts && visibleProducts.length > 0 && (
                  <div className="mt-4 pl-4 space-y-2 border-t pt-3">
                    {visibleProducts.map((product) => {
                      const productTotal = calculateProductTotal(product);
                      
                      return (
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
                          <div className="flex items-center gap-2 ml-2">
                            {(userRole === 'admin' || userRole === 'super_admin') && productTotal > 0 && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                ${productTotal.toFixed(2)}
                              </span>
                            )}
                            <div className="flex flex-col items-end gap-1">
                              <StatusBadge status={product.product_status} />
                              {getProductRoutingBadge(product)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop View - Table */}
        <div className="hidden lg:block">
          <div className="overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {userRole === 'manufacturer' ? 'Client' : 'Client/Mfr'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Products
                  </th>
                  {(userRole === 'admin' || userRole === 'super_admin') && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Est. Total
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                  const canDelete = canDeleteOrder(order);
                  const orderTotal = calculateOrderTotal(order);
                  const hasUnreadNotification = ordersWithUnreadNotifications.has(order.id);

                  // Show all products in expanded view regardless of tab
                  const visibleProducts = order.order_products;

                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        className={`hover:bg-gray-50 cursor-pointer transition-all ${
                          hasUnreadNotification
                            ? 'bg-blue-50 border-l-4 border-l-blue-500'
                            : ''
                        }`}
                        onDoubleClick={() => navigateToOrder(order.id)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {visibleProducts && visibleProducts.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleOrderExpansion(order.id);
                                }}
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
                              <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                {formatOrderNumber(order.order_number)}
                                {hasUnreadNotification && (
                                  <span className="inline-flex items-center justify-center w-2 h-2 bg-blue-600 rounded-full animate-pulse" title="New notification"></span>
                                )}
                              </div>
                              {order.order_name && (
                                <div className="text-xs text-gray-500">{order.order_name}</div>
                              )}
                              {visibleProducts && (
                                <div className="text-xs text-gray-400">
                                  {visibleProducts.length} product{visibleProducts.length !== 1 ? 's' : ''}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm text-gray-900">{order.client?.name || '-'}</div>
                            {userRole !== 'manufacturer' && (
                              <div className="text-xs text-gray-500">{order.manufacturer?.name || '-'}</div>
                            )}
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
                        {(userRole === 'admin' || userRole === 'super_admin') && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            {orderTotal > 0 && (
                              <span className="px-2.5 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full flex items-center gap-1 inline-flex">
                                <DollarSign className="w-3.5 h-3.5" />
                                ${orderTotal.toFixed(2)}
                              </span>
                            )}
                          </td>
                        )}
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
                                title="Edit Order"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Edit className="w-5 h-5" />
                              </Link>
                            )}
                            {canDelete && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowDeleteConfirm(order.id);
                                }}
                                className={`${
                                  userRole === 'super_admin' 
                                    ? 'text-red-600 hover:text-red-800' 
                                    : 'text-gray-500 hover:text-red-600'
                                }`}
                                title={userRole === 'super_admin' ? 'Delete (Super Admin)' : 'Delete (Draft Only)'}
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}
                            <Link
                              href={`/dashboard/orders/${order.id}`}
                              className="text-gray-600 hover:text-gray-800"
                              title="View Order"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Eye className="w-5 h-5" />
                            </Link>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Products Row */}
                      {isExpanded && visibleProducts && visibleProducts.length > 0 && (
                        <tr>
                          <td colSpan={(userRole === 'admin' || userRole === 'super_admin') ? 7 : 6} className="px-6 py-2 bg-gray-50">
                            <div className="pl-8 space-y-1">
                              {visibleProducts.map((product) => {
                                const productTotal = calculateProductTotal(product);
                                
                                return (
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
                                      {(userRole === 'admin' || userRole === 'super_admin') && productTotal > 0 && (
                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1">
                                          <DollarSign className="w-3 h-3" />
                                          ${productTotal.toFixed(2)}
                                        </span>
                                      )}
                                      <StatusBadge status={product.product_status} />
                                      {getProductRoutingBadge(product)}
                                    </div>
                                  </div>
                                );
                              })}
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
              {userRole === 'manufacturer' 
                ? activeTab === 'my_orders' 
                  ? 'No orders need your action right now'
                  : `No orders in ${activeTab.replace('_', ' ')}`
                : searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your filters'
                  : 'Get started by creating a new order'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}