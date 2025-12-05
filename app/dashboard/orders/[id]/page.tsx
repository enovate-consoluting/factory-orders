/**
 * Order Detail Page - /dashboard/orders/[id]
 * UPDATED: Products now visible to both Admin and Manufacturer regardless of routing
 * UPDATED: Control Panel and Product Distribution moved ABOVE Sample Request
 * UPDATED: Passes sample data to useBulkRouting for save & route
 * UPDATED: Admin redirects to orders list after routing
 * FIXED: Sample section saves and routes with products
 * FIXED: Products no longer disappear when routed - routing is now just a queue indicator
 * Last Modified: December 4, 2025
 */

'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useOrderData } from './hooks/useOrderData';
import { getUserRole, usePermissions } from './hooks/usePermissions';
import { useSampleRouting } from './hooks/useSampleRouting';
import { useBulkRouting } from './hooks/useBulkRouting';

// Translation imports
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDynamicTranslation } from '@/hooks/useDynamicTranslation';
import '../../../i18n';

// Shared Components
import { OrderHeader } from './components/shared/OrderHeader';
import { OrderSampleRequest } from '../shared-components/OrderSampleRequest';
import { ProductDistributionBar } from './components/shared/ProductDistributionBar';

// Product Cards
import { AdminProductCard } from './components/admin/AdminProductCard';
import { ManufacturerProductCard } from './components/manufacturer/ManufacturerProductCard';

// Control Panels
import { AdminControlPanel } from './components/admin/AdminControlPanel';
import { ManufacturerControlPanel } from './components/manufacturer/ManufacturerControlPanel';

// Modals
import { HistoryModal } from './components/modals/HistoryModal';
import { RouteModal } from './components/modals/RouteModal';
import { SaveAllRouteModal } from './components/modals/SaveAllRouteModal';

// Utilities
import { getProductCounts } from '../utils/orderCalculations';
import { printManufacturingSheets } from '../utils/printManufacturingSheet';

import { supabase } from '@/lib/supabase';
import { Building, Mail, Package, Loader2, Edit2, Eye, EyeOff, X, Check, User, Clock, CheckCircle } from 'lucide-react';

// Calculate order total based on user role
const calculateOrderTotal = (order: any, userRole: string): number => {
  if (!order?.order_products) return 0;
  
  let total = 0;
  
  order.order_products.forEach((product: any) => {
    const totalQty = product.order_items?.reduce((sum: number, item: any) => 
      sum + (item.quantity || 0), 0) || 0;
    
    let productPrice = 0;
    let shippingPrice = 0;
    
    if (userRole === 'admin' || userRole === 'super_admin' || userRole === 'client') {
      productPrice = parseFloat(product.client_product_price || 0);
      
      if (product.selected_shipping_method === 'air') {
        shippingPrice = parseFloat(product.client_shipping_air_price || 0);
      } else if (product.selected_shipping_method === 'boat') {
        shippingPrice = parseFloat(product.client_shipping_boat_price || 0);
      }
    } else if (userRole === 'manufacturer') {
      productPrice = parseFloat(product.product_price || 0);
      
      if (product.selected_shipping_method === 'air') {
        shippingPrice = parseFloat(product.shipping_air_price || 0);
      } else if (product.selected_shipping_method === 'boat') {
        shippingPrice = parseFloat(product.shipping_boat_price || 0);
      }
    }
    
    const productTotal = (productPrice * totalQty) + shippingPrice;
    total += productTotal;
  });
  
  return total;
};

// Interface for sample save data (matches OrderSampleRequest)
interface SampleSaveData {
  fee: string;
  eta: string;
  status: string;
  notes: string;
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  // Translation hooks
  const { t, i18n } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { translate, translateBatch } = useDynamicTranslation();

  const { order, loading, error, refetch } = useOrderData(id);
  const permissions = usePermissions();
  const userRole = getUserRole();

  // State for editing client
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [availableClients, setAvailableClients] = useState<any[]>([]);
  const [savingClient, setSavingClient] = useState(false);
  
  // State for showing all products
  const [showAllProducts, setShowAllProducts] = useState(false);
  
