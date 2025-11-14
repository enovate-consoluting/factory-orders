// app/dashboard/orders/[id]/components/admin/AdminProductCard.tsx
// FIXED VERSION - Green total restored, proper margin calculations

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { 
  Package, Calendar, Clock, Lock, Unlock, Send, CheckCircle, 
  XCircle, Loader2, MessageSquare, Save, History, AlertCircle,
  DollarSign, CreditCard, Plane, Ship, Upload, X, Play, File,
  RotateCcw, FileText, Image, Paperclip, ChevronDown, ChevronRight, Truck
} from 'lucide-react';
import { OrderProduct, OrderItem } from '../../types/order.types';
import { ProductStatusBadge } from '../shared/StatusBadge';
import { usePermissions } from '../../hooks/usePermissions';
import { supabase } from '@/lib/supabase';

interface AdminProductCardProps {
  product: OrderProduct;
  items: OrderItem[];
  media: any[];
  orderStatus: string;
  onUpdate: () => void;
  onRoute?: (product: OrderProduct) => void;
  onViewHistory?: (productId: string) => void;
  hasNewHistory?: boolean;
  autoCollapse?: boolean;  // ADD THIS
}

export const AdminProductCard = forwardRef<any, AdminProductCardProps>(
  function AdminProductCard({ 
    product, 
    items = [],
    media = [],
    orderStatus,
    onUpdate,
    onRoute,
    onViewHistory,
    hasNewHistory = false,
    autoCollapse = false  // ADD THIS DEFAULT
  }, ref) {
    const permissions = usePermissions() as any;
    const userRole = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).role : null;
    const canLockProducts = permissions?.canLockProducts || userRole === 'super_admin' || userRole === 'admin';
    
    // State for finance margins
    const [productMargin, setProductMargin] = useState(80); // Default 80%
    const [shippingMargin, setShippingMargin] = useState(0); // Default 0%
    const [marginsLoaded, setMarginsLoaded] = useState(false);
    
    // COLLAPSIBLE STATE - Updated to use autoCollapse prop
    const [isCollapsed, setIsCollapsed] = useState(() => {
      // Auto-collapse takes priority when there are multiple products
      if (autoCollapse) return true;
  
    // For single products, check status
    const productStatus = (product as any)?.product_status;
  
    // Only auto-collapse for these specific statuses when NOT using autoCollapse
    return (productStatus === 'shipped' || productStatus === 'in_transit');
  });
    
 // Load finance margins from database
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
          setMarginsLoaded(true); // Use defaults
        }
      };
      loadMargins();
    }, []);
    
    // Auto-collapse when status changes
    useEffect(() => {
      // Don't override autoCollapse behavior
      if (autoCollapse) return;
      
      const productStatus = (product as any)?.product_status;
      
      if (productStatus === 'shipped' || productStatus === 'in_transit') {
        setIsCollapsed(true);
      }
    }, [(product as any)?.product_status, autoCollapse]);
    
    // Auto-collapse when status changes
    useEffect(() => {
      if ((product as any).product_status === 'shipped' || (product as any).product_status === 'in_transit') {
        setIsCollapsed(true);
      }
    }, [(product as any).product_status]);
    
    // All the state management remains the same...
    const [tempNotes, setTempNotes] = useState('');
    const [tempSampleNotes, setTempSampleNotes] = useState('');
    const [tempBulkNotes, setTempBulkNotes] = useState('');
    const [notesSectionDirty, setNotesSectionDirty] = useState(false);
    const [sampleSectionDirty, setSampleSectionDirty] = useState(false);
    const [bulkSectionDirty, setBulkSectionDirty] = useState(false);
    const [processingProduct, setProcessingProduct] = useState(false);
    const bulkFileInputRef = useRef<HTMLInputElement>(null);
    const sampleFileInputRef = useRef<HTMLInputElement>(null);
    const [showNewHistoryDot, setShowNewHistoryDot] = useState(hasNewHistory);
    const [variantNotes, setVariantNotes] = useState<{[key: string]: string}>({});
    const [editingVariants, setEditingVariants] = useState(false);
    const [pendingSampleFiles, setPendingSampleFiles] = useState<File[]>([]);
    const [pendingBulkFiles, setPendingBulkFiles] = useState<File[]>([]);
    const [originalValues, setOriginalValues] = useState({
      internalNotes: (product as any).internal_notes || '',
      sampleNotes: (product as any).sample_notes || '',
      bulkNotes: (product as any).client_notes || ''
    });
    
    // Initialize variant notes
    useEffect(() => {
      const initialNotes: {[key: string]: string} = {};
      items.forEach(item => {
        initialNotes[item.id] = item.notes || '';
      });
      setVariantNotes(initialNotes);
    }, [items]);
    
    // Update original values when product changes
    useEffect(() => {
      setOriginalValues({
        internalNotes: (product as any).internal_notes || '',
        sampleNotes: (product as any).sample_notes || '',
        bulkNotes: (product as any).client_notes || ''
      });
      setPendingSampleFiles([]);
      setPendingBulkFiles([]);
    }, [product]);
    
    // EXPOSE SAVE FUNCTIONS TO PARENT VIA REF
    useImperativeHandle(ref, () => ({
      saveAll: async () => {
        console.log('SaveAll called for admin product:', (product as any).id);
        let changesMade = false;
        
        if (notesSectionDirty || tempNotes) {
          await handleSaveNotesSection();
          changesMade = true;
        }
        
        if (sampleSectionDirty || tempSampleNotes || pendingSampleFiles.length > 0) {
          await handleSaveSampleSection();
          changesMade = true;
        }
        
        if (bulkSectionDirty || tempBulkNotes || pendingBulkFiles.length > 0) {
          await handleSaveBulkSection();
          changesMade = true;
        }
        
        if (editingVariants) {
          await handleSaveVariantNotes();
          changesMade = true;
        }
        
        return changesMade;
      }
    }), [
      notesSectionDirty,
      sampleSectionDirty,
      bulkSectionDirty,
      editingVariants,
      tempNotes,
      tempSampleNotes,
      tempBulkNotes,
      pendingSampleFiles,
      pendingBulkFiles,
      (product as any).id
    ]);
    
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    
    // FIXED: Calculate with DYNAMIC margins for admins
    const calculateClientPrice = (manufacturerPrice: number, isShipping: boolean = false) => {
      if (!manufacturerPrice || manufacturerPrice === 0) return 0;
      const margin = isShipping ? shippingMargin : productMargin;
      return manufacturerPrice * (1 + margin / 100);
    };
    
    // FIXED: Calculate totals - ALWAYS use client prices for admin/super_admin
    const samplePrice = (() => {
      const mfgPrice = (product as any).sample_fee || 0;
      // If we have a stored client price and margins not loaded yet, use it
      if (!marginsLoaded && (product as any).client_sample_fee) {
        return (product as any).client_sample_fee;
      }
      // Otherwise calculate dynamically with margins
      return calculateClientPrice(mfgPrice, false);
    })();
    
    const unitPrice = (() => {
      const mfgPrice = (product as any).product_price || 0;
      if (!marginsLoaded && (product as any).client_product_price) {
        return (product as any).client_product_price;
      }
      return calculateClientPrice(mfgPrice, false);
    })();
    
    const productPrice = unitPrice * totalQuantity;
    
    let shippingPrice = 0;
    if ((product as any).selected_shipping_method === 'air') {
      const mfgShipping = (product as any).shipping_air_price || 0;
      if (!marginsLoaded && (product as any).client_shipping_air_price) {
        shippingPrice = (product as any).client_shipping_air_price;
      } else {
        shippingPrice = calculateClientPrice(mfgShipping, true);
      }
    } else if ((product as any).selected_shipping_method === 'boat') {
      const mfgShipping = (product as any).shipping_boat_price || 0;
      if (!marginsLoaded && (product as any).client_shipping_boat_price) {
        shippingPrice = (product as any).client_shipping_boat_price;
      } else {
        shippingPrice = calculateClientPrice(mfgShipping, true);
      }
    }
    
    const totalPrice = samplePrice + productPrice + shippingPrice;

    // Separate media types
    const referenceMedia = media.filter(m => m.file_type === 'document' || m.file_type === 'image');
    const sampleMedia = media.filter(m => m.file_type?.startsWith('sample'));

    // Get variant type name
    const getVariantTypeName = () => {
      if (items.length > 0 && items[0].variant_combo) {
        const combo = items[0].variant_combo.toLowerCase();
        if (combo.includes('small') || combo.includes('medium') || combo.includes('large') || 
            combo.includes('s /') || combo.includes('m /') || combo.includes('l /') ||
            combo.includes('xl') || combo.includes('xxl')) {
          return 'Size';
        }
        if (combo.includes('shoe')) {
          return 'Shoe Size';
        }
        if (combo.includes('color') || combo.includes('colour')) {
          return 'Color';
        }
        return 'Variant';
      }
      return 'Variant';
    };

    const getProductStatusIcon = (status: string) => {
      const normalizedStatus = status || 'pending';
      switch (normalizedStatus) {
        case 'completed':
          return <CheckCircle className="w-5 h-5 text-green-500" />;
        case 'in_production':
          return <Package className="w-5 h-5 text-blue-500" />;
        case 'shipped':
        case 'in_transit':
          return <Truck className="w-5 h-5 text-purple-500" />;
        case 'sample_requested':
          return <AlertCircle className="w-5 h-5 text-yellow-500" />;
        case 'revision_requested':
          return <RotateCcw className="w-5 h-5 text-orange-500" />;
        case 'pending_client_approval':
          return <Clock className="w-5 h-5 text-purple-500" />;
        case 'rejected':
          return <XCircle className="w-5 h-5 text-red-500" />;
        case 'submitted_to_manufacturer':
        case 'sent_to_manufacturer':
          return <Send className="w-5 h-5 text-blue-500" />;
        case 'pending_admin':
          return <MessageSquare className="w-5 h-5 text-orange-500" />;
        default:
          return <Clock className="w-5 h-5 text-gray-500" />;
      }
    };

    const getCorrectProductStatus = () => {
      return (product as any).product_status || 'pending';
    };

    const displayStatus = getCorrectProductStatus();

    const getCurrentUser = () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        return {
          id: user.id || crypto.randomUUID(),
          name: user.name || user.email || 'Unknown User'
        };
      }
      return {
        id: crypto.randomUUID(),
        name: 'Unknown User'
      };
    };

    // All handler functions remain the same...
    const handleToggleLock = async () => {
      setProcessingProduct(true);
      try {
        const newLockStatus = !(product as any).is_locked;
        const newProductStatus = newLockStatus ? 'in_production' : 'pending';

        await supabase
          .from('order_products')
          .update({ 
            is_locked: newLockStatus,
            product_status: newProductStatus
          })
          .eq('id', (product as any).id);

        onUpdate();
      } catch (error) {
        console.error('Error toggling lock:', error);
      } finally {
        setProcessingProduct(false);
      }
    };

    const handleProductStatusChange = async (newStatus: string) => {
      try {
        await supabase
          .from('order_products')
          .update({ product_status: newStatus })
          .eq('id', (product as any).id);

        onUpdate();
      } catch (error) {
        console.error('Error updating status:', error);
      }
    };

    const handleSaveNotesSection = async () => {
      if (!tempNotes || tempNotes.trim() === '') return;
      
      try {
        const user = getCurrentUser();
        
        const { error } = await supabase
          .from('order_products')
          .update({ internal_notes: tempNotes.trim() })
          .eq('id', (product as any).id);

        if (error) {
          console.error('Database error:', error);
          alert('Failed to save note. Please try again.');
          return;
        }

        try {
          await supabase
            .from('audit_log')
            .insert({
              user_id: user.id,
              user_name: user.name,
              action_type: 'note_added',
              target_type: 'order_product',
              target_id: (product as any).id,
              new_value: `General Note: "${tempNotes.trim()}"`,
              timestamp: new Date().toISOString()
            });
        } catch (auditError) {
          console.error('Failed to log audit:', auditError);
        }

        setOriginalValues(prev => ({ ...prev, internalNotes: tempNotes.trim() }));
        setTempNotes('');
        setNotesSectionDirty(false);
        setShowNewHistoryDot(true);
        await onUpdate();
      } catch (error) {
        console.error('Error saving notes:', error);
        alert('Failed to save note. Please try again.');
      }
    };

    const handleSaveSampleSection = async () => {
      try {
        const user = getCurrentUser();
        
        if (tempSampleNotes && tempSampleNotes.trim()) {
          const { error } = await supabase
            .from('order_products')
            .update({ sample_notes: tempSampleNotes.trim() })
            .eq('id', (product as any).id);

          if (error) {
            console.error('Database error:', error);
            alert('Failed to save sample note. Please try again.');
            return;
          }

          try {
            await supabase
              .from('audit_log')
              .insert({
                user_id: user.id,
                user_name: user.name,
                action_type: 'sample_note_added',
                target_type: 'order_product',
                target_id: (product as any).id,
                new_value: `Sample Note: "${tempSampleNotes.trim()}"`,
                timestamp: new Date().toISOString()
              });
          } catch (auditError) {
            console.error('Failed to log audit:', auditError);
          }
        }

        if (pendingSampleFiles.length > 0) {
          console.log('Starting sample file uploads...', pendingSampleFiles.length, 'files');

          // Count existing sample files to get the next counter
          const existingSampleFiles = media.filter((m: any) =>
            m.file_type === 'sample_image' || m.file_type === 'sample_document'
          );
          let sampleFileCounter = existingSampleFiles.length + 1;

          for (const file of pendingSampleFiles) {
            const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file';
            const productOrderNumber = (product as any).product_order_number || 'PRD-0000';

            // Create display name using product code and sequential number
            const displayName = `${productOrderNumber}-sample-${String(sampleFileCounter).padStart(2, '0')}.${fileExt}`;
            const filePath = `${(product as any).order_id}/${(product as any).id}/${displayName}`;

            console.log('Uploading file to storage:', filePath);
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('order-media')
              .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
              });

            if (uploadError) {
              console.error('Storage upload error:', uploadError);
              console.error('Error details:', {
                message: uploadError.message,
                statusCode: (uploadError as any).statusCode,
                error: (uploadError as any).error,
                cause: (uploadError as any).cause
              });
              alert(`Failed to upload ${file.name}: ${uploadError.message}\n\nPlease check:\n1. Storage bucket 'order-media' exists\n2. You have upload permissions\n3. File type is allowed`);
              continue;
            }
            console.log('File uploaded successfully:', uploadData);

            const { data: { publicUrl } } = supabase.storage
              .from('order-media')
              .getPublicUrl(filePath);

            console.log('File uploaded, inserting into order_media table:', {
              order_product_id: (product as any).id,
              file_url: publicUrl,
              file_type: file.type.startsWith('image/') ? 'sample_image' : 'sample_document',
              original_filename: file.name,
              display_name: displayName
            });

            const { data: insertData, error: insertError } = await supabase
              .from('order_media')
              .insert({
                order_product_id: (product as any).id,
                file_url: publicUrl,
                file_type: file.type.startsWith('image/') ? 'sample_image' : 'sample_document',
                uploaded_by: user.id,
                original_filename: file.name,
                display_name: displayName
              })
              .select();

            if (insertError) {
              console.error('Database insert error:', insertError);
              alert(`Failed to save ${file.name} to database: ${insertError.message}`);
            } else {
              console.log('File saved to database successfully:', insertData);
              sampleFileCounter++;
            }
          }
        }

        setOriginalValues(prev => ({ ...prev, sampleNotes: tempSampleNotes.trim() }));
        setTempSampleNotes('');
        setPendingSampleFiles([]);
        setSampleSectionDirty(false);
        setShowNewHistoryDot(true);
        await onUpdate();
      } catch (error) {
        console.error('Error saving sample section:', error);
        alert('Failed to save sample section. Please try again.');
      }
    };

    const handleSaveBulkSection = async () => {
      try {
        const user = getCurrentUser();
        
        if (tempBulkNotes && tempBulkNotes.trim()) {
          const { error } = await supabase
            .from('order_products')
            .update({ client_notes: tempBulkNotes.trim() })
            .eq('id', (product as any).id);

          if (error) {
            console.error('Database error:', error);
            alert('Failed to save bulk note. Please try again.');
            return;
          }

          try {
            await supabase
              .from('audit_log')
              .insert({
                user_id: user.id,
                user_name: user.name,
                action_type: 'bulk_note_added',
                target_type: 'order_product',
                target_id: (product as any).id,
                new_value: `Bulk Note: "${tempBulkNotes.trim()}"`,
                timestamp: new Date().toISOString()
              });
          } catch (auditError) {
            console.error('Failed to log audit:', auditError);
          }
        }

        if (pendingBulkFiles.length > 0) {
          console.log('Starting bulk file uploads...', pendingBulkFiles.length, 'files');

          // Count existing bulk/product files to get the next counter
          const existingBulkFiles = media.filter((m: any) =>
            m.file_type === 'image' || m.file_type === 'document'
          );
          let bulkFileCounter = existingBulkFiles.length + 1;

          for (const file of pendingBulkFiles) {
            const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file';
            const productOrderNumber = (product as any).product_order_number || 'PRD-0000';

            // Create display name using product code and sequential number
            const displayName = `${productOrderNumber}-bulk-${String(bulkFileCounter).padStart(2, '0')}.${fileExt}`;
            const filePath = `${(product as any).order_id}/${(product as any).id}/${displayName}`;

            console.log('Uploading file to storage:', filePath);
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('order-media')
              .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
              });

            if (uploadError) {
              console.error('Storage upload error:', uploadError);
              console.error('Error details:', {
                message: uploadError.message,
                statusCode: (uploadError as any).statusCode,
                error: (uploadError as any).error,
                cause: (uploadError as any).cause
              });
              alert(`Failed to upload ${file.name}: ${uploadError.message}\n\nPlease check:\n1. Storage bucket 'order-media' exists\n2. You have upload permissions\n3. File type is allowed`);
              continue;
            }
            console.log('File uploaded successfully:', uploadData);

            const { data: { publicUrl } } = supabase.storage
              .from('order-media')
              .getPublicUrl(filePath);

            console.log('File uploaded, inserting into order_media table:', {
              order_product_id: (product as any).id,
              file_url: publicUrl,
              file_type: file.type.startsWith('image/') ? 'image' : 'document',
              original_filename: file.name,
              display_name: displayName
            });

            const { data: insertData, error: insertError } = await supabase
              .from('order_media')
              .insert({
                order_product_id: (product as any).id,
                file_url: publicUrl,
                file_type: file.type.startsWith('image/') ? 'image' : 'document',
                uploaded_by: user.id,
                original_filename: file.name,
                display_name: displayName
              })
              .select();

            if (insertError) {
              console.error('Database insert error:', insertError);
              alert(`Failed to save ${file.name} to database: ${insertError.message}`);
            } else {
              console.log('File saved to database successfully:', insertData);
              bulkFileCounter++;
            }
          }
        }

        setOriginalValues(prev => ({ ...prev, bulkNotes: tempBulkNotes.trim() }));
        setTempBulkNotes('');
        setPendingBulkFiles([]);
        setBulkSectionDirty(false);
        setShowNewHistoryDot(true);
        await onUpdate();
      } catch (error) {
        console.error('Error saving bulk section:', error);
        alert('Failed to save bulk section. Please try again.');
      }
    };

    const handleShippingMethodChange = async (method: 'air' | 'boat') => {
      try {
        await supabase
          .from('order_products')
          .update({ selected_shipping_method: method })
          .eq('id', (product as any).id);

        onUpdate();
      } catch (error) {
        console.error('Error updating shipping method:', error);
      }
    };

    const handleSampleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const newFiles = Array.from(files);
      setPendingSampleFiles(prev => [...prev, ...newFiles]);
      setSampleSectionDirty(true);
      
      if (sampleFileInputRef.current) {
        sampleFileInputRef.current.value = '';
      }
    };

    const handleBulkFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const newFiles = Array.from(files);
      setPendingBulkFiles(prev => [...prev, ...newFiles]);
      setBulkSectionDirty(true);
      
      if (bulkFileInputRef.current) {
        bulkFileInputRef.current.value = '';
      }
    };

    const removePendingSampleFile = (index: number) => {
      setPendingSampleFiles(prev => prev.filter((_, i) => i !== index));
      if (pendingSampleFiles.length === 1 && !tempSampleNotes) {
        setSampleSectionDirty(false);
      }
    };

    const removePendingBulkFile = (index: number) => {
      setPendingBulkFiles(prev => prev.filter((_, i) => i !== index));
      if (pendingBulkFiles.length === 1 && !tempBulkNotes) {
        setBulkSectionDirty(false);
      }
    };

    const handleDeleteMedia = async (mediaId: string) => {
      try {
        await supabase
          .from('order_media')
          .delete()
          .eq('id', mediaId);
        
        onUpdate();
      } catch (error) {
        console.error('Error deleting media:', error);
      }
    };

    const handleFileClick = (fileUrl: string) => {
      window.open(fileUrl, '_blank');
    };

    const handleViewHistory = () => {
      if (onViewHistory) {
        onViewHistory((product as any).id);
        setShowNewHistoryDot(false);
      }
    };

    const handleSaveVariantNotes = async () => {
      try {
        for (const item of items) {
          const newNote = variantNotes[item.id] || '';
          if (newNote !== (item.notes || '')) {
            await supabase
              .from('order_items')
              .update({ notes: newNote })
              .eq('id', item.id);
          }
        }
        
        setEditingVariants(false);
        await onUpdate();
      } catch (error) {
        console.error('Error saving variant notes:', error);
      }
    };

    const truncateFilename = (filename: string, maxLength: number = 15) => {
      if (!filename) return 'File';
      if (filename.length <= maxLength) return filename;
      const ext = filename.split('.').pop();
      const name = filename.substring(0, maxLength - 5);
      return `${name}...${ext}`;
    };

    // COLLAPSED HEADER COMPONENT
    const CollapsedHeader = () => (
      <div className="bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden hover:shadow-xl transition-shadow">
        <div className="p-4 bg-gray-50 border-b-2 border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={() => setIsCollapsed(false)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Expand details"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
              
              {getProductStatusIcon(displayStatus)}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg text-gray-900">
                    {(product as any).description || (product as any).product?.title || 'Product'}
                  </h3>
                  <ProductStatusBadge status={displayStatus} />
                  {(product as any).payment_status === 'paid' && (
                    <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Paid
                    </span>
                  )}
                  {(product as any).product_status === 'shipped' && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                      📦 Shipped
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                  <span>{(product as any).product_order_number}</span>
                  <span>•</span>
                  <span>Qty: {totalQuantity}</span>
                  {totalPrice > 0 && (
                    <>
                      <span>•</span>
                      <span className="font-semibold text-green-600">
                        Total: ${totalPrice.toFixed(2)}
                      </span>
                    </>
                  )}
                  {(product as any).tracking_number && (
                    <>
                      <span>•</span>
                      <span className="text-purple-600 font-medium">
                        Tracking: {(product as any).tracking_number}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {onViewHistory && (
                <button
                  onClick={handleViewHistory}
                  className="px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium flex items-center gap-2 relative"
                >
                  <History className="w-4 h-4" />
                  {showNewHistoryDot && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  )}
                </button>
              )}
              
              {(userRole === 'admin' || userRole === 'super_admin') && onRoute && (
                <button
                  onClick={() => onRoute(product)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Route
                </button>
              )}
              
              {canLockProducts && (product as any).product_status !== 'shipped' && (
                <button
                  onClick={handleToggleLock}
                  disabled={processingProduct}
                  className={`p-2 rounded-lg transition-colors ${
                    (product as any).is_locked 
                      ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                      : 'bg-green-50 text-green-600 hover:bg-green-100'
                  } disabled:opacity-50`}
                  title={(product as any).is_locked ? 'Unlock for editing' : 'Lock for production'}
                >
                  {processingProduct ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (product as any).is_locked ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );

    if (isCollapsed) {
      return <CollapsedHeader />;
    }
// MAIN EXPANDED VIEW WITH GREEN TOTAL RESTORED
    return (
      <div className="bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden hover:shadow-xl transition-shadow">
        {/* Product Header */}
        <div className="p-4 bg-gray-50 border-b-2 border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              {/* Collapse Button - ALWAYS show when multiple products (autoCollapse=true) */}
              {autoCollapse && (
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors mt-1"
                  title="Collapse details"
                >
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                </button>
              )}
              {getProductStatusIcon(displayStatus)}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-lg text-gray-900">
                    {(product as any).description || (product as any).product?.title || 'Product'}
                  </h3>
                  <ProductStatusBadge status={displayStatus} />
                  {(product as any).payment_status === 'paid' && (
                    <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Paid
                    </span>
                  )}
                  
                  {/* FIXED: GREEN TOTAL BADGE RESTORED HERE! */}
                  {totalPrice > 0 && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      Total: ${totalPrice.toFixed(2)}
                    </span>
                  )}
                </div>
                
                {(product as any).description && (product as any).product?.title && (
                  <p className="text-sm text-gray-600 mt-1">{(product as any).product?.title}</p>
                )}
                
                <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 mt-2 text-xs text-gray-500">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <span>{(product as any).product_order_number}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>Qty: {totalQuantity}</span>
                  </div>
                  
                  {userRole === 'super_admin' && (
                    <select
                      value={displayStatus}
                      onChange={(e) => handleProductStatusChange(e.target.value)}
                      className="px-2 py-0.5 text-xs border border-gray-300 rounded bg-white text-gray-700 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="sample_requested">Sample Requested</option>
                      <option value="sent_to_manufacturer">Sent to Manufacturer</option>
                      <option value="pending_admin">Pending Admin</option>
                      <option value="approved_for_production">Approved for Production</option>
                      <option value="in_production">In Production</option>
                      <option value="pending_client_approval">Pending Client</option>
                      <option value="revision_requested">Revision Requested</option>
                      <option value="completed">Completed</option>
                      <option value="rejected">Rejected</option>
                      <option value="shipped">Shipped</option>
                      <option value="in_transit">In Transit</option>
                    </select>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onViewHistory && (
                <button
                  onClick={handleViewHistory}
                  className="px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium flex items-center gap-2 relative"
                >
                  <History className="w-4 h-4" />
                  <span className="hidden sm:inline">History</span>
                  {showNewHistoryDot && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  )}
                </button>
              )}
              
              {(userRole === 'admin' || userRole === 'super_admin') && onRoute && (
                <button
                  onClick={() => onRoute(product)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Route
                </button>
              )}
              
              {canLockProducts && (
                <button
                  onClick={handleToggleLock}
                  disabled={processingProduct}
                  className={`p-2 rounded-lg transition-colors ${
                    (product as any).is_locked 
                      ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                      : 'bg-green-50 text-green-600 hover:bg-green-100'
                  } disabled:opacity-50`}
                  title={(product as any).is_locked ? 'Unlock for editing' : 'Lock for production'}
                >
                  {processingProduct ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (product as any).is_locked ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Rest of the component remains exactly the same... */}
          {/* Notes Section */}
          <div className="mt-3 p-4 bg-white rounded-lg border border-gray-300">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Notes / Instructions</h4>
            
            {(product as any).internal_notes && (
              <div className="mb-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                <strong>Current note:</strong>
                <div className="whitespace-pre-wrap mt-1">{(product as any).internal_notes}</div>
              </div>
            )}
            
            <div className="space-y-2">
              <textarea
                value={tempNotes}
                onChange={(e) => {
                  setTempNotes(e.target.value);
                  setNotesSectionDirty(true);
                }}
                placeholder="Add general notes or instructions for this product..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium text-sm placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
              
              {notesSectionDirty && (
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setTempNotes('');
                      setNotesSectionDirty(false);
                    }}
                    className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNotesSection}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1"
                  >
                    <Save className="w-3 h-3" />
                    Save Notes
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sample Request Section - WITH CLIENT PRICES */}
          <div className="mt-3 bg-amber-50 rounded-lg p-4 border border-amber-300">
            <h4 className="text-sm font-semibold text-amber-900 flex items-center mb-3">
              <AlertCircle className="w-4 h-4 mr-2" />
              Sample Request
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div className="opacity-60">
                <label className="block text-xs font-medium text-amber-800 mb-1">
                  Sample Price
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-amber-600" />
                  <input
                    type="text"
                    value={samplePrice > 0 ? `$${samplePrice.toFixed(2)}` : 'Set by manufacturer'}
                    disabled
                    className="w-full pl-8 pr-3 py-2 border border-amber-200 rounded-lg bg-amber-50 text-gray-500"
                  />
                </div>
              </div>

              <div className="opacity-60">
                <label className="block text-xs font-medium text-amber-800 mb-1">
                  Sample ETA
                </label>
                <div className="relative">
                  <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-amber-600" />
                  <input
                    type="text"
                    value={(product as any).sample_eta ? new Date((product as any).sample_eta).toLocaleDateString() : 'Set by manufacturer'}
                    disabled
                    className="w-full pl-8 pr-3 py-2 border border-amber-200 rounded-lg bg-amber-50 text-gray-500"
                  />
                </div>
              </div>

              <div className="opacity-60">
                <label className="block text-xs font-medium text-amber-800 mb-1">
                  Status
                </label>
                <input
                  type="text"
                  value={(product as any).sample_status?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Pending'}
                  disabled
                  className="w-full px-3 py-2 border border-amber-200 rounded-lg bg-amber-50 text-gray-500"
                />
              </div>
            </div>

            {/* Sample Notes */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-amber-800 mb-1">
                Sample Notes / Instructions
              </label>
              
              {(product as any).sample_notes && (
                <div className="mb-2 p-2 bg-amber-100 rounded text-sm text-amber-800">
                  <strong>Current note:</strong>
                  <div className="whitespace-pre-wrap mt-1">{(product as any).sample_notes}</div>
                </div>
              )}
              
              <textarea
                value={tempSampleNotes}
                onChange={(e) => {
                  setTempSampleNotes(e.target.value);
                  setSampleSectionDirty(true);
                }}
                placeholder="Add sample-specific instructions, requirements, materials..."
                rows={3}
                className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-white text-gray-900 font-medium text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            {/* Sample Media */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-amber-800">
                  Sample Media {sampleMedia.length > 0 && `(${sampleMedia.length})`}
                </label>
                <button 
                  onClick={() => sampleFileInputRef.current?.click()}
                  className="text-xs px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 flex items-center gap-1 transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  Add Files
                </button>
              </div>
              
              <input
                ref={sampleFileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*,video/*"
                onChange={handleSampleFileUpload}
                className="hidden"
              />
              
              {sampleMedia.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {sampleMedia.map((file) => (
                    <div key={file.id} className="group relative inline-flex">
                      <button
                        onClick={() => handleFileClick(file.file_url)}
                        className="px-2 py-1 bg-white border border-amber-200 rounded text-xs text-amber-700 hover:bg-amber-50 hover:border-amber-300 transition-colors flex items-center gap-1"
                        title={file.display_name || file.original_filename || 'Sample File'}
                      >
                        <Paperclip className="w-3 h-3" />
                        <span>{file.display_name || file.original_filename || 'Sample File'}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteMedia(file.id)}
                        className="absolute -top-1 -right-1 p-0.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                        title="Delete file"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {pendingSampleFiles.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-amber-700 mb-1">Files to upload (will save with section):</p>
                  <div className="flex flex-wrap gap-1">
                    {pendingSampleFiles.map((file, index) => {
                      // Generate display name for preview
                      const existingSampleFiles = media.filter((m: any) =>
                        m.file_type === 'sample_image' || m.file_type === 'sample_document'
                      );
                      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file';
                      const productOrderNumber = (product as any).product_order_number || 'PRD-0000';
                      const displayName = `${productOrderNumber}-sample-${String(existingSampleFiles.length + index + 1).padStart(2, '0')}.${fileExt}`;

                      return (
                        <div key={index} className="group relative inline-flex">
                          <div className="px-2 py-1 bg-amber-100 border border-amber-300 rounded text-xs text-amber-800 flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            <span>{displayName}</span>
                          </div>
                          <button
                            onClick={() => removePendingSampleFile(index)}
                            className="absolute -top-1 -right-1 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700"
                            title="Remove file"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {sampleMedia.length === 0 && pendingSampleFiles.length === 0 && (
                <p className="text-xs text-amber-600">No sample media uploaded yet</p>
              )}
            </div>
            
            {sampleSectionDirty && (
              <div className="flex justify-end gap-2 pt-2 mt-3 border-t border-amber-200">
                <button
                  onClick={() => {
                    setTempSampleNotes('');
                    setPendingSampleFiles([]);
                    setSampleSectionDirty(false);
                  }}
                  className="px-4 py-1.5 text-sm text-amber-700 hover:text-amber-900 border border-amber-300 rounded-lg hover:bg-amber-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSampleSection}
                  className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 flex items-center gap-1"
                >
                  <Save className="w-3 h-3" />
                  Save Sample Section
                </button>
              </div>
            )}
          </div>

          {/* Bulk Order Information - WITH CLIENT PRICES */}
          <div className="mt-3 bg-white rounded-lg border border-gray-300 p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <Package className="w-4 h-4 mr-2" />
              Bulk Order Information
            </h4>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Bulk Order Notes</h5>
              
              {(product as any).client_notes && (
                <div className="mb-2 p-2 bg-blue-50 rounded text-sm text-blue-700">
                  <strong>Current note:</strong>
                  <div className="whitespace-pre-wrap mt-1">{(product as any).client_notes}</div>
                </div>
              )}
              
              <textarea
                value={tempBulkNotes}
                onChange={(e) => {
                  setTempBulkNotes(e.target.value);
                  setBulkSectionDirty(true);
                }}
                placeholder="Add bulk order specific instructions, shipping details, production notes..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium text-sm placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* Bulk Order Media */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-700">
                  Bulk Order Media {referenceMedia.length > 0 && `(${referenceMedia.length})`}
                </label>
                <button 
                  onClick={() => bulkFileInputRef.current?.click()}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1 transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  Add Files
                </button>
              </div>
              
              <input
                ref={bulkFileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*,video/*"
                onChange={handleBulkFileUpload}
                className="hidden"
              />
              
              {referenceMedia.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {referenceMedia.map((file) => (
                    <div key={file.id} className="group relative inline-flex">
                      <button
                        onClick={() => handleFileClick(file.file_url)}
                        className="px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center gap-1"
                        title={file.display_name || file.original_filename || 'Product File'}
                      >
                        <Paperclip className="w-3 h-3" />
                        <span>{file.display_name || file.original_filename || 'Product File'}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteMedia(file.id)}
                        className="absolute -top-1 -right-1 p-0.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                        title="Delete file"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {pendingBulkFiles.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-700 mb-1">Files to upload (will save with section):</p>
                  <div className="flex flex-wrap gap-1">
                    {pendingBulkFiles.map((file, index) => {
                      // Generate display name for preview
                      const existingBulkFiles = media.filter((m: any) =>
                        m.file_type === 'image' || m.file_type === 'document'
                      );
                      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file';
                      const productOrderNumber = (product as any).product_order_number || 'PRD-0000';
                      const displayName = `${productOrderNumber}-bulk-${String(existingBulkFiles.length + index + 1).padStart(2, '0')}.${fileExt}`;

                      return (
                        <div key={index} className="group relative inline-flex">
                          <div className="px-2 py-1 bg-blue-100 border border-blue-300 rounded text-xs text-blue-800 flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            <span>{displayName}</span>
                          </div>
                          <button
                            onClick={() => removePendingBulkFile(index)}
                            className="absolute -top-1 -right-1 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700"
                            title="Remove file"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {referenceMedia.length === 0 && pendingBulkFiles.length === 0 && (
                <p className="text-xs text-gray-500">No bulk order media uploaded yet</p>
              )}
            </div>

            {/* Product Price and Production Info - WITH CLIENT PRICES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Price
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={unitPrice > 0 ? `$${unitPrice.toFixed(2)}` : 'Set by manufacturer'}
                    disabled
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Production Time
                </label>
                <div className="relative">
                  <Clock className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={(product as any).production_time || 'Set by manufacturer'}
                    disabled
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                  />
                </div>
              </div>
            </div>

            {/* Shipping Method Selection - WITH CLIENT PRICES */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <h5 className="text-sm font-medium text-gray-700 mb-3">Select Shipping Method</h5>
              
              {/* FIXED: Show CLIENT shipping prices */}
              {((product as any).shipping_air_price || (product as any).shipping_boat_price) ? (
                <div className="space-y-3">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name={`shipping-${(product as any).id}`}
                      value="air"
                      checked={(product as any).selected_shipping_method === 'air'}
                      onChange={() => handleShippingMethodChange('air')}
                      disabled={!(product as any).shipping_air_price}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div className="ml-3 flex items-center gap-2">
                      <Plane className="w-4 h-4 text-gray-500" />
                      <span className={`text-sm ${
                        (product as any).selected_shipping_method === 'air' ? 'text-blue-700 font-medium' : 'text-gray-700'
                      }`}>
                        Air - ${calculateClientPrice((product as any).shipping_air_price || 0, true).toFixed(2)}
                      </span>
                    </div>
                  </label>
                  
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name={`shipping-${(product as any).id}`}
                      value="boat"
                      checked={(product as any).selected_shipping_method === 'boat'}
                      onChange={() => handleShippingMethodChange('boat')}
                      disabled={!(product as any).shipping_boat_price}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div className="ml-3 flex items-center gap-2">
                      <Ship className="w-4 h-4 text-gray-500" />
                      <span className={`text-sm ${
                        (product as any).selected_shipping_method === 'boat' ? 'text-blue-700 font-medium' : 'text-gray-700'
                      }`}>
                        Boat - ${calculateClientPrice((product as any).shipping_boat_price || 0, true).toFixed(2)}
                      </span>
                    </div>
                  </label>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Shipping prices not yet set by manufacturer</p>
              )}
              
              {(product as any).selected_shipping_method && (
                <p className="mt-2 text-xs text-blue-600">
                  Selected: {(product as any).selected_shipping_method === 'air' ? 'Air' : 'Boat'} shipping
                </p>
              )}
            </div>
            
            {bulkSectionDirty && (
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  onClick={() => {
                    setTempBulkNotes('');
                    setPendingBulkFiles([]);
                    setBulkSectionDirty(false);
                  }}
                  className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBulkSection}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1"
                >
                  <Save className="w-3 h-3" />
                  Save Bulk Section
                </button>
              </div>
            )}

            {/* Variant Details Table */}
            <div className="mb-4">
              <h5 className="text-sm font-medium text-gray-700 mb-2">
                {getVariantTypeName()} Details
              </h5>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700" style={{width: '25%'}}>
                        {getVariantTypeName()}
                      </th>
                      <th className="text-left py-2 px-1 text-sm font-medium text-gray-700" style={{width: '10%'}}>Qty</th>
                      <th className="text-left py-2 pl-2 pr-3 text-sm font-medium text-gray-700" style={{width: '65%'}}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                        <td className="py-2 px-3 text-sm text-gray-900">{item.variant_combo}</td>
                        <td className="py-2 px-1 text-sm font-medium text-gray-900">{item.quantity}</td>
                        <td className="py-2 pl-2 pr-3">
                          <input
                            type="text"
                            value={variantNotes[item.id] || ''}
                            onChange={(e) => {
                              setVariantNotes(prev => ({
                                ...prev,
                                [item.id]: e.target.value
                              }));
                              if (!editingVariants) setEditingVariants(true);
                            }}
                            placeholder="Add note..."
                            className="w-full px-2 py-1 text-sm text-gray-900 font-medium border border-gray-300 rounded placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {editingVariants && (
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      const originalNotes: {[key: string]: string} = {};
                      items.forEach(item => {
                        originalNotes[item.id] = item.notes || '';
                      });
                      setVariantNotes(originalNotes);
                      setEditingVariants(false);
                    }}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveVariantNotes}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1"
                  >
                    <Save className="w-3 h-3" />
                    Save Variant Notes
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);