/**
 * Order Detail Page V2 - /dashboard/orders/[id]/v2
 * REDESIGNED: Clean, consolidated layout
 * 
 * Changes from V1:
 * - OrderHeaderV2: Merged header + client/mfr cards + control panel
 * - CollapsibleSampleSection: Sample request now collapses like products
 * - Cleaner text formatting (no camelCase)
 * 
 * Structure:
 * 1. OrderHeaderV2 - Title, client/mfr, total, actions (all in one)
 * 2. Sample Request - Collapsible with header
 * 3. Order Products - Collapsible cards
 * 
 * Roles: Admin, Super Admin, Manufacturer, Client
 * Last Modified: December 8, 2025
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
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/lib/constants/fileUpload';
import { useDynamicTranslation } from '@/hooks/useDynamicTranslation';
import '../../../i18n';

// NEW Consolidated Components
import { OrderHeaderV2 } from './components/shared/OrderHeader';
import { CollapsibleSampleSection } from './components/shared/CollapsibleSampleSection';

// Existing Components (kept)
import { OrderSampleRequest } from '../shared-components/OrderSampleRequest';
import { AdminProductCardV2 } from './components/admin/AdminProductCard';
// ManufacturerProductCard removed - using V2 version only
import { ManufacturerProductCardV2 } from './components/manufacturer/ManufacturerProductCard';
import { ManufacturerControlPanelV2 } from './components/manufacturer/ManufacturerControlPanel';

// Modals (kept)
import { HistoryModal } from './components/modals/HistoryModal';
import { ProductRouteModal } from './components/modals/ProductRouteModal';
import { SaveAllRouteModal } from './components/modals/SaveAllRouteModal';
import { DeleteProductModal } from './components/modals/DeleteProductModal';
import { useProductDelete } from './hooks/useProductDelete';
import { AccessoriesCard } from './components/shared/AccessoriesCard';
import { DeletedProductsSection } from './components/shared/DeletedProductsSection';

// Utilities
import { getProductCounts } from '../utils/orderCalculations';
import { printManufacturingSheets } from '../utils/printManufacturingSheet';

import { supabase } from '@/lib/supabase';
import { Package, MessageSquare, CheckCircle, Tag } from 'lucide-react';

// Calculate order total based on user role
// Now includes sample fee and accessories
const calculateOrderTotal = (order: any, userRole: string, accessoriesTotal: number = 0): number => {
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
  
  // Add sample fee based on role
  if (userRole === 'admin' || userRole === 'super_admin' || userRole === 'client') {
    total += parseFloat(order.client_sample_fee || order.sample_fee || 0);
  } else if (userRole === 'manufacturer') {
    total += parseFloat(order.sample_fee || 0);
  }
  
  // Add accessories total
  total += accessoriesTotal;
  
  return total;
};

// Interface for sample save data
interface SampleSaveData {
  fee: string;
  eta: string;
  status: string;
  notes: string;
}

export default function OrderDetailPageV2({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  // Translation hooks
  const { t, i18n } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { translate, translateBatch } = useDynamicTranslation();

  const { order, loading, error, refetch } = useOrderData(id);
  const permissions = usePermissions();
  const userRole = getUserRole();

  // State
  const [availableClients, setAvailableClients] = useState<any[]>([]);
  const [availableManufacturers, setAvailableManufacturers] = useState<any[]>([]);
  const [manufacturerId, setManufacturerId] = useState<string | null>(null);
  const [viewedHistory, setViewedHistory] = useState<Record<string, number>>({});

  // Order-level sample state
  const [orderSampleFee, setOrderSampleFee] = useState('');
  const [orderSampleETA, setOrderSampleETA] = useState('');
  const [orderSampleStatus, setOrderSampleStatus] = useState('pending');
  const [orderSampleNotes, setOrderSampleNotes] = useState('');
  const [orderSampleFiles, setOrderSampleFiles] = useState<File[]>([]);
  const [savingOrderSample, setSavingOrderSample] = useState(false);
  const [accessoriesTotal, setAccessoriesTotal] = useState(0);

  // History Modal State
  const [historyModal, setHistoryModal] = useState({
    isOpen: false,
    productId: '',
    productName: ''
  });

  // Route Modal State
  const [productRouteModal, setProductRouteModal] = useState<{ isOpen: boolean; product: any }>({
    isOpen: false,
    product: null
  });

  // Save All Route Modal State
  const [saveAllRouteModal, setSaveAllRouteModal] = useState({
    isOpen: false,
    isSaving: false
  });

  // Delete Product Modal State
  const [deleteProductModal, setDeleteProductModal] = useState<{
    isOpen: boolean;
    product: any;
  }>({
    isOpen: false,
    product: null
  });

  // Delete product hook
  const { deleteProduct, deleting: deletingProduct } = useProductDelete();

  // Track card refs for bulk operations
  const manufacturerCardRefs = useRef<Map<string, any>>(new Map());
  const adminCardRefs = useRef<Map<string, any>>(new Map());

  // Role checks
  const isManufacturer = userRole === 'manufacturer';
  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin';
  const isClient = userRole === 'client';
  const isClientRequest = order?.status === 'client_request';

  // Calculate total based on role (now includes sample + accessories)
  const totalAmount = calculateOrderTotal(order, userRole || '', accessoriesTotal);

  // Helper functions
  const getAllProducts = () => order?.order_products || [];

  const getVisibleProducts = () => {
    const allProducts = getAllProducts();
    if (isClient) {
      return allProducts.filter((product: any) => product.routed_to === 'client');
    }
    return allProducts;
  };

  const getAdminProducts = () => getAllProducts().filter((product: any) => product.routed_to === 'admin');
  const getManufacturerProducts = () => getAllProducts().filter((product: any) => product.routed_to === 'manufacturer');

  // Sample Routing Hook
  const isSampleShipped = !!(order?.sample_shipped_date || order?.sample_status === 'shipped');
  
  const sampleRouting = useSampleRouting(
    id,
    {
      routed_to: (order?.sample_routed_to as 'admin' | 'manufacturer' | 'client') || 'admin',
      workflow_status: order?.sample_workflow_status || 'pending',
      routed_at: order?.sample_routed_at || null,
      routed_by: order?.sample_routed_by || null
    },
    userRole || 'admin',
    refetch,
    isSampleShipped
  );

  // Bulk Routing Hook
  const bulkRouting = useBulkRouting({
    orderId: id,
    order,
    products: getVisibleProducts(),
    userRole: userRole || 'admin',
    manufacturerCardRefs,
    adminCardRefs,
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

  // Initial data fetch
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }

    const user = JSON.parse(userData);

    if (userRole === 'manufacturer') {
      fetchManufacturerId(user);
    }

    if (userRole === 'admin' || userRole === 'super_admin') {
      fetchAvailableClients();
      fetchAvailableManufacturers();
    }

    const viewed = localStorage.getItem(`viewedHistory_${id}`);
    if (viewed) {
      setViewedHistory(JSON.parse(viewed));
    }
  }, [router, userRole, id]);

  // Load order sample data
  useEffect(() => {
    if (order) {
      const displayFee = userRole === 'manufacturer'
        ? order.sample_fee
        : (order.client_sample_fee || order.sample_fee);
      setOrderSampleFee(displayFee?.toString() || '');
      setOrderSampleETA(order.sample_eta || '');
      setOrderSampleStatus(order.sample_status || 'pending');
      setOrderSampleNotes('');
    }
  }, [order, userRole]);

  // Fetch accessories total for this order
  useEffect(() => {
    const fetchAccessoriesTotal = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from('order_accessories')
          .select('total_fee, client_total_fee')
          .eq('order_id', id);
        
        if (!error && data) {
          // Use client fees for admin/client, manufacturer fees for manufacturer
          const total = data.reduce((sum: number, acc: any) => {
            if (userRole === 'manufacturer') {
              return sum + parseFloat(acc.total_fee || 0);
            } else {
              return sum + parseFloat(acc.client_total_fee || acc.total_fee || 0);
            }
          }, 0);
          setAccessoriesTotal(total);
        }
      } catch (err) {
        console.error('Error fetching accessories total:', err);
      }
    };
    fetchAccessoriesTotal();
  }, [id, userRole, order]); // Re-fetch when order changes (after refetch)

  // Batch translate
  useEffect(() => {
    if (!order || language === 'en') return;

    const textsToTranslate: string[] = [];
    if (order.order_name) textsToTranslate.push(order.order_name);
    if (order.client?.name) textsToTranslate.push(order.client.name);
    if (order.manufacturer?.name) textsToTranslate.push(order.manufacturer.name);

    if (order.order_products) {
      order.order_products.forEach((product: any) => {
        if (product.description) textsToTranslate.push(product.description);
        if (product.product?.title) textsToTranslate.push(product.product.title);
      });
    }

    if (textsToTranslate.length > 0) {
      translateBatch(textsToTranslate, 'order_detail');
    }
  }, [order, language, translateBatch]);

  // Auto-mark manufacturer notifications as read
  useEffect(() => {
    const markNotificationsAsRead = async () => {
      if (userRole === 'manufacturer' && manufacturerId && id) {
        try {
          await supabase
            .from('manufacturer_notifications')
            .update({ is_read: true })
            .eq('manufacturer_id', manufacturerId)
            .eq('order_id', id)
            .eq('is_read', false);
        } catch (err) {
          console.error('Error marking notifications as read:', err);
        }
      }
    };
    markNotificationsAsRead();
  }, [userRole, manufacturerId, id]);

  // Fetch functions
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

  const fetchAvailableManufacturers = async () => {
    try {
      const { data, error } = await supabase
        .from('manufacturers')
        .select('id, name, email')
        .order('name');

      if (data && !error) {
        setAvailableManufacturers(data);
      }
    } catch (err) {
      console.error('Error fetching manufacturers:', err);
    }
  };

  // Client change handler
  const handleClientChange = async (clientId: string) => {
    if (!clientId || !order) return;

    const newClient = availableClients.find(c => c.id === clientId);
    if (!newClient) throw new Error('Client not found');

    const clientPrefix = newClient.name.substring(0, 3).toUpperCase();
    const numericPart = order.order_number.includes('-')
      ? order.order_number.split('-')[1]
      : order.order_number.replace(/[^0-9]/g, '');
    const newOrderNumber = `${clientPrefix}-${numericPart}`;

    const { error } = await supabase
      .from('orders')
      .update({ client_id: clientId, order_number: newOrderNumber })
      .eq('id', order.id);

    if (error) throw error;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    await supabase.from('audit_log').insert({
      user_id: user.id || crypto.randomUUID(),
      user_name: user.name || user.email || 'Admin User',
      action_type: 'client_changed',
      target_type: 'order',
      target_id: order.id,
      old_value: `${order.client?.name} (${order.order_number})`,
      new_value: `${newClient.name} (${newOrderNumber})`,
      timestamp: new Date().toISOString()
    });

    await refetch();
  };

  // Manufacturer change handler
  const handleManufacturerChange = async (manufacturerId: string) => {
    if (!manufacturerId || !order) return;

    const selectedMfr = availableManufacturers.find(m => m.id === manufacturerId);
    if (!selectedMfr) throw new Error('Manufacturer not found');

    const updateData: any = { manufacturer_id: manufacturerId };
    if (order.status === 'client_request') {
      updateData.status = 'draft';
      updateData.workflow_status = 'draft';
    }

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', order.id);

    if (error) throw error;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    await supabase.from('audit_log').insert({
      user_id: user.id || crypto.randomUUID(),
      user_name: user.name || user.email || 'Admin User',
      action_type: 'manufacturer_changed',
      target_type: 'order',
      target_id: order.id,
      old_value: order.manufacturer?.name || 'No manufacturer',
      new_value: selectedMfr.name,
      timestamp: new Date().toISOString()
    });

    // Notify new manufacturer
    try {
      await supabase.from('manufacturer_notifications').insert({
        manufacturer_id: manufacturerId,
        order_id: order.id,
        message: `Order ${order.order_number} assigned to you`,
        is_read: false,
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Could not create manufacturer notification:', e);
    }

    await refetch();
  };

  // Toggle paid handler
  const handleTogglePaid = async (isPaid: boolean) => {
    if (!order) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ is_paid: isPaid })
        .eq('id', order.id);

      if (error) throw error;

      await supabase.from('audit_log').insert({
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

  // Sample handlers
  const handleOrderSampleUpdate = (field: string, value: any) => {
    switch (field) {
      case 'sampleFee': setOrderSampleFee(value); break;
      case 'sampleETA': setOrderSampleETA(value); break;
      case 'sampleStatus': setOrderSampleStatus(value); break;
      case 'sampleNotes': setOrderSampleNotes(value); break;
    }
  };

  const handleOrderSampleFileUpload = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter(file => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(`File "${file.name}" is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
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
      const { error } = await supabase
        .from('order_media')
        .delete()
        .eq('id', mediaId);

      if (error) throw error;
      await refetch();
    } catch (error) {
      console.error('Error deleting media:', error);
      alert('Error deleting file. Please try again.');
    }
  };

  // Save order sample
  const saveOrderSampleData = async (data: SampleSaveData) => {
    if (!order) return;

    setSavingOrderSample(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const roleName = userRole === 'super_admin' ? 'Admin' : userRole === 'manufacturer' ? 'Manufacturer' : 'Admin';

      // Fetch sample margin from system config (with client priority)
      let sampleMarginPercent = 80; // default
      
      // First try to get client-specific margin
      if (order.client_id) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('custom_sample_margin_percentage')
          .eq('id', order.client_id)
          .single();
        
        if (clientData?.custom_sample_margin_percentage !== null && clientData?.custom_sample_margin_percentage !== undefined) {
          sampleMarginPercent = parseFloat(clientData.custom_sample_margin_percentage);
        } else {
          // Fall back to system default
          const { data: configData } = await supabase
            .from('system_config')
            .select('config_value')
            .eq('config_key', 'default_sample_margin_percentage')
            .single();
          
          if (configData?.config_value) {
            sampleMarginPercent = parseFloat(configData.config_value);
          }
        }
      }

      // Calculate fees
      const mfgSampleFee = data.fee ? parseFloat(data.fee) : null;
      const clientSampleFee = mfgSampleFee ? Math.round(mfgSampleFee * (1 + sampleMarginPercent / 100) * 100) / 100 : null;

      const updateData: any = {
        sample_required: true,
        sample_fee: mfgSampleFee,
        client_sample_fee: clientSampleFee,
        sample_eta: data.eta || null,
        sample_status: data.status || 'pending',
        sample_workflow_status: data.status || 'pending'
      };

      // Append notes
      if (data.notes && data.notes.trim()) {
        const timestamp = new Date().toLocaleDateString();
        const newNote = `[${timestamp} - ${roleName}] ${data.notes.trim()}`;
        const existingNotes = order.sample_notes || '';
        updateData.sample_notes = existingNotes ? `${existingNotes}\n\n${newNote}` : newNote;
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order.id);

      if (updateError) throw updateError;

      // Upload files
      if (orderSampleFiles.length > 0) {
        for (const file of orderSampleFiles) {
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(2, 8);
          const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file';
          const uniqueFileName = `${file.name.replace(/\.[^/.]+$/, "")}_sample_${timestamp}_${randomStr}.${fileExt}`;
          const filePath = `${order.id}/${uniqueFileName}`;

          const { error: uploadError } = await supabase.storage
            .from('order-media')
            .upload(filePath, file);

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('order-media').getPublicUrl(filePath);

            await supabase.from('order_media').insert({
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

  // View history
  const handleViewHistory = (productId: string, productName: string) => {
    setHistoryModal({ isOpen: true, productId, productName });

    const historyCount = getHistoryCount(productId);
    const newViewed = { ...viewedHistory, [productId]: historyCount };
    setViewedHistory(newViewed);
    localStorage.setItem(`viewedHistory_${id}`, JSON.stringify(newViewed));
  };

  // Route product
  const handleRouteProduct = (product: any) => {
    setProductRouteModal({ isOpen: true, product });
  };

  // Delete product handler - opens modal for reason
  const handleDeleteProduct = (productId: string) => {
    if (!order) return;

    // Find the product to show in modal
    const product = order.order_products?.find((p: any) => p.id === productId);
    if (product) {
      setDeleteProductModal({
        isOpen: true,
        product: {
          id: product.id,
          product_order_number: product.product_order_number,
          description: product.description,
          product_status: product.product_status,
          invoiced: product.invoiced
        }
      });
    }
  };

  // Confirm delete handler - called from modal with reason
  const handleConfirmDeleteProduct = async (productId: string, reason: string) => {
    if (!order) return { success: false, error: 'No order loaded' };

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const result = await deleteProduct(
      productId,
      order.id,
      userRole || 'admin',
      reason,
      user.id,
      user.name || user.email || 'Admin User'
    );

    if (result.success) {
      setDeleteProductModal({ isOpen: false, product: null });
      await refetch();
    }

    return result;
  };

  // Save all and route
  const handleSaveAllAndRoute = () => {
    setSaveAllRouteModal({ isOpen: true, isSaving: false });
  };

  const handleSaveAllRoute = async (selectedRoute: string, notes?: string) => {
    setSaveAllRouteModal(prev => ({ ...prev, isSaving: true }));

    const success = await bulkRouting.saveAllAndRoute(selectedRoute, notes);

    if (success) {
      setOrderSampleFiles([]);
      setOrderSampleNotes('');
    } else if (bulkRouting.state.error) {
      alert(`Error: ${bulkRouting.state.error}`);
    }

    setSaveAllRouteModal({ isOpen: false, isSaving: false });
  };

  // Print all
  const handlePrintAll = () => {
    const visibleProducts = getVisibleProducts();
    printManufacturingSheets(visibleProducts, order);
  };

  // History helpers
  const getHistoryCount = (productId: string): number => {
    if (productId.startsWith('order-sample-')) {
      if (!order?.audit_log) return 0;
      return order.audit_log.filter((log: any) =>
        log.action_type === 'order_sample_updated' && log.target_id === order.id
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
      log.action_type === 'order_sample_updated' && log.target_id === order.id
    ).length || 0;
  };

  const hasNewOrderSampleHistory = (): boolean => {
    const currentCount = getOrderSampleHistoryCount();
    const viewedCount = viewedHistory['order-sample-' + id] || 0;
    return currentCount > viewedCount;
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Error state
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
            if (m.is_sample === true && !samples.find((s: any) => s.id === m.id)) {
              samples.push(m);
            }
          });
        }
      });
    }
    return samples;
  })();

  // CLIENT VIEW (simplified)
  if (isClient) {
    const clientProducts = visibleProducts.filter((p: any) => p.routed_to === 'client');

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  Order {order.order_number}
                </h1>
                {order.order_name && (
                  <p className="text-sm text-gray-500">{translate(order.order_name)}</p>
                )}
              </div>
              {setLanguage && (
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'zh')}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="en">🇺🇸 EN</option>
                  <option value="zh">🇨🇳 中文</option>
                </select>
              )}
            </div>
            {totalAmount > 0 && (
              <div className="mt-3 p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-gray-500">Order Total</p>
                <p className="text-2xl font-bold text-green-700">
                  ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-gray-400" />
            Products for Your Review
          </h2>

          {clientProducts.length === 0 ? (
            <div className="bg-white rounded-xl shadow border p-8 text-center">
              <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Products Pending Review</h3>
              <p className="text-gray-500">All products have been reviewed or are being processed.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {clientProducts.map((product: any) => (
                <AdminProductCardV2
                  key={product.id}
                  product={product}
                  items={product.order_items || []}
                  media={product.order_media || []}
                  orderStatus={order.workflow_status || order.status}
                  onUpdate={refetch}
                  autoCollapse={true}
                  translate={translate}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ADMIN/MANUFACTURER VIEW
  return (
    <div className="min-h-screen bg-gray-100">
      {/* MANUFACTURER CONTROL PANEL - V2 */}
      {isManufacturer && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-4">
          <ManufacturerControlPanelV2
            order={order}
            visibleProducts={visibleProducts}
            onSaveAndRoute={handleSaveAllAndRoute}
            onPrintAll={handlePrintAll}
            onUpdate={refetch}
            manufacturerId={manufacturerId || undefined}
          />
        </div>
      )}

      {/* CONSOLIDATED HEADER - Admin/Super Admin only */}
      {!isManufacturer && (
        <OrderHeaderV2
          order={order}
          totalAmount={totalAmount}
          userRole={userRole}
          visibleProducts={isManufacturer ? manufacturerProducts : adminProducts}
          availableClients={availableClients}
          availableManufacturers={availableManufacturers}
          onEditDraft={() => router.push(`/dashboard/orders/edit/${order.id}`)}
          onTogglePaid={handleTogglePaid}
          onClientChange={handleClientChange}
          onManufacturerChange={handleManufacturerChange}
          onSaveAndRoute={handleSaveAllAndRoute}
          onPrintAll={handlePrintAll}
          onRefetch={refetch}
          sampleNeedsRouting={order?.sample_routed_to === 'admin'}
        />
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 pb-20">
        {/* Client Notes (for client_request orders) */}
        {isClientRequest && order.client_notes && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-teal-900 mb-1 flex items-center gap-2">
                  Client Notes
                  <span className="px-2 py-0.5 bg-teal-200 text-teal-800 text-xs rounded-full">From Request</span>
                </h3>
                <p className="text-sm text-teal-800 whitespace-pre-wrap">{order.client_notes}</p>
              </div>
            </div>
          </div>
        )}

        {/* COLLAPSIBLE SAMPLE REQUEST */}
        {(isAdmin || isSuperAdmin || isManufacturer) && (
          <CollapsibleSampleSection
            orderId={id}
            sampleFee={orderSampleFee}
            sampleETA={orderSampleETA}
            sampleStatus={orderSampleStatus}
            sampleNotes={orderSampleNotes}
            sampleFiles={orderSampleFiles}
            existingMedia={existingSampleMedia}
            existingSampleNotes={order?.sample_notes || ''}
            sampleRoutedTo={order?.sample_routed_to || 'admin'}
            sampleWorkflowStatus={order?.sample_workflow_status || 'pending'}
            isManufacturer={isManufacturer}
            isClient={isClient}
            userRole={userRole || 'admin'}
            hasNewHistory={hasNewOrderSampleHistory()}
            isRouting={sampleRouting.isRouting}
            saving={savingOrderSample}
            isSampleShipped={isSampleShipped}
            existingTrackingNumber={order?.sample_tracking_number}
            existingCarrier={order?.sample_shipping_carrier}
            onUpdate={handleOrderSampleUpdate}
            onFileUpload={handleOrderSampleFileUpload}
            onFileRemove={removeOrderSampleFile}
            onExistingFileDelete={deleteExistingSampleFile}
            onViewHistory={() => {
              setHistoryModal({
                isOpen: true,
                productId: 'order-sample-' + order.id,
                productName: 'Sample Request'
              });
              const historyCount = getOrderSampleHistoryCount();
              const newViewed = { ...viewedHistory, ['order-sample-' + id]: historyCount };
              setViewedHistory(newViewed);
              localStorage.setItem(`viewedHistory_${id}`, JSON.stringify(newViewed));
            }}
            onSave={saveOrderSampleData}
            onRouteToManufacturer={sampleRouting.routeToManufacturer}
            onRouteToAdmin={sampleRouting.routeToAdmin}
            onRouteToClient={sampleRouting.routeToClient}
            onShipSample={sampleRouting.shipSample}
            canRouteToManufacturer={sampleRouting.canRouteToManufacturer}
            canRouteToAdmin={sampleRouting.canRouteToAdmin}
            canRouteToClient={sampleRouting.canRouteToClient}
            canShipSample={sampleRouting.canShipSample}
            t={t}
          >
            {/* The actual OrderSampleRequest form inside the collapsible */}
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
              onViewHistory={() => {}}
              hasNewHistory={false}
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
              onShipSample={sampleRouting.shipSample}
              canRouteToManufacturer={sampleRouting.canRouteToManufacturer}
              canRouteToAdmin={sampleRouting.canRouteToAdmin}
              canRouteToClient={sampleRouting.canRouteToClient}
              canShipSample={sampleRouting.canShipSample}
              isRouting={sampleRouting.isRouting}
              isSampleShipped={isSampleShipped}
              existingTrackingNumber={order?.sample_tracking_number}
              existingCarrier={order?.sample_shipping_carrier}
              hideHeader={true}
            />
          </CollapsibleSampleSection>
        )}

        {/* ACCESSORIES SECTION - Header included in card, only renders when accessories exist */}
        {(isAdmin || isSuperAdmin || isManufacturer) && (
          <div className="mb-4">
            <AccessoriesCard
              orderId={id}
              userRole={userRole || 'admin'}
              onUpdate={refetch}
            />
          </div>
        )}

        {/* DELETED PRODUCTS SECTION - Super Admin only */}
        <DeletedProductsSection
          orderId={id}
          userRole={userRole || 'admin'}
          onRestore={refetch}
        />

        {/* ORDER PRODUCTS */}
        <div className="space-y-3">
          <h2 className="text-sm sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            Order Products ({visibleProducts.length})
          </h2>

          {visibleProducts.length === 0 ? (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No products in this order</p>
            </div>
          ) : (
            visibleProducts.map((product: any) => {
              const items = product.order_items || [];
              const media = product.order_media || [];
              const productName = product.description || product.product?.title || 'Product';
              const shouldAutoCollapse = visibleProducts.length >= 2;

              // Translate product data
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

              const translatedItems = items.map((item: any) => ({
                ...item,
                variant_combo: translate(item.variant_combo),
                notes: translate(item.notes)
              }));

              if (isManufacturer) {
                return (
                  <ManufacturerProductCardV2
                    key={product.id}
                    ref={(ref: any) => {
                      if (ref) manufacturerCardRefs.current.set(product.id, ref);
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
                    allOrderProducts={getAllProducts()}
                    translate={translate}
                    t={t}
                  />
                );
              }

              return (
                <AdminProductCardV2
                  key={product.id}
                  ref={(ref: any) => {
                    if (ref) adminCardRefs.current.set(product.id, ref);
                  }}
                  product={translatedProduct}
                  items={translatedItems}
                  media={media}
                  orderStatus={order.workflow_status || order.status}
                  onUpdate={refetch}
                  onRoute={handleRouteProduct}
                  onViewHistory={(productId) => handleViewHistory(productId, productName)}
                  onDelete={handleDeleteProduct}
                  hasNewHistory={hasNewHistory(product.id)}
                  autoCollapse={isClientRequest ? false : shouldAutoCollapse}
                  translate={translate}
                  t={t}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Modals */}
      <ProductRouteModal
        isOpen={productRouteModal.isOpen}
        onClose={() => setProductRouteModal({ isOpen: false, product: null })}
        product={productRouteModal.product}
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

      <DeleteProductModal
        isOpen={deleteProductModal.isOpen}
        onClose={() => setDeleteProductModal({ isOpen: false, product: null })}
        product={deleteProductModal.product}
        onConfirmDelete={handleConfirmDeleteProduct}
        userRole={userRole || 'admin'}
      />
    </div>
  );
}