  // State for individual product selection
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  
  // Order-level sample state
  const [orderSampleFee, setOrderSampleFee] = useState('');
  const [orderSampleETA, setOrderSampleETA] = useState('');
  const [orderSampleStatus, setOrderSampleStatus] = useState('pending');
  const [orderSampleNotes, setOrderSampleNotes] = useState('');
  const [orderSampleFiles, setOrderSampleFiles] = useState<File[]>([]);
  const [savingOrderSample, setSavingOrderSample] = useState(false);
  
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

  // Route Modal State
  const [routeModal, setRouteModal] = useState<{
    isOpen: boolean;
    product: any;
  }>({
    isOpen: false,
    product: null
  });

  // Save All Route Modal State
  const [saveAllRouteModal, setSaveAllRouteModal] = useState({
    isOpen: false,
    isSaving: false
  });

  // Track manufacturer card refs
  const manufacturerCardRefs = useRef<Map<string, any>>(new Map());
  
  // Track admin card refs
  const adminCardRefs = useRef<Map<string, any>>(new Map());

  // Batch translate all dynamic fields when order changes
  useEffect(() => {
    if (!order || language === 'en') return;

    const textsToTranslate: string[] = [];

    // Order name
    if (order.order_name) textsToTranslate.push(order.order_name);

    // Client and manufacturer names
    if (order.client?.name) textsToTranslate.push(order.client.name);
    if (order.manufacturer?.name) textsToTranslate.push(order.manufacturer.name);

    // Product data
    if (order.order_products && Array.isArray(order.order_products)) {
      order.order_products.forEach((product: any) => {
        if (product.description) textsToTranslate.push(product.description);
        if (product.product?.title) textsToTranslate.push(product.product.title);
        if (product.production_time) textsToTranslate.push(product.production_time);
        if (product.sample_notes) textsToTranslate.push(product.sample_notes);
        if (product.selected_sub_manufacturer?.name) textsToTranslate.push(product.selected_sub_manufacturer.name);

        // Variant combinations from order items
        if (product.order_items && Array.isArray(product.order_items)) {
          product.order_items.forEach((item: any) => {
            if (item.variant_combo) textsToTranslate.push(item.variant_combo);
            if (item.notes) textsToTranslate.push(item.notes);
          });
        }
      });
    }

    // Order sample notes
    if (order.sample_notes) textsToTranslate.push(order.sample_notes);

    if (textsToTranslate.length > 0) {
      translateBatch(textsToTranslate, 'order_detail');
    }
  }, [order, language, translateBatch]);

  // Calculate total based on role
  const totalAmount = calculateOrderTotal(order, userRole || '');

  // Role checks
  const isManufacturer = userRole === 'manufacturer';
  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin';
  const isClient = userRole === 'client';

  // Helper functions
  const getAllProducts = () => {
    if (!order?.order_products) return [];
    return order.order_products;
  };

  /**
   * UPDATED: Products are now visible to both Admin and Manufacturer regardless of routing
   * Routing indicates "who needs to work on this" (appears in their queue/tab)
   * Both parties can still see and edit products at any time
   */
  const getVisibleProducts = () => {
    const allProducts = getAllProducts();
    
    // Client still only sees products routed to them (for approval)
    if (isClient) {
      return allProducts.filter((product: any) => product.routed_to === 'client');
    }
    
    // If a specific product is selected from distribution bar, show only that one
    if (selectedProductId !== 'all') {
      return allProducts.filter((product: any) => product.id === selectedProductId);
    }
    
    // For Admin and Manufacturer - show ALL products
    // Routing now indicates "who needs to work on this" not visibility
    // Products no longer disappear when routed to the other party
    return allProducts;
  };
  
  // Get products with admin (for AdminControlPanel)
  const getAdminProducts = () => {
    const allProducts = getAllProducts();
    return allProducts.filter((product: any) => product.routed_to === 'admin');
  };
  
  // Get products with manufacturer (for ManufacturerControlPanel)
  const getManufacturerProducts = () => {
    const allProducts = getAllProducts();
    return allProducts.filter((product: any) => product.routed_to === 'manufacturer');
  };

  // Sample Routing Hook
  const sampleRouting = useSampleRouting(
    id,
    {
      routed_to: (order?.sample_routed_to as 'admin' | 'manufacturer' | 'client') || 'admin',
      workflow_status: order?.sample_workflow_status || 'pending',
      routed_at: order?.sample_routed_at || null,
      routed_by: order?.sample_routed_by || null
    },
    userRole || 'admin',
    refetch
  );

