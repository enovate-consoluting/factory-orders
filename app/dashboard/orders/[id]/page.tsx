'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useOrderData } from './hooks/useOrderData';
import { getUserRole, usePermissions } from './hooks/usePermissions';
import { OrderHeader } from './components/shared/OrderHeader';
import { StatusBadge } from './components/shared/StatusBadge';
import { AdminProductCard } from './components/admin/AdminProductCard';
import { ManufacturerProductCard } from './components/manufacturer/ManufacturerProductCard';
import { HistoryModal } from './components/modals/HistoryModal';
import { RouteModal } from './components/modals/RouteModal';
import { supabase } from '@/lib/supabase';
import { Building, Mail, Package, AlertCircle, Send, Save, Loader2, Edit2, Eye, EyeOff, X, Check } from 'lucide-react';
import { formatOrderNumber } from '@/lib/utils/orderUtils';

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  const { order, loading, error, refetch } = useOrderData(id);
  const permissions = usePermissions();
  const userRole = getUserRole();
  
  // NEW: State for editing client
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [availableClients, setAvailableClients] = useState<any[]>([]);
  const [savingClient, setSavingClient] = useState(false);
  
  // NEW: State for showing all products (super admin only)
  const [showAllProducts, setShowAllProducts] = useState(false);
  
  // UPDATED: Calculate total amount with CLIENT prices for everyone except manufacturers
  const calculateOrderTotal = () => {
    if (!order?.order_products) return 0;
    
    let total = 0;
    const isManufacturer = userRole === 'manufacturer';
    
    order.order_products.forEach((product: any) => {
      // Get total quantity for this product
      const totalQty = product.order_items?.reduce((sum: number, item: any) => 
        sum + (item.quantity || 0), 0) || 0;
      
      // IMPORTANT: Use different prices based on role
      let productPrice = 0;
      let sampleFee = 0;
      let shippingPrice = 0;
      
      if (isManufacturer) {
        // Manufacturers see their original prices (no markup)
        productPrice = parseFloat(product.product_price || 0);
        sampleFee = parseFloat(product.sample_fee || 0);
        
        if (product.selected_shipping_method === 'air') {
          shippingPrice = parseFloat(product.shipping_air_price || 0);
        } else if (product.selected_shipping_method === 'boat') {
          shippingPrice = parseFloat(product.shipping_boat_price || 0);
        }
      } else {
        // Admin/Super Admin see CLIENT prices (with markup)
        // Use client prices if available, fallback to regular prices
        productPrice = parseFloat(product.client_product_price || product.product_price || 0);
        sampleFee = parseFloat(product.client_sample_fee || product.sample_fee || 0);
        
        if (product.selected_shipping_method === 'air') {
          shippingPrice = parseFloat(product.client_shipping_air_price || product.shipping_air_price || 0);
        } else if (product.selected_shipping_method === 'boat') {
          shippingPrice = parseFloat(product.client_shipping_boat_price || product.shipping_boat_price || 0);
        }
      }
      
      // Calculate totals
      total += productPrice * totalQty;
      total += sampleFee;
      total += shippingPrice;
    });
    
    return total;
  };
  
  const totalAmount = calculateOrderTotal();
  const [workflowUpdating, setWorkflowUpdating] = useState(false);
  const [manufacturerId, setManufacturerId] = useState<string | null>(null);
  const [subManufacturers, setSubManufacturers] = useState<any[]>([]);
  const [selectedSubManufacturer, setSelectedSubManufacturer] = useState<string>('');
  const [viewedHistory, setViewedHistory] = useState<Record<string, number>>({});
  
  // History Modal State
  const [historyModal, setHistoryModal] = useState({
    isOpen: false,
    productId: '',
    productName: ''
  });

  // Route Modal State for individual products
  const [routeModal, setRouteModal] = useState<{
    isOpen: boolean;
    product: any;
  }>({
    isOpen: false,
    product: null
  });

  // NEW: Master Route Modal State for Save All & Route
  const [masterRouteModal, setMasterRouteModal] = useState({
    isOpen: false,
    isSaving: false
  });

  // NEW: Track dirty state for manufacturer cards
  const manufacturerCardRefs = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    // Fetch sub manufacturers for assignment
    const fetchSubManufacturers = async () => {
      const userData = localStorage.getItem('user');
      if (!userData) return;
      const user = JSON.parse(userData);
      // Only fetch if manufacturer
      if (userRole === 'manufacturer') {
        const { data, error } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('created_by', user.id)
          .eq('role', 'sub_manufacturer');
        if (!error && data) setSubManufacturers(data);
      }
    };
    fetchSubManufacturers();
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }
    
    // Get manufacturer ID if user is a manufacturer
    if (userRole === 'manufacturer') {
      fetchManufacturerId(JSON.parse(userData));
    }
    
    // Load viewed history from localStorage
    const viewed = localStorage.getItem(`viewedHistory_${id}`);
    if (viewed) {
      setViewedHistory(JSON.parse(viewed));
    }
    
    // NEW: Fetch available clients for editing
    if (userRole === 'admin' || userRole === 'super_admin') {
      fetchAvailableClients();
    }
  }, [router, userRole, id]);

  const fetchManufacturerId = async (user: any) => {
    try {
      const { data, error } = await supabase
        .from('manufacturers')
        .select('id')
        .eq('email', user.email)
        .single();
      
      if (data && !error) {
        setManufacturerId(data.id);
      }
    } catch (err) {
      console.error('Error fetching manufacturer ID:', err);
    }
  };
  
  // NEW: Fetch available clients
  const fetchAvailableClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, email')
        .order('name');
      
      if (data && !error) {
        setAvailableClients(data);
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  };
  
  // NEW: Handle client change
  const handleClientChange = async () => {
    if (!selectedClientId || !order) return;
    
    setSavingClient(true);
    try {
      // Get the new client data
      const newClient = availableClients.find(c => c.id === selectedClientId);
      if (!newClient) throw new Error('Client not found');
      
      // Generate new order number with new client prefix
      const clientPrefix = newClient.name.substring(0, 3).toUpperCase();
      const currentOrderNumber = order.order_number;
      
      // Extract the numeric part from current order number (e.g., "001200" from "BUD-001200")
      const numericPart = currentOrderNumber.includes('-') 
        ? currentOrderNumber.split('-')[1]
        : currentOrderNumber.replace(/[^0-9]/g, '');
      
      const newOrderNumber = `${clientPrefix}-${numericPart}`;
      
      // Update order with new client and order number
      const { error } = await supabase
        .from('orders')
        .update({ 
          client_id: selectedClientId,
          order_number: newOrderNumber
        })
        .eq('id', order.id);

      if (error) throw error;
      
      // Log to audit
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      await supabase
        .from('audit_log')
        .insert({
          user_id: user.id || crypto.randomUUID(),
          user_name: user.name || user.email || 'Admin User',
          action_type: 'client_changed',
          target_type: 'order',
          target_id: order.id,
          old_value: `${order.client?.name} (${currentOrderNumber})`,
          new_value: `${newClient.name} (${newOrderNumber})`,
          timestamp: new Date().toISOString()
        });

      // Close edit mode and refresh
      setIsEditingClient(false);
      await refetch();
    } catch (error) {
      console.error('Error updating client:', error);
      alert('Error updating client. Please try again.');
    } finally {
      setSavingClient(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return;
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', order.id);

      if (error) throw error;
      
      // Log to audit
      await supabase
        .from('audit_log')
        .insert({
          user_id: JSON.parse(localStorage.getItem('user') || '{}').id || crypto.randomUUID(),
          user_name: JSON.parse(localStorage.getItem('user') || '{}').name || 'Admin User',
          action_type: 'order_status_changed',
          target_type: 'order',
          target_id: order.id,
          old_value: order.status,
          new_value: newStatus,
          timestamp: new Date().toISOString()
        });

      refetch();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleTogglePaid = async (isPaid: boolean) => {
    if (!order) return;
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ is_paid: isPaid })
        .eq('id', order.id);

      if (error) throw error;

      await supabase
        .from('audit_log')
        .insert({
          user_id: JSON.parse(localStorage.getItem('user') || '{}').id || crypto.randomUUID(),
          user_name: JSON.parse(localStorage.getItem('user') || '{}').name || 'Admin User',
          action_type: isPaid ? 'order_marked_paid' : 'order_marked_unpaid',
          target_type: 'order',
          target_id: order.id,
          old_value: order.is_paid ? 'paid' : 'unpaid',
          new_value: isPaid ? 'paid' : 'unpaid',
          timestamp: new Date().toISOString()
        });

      refetch();
    } catch (error) {
      console.error('Error updating payment status:', error);
    }
  };

  const handleViewHistory = (productId: string, productName: string) => {
    setHistoryModal({
      isOpen: true,
      productId,
      productName
    });
    
    // Update viewed history count
    const historyCount = getHistoryCount(productId);
    const newViewed = { ...viewedHistory, [productId]: historyCount };
    setViewedHistory(newViewed);
    localStorage.setItem(`viewedHistory_${id}`, JSON.stringify(newViewed));
  };

  const handleRouteProduct = (product: any) => {
    setRouteModal({
      isOpen: true,
      product
    });
  };

  // NEW: Handle Save All & Route
  const handleSaveAllAndRoute = async () => {
    setMasterRouteModal({
      isOpen: true,
      isSaving: false
    });
  };

  // NEW: Handle Master Route (when route is selected in modal)
  const handleMasterRoute = async (selectedRoute: string, notes?: string) => {
    setMasterRouteModal(prev => ({ ...prev, isSaving: true }));
    
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const visibleProducts = getVisibleProducts();
      const isManufacturer = userRole === 'manufacturer';
      
      // Step 1: Save all pending changes in manufacturer cards (if manufacturer)
      if (isManufacturer) {
        console.log('Saving all pending changes...');
        for (const [productId, cardRef] of manufacturerCardRefs.current) {
          if (cardRef && cardRef.saveAll) {
            console.log(`Saving changes for product ${productId}`);
            await cardRef.saveAll();
          }
        }
      }
      // Note: Admin cards don't have pending changes to save
      
      // Step 2: Apply the selected route to ALL visible products
      console.log(`Applying route "${selectedRoute}" to all products...`);
      
      for (const product of visibleProducts) {
        let updates: any = {};
        
        if (isManufacturer) {
          // MANUFACTURER ROUTING
          switch (selectedRoute) {
            case 'send_to_admin':
              updates.product_status = 'pending_admin';
              updates.routed_to = 'admin';
              updates.routed_at = new Date().toISOString();
              updates.routed_by = user.id || null;
              break;
              
            case 'in_production':
              updates.product_status = 'in_production';
              updates.routed_to = 'manufacturer';
              updates.routed_at = new Date().toISOString();
              updates.routed_by = user.id || null;
              updates.is_locked = true;
              break;
              
            case 'shipped':
              updates.product_status = 'shipped';
              updates.routed_to = 'admin';
              updates.routed_at = new Date().toISOString();
              updates.routed_by = user.id || null;
              updates.shipped_date = new Date().toISOString();
              break;
          }
        } else {
          // ADMIN ROUTING
          switch (selectedRoute) {
            case 'approve_for_production':
              updates.product_status = 'approved_for_production';
              updates.routed_to = 'manufacturer';
              updates.routed_at = new Date().toISOString();
              updates.routed_by = user.id || null;
              updates.is_locked = false;
              break;
              
            case 'request_sample':
              updates.sample_required = true;
              updates.product_status = 'sample_requested';
              updates.routed_to = 'manufacturer';
              updates.routed_at = new Date().toISOString();
              updates.routed_by = user.id || null;
              break;
              
            case 'send_for_approval':
              updates.requires_client_approval = true;
              updates.product_status = 'pending_client_approval';
              updates.routed_to = 'admin'; // Stays with admin
              break;
              
            case 'send_back_to_manufacturer':
              updates.product_status = 'revision_requested';
              updates.routed_to = 'manufacturer';
              updates.routed_at = new Date().toISOString();
              updates.routed_by = user.id || null;
              break;
          }
        }
        
        // Add notes if provided
        if (notes) {
          const timestamp = new Date().toLocaleDateString();
          const userIdentifier = isManufacturer ? 'Manufacturer' : 'Admin';
          updates.manufacturer_notes = product.manufacturer_notes 
            ? `${product.manufacturer_notes}\n\n[${timestamp} - ${userIdentifier}] ${notes}`
            : `[${timestamp} - ${userIdentifier}] ${notes}`;
        }
        
        // Update product
        await supabase
          .from('order_products')
          .update(updates)
          .eq('id', product.id);
        
        // Log to audit
        await supabase
          .from('audit_log')
          .insert({
            user_id: user.id || crypto.randomUUID(),
            user_name: user.name || user.email || (isManufacturer ? 'Manufacturer' : 'Admin'),
            action_type: `product_routed_${selectedRoute}`,
            target_type: 'order_product',
            target_id: product.id,
            old_value: `${product.product_status || 'pending'} / routed_to: ${product.routed_to || (isManufacturer ? 'manufacturer' : 'admin')}`,
            new_value: `${updates.product_status} / routed_to: ${updates.routed_to}`,
            timestamp: new Date().toISOString()
          });
      }
      
      // Create notifications
      if (isManufacturer && (selectedRoute === 'send_to_admin' || selectedRoute === 'shipped')) {
        // Manufacturer notifying admin
        const { data: orderData } = await supabase
          .from('orders')
          .select('created_by, order_number')
          .eq('id', order.id)
          .single();
        
        if (orderData?.created_by) {
          let message = '';
          if (selectedRoute === 'send_to_admin') {
            message = `Manufacturer has sent ${visibleProducts.length} products for review - Order ${orderData.order_number}`;
          } else if (selectedRoute === 'shipped') {
            message = `${visibleProducts.length} products have been shipped - Order ${orderData.order_number}`;
          }
          
          await supabase
            .from('notifications')
            .insert({
              user_id: orderData.created_by,
              type: selectedRoute === 'shipped' ? 'products_shipped' : 'manufacturer_update',
              message: message,
              is_read: false,
              created_at: new Date().toISOString()
            });
        }
      } else if (!isManufacturer && (selectedRoute === 'approve_for_production' || selectedRoute === 'request_sample' || selectedRoute === 'send_back_to_manufacturer')) {
        // Admin notifying manufacturer - need to find manufacturer user
        const { data: manufacturerUsers } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'manufacturer');
        
        if (manufacturerUsers && manufacturerUsers.length > 0) {
          let message = '';
          if (selectedRoute === 'approve_for_production') {
            message = `Admin has approved ${visibleProducts.length} products for production - Order ${order.order_number}`;
          } else if (selectedRoute === 'request_sample') {
            message = `Admin has requested samples for ${visibleProducts.length} products - Order ${order.order_number}`;
          } else if (selectedRoute === 'send_back_to_manufacturer') {
            message = `Admin has requested revisions for ${visibleProducts.length} products - Order ${order.order_number}`;
          }
          
          // Notify all manufacturer users
          for (const mfgUser of manufacturerUsers) {
            await supabase
              .from('notifications')
              .insert({
                user_id: mfgUser.id,
                type: 'admin_update',
                message: message,
                is_read: false,
                created_at: new Date().toISOString()
              });
          }
        }
      }
      
      console.log('All products routed successfully');
      
      // Close modal and refresh
      setMasterRouteModal({ isOpen: false, isSaving: false });
      await refetch();
      
    } catch (error) {
      console.error('Error in master route:', error);
      alert('An error occurred. Please try again.');
      setMasterRouteModal(prev => ({ ...prev, isSaving: false }));
    }
  };

  // Helper function to get history count for a product
  const getHistoryCount = (productId: string): number => {
    const product = order?.order_products?.find((p: any) => p.id === productId);
    return product?.audit_log?.length || 0;
  };

  // Helper function to check if product has new history
  const hasNewHistory = (productId: string): boolean => {
    const currentCount = getHistoryCount(productId);
    const viewedCount = viewedHistory[productId] || 0;
    return currentCount > viewedCount;
  };

  // UPDATED: Filter products based on who they're routed to OR show all for super admin
  const getVisibleProducts = () => {
    if (!order?.order_products) return [];
    
    const isManufacturer = userRole === 'manufacturer';
    const isTeamMember = userRole !== null && userRole === 'manufacturer_team_member';
    const isSubManufacturer = userRole !== null && userRole === 'sub_manufacturer';
    const isSuperAdmin = userRole === 'super_admin';
    
    // If super admin and showAllProducts is true, show everything
    if (isSuperAdmin && showAllProducts) {
      return order.order_products;
    }
    
    const filteredProducts = order.order_products.filter((product: any) => {
      // Always show products that are in_production or completed to everyone
      if (product.product_status === 'in_production' || product.product_status === 'completed') {
        return true;
      }
      
      // If routed_to is not set, default to admin
      const routedTo = product.routed_to || 'admin';
      
      // Manufacturer and team members see products routed to manufacturer
      if (isManufacturer || isTeamMember) {
        return routedTo === 'manufacturer';
      }

      // Sub manufacturer sees products if order is assigned to them
      if (isSubManufacturer && order.sub_manufacturer_id === JSON.parse(localStorage.getItem('user') || '{}').id) {
        return true;
      }
      
      // For admin/others, show products routed to admin
      return routedTo === 'admin';
    });
    
    // SORT: Put shipped products at the top for admins
    if (!(isManufacturer || isTeamMember || isSubManufacturer)) {
      return filteredProducts.sort((a: any, b: any) => {
        // Shipped products come first
        if (a.product_status === 'shipped' && b.product_status !== 'shipped') return -1;
        if (a.product_status !== 'shipped' && b.product_status === 'shipped') return 1;
        
        // Then in_transit products
        if (a.product_status === 'in_transit' && b.product_status !== 'in_transit') return -1;
        if (a.product_status !== 'in_transit' && b.product_status === 'in_transit') return 1;
        
        // Then completed products
        if (a.product_status === 'completed' && b.product_status !== 'completed') return -1;
        if (a.product_status !== 'completed' && b.product_status === 'completed') return 1;
        
        // Then everything else in original order
        return 0;
      });
    }
    
    return filteredProducts;
  };

  // Get counts for different product locations
  const getProductCounts = () => {
    if (!order?.order_products) {
      return { total: 0, withAdmin: 0, withManufacturer: 0, inProduction: 0, completed: 0, visible: 0 };
    }
    
    const products = order.order_products;
    const visibleProducts = getVisibleProducts();
    
    return {
      total: products.length,
      withAdmin: products.filter((p: any) => (p.routed_to === 'admin' || !p.routed_to) && p.product_status !== 'completed' && p.product_status !== 'in_production').length,
      withManufacturer: products.filter((p: any) => p.routed_to === 'manufacturer' && p.product_status !== 'in_production' && p.product_status !== 'completed').length,
      inProduction: products.filter((p: any) => p.product_status === 'in_production').length,
      completed: products.filter((p: any) => p.product_status === 'completed').length,
      visible: visibleProducts.length
    };
  };

  // Calculate if all products are paid
  const allProductsPaid = order?.order_products?.length > 0 && 
    order.order_products.every((p: any) => p.payment_status === 'paid');

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error || 'Order not found'}</p>
        </div>
      </div>
    );
  }

  const visibleProducts = getVisibleProducts();
  const productCounts = getProductCounts();
  const isManufacturer = userRole === 'manufacturer';
  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin';

  return (
    <div className="min-h-screen bg-gray-100 overflow-x-hidden">
      {/* Order Header with fixed order number formatting and paid badge */}
      <OrderHeader 
        order={order} 
        totalAmount={totalAmount}
        onEditDraft={() => router.push(`/dashboard/orders/edit/${order.id}`)}
        onStatusChange={handleStatusChange}
        onTogglePaid={handleTogglePaid}
        allProductsPaid={allProductsPaid}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 pb-20">
        {/* Sub Manufacturer Assignment - Only for Manufacturer */}
        {userRole === 'manufacturer' && (
          <div className="mb-6">
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3 mb-2">
                <Building className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Assign Sub Manufacturer</h3>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <select
                  value={selectedSubManufacturer || order.sub_manufacturer_id || ''}
                  onChange={e => setSelectedSubManufacturer(e.target.value)}
                  className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                >
                  <option value="">None</option>
                  {subManufacturers.map((sm: any) => (
                    <option key={sm.id} value={sm.id}>{sm.name} ({sm.email})</option>
                  ))}
                </select>
                <button
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold shadow hover:bg-blue-700 transition-all"
                  onClick={async () => {
                    if (!order.id || !selectedSubManufacturer) return;
                    const { error } = await supabase
                      .from('orders')
                      .update({ sub_manufacturer_id: selectedSubManufacturer })
                      .eq('id', order.id);
                    if (!error) {
                      refetch();
                    }
                  }}
                >Assign</button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Select a sub manufacturer to assign this order. Assigned sub manufacturer will be able to view and process this order.</p>
            </div>
          </div>
        )}
        {/* Client & Manufacturer Info Cards - HIDE FOR MANUFACTURERS */}
        {userRole !== 'manufacturer' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Client Card with Edit Button */}
            <div className="bg-white rounded-lg shadow-lg border border-gray-300 p-4 hover:shadow-xl transition-shadow relative">
              {/* Edit Client Button - For Admin and Super Admin */}
              {(isAdmin || isSuperAdmin) && !isEditingClient && (
                <button
                  onClick={() => {
                    setIsEditingClient(true);
                    setSelectedClientId(order.client?.id || '');
                  }}
                  className="absolute top-4 right-4 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Edit Client"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              
              {isEditingClient ? (
                // Edit Mode
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">Select New Client</p>
                    <button
                      onClick={() => {
                        setIsEditingClient(false);
                        setSelectedClientId(order.client?.id || '');
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                    disabled={savingClient}
                  >
                    <option value="">Select a client...</option>
                    {availableClients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsEditingClient(false);
                        setSelectedClientId(order.client?.id || '');
                      }}
                      disabled={savingClient}
                      className="flex-1 px-3 py-1 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleClientChange}
                      disabled={!selectedClientId || selectedClientId === order.client?.id || savingClient}
                      className="flex-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {savingClient ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Save
                        </>
                      )}
                    </button>
                  </div>
                  {selectedClientId && selectedClientId !== order.client?.id && (
                    <p className="text-xs text-amber-600">
                      Note: Order number will change to use new client's prefix
                    </p>
                  )}
                </div>
              ) : (
                // View Mode
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-500">Client</p>
                      <p className="font-semibold text-gray-900 truncate">{order.client?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{order.client?.email}</span>
                  </div>
                </>
              )}
            </div>

            {/* Manufacturer Card */}
            <div className="bg-white rounded-lg shadow-lg border border-gray-300 p-4 hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building className="w-5 h-5 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-500">Manufacturer</p>
                  <p className="font-semibold text-gray-900 truncate">{order.manufacturer?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{order.manufacturer?.email}</span>
              </div>
            </div>
          </div>
        )}

        {/* Product Location Summary */}
        {productCounts.total > 0 && (
          <div className="mb-4 bg-white rounded-lg shadow-lg border border-gray-300 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Product Distribution</h3>
              <div className="flex items-center gap-3 text-xs">
                {productCounts.withAdmin > 0 && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                    {productCounts.withAdmin} with Admin
                  </span>
                )}
                {productCounts.withManufacturer > 0 && (
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded">
                    {productCounts.withManufacturer} with Manufacturer
                  </span>
                )}
                {productCounts.inProduction > 0 && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    {productCounts.inProduction} in Production
                  </span>
                )}
                {productCounts.completed > 0 && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                    {productCounts.completed} Completed
                  </span>
                )}
              </div>
            </div>
            {visibleProducts.length < productCounts.total && !showAllProducts && (
              <p className="text-xs text-gray-500 mt-2">
                <AlertCircle className="w-3 h-3 inline mr-1" />
                Showing {visibleProducts.length} of {productCounts.total} products 
                {isManufacturer ? ' (products with admin are hidden)' : ' (products with manufacturer are hidden)'}
              </p>
            )}
            {isSuperAdmin && showAllProducts && (
              <p className="text-xs text-blue-600 mt-2">
                <Eye className="w-3 h-3 inline mr-1" />
                Showing all {productCounts.total} products (Super Admin view)
              </p>
            )}
          </div>
        )}

        {/* Products Section */}
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              {isManufacturer ? 'Your Products' : showAllProducts ? 'All Products' : 'Products Requiring Action'}
            </h2>
            
            <div className="flex items-center gap-3">
              {/* Show All Products Toggle - SUPER ADMIN ONLY */}
              {isSuperAdmin && productCounts.withManufacturer > 0 && (
                <button
                  onClick={() => setShowAllProducts(!showAllProducts)}
                  className={`px-4 py-2 rounded-lg shadow-lg transition-all flex items-center gap-2 font-medium ${
                    showAllProducts 
                      ? 'bg-amber-600 text-white hover:bg-amber-700' 
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                  title={showAllProducts ? 'Hide manufacturer products' : 'Show all products including those with manufacturer'}
                >
                  {showAllProducts ? (
                    <>
                      <EyeOff className="w-4 h-4" />
                      <span className="hidden sm:inline">Hide Manufacturer Products</span>
                      <span className="sm:hidden">Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">Show All Products</span>
                      <span className="sm:hidden">Show All</span>
                    </>
                  )}
                </button>
              )}
              
              {/* Save All & Route - MANUFACTURER ONLY */}
              {userRole === 'manufacturer' && visibleProducts.length > 0 && (
                <button
                  onClick={handleSaveAllAndRoute}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-green-700 transition-all flex items-center gap-2 font-medium"
                >
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline">Save All & Route</span>
                  <span className="sm:hidden">Save & Route</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Show message when no products are visible */}
          {visibleProducts.length === 0 ? (
            <div className="bg-white rounded-lg shadow-lg border border-gray-300 p-8 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {isManufacturer 
                  ? 'No products are currently routed to you. Products will appear here when admin sends them to you.'
                  : 'No products currently need your attention. Products will appear here when manufacturer routes them to you.'}
              </p>
              {productCounts.total > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  Total products in order: {productCounts.total}
                </p>
              )}
            </div>
          ) : (
            // Show only visible products based on routing
            visibleProducts.map((product: any) => {
              // Get items and media for this product
              const items = product.order_items || [];
              const media = product.order_media || [];
              const productName = product.description || product.product?.title || 'Product';
              
              // When super admin is viewing all products, show manufacturer cards for products with manufacturer
              const shouldShowManufacturerCard = isManufacturer || 
                (isSuperAdmin && showAllProducts && product.routed_to === 'manufacturer');
              
              // Render different cards based on context
              if (shouldShowManufacturerCard) {
                return (
                  <ManufacturerProductCard
                    key={product.id}
                    ref={(ref: any) => {
                      if (ref) {
                        manufacturerCardRefs.current.set(product.id, ref);
                      }
                    }}
                    product={product}
                    items={items}
                    media={media}
                    orderStatus={order.workflow_status || order.status}
                    onUpdate={refetch}
                    onRoute={handleRouteProduct}
                    onViewHistory={(productId) => handleViewHistory(productId, productName)}
                    hasNewHistory={hasNewHistory(product.id)}
                    manufacturerId={manufacturerId}
                    // Pass super admin flag to allow editing when viewing all
                    isSuperAdminView={isSuperAdmin && showAllProducts}
                  />
                );
              }
              
              // Admin, Super Admin, and others see AdminProductCard
              return (
                <AdminProductCard
                  key={product.id}
                  product={product}
                  items={items}
                  media={media}
                  orderStatus={order.workflow_status || order.status}
                  onUpdate={refetch}
                  onRoute={handleRouteProduct}
                  onViewHistory={(productId) => handleViewHistory(productId, productName)}
                  hasNewHistory={hasNewHistory(product.id)}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Route Modal for individual products - FIXED TypeScript error */}
      <RouteModal
        isOpen={routeModal.isOpen}
        onClose={() => setRouteModal({ isOpen: false, product: null })}
        product={routeModal.product}
        onUpdate={refetch}
        userRole={userRole || undefined}
      />

      {/* NEW: Master Route Modal for Save All & Route */}
      {masterRouteModal.isOpen && (
        <MasterRouteModal
          isOpen={masterRouteModal.isOpen}
          isSaving={masterRouteModal.isSaving}
          onClose={() => setMasterRouteModal({ isOpen: false, isSaving: false })}
          onRoute={handleMasterRoute}
          productCount={visibleProducts.length}
        />
      )}

      {/* History Modal */}
      <HistoryModal
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal({ isOpen: false, productId: '', productName: '' })}
        productId={historyModal.productId}
        productName={historyModal.productName}
      />
    </div>
  );
}

// NEW: Master Route Modal Component
function MasterRouteModal({ 
  isOpen, 
  isSaving,
  onClose, 
  onRoute,
  productCount 
}: { 
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onRoute: (route: string, notes?: string) => void;
  productCount: number;
}) {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const userRole = getUserRole(); // Get user role to show correct options

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!selectedRoute) return;
    onRoute(selectedRoute, notes);
  };

  const isManufacturer = userRole === 'manufacturer';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Save All & Route {productCount} Products
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          This will save all pending changes and route all {productCount} products
        </p>

        {/* Route Options - Different for Manufacturer vs Admin */}
        <div className="space-y-3 mb-6">
          {isManufacturer ? (
            // MANUFACTURER OPTIONS
            <>
              <button
                onClick={() => setSelectedRoute('send_to_admin')}
                disabled={isSaving}
                className={`w-full p-4 border-2 rounded-lg transition-all text-left ${
                  selectedRoute === 'send_to_admin'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Send className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Send to Admin</h3>
                    <p className="text-xs text-gray-500">Send all products to admin for review</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedRoute('in_production')}
                disabled={isSaving}
                className={`w-full p-4 border-2 rounded-lg transition-all text-left ${
                  selectedRoute === 'in_production'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-500 hover:bg-green-50'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Mark In Production</h3>
                    <p className="text-xs text-gray-500">Mark all products as in production</p>
                  </div>
                </div>
              </button>
            </>
          ) : (
            // ADMIN OPTIONS
            <>
              <button
                onClick={() => setSelectedRoute('approve_for_production')}
                disabled={isSaving}
                className={`w-full p-4 border-2 rounded-lg transition-all text-left ${
                  selectedRoute === 'approve_for_production'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-500 hover:bg-green-50'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Approve for Production</h3>
                    <p className="text-xs text-gray-500">Send all to manufacturer for production</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedRoute('request_sample')}
                disabled={isSaving}
                className={`w-full p-4 border-2 rounded-lg transition-all text-left ${
                  selectedRoute === 'request_sample'
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-gray-200 hover:border-yellow-500 hover:bg-yellow-50'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Request Samples</h3>
                    <p className="text-xs text-gray-500">Request samples for all products</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedRoute('send_back_to_manufacturer')}
                disabled={isSaving}
                className={`w-full p-4 border-2 rounded-lg transition-all text-left ${
                  selectedRoute === 'send_back_to_manufacturer'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-orange-500 hover:bg-orange-50'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Send className="w-5 h-5 text-orange-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Back to Manufacturer</h3>
                    <p className="text-xs text-gray-500">Request revisions from manufacturer</p>
                  </div>
                </div>
              </button>
            </>
          )}
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSaving}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            rows={3}
            placeholder={isManufacturer ? "Add any notes for admin..." : "Add routing instructions..."}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedRoute || isSaving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Save All & Route
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}