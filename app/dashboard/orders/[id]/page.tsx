/**
 * Order Detail Page - /dashboard/orders/[id]
 * FIXED: Admins now ALWAYS see AdminProductCard with CLIENT prices
 * Previously admins saw ManufacturerProductCard (with cost prices) when products were routed to manufacturer
 * UPDATED: Added independent sample routing (Nov 2025)
 * Last Modified: Nov 2025
 */

'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useOrderData } from './hooks/useOrderData';
import { getUserRole, usePermissions } from './hooks/usePermissions';
import { useSampleRouting } from './hooks/useSampleRouting'; // NEW: Sample routing hook

// Shared Components
import { OrderHeader } from './components/shared/OrderHeader';
import { OrderSampleRequest } from '../shared-components/OrderSampleRequest';
import { ProductDistributionBar } from './components/shared/ProductDistributionBar';

// Product Cards
import { AdminProductCard } from './components/admin/AdminProductCard';
import { ManufacturerProductCard } from './components/manufacturer/ManufacturerProductCard';
// Note: ClientProductCard doesn't exist - using AdminProductCard for client view (shows client prices)
import { ManufacturerControlPanel } from './components/manufacturer/ManufacturerControlPanel';

// Modals
import { HistoryModal } from './components/modals/HistoryModal';
import { RouteModal } from './components/modals/RouteModal';
import { SaveAllRouteModal } from './components/modals/SaveAllRouteModal';

// Utilities
import { getProductCounts } from '../utils/orderCalculations';

import { supabase } from '@/lib/supabase';
import { Building, Mail, Package, Loader2, Edit2, Eye, EyeOff, X, Check, Printer, User, Clock, CheckCircle } from 'lucide-react';