  // Bulk Routing Hook - UPDATED: Pass sample files, notes, AND adminCardRefs
  const bulkRouting = useBulkRouting({
    orderId: id,
    order,
    products: getVisibleProducts(),
    userRole: userRole || 'admin',
    manufacturerCardRefs: manufacturerCardRefs,
    adminCardRefs: adminCardRefs,
    sampleRouting: {
      routeToAdmin: sampleRouting.routeToAdmin,
      routeToManufacturer: sampleRouting.routeToManufacturer,
      routeToClient: sampleRouting.routeToClient
    },
    orderSampleData: {
      fee: orderSampleFee,
      eta: orderSampleETA,
      status: orderSampleStatus
    },
    pendingSampleFiles: orderSampleFiles,
    sampleNotes: orderSampleNotes,
    onSuccess: refetch,
    onRedirect: () => router.push('/dashboard/orders')
  });

  useEffect(() => {
    const fetchSubManufacturers = async () => {
      const userData = localStorage.getItem('user');
      if (!userData) return;
      const user = JSON.parse(userData);
      if (userRole === 'manufacturer') {
        const manufacturerIdToUse = user.manufacturer_id || user.id;
        const { data, error } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('created_by', manufacturerIdToUse)
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

    if (userRole === 'manufacturer') {
      fetchManufacturerId(JSON.parse(userData));
    }

    const viewed = localStorage.getItem(`viewedHistory_${id}`);
    if (viewed) {
      setViewedHistory(JSON.parse(viewed));
    }

    if (userRole === 'admin' || userRole === 'super_admin') {
      fetchAvailableClients();
    }
  }, [router, userRole, id]);

  // Load order-level sample data for display
  useEffect(() => {
    if (order) {
      setOrderSampleFee(order.sample_fee?.toString() || '');
      setOrderSampleETA(order.sample_eta || '');
      setOrderSampleStatus(order.sample_status || 'pending');
      setOrderSampleNotes('');
    }
  }, [order]);

  // Auto-mark manufacturer notifications as read
  useEffect(() => {
    const markOrderNotificationsAsRead = async () => {
      if (userRole === 'manufacturer' && manufacturerId && id) {
        try {
          await supabase
            .from('manufacturer_notifications')
            .update({ is_read: true })
            .eq('manufacturer_id', manufacturerId)
            .eq('order_id', id)
            .eq('is_read', false);
        } catch (err) {
          console.error('Error in markOrderNotificationsAsRead:', err);
        }
      }
    };

    markOrderNotificationsAsRead();
  }, [userRole, manufacturerId, id]);

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
  
  const handleClientChange = async () => {
    if (!selectedClientId || !order) return;
    
    setSavingClient(true);
    try {
      const newClient = availableClients.find(c => c.id === selectedClientId);
      if (!newClient) throw new Error('Client not found');
      
      const clientPrefix = newClient.name.substring(0, 3).toUpperCase();
      const currentOrderNumber = order.order_number;
      
      const numericPart = currentOrderNumber.includes('-') 
        ? currentOrderNumber.split('-')[1]
        : currentOrderNumber.replace(/[^0-9]/g, '');
      
      const newOrderNumber = `${clientPrefix}-${numericPart}`;
      
      const { error } = await supabase
        .from('orders')
        .update({ 
          client_id: selectedClientId,
          order_number: newOrderNumber
        })
        .eq('id', order.id);

      if (error) throw error;
      
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

      setIsEditingClient(false);
      await refetch();
    } catch (error) {
      console.error('Error updating client:', error);
      alert('Error updating client. Please try again.');
    } finally {
      setSavingClient(false);
    }
  };

  // Handler for order-level sample update
  const handleOrderSampleUpdate = (field: string, value: any) => {
    switch (field) {
      case 'sampleFee':
        setOrderSampleFee(value);
        break;
      case 'sampleETA':
        setOrderSampleETA(value);
        break;
      case 'sampleStatus':
        setOrderSampleStatus(value);
        break;
      case 'sampleWorkflowStatus':
        break;
      case 'sampleNotes':
        setOrderSampleNotes(value);
        break;
    }
  };

  const handleOrderSampleFileUpload = (files: FileList | null) => {
    if (!files) return;
    
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    const newFiles = Array.from(files).filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        alert(`File "${file.name}" is too large. Maximum size is 50MB.`);
        return false;
      }
      return true;
    });
    
