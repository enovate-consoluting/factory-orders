/**
 * Orders Listing Page - /dashboard/orders
 * Displays all orders with tabbed interface for different order states
 * Roles: Admin, Super Admin, Manufacturer, Client
 * REFACTORED: Extracted translations, calculations, types, modals, tabs, and views
 * UPDATED: Ready to Ship tab reads from per-manufacturer settings with Chinese support
 * FIXED: handleDeleteOrder now deletes all related records (invoices, email_history, etc.)
 * Last Modified: Dec 3 2025
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

// Translation imports

import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDynamicTranslation } from '@/hooks/useDynamicTranslation';
import '../../i18n';

// Extracted imports
import { Order, TabType, ProductionSubTab, TabCounts } from './types/orderList.types';
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

// Helper function to check if sample is active (not 'no_sample')
const isSampleActive = (order: Order): boolean => {
  return order.sample_required === true && 
         order.sample_status !== 'no_sample' && 
         order.sample_status !== null;
};

// Helper function to check if product is within ready-to-ship threshold
const isWithinShipThreshold = (estimatedShipDate: string | undefined, thresholdDays: number): boolean => {
  if (!estimatedShipDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const shipDate = new Date(estimatedShipDate);
  shipDate.setHours(0, 0, 0, 0);
  
  const diffTime = shipDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Within threshold means: ship date is today or within X days from now
  return diffDays >= 0 && diffDays <= thresholdDays;
};

// Default names for comparison
const DEFAULT_SHIP_QUEUE_NAME = 'Ready to Ship';
const DEFAULT_SHIP_QUEUE_NAME_ZH = '准备发货';

export default function OrdersPage() {
  // Dynamic translation hook
  const { translate, translateBatch } = useDynamicTranslation();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [deletingOrder, setDeletingOrder] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Use global translation context
  const { t, i18n } = useTranslation();
  const { language, setLanguage } = useLanguage();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('my_orders');
  const [productionSubTab, setProductionSubTab] = useState<ProductionSubTab>('sample_approved');

  // State for showing/hiding prices
  const [showPrices, setShowPrices] = useState(false);

  // State for tracking orders with unread notifications
  const [ordersWithUnreadNotifications, setOrdersWithUnreadNotifications] = useState<Set<string>>(new Set());
  const [manufacturerId, setManufacturerId] = useState<string | null>(null);
  
  // Ready to Ship settings (per-manufacturer from manufacturers table)
  const [readyToShipLabel, setReadyToShipLabel] = useState<string>(DEFAULT_SHIP_QUEUE_NAME);
  const [readyToShipLabelZh, setReadyToShipLabelZh] = useState<string>(DEFAULT_SHIP_QUEUE_NAME_ZH);
  const [readyToShipDays, setReadyToShipDays] = useState<number>(3);

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
        .select('id, ship_queue_name, ship_queue_name_zh, ship_queue_days')
        .eq('email', user.email)
        .single();

      if (!manufacturer) return undefined;

      setManufacturerId(manufacturer.id);
      
      // Load manufacturer's Ready to Ship settings
      if (manufacturer.ship_queue_name) {
        setReadyToShipLabel(manufacturer.ship_queue_name);
      }
      if (manufacturer.ship_queue_name_zh) {
        setReadyToShipLabelZh(manufacturer.ship_queue_name_zh);
      }
      if (manufacturer.ship_queue_days) {
        setReadyToShipDays(manufacturer.ship_queue_days);
      }
      
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


  // Batch translate all dynamic fields when orders change
  useEffect(() => {
    if (orders.length === 0) return;
    if (language === 'en') return; // Skip translation for English

    const textsToTranslate: string[] = [];
    orders.forEach(order => {
      if (order.order_name) textsToTranslate.push(order.order_name);
      if (order.client?.name) textsToTranslate.push(order.client.name);
      if (order.manufacturer?.name) textsToTranslate.push(order.manufacturer.name);
      if (order.order_products && Array.isArray(order.order_products)) {
        order.order_products.forEach(product => {
          if (product.description) textsToTranslate.push(product.description);
          if (product.product?.title) textsToTranslate.push(product.product.title);
        });
      }
    });

    if (textsToTranslate.length > 0) {
      translateBatch(textsToTranslate, 'orders');
    }
  }, [orders, language, translateBatch]);

  useEffect(() => {
    filterOrders();
  }, [searchTerm, orders, activeTab, productionSubTab, readyToShipDays]);

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
            sample_status,
            product:products(title),
            product_price,
            client_product_price,
            shipping_air_price,
            shipping_boat_price,
            client_shipping_air_price,
            client_shipping_boat_price,
            selected_shipping_method,
            estimated_ship_date
          ),
          sample_routed_to,
          sample_required,
          sample_workflow_status,
          sample_status
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
            const sampleWithAdmin = isSampleActive(order) && order.sample_routed_to === 'admin';
            const hasProductsWithAdmin = order.order_products && order.order_products.some(p => 
              p.routed_to === 'admin' && 
              p.product_status !== 'approved_for_production' &&
              p.product_status !== 'in_production' && 
              p.product_status !== 'shipped' &&
              p.product_status !== 'completed' &&
              !productHasFees(p)
            );
            return sampleWithAdmin || hasProductsWithAdmin;
          });
        } else if (isManufacturerUser) {
          filtered = ordersToFilter.filter(order => {
            const sampleWithManufacturer = isSampleActive(order) && order.sample_routed_to === 'manufacturer';
            const hasProductsWithManufacturer = order.order_products && order.order_products.some(p => 
              p.routed_to === 'manufacturer' && 
              p.product_status !== 'approved_for_production' &&
              p.product_status !== 'in_production' && 
              p.product_status !== 'shipped' &&
              p.product_status !== 'completed'
            );
            return sampleWithManufacturer || hasProductsWithManufacturer;
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
            const sampleWithManufacturer = isSampleActive(order) && order.sample_routed_to === 'manufacturer';
            const sampleWithAdmin = isSampleActive(order) && order.sample_routed_to === 'admin';
            const hasProductsRoutedToManufacturer = order.order_products && order.order_products.some(p => 
              p.routed_to === 'manufacturer' &&
              p.product_status !== 'approved_for_production' &&
              p.product_status !== 'in_production' &&
              p.product_status !== 'shipped' &&
              p.product_status !== 'completed'
            );
            const hasProductsWithAdmin = order.order_products && order.order_products.some(p => 
              p.routed_to === 'admin' && 
              p.product_status !== 'in_production' && 
              p.product_status !== 'shipped' &&
              p.product_status !== 'completed'
            );
            const somethingWithManufacturer = hasProductsRoutedToManufacturer || sampleWithManufacturer;
            const nothingWithAdmin = !hasProductsWithAdmin && !sampleWithAdmin;
            return somethingWithManufacturer && nothingWithAdmin;
          });
        } else if (isManufacturerUser) {
          filtered = ordersToFilter.filter(order => {
            const sampleWithAdmin = isSampleActive(order) && order.sample_routed_to === 'admin';
            const sampleWithManufacturer = isSampleActive(order) && order.sample_routed_to === 'manufacturer';
            const hasProductsRoutedToAdmin = order.order_products && order.order_products.some(p => 
              p.routed_to === 'admin' &&
              p.product_status !== 'approved_for_production' &&
              p.product_status !== 'in_production' &&
              p.product_status !== 'shipped' &&
              p.product_status !== 'completed'
            );
            const hasProductsWithManufacturer = order.order_products && order.order_products.some(p => 
              p.routed_to === 'manufacturer' && 
              p.product_status !== 'in_production' && 
              p.product_status !== 'shipped' &&
              p.product_status !== 'completed'
            );
            const somethingWithAdmin = hasProductsRoutedToAdmin || sampleWithAdmin;
            const nothingWithManufacturer = !hasProductsWithManufacturer && !sampleWithManufacturer;
            return somethingWithAdmin && nothingWithManufacturer;
          });
        }
        break;

      case 'production_status':
        if (productionSubTab === 'sample_approved') {
          filtered = ordersToFilter.filter(order => {
            if (order.sample_status === 'sample_approved' || order.sample_status === 'approved') {
              return true;
            }
            if (order.order_products && order.order_products.some(p => 
              p.sample_status === 'approved' || p.sample_status === 'sample_approved'
            )) {
              return true;
            }
            return false;
          });
        } else if (productionSubTab === 'approved_for_production') {
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
        }
        break;

      // Ready to Ship tab - products in_production within threshold days
      case 'ready_to_ship':
        filtered = ordersToFilter.filter(order => {
          if (!order.order_products || order.order_products.length === 0) return false;
          return order.order_products.some(p => 
            p.product_status === 'in_production' &&
            isWithinShipThreshold(p.estimated_ship_date, readyToShipDays)
          );
        });
        break;

      case 'shipped':
        filtered = ordersToFilter.filter(order => {
          if (!order.order_products || order.order_products.length === 0) return false;
          return order.order_products.some(p => 
            p.product_status === 'shipped' || p.product_status === 'completed'
          );
        });
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
        sample_approved: 0,
        approved_for_production: 0,
        in_production: 0,
        ready_to_ship: 0,
        shipped: 0,
        production_total: 0
      };
    }
    
    let productCounts: TabCounts = {
      my_orders: 0,
      invoice_approval: 0,
      sent_to_other: 0,
      sample_approved: 0,
      approved_for_production: 0,
      in_production: 0,
      ready_to_ship: 0,
      shipped: 0,
      production_total: 0
    };

    orders.forEach(order => {
      // Count order-level sample routing ONLY if sample is active
      if (isSampleActive(order) && order.sample_routed_to) {
        if (isAdminUser) {
          if (order.sample_routed_to === 'admin') {
            productCounts.my_orders++;
          } else if (order.sample_routed_to === 'manufacturer') {
            productCounts.sent_to_other++;
          }
        } else if (isManufacturerUser) {
          if (order.sample_routed_to === 'manufacturer') {
            productCounts.my_orders++;
          } else if (order.sample_routed_to === 'admin') {
            productCounts.sent_to_other++;
          }
        }
      }
      
      // Count ORDER-level sample approved
      if (order.sample_status === 'sample_approved' || order.sample_status === 'approved') {
        productCounts.sample_approved++;
      }
      
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
        
        // Count sample approved products (backwards compatibility)
        if (product.sample_status === 'approved' || product.sample_status === 'sample_approved') {
          productCounts.sample_approved++;
        }
        
        if (product.product_status === 'approved_for_production' || 
            product.product_status === 'ready_for_production') {
          productCounts.approved_for_production++;
        }
        
        if (product.product_status === 'in_production') {
          productCounts.in_production++;
          
          // Also count for ready_to_ship if within threshold
          if (isWithinShipThreshold(product.estimated_ship_date, readyToShipDays)) {
            productCounts.ready_to_ship++;
          }
        }
        
        if (product.product_status === 'shipped' || 
            product.product_status === 'completed') {
          productCounts.shipped++;
        }
      });
    });

    productCounts.production_total = productCounts.sample_approved +
                                     productCounts.approved_for_production + 
                                     productCounts.in_production;

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

  /**
   * Delete order and ALL related records in correct order
   * Tables that reference orders (deleted in dependency order):
   * 1. invoice_items -> invoices
   * 2. invoices -> orders
   * 3. email_history -> orders
   * 4. order_media -> order_products, orders
   * 5. order_items -> order_products
   * 6. order_products -> orders
   * 7. notifications -> orders
   * 8. manufacturer_notifications -> orders
   * 9. manufacturer_views -> orders
   * 10. workflow_log -> orders
   * 11. order_margins -> orders
   * 12. orders_backup_numbers -> orders
   * 13. client_admin_notes -> orders
   * 14. audit_log (by target_id)
   * 15. orders (finally)
   */
  const handleDeleteOrder = async (orderId: string) => {
    try {
      setDeletingOrder(orderId);
      
      // 1. Get all order_products for this order
      const { data: orderProducts, error: fetchError } = await supabase
        .from('order_products')
        .select('id')
        .eq('order_id', orderId);

      if (fetchError) {
        console.error('Error fetching order products:', fetchError);
        throw fetchError;
      }

      const productIds = orderProducts?.map(p => p.id) || [];

      // 2. Get all invoices for this order (need their IDs for invoice_items)
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('order_id', orderId);
      
      const invoiceIds = invoices?.map(i => i.id) || [];

      // 3. Delete invoice_items first (references invoices)
      if (invoiceIds.length > 0) {
        const { error: invoiceItemsError } = await supabase
          .from('invoice_items')
          .delete()
          .in('invoice_id', invoiceIds);
        
        if (invoiceItemsError) {
          console.warn('Error deleting invoice_items:', invoiceItemsError);
        }
      }

      // 4. Delete invoices (references orders)
      const { error: invoicesError } = await supabase
        .from('invoices')
        .delete()
        .eq('order_id', orderId);
      
      if (invoicesError) {
        console.warn('Error deleting invoices:', invoicesError);
      }

      // 5. Delete email_history
      try {
        await supabase.from('email_history').delete().eq('order_id', orderId);
      } catch (e) {
        console.warn('Error deleting email_history:', e);
      }

      // 6. Delete order_media for products
      if (productIds.length > 0) {
        await supabase.from('order_media').delete().in('order_product_id', productIds);
      }

      // 7. Delete order_media for order itself
      await supabase.from('order_media').delete().eq('order_id', orderId);

      // 8. Delete order_items (references order_products)
      if (productIds.length > 0) {
        await supabase.from('order_items').delete().in('order_product_id', productIds);
      }

      // 9. Delete order_products
      await supabase.from('order_products').delete().eq('order_id', orderId);

      // 10. Delete notifications
      await supabase.from('notifications').delete().eq('order_id', orderId);

      // 11. Delete manufacturer_notifications
      try {
        await supabase.from('manufacturer_notifications').delete().eq('order_id', orderId);
      } catch (e) {
        console.warn('Error deleting manufacturer_notifications:', e);
      }

      // 12. Delete manufacturer_views
      try {
        await supabase.from('manufacturer_views').delete().eq('order_id', orderId);
      } catch (e) {
        console.warn('Error deleting manufacturer_views:', e);
      }

      // 13. Delete workflow_log
      try {
        await supabase.from('workflow_log').delete().eq('order_id', orderId);
      } catch (e) {
        console.warn('Error deleting workflow_log:', e);
      }

      // 14. Delete order_margins
      try {
        await supabase.from('order_margins').delete().eq('order_id', orderId);
      } catch (e) {
        console.warn('Error deleting order_margins:', e);
      }

      // 15. Delete orders_backup_numbers
      try {
        await supabase.from('orders_backup_numbers').delete().eq('order_id', orderId);
      } catch (e) {
        console.warn('Error deleting orders_backup_numbers:', e);
      }

      // 16. Delete client_admin_notes
      try {
        await supabase.from('client_admin_notes').delete().eq('order_id', orderId);
      } catch (e) {
        console.warn('Error deleting client_admin_notes:', e);
      }

      // 17. Delete audit_log entries (for order and all products)
      try {
        if (productIds.length > 0) {
          await supabase
            .from('audit_log')
            .delete()
            .or(`target_id.eq.${orderId},target_id.in.(${productIds.join(',')})`);
        } else {
          await supabase.from('audit_log').delete().eq('target_id', orderId);
        }
      } catch (e) {
        console.warn('Error deleting audit_log:', e);
      }

      // 18. Finally delete the order itself
      const { error: orderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);
      
      if (orderError) {
        console.error('Order delete error:', JSON.stringify(orderError), orderError.message, orderError.code);
        throw orderError;
      }

      // Success - update local state
      setOrders(prev => prev.filter(order => order.id !== orderId));
      setFilteredOrders(prev => prev.filter(order => order.id !== orderId));
      setShowDeleteConfirm(null);
      
    } catch (error: any) {
      console.error('Error deleting order:', JSON.stringify(error), error?.message, error?.code);
      let errorMessage = 'Error deleting order. ';
      if (error?.message?.includes('foreign key')) {
        errorMessage += 'There are still related records that need to be deleted first.';
      } else if (error?.message) {
        errorMessage += error.message;
      } else if (error?.code) {
        errorMessage += `Error code: ${error.code}`;
      } else {
        errorMessage += 'Please try again.';
      }
      alert(errorMessage);
    } finally {
      setDeletingOrder(null);
    }
  };

  // Get the display label for Ready to Ship tab (handles language)
  const getReadyToShipDisplayLabel = (): string => {
    if (language === 'zh') {
      // Return Chinese label (custom or default)
      return readyToShipLabelZh || DEFAULT_SHIP_QUEUE_NAME_ZH;
    }
    // Return English label (custom or default)
    return readyToShipLabel || DEFAULT_SHIP_QUEUE_NAME;
  };

  const getOrderRoutingStatus = (order: Order) => {
    if (!order.order_products || order.order_products.length === 0) {
      return { status: 'no_products', label: t('products'), color: 'gray' };
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
    
    const sampleApproved = products.filter(p => p.sample_status === 'approved').length;
    const approvedForProduction = products.filter(p => 
      p.product_status === 'approved_for_production' || 
      p.product_status === 'ready_for_production'
    ).length;
    const inProduction = products.filter(p => p.product_status === 'in_production').length;
    const shipped = products.filter(p => 
      p.product_status === 'shipped' || p.product_status === 'completed'
    ).length;
    
    // Count ready to ship
    const readyToShipCount = products.filter(p => 
      p.product_status === 'in_production' &&
      isWithinShipThreshold(p.estimated_ship_date, readyToShipDays)
    ).length;
    
    if (activeTab === 'my_orders') {
      if (isAdminUser) {
        const sampleCount = (isSampleActive(order) && order.sample_routed_to === 'admin') ? 1 : 0;
        const totalWithAdmin = withAdmin + sampleCount;
        return { status: 'with_admin', label: `${totalWithAdmin} ${t('withAdmin')}`, color: 'purple' };
      } else {
        const sampleCount = (isSampleActive(order) && order.sample_routed_to === 'manufacturer') ? 1 : 0;
        const totalWithManufacturer = withManufacturer + sampleCount;
        return { status: 'with_manufacturer', label: `${totalWithManufacturer} ${t('needAction')}`, color: 'indigo' };
      }
    } else if (activeTab === 'sent_to_other') {
      if (isAdminUser) {
        const sampleCount = (isSampleActive(order) && order.sample_routed_to === 'manufacturer') ? 1 : 0;
        const totalWithManufacturer = withManufacturer + sampleCount;
        return { status: 'with_manufacturer', label: `${totalWithManufacturer} ${t('withManufacturer')}`, color: 'indigo' };
      } else {
        const sampleCount = (isSampleActive(order) && order.sample_routed_to === 'admin') ? 1 : 0;
        const totalWithAdmin = withAdmin + sampleCount;
        return { status: 'with_admin', label: `${totalWithAdmin} ${t('withAdmin')}`, color: 'purple' };
      }
    } else if (activeTab === 'invoice_approval') {
      return { status: 'with_fees', label: `${withFees} ${t('productsWithFees')}`, color: 'amber' };
    } else if (activeTab === 'production_status') {
      if (productionSubTab === 'sample_approved') {
        return { status: 'sample_approved', label: `${sampleApproved} ${t('sampleApproved')}`, color: 'amber' };
      } else if (productionSubTab === 'approved_for_production') {
        return { status: 'approved', label: `${approvedForProduction} ${t('approvedForProd')}`, color: 'green' };
      } else if (productionSubTab === 'in_production') {
        return { status: 'in_production', label: `${inProduction} ${t('inProduction')}`, color: 'blue' };
      }
    } else if (activeTab === 'ready_to_ship') {
      // Ready to ship status - use display label based on language
      return { status: 'ready_to_ship', label: `${readyToShipCount} ${getReadyToShipDisplayLabel()}`, color: 'orange' };
    } else if (activeTab === 'shipped') {
      return { status: 'shipped', label: `${shipped} ${t('shipped')}`, color: 'green' };
    }
    
    return { status: 'mixed', label: `${products.length} ${t('products')}`, color: 'gray' };
  };

  const getProductRoutingBadge = (product: any) => {
    const isWithMe = (userRole === 'manufacturer' && product.routed_to === 'manufacturer') ||
                     (userRole !== 'manufacturer' && product.routed_to === 'admin');

    if (product.product_status === 'completed') {
      return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">{t('completed')}</span>;
    }
    if (product.product_status === 'approved_for_production') {
      return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">{t('approvedForProd')}</span>;
    }
    if (product.product_status === 'in_production') {
      return <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{t('inProduction')}</span>;
    }
    if (product.product_status === 'shipped') {
      return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">{t('shipped')}</span>;
    }
    
    return (
      <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
        isWithMe ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
      }`}>
        {product.routed_to === 'admin' ? (
          <>
            <Users className="w-3 h-3" />
            {t('withAdmin')}
          </>
        ) : (
          <>
            <Building className="w-3 h-3" />
            {t('withManufacturer')}
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
        orderNumber={
          (() => {
            const order = orders.find(o => o.id === showDeleteConfirm);
            if (!order) return '';
            // Translate order name, client name, manufacturer name for modal
            const name = order.order_name ? translate(order.order_name) : t('untitledOrder');
            const client = order.client?.name ? translate(order.client.name) : '';
            const manufacturer = order.manufacturer?.name ? translate(order.manufacturer.name) : '';
            // Combine for display
            return `${name}${client ? ' • ' + client : ''}${manufacturer ? ' • ' + manufacturer : ''} (${formatOrderNumber(order.order_number)})`;
          })()
        }
        userRole={userRole}
        isDeleting={deletingOrder === showDeleteConfirm}
        t={t}
        onConfirm={() => showDeleteConfirm && handleDeleteOrder(showDeleteConfirm)}
        onCancel={() => setShowDeleteConfirm(null)}
      />

      {/* Header */}
      
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {userRole === 'manufacturer' ? t('yourOrders') : t('orders')}
          </h1>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Language Switcher - Only on Orders pages */}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'zh')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer"
              style={{ minWidth: 90 }}
            >
              <option value="en">🇺🇸 EN</option>
              <option value="zh">🇨🇳 中文</option>
            </select>

            {(userRole === 'admin' || userRole === 'super_admin' || userRole === 'order_creator') && (
              <Link
                href="/dashboard/orders/create"
                className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="whitespace-nowrap">{t('newOrder')}</span>
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
            t={t}
            onTabChange={setActiveTab}
            onProductionTabClick={() => {
              setActiveTab('production_status');
              setProductionSubTab('sample_approved');
            }}
            readyToShipLabel={getReadyToShipDisplayLabel()}
          />
        )}

        {/* Production Sub-Tabs - Only show when production_status is active */}
        {activeTab === 'production_status' && (
          <ProductionSubTabs
            activeSubTab={productionSubTab}
            tabCounts={tabCounts}
            t={t}
            onSubTabChange={setProductionSubTab}
          />
        )}

        {/* Search and Price Toggle */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base text-gray-900 placeholder-gray-500"
              />
            </div>
          </div>

          {(userRole === 'admin' || userRole === 'super_admin') && activeTab !== 'invoice_approval' && (
            <button
              onClick={() => setShowPrices(!showPrices)}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base flex-shrink-0"
              title={showPrices ? t('hidePrices') : t('showPrices')}
            >
              {showPrices ? (
                <>
                  <EyeOff className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  <span className="text-gray-700 whitespace-nowrap">{t('hidePrices')}</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  <span className="text-gray-700 whitespace-nowrap">{t('showPrices')}</span>
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
          t={t}
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
                    {t('order')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {userRole === 'manufacturer' ? t('client') : t('clientMfr')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('products')}
                  </th>
                  {(userRole === 'admin' || userRole === 'super_admin') && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('clientTotal')}
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('created')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('actions')}
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
                            <div>s
                              <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                {order.order_name ? translate(order.order_name) : t('untitledOrder')}
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
                            <div className="text-sm text-gray-900">{order.client?.name ? translate(order.client.name) : '-'}</div>
                            {userRole !== 'manufacturer' && (
                              <div className="text-xs text-gray-500">{order.manufacturer?.name ? translate(order.manufacturer.name) : '-'}</div>
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
                                title={t('editOrder')}
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
                              title={t('viewDetails')}
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
                                          {product.description ? translate(product.description) : (product.product?.title ? translate(product.product.title) : t('product'))}
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
              const canDelete = canDeleteOrder(order);
              const visibleProducts = order.order_products;

              return (
                <div
                  key={order.id}
                  className={`p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors ${hasUnreadNotification ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                >
                  {/* Header Row */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0" onClick={() => navigateToOrder(order.id)}>
                      <div className="font-semibold text-base text-gray-900 flex items-center gap-2 mb-1">
                        <span className="truncate">{order.order_name ? translate(order.order_name) : t('untitledOrder')}</span>
                        {hasUnreadNotification && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse flex-shrink-0"></span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mb-1">
                        {formatOrderNumber(order.order_number)}
                        {visibleProducts && (
                          <span className="ml-2">• {visibleProducts.length} {language === 'zh' ? '产品' : `product${visibleProducts.length !== 1 ? 's' : ''}`}</span>
                        )}
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 text-xs rounded-full bg-${routingStatus.color}-100 text-${routingStatus.color}-700 flex-shrink-0 ml-2`}>
                      {routingStatus.label}
                    </span>
                  </div>

                  {/* Client and Manufacturer Info */}
                  <div className="mb-3 text-sm" onClick={() => navigateToOrder(order.id)}>
                    <div className="flex items-center gap-1.5 text-gray-700 mb-1">
                      <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="font-medium">{order.client?.name ? translate(order.client.name) : '-'}</span>
                    </div>
                    {userRole !== 'manufacturer' && order.manufacturer?.name && (
                      <div className="flex items-center gap-1.5 text-gray-600 text-xs pl-5">
                        <Building className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span>{order.manufacturer?.name ? translate(order.manufacturer.name) : '-'}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer Row - Date, Total, Actions */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500" onClick={() => navigateToOrder(order.id)}>
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(order.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {(userRole === 'admin' || userRole === 'super_admin') && orderTotal > 0 && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full inline-flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {showPrices ? formatCurrencyWithLanguage(orderTotal, language).replace(/[$¥]/, '') : 'XXXXX'}
                        </span>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1">
                        {order.status === 'draft' && (userRole === 'admin' || userRole === 'super_admin' || userRole === 'order_creator') && (
                          <Link
                            href={`/dashboard/orders/edit/${order.id}`}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title={t('editOrder')}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                        )}
                        {canDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(order.id);
                            }}
                            className={`p-2 rounded-lg ${
                              userRole === 'super_admin'
                                ? 'text-red-600 hover:bg-red-50'
                                : 'text-gray-900 hover:bg-gray-100'
                            }`}
                            title={userRole === 'super_admin' ? 'Delete (Super Admin)' : 'Delete (Draft Only)'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => navigateToOrder(order.id)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                          title={t('viewDetails')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">{t('noOrders')}</h3>
              <p className="mt-1 text-sm text-gray-500">
                {activeTab === 'production_status'
                  ? t('noProductionOrders')
                  : activeTab === 'ready_to_ship'
                  ? `No products ${getReadyToShipDisplayLabel().toLowerCase()} yet.`
                  : activeTab === 'shipped'
                  ? t('noProductionOrders')
                  : (userRole === 'manufacturer' || userRole === 'admin' || userRole === 'super_admin')
                    ? activeTab === 'my_orders' 
                      ? t('noOrdersMessage')
                      : `${t('noOrders')} in ${activeTab.replace('_', ' ')}`
                    : searchTerm
                      ? t('tryAdjustingSearch')
                      : t('getStarted')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}