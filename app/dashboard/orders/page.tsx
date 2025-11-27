'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Search, Eye, Package, Users, 
  Calendar, ChevronRight, Edit, Building,
  ChevronDown, AlertCircle, Trash2, Shield, DollarSign,
  Inbox, SendHorizontal, Factory, Truck, CheckCircle,
  EyeOff, Globe, FileText, Clock, ExternalLink, 
  Plane, Ship, AlertTriangle, Layers, Award, Cog, PackageCheck
} from 'lucide-react';
import { StatusBadge } from './shared-components/StatusBadge';
import { formatOrderNumber } from '@/lib/utils/orderUtils';
import { formatCurrency as formatCurrencyUtil } from './utils/orderCalculations';

// Translation dictionary
const translations = {
  en: {
    // Header
    orders: "Orders",
    yourOrders: "Your Orders",
    newOrder: "New Order",
    
    // Tabs
    myOrders: "My Orders",
    invoiceApproval: "Invoice Approval",
    sentToAdmin: "Sent to Admin",
    sentToManufacturer: "Sent to Manufacturer",
    productionStatus: "Production Status",
    approvedForProduction: "Approved for Production",
    inProduction: "In Production",
    shipped: "Shipped",
    
    // Production sub-tabs
    approved: "Approved",
    production: "Production",
    
    // Table Headers
    order: "Order",
    orderNumber: "Order Number",
    clientMfr: "Client/Mfr",
    client: "Client",
    manufacturer: "Manufacturer",
    products: "Products",
    productsWithFees: "Products with Fees",
    clientTotal: "Client Total",
    totalFees: "Total Fees",
    created: "Created",
    orderCreated: "Order Created",
    invoiceReady: "Invoice Ready",
    actions: "Actions",
    fees: "Fees",
    
    // Order Details
    untitledOrder: "Untitled Order",
    product: "Product",
    withAdmin: "With Admin",
    withClient: "With Client",
    withManufacturer: "With Manufacturer",
    needAction: "Need Action",
    completed: "Completed",
    reviewInvoice: "Review Invoice",
    createInvoice: "Create Invoice",
    viewOrder: "View Order",
    sampleFee: "Sample Fee",
    unitPrice: "Unit Price",
    shipping: "Shipping",
    shippingNotSet: "No Shipping Selected",
    withShipping: "w/ shipping",
    noShipping: "no shipping",
    qty: "Qty",
    daysAgo: "days ago",
    dayAgo: "day ago",
    
    // Search
    searchPlaceholder: "Search orders, clients, or manufacturers...",
    noOrders: "No orders",
    noOrdersMessage: "No orders need your action right now",
    noInvoicesMessage: "No orders with fees awaiting invoice approval",
    noProductionOrders: "No orders in this production stage",
    tryAdjustingSearch: "Try adjusting your search",
    getStarted: "Get started by creating a new order",
    
    // Actions
    showPrices: "Show Prices",
    hidePrices: "Hide Prices",
    viewDetails: "View Details",
    editOrder: "Edit Order",
    deleteOrder: "Delete Order",
    
    // Delete Modal
    confirmDelete: "Confirm Delete",
    superAdminOverride: "Super Admin Override",
    areYouSure: "Are you sure you want to delete order",
    permanentDelete: "This will permanently delete the order and all associated products, variants, and media files.",
    cancel: "Cancel",
    deleting: "Deleting...",
    
    // Status
    draft: "Draft",
    newOrderStatus: "New Order",
    awaitingPrice: "Awaiting Price",
    priced: "Priced",
    readyToProduce: "Ready to Produce",
    
    // Language Toggle
    switchToChinese: "中文"
  },
  
  zh: {
    // Header
    orders: "订单",
    yourOrders: "您的订单",
    newOrder: "新建订单",
    
    // Tabs
    myOrders: "我的订单",
    invoiceApproval: "发票审批",
    sentToAdmin: "发送给管理员",
    sentToManufacturer: "发送给制造商",
    productionStatus: "生产状态",
    approvedForProduction: "已批准生产",
    inProduction: "生产中",
    shipped: "已发货",
    
    // Production sub-tabs
    approved: "已批准",
    production: "生产中",
    
    // Table Headers
    order: "订单",
    orderNumber: "订单号",
    clientMfr: "客户/制造商",
    client: "客户",
    manufacturer: "制造商",
    products: "产品",
    productsWithFees: "带费用的产品",
    clientTotal: "客户总额",
    totalFees: "总费用",
    created: "创建时间",
    orderCreated: "订单创建",
    invoiceReady: "可开票时间",
    actions: "操作",
    fees: "费用",
    
    // Order Details
    untitledOrder: "未命名订单",
    product: "产品",
    withAdmin: "管理员处理中",
    withClient: "客户处理中",
    withManufacturer: "制造商处理中",
    needAction: "需要处理",
    completed: "已完成",
    reviewInvoice: "查看发票",
    createInvoice: "创建发票",
    viewOrder: "查看订单",
    sampleFee: "样品费",
    unitPrice: "单价",
    shipping: "运费",
    shippingNotSet: "未选择运输",
    withShipping: "含运费",
    noShipping: "无运费",
    qty: "数量",
    daysAgo: "天前",
    dayAgo: "天前",
    
    // Search
    searchPlaceholder: "搜索订单、客户或制造商...",
    noOrders: "没有订单",
    noOrdersMessage: "目前没有需要您处理的订单",
    noInvoicesMessage: "没有等待发票审批的订单",
    noProductionOrders: "此生产阶段没有订单",
    tryAdjustingSearch: "请尝试调整搜索条件",
    getStarted: "创建新订单开始",
    
    // Actions
    showPrices: "显示价格",
    hidePrices: "隐藏价格",
    viewDetails: "查看详情",
    editOrder: "编辑订单",
    deleteOrder: "删除订单",
    
    // Delete Modal
    confirmDelete: "确认删除",
    superAdminOverride: "超级管理员权限",
    areYouSure: "您确定要删除订单",
    permanentDelete: "这将永久删除订单及所有相关产品、变体和媒体文件。",
    cancel: "取消",
    deleting: "删除中...",
    
    // Status
    draft: "草稿",
    newOrderStatus: "新订单",
    awaitingPrice: "等待报价",
    priced: "已报价",
    readyToProduce: "准备生产",
    
    // Language Toggle
    switchToChinese: "English"
  }
};

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
    routed_at?: string;
    sample_fee?: number;
    client_product_price?: number;
    product_price?: number;
    client_shipping_air_price?: number;
    client_shipping_boat_price?: number;
    shipping_air_price?: number;
    shipping_boat_price?: number;
    selected_shipping_method?: string;
    product?: {
      title: string;
    };
    order_items?: Array<{
      quantity: number;
    }>;
  }>;
}

