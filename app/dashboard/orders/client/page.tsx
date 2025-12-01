/**
 * Client Orders Page - /dashboard/orders/client
 * Clean, professional dashboard for client order review and approval
 * Features: 4 tabs, media modal, variant expansion, action-required sorting
 * UPDATED: Better top cards, show all products, action required sorting
 * Last Modified: November 30, 2025
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Package, CheckCircle, Calendar, 
  Loader2, ChevronDown, ChevronRight,
  FileText, Truck, Check, X, Image as ImageIcon,
  Layers, Clock, AlertTriangle, Box, MessageSquare, Send
} from 'lucide-react';

interface OrderItem {
  id: string;
  variant_combo: string;
  quantity: number;
  notes?: string;
}

interface OrderProduct {
  id: string;
  product_order_number: string;
  description: string;
  product_status: string;
  routed_to: string;
  routed_at?: string;
  client_product_price?: number;
  client_shipping_air_price?: number;
  client_shipping_boat_price?: number;
  selected_shipping_method?: string;
  sample_fee?: number;
  sample_required?: boolean;
  order_items?: OrderItem[];
  order_media?: any[];
}

interface Order {
  id: string;
  order_number: string;
  order_name: string | null;
  status: string;
  created_at: string;
  sample_required?: boolean;
  sample_routed_to?: string;
  sample_status?: string;
  sample_fee?: number;
  sample_eta?: string;
  sample_notes?: string;
  order_products: OrderProduct[];
  order_media?: any[];
  client_notes?: ClientNote[];
}

interface ClientNote {
  id: string;
  order_id: string;
  note: string;
  created_by: string;
  created_by_name: string;
  created_by_role: 'client' | 'admin';
  created_at: string;
}

export default function ClientOrdersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [clientName, setClientName] = useState('');
  const [activeTab, setActiveTab] = useState<'orders' | 'samples' | 'products' | 'approved'>('orders');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvingProductId, setApprovingProductId] = useState<string | null>(null);
  
  // Media Modal State
  const [mediaModal, setMediaModal] = useState<{
    isOpen: boolean;
    media: any[];
    title: string;
  }>({
    isOpen: false,
    media: [],
    title: ''
  });

  // Notes Modal State
  const [notesModal, setNotesModal] = useState<{
    isOpen: boolean;
    orderId: string;
    orderName: string;
    notes: ClientNote[];
  }>({
    isOpen: false,
    orderId: '',
    orderName: '',
    notes: []
  });
  const [newNote, setNewNote] = useState('');
  const [sendingNote, setSendingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== 'client') {
      router.push('/dashboard');
      return;
    }

    fetchOrders(user.email);
  }, [router]);

  const fetchOrders = async (email: string) => {
    try {
      setLoading(true);

      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, name, email')
        .eq('email', email);

      if (clientError) {
        console.error('Error finding client:', clientError);
        setLoading(false);
        return;
      }

      if (!clientData || clientData.length === 0) {
        setLoading(false);
        return;
      }

      const client = clientData[0];
      setClientName(client.name);

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_name,
          status,
          created_at,
          sample_required,
          sample_routed_to,
          sample_status,
          sample_fee,
          sample_eta,
          sample_notes,
          order_media!order_media_order_id_fkey(id, file_url, file_type, original_filename, is_sample),
          order_products(
            id,
            product_order_number,
            description,
            product_status,
            routed_to,
            routed_at,
            client_product_price,
            client_shipping_air_price,
            client_shipping_boat_price,
            selected_shipping_method,
            sample_fee,
            sample_required,
            order_items(id, variant_combo, quantity, notes),
            order_media!order_media_order_product_id_fkey(id, file_url, file_type, original_filename)
          )
        `)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        console.error('Error details:', JSON.stringify(ordersError, null, 2));
        setLoading(false);
        return;
      }

      setOrders(ordersData || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
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

  const toggleProductExpansion = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleApproveSample = async (orderId: string) => {
    setApprovingId(orderId);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      const { error } = await supabase
        .from('orders')
        .update({
          sample_status: 'approved',
          sample_client_approved: true,
          sample_client_approved_at: new Date().toISOString(),
          sample_client_approved_by: user.id
        })
        .eq('id', orderId);

      if (error) throw error;

      if (user.email) {
        await fetchOrders(user.email);
      }
    } catch (error) {
      console.error('Error approving sample:', error);
      alert('Failed to approve sample. Please try again.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleApproveProduct = async (productId: string) => {
    setApprovingProductId(productId);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      const { error } = await supabase
        .from('order_products')
        .update({
          product_status: 'client_approved',
          client_approved: true,
          client_approved_at: new Date().toISOString(),
          routed_to: 'admin',
          routed_at: new Date().toISOString(),
          routed_by: user.id
        })
        .eq('id', productId);

      if (error) throw error;

      if (user.email) {
        await fetchOrders(user.email);
      }
    } catch (error) {
      console.error('Error approving product:', error);
      alert('Failed to approve product. Please try again.');
    } finally {
      setApprovingProductId(null);
    }
  };

  const openMediaModal = (media: any[], title: string) => {
    setMediaModal({
      isOpen: true,
      media,
      title
    });
  };

  const openNotesModal = async (order: Order) => {
    setNotesModal({
      isOpen: true,
      orderId: order.id,
      orderName: order.order_name || order.order_number,
      notes: []
    });
    setNewNote('');
    setLoadingNotes(true);
    
    try {
      // Fetch notes for this order
      const { data, error } = await supabase
        .from('client_admin_notes')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching notes:', error);
        // Table might not exist yet - that's ok
      } else {
        setNotesModal(prev => ({ ...prev, notes: data || [] }));
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleSendNote = async () => {
    if (!newNote.trim() || !notesModal.orderId) return;
    
    setSendingNote(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      const noteData = {
        order_id: notesModal.orderId,
        note: newNote.trim(),
        created_by: user.id,
        created_by_name: user.name || user.email || 'Client',
        created_by_role: 'client',
        created_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('client_admin_notes')
        .insert(noteData)
        .select()
        .single();
      
      if (error) throw error;
      
      // Add to local state
      setNotesModal(prev => ({
        ...prev,
        notes: [...prev.notes, data]
      }));
      setNewNote('');
    } catch (error) {
      console.error('Error sending note:', error);
      alert('Failed to send note. Please try again.');
    } finally {
      setSendingNote(false);
    }
  };

  const formatCurrency = (amount: number | string | null | undefined) => {
    const num = parseFloat(String(amount || 0));
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; classes: string }> = {
      'draft': { label: 'Draft', classes: 'bg-gray-100 text-gray-600' },
      'pending': { label: 'Pending', classes: 'bg-amber-100 text-amber-700' },
      'in_progress': { label: 'In Progress', classes: 'bg-blue-100 text-blue-700' },
      'pending_client_approval': { label: 'Awaiting Approval', classes: 'bg-amber-100 text-amber-700' },
      'client_approved': { label: 'Approved', classes: 'bg-green-100 text-green-700' },
      'in_production': { label: 'In Production', classes: 'bg-purple-100 text-purple-700' },
      'shipped': { label: 'Shipped', classes: 'bg-indigo-100 text-indigo-700' },
      'completed': { label: 'Completed', classes: 'bg-green-100 text-green-700' },
      'approved': { label: 'Approved', classes: 'bg-green-100 text-green-700' },
      'sent_to_manufacturer': { label: 'With Manufacturer', classes: 'bg-purple-100 text-purple-700' }
    };
    
    const config = statusMap[status] || { label: status.replace(/_/g, ' '), classes: 'bg-gray-100 text-gray-600' };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${config.classes}`}>
        {config.label}
      </span>
    );
  };

  const calculateProductTotal = (product: OrderProduct) => {
    const totalQty = product.order_items?.reduce((sum, item) => 
      sum + (item.quantity || 0), 0
    ) || 0;
    
    const unitPrice = parseFloat(String(product.client_product_price || 0));
    let total = unitPrice * totalQty;
    
    if (product.selected_shipping_method === 'air') {
      total += parseFloat(String(product.client_shipping_air_price || 0));
    } else if (product.selected_shipping_method === 'boat') {
      total += parseFloat(String(product.client_shipping_boat_price || 0));
    }
    
    return { unitPrice, total, totalQty };
  };

  // Check if order needs action
  const orderNeedsAction = (order: Order): boolean => {
    const sampleNeedsApproval = order.sample_required && 
      order.sample_routed_to === 'client' && 
      order.sample_status !== 'approved';
    
    const productsNeedApproval = order.order_products?.some(p => 
      p.routed_to === 'client' && p.product_status === 'pending_client_approval'
    );
    
    return sampleNeedsApproval || productsNeedApproval;
  };

  // Stats calculations
  const samplesAwaitingApproval = orders.filter(o => 
    o.sample_required && 
    o.sample_routed_to === 'client' && 
    o.sample_status !== 'approved'
  ).length;

  const productsAwaitingApproval = orders.reduce((sum, order) => {
    const pending = order.order_products?.filter(p => 
      p.routed_to === 'client' && 
      p.product_status === 'pending_client_approval'
    ).length || 0;
    return sum + pending;
  }, 0);

  const approvedCount = orders.reduce((sum, order) => {
    let count = 0;
    if (order.sample_status === 'approved') count++;
    const approvedProducts = order.order_products?.filter(p => 
      p.product_status === 'client_approved'
    ).length || 0;
    return sum + count + approvedProducts;
  }, 0);

  // Filtered and sorted data based on active tab
  const getFilteredContent = () => {
    let filtered: Order[] = [];
    
    switch (activeTab) {
      case 'orders':
        filtered = [...orders];
        break;
      case 'samples':
        filtered = orders.filter(o => 
          o.sample_required && 
          o.sample_routed_to === 'client' && 
          o.sample_status !== 'approved'
        );
        break;
      case 'products':
        filtered = orders.filter(o => 
          o.order_products?.some(p => 
            p.routed_to === 'client' && 
            p.product_status === 'pending_client_approval'
          )
        );
        break;
      case 'approved':
        filtered = orders.filter(o => 
          o.sample_status === 'approved' ||
          o.order_products?.some(p => p.product_status === 'client_approved')
        );
        break;
      default:
        filtered = orders;
    }
    
    // Sort: Action required first (oldest first), then non-action (oldest first)
    if (activeTab === 'orders') {
      const needsAction = filtered.filter(o => orderNeedsAction(o));
      const noAction = filtered.filter(o => !orderNeedsAction(o));
      
      // Sort both by created_at ascending (oldest first)
      needsAction.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      noAction.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      return [...needsAction, ...noAction];
    }
    
    // For other tabs, sort by oldest first
    filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    return filtered;
  };

  const filteredOrders = getFilteredContent();

  // Get ALL products for orders tab (no filtering)
  const getProductsToShow = (order: Order) => {
    if (activeTab === 'orders') {
      // Show ALL products
      return order.order_products || [];
    }
    if (activeTab === 'products') {
      // Only pending products
      return order.order_products?.filter(p => 
        p.routed_to === 'client' && p.product_status === 'pending_client_approval'
      ) || [];
    }
    if (activeTab === 'approved') {
      // Only approved products
      return order.order_products?.filter(p => 
        p.product_status === 'client_approved'
      ) || [];
    }
    // Samples tab - show products that are with client
    return order.order_products?.filter(p => 
      p.routed_to === 'client'
    ) || [];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
          <p className="mt-3 text-gray-500 text-sm">Loading your orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Orders</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Review and approve your orders</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">
        {/* Stats Cards - 4 columns with clean styling */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
          {/* All Orders */}
          <button
            onClick={() => setActiveTab('orders')}
            className={`group relative p-3 sm:p-5 rounded-xl border-2 transition-all text-center ${
              activeTab === 'orders'
                ? 'bg-blue-50 border-blue-400 shadow-md'
                : 'bg-white border-blue-200 hover:bg-blue-50 hover:border-blue-300'
            }`}
          >
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center bg-blue-100 mb-2 sm:mb-3">
                <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{orders.length}</p>
              <p className="text-xs sm:text-sm font-semibold mt-1 text-gray-600">All Orders</p>
              {/* Spacer to match height of cards with "Action required" */}
              <p className="text-xs mt-1 invisible hidden sm:block">Action required</p>
            </div>
          </button>

          {/* Samples Awaiting Approval */}
          <button
            onClick={() => setActiveTab('samples')}
            className={`group relative p-3 sm:p-5 rounded-xl border-2 transition-all text-center ${
              activeTab === 'samples'
                ? 'bg-amber-50 border-amber-400 shadow-md'
                : 'bg-white border-amber-200 hover:bg-amber-50 hover:border-amber-300'
            }`}
          >
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center bg-amber-100 mb-2 sm:mb-3">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{samplesAwaitingApproval}</p>
              <p className="text-xs sm:text-sm font-semibold mt-1 text-gray-600 leading-tight">Samples Awaiting Approval</p>
              {samplesAwaitingApproval > 0 && activeTab !== 'samples' ? (
                <p className="text-xs text-amber-600 mt-1 font-bold">Action required</p>
              ) : (
                <p className="text-xs mt-1 invisible hidden sm:block">Action required</p>
              )}
            </div>
          </button>

          {/* Products Awaiting Approval */}
          <button
            onClick={() => setActiveTab('products')}
            className={`group relative p-3 sm:p-5 rounded-xl border-2 transition-all text-center ${
              activeTab === 'products'
                ? 'bg-indigo-50 border-indigo-400 shadow-md'
                : 'bg-white border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300'
            }`}
          >
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center bg-indigo-100 mb-2 sm:mb-3">
                <Package className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{productsAwaitingApproval}</p>
              <p className="text-xs sm:text-sm font-semibold mt-1 text-gray-600 leading-tight">Products Awaiting Approval</p>
              {productsAwaitingApproval > 0 && activeTab !== 'products' ? (
                <p className="text-xs text-indigo-600 mt-1 font-bold">Action required</p>
              ) : (
                <p className="text-xs mt-1 invisible hidden sm:block">Action required</p>
              )}
            </div>
          </button>

          {/* Approved */}
          <button
            onClick={() => setActiveTab('approved')}
            className={`group relative p-3 sm:p-5 rounded-xl border-2 transition-all text-center ${
              activeTab === 'approved'
                ? 'bg-green-50 border-green-400 shadow-md'
                : 'bg-white border-green-200 hover:bg-green-50 hover:border-green-300'
            }`}
          >
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center bg-green-100 mb-2 sm:mb-3">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{approvedCount}</p>
              <p className="text-xs sm:text-sm font-semibold mt-1 text-gray-600">Approved</p>
              {/* Spacer to match height of cards with "Action required" */}
              <p className="text-xs mt-1 invisible hidden sm:block">Action required</p>
            </div>
          </button>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Tab Header */}
          <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="font-semibold text-gray-900 text-sm sm:text-base">
              {activeTab === 'orders' && 'All Orders'}
              {activeTab === 'samples' && 'Samples Awaiting Approval'}
              {activeTab === 'products' && 'Products Awaiting Approval'}
              {activeTab === 'approved' && 'Approved Items'}
            </h2>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="py-12 sm:py-16 text-center px-3 sm:px-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                {activeTab === 'approved' ? (
                  <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7 text-gray-400" />
                ) : (
                  <Package className="w-6 h-6 sm:w-7 sm:h-7 text-gray-400" />
                )}
              </div>
              <p className="text-gray-700 font-medium text-sm sm:text-base">
                {activeTab === 'orders' && 'No orders yet'}
                {activeTab === 'samples' && 'No samples awaiting approval'}
                {activeTab === 'products' && 'No products awaiting approval'}
                {activeTab === 'approved' && 'No approved items yet'}
              </p>
              <p className="text-gray-400 text-xs sm:text-sm mt-1">
                {(activeTab === 'samples' || activeTab === 'products') && "You're all caught up!"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredOrders.map((order) => {
                const isExpanded = expandedOrders.has(order.id);
                const hasSampleForClient = order.sample_required && order.sample_routed_to === 'client';
                const sampleNeedsApproval = hasSampleForClient && order.sample_status !== 'approved';
                const sampleApproved = hasSampleForClient && order.sample_status === 'approved';
                const productCount = order.order_products?.length || 0;
                const productsToShow = getProductsToShow(order);
                const needsAction = orderNeedsAction(order);
                
                // Get sample media
                const sampleMedia = order.order_media?.filter(m => 
                  m.is_sample || m.file_type === 'order_sample'
                ) || [];

                return (
                  <div key={order.id}>
                    {/* Order Row */}
                    <div 
                      className={`px-3 sm:px-4 md:px-6 py-3 sm:py-4 cursor-pointer transition-colors relative ${
                        needsAction ? 'hover:bg-amber-50' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => toggleOrderExpansion(order.id)}
                    >
                      {/* Notes Button - Top Right on Mobile */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openNotesModal(order);
                        }}
                        className="sm:hidden absolute top-3 right-4 p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex items-center z-10"
                        title="View Notes"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-col sm:flex-row">
                        {/* Order Info - Full Width Container on Mobile */}
                        <div className="flex items-center gap-3 w-full sm:flex-1 pr-12 sm:pr-0">
                          {/* Expand Arrow */}
                          <div className="flex-shrink-0 w-5 sm:w-6">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                            )}
                          </div>

                          {/* Order Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                                {order.order_name || 'Untitled Order'}
                              </h3>
                              
                              <span className="text-xs sm:text-sm text-gray-400">
                                #{order.order_number}
                              </span>
                              {getStatusBadge(order.status)}
                            </div>
                            <div className="flex items-center gap-3 sm:gap-4 mt-1 text-xs sm:text-sm text-gray-500 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                <span className="hidden sm:inline">Created </span>{formatDate(order.created_at)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Box className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                {productCount} product{productCount !== 1 ? 's' : ''}
                              </span>
                              {hasSampleForClient && (
                                <span className="flex items-center gap-1">
                                  <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                  1 sample
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Side - Notes & Status (Desktop only for Notes) */}
                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 w-full sm:w-auto justify-end sm:justify-start pl-8 sm:pl-0">
                          {/* Notes Button - Desktop */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openNotesModal(order);
                            }}
                            className="hidden sm:flex px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors items-center gap-1.5"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Notes
                          </button>
                          
                          {needsAction && (
                            <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full flex items-center gap-1 sm:gap-1.5">
                              <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              <span className="hidden sm:inline">Action Required</span>
                              <span className="sm:hidden">Action</span>
                            </span>
                          )}
                          {!needsAction && sampleApproved && activeTab === 'approved' && (
                            <span className="px-2 sm:px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                              <span className="hidden sm:inline">Sample Approved</span>
                              <span className="sm:hidden">Approved</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-3 sm:px-4 md:px-6 pb-4 sm:pb-5 bg-gray-50/50">
                        <div className="ml-8 sm:ml-10 space-y-3">
                          
                          {/* Sample Section */}
                          {hasSampleForClient && (activeTab === 'orders' || activeTab === 'samples' || activeTab === 'approved') && (
                            <div className={`rounded-xl border p-3 sm:p-4 ${
                              sampleApproved
                                ? 'bg-green-50 border-green-200'
                                : 'bg-white border-amber-200'
                            }`}>
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                                <div className="flex-1 w-full sm:w-auto">
                                  <div className="flex items-center gap-2 sm:gap-3">
                                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                      sampleApproved ? 'bg-green-500' : 'bg-amber-500'
                                    }`}>
                                      <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Sample Request</h4>
                                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs sm:text-sm text-gray-600">
                                        {order.sample_fee && (
                                          <span>Fee: <span className="font-semibold">${formatCurrency(order.sample_fee)}</span></span>
                                        )}
                                        {order.sample_eta && (
                                          <span className="flex items-center gap-1">
                                            <Truck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                            ETA: {formatDate(order.sample_eta)}
                                          </span>
                                        )}
                                        {sampleMedia.length > 0 && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openMediaModal(sampleMedia, 'Sample Media');
                                            }}
                                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                                          >
                                            <ImageIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                            Media ({sampleMedia.length})
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {sampleApproved ? (
                                  <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-100 text-green-700 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-center">
                                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    Sample Approved
                                  </span>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApproveSample(order.id);
                                    }}
                                    disabled={approvingId === order.id}
                                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 sm:gap-2 shadow-sm w-full sm:w-auto justify-center"
                                  >
                                    {approvingId === order.id ? (
                                      <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                                    ) : (
                                      <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    )}
                                    Approve Sample
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Products Section */}
                          {productsToShow.length > 0 && (
                            <div className="space-y-2">
                              {productsToShow.map((product) => {
                                const isProductExpanded = expandedProducts.has(product.id);
                                const { unitPrice, total, totalQty } = calculateProductTotal(product);
                                const productMedia = product.order_media || [];
                                const isApproved = product.product_status === 'client_approved';
                                const needsApproval = product.routed_to === 'client' && product.product_status === 'pending_client_approval';

                                return (
                                  <div 
                                    key={product.id}
                                    className={`rounded-xl border overflow-hidden ${
                                      isApproved
                                        ? 'bg-green-50 border-green-200'
                                        : needsApproval
                                        ? 'bg-white border-blue-200'
                                        : 'bg-white border-gray-200'
                                    }`}
                                  >
                                    {/* Product Header - Compact */}
                                    <div className="px-3 sm:px-4 py-2 sm:py-3">
                                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                                        {/* Product Info */}
                                        <div className="flex items-start gap-2 sm:gap-3 min-w-0 w-full sm:w-auto">
                                          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                            isApproved ? 'bg-green-500' : needsApproval ? 'bg-blue-500' : 'bg-gray-400'
                                          }`}>
                                            <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <h4 className="font-semibold text-gray-900 text-sm sm:text-base">
                                                {product.description || 'Product'}
                                              </h4>
                                              {/* Status Badge - Show on mobile near title */}
                                              {!isApproved && !needsApproval && (
                                                <span className="sm:hidden">
                                                  {getStatusBadge(product.product_status)}
                                                </span>
                                              )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5">{product.product_order_number}</p>
                                          </div>
                                        </div>
                                        
                                        {/* Pricing Section - Stacked on mobile */}
                                        <div className="w-full sm:w-auto flex flex-col gap-2 sm:gap-0 sm:flex-row sm:items-center sm:gap-4">
                                          {/* Pricing Info */}
                                          <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4 text-xs sm:text-sm">
                                            <div>
                                              <span className="text-gray-500">Qty:</span>
                                              <span className="font-semibold text-gray-900 ml-1">{totalQty}</span>
                                            </div>
                                            <div>
                                              <span className="text-gray-500">Per Item:</span>
                                              <span className="font-semibold text-gray-900 ml-1">${formatCurrency(unitPrice)}</span>
                                            </div>
                                            <div>
                                              <span className="text-gray-500">Total:</span>
                                              <span className="font-bold text-gray-900 ml-1">${formatCurrency(total)}</span>
                                            </div>
                                          </div>

                                          {/* Approve Button or Status */}
                                          {isApproved ? (
                                            <span className="px-3 py-1.5 bg-green-100 text-green-700 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-1.5 justify-center">
                                              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                              Approved
                                            </span>
                                          ) : needsApproval ? (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleApproveProduct(product.id);
                                              }}
                                              disabled={approvingProductId === product.id}
                                              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 sm:gap-2 shadow-sm justify-center"
                                            >
                                              {approvingProductId === product.id ? (
                                                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                                              ) : (
                                                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                              )}
                                              Approve
                                            </button>
                                          ) : (
                                            <span className="hidden sm:inline text-xs sm:text-sm">
                                              {getStatusBadge(product.product_status)}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Second Row - Media & Variants Toggle */}
                                      <div className="flex items-center gap-3 sm:gap-4 mt-2 ml-0 sm:ml-12 flex-wrap">
                                        {productMedia.length > 0 && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openMediaModal(productMedia, product.description || 'Product Media');
                                            }}
                                            className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium"
                                          >
                                            <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                            View Media ({productMedia.length})
                                          </button>
                                        )}
                                        {product.order_items && product.order_items.length > 0 && (
                                          <button
                                            onClick={(e) => toggleProductExpansion(product.id, e)}
                                            className="flex items-center gap-1 text-xs sm:text-sm text-gray-500 hover:text-gray-700 font-medium"
                                          >
                                            {isProductExpanded ? (
                                              <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                            ) : (
                                              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                            )}
                                            {isProductExpanded ? 'Hide' : 'Show'} Variants ({product.order_items.length})
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Expanded Variants */}
                                    {isProductExpanded && product.order_items && (
                                      <div className={`border-t px-3 sm:px-4 py-2 sm:py-3 ${isApproved ? 'border-green-200 bg-white' : 'border-gray-100 bg-gray-50'}`}>
                                        {/* Mobile: Stacked layout */}
                                        <div className="sm:hidden space-y-3">
                                          {product.order_items.map((item, idx) => (
                                            <div key={item.id} className={`pb-3 ${idx < product.order_items.length - 1 ? 'border-b border-gray-200' : ''}`}>
                                              <div className="flex items-center justify-between mb-1">
                                                <span className="font-medium text-gray-900 text-sm">{item.variant_combo}</span>
                                                <span className="font-semibold text-gray-900 text-sm">Qty: {item.quantity}</span>
                                              </div>
                                              {item.notes && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                  <span className="font-medium">Notes:</span> {item.notes}
                                                </p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                        
                                        {/* Desktop: Table layout */}
                                        <div className="hidden sm:block overflow-x-auto">
                                          <table className="w-full text-sm">
                                            <thead>
                                              <tr className="text-left text-gray-500 text-xs uppercase">
                                                <th className="pb-2 font-semibold" style={{ width: '25%' }}>Variant</th>
                                                <th className="pb-2 font-semibold" style={{ width: '8%' }}>Qty</th>
                                                <th className="pb-2 font-semibold pl-4" style={{ width: '67%' }}>Notes</th>
                                              </tr>
                                            </thead>
                                            <tbody className="text-gray-700">
                                              {product.order_items.map((item, idx) => (
                                                <tr key={item.id} className={idx > 0 ? 'border-t border-gray-100' : ''}>
                                                  <td className="py-2 font-medium">{item.variant_combo}</td>
                                                  <td className="py-2 font-semibold">{item.quantity}</td>
                                                  <td className="py-2 pl-4 text-gray-500">{item.notes || '—'}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* No content message - only show if truly nothing */}
                          {!hasSampleForClient && productsToShow.length === 0 && (
                            <div className="text-center py-4 sm:py-6 text-gray-500 text-xs sm:text-sm">
                              No items to display for this order
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-gray-400 px-3">
          Need help? Contact your account manager or email{' '}
          <a href="mailto:sales@bybirdhaus.com" className="text-blue-600 hover:text-blue-700 font-medium">
            sales@bybirdhaus.com
          </a>
        </div>
      </div>

      {/* Media Modal */}
      {mediaModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{mediaModal.title}</h3>
                  <p className="text-xs sm:text-sm text-gray-500">{mediaModal.media.length} file{mediaModal.media.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <button
                onClick={() => setMediaModal({ isOpen: false, media: [], title: '' })}
                className="p-1.5 sm:p-2 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-80px)] sm:max-h-[calc(90vh-100px)]">
              {mediaModal.media.length === 0 ? (
                <p className="text-gray-500 text-center py-8 text-sm sm:text-base">No media files</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                  {mediaModal.media.map((file, idx) => {
                    const isImage = file.file_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                    
                    return (
                      <a
                        key={idx}
                        href={file.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block border border-gray-200 rounded-lg sm:rounded-xl overflow-hidden hover:shadow-lg hover:border-blue-300 transition-all"
                      >
                        {isImage ? (
                          <div className="aspect-square bg-gray-100">
                            <img 
                              src={file.file_url} 
                              alt={file.original_filename || 'Image'} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                        ) : (
                          <div className="aspect-square bg-gray-50 flex flex-col items-center justify-center">
                            <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mb-2" />
                            <span className="text-xs text-gray-500 uppercase font-medium">
                              {file.file_url?.split('.').pop() || 'File'}
                            </span>
                          </div>
                        )}
                        <div className="p-2 sm:p-3 bg-white border-t border-gray-100">
                          <p className="text-xs sm:text-sm text-gray-700 truncate font-medium">
                            {file.original_filename || 'File'}
                          </p>
                          <p className="text-xs text-blue-600 mt-1 group-hover:underline">
                            Click to open →
                          </p>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {notesModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl max-w-lg w-full max-h-[85vh] sm:max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">Order Notes</h3>
                  <p className="text-xs sm:text-sm text-gray-500 truncate">{notesModal.orderName}</p>
                </div>
              </div>
              <button
                onClick={() => setNotesModal({ isOpen: false, orderId: '', orderName: '', notes: [] })}
                className="p-1.5 sm:p-2 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Notes History */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3 min-h-[200px] max-h-[400px] bg-gray-50">
              {loadingNotes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 animate-spin" />
                </div>
              ) : notesModal.notes.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <MessageSquare className="w-8 h-8 sm:w-10 sm:h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-xs sm:text-sm">No notes yet</p>
                  <p className="text-gray-400 text-xs mt-1">Send a message to your account manager</p>
                </div>
              ) : (
                notesModal.notes.map((note) => {
                  const isClient = note.created_by_role === 'client';
                  return (
                    <div 
                      key={note.id}
                      className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] sm:max-w-[80%] rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 ${
                        isClient 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-white border border-gray-200 text-gray-700'
                      }`}>
                        <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{note.note}</p>
                        <div className={`flex items-center gap-2 mt-1 sm:mt-1.5 text-xs ${
                          isClient ? 'text-blue-100' : 'text-gray-400'
                        }`}>
                          <span className="truncate">{note.created_by_name}</span>
                          <span>•</span>
                          <span className="whitespace-nowrap">{formatDate(note.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            {/* New Note Input */}
            <div className="p-3 sm:p-4 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-xl text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendNote();
                    }
                  }}
                />
                <button
                  onClick={handleSendNote}
                  disabled={!newNote.trim() || sendingNote}
                  className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 sm:gap-2 self-end"
                >
                  {sendingNote ? (
                    <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Press Enter to send, Shift+Enter for new line</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}