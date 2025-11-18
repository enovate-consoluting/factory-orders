/**
 * Order Detail Page - /dashboard/orders/[id]
 * COMPLETE FIX: Admin shipping selection + Manufacturer sample save + Redirect
 * Roles: Admin, Super Admin, Manufacturer, Client
 * Last Modified: November 2025
 */

'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useOrderData } from './hooks/useOrderData';
import { getUserRole, usePermissions } from './hooks/usePermissions';
import { OrderHeader } from './components/shared/OrderHeader';
import { StatusBadge } from '../shared-components/StatusBadge';
import { OrderSampleRequest } from '../shared-components/OrderSampleRequest';
import { AdminProductCard } from './components/admin/AdminProductCard';
import { ManufacturerProductCard } from './components/manufacturer/ManufacturerProductCard';
import { ManufacturerControlPanel } from './components/manufacturer/ManufacturerControlPanel';
import { HistoryModal } from './components/modals/HistoryModal';
import { RouteModal } from './components/modals/RouteModal';
import { supabase } from '@/lib/supabase';
import { Building, Mail, Package, AlertCircle, Send, Loader2, Edit2, Eye, EyeOff, X, Check } from 'lucide-react';

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const { order, loading, error, refetch } = useOrderData(id);
  const permissions = usePermissions();
  const userRole = getUserRole();
  
  // State for finance margins
  const [productMargin, setProductMargin] = useState(80);
  const [shippingMargin, setShippingMargin] = useState(5);
  const [marginsLoaded, setMarginsLoaded] = useState(false);
  
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
  
  // Calculate total amount with CLIENT prices
  const calculateOrderTotal = () => {
    if (!order?.order_products) return 0;
    
    let total = 0;
    const isManufacturer = userRole === 'manufacturer';
    
    order.order_products.forEach((product: any) => {
      const totalQty = product.order_items?.reduce((sum: number, item: any) => 
        sum + (item.quantity || 0), 0) || 0;
      
      let productPrice = 0;
      let sampleFee = 0;
      let shippingPrice = 0;
      
      if (isManufacturer) {
        productPrice = parseFloat(product.product_price || 0);
        sampleFee = parseFloat(product.sample_fee || 0);
        
        if (product.selected_shipping_method === 'air') {
          shippingPrice = parseFloat(product.shipping_air_price || 0);
        } else if (product.selected_shipping_method === 'boat') {
          shippingPrice = parseFloat(product.shipping_boat_price || 0);
        }
      } else {
        const mfgProductPrice = parseFloat(product.product_price || 0);
        const mfgSampleFee = parseFloat(product.sample_fee || 0);
        
        productPrice = mfgProductPrice * (1 + productMargin / 100);
        sampleFee = mfgSampleFee * (1 + productMargin / 100);
        
        if (product.selected_shipping_method === 'air') {
          const mfgShipping = parseFloat(product.shipping_air_price || 0);
          shippingPrice = mfgShipping * (1 + shippingMargin / 100);
        } else if (product.selected_shipping_method === 'boat') {
          const mfgShipping = parseFloat(product.shipping_boat_price || 0);
          shippingPrice = mfgShipping * (1 + shippingMargin / 100);
        }
      }
      
      total += productPrice * totalQty;
      total += sampleFee;
      total += shippingPrice;
    });
    
    // Add order-level sample fee
    if (order.sample_fee) {
      const orderSampleAmount = parseFloat(order.sample_fee);
      if (isManufacturer) {
        total += orderSampleAmount;
      } else {
        total += orderSampleAmount * (1 + productMargin / 100);
      }
    }
    
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

  // Route Modal State
  const [routeModal, setRouteModal] = useState<{
    isOpen: boolean;
    product: any;
  }>({
    isOpen: false,
    product: null
  });

  // Master Route Modal State
  const [masterRouteModal, setMasterRouteModal] = useState({
    isOpen: false,
    isSaving: false
  });

  // Track dirty state for manufacturer cards
  const manufacturerCardRefs = useRef<Map<string, any>>(new Map());

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

  // Load finance margins
  useEffect(() => {
    const loadMargins = async () => {
      try {
        const { data } = await supabase
          .from('system_config')
          .select('config_key, config_value')
          .in('config_key', ['default_margin_percentage', 'default_shipping_margin_percentage']);
        
        if (data) {
          data.forEach(config => {
            if (config.config_key === 'default_margin_percentage') {
              setProductMargin(parseFloat(config.config_value) || 80);
            } else if (config.config_key === 'default_shipping_margin_percentage') {
              setShippingMargin(parseFloat(config.config_value) || 0);
            }
          });
        }
        setMarginsLoaded(true);
      } catch (error) {
        console.error('Error loading margins:', error);
        setMarginsLoaded(true);
      }
    };
    loadMargins();
  }, []);

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
  
  // FIX: Save order sample data - now properly saves for manufacturers
  const saveOrderSampleData = async () => {
    if (!order) return;
    
    setSavingOrderSample(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      // FIXED: Use correct field names for the update
      const updateData: any = {};
      
      // Only update fields that have values
      if (orderSampleFee !== '') {
        updateData.sample_fee = parseFloat(orderSampleFee) || null;
      }
      if (orderSampleETA !== '') {
        updateData.sample_eta = orderSampleETA || null;
      }
      if (orderSampleStatus && orderSampleStatus !== '') {
        updateData.sample_status = orderSampleStatus;
      }
      if (orderSampleNotes !== '') {
        updateData.sample_notes = orderSampleNotes || null;
      }
      
      // Set sample_required if any sample data exists
      updateData.sample_required = !!(orderSampleNotes || orderSampleFee || orderSampleFiles.length > 0 || order.sample_required);
      
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
      
      console.log('Order sample data saved successfully');
      
      // Upload sample files if any
      if (orderSampleFiles.length > 0) {
        console.log('Uploading', orderSampleFiles.length, 'sample files...');
        
        for (let i = 0; i < orderSampleFiles.length; i++) {
          const file = orderSampleFiles[i];
          const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file';
          const timestamp = Date.now();
          const fileName = `order-sample-${timestamp}-${i}.${fileExt}`;
          const filePath = `${order.id}/${fileName}`;
          
          console.log(`Uploading file ${i + 1}:`, fileName);
          
          // Upload to storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('order-media')
            .upload(filePath, file, {
              upsert: true
            });
          
          if (uploadError) {
            console.error('Storage upload error:', uploadError);
            continue;
          }
          
          console.log('Upload successful:', uploadData);
          
          // Get the public URL
          const { data: { publicUrl } } = supabase.storage
            .from('order-media')
            .getPublicUrl(filePath);
          
          console.log('Public URL:', publicUrl);
          
          // Save to database
          const { error: dbError } = await supabase
            .from('order_media')
            .insert({
              order_id: order.id,
              order_product_id: null, // NULL for order-level files
              file_url: publicUrl,
              file_type: 'order_sample', // Clear type for order samples
              uploaded_by: user.id || crypto.randomUUID(),
              original_filename: file.name,
              display_name: fileName,
              is_sample: true,
              created_at: new Date().toISOString()
            });
          
          if (dbError) {
            console.error('Database insert error:', dbError);
          } else {
            console.log('File saved to database');
          }
        }
      }
      
      // Log audit
      const changes = [];
      
      const previousFee = order.sample_fee?.toString() || '';
      const previousStatus = order.sample_status || 'pending';
      const previousETA = order.sample_eta || '';
      const previousNotes = order.sample_notes || '';
      
      if (orderSampleFee !== previousFee) {
        changes.push(`Fee: $${previousFee || '0'} → $${orderSampleFee || '0'}`);
      }
      if (orderSampleStatus !== previousStatus) {
        changes.push(`Status: ${previousStatus} → ${orderSampleStatus}`);
      }
      if (orderSampleETA !== previousETA) {
        changes.push(`ETA: ${previousETA || 'not set'} → ${orderSampleETA || 'not set'}`);
      }
      if (orderSampleNotes !== previousNotes) {
        changes.push(`Notes updated`);
      }
      if (orderSampleFiles.length > 0) {
        changes.push(`${orderSampleFiles.length} file(s) uploaded`);
      }
      
      if (changes.length > 0) {
        await supabase
          .from('audit_log')
          .insert({
            user_id: user.id || crypto.randomUUID(),
            user_name: user.name || user.email || 'Unknown User',
            action_type: 'order_sample_updated',
            target_type: 'order',
            target_id: order.id,
            new_value: changes.join(' | '),
            timestamp: new Date().toISOString()
          });
        
        console.log('Audit log created');
      }
      
      // Clear temp files
      setOrderSampleFiles([]);
      
      // Refresh to show new data
      await refetch();
      
      alert('Sample request saved successfully!');
      
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
    setMasterRouteModal({
      isOpen: true,
      isSaving: false
    });
  };

  // FIX: Add redirect for manufacturers after routing
  const handleMasterRoute = async (selectedRoute: string, notes?: string) => {
    setMasterRouteModal(prev => ({ ...prev, isSaving: true }));
    
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const visibleProducts = getVisibleProducts();
      const isManufacturer = userRole === 'manufacturer';
      
      // Save all pending changes in manufacturer cards (if manufacturer)
      if (isManufacturer) {
        for (const [productId, cardRef] of manufacturerCardRefs.current) {
          if (cardRef && cardRef.saveAll) {
            await cardRef.saveAll();
          }
        }
      }
      
      // Apply the selected route to ALL visible products
      for (const product of visibleProducts) {
        let updates: any = {};
        
        if (isManufacturer) {
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
              updates.routed_to = 'admin';
              break;
            case 'send_back_to_manufacturer':
              updates.product_status = 'revision_requested';
              updates.routed_to = 'manufacturer';
              updates.routed_at = new Date().toISOString();
              updates.routed_by = user.id || null;
              break;
          }
        }
        
        if (notes) {
          const timestamp = new Date().toLocaleDateString();
          const userIdentifier = isManufacturer ? 'Manufacturer' : 'Admin';
          updates.manufacturer_notes = product.manufacturer_notes 
            ? `${product.manufacturer_notes}\n\n[${timestamp} - ${userIdentifier}] ${notes}`
            : `[${timestamp} - ${userIdentifier}] ${notes}`;
        }
        
        await supabase
          .from('order_products')
          .update(updates)
          .eq('id', product.id);
        
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
      
      setMasterRouteModal({ isOpen: false, isSaving: false });
      
      // FIX: Redirect manufacturers to listing page after routing back to admin
      if (isManufacturer && (selectedRoute === 'send_to_admin' || selectedRoute === 'shipped')) {
        // Small delay to ensure modal closes smoothly
        setTimeout(() => {
          router.push('/dashboard/orders');
        }, 300);
      } else {
        // For other cases, just refresh the current page
        await refetch();
      }
      
    } catch (error) {
      console.error('Error in master route:', error);
      alert('An error occurred. Please try again.');
      setMasterRouteModal(prev => ({ ...prev, isSaving: false }));
    }
  };

  const handlePrintAll = () => {
    const visibleProducts = getVisibleProducts();
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Order ${order.order_number} - Product Sheets</title>
        <style>
          @page { size: portrait; margin: 0.5in; }
          @media print { 
            .page-break { page-break-after: always; }
          }
          body { font-family: Arial, sans-serif; }
          .product-sheet { padding: 20px; margin-bottom: 30px; }
          .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
          h1 { font-size: 24px; margin: 0 0 10px 0; }
          h2 { font-size: 18px; margin: 20px 0 10px 0; color: #333; }
          .info-row { display: flex; margin-bottom: 8px; }
          .label { font-weight: bold; width: 150px; }
          .value { flex: 1; border-bottom: 1px dotted #999; min-height: 20px; }
          .notes-box { border: 1px solid #999; min-height: 100px; margin-top: 10px; padding: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #999; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0; }
        </style>
      </head>
      <body>
        ${visibleProducts.map((product: any, index: number) => {
          const items = product.order_items || [];
          const totalQty = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);

          return `
            <div class="product-sheet ${index < visibleProducts.length - 1 ? 'page-break' : ''}">
              <div class="header">
                <h1>Order: ${order.order_number}</h1>
                <div>Client: ${order.client?.name || 'N/A'}</div>
                <div>Date: ${new Date().toLocaleDateString()}</div>
              </div>
              
              <h2>Product: ${product.product_order_number}</h2>
              <div class="info-row">
                <div class="label">Description:</div>
                <div class="value">${product.description || ''}</div>
              </div>
              <div class="info-row">
                <div class="label">Total Quantity:</div>
                <div class="value">${totalQty}</div>
              </div>
              <div class="info-row">
                <div class="label">Product Price:</div>
                <div class="value">$${product.product_price || '________'}</div>
              </div>
              <div class="info-row">
                <div class="label">Production Time:</div>
                <div class="value">${product.production_time || '________'}</div>
              </div>
              
              <h2>Variants</h2>
              <table>
                <thead>
                  <tr><th>Variant</th><th>Quantity</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  ${items.map((item: any) => `
                    <tr>
                      <td>${item.variant_combo || ''}</td>
                      <td>${item.quantity || 0}</td>
                      <td>${item.notes || ''}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              
              <h2>Production Notes</h2>
              <div class="notes-box">${product.manufacturer_notes || ''}</div>
              
              <h2>Additional Notes (Write Here)</h2>
              <div class="notes-box"></div>
            </div>
          `;
        }).join('')}
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
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
    
    if (selectedProductId !== 'all') {
      return allProducts.filter((product: any) => product.id === selectedProductId);
    }
    
    return allProducts;
  };

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
  const productCounts = getProductCounts();
  const isManufacturer = userRole === 'manufacturer';
  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin';

  const existingSampleMedia = order?.order_media?.filter((m: any) => 
    m.file_type === 'order_sample' && 
    m.order_product_id === null
  ) || [];

  return (
    <div className="min-h-screen bg-gray-100 overflow-x-hidden">
      {/* Order Header */}
      <OrderHeader 
        order={order} 
        totalAmount={totalAmount}
        onEditDraft={() => router.push(`/dashboard/orders/edit/${order.id}`)}
        onStatusChange={handleStatusChange}
        onTogglePaid={handleTogglePaid}
        allProductsPaid={allProductsPaid}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 pb-20">
        {/* Client & Manufacturer Info Cards - HIDE FOR MANUFACTURERS */}
        {userRole !== 'manufacturer' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Client Card with Edit Button */}
            <div className="bg-white rounded-lg shadow-lg border border-gray-300 p-4 hover:shadow-xl transition-shadow relative">
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

        {/* ORDER-LEVEL SAMPLE REQUEST SECTION */}
        {(isAdmin || isSuperAdmin || isManufacturer) && (
          <OrderSampleRequest
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
            readOnly={false}
            onSave={saveOrderSampleData}
            saving={savingOrderSample}
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

        {/* Product Location Summary */}
        {productCounts.total > 0 && (
          <div className="mb-4 bg-white rounded-lg shadow-lg border border-gray-300 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Product Distribution</h3>
              
              <div className="flex items-center gap-3">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="px-3 py-1 text-xs border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Show All Products ({allProducts.length})</option>
                  {allProducts.map((product: any) => (
                    <option key={product.id} value={product.id}>
                      {product.product_order_number || 'PRD-0000'} - {product.description || product.product?.title || 'Unnamed Product'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 mt-2">
              {productCounts.withAdmin > 0 && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                  {productCounts.withAdmin} with Admin
                </span>
              )}
              {productCounts.withManufacturer > 0 && (
                <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
                  {productCounts.withManufacturer} with Manufacturer
                </span>
              )}
              {productCounts.inProduction > 0 && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                  {productCounts.inProduction} in Production
                </span>
              )}
              {productCounts.completed > 0 && (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                  {productCounts.completed} Completed
                </span>
              )}
            </div>
            
            {selectedProductId !== 'all' && (
              <p className="text-xs text-blue-600 mt-2">
                <Eye className="w-3 h-3 inline mr-1" />
                Viewing single product
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
              {selectedProductId !== 'all' ? 'Product Detail' : 'Order Products'}
            </h2>
            
            <div className="flex items-center gap-3">
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
            </div>
          </div>

          {visibleProducts.length === 0 ? (
            <div className="bg-white rounded-lg shadow-lg border border-gray-300 p-8 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
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
              
              const isRoutedToManufacturer = product.routed_to === 'manufacturer';
              
              if (isManufacturer || isRoutedToManufacturer) {
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
                  />
                );
              }
              
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

      {/* Master Route Modal for Save All & Route */}
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

// Master Route Modal Component
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
  const userRole = getUserRole();

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

        <div className="space-y-3 mb-6">
          {isManufacturer ? (
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