type TabType = 'my_orders' | 'invoice_approval' | 'sent_to_other' | 'production_status';
type ProductionSubTab = 'approved_for_production' | 'in_production' | 'shipped';

// Helper function to format currency with language support
const formatCurrency = (amount: number, language: 'en' | 'zh' = 'en'): string => {
  if (language === 'zh') {
    // Convert USD to CNY (approximate rate 1 USD = 7.2 CNY)
    const cnyAmount = amount * 7.2;
    return `¥${formatCurrencyUtil(cnyAmount)}`;
  }
  return `$${formatCurrencyUtil(amount)}`;
};

// Helper to calculate days since invoice ready
const daysSinceInvoiceReady = (routedAt: string | undefined): number => {
  if (!routedAt) return 0;
  const ready = new Date(routedAt);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - ready.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

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
  const [language, setLanguage] = useState<'en' | 'zh'>('en');
  
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
    const savedLanguage = localStorage.getItem('orderLanguage') as 'en' | 'zh';
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

  // Subscribe to notification changes with better error handling
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
            console.log('Notification change received:', payload);
            if (payload.errors) {
              console.error('Realtime error:', payload.errors);
              return;
            }
            loadUnreadNotifications(manufacturerId);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Successfully subscribed to notifications');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Failed to subscribe to notifications');
          } else if (status === 'CLOSED') {
            console.log('Subscription closed');
          }
        });

      return () => {
        console.log('Cleaning up subscription');
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

  // Calculate fees for a single product
  const calculateProductFees = (product: any): number => {
    let fees = 0;
    
    // Add sample fee
    fees += parseFloat(product.sample_fee?.toString() || '0');
    
    // Add product price
    const clientPrice = parseFloat(product.client_product_price?.toString() || product.product_price?.toString() || '0');
    const totalQty = product.order_items?.reduce((sum: number, item: any) => 
      sum + (item.quantity || 0), 0) || 0;
    fees += clientPrice * totalQty;
    
    // Add shipping
    if (product.selected_shipping_method === 'air') {
      fees += parseFloat(product.client_shipping_air_price?.toString() || product.shipping_air_price?.toString() || '0');
    } else if (product.selected_shipping_method === 'boat') {
      fees += parseFloat(product.client_shipping_boat_price?.toString() || product.shipping_boat_price?.toString() || '0');
    }
    
    return fees;
  };

  // Calculate total fees for an order (invoice approval)
  const calculateOrderFees = (order: Order): number => {
    if (!order.order_products || order.order_products.length === 0) return 0;
    
    let totalFees = 0;
    order.order_products.forEach(product => {
      // Only count products routed to admin with fees
      if (product.routed_to === 'admin') {
        totalFees += calculateProductFees(product);
      }
    });
    
    return totalFees;
  };

  // Check if product has shipping selected
  const hasShippingSelected = (product: any): boolean => {
    return !!(product.selected_shipping_method && 
             ((product.selected_shipping_method === 'air' && (product.client_shipping_air_price || 0) > 0) ||
              (product.selected_shipping_method === 'boat' && (product.client_shipping_boat_price || 0) > 0)));
  };

  // FIXED: Calculate product total - ADMINS ALWAYS SEE CLIENT PRICES
  const calculateProductTotal = (product: any): number => {
    // Get quantities
    const totalQty = product.order_items?.reduce((sum: number, item: any) => 
      sum + (item.quantity || 0), 0) || 0;
    
    let productPrice = 0;
    let shippingPrice = 0;
    
    // FIXED: Admin and Super Admin ALWAYS see CLIENT prices (never manufacturing)
    if (userRole === 'admin' || userRole === 'super_admin') {
      // Use CLIENT prices - these already have margins applied
      productPrice = parseFloat(product.client_product_price?.toString() || '0');
      
      if (product.selected_shipping_method === 'air') {
        shippingPrice = parseFloat(product.client_shipping_air_price?.toString() || '0');
      } else if (product.selected_shipping_method === 'boat') {
        shippingPrice = parseFloat(product.client_shipping_boat_price?.toString() || '0');
      }
    } else if (userRole === 'manufacturer') {
      // Manufacturer sees their cost prices only
      productPrice = parseFloat(product.product_price?.toString() || '0');
      
      if (product.selected_shipping_method === 'air') {
        shippingPrice = parseFloat(product.shipping_air_price?.toString() || '0');
      } else if (product.selected_shipping_method === 'boat') {
        shippingPrice = parseFloat(product.shipping_boat_price?.toString() || '0');
      }
    }
    
    // Add sample fee
    const sampleFee = parseFloat(product.sample_fee?.toString() || '0');
    
    const total = (productPrice * totalQty) + shippingPrice + sampleFee;
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

  // Get earliest invoice ready date for an order
  const getEarliestInvoiceReadyDate = (order: Order): Date | null => {
    if (!order.order_products) return null;
    
    const invoiceableProducts = order.order_products.filter(p => 
      p.routed_to === 'admin' && 
      (parseFloat(p.sample_fee?.toString() || '0') > 0 || 
       parseFloat(p.client_product_price?.toString() || p.product_price?.toString() || '0') > 0) &&
      p.product_status !== 'approved_for_production' &&
      p.product_status !== 'in_production' &&
      p.product_status !== 'shipped'
    );
    
    if (invoiceableProducts.length === 0) return null;
    
    const dates = invoiceableProducts
      .map(p => p.routed_at ? new Date(p.routed_at) : null)
      .filter(d => d !== null) as Date[];
    
    if (dates.length === 0) return null;
    
    return new Date(Math.min(...dates.map(d => d.getTime())));
  };

  // FIXED: Filter orders based on tab
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
              // Exclude products with fees (they go to invoice approval)
              !(parseFloat(p.sample_fee?.toString() || '0') > 0 || 
                parseFloat(p.client_product_price?.toString() || p.product_price?.toString() || '0') > 0)
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
        // Show orders that have products with fees routed back to admin
        if (isAdminUser || isClientUser) {
          filtered = ordersToFilter.filter(order => {
            if (!order.order_products || order.order_products.length === 0) return false;
            return order.order_products.some(p => 
              p.routed_to === 'admin' && 
              (parseFloat(p.sample_fee?.toString() || '0') > 0 || 
               parseFloat(p.client_product_price?.toString() || p.product_price?.toString() || '0') > 0) &&
              p.product_status !== 'approved_for_production' &&
              p.product_status !== 'in_production' &&
              p.product_status !== 'shipped'
            );
          });
          
          // Sort by oldest invoice ready date first
          filtered.sort((a, b) => {
            const aDate = getEarliestInvoiceReadyDate(a);
            const bDate = getEarliestInvoiceReadyDate(b);
            if (!aDate) return 1;
            if (!bDate) return -1;
            return aDate.getTime() - bDate.getTime();
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
        // Filter based on production sub-tab
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
    
    // Apply tab filtering
    filtered = getTabFilteredOrders(filtered);
    
    setFilteredOrders(filtered);
  };

  // FIXED: Get tab counts - NOW COUNTING PRODUCTS INSTEAD OF ORDERS
  const getTabCounts = () => {
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
    
    // Count PRODUCTS not orders
    let productCounts = {
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
          // Admin/Client counts - products with fees go to invoice approval
          if (product.routed_to === 'admin' && 
              product.product_status !== 'approved_for_production' &&
              product.product_status !== 'in_production' && 
              product.product_status !== 'shipped' &&
              product.product_status !== 'completed') {
            
            // Check if product has fees
            if (parseFloat(product.sample_fee?.toString() || '0') > 0 || 
                parseFloat(product.client_product_price?.toString() || product.product_price?.toString() || '0') > 0) {
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
          // Manufacturer counts
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
        
        // Production status counts (same for all roles)
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

    // Calculate total production count
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
    if (userRole === 'super_admin') {
      return true;
    }
    if (userRole === 'admin' && order.status === 'draft') {
      return true;
    }
    return false;
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      setDeletingOrder(orderId);
      
      const { data: orderProducts, error: fetchError } = await supabase
        .from('order_products')
        .select('id')
        .eq('order_id', orderId);

      if (fetchError) {
        console.error('Error fetching order products:', fetchError);
        throw fetchError;
      }

      const productIds = orderProducts?.map(p => p.id) || [];

      if (productIds.length > 0) {
        const { error: mediaError } = await supabase
          .from('order_media')
          .delete()
          .in('order_product_id', productIds);
        
        if (mediaError) {
          console.error('Error deleting media:', mediaError);
        }
      }

      await supabase
        .from('order_media')
        .delete()
        .eq('order_id', orderId);

      if (productIds.length > 0) {
        const { error: itemsError } = await supabase
          .from('order_items')
          .delete()
          .in('order_product_id', productIds);
        
        if (itemsError) {
          console.error('Error deleting items:', itemsError);
        }
      }

      const { error: auditError } = await supabase
        .from('audit_log')
        .delete()
        .or(`target_id.eq.${orderId},target_id.in.(${productIds.join(',')})`);
      
      if (auditError) {
        console.error('Error deleting audit logs:', auditError);
      }

      const { error: notifError } = await supabase
        .from('notifications')
        .delete()
        .eq('order_id', orderId);
      
      if (notifError) {
        console.error('Error deleting notifications:', notifError);
      }

      try {
        await supabase
          .from('manufacturer_notifications')
          .delete()
          .eq('order_id', orderId);
      } catch (e) {
        // Table might not exist, continue
      }

      try {
        await supabase
          .from('workflow_log')
          .delete()
          .eq('order_id', orderId);
      } catch (e) {
        // Table might not exist, continue
      }

      const { error: productsError } = await supabase
        .from('order_products')
        .delete()
        .eq('order_id', orderId);

      if (productsError) {
        console.error('Error deleting products:', productsError);
        throw productsError;
      }

      const { error: orderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (orderError) {
        console.error('Error deleting order:', orderError);
        throw orderError;
      }

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
    const isManufacturerUser = userRole === 'manufacturer';
    
    // FIXED: Exclude shipped/completed/production products from the counts
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
      p.routed_to === 'admin' && 
      (parseFloat(p.sample_fee?.toString() || '0') > 0 || 
       parseFloat(p.client_product_price?.toString() || p.product_price?.toString() || '0') > 0)
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
        return { 
          status: 'with_admin', 
          label: `${withAdmin} ${t.withAdmin}`, 
          color: 'purple' 
        };
      } else {
        return { 
          status: 'with_manufacturer', 
          label: `${withManufacturer} ${t.needAction}`, 
          color: 'indigo' 
        };
      }
    } else if (activeTab === 'sent_to_other') {
      if (isAdminUser) {
        return { 
          status: 'with_manufacturer', 
          label: `${withManufacturer} ${t.withManufacturer}`, 
          color: 'indigo' 
        };
      } else {
        return { 
          status: 'with_admin', 
          label: `${withAdmin} ${t.withAdmin}`, 
          color: 'purple' 
        };
      }
    } else if (activeTab === 'invoice_approval') {
      return { 
        status: 'with_fees', 
        label: `${withFees} ${t.productsWithFees}`, 
        color: 'amber' 
      };
    } else if (activeTab === 'production_status') {
      if (productionSubTab === 'approved_for_production') {
        return { 
          status: 'approved', 
          label: `${approvedForProduction} ${t.approved}`, 
          color: 'green' 
        };
      } else if (productionSubTab === 'in_production') {
        return { 
          status: 'in_production', 
          label: `${inProduction} ${t.production}`, 
          color: 'blue' 
        };
      } else if (productionSubTab === 'shipped') {
        return { 
          status: 'shipped', 
          label: `${shipped} ${t.shipped}`, 
          color: 'green' 
        };
      }
    }
    
    return { 
      status: 'mixed', 
      label: `${products.length} ${t.products}`, 
      color: 'gray' 
    };
  };

  const getProductRoutingBadge = (product: any) => {
    // For invoice approval tab, simpler badges
    if (activeTab === 'invoice_approval') {
      if (product.routed_to === 'client' || product.product_status === 'client_review') {
        return (
          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded flex items-center gap-1">
            <Users className="w-3 h-3" />
            {t.withClient}
          </span>
        );
      }
      return (
        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded flex items-center gap-1">
          <Users className="w-3 h-3" />
          {t.withAdmin}
        </span>
      );
    }
    
    // Regular badges for other tabs
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
        isWithMe 
          ? 'bg-green-100 text-green-700' 
          : 'bg-gray-100 text-gray-600'
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

  // MOVED tabCounts CALCULATION HERE - BEFORE THE JSX
  const tabCounts = getTabCounts();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Render Invoice Approval view differently - COMPACT VERSION - Mobile Responsive
  const renderInvoiceApprovalView = () => {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-2 sm:p-3 border-b bg-amber-50">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900">Orders Ready for Invoicing</h2>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <FileText className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-300" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">{t.noOrders}</h3>
            <p className="mt-1 text-xs sm:text-sm text-gray-500">{t.noInvoicesMessage}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredOrders.map((order) => {
              const isExpanded = expandedOrders.has(order.id);
              const invoiceableProducts = order.order_products?.filter(p =>
                p.routed_to === 'admin' &&
                (parseFloat(p.sample_fee?.toString() || '0') > 0 ||
                 parseFloat(p.client_product_price?.toString() || p.product_price?.toString() || '0') > 0)
              ) || [];

              const earliestDate = getEarliestInvoiceReadyDate(order);
              const daysWaiting = earliestDate ? daysSinceInvoiceReady(earliestDate.toISOString()) : 0;
              const totalFees = calculateOrderFees(order);

              return (
                <div key={order.id} className="bg-white hover:bg-gray-50 transition-colors">
                  {/* Order Header - Mobile Responsive */}
                  <div
                    className="p-2 sm:p-3 cursor-pointer"
                    onDoubleClick={() => navigateToOrder(order.id)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleOrderExpansion(order.id);
                          }}
                          className="p-0.5 hover:bg-gray-200 rounded flex-shrink-0 mt-0.5"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-gray-900 text-xs sm:text-sm break-words">
                                {order.order_name || t.untitledOrder}
                              </h3>
                              <span className="text-xs text-gray-500 whitespace-nowrap">
                                {formatOrderNumber(order.order_number)}
                              </span>
                              <span className="text-xs text-gray-500 break-words">
                                {order.client?.name}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1 whitespace-nowrap">
                                <Calendar className="w-3 h-3 flex-shrink-0" />
                                <span className="hidden sm:inline">{t.orderCreated}:</span>
                                {new Date(order.created_at).toLocaleDateString()}
                              </span>
                              {earliestDate && (
                                <span className="flex items-center gap-1 text-amber-600 font-medium whitespace-nowrap">
                                  <Clock className="w-3 h-3 flex-shrink-0" />
                                  <span className="hidden sm:inline">{t.invoiceReady}:</span>
                                  {daysWaiting} {daysWaiting === 1 ? t.dayAgo : t.daysAgo}
                                </span>
                              )}
                              <span className="font-semibold text-gray-900 whitespace-nowrap">
                                {invoiceableProducts.length} {invoiceableProducts.length === 1 ? 'product' : 'products'} • ${formatCurrencyUtil(totalFees)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-6 sm:ml-0">
                        <Link
                          href={`/dashboard/invoices/create?order=${order.id}`}
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                          title={t.createInvoice}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t.createInvoice}</span>
                          <span className="sm:hidden">Invoice</span>
                        </Link>
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
                          title={t.viewOrder}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Products - Mobile Responsive */}
                  {isExpanded && (
                    <div className="px-2 sm:px-3 pb-2 sm:pb-3">
                      <div className="bg-gray-50 rounded-lg p-1.5 sm:p-2 space-y-1">
                        {invoiceableProducts.map((product) => {
                          const fees = calculateProductFees(product);
                          const daysReady = daysSinceInvoiceReady(product.routed_at);
                          const totalQty = product.order_items?.reduce((sum: number, item: any) =>
                            sum + (item.quantity || 0), 0) || 0;
                          const hasShipping = hasShippingSelected(product);

                          return (
                            <div
                              key={product.id}
                              className="bg-white rounded p-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 cursor-pointer hover:bg-gray-50"
                              onDoubleClick={() => navigateToOrder(order.id)}
                            >
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <Package className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium text-gray-900 text-xs sm:text-sm whitespace-nowrap">
                                      {product.product_order_number}
                                    </p>
                                    <span className="text-xs text-gray-600 break-words">
                                      {product.description || product.product?.title || 'Product'}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-0.5 text-xs text-gray-500">
                                    <span className="whitespace-nowrap">{t.qty}: {totalQty}</span>
                                    {(product.client_product_price || 0) > 0 && (
                                      <span className="whitespace-nowrap">${formatCurrencyUtil(product.client_product_price || 0)}/unit</span>
                                    )}
                                    {(product.sample_fee || 0) > 0 && (
                                      <span className="whitespace-nowrap">Sample: ${formatCurrencyUtil(product.sample_fee || 0)}</span>
                                    )}
                                    {product.selected_shipping_method && hasShipping && (
                                      <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-green-50 border border-green-300 rounded-full whitespace-nowrap">
                                        {product.selected_shipping_method === 'air' ? (
                                          <Plane className="w-3 h-3 text-green-600" />
                                        ) : (
                                          <Ship className="w-3 h-3 text-green-600" />
                                        )}
                                        <span className="text-green-700 font-medium">
                                          ${formatCurrencyUtil(
                                            product.selected_shipping_method === 'air'
                                              ? (product.client_shipping_air_price || 0)
                                              : (product.client_shipping_boat_price || 0)
                                          )}
                                        </span>
                                      </span>
                                    )}
                                    {daysReady > 0 && (
                                      <span className="text-amber-600 font-medium whitespace-nowrap">
                                        {daysReady} {t.daysAgo}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-2 ml-6 sm:ml-2">
                                <div className="text-left sm:text-right">
                                  <p className="text-sm font-semibold text-gray-900">
                                    ${formatCurrencyUtil(fees)}
                                  </p>
                                  {!hasShipping && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                                      <span className="text-xs text-amber-600 font-medium whitespace-nowrap">
                                        {t.shippingNotSet}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex-shrink-0">
                                  {getProductRoutingBadge(product)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t.confirmDelete}</h3>
              {userRole === 'super_admin' && (
                <div className="flex items-center gap-2 mb-3 text-amber-600">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm">{t.superAdminOverride}</span>
                </div>
              )}
              <p className="text-gray-600">
                {t.areYouSure}{' '}
                <strong>{formatOrderNumber(orders.find(o => o.id === showDeleteConfirm)?.order_number || '')}</strong>?
              </p>
              <p className="text-red-600 text-sm mt-2">
                {t.permanentDelete}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={deletingOrder === showDeleteConfirm}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => handleDeleteOrder(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                disabled={deletingOrder === showDeleteConfirm}
              >
                {deletingOrder === showDeleteConfirm ? t.deleting : t.deleteOrder}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {userRole === 'manufacturer' ? t.yourOrders : t.orders}
          </h1>
          <div className="flex items-center gap-3">
            {/* Language Toggle Button */}
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

        {/* Tabs - Better Responsive Design */}
        {(userRole === 'manufacturer' || userRole === 'admin' || userRole === 'super_admin' || userRole === 'client') && (
          <div className="border-b border-gray-200 mb-4">
            <nav className="-mb-px flex flex-wrap gap-y-2">
              <button
                onClick={() => setActiveTab('my_orders')}
                className={`py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'my_orders'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Inbox className="w-4 h-4" />
                <span>{t.myOrders}</span>
                {tabCounts.my_orders > 0 && (
                  <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs font-semibold">
                    {tabCounts.my_orders}
                  </span>
                )}
              </button>
              
              {(userRole === 'admin' || userRole === 'super_admin' || userRole === 'client') && (
                <button
                  onClick={() => setActiveTab('invoice_approval')}
                  className={`py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === 'invoice_approval'
                      ? 'border-amber-500 text-amber-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>{t.invoiceApproval}</span>
                  {tabCounts.invoice_approval > 0 && (
                    <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-xs font-semibold">
                      {tabCounts.invoice_approval}
                    </span>
                  )}
                </button>
              )}
              
              <button
                onClick={() => setActiveTab('sent_to_other')}
                className={`py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'sent_to_other'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <SendHorizontal className="w-4 h-4" />
                <span>{userRole === 'manufacturer' ? t.sentToAdmin : t.sentToManufacturer}</span>
                {tabCounts.sent_to_other > 0 && (
                  <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-xs font-semibold">
                    {tabCounts.sent_to_other}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => {
                  setActiveTab('production_status');
                  setProductionSubTab('approved_for_production');
                }}
                className={`py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'production_status'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>{t.productionStatus}</span>
                {tabCounts.production_total > 0 && (
                  <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-xs font-semibold">
                    {tabCounts.production_total}
                  </span>
                )}
              </button>
            </nav>
          </div>
        )}

{/* Production Status Sub-Navigation - COMPACT & CENTERED */}
{activeTab === 'production_status' && (
  <div className="flex lg:justify-center mb-3">
    <div className="flex flex-col lg:flex-row w-full bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-2 border border-indigo-200 inline-flex gap-4">
      <button
        onClick={() => setProductionSubTab('approved_for_production')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
          productionSubTab === 'approved_for_production'
            ? 'bg-white shadow-md border-2 border-green-500'
            : 'bg-white/70 hover:bg-white border border-gray-200 hover:shadow'
        }`}
      >
        <div className={`p-1 rounded-full ${
          productionSubTab === 'approved_for_production'
            ? 'bg-green-100'
            : 'bg-gray-100'
        }`}>
          <Award className={`w-4 h-4 ${
            productionSubTab === 'approved_for_production'
              ? 'text-green-600'
              : 'text-gray-600'
          }`} />
        </div>
        <div className="flex flex-col items-start">
          <span className={`text-xs font-medium ${
            productionSubTab === 'approved_for_production'
              ? 'text-green-700'
              : 'text-gray-600'
          }`}>
            {t.approved}
          </span>
          <span className={`text-sm font-bold ${
            productionSubTab === 'approved_for_production'
              ? 'text-green-600'
              : 'text-gray-900'
          }`}>
            {tabCounts.approved_for_production}
          </span>
        </div>
      </button>
      
      <button
        onClick={() => setProductionSubTab('in_production')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
          productionSubTab === 'in_production'
            ? 'bg-white shadow-md border-2 border-blue-500'
            : 'bg-white/70 hover:bg-white border border-gray-200 hover:shadow'
        }`}
      >
        <div className={`p-1 rounded-full ${
          productionSubTab === 'in_production'
            ? 'bg-blue-100'
            : 'bg-gray-100'
        }`}>
          <Cog className={`w-4 h-4 ${
            productionSubTab === 'in_production'
              ? 'text-blue-600'
              : 'text-gray-600'
          }`} />
        </div>
        <div className="flex flex-col items-start">
          <span className={`text-xs font-medium ${
            productionSubTab === 'in_production'
              ? 'text-blue-700'
              : 'text-gray-600'
          }`}>
            {t.production}
          </span>
          <span className={`text-sm font-bold ${
            productionSubTab === 'in_production'
              ? 'text-blue-600'
              : 'text-gray-900'
          }`}>
            {tabCounts.in_production}
          </span>
        </div>
      </button>
      
      <button
        onClick={() => setProductionSubTab('shipped')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
          productionSubTab === 'shipped'
            ? 'bg-white shadow-md border-2 border-emerald-500'
            : 'bg-white/70 hover:bg-white border border-gray-200 hover:shadow'
        }`}
      >
        <div className={`p-1 rounded-full ${
          productionSubTab === 'shipped'
            ? 'bg-emerald-100'
            : 'bg-gray-100'
        }`}>
          <PackageCheck className={`w-4 h-4 ${
            productionSubTab === 'shipped'
              ? 'text-emerald-600'
              : 'text-gray-600'
          }`} />
        </div>
        <div className="flex flex-col items-start">
          <span className={`text-xs font-medium ${
            productionSubTab === 'shipped'
              ? 'text-emerald-700'
              : 'text-gray-600'
          }`}>
            {t.shipped}
          </span>
          <span className={`text-sm font-bold ${
            productionSubTab === 'shipped'
              ? 'text-emerald-600'
              : 'text-gray-900'
          }`}>
            {tabCounts.shipped}
          </span>
        </div>
      </button>
    </div>
  </div>
)}
        {/* Search and Price Toggle - Only show for non-invoice tabs */}
        {activeTab !== 'invoice_approval' && (
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
            
            {/* Price visibility toggle for Admin/Super Admin */}
            {(userRole === 'admin' || userRole === 'super_admin') && (
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
        )}
        
        {/* Search only for Invoice Approval */}
        {activeTab === 'invoice_approval' && (
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
        )}
      </div>

      {/* Render different views based on tab */}
      {activeTab === 'invoice_approval' ? (
        renderInvoiceApprovalView()
      ) : (
        /* Regular Orders Table for other tabs */
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
                  const orderTotal = calculateOrderTotal(order);
                  const hasUnreadNotification = ordersWithUnreadNotifications.has(order.id);

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
                                {showPrices ? formatCurrency(orderTotal, language).replace(/[$¥]/, '') : 'XXXXX'}
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

                      {/* Expanded Products Row */}
                      {isExpanded && visibleProducts && visibleProducts.length > 0 && (
                        <tr>
                          <td colSpan={(userRole === 'admin' || userRole === 'super_admin') ? 6 : 5} className="px-6 py-2 bg-gray-50">
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
                                          {product.description || product.product?.title || t.product}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {(userRole === 'admin' || userRole === 'super_admin') && productTotal > 0 && (
                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                                          {showPrices ? formatCurrency(productTotal, language) : 'XXXXX'}
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

          {/* Mobile View for My Orders */}
          <div className="block lg:hidden">
            {filteredOrders.length === 0 ? (
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
            ) : (
              <div className="space-y-4">
                {filteredOrders.map(order => {
                  const routingStatus = getOrderRoutingStatus(order);
                  const canDelete = canDeleteOrder(order);
                  const orderTotal = calculateOrderTotal(order);
                  const hasUnreadNotification = ordersWithUnreadNotifications.has(order.id);
                  return (
                    <div key={order.id} className={`bg-white rounded-lg shadow p-4 flex flex-col gap-2 ${hasUnreadNotification ? 'border-l-4 border-blue-500' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-base font-bold text-gray-900 flex items-center gap-2">
                            {order.order_name || t.untitledOrder}
                            {hasUnreadNotification && (
                              <span className="inline-flex items-center justify-center w-2 h-2 bg-blue-600 rounded-full animate-pulse" title="New notification"></span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{formatOrderNumber(order.order_number)}</div>
                        </div>
                        <div className="flex gap-2">
                          {order.status === 'draft' && (userRole === 'admin' || userRole === 'super_admin' || userRole === 'order_creator') && (
                            <Link
                              href={`/dashboard/orders/edit/${order.id}`}
                              className="text-blue-600 hover:text-blue-800"
                              title={t.editOrder}
                            >
                              <Edit className="w-5 h-5" />
                            </Link>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setShowDeleteConfirm(order.id)}
                              className={`$${userRole === 'super_admin' ? 'text-red-600 hover:text-red-800' : 'text-gray-500 hover:text-red-600'}`}
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
                          >
                            <Eye className="w-5 h-5" />
                          </Link>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 mt-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-700">{userRole === 'manufacturer' ? t.client : t.clientMfr}:</span>
                          <span className="text-gray-900">{order.client?.name || '-'}</span>
                          {userRole !== 'manufacturer' && (
                            <span className="text-xs text-gray-500">{order.manufacturer?.name || '-'}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className={`px-2 py-1 text-xs rounded-full bg-${routingStatus.color}-100 text-${routingStatus.color}-700`}>
                            {routingStatus.label}
                          </span>
                          <span className="text-xs text-gray-400">{order.order_products?.length || 0} {language === 'zh' ? '产品' : `product${order.order_products?.length !== 1 ? 's' : ''}`}</span>
                        </div>
                        {(userRole === 'admin' || userRole === 'super_admin') && orderTotal > 0 && (
                          <span className="px-2.5 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full inline-flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5" />
                            {showPrices ? formatCurrency(orderTotal, language).replace(/[$¥]/, '') : 'XXXXX'}
                          </span>
                        )}
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="w-4 h-4" />
                          {new Date(order.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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