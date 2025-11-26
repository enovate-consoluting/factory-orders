/**
 * Orders Listing Page - /dashboard/orders
 * Displays all orders with tabbed interface for different order states
 * Roles: Admin, Super Admin, Manufacturer, Client
 * REFACTORED: Extracted translations, calculations, types, modals, tabs, and views
 * Last Modified: Nov 26 2025
 */

'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Search, Eye, Package, Users, 
  Calendar, ChevronRight, Edit, Building,
  ChevronDown, AlertCircle, Trash2, DollarSign,
  EyeOff, Globe
} from 'lucide-react';
import { StatusBadge } from './shared-components/StatusBadge';
import { formatOrderNumber } from '@/lib/utils/orderUtils';

// Extracted imports
import { Order, TabType, ProductionSubTab, TabCounts } from './types/orderList.types';
import { translations, Language } from './utils/orderListTranslations';
import { 
  formatCurrencyWithLanguage,
  calculateProductTotal,
  calculateOrderTotal,
  productHasFees
} from './utils/orderListCalculations';

// Extracted components
import { DeleteOrderModal } from './components/DeleteOrderModal';
import { OrderListTabs } from './components/OrderListTabs';
import { ProductionSubTabs } from './components/ProductionSubTabs';
import { InvoiceApprovalView } from './components/InvoiceApprovalView';

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [deletingOrder, setDeletingOrder] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  // Language state
  const [language, setLanguage] = useState<Language>('en');
  
  // Get translations
  const t = translations[language];

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('my_orders');
  const [productionSubTab, setProductionSubTab] = useState<ProductionSubTab>('approved_for_production');

  // State for showing/hiding prices
  const [showPrices, setShowPrices] = useState(false);

  // State for tracking orders with unread notifications
  const [ordersWithUnreadNotifications, setOrdersWithUnreadNotifications] = useState<Set<string>>(new Set());
  const [manufacturerId, setManufacturerId] = useState<string | null>(null);
  
  // Load language preference from localStorage
  useEffect(() => {
    const savedLanguage = localStorage.getItem('orderLanguage') as Language;
    if (savedLanguage) {
      setLanguage(savedLanguage);
    }
  }, []);
  
  // Toggle language function
  const toggleLanguage = () => {
    const newLanguage = language === 'en' ? 'zh' : 'en';
    setLanguage(newLanguage);
    localStorage.setItem('orderLanguage', newLanguage);
  };

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }
    const user = JSON.parse(userData);
    setUserRole(user.role);
    fetchOrders(user);

    // Load unread notifications for manufacturer
    let unsubscribe: (() => void) | undefined;
    if (user.role === 'manufacturer') {
      loadManufacturerData(user).then(cleanup => {
        unsubscribe = cleanup;
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [router]);

  const loadManufacturerData = async (user: any): Promise<(() => void) | undefined> => {
    try {
      const { data: manufacturer } = await supabase
        .from('manufacturers')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!manufacturer) return undefined;

      setManufacturerId(manufacturer.id);
      await loadUnreadNotifications(manufacturer.id);
      return subscribeToNotificationUpdates(manufacturer.id);
    } catch (error) {
      console.error('Error loading manufacturer data:', error);
      return undefined;
    }
  };

  const loadUnreadNotifications = async (manufacturerId: string) => {
    try {
      const { data: unreadNotifs } = await supabase
        .from('manufacturer_notifications')
        .select('order_id')
        .eq('manufacturer_id', manufacturerId)
        .eq('is_read', false);

      if (unreadNotifs) {
        const unreadOrderIds = new Set(unreadNotifs.map(n => n.order_id));
        setOrdersWithUnreadNotifications(unreadOrderIds);
      }
    } catch (error) {
      console.error('Error loading unread notifications:', error);
    }
  };

  const subscribeToNotificationUpdates = (manufacturerId: string): (() => void) => {
    try {
      const channelName = `notifications_${manufacturerId.replace(/-/g, '_')}`;
      
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'manufacturer_notifications',
            filter: `manufacturer_id=eq.${manufacturerId}`,
          },
          (payload) => {
            if (payload.errors) {
              console.error('Realtime error:', payload.errors);
              return;
            }
            loadUnreadNotifications(manufacturerId);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error('Error setting up notification subscription:', error);
      return () => {};
    }
  };

  useEffect(() => {
    filterOrders();
  }, [searchTerm, orders, activeTab, productionSubTab]);

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
            routed_at,
            sample_fee,
            product:products(title),
            product_price,
            client_product_price,
            shipping_air_price,
            shipping_boat_price,
            client_shipping_air_price,
            client_shipping_boat_price,
            selected_shipping_method,
            order_items(quantity)
          )
        `)
        .order('created_at', { ascending: false });

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

  const getTabFilteredOrders = (ordersToFilter: Order[]): Order[] => {
    const isAdminUser = userRole === 'admin' || userRole === 'super_admin';
    const isManufacturerUser = userRole === 'manufacturer';
    const isClientUser = userRole === 'client';
    
    if (!isAdminUser && !isManufacturerUser && !isClientUser) {
      return ordersToFilter;
    }

    let filtered: Order[] = [];

    switch (activeTab) {
      case 'my_orders':
        if (isAdminUser) {
          filtered = ordersToFilter.filter(order => {
            if (!order.order_products || order.order_products.length === 0) return false;
            return order.order_products.some(p => 
              p.routed_to === 'admin' && 
              p.product_status !== 'approved_for_production' &&
              p.product_status !== 'in_production' && 
              p.product_status !== 'shipped' &&
              p.product_status !== 'completed' &&
              !productHasFees(p)
            );
          });
        } else {
          filtered = ordersToFilter.filter(order => {
            if (!order.order_products || order.order_products.length === 0) return false;
            return order.order_products.some(p => 
              p.routed_to === 'manufacturer' && 
              p.product_status !== 'approved_for_production' &&
              p.product_status !== 'in_production' && 
              p.product_status !== 'shipped' &&
              p.product_status !== 'completed'
            );
          });
        }
        break;

      case 'invoice_approval':
        if (isAdminUser || isClientUser) {
          filtered = ordersToFilter.filter(order => {
            if (!order.order_products || order.order_products.length === 0) return false;
            return order.order_products.some(p => 
              p.routed_to === 'admin' && 
              productHasFees(p) &&
              p.product_status !== 'approved_for_production' &&
              p.product_status !== 'in_production' &&
              p.product_status !== 'shipped'
            );
          });
        } else {
          filtered = [];
        }
        break;

      case 'sent_to_other':
        if (isAdminUser) {
          filtered = ordersToFilter.filter(order => {
            if (!order.order_products || order.order_products.length === 0) return false;
            const hasProductsRoutedToManufacturer = order.order_products.some(p => 
              p.routed_to === 'manufacturer' &&
              p.product_status !== 'approved_for_production' &&
              p.product_status !== 'in_production' &&
              p.product_status !== 'shipped' &&
              p.product_status !== 'completed'
            );
            const hasNoProductsWithAdmin = !order.order_products.some(p => 
              p.routed_to === 'admin' && 
              p.product_status !== 'in_production' && 
              p.product_status !== 'shipped' &&
              p.product_status !== 'completed'
            );
            return hasProductsRoutedToManufacturer && hasNoProductsWithAdmin;
          });
        } else {
          filtered = ordersToFilter.filter(order => {
            if (!order.order_products || order.order_products.length === 0) return false;
            const hasProductsRoutedToAdmin = order.order_products.some(p => 
              p.routed_to === 'admin' &&
              p.product_status !== 'approved_for_production' &&
              p.product_status !== 'in_production' &&
              p.product_status !== 'shipped' &&
              p.product_status !== 'completed'
            );
            const hasNoProductsWithManufacturer = !order.order_products.some(p => 
              p.routed_to === 'manufacturer' && 
              p.product_status !== 'in_production' && 
              p.product_status !== 'shipped' &&
              p.product_status !== 'completed'
            );
            return hasProductsRoutedToAdmin && hasNoProductsWithManufacturer;
          });
        }
        break;

      case 'production_status':
        if (productionSubTab === 'approved_for_production') {
          filtered = ordersToFilter.filter(order => {
            if (!order.order_products || order.order_products.length === 0) return false;
            return order.order_products.some(p => 
              p.product_status === 'approved_for_production' || 
              p.product_status === 'ready_for_production'
            );
          });
        } else if (productionSubTab === 'in_production') {
          filtered = ordersToFilter.filter(order => {
            if (!order.order_products || order.order_products.length === 0) return false;
            return order.order_products.some(p => p.product_status === 'in_production');
          });
        } else if (productionSubTab === 'shipped') {
          filtered = ordersToFilter.filter(order => {
            if (!order.order_products || order.order_products.length === 0) return false;
            return order.order_products.some(p => 
              p.product_status === 'shipped' || p.product_status === 'completed'
            );
          });
        }
        break;

      default:
        filtered = ordersToFilter;
    }

    return filtered;
  };

  const filterOrders = () => {
    let filtered = [...orders];
    
    if (searchTerm) {
      filtered = filtered.filter(order => 
        formatOrderNumber(order.order_number).toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.client?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.manufacturer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.order_name && order.order_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    filtered = getTabFilteredOrders(filtered);
    setFilteredOrders(filtered);
  };

  const getTabCounts = (): TabCounts => {
    const isAdminUser = userRole === 'admin' || userRole === 'super_admin';
    const isManufacturerUser = userRole === 'manufacturer';
    const isClientUser = userRole === 'client';
    
    if (!isAdminUser && !isManufacturerUser && !isClientUser) {
      return {
        my_orders: 0,
        invoice_approval: 0,
        sent_to_other: 0,
        approved_for_production: 0,
        in_production: 0,
        shipped: 0,
        production_total: 0
      };
    }
    
    let productCounts: TabCounts = {
      my_orders: 0,
      invoice_approval: 0,
      sent_to_other: 0,
      approved_for_production: 0,
      in_production: 0,
      shipped: 0,
      production_total: 0
    };

    orders.forEach(order => {
      if (!order.order_products) return;
      
      order.order_products.forEach(product => {
        if (isAdminUser || isClientUser) {
          if (product.routed_to === 'admin' && 
              product.product_status !== 'approved_for_production' &&
              product.product_status !== 'in_production' && 
              product.product_status !== 'shipped' &&
              product.product_status !== 'completed') {
            
            if (productHasFees(product)) {
              productCounts.invoice_approval++;
            } else if (isAdminUser) {
              productCounts.my_orders++;
            }
          }
          
          if (isAdminUser && product.routed_to === 'manufacturer' &&
              product.product_status !== 'approved_for_production' &&
              product.product_status !== 'in_production' &&
              product.product_status !== 'shipped' &&
              product.product_status !== 'completed') {
            productCounts.sent_to_other++;
          }
        } else if (isManufacturerUser) {
          if (product.routed_to === 'manufacturer' && 
              product.product_status !== 'approved_for_production' &&
              product.product_status !== 'in_production' && 
              product.product_status !== 'shipped' &&
              product.product_status !== 'completed') {
            productCounts.my_orders++;
          }
          
          if (product.routed_to === 'admin' &&
              product.product_status !== 'approved_for_production' &&
              product.product_status !== 'in_production' &&
              product.product_status !== 'shipped' &&
              product.product_status !== 'completed') {
            productCounts.sent_to_other++;
          }
        }
        
        if (product.product_status === 'approved_for_production' || 
            product.product_status === 'ready_for_production') {
          productCounts.approved_for_production++;
        }
        
        if (product.product_status === 'in_production') {
          productCounts.in_production++;
        }
        
        if (product.product_status === 'shipped' || 
            product.product_status === 'completed') {
          productCounts.shipped++;
        }
      });
    });

    productCounts.production_total = productCounts.approved_for_production + 
                                     productCounts.in_production + 
                                     productCounts.shipped;

    return productCounts;
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

  const navigateToOrder = (orderId: string) => {
    window.open(`/dashboard/orders/${orderId}`, '_blank');
  };

  const canDeleteOrder = (order: Order): boolean => {
    if (userRole === 'super_admin') return true;
    if (userRole === 'admin' && order.status === 'draft') return true;
    return false;
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      setDeletingOrder(orderId);
      
      const { data: orderProducts, error: fetchError } = await supabase
        .from('order_products')
        .select('id')
        .eq('order_id', orderId);

      if (fetchError) throw fetchError;

      const productIds = orderProducts?.map(p => p.id) || [];

      if (productIds.length > 0) {
        await supabase.from('order_media').delete().in('order_product_id', productIds);
      }

      await supabase.from('order_media').delete().eq('order_id', orderId);

      if (productIds.length > 0) {
        await supabase.from('order_items').delete().in('order_product_id', productIds);
      }

      await supabase
        .from('audit_log')
        .delete()
        .or(`target_id.eq.${orderId},target_id.in.(${productIds.join(',')})`);

      await supabase.from('notifications').delete().eq('order_id', orderId);

      try {
        await supabase.from('manufacturer_notifications').delete().eq('order_id', orderId);
      } catch (e) {}

      try {
        await supabase.from('workflow_log').delete().eq('order_id', orderId);
      } catch (e) {}

      await supabase.from('order_products').delete().eq('order_id', orderId);
      
      const { error: orderError } = await supabase.from('orders').delete().eq('id', orderId);
      if (orderError) throw orderError;

      setOrders(prev => prev.filter(order => order.id !== orderId));
      setFilteredOrders(prev => prev.filter(order => order.id !== orderId));
      setShowDeleteConfirm(null);
    } catch (error: any) {
      console.error('Error deleting order:', error);
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

  const getOrderRoutingStatus = (order: Order) => {
    if (!order.order_products || order.order_products.length === 0) {
      return { status: 'no_products', label: t.products, color: 'gray' };
    }

    const products = order.order_products;
    const isAdminUser = userRole === 'admin' || userRole === 'super_admin';
    
    const withAdmin = products.filter(p => 
      p.routed_to === 'admin' && 
      p.product_status !== 'shipped' && 
      p.product_status !== 'completed' &&
      p.product_status !== 'approved_for_production' &&
      p.product_status !== 'in_production'
    ).length;
    
    const withManufacturer = products.filter(p => 
      p.routed_to === 'manufacturer' && 
      p.product_status !== 'shipped' && 
      p.product_status !== 'completed' &&
      p.product_status !== 'approved_for_production' &&
      p.product_status !== 'in_production'
    ).length;
    
    const withFees = products.filter(p => 
      p.routed_to === 'admin' && productHasFees(p)
    ).length;
    
    const approvedForProduction = products.filter(p => 
      p.product_status === 'approved_for_production' || 
      p.product_status === 'ready_for_production'
    ).length;
    const inProduction = products.filter(p => p.product_status === 'in_production').length;
    const shipped = products.filter(p => 
      p.product_status === 'shipped' || p.product_status === 'completed'
    ).length;
    
    if (activeTab === 'my_orders') {
      if (isAdminUser) {
        return { status: 'with_admin', label: `${withAdmin} ${t.withAdmin}`, color: 'purple' };
      } else {
        return { status: 'with_manufacturer', label: `${withManufacturer} ${t.needAction}`, color: 'indigo' };
      }
    } else if (activeTab === 'sent_to_other') {
      if (isAdminUser) {
        return { status: 'with_manufacturer', label: `${withManufacturer} ${t.withManufacturer}`, color: 'indigo' };
      } else {
        return { status: 'with_admin', label: `${withAdmin} ${t.withAdmin}`, color: 'purple' };
      }
    } else if (activeTab === 'invoice_approval') {
      return { status: 'with_fees', label: `${withFees} ${t.productsWithFees}`, color: 'amber' };
    } else if (activeTab === 'production_status') {
      if (productionSubTab === 'approved_for_production') {
        return { status: 'approved', label: `${approvedForProduction} ${t.approved}`, color: 'green' };
      } else if (productionSubTab === 'in_production') {
        return { status: 'in_production', label: `${inProduction} ${t.production}`, color: 'blue' };
      } else if (productionSubTab === 'shipped') {
        return { status: 'shipped', label: `${shipped} ${t.shipped}`, color: 'green' };
      }
    }
    
    return { status: 'mixed', label: `${products.length} ${t.products}`, color: 'gray' };
  };

  const getProductRoutingBadge = (product: any) => {
    const isWithMe = (userRole === 'manufacturer' && product.routed_to === 'manufacturer') ||
                     (userRole !== 'manufacturer' && product.routed_to === 'admin');

    if (product.product_status === 'completed') {
      return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">{t.completed}</span>;
    }
    if (product.product_status === 'approved_for_production') {
      return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">{t.approved}</span>;
    }
    if (product.product_status === 'in_production') {
      return <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{t.inProduction}</span>;
    }
    if (product.product_status === 'shipped') {
      return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">{t.shipped}</span>;
    }
    
    return (
      <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
        isWithMe ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
      }`}>
        {product.routed_to === 'admin' ? (
          <>
            <Users className="w-3 h-3" />
            {t.withAdmin}
          </>
        ) : (
          <>
            <Building className="w-3 h-3" />
            {t.withManufacturer}
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
      <DeleteOrderModal
        isOpen={!!showDeleteConfirm}
        orderNumber={formatOrderNumber(orders.find(o => o.id === showDeleteConfirm)?.order_number || '')}
        userRole={userRole}
        isDeleting={deletingOrder === showDeleteConfirm}
        translations={t}
        onConfirm={() => showDeleteConfirm && handleDeleteOrder(showDeleteConfirm)}
        onCancel={() => setShowDeleteConfirm(null)}
      />

      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {userRole === 'manufacturer' ? t.yourOrders : t.orders}
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
              title="Switch Language / 切换语言"
            >
              <Globe className="w-5 h-5" />
              <span className="font-medium">{t.switchToChinese}</span>
            </button>
            
            {(userRole === 'admin' || userRole === 'super_admin' || userRole === 'order_creator') && (
              <Link
                href="/dashboard/orders/create"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                {t.newOrder}
              </Link>
            )}
          </div>
        </div>

        {/* Tabs - Using extracted component */}
        {(userRole === 'manufacturer' || userRole === 'admin' || userRole === 'super_admin' || userRole === 'client') && (
          <OrderListTabs
            activeTab={activeTab}
            tabCounts={tabCounts}
            userRole={userRole}
            translations={t}
            onTabChange={setActiveTab}
            onProductionTabClick={() => {
              setActiveTab('production_status');
              setProductionSubTab('approved_for_production');
            }}
          />
        )}

        {/* Production Sub-Tabs - Using extracted component */}
        {activeTab === 'production_status' && (
          <ProductionSubTabs
            activeSubTab={productionSubTab}
            tabCounts={tabCounts}
            translations={t}
            onSubTabChange={setProductionSubTab}
          />
        )}

        {/* Search and Price Toggle */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
              />
            </div>
          </div>
          
          {(userRole === 'admin' || userRole === 'super_admin') && activeTab !== 'invoice_approval' && (
            <button
              onClick={() => setShowPrices(!showPrices)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title={showPrices ? t.hidePrices : t.showPrices}
            >
              {showPrices ? (
                <>
                  <EyeOff className="w-4 h-4 text-gray-600" />
                  <span className="text-gray-700">{t.hidePrices}</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 text-gray-600" />
                  <span className="text-gray-700">{t.showPrices}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      {activeTab === 'invoice_approval' ? (
        <InvoiceApprovalView
          filteredOrders={filteredOrders}
          expandedOrders={expandedOrders}
          translations={t}
          userRole={userRole}
          onToggleExpansion={toggleOrderExpansion}
          onNavigateToOrder={navigateToOrder}
        />
      ) : (
        <div className="bg-white rounded-lg shadow">
          {/* Desktop View - Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.order}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {userRole === 'manufacturer' ? t.client : t.clientMfr}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.products}
                  </th>
                  {(userRole === 'admin' || userRole === 'super_admin') && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t.clientTotal}
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.created}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => {
                  const routingStatus = getOrderRoutingStatus(order);
                  const isExpanded = expandedOrders.has(order.id);
                  const canDelete = canDeleteOrder(order);
                  const orderTotal = calculateOrderTotal(order, userRole);
                  const hasUnreadNotification = ordersWithUnreadNotifications.has(order.id);
                  const visibleProducts = order.order_products;

                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        className={`hover:bg-gray-50 cursor-pointer transition-all ${
                          hasUnreadNotification ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
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
                              <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                {order.order_name || t.untitledOrder}
                                {hasUnreadNotification && (
                                  <span className="inline-flex items-center justify-center w-2 h-2 bg-blue-600 rounded-full animate-pulse" title="New notification"></span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatOrderNumber(order.order_number)}
                              </div>
                              {visibleProducts && (
                                <div className="text-xs text-gray-400">
                                  {visibleProducts.length} {language === 'zh' ? '产品' : `product${visibleProducts.length !== 1 ? 's' : ''}`}
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
                          <span className={`px-2 py-1 text-xs rounded-full bg-${routingStatus.color}-100 text-${routingStatus.color}-700`}>
                            {routingStatus.label}
                          </span>
                        </td>
                        {(userRole === 'admin' || userRole === 'super_admin') && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            {orderTotal > 0 && (
                              <span className="px-2.5 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full inline-flex items-center gap-1">
                                <DollarSign className="w-3.5 h-3.5" />
                                {showPrices ? formatCurrencyWithLanguage(orderTotal, language).replace(/[$¥]/, '') : 'XXXXX'}
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
                                title={t.editOrder}
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
                              target="_blank"
                              className="text-gray-600 hover:text-gray-800"
                              title={t.viewDetails}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Eye className="w-5 h-5" />
                            </Link>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && visibleProducts && visibleProducts.length > 0 && (
                        <tr>
                          <td colSpan={(userRole === 'admin' || userRole === 'super_admin') ? 6 : 5} className="px-6 py-2 bg-gray-50">
                            <div className="pl-8 space-y-1">
                              {visibleProducts.map((product) => {
                                const productTotal = calculateProductTotal(product, userRole);
                                
                                return (
                                  <div key={product.id} className="flex items-center justify-between py-1.5 px-3 bg-white rounded border border-gray-200">
                                    <div className="flex items-center gap-3">
                                      <Package className="w-4 h-4 text-gray-400" />
                                      <div>
                                        <span className="text-sm font-medium text-gray-700">
                                          {product.product_order_number}
                                        </span>
                                        <span className="text-xs text-gray-500 ml-2">
                                          {product.description || product.product?.title || t.product}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {(userRole === 'admin' || userRole === 'super_admin') && productTotal > 0 && (
                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                                          {showPrices ? formatCurrencyWithLanguage(productTotal, language) : 'XXXXX'}
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

          {/* Mobile View */}
          <div className="block lg:hidden">
            {filteredOrders.map((order) => {
              const routingStatus = getOrderRoutingStatus(order);
              const orderTotal = calculateOrderTotal(order, userRole);
              const hasUnreadNotification = ordersWithUnreadNotifications.has(order.id);
              
              return (
                <div 
                  key={order.id} 
                  className={`p-4 border-b border-gray-200 ${hasUnreadNotification ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                  onClick={() => navigateToOrder(order.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-gray-900 flex items-center gap-2">
                        {order.order_name || t.untitledOrder}
                        {hasUnreadNotification && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{formatOrderNumber(order.order_number)}</div>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full bg-${routingStatus.color}-100 text-${routingStatus.color}-700`}>
                      {routingStatus.label}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    {order.client?.name} {userRole !== 'manufacturer' && order.manufacturer?.name && `• ${order.manufacturer.name}`}
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>{new Date(order.created_at).toLocaleDateString()}</span>
                    {(userRole === 'admin' || userRole === 'super_admin') && orderTotal > 0 && (
                      <span className="font-semibold text-green-700">
                        {showPrices ? formatCurrencyWithLanguage(orderTotal, language) : 'XXXXX'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">{t.noOrders}</h3>
              <p className="mt-1 text-sm text-gray-500">
                {activeTab === 'production_status'
                  ? t.noProductionOrders
                  : (userRole === 'manufacturer' || userRole === 'admin' || userRole === 'super_admin')
                    ? activeTab === 'my_orders' 
                      ? t.noOrdersMessage
                      : `${t.noOrders} in ${activeTab.replace('_', ' ')}`
                    : searchTerm
                      ? t.tryAdjustingSearch
                      : t.getStarted}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}