    if (newFiles.length > 0) {
      setOrderSampleFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeOrderSampleFile = (index: number) => {
    setOrderSampleFiles(prev => prev.filter((_, i) => i !== index));
  };

  const deleteExistingSampleFile = async (mediaId: string) => {
    try {
      const { data: fileInfo } = await supabase
        .from('order_media')
        .select('original_filename, display_name')
        .eq('id', mediaId)
        .single();
      
      const { error } = await supabase
        .from('order_media')
        .delete()
        .eq('id', mediaId);
      
      if (error) throw error;
      
      if (fileInfo) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        await supabase
          .from('audit_log')
          .insert({
            user_id: user.id || crypto.randomUUID(),
            user_name: user.name || user.email || 'Unknown User',
            action_type: 'order_sample_updated',
            target_type: 'order',
            target_id: order.id,
            new_value: `File removed: ${fileInfo.original_filename || fileInfo.display_name}`,
            timestamp: new Date().toISOString()
          });
      }
      
      await refetch();
    } catch (error) {
      console.error('Error deleting media:', error);
      alert('Error deleting file. Please try again.');
    }
  };
  
  // Save order sample data (for Save Sample Section button)
  const saveOrderSampleData = async (data: SampleSaveData) => {
    if (!order) return;
    
    setSavingOrderSample(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const roleName = userRole === 'super_admin' ? 'Admin' : 
                      userRole === 'manufacturer' ? 'Manufacturer' : 'Admin';
      
      const changes: string[] = [];
      
      const newFee = data.fee ? parseFloat(data.fee) : null;
      const oldFee = order.sample_fee;
      if (newFee !== oldFee) {
        if (oldFee && newFee) {
          changes.push(`Fee: $${oldFee} → $${newFee}`);
        } else if (newFee) {
          changes.push(`Fee set to $${newFee}`);
        } else if (oldFee) {
          changes.push(`Fee removed (was $${oldFee})`);
        }
      }
      
      const oldEta = order.sample_eta || '';
      if (data.eta !== oldEta) {
        if (oldEta && data.eta) {
          changes.push(`ETA: ${oldEta} → ${data.eta}`);
        } else if (data.eta) {
          changes.push(`ETA set to ${data.eta}`);
        } else if (oldEta) {
          changes.push(`ETA removed`);
        }
      }
      
      const oldStatus = order.sample_status || 'pending';
      if (data.status !== oldStatus) {
        changes.push(`Status: ${oldStatus} → ${data.status}`);
      }
      
      if (data.notes && data.notes.trim()) {
        changes.push(`Note from ${roleName}: "${data.notes.trim()}"`);
      }
      
      if (orderSampleFiles.length > 0) {
        changes.push(`${orderSampleFiles.length} file(s) uploaded`);
      }
      
      const updateData: any = {
        sample_required: true,
        sample_fee: newFee,
        sample_eta: data.eta || null,
        sample_status: data.status || 'pending',
        sample_workflow_status: data.status || 'pending'
      };
      
      // SAVE NOTES TO sample_notes column (append to existing)
      if (data.notes && data.notes.trim()) {
        const timestamp = new Date().toLocaleDateString();
        const newNote = `[${timestamp} - ${roleName}] ${data.notes.trim()}`;
        const existingNotes = order.sample_notes || '';
        updateData.sample_notes = existingNotes 
          ? `${existingNotes}\n\n${newNote}`
          : newNote;
      }
      
      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order.id);
      
      if (updateError) throw updateError;
      
      if (orderSampleFiles.length > 0) {
        for (const file of orderSampleFiles) {
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(2, 8);
          const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
          const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file';
          const uniqueFileName = `${fileNameWithoutExt}_sample_${timestamp}_${randomStr}.${fileExt}`;
          const filePath = `${order.id}/${uniqueFileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('order-media')
            .upload(filePath, file);
          
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('order-media')
              .getPublicUrl(filePath);
            
            await supabase
              .from('order_media')
              .insert({
                order_id: order.id,
                order_product_id: null,
                file_url: publicUrl,
                file_type: 'order_sample',
                uploaded_by: user.id || crypto.randomUUID(),
                original_filename: file.name,
                display_name: file.name,
                is_sample: true,
                created_at: new Date().toISOString()
              });
          }
        }
      }
      
      if (changes.length > 0) {
        await supabase.from('audit_log').insert({
          user_id: user.id || crypto.randomUUID(),
          user_name: user.name || user.email || 'Unknown User',
          action_type: 'order_sample_updated',
          target_type: 'order',
          target_id: order.id,
          new_value: changes.join(' | '),
          timestamp: new Date().toISOString()
        });
      }
      
      setOrderSampleFiles([]);
      setOrderSampleNotes('');
      await refetch();
      
    } catch (error) {
      console.error('Error saving order sample data:', error);
      alert('Error saving sample data. Please try again.');
    } finally {
      setSavingOrderSample(false);
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

      await refetch();
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

      await refetch();
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

  const handleSaveAllAndRoute = async () => {
    setSaveAllRouteModal({
      isOpen: true,
      isSaving: false
    });
  };

  // Save All & Route handler
  const handleSaveAllRoute = async (selectedRoute: string, notes?: string) => {
    setSaveAllRouteModal(prev => ({ ...prev, isSaving: true }));
    
    console.log('=== STARTING SAVE ALL & ROUTE ===');
    console.log('Route option:', selectedRoute);
    console.log('Products to process:', getVisibleProducts().length);
    console.log('Sample data:', { fee: orderSampleFee, eta: orderSampleETA, files: orderSampleFiles.length });
    
    const success = await bulkRouting.saveAllAndRoute(selectedRoute, notes);
    
    if (success) {
      // Clear sample files after successful save
      setOrderSampleFiles([]);
      setOrderSampleNotes('');
    } else if (bulkRouting.state.error) {
      alert(`Error: ${bulkRouting.state.error}`);
    }
    
    setSaveAllRouteModal({ isOpen: false, isSaving: false });
  };
  
  // Print handler
  const handlePrintAll = () => {
    const visibleProducts = getVisibleProducts();
    printManufacturingSheets(visibleProducts, order);
  };

  const getHistoryCount = (productId: string): number => {
    if (productId.startsWith('order-sample-')) {
      if (!order?.audit_log) return 0;
      return order.audit_log.filter((log: any) => 
        log.action_type === 'order_sample_updated' && 
        log.target_id === order.id
      ).length || 0;
    }
    
    const product = order?.order_products?.find((p: any) => p.id === productId);
    return product?.audit_log?.length || 0;
  };

  const hasNewHistory = (productId: string): boolean => {
    const currentCount = getHistoryCount(productId);
    const viewedCount = viewedHistory[productId] || 0;
    return currentCount > viewedCount;
  };

  const getOrderSampleHistoryCount = (): number => {
    if (!order?.audit_log) return 0;
    return order.audit_log.filter((log: any) => 
      log.action_type === 'order_sample_updated' && 
      log.target_id === order.id
    ).length || 0;
  };

  const hasNewOrderSampleHistory = (): boolean => {
    const currentCount = getOrderSampleHistoryCount();
    const viewedCount = viewedHistory['order-sample-' + id] || 0;
    return currentCount > viewedCount;
  };

  const getClientProducts = () => {
    const allProducts = getAllProducts();
    return allProducts.filter((product: any) => product.routed_to === 'client');
  };

  const productCounts = getProductCounts(order);

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

  const allProducts = getAllProducts();
  const visibleProducts = getVisibleProducts();
  const clientProducts = getClientProducts();
  const adminProducts = getAdminProducts();
  const manufacturerProducts = getManufacturerProducts();

  // Find sample files
  const existingSampleMedia = (() => {
    const samples: any[] = [];
    
    if (order?.order_media) {
      order.order_media.forEach((m: any) => {
        if (m.is_sample === true || m.file_type === 'order_sample') {
          samples.push(m);
        }
      });
    }
    
    if (order?.order_products) {
      order.order_products.forEach((product: any) => {
        if (product.order_media) {
          product.order_media.forEach((m: any) => {
            if (m.is_sample === true) {
              if (!samples.find((s: any) => s.id === m.id)) {
                samples.push(m);
              }
            }
          });
        }
      });
    }
    
    return samples;
  })();

  // CLIENT VIEW
  if (isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 overflow-x-hidden">
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 break-words">
                      {t('order')} {order.order_number}
                    </h1>
                    {order.order_name && (
                      <p className="text-xs sm:text-sm text-gray-500 truncate">{translate(order.order_name)}</p>
                    )}
                  </div>
                </div>
                
                {/* Language Switcher - Client View Header */}
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'zh')}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer flex-shrink-0"
                >
                  <option value="en">🇺🇸 EN</option>
                  <option value="zh">🇨🇳 中文</option>
                </select>
              </div>
              
              {/* Order Total - Full width on mobile */}
              {totalAmount > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 rounded-lg border border-green-200">
                  <p className="text-xs sm:text-sm text-gray-500">{t('orderTotal')}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-700">
                    ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 pb-20">
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              {t('productsForYourReview')}
            </h2>

            {clientProducts.length === 0 ? (
              <div className="bg-white rounded-lg sm:rounded-xl shadow border border-gray-200 p-6 sm:p-8 text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                  {t('noProductsPendingReview')}
                </h3>
                <p className="text-sm sm:text-base text-gray-500">
                  {t('allProductsReviewedOrProcessing')}
                </p>
              </div>
            ) : (
              clientProducts.map((product: any) => {
                const items = product.order_items || [];
                const media = product.order_media || [];
                
                // Translate product data for client view
                const translatedProduct = {
                  ...product,
                  description: translate(product.description),
                  product: product.product ? {
                    ...product.product,
                    title: translate(product.product.title)
                  } : product.product,
                  production_time: translate(product.production_time),
                  sample_notes: translate(product.sample_notes)
                };
                
                // Translate order items
                const translatedItems = items.map((item: any) => ({
                  ...item,
                  variant_combination: translate(item.variant_combination),
                  notes: translate(item.notes)
                }));
                
                return (
                  <AdminProductCard
                    key={product.id}
                    product={translatedProduct}
                    items={translatedItems}
                    media={media}
                    orderStatus={order.workflow_status || order.status}
                    onUpdate={refetch}
                    autoCollapse={true}
                    translate={translate}
                    t={t}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // ADMIN/MANUFACTURER VIEW
  return (
    <div className="min-h-screen bg-gray-100 overflow-x-hidden">
      <OrderHeader 
        order={order} 
        totalAmount={totalAmount}
        onEditDraft={() => router.push(`/dashboard/orders/edit/${order.id}`)}
        onStatusChange={handleStatusChange}
        onTogglePaid={handleTogglePaid}
        allProductsPaid={allProductsPaid}
        language={language}
        setLanguage={setLanguage}
      />

      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-2 sm:py-3 pb-20">
        {/* Client & Manufacturer Info Cards */}
        {userRole !== 'manufacturer' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 mb-2 sm:mb-3">
            {/* Client Card */}
            <div className="bg-white rounded-lg shadow border border-gray-200 p-2.5 sm:p-4 hover:shadow-md transition-shadow relative">
              {(isAdmin || isSuperAdmin) && !isEditingClient && (
                <button
                  onClick={() => {
                    setIsEditingClient(true);
                    setSelectedClientId(order.client?.id || '');
                  }}
                  className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Edit Client"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              
              {isEditingClient ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs sm:text-sm text-gray-500">{t('selectNewClient')}</p>
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                    disabled={savingClient}
                  >
                    <option value="">{t('selectClient')}</option>
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
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      onClick={handleClientChange}
                      disabled={!selectedClientId || selectedClientId === order.client?.id || savingClient}
                      className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {savingClient ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {t('saving')}
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          {t('save')}
                        </>
                      )}
                    </button>
                  </div>
                  {selectedClientId && selectedClientId !== order.client?.id && (
                    <p className="text-xs text-amber-600">
                      {t('orderNumberWillChange')}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 sm:gap-3 mb-2">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500">{t('client')}</p>
                      <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">{translate(order.client?.name)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                    <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">{order.client?.email}</span>
                  </div>
                </>
              )}
            </div>

            {/* Manufacturer Card */}
            <div className="bg-white rounded-lg shadow border border-gray-200 p-2.5 sm:p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-500">{t('manufacturer')}</p>
                  <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">{translate(order.manufacturer?.name)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="truncate">{order.manufacturer?.email}</span>
              </div>
            </div>
          </div>
        )}

        {/* CONTROL PANEL - Admin (moved ABOVE sample request) */}
        {(isAdmin || isSuperAdmin) && !isManufacturer && adminProducts.length > 0 && (
          <AdminControlPanel
            order={order}
            visibleProducts={adminProducts}
            onSaveAndRoute={handleSaveAllAndRoute}
            onPrintAll={handlePrintAll}
            totalAmount={totalAmount}
          />
        )}

        {/* CONTROL PANEL - Manufacturer (moved ABOVE sample request) */}
        {userRole === 'manufacturer' && manufacturerProducts.length > 0 && (
          <ManufacturerControlPanel
            order={order}
            visibleProducts={manufacturerProducts}
            onSaveAndRoute={handleSaveAllAndRoute}
            onPrintAll={handlePrintAll}
            onUpdate={refetch}
          />
        )}

        {/* PRODUCT DISTRIBUTION BAR (moved ABOVE sample request) */}
        <ProductDistributionBar
          products={allProducts}
          selectedProductId={selectedProductId}
          onProductSelect={setSelectedProductId}
          showAllProducts={showAllProducts}
          onToggleShowAll={isSuperAdmin ? () => setShowAllProducts(!showAllProducts) : undefined}
          isSuperAdmin={isSuperAdmin}
          counts={productCounts}
          translate={translate}
        />

        {/* ORDER-LEVEL SAMPLE REQUEST SECTION (now BELOW control panel and distribution) */}
        {(isAdmin || isSuperAdmin || isManufacturer) && (
          <OrderSampleRequest
            orderId={id}
            sampleFee={orderSampleFee}
            sampleETA={orderSampleETA}
            sampleStatus={orderSampleStatus}
            sampleNotes={orderSampleNotes}
            sampleFiles={orderSampleFiles}
            existingMedia={existingSampleMedia}
            existingSampleNotes={order?.sample_notes || ''}
            onUpdate={handleOrderSampleUpdate}
            onFileUpload={handleOrderSampleFileUpload}
            onFileRemove={removeOrderSampleFile}
            onExistingFileDelete={deleteExistingSampleFile}
            onViewHistory={() => {
              setHistoryModal({
                isOpen: true,
                productId: 'order-sample-' + order.id,
                productName: t('orderSampleRequest')
              });
              
              const historyCount = getOrderSampleHistoryCount();
              const newViewed = { ...viewedHistory, ['order-sample-' + id]: historyCount };
              setViewedHistory(newViewed);
              localStorage.setItem(`viewedHistory_${id}`, JSON.stringify(newViewed));
            }}
            hasNewHistory={hasNewOrderSampleHistory()}
            isManufacturer={isManufacturer}
            isClient={isClient}
            userRole={userRole || 'admin'}
            readOnly={false}
            onSave={saveOrderSampleData}
            saving={savingOrderSample}
            sampleRoutedTo={order?.sample_routed_to || 'admin'}
            sampleWorkflowStatus={order?.sample_workflow_status || 'pending'}
            onRouteToManufacturer={sampleRouting.routeToManufacturer}
            onRouteToAdmin={sampleRouting.routeToAdmin}
            onRouteToClient={sampleRouting.routeToClient}
            canRouteToManufacturer={sampleRouting.canRouteToManufacturer}
            canRouteToAdmin={sampleRouting.canRouteToAdmin}
            canRouteToClient={sampleRouting.canRouteToClient}
            isRouting={sampleRouting.isRouting}
          />
        )}

        {/* Products Section */}
          <div className="space-y-2 sm:space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
            <h2 className="text-sm sm:text-lg font-semibold text-gray-900">
              {selectedProductId !== 'all' ? t('productDetail') : t('orderProducts')}
            </h2>
            <div className="flex items-center gap-2">
              {isSuperAdmin && productCounts.withManufacturer > 0 && (
                <button
                  onClick={() => setShowAllProducts(!showAllProducts)}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow transition-all flex items-center gap-1.5 sm:gap-2 font-medium text-sm ${
                    showAllProducts 
                      ? 'bg-amber-600 text-white hover:bg-amber-700' 
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                  title={showAllProducts ? 'Hide manufacturer products' : 'Show all products including those with manufacturer'}
                >
                  {showAllProducts ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">{t('hideManufacturerProducts')}</span>
                      <span className="sm:hidden">{t('hide')}</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">{t('showAllProducts')}</span>
                      <span className="sm:hidden">{t('showAll')}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {visibleProducts.length === 0 ? (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6 sm:p-8 text-center">
              <Package className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-2 sm:mb-3" />
              <p className="text-sm sm:text-base text-gray-500">
                {selectedProductId !== 'all' 
                  ? t('productNotFound')
                  : t('noProductsInOrder')}
              </p>
              {productCounts.total > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  {t('totalProductsInOrder')}: {productCounts.total}
                </p>
              )}
            </div>
          ) : (
            visibleProducts.map((product: any) => {
              const items = product.order_items || [];
              const media = product.order_media || [];
              const productName = product.description || product.product?.title || 'Product';
              
              // Translate product data for card
              const translatedProduct = {
                ...product,
                description: translate(product.description),
                product: product.product ? {
                  ...product.product,
                  title: translate(product.product.title)
                } : product.product,
                production_time: translate(product.production_time),
                sample_notes: translate(product.sample_notes),
                selected_sub_manufacturer: product.selected_sub_manufacturer ? {
                  ...product.selected_sub_manufacturer,
                  name: translate(product.selected_sub_manufacturer.name)
                } : product.selected_sub_manufacturer
              };
              
              // Translate order items (variant combinations)
              const translatedItems = items.map((item: any) => ({
                ...item,
                variant_combo: translate(item.variant_combo),
                notes: translate(item.notes)
              }));
              
              const shouldAutoCollapse = visibleProducts.length >= 2;
              
              // Determine if this product is "with me" or "with the other party"
              const isWithMe = (isManufacturer && product.routed_to === 'manufacturer') ||
                              (!isManufacturer && product.routed_to === 'admin');
              
              if (isManufacturer) {
                return (
                  <ManufacturerProductCard
                    key={product.id}
                    ref={(ref: any) => {
                      if (ref) {
                        manufacturerCardRefs.current.set(product.id, ref);
                      }
                    }}
                    product={translatedProduct}
                    items={translatedItems}
                    media={media}
                    orderStatus={order.workflow_status || order.status}
                    onUpdate={refetch}
                    onRoute={handleRouteProduct}
                    onViewHistory={(productId) => handleViewHistory(productId, productName)}
                    hasNewHistory={hasNewHistory(product.id)}
                    manufacturerId={manufacturerId}
                    autoCollapse={shouldAutoCollapse}
                    allOrderProducts={allProducts}
                    translate={translate}
                    t={t}
                    />
                );
              }
              
              return (
                <AdminProductCard
                  key={product.id}
                  ref={(ref: any) => {
                    if (ref) {
                      adminCardRefs.current.set(product.id, ref);
                    }
                  }}
                  product={translatedProduct}
                  items={translatedItems}
                  media={media}
                  orderStatus={order.workflow_status || order.status}
                  onUpdate={refetch}
                  onRoute={handleRouteProduct}
                  onViewHistory={(productId) => handleViewHistory(productId, productName)}
                  hasNewHistory={hasNewHistory(product.id)}
                  autoCollapse={shouldAutoCollapse}
                  translate={translate}
                  t={t}
                 />
              );
            })
          )}
        </div>
      </div>
      
      {/* Modals */}
      <RouteModal
        isOpen={routeModal.isOpen}
        onClose={() => setRouteModal({ isOpen: false, product: null })}
        product={routeModal.product}
        onUpdate={refetch}
        userRole={userRole || undefined}
      />

      <SaveAllRouteModal
        isOpen={saveAllRouteModal.isOpen}
        isSaving={saveAllRouteModal.isSaving}
        onClose={() => setSaveAllRouteModal({ isOpen: false, isSaving: false })}
        onRoute={handleSaveAllRoute}
        productCount={visibleProducts.length}
        userRole={userRole || undefined}
        routeOptions={bulkRouting.getRouteOptions()}
        currentStep={bulkRouting.state.currentStep}
        steps={bulkRouting.state.steps}
      />

      <HistoryModal
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal({ isOpen: false, productId: '', productName: '' })}
        productId={historyModal.productId}
        productName={historyModal.productName}
      />
    </div>
  );
}