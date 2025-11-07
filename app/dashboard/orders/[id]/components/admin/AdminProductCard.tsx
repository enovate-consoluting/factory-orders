// app/dashboard/orders/[id]/components/admin/AdminProductCard.tsx
// FULLY FIXED VERSION - All TypeScript errors resolved

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
}

// USING THE SAME PATTERN AS MANUFACTURERPRODUCTCARD
export const AdminProductCard = forwardRef<any, AdminProductCardProps>(
  function AdminProductCard({ 
    product, 
    items = [],
    media = [],
    orderStatus,
    onUpdate,
    onRoute,
    onViewHistory,
    hasNewHistory = false
  }, ref) {
    const permissions = usePermissions() as any;
    const userRole = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).role : null;
    const canLockProducts = permissions?.canLockProducts || userRole === 'super_admin' || userRole === 'admin';
    
    // COLLAPSIBLE STATE - Auto-collapse for shipped products
    const [isCollapsed, setIsCollapsed] = useState(
      (product as any).product_status === 'shipped' || (product as any).product_status === 'in_transit'
    );
    
    // Auto-collapse when status changes to shipped
    useEffect(() => {
      if ((product as any).product_status === 'shipped' || (product as any).product_status === 'in_transit') {
        setIsCollapsed(true);
      }
    }, [(product as any).product_status, (product as any).is_locked]);
    
    // State for notes
    const [tempNotes, setTempNotes] = useState('');
    const [tempSampleNotes, setTempSampleNotes] = useState('');
    const [tempBulkNotes, setTempBulkNotes] = useState('');
    
    // State for tracking if sections have changes
    const [notesSectionDirty, setNotesSectionDirty] = useState(false);
    const [sampleSectionDirty, setSampleSectionDirty] = useState(false);
    const [bulkSectionDirty, setBulkSectionDirty] = useState(false);
    
    const [processingProduct, setProcessingProduct] = useState(false);
    const bulkFileInputRef = useRef<HTMLInputElement>(null);
    const sampleFileInputRef = useRef<HTMLInputElement>(null);
    const [showNewHistoryDot, setShowNewHistoryDot] = useState(hasNewHistory);
    
    // State for variant notes editing
    const [variantNotes, setVariantNotes] = useState<{[key: string]: string}>({});
    const [editingVariants, setEditingVariants] = useState(false);
    
    // State for pending file uploads
    const [pendingSampleFiles, setPendingSampleFiles] = useState<File[]>([]);
    const [pendingBulkFiles, setPendingBulkFiles] = useState<File[]>([]);
    
    // Store original values for cancel functionality
    const [originalValues, setOriginalValues] = useState({
      internalNotes: (product as any).internal_notes || '',
      sampleNotes: (product as any).sample_notes || '',
      bulkNotes: (product as any).client_notes || ''
    });
    
    // Initialize variant notes from items
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
      // Reset pending files when product changes
      setPendingSampleFiles([]);
      setPendingBulkFiles([]);
    }, [product]);
    
    // EXPOSE SAVE FUNCTIONS TO PARENT VIA REF - JUST LIKE MANUFACTURER CARD
    useImperativeHandle(ref, () => ({
      saveAll: async () => {
        console.log('SaveAll called for admin product:', (product as any).id);
        let changesMade = false;
        
        // Check if notes section has changes
        if (notesSectionDirty || tempNotes) {
          console.log('Saving notes section...');
          await handleSaveNotesSection();
          changesMade = true;
        }
        
        // Check if sample section has changes
        if (sampleSectionDirty || tempSampleNotes || pendingSampleFiles.length > 0) {
          console.log('Saving sample section...');
          await handleSaveSampleSection();
          changesMade = true;
        }
        
        // Check if bulk section has changes
        if (bulkSectionDirty || tempBulkNotes || pendingBulkFiles.length > 0) {
          console.log('Saving bulk section...');
          await handleSaveBulkSection();
          changesMade = true;
        }
        
        // Save variant notes if editing
        if (editingVariants) {
          console.log('Saving variant notes...');
          await handleSaveVariantNotes();
          changesMade = true;
        }
        
        console.log('SaveAll complete for admin product:', (product as any).id, 'Changes made:', changesMade);
        return changesMade;
      }
    }), [
      // Add all dependencies
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
    
    // Get current user information
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
    
    // Calculate totals with CLIENT prices (includes margin)
    // Use client prices if available, fallback to regular prices
    const samplePrice = (product as any).client_sample_fee || (product as any).sample_fee || 0;
    const unitPrice = (product as any).client_product_price || (product as any).product_price || 0;
    const productPrice = unitPrice * totalQuantity;
    let shippingPrice = 0;
    if ((product as any).selected_shipping_method === 'air') {
      shippingPrice = (product as any).client_shipping_air_price || (product as any).shipping_air_price || 0;
    } else if ((product as any).selected_shipping_method === 'boat') {
      shippingPrice = (product as any).client_shipping_boat_price || (product as any).shipping_boat_price || 0;
    }
    const totalPrice = samplePrice + productPrice + shippingPrice;

    // Separate media types
    const referenceMedia = media.filter(m => m.file_type === 'document' || m.file_type === 'image');
    const sampleMedia = media.filter(m => m.file_type?.startsWith('sample'));

    // Get variant type name from the first item
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

    // Save Notes Section
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

        // Try to log audit
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

        // Update original value
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

    // Save Sample Section with pending files
    const handleSaveSampleSection = async () => {
      try {
        const user = getCurrentUser();
        
        // Save sample notes if any
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

          // Try to log audit
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

        // Upload pending sample files
        if (pendingSampleFiles.length > 0) {
          for (const file of pendingSampleFiles) {
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(7);
            const fileExt = file.name.split('.').pop();
            const fileName = `sample-${timestamp}-${randomStr}.${fileExt}`;
            const filePath = `${(product as any).order_id}/${(product as any).id}/${fileName}`;
            
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
                  order_product_id: (product as any).id,
                  file_url: publicUrl,
                  file_type: file.type.startsWith('image/') ? 'sample_image' : 'sample_document',
                  uploaded_by: user.id,
                  original_filename: file.name
                });
            }
          }
        }

        // Update original value and clear states
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

    // Save Bulk Section with pending files
    const handleSaveBulkSection = async () => {
      try {
        const user = getCurrentUser();
        
        // Save bulk notes if any
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

          // Try to log audit
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

        // Upload pending bulk files
        if (pendingBulkFiles.length > 0) {
          for (const file of pendingBulkFiles) {
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(7);
            const fileExt = file.name.split('.').pop();
            const fileName = `bulk-${timestamp}-${randomStr}.${fileExt}`;
            const filePath = `${(product as any).order_id}/${(product as any).id}/${fileName}`;
            
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
                  order_product_id: (product as any).id,
                  file_url: publicUrl,
                  file_type: file.type.startsWith('image/') ? 'image' : 'document',
                  uploaded_by: user.id,
                  original_filename: file.name
                });
            }
          }
        }

        // Update original value and clear states
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

    // Handle sample file selection (pending)
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

    // Handle bulk file selection (pending)
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

    // COLLAPSED HEADER COMPONENT FOR SHIPPED PRODUCTS
    const CollapsedHeader = () => (
      <div className="bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden hover:shadow-xl transition-shadow">
        <div className="p-4 bg-gray-50 border-b-2 border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              {/* Expand Button */}
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
                  <span>•</span>
                  <span className="font-semibold text-green-600">
                    Total: ${totalPrice.toFixed(2)}
                  </span>
                  {/* Show tracking info if available */}
                  {(product as any).tracking_number && (
                    <>
                      <span>•</span>
                      <span className="text-purple-600 font-medium">
                        Tracking: {(product as any).tracking_number}
                      </span>
                    </>
                  )}
                  {(product as any).shipping_carrier && (
                    <>
                      <span>•</span>
                      <span className="text-purple-600">
                        {(product as any).shipping_carrier}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
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
              
              {/* Route button - still available even when shipped */}
              {(userRole === 'admin' || userRole === 'super_admin') && onRoute && (
                <button
                  onClick={() => onRoute(product)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Route
                </button>
              )}
              
              {/* Lock button disabled for shipped products */}
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

    // MAIN RENDER - Show collapsed or full view based on state
    if (isCollapsed) {
      return <CollapsedHeader />;
    }

    // FULL EXPANDED VIEW - REST OF THE COMPONENT CONTINUES BELOW...
    return (
      <div className="bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden hover:shadow-xl transition-shadow">
        {/* Product Header */}
        <div className="p-4 bg-gray-50 border-b-2 border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              {/* Collapse Button - Only show when shipped */}
              {((product as any).product_status === 'shipped' || (product as any).product_status === 'in_transit') && (
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
                </div>
                {(product as any).description && (product as any).product?.title && (
                  <p className="text-sm text-gray-600 mt-1">{(product as any).product?.title}</p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 mt-2 text-xs text-gray-500">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <span>{(product as any).product_order_number}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>Qty: {totalQuantity}</span>
                    {totalPrice > 0 && (
                      <span className="font-semibold text-green-600">
                        Total: ${totalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {/* Product Status Dropdown - Super Admin Only */}
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

          {/* Generic Notes Section with Save Button */}
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
              
              {/* Save button for Notes Section */}
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

          {/* Sample Request Section - PRICES REMAIN READ-ONLY */}
          <div className="mt-3 bg-amber-50 rounded-lg p-4 border border-amber-300">
            <h4 className="text-sm font-semibold text-amber-900 flex items-center mb-3">
              <AlertCircle className="w-4 h-4 mr-2" />
              Sample Request
            </h4>

            {/* Display client prices (with margin) - READ ONLY */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div className="opacity-60">
                <label className="block text-xs font-medium text-amber-800 mb-1">
                  Sample Price
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-amber-600" />
                  <input
                    type="text"
                    value={((product as any).client_sample_fee || (product as any).sample_fee) ? `$${((product as any).client_sample_fee || (product as any).sample_fee).toFixed(2)}` : 'Set by manufacturer'}
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

            {/* Sample Media with pending files */}
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
                        title={file.original_filename || 'Sample File'}
                      >
                        <Paperclip className="w-3 h-3" />
                        <span>{truncateFilename(file.original_filename || 'File', 12)}</span>
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
                    {pendingSampleFiles.map((file, index) => (
                      <div key={index} className="group relative inline-flex">
                        <div className="px-2 py-1 bg-amber-100 border border-amber-300 rounded text-xs text-amber-800 flex items-center gap-1">
                          <Upload className="w-3 h-3" />
                          <span>{truncateFilename(file.name, 12)}</span>
                        </div>
                        <button
                          onClick={() => removePendingSampleFile(index)}
                          className="absolute -top-1 -right-1 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700"
                          title="Remove file"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {sampleMedia.length === 0 && pendingSampleFiles.length === 0 && (
                <p className="text-xs text-amber-600">No sample media uploaded yet</p>
              )}
            </div>
            
            {/* Save button for Sample Section */}
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

          {/* Bulk Order Information - PRICES REMAIN READ-ONLY */}
          <div className="mt-3 bg-white rounded-lg border border-gray-300 p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <Package className="w-4 h-4 mr-2" />
              Bulk Order Information
            </h4>

            {/* Bulk Order Notes */}
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

            {/* Bulk Order Media with pending files */}
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
                        title={file.original_filename || 'Bulk File'}
                      >
                        <Paperclip className="w-3 h-3" />
                        <span>{truncateFilename(file.original_filename || 'File', 12)}</span>
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
                    {pendingBulkFiles.map((file, index) => (
                      <div key={index} className="group relative inline-flex">
                        <div className="px-2 py-1 bg-blue-100 border border-blue-300 rounded text-xs text-blue-800 flex items-center gap-1">
                          <Upload className="w-3 h-3" />
                          <span>{truncateFilename(file.name, 12)}</span>
                        </div>
                        <button
                          onClick={() => removePendingBulkFile(index)}
                          className="absolute -top-1 -right-1 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700"
                          title="Remove file"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {referenceMedia.length === 0 && pendingBulkFiles.length === 0 && (
                <p className="text-xs text-gray-500">No bulk order media uploaded yet</p>
              )}
            </div>

            {/* Product Price and Production Info - READ-ONLY */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Price
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={((product as any).client_product_price || (product as any).product_price) ? `$${((product as any).client_product_price || (product as any).product_price).toFixed(2)}` : 'Set by manufacturer'}
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

            {/* Shipping Method Selection - PRICES READ-ONLY */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <h5 className="text-sm font-medium text-gray-700 mb-3">Select Shipping Method</h5>
              
              {/* Show if manufacturer has set prices - display CLIENT prices */}
              {(((product as any).client_shipping_air_price || (product as any).shipping_air_price) || 
                ((product as any).client_shipping_boat_price || (product as any).shipping_boat_price)) ? (
                <div className="space-y-3">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name={`shipping-${(product as any).id}`}
                      value="air"
                      checked={(product as any).selected_shipping_method === 'air'}
                      onChange={() => handleShippingMethodChange('air')}
                      disabled={!((product as any).client_shipping_air_price || (product as any).shipping_air_price)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div className="ml-3 flex items-center gap-2">
                      <Plane className="w-4 h-4 text-gray-500" />
                      <span className={`text-sm ${
                        (product as any).selected_shipping_method === 'air' ? 'text-blue-700 font-medium' : 'text-gray-700'
                      }`}>
                        Air - ${((product as any).client_shipping_air_price || (product as any).shipping_air_price || 0).toFixed(2)}
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
                      disabled={!((product as any).client_shipping_boat_price || (product as any).shipping_boat_price)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div className="ml-3 flex items-center gap-2">
                      <Ship className="w-4 h-4 text-gray-500" />
                      <span className={`text-sm ${
                        (product as any).selected_shipping_method === 'boat' ? 'text-blue-700 font-medium' : 'text-gray-700'
                      }`}>
                        Boat - ${((product as any).client_shipping_boat_price || (product as any).shipping_boat_price || 0).toFixed(2)}
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
            
            {/* Save button for Bulk Section */}
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