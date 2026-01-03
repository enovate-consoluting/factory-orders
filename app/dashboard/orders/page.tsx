/**
 * Orders Listing Page - /dashboard/orders
 * Displays all orders with tabbed interface for different order states
 * Roles: Admin, Super Admin, Manufacturer, Client
 * REFACTORED: Extracted translations, calculations, types, modals, tabs, and views
 * UPDATED: Ready to Ship tab reads from per-manufacturer settings with Chinese support
 * FIXED: handleDeleteOrder now deletes all related records (invoices, email_history, etc.)
 * ADDED: Client Requests tab for admin to review client-submitted order requests
 * FIXED: My Orders tab hides entire order when sample is approved/in_production (Dec 5 2025)
 * FIXED: Tab counts now count PRODUCTS correctly - products counted regardless of sample status (Dec 8 2025)
 * FIXED: Badge display shows products + sample separately (Dec 8 2025)
 * FIXED: Translation fallback when t() returns key itself (Dec 8 2025)
 * ADDED: Layout toggle for V1 (Classic) vs V2 (New) order detail page (Dec 8 2025)
 * Last Modified: Dec 8 2025
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
  EyeOff, FlaskConical
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

// Helper function to check if sample is in production phase (approved or in_production)
const isSampleInProductionPhase = (order: Order): boolean => {
  return isSampleActive(order) && 
    (order.sample_status === 'sample_approved' || 
     order.sample_status === 'approved' ||
     order.sample_status === 'in_production' ||
     order.sample_status === 'sample_in_production');
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

  // Helper to get label with proper fallback
  // If t() returns the key itself (like 'sampleInProduction'), use the fallback
  const getTranslation = (key: string, fallback: string): string => {
    const translated = t(key);
    // If translation returns the key itself or is empty, use fallback
    if (!translated || translated === key) {
      return fallback;
    }
    return translated;
  };

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('my_orders');
  const [productionSubTab, setProductionSubTab] = useState<ProductionSubTab>('sample_approved');

  // State for showing/hiding prices
  const [showPrices, setShowPrices] = useState(false);

  // Layout toggle removed - V2 is now permanent

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
            // Exclude client requests from my_orders
            if (order.status === 'client_request') return false;
            
            // If sample is in production phase, hide order from My Orders (it's in Production tab)
            if (isSampleInProductionPhase(order)) return false;
            
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
            // If sample is in production phase, hide order from My Orders
            if (isSampleInProductionPhase(order)) return false;
            
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

      // NEW: Client Requests tab - shows orders with status = 'client_request'
      case 'client_requests':
        if (isAdminUser) {
          filtered = ordersToFilter.filter(order => order.status === 'client_request');
        }
        break;

      case 'invoice_approval':
        if (isAdminUser || isClientUser) {
          filtered = ordersToFilter.filter(order => {
            if (!order.order_products || order.order_products.length === 0) return false;
            // Exclude client requests
            if (order.status === 'client_request') return false;
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
            // Exclude client requests
            if (order.status === 'client_request') return false;
            
            // Check what's with manufacturer (sample not in production phase)
            const sampleWithManufacturer = isSampleActive(order) && 
              !isSampleInProductionPhase(order) && 
              order.sample_routed_to === 'manufacturer';
            
            const hasProductsWithManufacturer = order.order_products && order.order_products.some(p => 
              p.routed_to === 'manufacturer' &&
              p.product_status !== 'approved_for_production' &&
              p.product_status !== 'in_production' &&
              p.product_status !== 'shipped' &&
              p.product_status !== 'completed'
            );
            
            return sampleWithManufacturer || hasProductsWithManufacturer;
          });
        } else if (isManufacturerUser) {
          filtered = ordersToFilter.filter(order => {
            const sampleWithAdmin = isSampleActive(order) && 
              !isSampleInProductionPhase(order) && 
              order.sample_routed_to === 'admin';
            
            const hasProductsWithAdmin = order.order_products && order.order_products.some(p => 
              p.routed_to === 'admin' &&
              p.product_status !== 'approved_for_production' &&
              p.product_status !== 'in_production' &&
              p.product_status !== 'shipped' &&
              p.product_status !== 'completed'
            );
            
            return sampleWithAdmin || hasProductsWithAdmin;
          });
        }
        break;

      case 'production_status':
        if (productionSubTab === 'sample_approved') {
          filtered = ordersToFilter.filter(order => {
            // Exclude client requests
            if (order.status === 'client_request') return false;
            
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
        } else if (productionSubTab === 'sample_in_production') {
          filtered = ordersToFilter.filter(order => {
            // Exclude client requests
            if (order.status === 'client_request') return false;
            
            if (order.sample_status === 'sample_in_production' || order.sample_status === 'in_production') {
              return true;
            }
            if (order.order_products && order.order_products.some(p => 
              p.sample_status === 'in_production' || p.sample_status === 'sample_in_production'
            )) {
              return true;
            }
            return false;
          });
        } else if (productionSubTab === 'approved_for_production') {
          filtered = ordersToFilter.filter(order => {
            if (!order.order_products || order.order_products.length === 0) return false;
            // Exclude client requests
            if (order.status === 'client_request') return false;
            return order.order_products.some(p => 
              p.product_status === 'approved_for_production' || 
              p.product_status === 'ready_for_production'
            );
          });
        } else if (productionSubTab === 'in_production') {
          filtered = ordersToFilter.filter(order => {
            if (!order.order_products || order.order_products.length === 0) return false;
            // Exclude client requests
            if (order.status === 'client_request') return false;
            return order.order_products.some(p => p.product_status === 'in_production');
          });
        }
        break;

      // Ready to Ship tab - products in_production within threshold days
      case 'ready_to_ship':
        filtered = ordersToFilter.filter(order => {
          if (!order.order_products || order.order_products.length === 0) return false;
          // Exclude client requests
          if (order.status === 'client_request') return false;
          return order.order_products.some(p => 
            p.product_status === 'in_production' &&
            isWithinShipThreshold(p.estimated_ship_date, readyToShipDays)
          );
        });
        break;

      case 'shipped':
        filtered = ordersToFilter.filter(order => {
          // Exclude client requests
          if (order.status === 'client_request') return false;
          
          // Check if any product is shipped
          const hasShippedProduct = order.order_products?.some(p => 
            p.product_status === 'shipped' || p.product_status === 'completed'
          );
          
          // Check if sample is shipped
          const hasSampleShipped = order.sample_status === 'shipped' || 
                                   order.sample_shipped_date;
          
          return hasShippedProduct || hasSampleShipped;
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
      // When searching, search across ALL orders (ignore tab filter)
      filtered = filtered.filter(order =>
        formatOrderNumber(order.order_number).toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.client?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.manufacturer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.order_name && order.order_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      // Skip tab filter when searching - show results from any tab
      setFilteredOrders(filtered);
      return;
    }

    filtered = getTabFilteredOrders(filtered);
    setFilteredOrders(filtered);
  };

  /**
   * FIXED: Tab counts now properly count PRODUCTS across ALL orders
   * - my_orders: sum of products with me (across all orders) + samples with me
   * - sent_to_other: sum of products with other (across all orders) + samples with other
   * - invoice_approval: count of ORDERS with products needing approval
   * - Products are counted regardless of sample status (sample status only affects sample count)
   */
  const getTabCounts = (): TabCounts => {
    const isAdminUser = userRole === 'admin' || userRole === 'super_admin';
    const isManufacturerUser = userRole === 'manufacturer';
    const isClientUser = userRole === 'client';
    
    if (!isAdminUser && !isManufacturerUser && !isClientUser) {
      return {
        my_orders: 0,
        client_requests: 0,
        invoice_approval: 0,
        sent_to_other: 0,
        sample_approved: 0,
        sample_in_production: 0,
        approved_for_production: 0,
        in_production: 0,
        ready_to_ship: 0,
        shipped: 0,
        production_total: 0
      };
    }
    
    let counts: TabCounts = {
      my_orders: 0,
      client_requests: 0,
      invoice_approval: 0,
      sent_to_other: 0,
      sample_approved: 0,
      sample_in_production: 0,
      approved_for_production: 0,
      in_production: 0,
      ready_to_ship: 0,
      shipped: 0,
      production_total: 0
    };

    orders.forEach(order => {
      // Count client requests - Admin only
      if (order.status === 'client_request') {
        if (isAdminUser) {
          counts.client_requests++;
        }
        return; // Skip client requests for other counts
      }
      
      // Check if sample is in production phase
      const sampleInProdPhase = isSampleInProductionPhase(order);
      
      // PRODUCTION TABS: Count orders with sample in progress
      if (sampleInProdPhase) {
        if (order.sample_status === 'sample_approved' || order.sample_status === 'approved') {
          counts.sample_approved++;
        }
        if (order.sample_status === 'sample_in_production' || order.sample_status === 'in_production') {
          counts.sample_in_production++;
        }
      }
      
      // COUNT PRODUCTS - regardless of sample status
      // Products should be counted based on their own routed_to and product_status
      if (order.order_products) {
        order.order_products.forEach(product => {
          const isInWorkflow = 
            product.product_status !== 'approved_for_production' &&
            product.product_status !== 'in_production' &&
            product.product_status !== 'shipped' &&
            product.product_status !== 'completed';
          
          if (isAdminUser) {
            // MY_ORDERS: products with admin (no fees)
            if (product.routed_to === 'admin' && isInWorkflow && !productHasFees(product)) {
              // Only count if sample is NOT in production (order would be hidden)
              if (!sampleInProdPhase) {
                counts.my_orders++;
              }
            }
            
            // SENT_TO_OTHER: products with manufacturer
            if (product.routed_to === 'manufacturer' && isInWorkflow) {
              counts.sent_to_other++;
            }
          } else if (isManufacturerUser) {
            // MY_ORDERS: products with manufacturer
            if (product.routed_to === 'manufacturer' && isInWorkflow) {
              // Only count if sample is NOT in production (order would be hidden)
              if (!sampleInProdPhase) {
                counts.my_orders++;
              }
            }
            
            // SENT_TO_OTHER: products with admin
            if (product.routed_to === 'admin' && isInWorkflow) {
              counts.sent_to_other++;
            }
          }
          
          // Production counts
          if (product.product_status === 'approved_for_production' || 
              product.product_status === 'ready_for_production') {
            counts.approved_for_production++;
          }
          
          if (product.product_status === 'in_production') {
            counts.in_production++;
            
            if (isWithinShipThreshold(product.estimated_ship_date, readyToShipDays)) {
              counts.ready_to_ship++;
            }
          }
          
          if (product.product_status === 'shipped' || 
              product.product_status === 'completed') {
            counts.shipped++;
          }
        });
      }
      
      // COUNT SHIPPED SAMPLES - add to shipped count
      if (order.sample_status === 'shipped' || order.sample_shipped_date) {
        counts.shipped++;
      }
      
      // COUNT SAMPLES - only if not in production phase
      if (!sampleInProdPhase && isSampleActive(order)) {
        if (isAdminUser) {
          if (order.sample_routed_to === 'admin') {
            counts.my_orders++;
          } else if (order.sample_routed_to === 'manufacturer') {
            counts.sent_to_other++;
          }
        } else if (isManufacturerUser) {
          if (order.sample_routed_to === 'manufacturer') {
            counts.my_orders++;
          } else if (order.sample_routed_to === 'admin') {
            counts.sent_to_other++;
          }
        }
      }
      
      // INVOICE_APPROVAL: Count ORDERS (not products) if it has products with fees
      if (isAdminUser || isClientUser) {
        const hasProductsWithFees = order.order_products?.some(p => 
          p.routed_to === 'admin' && 
          productHasFees(p) &&
          p.product_status !== 'approved_for_production' &&
          p.product_status !== 'in_production' &&
          p.product_status !== 'shipped'
        );
        if (hasProductsWithFees) {
          counts.invoice_approval++;
        }
      }
    });

    counts.production_total = counts.sample_approved +
                              counts.sample_in_production +
                              counts.approved_for_production + 
                              counts.in_production;

    return counts;
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
    // Navigate to order detail
    const path = `/dashboard/orders/${orderId}`;
    window.open(path, '_blank');
  };

  const canDeleteOrder = (order: Order): boolean => {
    if (userRole === 'super_admin') return true;
    if (userRole === 'admin' && order.status === 'draft') return true;
    // Admin can also delete client requests
    if (userRole === 'admin' && order.status === 'client_request') return true;
    return false;
  };

  /**
   * Delete order and ALL related records in correct order
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
      return readyToShipLabelZh || DEFAULT_SHIP_QUEUE_NAME_ZH;
    }
    return readyToShipLabel || DEFAULT_SHIP_QUEUE_NAME;
  };

  /**
   * Get order routing status for badge display
   * Returns separate counts for products and sample
   */
  const getOrderRoutingStatus = (order: Order) => {
    if (!order.order_products || order.order_products.length === 0) {
      return { 
        status: 'no_products', 
        productCount: 0,
        productLabel: t('products'),
        hasSample: false,
        color: 'gray' 
      };
    }

    const products = order.order_products;
    const isAdminUser = userRole === 'admin' || userRole === 'super_admin';
    
    // Count products by routing status (excluding production statuses)
    const withAdmin = products.filter(p => 
      p.routed_to === 'admin' && 
      p.product_status !== 'shipped' && 
      p.product_status !== 'completed' &&
      p.product_status !== 'approved_for_production' &&
      p.product_status !== 'in_production'
    ).length;
    
    // For My Orders tab: only count products with admin that have NO fees
    const withAdminNoFees = products.filter(p => 
      p.routed_to === 'admin' && 
      p.product_status !== 'shipped' && 
      p.product_status !== 'completed' &&
      p.product_status !== 'approved_for_production' &&
      p.product_status !== 'in_production' &&
      !productHasFees(p)
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
    
    const readyToShipCount = products.filter(p => 
      p.product_status === 'in_production' &&
      isWithinShipThreshold(p.estimated_ship_date, readyToShipDays)
    ).length;

    // Check sample status (only if not in production)
    const sampleNotInProd = isSampleActive(order) && !isSampleInProductionPhase(order);
    const sampleWithAdmin = sampleNotInProd && order.sample_routed_to === 'admin';
    const sampleWithManufacturer = sampleNotInProd && order.sample_routed_to === 'manufacturer';
    
    // MY ORDERS tab - use withAdminNoFees (products without fees)
    if (activeTab === 'my_orders') {
      if (isAdminUser) {
        return { 
          status: 'with_admin', 
          productCount: withAdminNoFees,
          productLabel: getTranslation('withAdmin', 'with Admin'),
          hasSample: sampleWithAdmin,
          color: 'purple' 
        };
      } else {
        return { 
          status: 'with_manufacturer', 
          productCount: withManufacturer,
          productLabel: getTranslation('needAction', 'Need Action'),
          hasSample: sampleWithManufacturer,
          color: 'indigo' 
        };
      }
    } 
    
    // CLIENT REQUESTS tab
    else if (activeTab === 'client_requests') {
      return { 
        status: 'client_request', 
        productCount: products.length,
        productLabel: getTranslation('pendingReview', 'Pending Review'),
        hasSample: false,
        color: 'teal' 
      };
    } 
    
    // SENT TO OTHER tab
    else if (activeTab === 'sent_to_other') {
      if (isAdminUser) {
        return { 
          status: 'with_manufacturer', 
          productCount: withManufacturer,
          productLabel: getTranslation('withManufacturer', 'with Manufacturer'),
          hasSample: sampleWithManufacturer,
          color: 'indigo' 
        };
      } else {
        return { 
          status: 'with_admin', 
          productCount: withAdmin,
          productLabel: getTranslation('withAdmin', 'with Admin'),
          hasSample: sampleWithAdmin,
          color: 'purple' 
        };
      }
    } 
    
    // INVOICE APPROVAL tab
    else if (activeTab === 'invoice_approval') {
      return { 
        status: 'with_fees', 
        productCount: withFees,
        productLabel: getTranslation('productsWithFees', 'products with fees'),
        hasSample: false,
        color: 'amber' 
      };
    } 
    
    // PRODUCTION STATUS tab
    else if (activeTab === 'production_status') {
      
      // SAMPLE APPROVED sub-tab
      if (productionSubTab === 'sample_approved') {
        return { 
          status: 'sample_approved', 
          productCount: 0,
          productLabel: getTranslation('sampleApproved', 'Sample Approved'),
          hasSample: false,
          color: 'amber' 
        };
      } 
      
      // SAMPLE IN PRODUCTION sub-tab - FIXED: use getTranslation helper
      else if (productionSubTab === 'sample_in_production') {
        return { 
          status: 'sample_in_production', 
          productCount: 0,
          productLabel: getTranslation('sampleInProduction', 'Sample In Production'),
          hasSample: false,
          color: 'purple' 
        };
      } 
      
      // APPROVED FOR PRODUCTION sub-tab
      else if (productionSubTab === 'approved_for_production') {
        return { 
          status: 'approved', 
          productCount: approvedForProduction,
          productLabel: getTranslation('approvedForProd', 'Approved for Prod'),
          hasSample: false,
          color: 'green' 
        };
      } 
      
      // IN PRODUCTION sub-tab
      else if (productionSubTab === 'in_production') {
        return { 
          status: 'in_production', 
          productCount: inProduction,
          productLabel: getTranslation('inProduction', 'In Production'),
          hasSample: false,
          color: 'blue' 
        };
      }
    } 
    
    // READY TO SHIP tab
    else if (activeTab === 'ready_to_ship') {
      return { 
        status: 'ready_to_ship', 
        productCount: readyToShipCount,
        productLabel: getReadyToShipDisplayLabel(),
        hasSample: false,
        color: 'orange' 
      };
    } 
    
    // SHIPPED tab
    else if (activeTab === 'shipped') {
      return { 
        status: 'shipped', 
        productCount: shipped,
        productLabel: getTranslation('shipped', 'Shipped'),
        hasSample: false,
        color: 'green' 
      };
    }
    
    return { 
      status: 'mixed', 
      productCount: products.length,
      productLabel: t('products'),
      hasSample: false,
      color: 'gray' 
    };
  };

  const getProductRoutingBadge = (product: any) => {
    const isWithMe = (userRole === 'manufacturer' && product.routed_to === 'manufacturer') ||
                     (userRole !== 'manufacturer' && product.routed_to === 'admin');

    if (product.product_status === 'completed') {
      return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">{getTranslation('completed', 'Completed')}</span>;
    }
    if (product.product_status === 'approved_for_production') {
      return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">{getTranslation('approvedForProd', 'Approved for Prod')}</span>;
    }
    if (product.product_status === 'in_production') {
      return <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{getTranslation('inProduction', 'In Production')}</span>;
    }
    if (product.product_status === 'shipped') {
      return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">{getTranslation('shipped', 'Shipped')}</span>;
    }
    
    return (
      <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
        isWithMe ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
      }`}>
        {product.routed_to === 'admin' ? (
          <>
            <Users className="w-3 h-3" />
            {getTranslation('withAdmin', 'with Admin')}
          </>
        ) : (
          <>
            <Building className="w-3 h-3" />
            {getTranslation('withManufacturer', 'with Manufacturer')}
          </>
        )}
        {product.product_status === 'question_for_admin' && (
          <AlertCircle className="w-3 h-3 text-amber-500" />
        )}
      </span>
    );
  };

  /**
   * Render the routing status badges for an order
   * Shows TWO badges when both products and sample are present
   */
  const renderRoutingBadges = (order: Order) => {
    const routingStatus = getOrderRoutingStatus(order);
    
    // For production tabs (sample_approved, sample_in_production), just show one badge
    if (activeTab === 'production_status' && 
        (productionSubTab === 'sample_approved' || productionSubTab === 'sample_in_production')) {
      return (
        <span className={`px-2 py-1 text-xs rounded-full bg-${routingStatus.color}-100 text-${routingStatus.color}-700`}>
          {routingStatus.productLabel}
        </span>
      );
    }
    
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {/* Products badge - only show if there are products */}
        {routingStatus.productCount > 0 && (
          <span className={`px-2 py-1 text-xs rounded-full bg-${routingStatus.color}-100 text-${routingStatus.color}-700`}>
            {routingStatus.productCount} {routingStatus.productLabel}
          </span>
        )}
        
        {/* Sample badge - show separately if sample is with this party */}
        {routingStatus.hasSample && (
          <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
            <FlaskConical className="w-3 h-3" />
            {getTranslation('sample', 'Sample')}
          </span>
        )}
        
        {/* If no products and no sample, show generic */}
        {routingStatus.productCount === 0 && !routingStatus.hasSample && (
          <span className={`px-2 py-1 text-xs rounded-full bg-${routingStatus.color}-100 text-${routingStatus.color}-700`}>
            {routingStatus.productLabel}
          </span>
        )}
      </div>
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
            const name = order.order_name ? translate(order.order_name) : t('untitledOrder');
            const client = order.client?.name ? translate(order.client.name) : '';
            const manufacturer = order.manufacturer?.name ? translate(order.manufacturer.name) : '';
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
      <div className="mb-3 sm:mb-4 md:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
          {(userRole === 'admin' || userRole === 'super_admin' || userRole === 'order_creator') && (
            <Link
              href="/dashboard/orders/create"
              className="bg-blue-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg hover:bg-blue-700 active:bg-blue-800 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm md:text-base font-medium w-full sm:w-auto transition-colors"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="whitespace-nowrap">{t('newOrder')}</span>
            </Link>
          )}
          
          {/* Layout toggle removed - V2 is now permanent */}
        </div>

        {(userRole === 'manufacturer' || userRole === 'admin' || userRole === 'super_admin' || userRole === 'client') && (
          <div className="-mx-4 sm:mx-0">
            <div className="px-2 sm:px-0">
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
            </div>
          </div>
        )}

        {activeTab === 'production_status' && (
          <div className="-mx-4 sm:mx-0">
            <div className="px-2 sm:px-0">
              <ProductionSubTabs
                activeSubTab={productionSubTab}
                tabCounts={tabCounts}
                t={t}
                onSubTabChange={setProductionSubTab}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 sm:pl-9 pr-3 sm:pr-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm text-gray-900 placeholder-gray-500"
            />
          </div>

          {(userRole === 'admin' || userRole === 'super_admin') && activeTab !== 'invoice_approval' && (
            <button
              onClick={() => setShowPrices(!showPrices)}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors text-xs sm:text-sm w-full sm:w-auto sm:self-start"
              title={showPrices ? t('hidePrices') : t('showPrices')}
            >
              {showPrices ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 flex-shrink-0" />
                  <span className="text-gray-700">{t('hidePrices')}</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 flex-shrink-0" />
                  <span className="text-gray-700">{t('showPrices')}</span>
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
                  const isExpanded = expandedOrders.has(order.id);
                  const canDelete = canDeleteOrder(order);
                  const orderTotal = calculateOrderTotal(order, userRole);
                  const hasUnreadNotification = ordersWithUnreadNotifications.has(order.id);
                  const visibleProducts = order.order_products;
                  const isClientRequest = order.status === 'client_request';

                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        className={`hover:bg-gray-50 cursor-pointer transition-all ${
                          hasUnreadNotification ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                        } ${isClientRequest ? 'bg-teal-50/30' : ''}`}
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
                              <div className="text-sm font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                                {order.order_name ? translate(order.order_name) : t('untitledOrder')}
                                {hasUnreadNotification && (
                                  <span className="inline-flex items-center justify-center w-2 h-2 bg-blue-600 rounded-full animate-pulse" title="New notification"></span>
                                )}
                                {isClientRequest && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-teal-100 text-teal-700 rounded">
                                    {t('clientRequest') || 'Client Request'}
                                  </span>
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
                          {renderRoutingBadges(order)}
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
          <div className="block lg:hidden divide-y divide-gray-200">
            {filteredOrders.map((order) => {
              const orderTotal = calculateOrderTotal(order, userRole);
              const hasUnreadNotification = ordersWithUnreadNotifications.has(order.id);
              const canDelete = canDeleteOrder(order);
              const visibleProducts = order.order_products;
              const isClientRequest = order.status === 'client_request';

              return (
                <div
                  key={order.id}
                  className={`p-3 sm:p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors ${hasUnreadNotification ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''} ${isClientRequest ? 'bg-teal-50/30' : ''}`}
                >
                  <div className="flex justify-between items-start gap-2 mb-2 sm:mb-3">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigateToOrder(order.id)}>
                      <div className="font-semibold text-sm sm:text-base text-gray-900 flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                        <span className="truncate">{order.order_name ? translate(order.order_name) : t('untitledOrder')}</span>
                        {hasUnreadNotification && (
                          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-600 rounded-full animate-pulse flex-shrink-0"></span>
                        )}
                        {isClientRequest && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-teal-100 text-teal-700 rounded flex-shrink-0">
                            {t('clientRequest') || 'Client Request'}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] sm:text-xs text-gray-500 mb-0.5">
                        {formatOrderNumber(order.order_number)}
                        {visibleProducts && (
                          <span className="ml-1.5 sm:ml-2">• {visibleProducts.length} {language === 'zh' ? '产品' : `product${visibleProducts.length !== 1 ? 's' : ''}`}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {renderRoutingBadges(order)}
                    </div>
                  </div>

                  <div className="mb-2 sm:mb-3 text-xs sm:text-sm cursor-pointer" onClick={() => navigateToOrder(order.id)}>
                    <div className="flex items-center gap-1.5 text-gray-700 mb-0.5 sm:mb-1">
                      <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                      <span className="font-medium truncate">{order.client?.name ? translate(order.client.name) : '-'}</span>
                    </div>
                    {userRole !== 'manufacturer' && order.manufacturer?.name && (
                      <div className="flex items-center gap-1.5 text-gray-600 text-[11px] sm:text-xs pl-4 sm:pl-5">
                        <Building className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{order.manufacturer?.name ? translate(order.manufacturer.name) : '-'}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs text-gray-500 cursor-pointer" onClick={() => navigateToOrder(order.id)}>
                      <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                      <span className="whitespace-nowrap">{new Date(order.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                      {(userRole === 'admin' || userRole === 'super_admin') && orderTotal > 0 && (
                        <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-green-100 text-green-700 text-[10px] sm:text-xs font-semibold rounded-full inline-flex items-center gap-0.5 sm:gap-1 whitespace-nowrap">
                          <DollarSign className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                          {showPrices ? formatCurrencyWithLanguage(orderTotal, language).replace(/[$¥]/, '') : 'XXXXX'}
                        </span>
                      )}

                      <div className="flex items-center gap-1 sm:gap-1">
                        {order.status === 'draft' && (userRole === 'admin' || userRole === 'super_admin' || userRole === 'order_creator') && (
                          <Link
                            href={`/dashboard/orders/edit/${order.id}`}
                            className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 active:bg-blue-100 rounded-lg transition-colors"
                            title={t('editOrder')}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Edit className="w-6 h-6 sm:w-5 sm:h-5" />
                          </Link>
                        )}
                        {canDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(order.id);
                            }}
                            className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                              userRole === 'super_admin'
                                ? 'text-red-600 hover:bg-red-50 active:bg-red-100'
                                : 'text-gray-600 hover:bg-gray-100 active:bg-gray-200'
                            }`}
                            title={userRole === 'super_admin' ? 'Delete (Super Admin)' : 'Delete (Draft Only)'}
                          >
                            <Trash2 className="w-6 h-6 sm:w-5 sm:h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => navigateToOrder(order.id)}
                          className="p-1.5 sm:p-2 text-gray-600 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors"
                          title={t('viewDetails')}
                        >
                          <Eye className="w-6 h-6 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-10 sm:py-12 px-4">
              <Package className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-300" />
              <h3 className="mt-2 text-xs sm:text-sm font-medium text-gray-900">{t('noOrders')}</h3>
              <p className="mt-1 text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
                {activeTab === 'client_requests'
                  ? t('noClientRequests') || 'No pending client requests.'
                  : activeTab === 'production_status'
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