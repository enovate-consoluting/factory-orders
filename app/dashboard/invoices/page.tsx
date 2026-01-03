/**
 * Invoices Page - /dashboard/invoices
 * Main invoice management page with tabs for approval, in-production, drafts, sent, paid
 * UPDATED: Added void invoice functionality and invoice gate for existing invoices
 * MERGED: Gurri's responsive styling + Invoice gate functionality
 * Roles: Admin, Super Admin, Client (limited view)
 * Last Modified: December 2025
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  FileText, Calendar, Search, CheckCircle, Clock, Send, 
  AlertCircle, Eye, Trash2, RefreshCw, ChevronRight,
  ChevronDown, ExternalLink, Plane, Ship, AlertTriangle,
  Package, Shield, Inbox, Play, FileX, Ban, CreditCard, Loader2
} from 'lucide-react';
import { notify } from '@/app/hooks/useUINotification';

// Import the new components
import VoidInvoiceModal from './VoidInvoiceModal';
import ExistingInvoicesModal from './ExistingInvoicesModal';
import { useInvoiceCheck } from './useInvoiceCheck';

// Format currency helper
const formatCurrencyUtil = (amount: number): string => {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  paid_amount: number;
  status: 'draft' | 'sent' | 'paid' | 'cancelled' | 'voided';
  due_date: string;
  created_at: string;
  sent_at?: string;
  order_id?: string;
  pdf_url?: string;
  pay_link?: string;
  voided?: boolean;
  voided_at?: string;
  void_reason?: string;
  order?: {
    id: string;
    order_number: string;
    order_name: string;
  };
  client?: {
    id: string;
    name: string;
    email: string;
  };
}

interface OrderForApproval {
  id: string;
  order_number: string;
  order_name: string;
  created_at: string;
  client: {
    id: string;
    name: string;
  };
  products: ProductForApproval[];
  total_value: number;
  earliest_ready_date: Date | null;
}

interface ProductForApproval {
  id: string;
  product_order_number: string;
  description: string;
  sample_fee: number;
  client_product_price: number;
  client_shipping_air_price: number;
  client_shipping_boat_price: number;
  selected_shipping_method: string;
  total_quantity: number;
  total_value: number;
  routed_at: string;
  product_status?: string;
  invoiced?: boolean;
}

type TabType = 'approval' | 'inproduction' | 'drafts' | 'sent' | 'paid' | 'all';

// Helper to calculate days since a date
const daysSinceDate = (dateString: string | Date | null): number => {
  if (!dateString) return 0;
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export default function InvoicesPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  const [activeTab, setActiveTab] = useState<TabType>('approval');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState<any>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  
  // Client-specific states
  const [isClient, setIsClient] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  
  // Data
  const [ordersForApproval, setOrdersForApproval] = useState<OrderForApproval[]>([]);
  const [ordersInProduction, setOrdersInProduction] = useState<OrderForApproval[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  
  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Pay link regeneration
  const [regeneratingPayLink, setRegeneratingPayLink] = useState<string | null>(null);
  
  // Void Invoice Modal
  const [voidModal, setVoidModal] = useState<{
    isOpen: boolean;
    invoice: Invoice | null;
  }>({
    isOpen: false,
    invoice: null
  });

  // Existing Invoices Modal (Invoice Gate)
  const [existingInvoicesModal, setExistingInvoicesModal] = useState<{
    isOpen: boolean;
    orderId: string;
    orderNumber: string;
  }>({
    isOpen: false,
    orderId: '',
    orderNumber: ''
  });

  // Invoice check hook
  const { checkResult, checkExistingInvoices, clearCheck } = useInvoiceCheck();
  
  // Stats
  const [stats, setStats] = useState({
    forApproval: 0,
    inProduction: 0,
    drafts: 0,
    sent: 0,
    paid: 0
  });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      
      // Check if user is a client
      if (parsedUser.role === 'client') {
        setIsClient(true);
        setActiveTab('sent'); // Clients only see sent invoices
        fetchClientId(parsedUser.email);
      }
    }
  }, []);

  // Prevent background scroll when modals are open
  useEffect(() => {
    if (showDeleteConfirm || voidModal.isOpen || existingInvoicesModal.isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    };
  }, [showDeleteConfirm, voidModal.isOpen, existingInvoicesModal.isOpen]);

  useEffect(() => {
    if (isClient && !clientId) {
      // Wait for clientId to be fetched before loading data
      return;
    }
    fetchData();
  }, [activeTab, isClient, clientId]);

  const fetchClientId = async (email: string) => {
    try {
      const { data: clientData, error } = await supabase
        .from('clients')
        .select('id')
        .eq('email', email)
        .single();
      
      if (error) {
        console.error('Error fetching client:', error);
        return;
      }
      
      if (clientData) {
        setClientId(clientData.id);
      }
    } catch (error) {
      console.error('Error fetching client ID:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!isClient) {
        await fetchStats();
      }
      
      if (activeTab === 'approval' && !isClient) {
        await fetchOrdersForApproval();
      } else if (activeTab === 'inproduction' && !isClient) {
        await fetchOrdersInProduction();
      } else {
        await fetchInvoices();
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      notify.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Count products for approval (excluding soft-deleted)
      const { data: approvalData } = await supabase
        .from('order_products')
        .select('id')
        .eq('routed_to', 'admin')
        .is('deleted_at', null)
        .or('client_product_price.gt.0,sample_fee.gt.0')
        .not('product_status', 'in', '("approved_for_production","in_production","shipped","completed")');

      // Count products in production (excluding soft-deleted)
      const { data: productionData } = await supabase
        .from('order_products')
        .select('id')
        .is('deleted_at', null)
        .or('client_product_price.gt.0,sample_fee.gt.0')
        .in('product_status', ['approved_for_production', 'in_production']);
      
      // Count invoices by status (exclude voided)
      const { data: invoiceData } = await supabase
        .from('invoices')
        .select('id, status, voided')
        .or('voided.is.null,voided.eq.false');
      
      setStats({
        forApproval: approvalData?.length || 0,
        inProduction: productionData?.length || 0,
        drafts: invoiceData?.filter(i => i.status === 'draft').length || 0,
        sent: invoiceData?.filter(i => i.status === 'sent').length || 0,
        paid: invoiceData?.filter(i => i.status === 'paid').length || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchOrdersForApproval = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_name,
          created_at,
          client:clients(id, name),
          order_products(
            id,
            product_order_number,
            description,
            product_status,
            routed_to,
            routed_at,
            sample_fee,
            client_product_price,
            client_shipping_air_price,
            client_shipping_boat_price,
            selected_shipping_method,
            product:products(title),
            order_items(quantity)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process orders - filter to only those with invoiceable products (NOT in production)
      const processed: OrderForApproval[] = [];
      
      data?.forEach(order => {
        const invoiceableProducts = order.order_products?.filter((p: any) => 
          p.routed_to === 'admin' && 
          (parseFloat(p.sample_fee || 0) > 0 || parseFloat(p.client_product_price || 0) > 0) &&
          p.product_status !== 'approved_for_production' &&
          p.product_status !== 'in_production' &&
          p.product_status !== 'shipped' &&
          p.product_status !== 'completed'
        ) || [];

        if (invoiceableProducts.length === 0) return;

        let totalValue = 0;
        let earliestDate: Date | null = null;

        const products: ProductForApproval[] = invoiceableProducts.map((p: any) => {
          const totalQty = p.order_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
          
          let productTotal = parseFloat(p.sample_fee || 0);
          productTotal += parseFloat(p.client_product_price || 0) * totalQty;
          
          if (p.selected_shipping_method === 'air') {
            productTotal += parseFloat(p.client_shipping_air_price || 0);
          } else if (p.selected_shipping_method === 'boat') {
            productTotal += parseFloat(p.client_shipping_boat_price || 0);
          }

          totalValue += productTotal;

          if (p.routed_at) {
            const routedDate = new Date(p.routed_at);
            if (!earliestDate || routedDate < earliestDate) {
              earliestDate = routedDate;
            }
          }

          return {
            id: p.id,
            product_order_number: p.product_order_number,
            description: p.description || p.product?.title || 'Product',
            sample_fee: parseFloat(p.sample_fee || 0),
            client_product_price: parseFloat(p.client_product_price || 0),
            client_shipping_air_price: parseFloat(p.client_shipping_air_price || 0),
            client_shipping_boat_price: parseFloat(p.client_shipping_boat_price || 0),
            selected_shipping_method: p.selected_shipping_method,
            total_quantity: totalQty,
            total_value: productTotal,
            routed_at: p.routed_at,
            product_status: p.product_status
          };
        });

        processed.push({
          id: order.id,
          order_number: order.order_number,
          order_name: order.order_name || 'Untitled Order',
          created_at: order.created_at,
          client: Array.isArray(order.client) ? order.client[0] : order.client,
          products,
          total_value: totalValue,
          earliest_ready_date: earliestDate
        });
      });

      // Sort by earliest ready date (oldest first)
      processed.sort((a, b) => {
        if (!a.earliest_ready_date) return 1;
        if (!b.earliest_ready_date) return -1;
        return a.earliest_ready_date.getTime() - b.earliest_ready_date.getTime();
      });

      setOrdersForApproval(processed);
    } catch (error) {
      console.error('Error fetching orders for approval:', error);
    }
  };

  const fetchOrdersInProduction = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_name,
          created_at,
          client:clients(id, name),
          order_products(
            id,
            product_order_number,
            description,
            product_status,
            routed_to,
            routed_at,
            sample_fee,
            client_product_price,
            client_shipping_air_price,
            client_shipping_boat_price,
            selected_shipping_method,
            product:products(title),
            order_items(quantity)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process orders - filter to only those with products IN PRODUCTION
      const processed: OrderForApproval[] = [];
      
      data?.forEach(order => {
        const productionProducts = order.order_products?.filter((p: any) => 
          (parseFloat(p.sample_fee || 0) > 0 || parseFloat(p.client_product_price || 0) > 0) &&
          (p.product_status === 'approved_for_production' || p.product_status === 'in_production')
        ) || [];

        if (productionProducts.length === 0) return;

        let totalValue = 0;
        let earliestDate: Date | null = null;

        const products: ProductForApproval[] = productionProducts.map((p: any) => {
          const totalQty = p.order_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
          
          let productTotal = parseFloat(p.sample_fee || 0);
          productTotal += parseFloat(p.client_product_price || 0) * totalQty;
          
          if (p.selected_shipping_method === 'air') {
            productTotal += parseFloat(p.client_shipping_air_price || 0);
          } else if (p.selected_shipping_method === 'boat') {
            productTotal += parseFloat(p.client_shipping_boat_price || 0);
          }

          totalValue += productTotal;

          if (p.routed_at) {
            const routedDate = new Date(p.routed_at);
            if (!earliestDate || routedDate < earliestDate) {
              earliestDate = routedDate;
            }
          }

          return {
            id: p.id,
            product_order_number: p.product_order_number,
            description: p.description || p.product?.title || 'Product',
            sample_fee: parseFloat(p.sample_fee || 0),
            client_product_price: parseFloat(p.client_product_price || 0),
            client_shipping_air_price: parseFloat(p.client_shipping_air_price || 0),
            client_shipping_boat_price: parseFloat(p.client_shipping_boat_price || 0),
            selected_shipping_method: p.selected_shipping_method,
            total_quantity: totalQty,
            total_value: productTotal,
            routed_at: p.routed_at,
            product_status: p.product_status
          };
        });

        processed.push({
          id: order.id,
          order_number: order.order_number,
          order_name: order.order_name || 'Untitled Order',
          created_at: order.created_at,
          client: Array.isArray(order.client) ? order.client[0] : order.client,
          products,
          total_value: totalValue,
          earliest_ready_date: earliestDate
        });
      });

      // Sort by earliest ready date (oldest first)
      processed.sort((a, b) => {
        if (!a.earliest_ready_date) return 1;
        if (!b.earliest_ready_date) return -1;
        return a.earliest_ready_date.getTime() - b.earliest_ready_date.getTime();
      });

      setOrdersInProduction(processed);
    } catch (error) {
      console.error('Error fetching orders in production:', error);
    }
  };

  const fetchInvoices = async () => {
    try {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          order:orders(id, order_number, order_name),
          client:clients(id, name, email)
        `)
        .order('created_at', { ascending: false });

      // CLIENT FILTER - Only show sent invoices for their client_id (exclude voided)
      if (isClient && clientId) {
        query = query
          .eq('client_id', clientId)
          .eq('status', 'sent')
          .or('voided.is.null,voided.eq.false');
      } else {
        // Admin filters - exclude voided from normal views
        if (activeTab === 'drafts') {
          query = query.eq('status', 'draft').or('voided.is.null,voided.eq.false');
        } else if (activeTab === 'sent') {
          query = query.eq('status', 'sent').or('voided.is.null,voided.eq.false');
        } else if (activeTab === 'paid') {
          query = query.eq('status', 'paid').or('voided.is.null,voided.eq.false');
        }
        // 'all' tab shows everything including voided
      }

      const { data, error } = await query;
      if (error) throw error;

      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      setDeleting(true);
      
      // Delete invoice items first
      await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', invoiceId);
      
      // Delete invoice
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);
      
      if (error) throw error;
      
      notify.success('Invoice deleted');
      setShowDeleteConfirm(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      notify.error('Failed to delete invoice');
    } finally {
      setDeleting(false);
    }
  };

  // Handle Create Invoice click - check for existing invoices first (INVOICE GATE)
  const handleCreateInvoiceClick = async (orderId: string, orderNumber: string) => {
    const result = await checkExistingInvoices(orderId);
    
    if (result.hasExistingInvoices) {
      // Show the gate modal
      setExistingInvoicesModal({
        isOpen: true,
        orderId,
        orderNumber
      });
    } else {
      // No existing invoices, proceed directly
      router.push(`/dashboard/invoices/create?order=${orderId}`);
    }
  };

  const handleCloseExistingInvoicesModal = () => {
    setExistingInvoicesModal({ isOpen: false, orderId: '', orderNumber: '' });
    clearCheck();
  };

  const handleProceedWithRemaining = () => {
    // Navigate to create invoice with only uninvoiced products
    router.push(`/dashboard/invoices/create?order=${existingInvoicesModal.orderId}&uninvoiced_only=true`);
    handleCloseExistingInvoicesModal();
  };

  const handleRefreshAfterVoid = () => {
    // Re-check invoices after voiding
    if (existingInvoicesModal.orderId) {
      checkExistingInvoices(existingInvoicesModal.orderId);
    }
    fetchData();
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

  const hasShippingSelected = (product: ProductForApproval): boolean => {
    return !!(product.selected_shipping_method && 
             ((product.selected_shipping_method === 'air' && product.client_shipping_air_price > 0) ||
              (product.selected_shipping_method === 'boat' && product.client_shipping_boat_price > 0)));
  };

  // Get status badge for production products
  const getProductStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'approved_for_production':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 border border-purple-300 rounded-full text-xs">
            <CheckCircle className="w-3 h-3 text-purple-600" />
            <span className="text-purple-700 font-medium">Approved</span>
          </span>
        );
      case 'in_production':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-300 rounded-full text-xs">
            <Play className="w-3 h-3 text-blue-600" />
            <span className="text-blue-700 font-medium">In Production</span>
          </span>
        );
      default:
        return null;
    }
  };

  // Filter based on search
  const filteredOrders = ordersForApproval.filter(order => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      order.order_name?.toLowerCase().includes(search) ||
      order.order_number?.toLowerCase().includes(search) ||
      order.client?.name?.toLowerCase().includes(search)
    );
  });

  const filteredProductionOrders = ordersInProduction.filter(order => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      order.order_name?.toLowerCase().includes(search) ||
      order.order_number?.toLowerCase().includes(search) ||
      order.client?.name?.toLowerCase().includes(search)
    );
  });

  const filteredInvoices = invoices.filter(invoice => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      invoice.invoice_number?.toLowerCase().includes(search) ||
      invoice.order?.order_name?.toLowerCase().includes(search) ||
      invoice.order?.order_number?.toLowerCase().includes(search) ||
      invoice.client?.name?.toLowerCase().includes(search)
    );
  });

  const getStatusBadge = (invoice: Invoice) => {
    // Check if voided first
    if (invoice.voided) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-gray-200 text-gray-600 rounded-full line-through">
          <FileX className="w-3 h-3" />
          Voided
        </span>
      );
    }
    
    switch (invoice.status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
            <FileText className="w-3 h-3" />
            Draft
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
            <Send className="w-3 h-3" />
            Sent
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
            <CheckCircle className="w-3 h-3" />
            Paid
          </span>
        );
      case 'cancelled':
      case 'voided':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
            <Ban className="w-3 h-3" />
            {invoice.status === 'voided' ? 'Voided' : 'Cancelled'}
          </span>
        );
      default:
        return null;
    }
  };

  const canDelete = (invoice: Invoice): boolean => {
    // Super Admin can delete any invoice
    if (user?.role === 'super_admin') return true;
    // Admin can only delete drafts
    if (user?.role === 'admin' && invoice.status === 'draft') return true;
    return false;
  };

  const canVoid = (invoice: Invoice): boolean => {
    // Can't void if already voided
    if (invoice.voided) return false;
    // Can't void paid invoices (use refund instead)
    if (invoice.status === 'paid') return false;
    // Super Admin and Admin can void sent invoices
    if (user?.role === 'super_admin' || user?.role === 'admin') {
      return invoice.status === 'sent' || invoice.status === 'draft';
    }
    return false;
  };

  // Check if user can regenerate pay link
  const canRegeneratePayLink = (invoice: Invoice): boolean => {
    if (invoice.voided) return false;
    if (invoice.status === 'paid') return false;
    if (invoice.status !== 'sent') return false;
    return user?.role === 'super_admin' || user?.role === 'admin';
  };

  // Regenerate Square payment link
  const handleRegeneratePayLink = async (invoice: Invoice) => {
    if (!invoice.id || !invoice.amount) {
      notify.error('Invalid invoice data');
      return;
    }

    setRegeneratingPayLink(invoice.id);

    try {
      const response = await fetch('/api/square/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          amount: parseFloat(invoice.amount.toString()),
          clientName: invoice.client?.name || 'Client',
          clientEmail: invoice.client?.email || '',
          description: `Invoice ${invoice.invoice_number}${invoice.order?.order_name ? ` - ${invoice.order.order_name}` : ''}`
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create payment link');
      }

      // Update invoice with new pay_link
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ pay_link: result.paymentLink })
        .eq('id', invoice.id);

      if (updateError) {
        console.error('Error updating invoice with pay link:', updateError);
        notify.error('Payment link created but failed to save');
        return;
      }

      notify.success('Payment link generated successfully');
      fetchData();

    } catch (error) {
      console.error('Error regenerating pay link:', error);
      notify.error(error instanceof Error ? error.message : 'Failed to generate payment link');
    } finally {
      setRegeneratingPayLink(null);
    }
  };

  // Render Order List View (shared between Approval and In Production tabs)
  const renderOrderListView = (orders: OrderForApproval[], tabType: 'approval' | 'inproduction') => {
    const isProductionTab = tabType === 'inproduction';
    
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className={`p-3 sm:p-4 border-b ${isProductionTab ? 'bg-purple-50' : 'bg-amber-50'}`}>
          <h2 className="text-sm sm:text-base font-semibold text-gray-900">{isProductionTab ? 'Orders In Production' : 'Orders for Approval'}</h2>
          {isProductionTab && (
            <p className="text-xs text-gray-600 mt-1">
              Products approved for production or currently being manufactured
            </p>
          )}
        </div>
        
        {orders.length === 0 ? (
          <div className="text-center py-8 sm:py-12 px-3">
            <CheckCircle className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-green-300" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {isProductionTab ? 'No orders in production' : 'All caught up!'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {isProductionTab 
                ? 'No products are currently in production status'
                : 'No orders waiting for invoice approval'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {orders.map((order) => {
              const isExpanded = expandedOrders.has(order.id);
              const daysWaiting = order.earliest_ready_date ? daysSinceDate(order.earliest_ready_date) : 0;
              
              // Count invoiced vs uninvoiced products
              const invoicedCount = order.products.filter(p => p.invoiced).length;
              const uninvoicedCount = order.products.length - invoicedCount;

              return (
                <div key={order.id} className="bg-white hover:bg-gray-50 transition-colors">
                  {/* Order Header */}
                  <div 
                    className="p-3 sm:p-4 cursor-pointer"
                    onDoubleClick={() => window.open(`/dashboard/orders/${order.id}`, '_blank')}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
                      <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleOrderExpansion(order.id);
                          }}
                          className="p-0.5 hover:bg-gray-200 rounded flex-shrink-0 mt-0.5 sm:mt-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                          )}
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                                  {order.order_name}
                                </h3>
                                <span className="text-xs sm:text-sm text-gray-500">
                                  {order.order_number}
                                </span>
                                <span className="text-xs sm:text-sm text-gray-500">
                                  {order.client?.name}
                                </span>
                                {isProductionTab && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                    <Play className="w-3 h-3" />
                                    In Production
                                  </span>
                                )}
                                {/* Show invoiced indicator */}
                                {invoicedCount > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                    <CheckCircle className="w-3 h-3" />
                                    {invoicedCount} Invoiced
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-xs sm:text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                                  <span className="truncate">Order Created: {new Date(order.created_at).toLocaleDateString()}</span>
                                </span>
                                {daysWaiting > 0 && (
                                  <span className={`flex items-center gap-1 font-medium ${isProductionTab ? 'text-purple-600' : 'text-amber-600'}`}>
                                    <Clock className="w-3 h-3 flex-shrink-0" />
                                    {isProductionTab ? 'In Production' : 'Invoice Ready'}: {daysWaiting} {daysWaiting === 1 ? 'day' : 'days'} ago
                                  </span>
                                )}
                                <span className="font-semibold text-gray-900">
                                  {order.products.length} products • Total: ${formatCurrencyUtil(order.total_value)}
                                </span>
                              </div>
                            </div>
                            
                            {/* Action Buttons - MERGED: Invoice gate + responsive styling */}
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 sm:ml-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCreateInvoiceClick(order.id, order.order_number);
                                }}
                                className="px-2 sm:px-3 py-1.5 bg-blue-600 text-white text-xs sm:text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                              >
                                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">Create Invoice</span>
                                <span className="sm:hidden">Invoice</span>
                              </button>
                              <Link
                                href={`/dashboard/orders/${order.id}`}
                                target="_blank"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
                                title="View Order"
                              >
                                <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Products */}
                  {isExpanded && (
                    <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                      <div className="bg-gray-50 rounded-lg p-2 sm:p-3 space-y-1.5 sm:space-y-2">
                        {order.products.map((product) => {
                          const daysReady = daysSinceDate(product.routed_at);
                          const hasShipping = hasShippingSelected(product);
                          
                          return (
                            <div 
                              key={product.id} 
                              className={`bg-white rounded p-2 sm:p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 cursor-pointer hover:bg-gray-50 ${product.invoiced ? 'opacity-60' : ''}`}
                              onDoubleClick={() => window.open(`/dashboard/orders/${order.id}`, '_blank')}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Package className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-gray-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className={`font-medium text-gray-900 text-sm ${product.invoiced ? 'line-through' : ''}`}>
                                      {product.product_order_number}
                                    </p>
                                    <span className="text-xs text-gray-600">
                                      {product.description}
                                    </span>
                                    {isProductionTab && getProductStatusBadge(product.product_status)}
                                    {product.invoiced && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                        <CheckCircle className="w-3 h-3" />
                                        Invoiced
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-0.5 text-xs text-gray-500">
                                    <span>Qty: {product.total_quantity}</span>
                                    {product.client_product_price > 0 && (
                                      <span>${formatCurrencyUtil(product.client_product_price)}/unit</span>
                                    )}
                                    {product.sample_fee > 0 && (
                                      <span>Sample: ${formatCurrencyUtil(product.sample_fee)}</span>
                                    )}
                                    {product.selected_shipping_method && hasShipping && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-300 rounded-full">
                                        {product.selected_shipping_method === 'air' ? (
                                          <Plane className="w-3 h-3 text-green-600" />
                                        ) : (
                                          <Ship className="w-3 h-3 text-green-600" />
                                        )}
                                        <span className="text-green-700 font-medium">
                                          ${formatCurrencyUtil(
                                            product.selected_shipping_method === 'air' 
                                              ? product.client_shipping_air_price
                                              : product.client_shipping_boat_price
                                          )}
                                        </span>
                                      </span>
                                    )}
                                    {daysReady > 0 && (
                                      <span className={`font-medium ${isProductionTab ? 'text-purple-600' : 'text-amber-600'}`}>
                                        {daysReady} days ago
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 sm:ml-2 flex-shrink-0">
                                <div className="text-left sm:text-right">
                                  <p className={`text-sm sm:text-base font-semibold text-gray-900 ${product.invoiced ? 'line-through' : ''}`}>
                                    ${formatCurrencyUtil(product.total_value)}
                                  </p>
                                  {!hasShipping && !product.invoiced && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                                      <span className="text-xs text-amber-600 font-medium">
                                        No Shipping Selected
                                      </span>
                                    </div>
                                  )}
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

  // Render Invoice List (Drafts, Sent, Paid, All)
  const renderInvoiceList = () => {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-8 sm:py-12 px-3">
            <FileText className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-300" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {isClient ? 'No invoices yet' : 'No invoices found'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {isClient 
                ? 'Your invoices will appear here once they are sent to you'
                : activeTab === 'drafts' && 'No draft invoices'
              }
              {!isClient && activeTab === 'sent' && 'No sent invoices awaiting payment'}
              {!isClient && activeTab === 'paid' && 'No paid invoices yet'}
              {!isClient && activeTab === 'all' && 'Create your first invoice to get started'}
            </p>
          </div>
        ) : (
          <>
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order
                  </th>
                  {!isClient && (
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                  )}
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInvoices.map(invoice => (
                  <tr key={invoice.id} className={`hover:bg-gray-50 transition-colors ${invoice.voided ? 'bg-gray-50 opacity-60' : ''}`}>
                    <td className="py-3 px-4">
                      <span className={`font-semibold text-gray-900 ${invoice.voided ? 'line-through' : ''}`}>
                        {invoice.invoice_number}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(invoice.created_at).toLocaleDateString()}
                      </p>
                      {invoice.voided && invoice.void_reason && (
                        <p className="text-xs text-red-500 mt-0.5 truncate max-w-[150px]" title={invoice.void_reason}>
                          Reason: {invoice.void_reason}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm text-gray-900">{invoice.order?.order_name || invoice.order?.order_number || '-'}</p>
                        {invoice.order?.order_number && invoice.order?.order_name && (
                          <p className="text-xs text-gray-500">#{invoice.order.order_number}</p>
                        )}
                      </div>
                    </td>
                    {!isClient && (
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-700">{invoice.client?.name || '-'}</span>
                      </td>
                    )}
                    <td className="py-3 px-4">
                      {getStatusBadge(invoice)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-semibold text-gray-900 ${invoice.voided ? 'line-through' : ''}`}>
                        ${formatCurrencyUtil(parseFloat(invoice.amount?.toString() || '0'))}
                      </span>
                      {invoice.status === 'paid' && invoice.paid_amount > 0 && (
                        <p className="text-xs text-green-600 mt-0.5">
                          Paid: ${formatCurrencyUtil(parseFloat(invoice.paid_amount?.toString() || '0'))}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {invoice.due_date ? (
                        <div>
                          <span className="text-sm text-gray-700">
                            {new Date(invoice.due_date).toLocaleDateString()}
                          </span>
                          {invoice.status === 'sent' && !invoice.voided && new Date(invoice.due_date) < new Date() && (
                            <p className="text-xs text-red-600 font-medium mt-0.5">Overdue</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {invoice.order?.id && (
                          <Link
                            href={`/dashboard/orders/${invoice.order.id}`}
                            target="_blank"
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Order"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                        )}
                        {/* Regenerate Pay Link Button */}
                        {!isClient && canRegeneratePayLink(invoice) && (
                          <button
                            onClick={() => handleRegeneratePayLink(invoice)}
                            disabled={regeneratingPayLink === invoice.id}
                            className={`p-2 rounded-lg transition-colors ${
                              invoice.pay_link 
                                ? 'text-green-500 hover:text-green-700 hover:bg-green-50' 
                                : 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'
                            } disabled:opacity-50`}
                            title={invoice.pay_link ? 'Regenerate Pay Link' : 'Generate Pay Link'}
                          >
                            {regeneratingPayLink === invoice.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CreditCard className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {/* Void Button */}
                        {!isClient && canVoid(invoice) && (
                          <button
                            onClick={() => setVoidModal({ isOpen: true, invoice })}
                            className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Void Invoice"
                          >
                            <FileX className="w-4 h-4" />
                          </button>
                        )}
                        {/* Delete Button */}
                        {!isClient && canDelete(invoice) && !invoice.voided && (
                          <button
                            onClick={() => setShowDeleteConfirm(invoice.id)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title={user?.role === 'super_admin' ? 'Delete (Super Admin)' : 'Delete Draft'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden divide-y divide-gray-200">
            {filteredInvoices.map(invoice => (
              <div key={invoice.id} className={`p-3 sm:p-4 hover:bg-gray-50 transition-colors ${invoice.voided ? 'opacity-60' : ''}`}>
                <div className="space-y-2">
                  {/* Invoice Number and Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className={`font-semibold text-sm text-gray-900 block ${invoice.voided ? 'line-through' : ''}`}>{invoice.invoice_number}</span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(invoice.created_at).toLocaleDateString()}
                      </p>
                      {invoice.voided && invoice.void_reason && (
                        <p className="text-xs text-red-500 mt-0.5 truncate" title={invoice.void_reason}>
                          Reason: {invoice.void_reason}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(invoice)}
                  </div>

                  {/* Order Info */}
                  {invoice.order && (
                    <div className="text-sm">
                      <span className="text-gray-600">Order: </span>
                      <span className="text-gray-900 font-medium">{invoice.order.order_name || invoice.order.order_number || '-'}</span>
                    </div>
                  )}

                  {/* Client (if not client user) */}
                  {!isClient && invoice.client && (
                    <div className="text-sm">
                      <span className="text-gray-600">Client: </span>
                      <span className="text-gray-900">{invoice.client.name}</span>
                    </div>
                  )}

                  {/* Amount */}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                    <div>
                      <span className={`text-lg font-bold text-gray-900 ${invoice.voided ? 'line-through' : ''}`}>
                        ${formatCurrencyUtil(parseFloat(invoice.amount?.toString() || '0'))}
                      </span>
                      {invoice.status === 'paid' && invoice.paid_amount > 0 && (
                        <p className="text-xs text-green-600 mt-0.5">
                          Paid: ${formatCurrencyUtil(parseFloat(invoice.paid_amount?.toString() || '0'))}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {invoice.due_date ? (
                        <>
                          <span className="text-xs text-gray-600 block">Due:</span>
                          <span className="text-sm text-gray-900">
                            {new Date(invoice.due_date).toLocaleDateString()}
                          </span>
                          {invoice.status === 'sent' && !invoice.voided && new Date(invoice.due_date) < new Date() && (
                            <p className="text-xs text-red-600 font-medium mt-0.5">Overdue</p>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-100 mt-2">
                    {invoice.order?.id && (
                      <Link
                        href={`/dashboard/orders/${invoice.order.id}`}
                        target="_blank"
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="View Order"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    )}
                    {/* Regenerate Pay Link Button - Mobile */}
                    {!isClient && canRegeneratePayLink(invoice) && (
                      <button
                        onClick={() => handleRegeneratePayLink(invoice)}
                        disabled={regeneratingPayLink === invoice.id}
                        className={`p-2 rounded-lg transition-colors ${
                          invoice.pay_link 
                            ? 'text-green-500 hover:text-green-700 hover:bg-green-50' 
                            : 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'
                        } disabled:opacity-50`}
                        title={invoice.pay_link ? 'Regenerate Pay Link' : 'Generate Pay Link'}
                      >
                        {regeneratingPayLink === invoice.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CreditCard className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    {/* PDF Download Button */}
                    {invoice.pdf_url && (
                      <a
                        href={invoice.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Download PDF"
                      >
                        <FileText className="w-4 h-4" />
                      </a>
                    )}
                    {/* Void Button - Mobile */}
                    {!isClient && canVoid(invoice) && (
                      <button
                        onClick={() => setVoidModal({ isOpen: true, invoice })}
                        className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Void Invoice"
                      >
                        <FileX className="w-4 h-4" />
                      </button>
                    )}
                    {!isClient && canDelete(invoice) && !invoice.voided && (
                      <button
                        onClick={() => setShowDeleteConfirm(invoice.id)}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title={user?.role === 'super_admin' ? 'Delete (Super Admin)' : 'Delete Draft'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="p-3 sm:p-4 md:p-6">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-6 max-w-sm w-full shadow-xl">
            <div className="mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Confirm Delete</h3>
              {user?.role === 'super_admin' && (
                <div className="flex items-center gap-2 mb-3 text-amber-600">
                  <Shield className="w-4 h-4" />
                  <span className="text-xs sm:text-sm">Super Admin Override</span>
                </div>
              )}
              <p className="text-sm sm:text-base text-gray-600">
                Are you sure you want to delete invoice{' '}
                <strong>{invoices.find(i => i.id === showDeleteConfirm)?.invoice_number}</strong>?
              </p>
              <p className="text-red-600 text-xs sm:text-sm mt-2">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteInvoice(showDeleteConfirm)}
                className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Invoice Modal */}
      {voidModal.invoice && (
        <VoidInvoiceModal
          isOpen={voidModal.isOpen}
          onClose={() => setVoidModal({ isOpen: false, invoice: null })}
          invoice={voidModal.invoice}
          onVoided={() => {
            notify.success('Invoice voided successfully');
            fetchData();
          }}
        />
      )}

      {/* Existing Invoices Modal (Invoice Gate) */}
      {checkResult && (
        <ExistingInvoicesModal
          isOpen={existingInvoicesModal.isOpen}
          onClose={handleCloseExistingInvoicesModal}
          orderId={existingInvoicesModal.orderId}
          orderNumber={existingInvoicesModal.orderNumber}
          existingInvoices={checkResult.existingInvoices}
          uninvoicedProductCount={checkResult.uninvoicedProductCount}
          totalProductCount={checkResult.totalProductCount}
          onProceedWithRemaining={handleProceedWithRemaining}
          onRefresh={handleRefreshAfterVoid}
        />
      )}

      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {isClient ? 'My Invoices' : 'Invoices'}
          </h1>
          {!isClient && (
            <button
              onClick={() => fetchData()}
              className="p-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>

        {/* Tabs - Hidden for clients */}
        {!isClient && (
          <div className="border-b border-gray-200 mb-4 overflow-x-auto">
            <nav className="-mb-px flex overflow-x-auto scrollbar-hide whitespace-nowrap gap-x-1">
              <button
                onClick={() => setActiveTab('approval')}
                className={`py-3 px-3 md:px-4 border-b-2 font-medium text-sm flex items-center gap-1.5 md:gap-2 flex-shrink-0 ${
                  activeTab === 'approval'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="whitespace-nowrap">For Approval</span>
                {stats.forApproval > 0 && (
                  <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0">
                    {stats.forApproval}
                  </span>
                )}
              </button>
              
              {/* In Production Tab */}
              <button
                onClick={() => setActiveTab('inproduction')}
                className={`py-3 px-3 md:px-4 border-b-2 font-medium text-sm flex items-center gap-1.5 md:gap-2 flex-shrink-0 ${
                  activeTab === 'inproduction'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Play className="w-4 h-4 flex-shrink-0" />
                <span className="whitespace-nowrap">In Production</span>
                {stats.inProduction > 0 && (
                  <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0">
                    {stats.inProduction}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('drafts')}
                className={`py-3 px-3 md:px-4 border-b-2 font-medium text-sm flex items-center gap-1.5 md:gap-2 flex-shrink-0 ${
                  activeTab === 'drafts'
                    ? 'border-gray-500 text-gray-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span className="whitespace-nowrap">Drafts</span>
                {stats.drafts > 0 && (
                  <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0">
                    {stats.drafts}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('sent')}
                className={`py-2 sm:py-3 px-3 sm:px-4 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                  activeTab === 'sent'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Sent</span>
                {stats.sent > 0 && (
                  <span className="bg-blue-100 text-blue-600 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold">
                    {stats.sent}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('paid')}
                className={`py-3 px-3 md:px-4 border-b-2 font-medium text-sm flex items-center gap-1.5 md:gap-2 flex-shrink-0 ${
                  activeTab === 'paid'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span className="whitespace-nowrap">Paid</span>
                {stats.paid > 0 && (
                  <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0">
                    {stats.paid}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('all')}
                className={`py-3 px-3 md:px-4 border-b-2 font-medium text-sm flex items-center gap-1.5 md:gap-2 flex-shrink-0 ${
                  activeTab === 'all'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Inbox className="w-4 h-4 flex-shrink-0" />
                <span className="whitespace-nowrap">All Invoices</span>
              </button>
            </nav>
          </div>
        )}

        {/* Search Bar */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <input
              type="text"
              placeholder={(activeTab === 'approval' || activeTab === 'inproduction') && !isClient ? "Search orders..." : "Search invoices..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base text-gray-900 placeholder-gray-500"
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {activeTab === 'approval' && !isClient && renderOrderListView(filteredOrders, 'approval')}
          {activeTab === 'inproduction' && !isClient && renderOrderListView(filteredProductionOrders, 'inproduction')}
          {activeTab !== 'approval' && activeTab !== 'inproduction' && renderInvoiceList()}
        </>
      )}
    </div>
  );
}