// Calculate order total based on user role
const calculateOrderTotal = (order: any, userRole: string): number => {
  if (!order?.order_products) return 0;
  
  let total = 0;
  
  order.order_products.forEach((product: any) => {
    // Get quantities
    const totalQty = product.order_items?.reduce((sum: number, item: any) => 
      sum + (item.quantity || 0), 0) || 0;
    
    let productPrice = 0;
    let shippingPrice = 0;
    
    // Admin, Super Admin, and Client ALWAYS see CLIENT prices
    if (userRole === 'admin' || userRole === 'super_admin' || userRole === 'client') {
      // Use CLIENT prices - these already have margins built in
      productPrice = parseFloat(product.client_product_price || 0);
      
      if (product.selected_shipping_method === 'air') {
        shippingPrice = parseFloat(product.client_shipping_air_price || 0);
      } else if (product.selected_shipping_method === 'boat') {
        shippingPrice = parseFloat(product.client_shipping_boat_price || 0);
      }
    } else if (userRole === 'manufacturer') {
      // Manufacturer sees their cost prices only
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

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

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

  // Calculate total based on role
  const totalAmount = calculateOrderTotal(order, userRole || '');

  // Role checks
  const isManufacturer = userRole === 'manufacturer';
  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin';
  const isClient = userRole === 'client';

  // ========================================
  // NEW: SAMPLE ROUTING HOOK
  // Independent routing for sample requests
  // ========================================
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

  // Load order-level sample data
  useEffect(() => {
    if (order) {
      setOrderSampleFee(order.sample_fee?.toString() || '');
      setOrderSampleETA(order.sample_eta || '');
      setOrderSampleStatus(order.sample_status || 'pending');
      setOrderSampleNotes(order.sample_notes || '');
    }
  }, [order]);

  // Auto-mark manufacturer notifications as read
  useEffect(() => {
    const markOrderNotificationsAsRead = async () => {
      if (userRole === 'manufacturer' && manufacturerId && id) {
        try {
          const { data, error } = await supabase
            .from('manufacturer_notifications')
            .update({ is_read: true })
            .eq('manufacturer_id', manufacturerId)
            .eq('order_id', id)
            .eq('is_read', false)
            .select();

          if (error) {
            console.error('Error marking notifications as read:', error);
          }
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
  
  // Save order sample data
  const saveOrderSampleData = async () => {
    if (!order) return;
    
    setSavingOrderSample(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Build update data
      const updateData: any = {
        sample_required: true,
        sample_fee: orderSampleFee ? parseFloat(orderSampleFee) : null,
        sample_eta: orderSampleETA || null,
        sample_status: orderSampleStatus || 'pending',
        sample_notes: orderSampleNotes || null
      };
      
      console.log('Saving order sample data:', updateData);
      
      // Update the order with sample data
      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order.id);
      
      if (updateError) {
        console.error('Error updating order sample:', updateError);
        throw updateError;
      }
      
      // Upload sample files if any
      if (orderSampleFiles.length > 0) {
        for (let i = 0; i < orderSampleFiles.length; i++) {
          const file = orderSampleFiles[i];
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
      
      setOrderSampleFiles([]);
      await refetch();
      setSavingOrderSample(false);
      
    } catch (error) {
      console.error('Error saving order sample data:', error);
      alert('Error saving sample data. Please try again.');
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

  // SAVE ALL & ROUTE handler
  const handleSaveAllRoute = async (selectedRoute: string, notes?: string) => {
    setSaveAllRouteModal(prev => ({ ...prev, isSaving: true }));
    
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const visibleProducts = getVisibleProducts();
      
      console.log('=== STARTING SAVE ALL & ROUTE ===');
      console.log(`Processing ${visibleProducts.length} products`);
      
      // STEP 1: Save order-level sample data
      if (isManufacturer && (orderSampleFee || orderSampleETA || orderSampleNotes)) {
        console.log('Step 1: Saving order-level sample data...');
        const updateData: any = {
          sample_required: true,
          sample_fee: orderSampleFee ? parseFloat(orderSampleFee) : null,
          sample_eta: orderSampleETA || null,
          sample_status: orderSampleStatus || 'pending',
          sample_notes: orderSampleNotes || null
        };
        
        await supabase
          .from('orders')
          .update(updateData)
          .eq('id', order.id);
        
        console.log('Order sample saved');
      }
      
      // STEP 2: Process all products
      if (isManufacturer) {
        for (let i = 0; i < visibleProducts.length; i++) {
          const product = visibleProducts[i];
          console.log(`\nStep 2.${i + 1}: Processing product ${product.product_order_number}`);
          
          // Get the card ref
          const cardRef = manufacturerCardRefs.current.get(product.id);
          
          if (cardRef && typeof cardRef.saveAll === 'function') {
            // Call the saveAll function which handles client price calculations
            console.log('Calling saveAll on manufacturer card...');
            const success = await cardRef.saveAll();
            if (!success) {
              console.error('Failed to save product data');
            }
          }
          
          // Apply routing after save
          let productUpdate: any = {};
          
          switch (selectedRoute) {
            case 'send_to_admin':
              productUpdate.product_status = 'pending_admin';
              productUpdate.routed_to = 'admin';
              productUpdate.routed_at = new Date().toISOString();
              productUpdate.routed_by = user.id || null;
              break;
            case 'in_production':
              productUpdate.product_status = 'in_production';
              productUpdate.routed_to = 'manufacturer';
              productUpdate.routed_at = new Date().toISOString();
              productUpdate.routed_by = user.id || null;
              productUpdate.is_locked = true;
              break;
            case 'shipped':
              productUpdate.product_status = 'shipped';
              productUpdate.routed_to = 'admin';
              productUpdate.routed_at = new Date().toISOString();
              productUpdate.routed_by = user.id || null;
              productUpdate.shipped_date = new Date().toISOString();
              break;
          }
          
          if (notes) {
            const timestamp = new Date().toLocaleDateString();
            const existing = product.manufacturer_notes || '';
            productUpdate.manufacturer_notes = existing 
              ? `${existing}\n\n[${timestamp} - Manufacturer] ${notes}`
              : `[${timestamp} - Manufacturer] ${notes}`;
          }
          
          if (Object.keys(productUpdate).length > 0) {
            await supabase
              .from('order_products')
              .update(productUpdate)
              .eq('id', product.id);
          }
        }
      } else {
        // Admin routing
        for (const product of visibleProducts) {
          let productUpdate: any = {};
          
          switch (selectedRoute) {
            case 'approve_for_production':
              productUpdate.product_status = 'approved_for_production';
              productUpdate.routed_to = 'manufacturer';
              productUpdate.routed_at = new Date().toISOString();
              productUpdate.routed_by = user.id || null;
              productUpdate.is_locked = false;
              break;
            case 'request_sample':
              productUpdate.sample_required = true;
              productUpdate.product_status = 'sample_requested';
              productUpdate.routed_to = 'manufacturer';
              productUpdate.routed_at = new Date().toISOString();
              productUpdate.routed_by = user.id || null;
              break;
            case 'send_for_approval':
              productUpdate.requires_client_approval = true;
              productUpdate.product_status = 'pending_client_approval';
              productUpdate.routed_to = 'client';
              productUpdate.routed_at = new Date().toISOString();
              productUpdate.routed_by = user.id || null;
              break;
          }
          
          if (notes) {
            const timestamp = new Date().toLocaleDateString();
            const existing = product.manufacturer_notes || '';
            productUpdate.manufacturer_notes = existing 
              ? `${existing}\n\n[${timestamp} - Admin] ${notes}`
              : `[${timestamp} - Admin] ${notes}`;
          }
          
          await supabase
            .from('order_products')
            .update(productUpdate)
            .eq('id', product.id);
        }
      }
      
      console.log('=== SAVE ALL & ROUTE COMPLETED ===');
      setSaveAllRouteModal({ isOpen: false, isSaving: false });
      
      // Redirect manufacturers
      if (isManufacturer && (selectedRoute === 'send_to_admin' || selectedRoute === 'shipped')) {
        setTimeout(() => {
          router.push('/dashboard/orders');
        }, 500);
      } else {
        await refetch();
      }
      
    } catch (error) {
      console.error('ERROR IN SAVE ALL & ROUTE:', error);
      alert('Error occurred while saving. Please try again.');
      setSaveAllRouteModal(prev => ({ ...prev, isSaving: false }));
    }
  };
  
  const handlePrintAll = () => {
    const visibleProducts = getVisibleProducts();
    
    const printHTML = visibleProducts.map((product: any, index: number) => {
      const items = product.order_items || [];
      const totalQty = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
      
      const variantsRows = items.length > 0 
        ? items.map((item: any) => 
            `<tr>
              <td style="width: 30%;">${item.variant_combo || 'N/A'}</td>
              <td style="width: 15%; text-align: center;">${item.quantity || 0}</td>
              <td style="width: 55%;">${item.notes || ''}</td>
            </tr>`
          ).join('')
        : `<tr>
            <td colspan="3" style="text-align: center; color: #999;">
              No variants configured
            </td>
          </tr>`;

      return `
        <div class="product-sheet ${index < visibleProducts.length - 1 ? 'page-break' : ''}">
          <div class="header">
            <div class="header-title">MANUFACTURING SHEET</div>
            <div class="product-name">${product.description || product.product?.title || 'Product'}</div>
            <div class="header-details">
              <span>Order: <strong>${order.order_number}</strong></span>
              <span>Product: <strong>${product.product_order_number}</strong></span>
              <span>Client: <strong>${order.client?.name || 'N/A'}</strong></span>
            </div>
          </div>
          
          <div class="section" style="margin-top: 40px;">
            <div class="section-header">SAMPLE INFORMATION</div>
            <div class="sample-row" style="margin-top: 30px; margin-bottom: 25px;">
              <div class="field-group">
                <label>Sample Fee: $</label>
                <input type="text" class="field-line" />
              </div>
              <div class="field-group">
                <label>Sample ETA:</label>
                <input type="text" class="field-line" />
              </div>
              <div class="field-group">
                <label>Status:</label>
                <input type="text" class="field-line" />
              </div>
            </div>
          </div>
          
          <div class="section" style="margin-top: 45px;">
            <div class="section-header">PRICING & PRODUCTION</div>
            <div class="pricing-row" style="margin-top: 30px;">
              <div class="field-group">
                <label>Unit Price: $</label>
                <input type="text" class="field-line" />
              </div>
              <div class="field-group">
                <label>Total Quantity:</label>
                <span class="filled-value">${totalQty} units</span>
              </div>
              <div class="field-group">
                <label>Prod. Time:</label>
                <input type="text" class="field-line" />
              </div>
            </div>
            <div class="pricing-row" style="margin-top: 25px; margin-bottom: 25px;">
              <div class="field-group">
                <label>Shipping Air: $</label>
                <input type="text" class="field-line" />
              </div>
              <div class="field-group">
                <label>Shipping Boat: $</label>
                <input type="text" class="field-line" />
              </div>
              <div class="field-group">
                <label>Total Cost: $</label>
                <input type="text" class="field-line" />
              </div>
            </div>
          </div>
          
          <div class="section" style="margin-top: 45px;">
            <h2>VARIANTS & QUANTITIES</h2>
            <table style="margin-top: 15px;">
              <thead>
                <tr>
                  <th style="width: 30%;">Variant/Size</th>
                  <th style="width: 15%;">Qty</th>
                  <th style="width: 55%;">Notes</th>
                </tr>
              </thead>
              <tbody>
                ${variantsRows}
                <tr class="total-row">
                  <td><strong>TOTAL</strong></td>
                  <td style="text-align: center;"><strong>${totalQty}</strong></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="section" style="margin-top: 45px;">
            <h2>PRODUCTION NOTES</h2>
            <div class="notes-box"></div>
          </div>
        </div>
      `;
    }).join('');

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Order ${order.order_number} - Manufacturing Sheets</title>
        <style>
          @page { 
            size: letter portrait; 
            margin: 0.75in;
          }
          
          @media print { 
            .page-break { 
              page-break-after: always;
            }
          }
          
          body { 
            font-family: Arial, sans-serif;
            color: #000;
            margin: 0;
            padding: 0;
            font-size: 12pt;
            background: white;
          }
          
          .product-sheet { 
            padding: 0;
            max-width: 100%;
            min-height: 100%;
          }
          
          .header { 
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #000;
          }
          
          .header-title {
            font-size: 13pt;
            letter-spacing: 2px;
            color: #333;
            margin-bottom: 12px;
            font-weight: 600;
          }
          
          .product-name { 
            font-size: 20pt;
            font-weight: bold;
            margin: 15px 0;
            color: #000;
          }
          
          .header-details {
            display: flex;
            justify-content: center;
            gap: 35px;
            font-size: 11pt;
            color: #333;
            margin-top: 12px;
          }
          
          .section {
            margin-bottom: 30px;
          }
          
          .section-header {
            background: #e8f4f8;
            padding: 10px;
            text-align: center;
            font-size: 13pt;
            font-weight: bold;
            letter-spacing: 0.5px;
            color: #2c5282;
            border-radius: 4px;
          }
          
          h2 {
            font-size: 12pt;
            margin: 0 0 8px 0;
            padding-bottom: 5px;
            border-bottom: 1px solid #333;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: bold;
          }
          
          .sample-row, .pricing-row {
            display: flex;
            gap: 35px;
            margin: 20px 0;
            padding: 0 10px;
          }
          
          .field-group {
            flex: 1;
            display: flex;
            align-items: baseline;
            gap: 5px;
          }
          
          .field-group label {
            font-size: 12pt;
            font-weight: 600;
            white-space: nowrap;
          }
          
          .field-line {
            border: none;
            border-bottom: 1px solid #333;
            outline: none;
            flex: 1;
            min-width: 60px;
            font-size: 11pt;
            background: transparent;
            padding-bottom: 3px;
          }
          
          .filled-value {
            font-weight: bold;
            padding-left: 5px;
            font-size: 12pt;
          }
          
          table { 
            width: 100%; 
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 11pt;
          }
          
          th { 
            background: #f5f5f5;
            border: 1px solid #333;
            padding: 12px 8px;
            text-align: left;
            font-weight: bold;
          }
          
          td { 
            border: 1px solid #333;
            padding: 12px 8px;
          }
          
          .total-row {
            background: #f5f5f5;
            font-weight: bold;
          }
          
          .notes-box { 
            border: 1px solid #333;
            min-height: 280px;
            padding: 15px;
            background: white;
            margin-top: 12px;
          }
        </style>
      </head>
      <body>
        ${printHTML}
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 250);
      };
    }
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

  const getAllProducts = () => {
    if (!order?.order_products) return [];
    return order.order_products;
  };

  const getVisibleProducts = () => {
    const allProducts = getAllProducts();
    
    // CLIENT: Only see products routed to 'client'
    if (isClient) {
      return allProducts.filter((product: any) => product.routed_to === 'client');
    }
    
    if (selectedProductId !== 'all') {
      return allProducts.filter((product: any) => product.id === selectedProductId);
    }
    
    return allProducts;
  };

  // Get products routed to client (for client count display)
  const getClientProducts = () => {
    const allProducts = getAllProducts();
    return allProducts.filter((product: any) => product.routed_to === 'client');
  };

  // Use the extracted utility function
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

  // FIXED: Look for sample files in BOTH places:
  // 1. Direct order.order_media (for files with order_product_id = null)
  // 2. Inside order_products.order_media (for files attached to first product with is_sample = true)
  const existingSampleMedia = (() => {
    const samples: any[] = [];
    
    // Check direct order_media (if any)
    if (order?.order_media) {
      order.order_media.forEach((m: any) => {
        if (m.is_sample === true || m.file_type === 'order_sample') {
          samples.push(m);
        }
      });
    }
    
    // Check inside each product's order_media for files marked as samples
    if (order?.order_products) {
      order.order_products.forEach((product: any) => {
        if (product.order_media) {
          product.order_media.forEach((m: any) => {
            if (m.is_sample === true) {
              // Avoid duplicates (in case same file appears in both places)
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

  // ========================================
  // CLIENT VIEW - Simplified, read-only
  // ========================================
  if (isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 overflow-x-hidden">
        {/* Client Header - Mobile Responsive */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg sm:text-2xl font-bold text-gray-900 break-words">
                    Order {order.order_number}
                  </h1>
                  {order.order_name && (
                    <p className="text-sm sm:text-base text-gray-500 break-words">{order.order_name}</p>
                  )}
                </div>
              </div>

              {/* Order Total - Full width on mobile */}
              {totalAmount > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 sm:px-6 py-3 rounded-xl border border-green-200">
                  <p className="text-xs sm:text-sm text-gray-500 text-center sm:text-left">Order Total</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-700 text-center sm:text-left">
                    ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20">
          {/* Products Section */}
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              Products for Your Review
            </h2>

            {clientProducts.length === 0 ? (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 sm:p-8 text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                  No Products Pending Review
                </h3>
                <p className="text-sm sm:text-base text-gray-500">
                  All products have been reviewed or are still being processed.
                </p>
              </div>
            ) : (
              clientProducts.map((product: any) => {
                const items = product.order_items || [];
                const media = product.order_media || [];

                return (
                  <AdminProductCard
                    key={product.id}
                    product={product}
                    items={items}
                    media={media}
                    orderStatus={order.workflow_status || order.status}
                    onUpdate={refetch}
                    autoCollapse={true}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // ========================================
  // ADMIN/MANUFACTURER VIEW - Full functionality
  // ========================================
  return (
    <div className="min-h-screen bg-gray-100 overflow-x-hidden">
      {/* Order Header - Shows CLIENT total for admins */}
      <OrderHeader 
        order={order} 
        totalAmount={totalAmount}
        onEditDraft={() => router.push(`/dashboard/orders/edit/${order.id}`)}
        onStatusChange={handleStatusChange}
        onTogglePaid={handleTogglePaid}
        allProductsPaid={allProductsPaid}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-3 pb-20">
        {/* Client & Manufacturer Info Cards - HIDE FOR MANUFACTURERS */}
        {userRole !== 'manufacturer' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
            {/* Client Card with Edit Button */}
            <div className="bg-white rounded-lg shadow-lg border border-gray-300 p-3 sm:p-4 hover:shadow-xl transition-shadow relative">
              {(isAdmin || isSuperAdmin) && !isEditingClient && (
                <button
                  onClick={() => {
                    setIsEditingClient(true);
                    setSelectedClientId(order.client?.id || '');
                  }}
                  className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Edit Client"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              
              {isEditingClient ? (
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs sm:text-sm text-gray-500">Select New Client</p>
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
                    className="w-full px-2 sm:px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
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
                      className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleClientChange}
                      disabled={!selectedClientId || selectedClientId === order.client?.id || savingClient}
                      className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1 sm:gap-2"
                    >
                      {savingClient ? (
                        <>
                          <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                          <span className="hidden sm:inline">Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3 h-3 sm:w-4 sm:h-4" />
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
                <>
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500">Client</p>
                      <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">{order.client?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                    <Mail className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">{order.client?.email}</span>
                  </div>
                </>
              )}
            </div>

            {/* Manufacturer Card */}
            <div className="bg-white rounded-lg shadow-lg border border-gray-300 p-3 sm:p-4 hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-500">Manufacturer</p>
                  <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">{order.manufacturer?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                <Mail className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="truncate">{order.manufacturer?.email}</span>
              </div>
            </div>
          </div>
        )}

        {/* ORDER-LEVEL SAMPLE REQUEST SECTION - UPDATED WITH ROUTING */}
        {(isAdmin || isSuperAdmin || isManufacturer) && (
          <OrderSampleRequest
            orderId={id}
            sampleFee={orderSampleFee}
            sampleETA={orderSampleETA}
            sampleStatus={orderSampleStatus}
            sampleNotes={orderSampleNotes}
            sampleFiles={orderSampleFiles}
            existingMedia={existingSampleMedia}
            onUpdate={handleOrderSampleUpdate}
            onFileUpload={handleOrderSampleFileUpload}
            onFileRemove={removeOrderSampleFile}
            onExistingFileDelete={deleteExistingSampleFile}
            onViewHistory={() => {
              setHistoryModal({
                isOpen: true,
                productId: 'order-sample-' + order.id,
                productName: 'Order Sample Request'
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
            // NEW: Sample routing props
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

        {/* Manufacturer Control Panel */}
        {userRole === 'manufacturer' && visibleProducts.length > 0 && (
          <ManufacturerControlPanel
            order={order}
            visibleProducts={visibleProducts}
            onSaveAndRoute={handleSaveAllAndRoute}
            onPrintAll={handlePrintAll}
          />
        )}

        {/* Product Distribution Bar */}
        <ProductDistributionBar
          products={allProducts}
          selectedProductId={selectedProductId}
          onProductSelect={setSelectedProductId}
          showAllProducts={showAllProducts}
          onToggleShowAll={isSuperAdmin ? () => setShowAllProducts(!showAllProducts) : undefined}
          isSuperAdmin={isSuperAdmin}
          counts={productCounts}
        />

        {/* Products Section */}
        <div className="space-y-3 sm:space-y-4 md:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
            <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">
              {selectedProductId !== 'all' ? 'Product Detail' : 'Order Products'}
            </h2>

            <div className="flex items-center gap-2 sm:gap-3">
              {isSuperAdmin && productCounts.withManufacturer > 0 && (
                <button
                  onClick={() => setShowAllProducts(!showAllProducts)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg shadow-lg transition-all flex items-center gap-1.5 sm:gap-2 font-medium ${
                    showAllProducts
                      ? 'bg-amber-600 text-white hover:bg-amber-700'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                  title={showAllProducts ? 'Hide manufacturer products' : 'Show all products including those with manufacturer'}
                >
                  {showAllProducts ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden md:inline">Hide Manufacturer Products</span>
                      <span className="md:hidden">Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden md:inline">Show All Products</span>
                      <span className="md:hidden">Show All</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {visibleProducts.length === 0 ? (
            <div className="bg-white rounded-lg shadow-lg border border-gray-300 p-6 sm:p-8 text-center">
              <Package className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-2 sm:mb-3" />
              <p className="text-sm sm:text-base text-gray-500">
                {selectedProductId !== 'all'
                  ? `Product not found.`
                  : `No products found in this order.`}
              </p>
              {productCounts.total > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  Total products in order: {productCounts.total}
                </p>
              )}
            </div>
          ) : (
            visibleProducts.map((product: any) => {
              const items = product.order_items || [];
              const media = product.order_media || [];
              const productName = product.description || product.product?.title || 'Product';
              
              const shouldAutoCollapse = visibleProducts.length >= 2;
              
              // FIXED: Only ACTUAL manufacturers see ManufacturerProductCard
              // Admins ALWAYS see AdminProductCard with CLIENT prices
              if (isManufacturer) {
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
                    autoCollapse={shouldAutoCollapse}
                    allOrderProducts={allProducts}
                  />
                );
              }
              
              // Admin/Super Admin ALWAYS sees AdminProductCard which shows CLIENT prices
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
                  autoCollapse={shouldAutoCollapse}
                />
              );
            })
          )}
        </div>
      </div>
      
      {/* Route Modal for individual products */}
      <RouteModal
        isOpen={routeModal.isOpen}
        onClose={() => setRouteModal({ isOpen: false, product: null })}
        product={routeModal.product}
        onUpdate={refetch}
        userRole={userRole || undefined}
      />

      {/* Save All Route Modal */}
      <SaveAllRouteModal
        isOpen={saveAllRouteModal.isOpen}
        isSaving={saveAllRouteModal.isSaving}
        onClose={() => setSaveAllRouteModal({ isOpen: false, isSaving: false })}
        onRoute={handleSaveAllRoute}
        productCount={visibleProducts.length}
        userRole={userRole || undefined}
      />

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