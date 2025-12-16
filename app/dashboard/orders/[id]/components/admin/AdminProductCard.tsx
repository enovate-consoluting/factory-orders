/**
 * Admin Product Card V2 Component - Clean Header Layout
 * Product card for Admin/Super Admin users with CLIENT pricing
 * V2: Redesigned header with buttons on right, removed Lock button
 * Location: /app/dashboard/orders/[id]/v2/components/AdminProductCardV2.tsx
 * Last Modified: December 2025
 */

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import {
  Package, Clock, Lock, Unlock, Send, CheckCircle,
  Loader2, MessageSquare, Save, DollarSign, Plane, Ship,
  Upload, X, ChevronDown, Edit2, Eye, EyeOff, Link2, AlertCircle,
  FlaskConical, Trash2, Calendar, FolderOpen
} from 'lucide-react';
import { OrderProduct, OrderItem } from '../../types/order.types';
import { ProductStatusBadge } from '../../../shared-components/StatusBadge';
import { CollapsedProductHeader } from '../shared/CollapsedProductHeader';
import { getProductStatusIcon } from '../shared/ProductStatusIcon';
import { FileUploadDisplay } from '../shared/FileUploadDisplay';
import { usePermissions } from '../../hooks/usePermissions';
import { formatCurrency } from '../../../utils/orderCalculations';
import { ACCEPTED_FILE_TYPES } from '@/lib/constants/fileUpload';
import { supabase } from '@/lib/supabase';

interface AdminProductCardProps {
  product: OrderProduct;
  items: OrderItem[];
  media: any[];
  orderStatus: string;
  onUpdate: () => void;
  onRoute?: (product: OrderProduct) => void;
  onViewHistory?: (productId: string) => void;
  onDelete?: (productId: string) => void;
  hasNewHistory?: boolean;
  autoCollapse?: boolean;
  forceExpanded?: boolean;
  onExpand?: () => void;
  translate?: (text: string | null | undefined) => string;
  t?: (key: string) => string;
}

export const AdminProductCardV2 = forwardRef<any, AdminProductCardProps>(
  function AdminProductCardV2({
    product,
    items = [],
    media = [],
    orderStatus,
    onUpdate,
    onRoute,
    onViewHistory,
    onDelete,
    hasNewHistory = false,
    autoCollapse = false,
    forceExpanded = false,
    onExpand,
    translate = (text) => text || '',
    t = (key) => key
  }, ref) {
    const permissions = usePermissions() as any;
    const userRole = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).role : null;
    const canLockProducts = permissions?.canLockProducts || userRole === 'super_admin' || userRole === 'admin';
    const canEditPricing = userRole === 'super_admin';
    
    // Collapsible state
    const [isCollapsed, setIsCollapsed] = useState(() => {
      if (forceExpanded) return false;
      if (autoCollapse) return true;
      const productStatus = (product as any)?.product_status;
      return (productStatus === 'shipped' || productStatus === 'in_transit');
    });
    
    // State for notes
    const [tempNotes, setTempNotes] = useState('');
    const [tempBulkNotes, setTempBulkNotes] = useState('');
    
    // Loading states for save buttons
    const [savingNotes, setSavingNotes] = useState(false);
    const [savingBulkSection, setSavingBulkSection] = useState(false);
    const [savingVariants, setSavingVariants] = useState(false);
    const [savingWaitingForSample, setSavingWaitingForSample] = useState(false);
    
    // State for tracking if sections have changes
    const [notesSectionDirty, setNotesSectionDirty] = useState(false);
    const [bulkSectionDirty, setBulkSectionDirty] = useState(false);
    
    const [processingProduct, setProcessingProduct] = useState(false);
    const bulkFileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingBulkMedia, setUploadingBulkMedia] = useState(false);
    const [showNewHistoryDot, setShowNewHistoryDot] = useState(hasNewHistory);
    
    // State for variant editing
    const [variantNotes, setVariantNotes] = useState<{[key: string]: string}>({});
    const [variantQuantities, setVariantQuantities] = useState<{[key: string]: number}>({});
    const [editingVariants, setEditingVariants] = useState(false);
    const [showAllVariants, setShowAllVariants] = useState(false);
    
    // State for pending file uploads
    const [pendingBulkFiles, setPendingBulkFiles] = useState<File[]>([]);
    
    // Store original values for comparison
    const [originalValues, setOriginalValues] = useState({
      internalNotes: (product as any).internal_notes || '',
      bulkNotes: (product as any).client_notes || ''
    });
    
    // Waiting for sample state
    const isWaitingForSample = (product as any).waiting_for_sample === true;
    const isGrayedOut = isWaitingForSample && userRole !== 'super_admin';
    
    // Calculate total quantity
    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    
    // Initialize variant data from items
    useEffect(() => {
      const initialNotes: {[key: string]: string} = {};
      const initialQuantities: {[key: string]: number} = {};
      items.forEach(item => {
        initialNotes[item.id] = item.notes || '';
        initialQuantities[item.id] = item.quantity || 0;
      });
      setVariantNotes(initialNotes);
      setVariantQuantities(initialQuantities);
    }, [items]);
    
    // Update original values when product changes
    useEffect(() => {
      setOriginalValues({
        internalNotes: (product as any).internal_notes || '',
        bulkNotes: (product as any).client_notes || ''
      });
      setPendingBulkFiles([]);
    }, [product]);
    
    // Auto-collapse when status changes
    useEffect(() => {
      if (forceExpanded) return;
      if (autoCollapse) return;
      const productStatus = (product as any)?.product_status;
      if (productStatus === 'shipped' || productStatus === 'in_transit') {
        setIsCollapsed(true);
      }
    }, [(product as any)?.product_status, autoCollapse, forceExpanded]);

    // Helper function to check if variants have actual changes
    const hasVariantChanges = (): boolean => {
      return items.some(item => {
        const currentNote = variantNotes[item.id] || '';
        const currentQty = variantQuantities[item.id] ?? item.quantity ?? 0;
        const originalNote = item.notes || '';
        const originalQty = item.quantity || 0;
        return currentNote !== originalNote || currentQty !== originalQty;
      });
    };

    // Save variants function that can be called directly
    const saveVariantsIfChanged = async (): Promise<boolean> => {
      if (!hasVariantChanges()) {
        console.log('No variant changes to save for product:', (product as any).id);
        return false;
      }
      
      console.log('Saving variant changes for product:', (product as any).id);
      setSavingVariants(true);
      
      try {
        for (const item of items) {
          const newNote = variantNotes[item.id] || '';
          const newQty = variantQuantities[item.id] ?? item.quantity ?? 0;
          
          if (newNote !== (item.notes || '') || newQty !== (item.quantity || 0)) {
            console.log(`Updating variant ${item.id}: qty=${newQty}, notes="${newNote}"`);
            
            const { error } = await supabase
              .from('order_items')
              .update({ 
                notes: newNote,
                quantity: newQty
              })
              .eq('id', item.id);
              
            if (error) {
              console.error('Error updating variant:', error);
            }
          }
        }
        
        setEditingVariants(false);
        setShowAllVariants(false);
        return true;
      } catch (error) {
        console.error('Error saving variants:', error);
        return false;
      } finally {
        setSavingVariants(false);
      }
    };

    // EXPOSE SAVE FUNCTIONS TO PARENT VIA REF
    useImperativeHandle(ref, () => ({
      saveAll: async () => {
        console.log('SaveAll called for admin product:', (product as any).id);
        let changesMade = false;
        
        // Save notes section if dirty or has content
        if (notesSectionDirty || (tempNotes && tempNotes.trim())) {
          console.log('Saving notes section...');
          await handleSaveNotesSection();
          changesMade = true;
        }
        
        // Save bulk section if dirty or has content/files
        if (bulkSectionDirty || (tempBulkNotes && tempBulkNotes.trim()) || pendingBulkFiles.length > 0) {
          console.log('Saving bulk section...');
          await handleSaveBulkSection();
          changesMade = true;
        }
        
        // Check for actual variant changes
        if (hasVariantChanges()) {
          console.log('Saving variant changes...');
          await saveVariantsIfChanged();
          changesMade = true;
        } else {
          console.log('No variant changes detected');
        }
        
        console.log('SaveAll completed for product:', (product as any).id, 'changesMade:', changesMade);
        return changesMade;
      },
      saveVariants: saveVariantsIfChanged,
      hasChanges: () => {
        return notesSectionDirty || 
               bulkSectionDirty || 
               (tempNotes && tempNotes.trim()) ||
               (tempBulkNotes && tempBulkNotes.trim()) ||
               pendingBulkFiles.length > 0 ||
               hasVariantChanges();
      }
    }), [
      notesSectionDirty,
      bulkSectionDirty,
      tempNotes,
      tempBulkNotes,
      pendingBulkFiles,
      variantNotes,
      variantQuantities,
      items,
      (product as any).id
    ]);
    
    // Calculate prices - ALWAYS use CLIENT prices directly
    const { unitPrice, productPrice, shippingPrice, totalPrice, hasShippingLink } = useMemo(() => {
      const clientUnitPrice = parseFloat((product as any).client_product_price || 0);
      const calculatedProductPrice = clientUnitPrice * totalQuantity;
      
      const hasLink = !!(product as any).shipping_link_note;
      
      let calculatedShippingPrice = 0;
      if (!hasLink) {
        if ((product as any).selected_shipping_method === 'air') {
          calculatedShippingPrice = parseFloat((product as any).client_shipping_air_price || 0);
        } else if ((product as any).selected_shipping_method === 'boat') {
          calculatedShippingPrice = parseFloat((product as any).client_shipping_boat_price || 0);
        }
      }
      
      return {
        unitPrice: clientUnitPrice,
        productPrice: calculatedProductPrice,
        shippingPrice: calculatedShippingPrice,
        totalPrice: calculatedProductPrice + calculatedShippingPrice,
        hasShippingLink: hasLink
      };
    }, [
      (product as any).client_product_price,
      (product as any).client_shipping_air_price,
      (product as any).client_shipping_boat_price,
      (product as any).selected_shipping_method,
      (product as any).shipping_link_note,
      totalQuantity,
      (product as any).id
    ]);

    // Separate media types
    const referenceMedia = media.filter(m => 
      m.file_type === 'document' || 
      m.file_type === 'image' || 
      m.file_type === 'product_sample' ||
      m.file_type === 'order_sample' ||
      m.file_type === 'pdf' ||
      !m.file_type
    );

    // Get variant type name
    const getVariantTypeName = () => {
      if (items.length > 0 && items[0].variant_combo) {
        const combo = items[0].variant_combo.toLowerCase();
        if (combo.includes('small') || combo.includes('medium') || combo.includes('large') || 
            combo.includes('s /') || combo.includes('m /') || combo.includes('l /') ||
            combo.includes('xl') || combo.includes('xxl')) {
          return translate('Size');
        }
        if (combo.includes('shoe')) {
          return translate('Shoe Size');
        }
        if (combo.includes('color') || combo.includes('colour')) {
          return translate('Color');
        }
        return translate('Variant');
      }
      return translate('Variant');
    };

    const displayStatus = (product as any).product_status || 'pending';

    const getCurrentUser = () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        return {
          id: user.id || crypto.randomUUID(),
          name: user.name || user.email || t('unknownUser')
        };
      }
      return {
        id: crypto.randomUUID(),
        name: t('unknownUser')
      };
    };

    // Toggle Waiting for Sample checkbox
    const handleToggleWaitingForSample = async () => {
      setSavingWaitingForSample(true);
      try {
        const newValue = !isWaitingForSample;
        const user = getCurrentUser();
        
        const { error } = await supabase
          .from('order_products')
          .update({ waiting_for_sample: newValue })
          .eq('id', (product as any).id);

        if (error) {
          console.error('Error updating waiting_for_sample:', error);
          alert('Failed to update. Please try again.');
          return;
        }

        // Log to audit
        await supabase.from('audit_log').insert({
          user_id: user.id,
          user_name: user.name,
          action_type: newValue ? 'product_waiting_for_sample' : 'product_sample_wait_cleared',
          target_type: 'order_product',
          target_id: (product as any).id,
          old_value: isWaitingForSample ? 'waiting_for_sample: true' : 'waiting_for_sample: false',
          new_value: newValue ? 'waiting_for_sample: true' : 'waiting_for_sample: false',
          timestamp: new Date().toISOString()
        });

        onUpdate();
      } catch (error) {
        console.error('Error toggling waiting_for_sample:', error);
        alert('Failed to update. Please try again.');
      } finally {
        setSavingWaitingForSample(false);
      }
    };

    // All handler functions
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
      
      setSavingNotes(true);
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

        setOriginalValues(prev => ({ ...prev, internalNotes: tempNotes.trim() }));
        setTempNotes('');
        setNotesSectionDirty(false);
        setShowNewHistoryDot(true);
        
        if (onExpand) onExpand();
        
        await onUpdate();
      } catch (error) {
        console.error('Error saving notes:', error);
        alert('Failed to save note. Please try again.');
      } finally {
        setSavingNotes(false);
      }
    };

    const handleSaveBulkSection = async () => {
      setSavingBulkSection(true);
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
        }

        // Handle file uploads
        if (pendingBulkFiles.length > 0) {
          for (const file of pendingBulkFiles) {
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(2, 8);
            const storagePath = `${(product as any).order_id}/${(product as any).id}/${timestamp}_${randomStr}_${file.name}`;

            const { error: uploadError } = await supabase.storage
              .from('order-media')
              .upload(storagePath, file, {
                cacheControl: '3600',
                upsert: false
              });

            if (uploadError) {
              console.error('Storage upload error:', uploadError);
              alert(`Failed to upload ${file.name}: ${uploadError.message}`);
              continue;
            }

            const { data: { publicUrl } } = supabase.storage
              .from('order-media')
              .getPublicUrl(storagePath);

            await supabase
              .from('order_media')
              .insert({
                order_product_id: (product as any).id,
                file_url: publicUrl,
                file_type: file.type.startsWith('image/') ? 'image' : 'document',
                uploaded_by: user.id,
                original_filename: file.name,
                display_name: file.name
              });
          }
        }

        setOriginalValues(prev => ({ ...prev, bulkNotes: tempBulkNotes.trim() }));
        setTempBulkNotes('');
        setPendingBulkFiles([]);
        setBulkSectionDirty(false);
        setShowNewHistoryDot(true);
        
        if (onExpand) onExpand();
        
        await onUpdate();
      } catch (error) {
        console.error('Error saving bulk section:', error);
        alert('Failed to save bulk section. Please try again.');
      } finally {
        setSavingBulkSection(false);
      }
    };

    const handleShippingMethodChange = async (method: 'air' | 'boat') => {
      try {
        const user = getCurrentUser();
        
        const { error } = await supabase
          .from('order_products')
          .update({ selected_shipping_method: method })
          .eq('id', (product as any).id);

        if (error) {
          console.error('Error updating shipping method:', error);
          alert('Failed to update shipping method. Please try again.');
          return;
        }

        await supabase
          .from('audit_log')
          .insert({
            user_id: user.id,
            user_name: user.name,
            action_type: 'shipping_method_changed',
            target_type: 'order_product',
            target_id: (product as any).id,
            old_value: (product as any).selected_shipping_method || 'none',
            new_value: method,
            timestamp: new Date().toISOString()
          });

        onUpdate();
      } catch (error) {
        console.error('Error updating shipping method:', error);
        alert('Failed to update shipping method. Please try again.');
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

    const handleSaveVariants = async () => {
      const saved = await saveVariantsIfChanged();
      if (saved) {
        await onUpdate();
      }
    };

    const handleExpand = () => {
      setIsCollapsed(false);
      if (onExpand) onExpand();
    };

    const handleCollapse = () => {
      setIsCollapsed(true);
    };

    // Helper functions and variables for new header
    const productName = (product as any).description || (product as any).product?.title || 'Product';
    const clientTotal = totalPrice;
    const hasShipping = hasShippingLink || shippingPrice > 0;
    const hasUnreadMessages = showNewHistoryDot || hasNewHistory;
    const toggleExpanded = () => {
      setIsCollapsed(!isCollapsed);
    };

    const getStatusColor = (status: string): string => {
      const statusColors: Record<string, string> = {
        pending: 'bg-gray-100 text-gray-700',
        in_production: 'bg-blue-100 text-blue-700',
        sample_requested: 'bg-yellow-100 text-yellow-700',
        pending_client_approval: 'bg-purple-100 text-purple-700',
        revision_requested: 'bg-orange-100 text-orange-700',
        completed: 'bg-green-100 text-green-700',
        rejected: 'bg-red-100 text-red-700',
        approved_for_production: 'bg-green-100 text-green-700',
        sent_to_manufacturer: 'bg-purple-100 text-purple-700',
        submitted_to_manufacturer: 'bg-purple-100 text-purple-700',
        client_approved: 'bg-green-100 text-green-700'
      };
      return statusColors[status] || statusColors.pending;
    };

    const formatStatus = (status: string): string => {
      const normalizedStatus = status || 'pending';
      switch(normalizedStatus) {
        case 'pending':
          return t('pendingAdmin');
        case 'in_production':
          return t('inProduction');
        case 'sample_requested':
          return t('sampleRequested');
        case 'pending_client_approval':
          return t('pendingClient');
        case 'revision_requested':
          return t('revisionRequested');
        case 'approved_for_production':
          return t('approvedForProduction');
        case 'completed':
          return t('completed');
        case 'rejected':
          return t('rejected');
        case 'sent_to_manufacturer':
        case 'submitted_to_manufacturer':
          return t('sentToManufacturer');
        case 'client_approved':
          return t('clientApproved') || 'Client Approved';
        default:
          return normalizedStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    };

    // Filter variants for display
    const visibleVariants = showAllVariants || editingVariants 
      ? items 
      : items.filter(item => item.quantity > 0);
    
    const hasHiddenVariants = items.some(item => item.quantity === 0);

    // Use shared CollapsedProductHeader when collapsed
    if (isCollapsed) {
      return (
        <CollapsedProductHeader
          product={product}
          totalQuantity={totalQuantity}
          totalPrice={totalPrice}
          isManufacturerView={false}
          onExpand={handleExpand}
          onViewHistory={handleViewHistory}
          onRoute={onRoute ? () => onRoute(product) : undefined}
          onDelete={onDelete}
          hasNewHistory={showNewHistoryDot}
          userRole={userRole}
          trackingNumber={(product as any).tracking_number}
          translate={translate}
          t={t}
        />
      );
    }

    // MAIN EXPANDED VIEW
    return (
      <div className={`bg-white rounded-lg shadow-lg border overflow-hidden transition-shadow ${
        isGrayedOut 
          ? 'border-amber-300 opacity-60' 
          : 'border-gray-300 hover:shadow-xl'
      }`}>
        {/* HEADER - Tightened layout */}
        <div className="p-2.5 sm:p-3 border-b-2 cursor-pointer bg-gray-50 border-gray-200" onClick={toggleExpanded}>
          {/* Row 1: Product name + status badge + action buttons */}
          <div className="flex items-center justify-between gap-2">
            {/* Left side: Expand arrow + icon + product name + status */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
              {/* Expand/Collapse Arrow */}
              <button
                className="p-0.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                onClick={(e) => { e.stopPropagation(); toggleExpanded(); }}
                title={isCollapsed ? t('expandDetails') : t('collapseDetails')}
              >
                <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
              </button>
              
              {/* Product Icon */}
              <div className="flex-shrink-0">
                {hasUnreadMessages ? (
                  <MessageSquare className="w-4 h-4 text-orange-500" />
                ) : (
                  <FolderOpen className="w-4 h-4 text-gray-400" />
                )}
              </div>
              
              {/* Product Name + Status Badge */}
              <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">{productName}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor((product as any).product_status || 'pending')}`}>
                  {formatStatus((product as any).product_status || 'pending')}
                </span>
              </div>
            </div>
            
            {/* Right side: Action buttons */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {onViewHistory && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleViewHistory(); }}
                  className="px-2 py-1 bg-gray-600 text-white rounded text-xs font-medium flex items-center gap-1 relative"
                  title="History"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>History</span>
                  {hasUnreadMessages && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </button>
              )}
              {(userRole === 'admin' || userRole === 'super_admin') && onRoute && !isGrayedOut && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRoute(product); }}
                  className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium flex items-center gap-1"
                  title="Route"
                >
                  <Send className="w-3 h-3" />
                  <span>Route</span>
                </button>
              )}
              {(userRole === 'admin' || userRole === 'super_admin') && onDelete && !isGrayedOut && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete((product as any).id); }}
                  className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          
          {/* Row 2: Product number + Qty + Price badge | Waiting for Sample - tight spacing */}
          <div className="flex items-center justify-between mt-1 ml-6 sm:ml-7">
            {/* Left: Product number, qty, price */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-xs text-gray-500 font-medium">{(product as any).product_order_number || 'No number'}</span>
              <span className="text-gray-300 text-xs">•</span>
              <span className="text-xs text-gray-500">Qty: <span className="font-semibold text-gray-700">{totalQuantity}</span></span>
              
              {/* Client Price Badge - smaller */}
              <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded ${
                hasShipping ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                <DollarSign className="w-3 h-3" />
                <span>Client: ${formatCurrency(clientTotal)}</span>
                {!hasShipping && <span className="text-red-600">(no ship)</span>}
                {hasShipping && <span className="text-green-600">(+ ship)</span>}
              </div>
            </div>
            
            {/* Right: Waiting for Sample - smaller */}
            {(userRole === 'admin' || userRole === 'super_admin') && (
              <label className="inline-flex items-center gap-1 cursor-pointer px-2 py-0.5 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isWaitingForSample}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleToggleWaitingForSample();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  disabled={savingWaitingForSample}
                  className="w-3 h-3 text-amber-600 border-amber-300 rounded focus:ring-amber-500 cursor-pointer"
                />
                <FlaskConical className="w-3 h-3 text-amber-600" />
                <span className="text-xs font-medium text-amber-800">Waiting for Sample</span>
                {savingWaitingForSample && (
                  <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                )}
              </label>
            )}
          </div>
        </div>

        {/* BODY - White background, all the content */}
        <div className={`${isGrayedOut && userRole !== 'super_admin' ? 'pointer-events-none' : ''}`}>
          {/* Keep ALL existing Bulk Order Information section and everything below EXACTLY as is */}
          
          {(!isGrayedOut || userRole === 'super_admin') && (
            <div className="p-3 sm:p-4">
              {/* Bulk Order Information */}
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Package className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>{t('bulkOrderInformation')}</span>
              </h4>

              {/* Show shipping link note if this product's shipping is linked */}
              {(product as any).shipping_link_note && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-300 rounded-lg flex items-start gap-2">
                  <Link2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <span className="font-medium">{t('shippingInfo')}:</span> {(product as any).shipping_link_note}
                  </div>
                </div>
              )}

              {/* Bulk Order Notes */}
              <div className="mb-4 p-2 sm:p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h5 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">{t('bulkOrderNotes')}</h5>

                {(product as any).client_notes && (
                  <div className="mb-2 p-2 bg-blue-50 rounded text-xs sm:text-sm text-blue-700">
                    <strong>{t('currentNote')}:</strong>
                    <div className="whitespace-pre-wrap mt-1">{(product as any).client_notes}</div>
                  </div>
                )}

                <textarea
                  value={tempBulkNotes}
                  onChange={(e) => {
                    setTempBulkNotes(e.target.value);
                    setBulkSectionDirty(true);
                  }}
                  placeholder={t('addBulkOrderInstructions')}
                  rows={3}
                  className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium text-xs sm:text-sm placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Bulk Order Media */}
              <input
                ref={bulkFileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleBulkFileUpload}
                className="hidden"
              />
              
              <FileUploadDisplay
                files={referenceMedia}
                pendingFiles={pendingBulkFiles}
                onFileClick={handleFileClick}
                onDeleteFile={handleDeleteMedia}
                onRemovePending={removePendingBulkFile}
                onAddFiles={() => bulkFileInputRef.current?.click()}
                title={t('bulkOrderMedia')}
                loading={uploadingBulkMedia}
                translate={translate}
                t={t}
              />

              {/* Product Price and Production Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    {t('clientPricePerUnit')}
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                    <input
                      type="text"
                      value={unitPrice > 0 ? `$${formatCurrency(unitPrice)}` : t('notSet')}
                      disabled={true}
                      className="w-full pl-7 sm:pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    {t('productionTime')}
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                    <input
                      type="text"
                      value={(product as any).production_time || t('notSet')}
                      disabled={true}
                      className="w-full pl-7 sm:pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    ETA
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                    <input
                      type="text"
                      value={(product as any).estimated_completion 
                        ? new Date((product as any).estimated_completion).toLocaleDateString()
                        : t('notSet')}
                      disabled={true}
                      className="w-full pl-7 sm:pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 text-xs sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Method Selection */}
              <div className="mb-4 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border-2 border-blue-300">
                <h5 className="text-xs sm:text-sm font-semibold text-gray-800 mb-3">
                  {t('selectShippingMethodClientPrices')}
                </h5>
                
                {hasShippingLink ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-100 border border-blue-400 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Link2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-blue-800 mb-1">
                            {t('shippingIncluded')}
                          </p>
                          <p className="text-xs text-blue-700">
                            {(product as any).shipping_link_note}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : ((product as any).client_shipping_air_price || (product as any).client_shipping_boat_price) ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                    {/* Air Shipping Option */}
                    <label className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 border-2 rounded-lg transition-all cursor-pointer ${
                      (product as any).selected_shipping_method === 'air'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-blue-50'
                    } ${!(product as any).client_shipping_air_price ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input
                        type="radio"
                        name={`shipping-${(product as any).id}`}
                        value="air"
                        checked={(product as any).selected_shipping_method === 'air'}
                        onChange={() => handleShippingMethodChange('air')}
                        disabled={!(product as any).client_shipping_air_price}
                        className="w-4 h-4 text-blue-600 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Plane className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                          <span className="font-medium text-sm sm:text-base text-gray-900">{t('airShipping')}</span>
                        </div>
                        {(product as any).client_shipping_air_price ? (
                          <div className="mt-1">
                            <span className="text-xs sm:text-sm text-gray-600 font-semibold">
                              ${formatCurrency((product as any).client_shipping_air_price || 0)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">{t('notPricedYet')}</span>
                        )}
                      </div>
                    </label>

                    {/* Boat Shipping Option */}
                    <label className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 border-2 rounded-lg transition-all cursor-pointer ${
                      (product as any).selected_shipping_method === 'boat'
                        ? 'border-cyan-500 bg-cyan-50'
                        : 'border-gray-200 hover:bg-cyan-50'
                    } ${!(product as any).client_shipping_boat_price ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input
                        type="radio"
                        name={`shipping-${(product as any).id}`}
                        value="boat"
                        checked={(product as any).selected_shipping_method === 'boat'}
                        onChange={() => handleShippingMethodChange('boat')}
                        disabled={!(product as any).client_shipping_boat_price}
                        className="w-4 h-4 text-cyan-600 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Ship className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600 flex-shrink-0" />
                          <span className="font-medium text-sm sm:text-base text-gray-900">{t('boatShipping')}</span>
                        </div>
                        {(product as any).client_shipping_boat_price ? (
                          <div className="mt-1">
                            <span className="text-xs sm:text-sm text-gray-600 font-semibold">
                              ${formatCurrency((product as any).client_shipping_boat_price || 0)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">{t('notPricedYet')}</span>
                        )}
                      </div>
                    </label>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">{t('shippingPricesNotSet')}</p>
                )}
                
                {!hasShippingLink && (product as any).selected_shipping_method && (
                  <div className="mt-4 p-3 bg-white rounded-lg border-2 border-green-400 shadow-sm">
                    <p className="text-sm font-medium text-green-800 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      {t('selected')}: {(product as any).selected_shipping_method === 'air' ? t('airShipping') : t('boatShipping')} 
                      - ${formatCurrency((product as any).selected_shipping_method === 'air' 
                        ? ((product as any).client_shipping_air_price || 0)
                        : ((product as any).client_shipping_boat_price || 0))}
                    </p>
                  </div>
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
                    disabled={savingBulkSection}
                    className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={handleSaveBulkSection}
                    disabled={savingBulkSection}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50"
                  >
                    {savingBulkSection ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {t('saving')}
                      </>
                    ) : (
                      <>
                        <Save className="w-3 h-3" />
                        {t('saveBulkSection')}
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Variant Details */}
              <div className="mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <h5 className="text-sm font-semibold text-gray-800">
                    {getVariantTypeName()} {t('details')}
                    {!showAllVariants && hasHiddenVariants && !editingVariants && (
                      <span className="ml-2 text-xs text-gray-500 font-normal">
                        ({t('showing')} {visibleVariants.length} {t('of')} {items.length})
                      </span>
                    )}
                  </h5>
                  <div className="flex items-center gap-2">
                    {!editingVariants && hasHiddenVariants && (
                      <button
                        onClick={() => setShowAllVariants(!showAllVariants)}
                        className="flex-1 sm:flex-initial px-3 py-2 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                      >
                        {showAllVariants ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>{t('hideEmpty')}</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>{t('showAll')}</span>
                          </>
                        )}
                      </button>
                    )}
                    {!editingVariants ? (
                      <button
                        onClick={() => {
                          setEditingVariants(true);
                          setShowAllVariants(true);
                        }}
                        className="flex-1 sm:flex-initial px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 border border-blue-600 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>{t('edit')}</span>
                      </button>
                    ) : null}
                  </div>
                </div>
                
                {/* Mobile Card Layout */}
                <div className="sm:hidden space-y-2">
                  {visibleVariants.map((item, index) => (
                    <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 mb-0.5">{getVariantTypeName()}</p>
                          <p className="text-sm font-semibold text-gray-900 break-words">
                            {translate(item.variant_combo)}
                          </p>
                        </div>
                        <div className="ml-2 text-right flex-shrink-0">
                          <p className="text-xs text-gray-500 mb-0.5">{t('qty')}</p>
                          {editingVariants ? (
                            <input
                              type="number"
                              value={variantQuantities[item.id] || 0}
                              onChange={(e) => {
                                setVariantQuantities(prev => ({
                                  ...prev,
                                  [item.id]: parseInt(e.target.value) || 0
                                }));
                              }}
                              className="w-20 px-2 py-1 text-sm text-gray-900 font-semibold text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              min="0"
                              max="999999"
                            />
                          ) : (
                            <span className="text-sm font-semibold text-gray-900">{item.quantity}</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">{t('notes')}</label>
                        <textarea
                          value={variantNotes[item.id] || ''}
                          onChange={(e) => {
                            setVariantNotes(prev => ({
                              ...prev,
                              [item.id]: e.target.value
                            }));
                            if (!editingVariants) setEditingVariants(true);
                          }}
                          placeholder={t('addNote')}
                          disabled={!editingVariants}
                          rows={2}
                          className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600 resize-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Desktop Table Layout */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-700" style={{width: '30%'}}>
                          {getVariantTypeName()}
                        </th>
                        <th className="text-left py-2 px-1 text-sm font-medium text-gray-700" style={{width: '20%'}}>
                          {t('qty')}
                        </th>
                        <th className="text-left py-2 pl-2 pr-3 text-sm font-medium text-gray-700" style={{width: '50%'}}>
                          {t('notes')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleVariants.map((item, index) => (
                        <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                          <td className="py-2 px-3 text-sm text-gray-900 font-medium">
                            {translate(item.variant_combo)}
                          </td>
                          <td className="py-2 px-1">
                            {editingVariants ? (
                              <input
                                type="number"
                                value={variantQuantities[item.id] || 0}
                                onChange={(e) => {
                                  setVariantQuantities(prev => ({
                                    ...prev,
                                    [item.id]: parseInt(e.target.value) || 0
                                  }));
                                }}
                                className="w-24 px-2 py-1 text-sm text-gray-900 font-medium border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                min="0"
                                max="999999"
                              />
                            ) : (
                              <span className="text-sm font-medium text-gray-900">{item.quantity}</span>
                            )}
                          </td>
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
                              placeholder={t('addNote')}
                              disabled={!editingVariants}
                              className="w-full px-2 py-1 text-sm text-gray-900 font-medium border border-gray-300 rounded placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-700"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {editingVariants && (
                  <div className="mt-3 grid grid-cols-2 sm:flex sm:justify-end gap-2">
                    <button
                      onClick={() => {
                        const originalNotes: {[key: string]: string} = {};
                        const originalQtys: {[key: string]: number} = {};
                        items.forEach(item => {
                          originalNotes[item.id] = item.notes || '';
                          originalQtys[item.id] = item.quantity || 0;
                        });
                        setVariantNotes(originalNotes);
                        setVariantQuantities(originalQtys);
                        setEditingVariants(false);
                        setShowAllVariants(false);
                      }}
                      disabled={savingVariants}
                      className="px-4 py-2.5 sm:py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      <span>{t('cancel')}</span>
                    </button>
                    <button
                      onClick={handleSaveVariants}
                      disabled={savingVariants}
                      className="px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                    >
                      {savingVariants ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{t('saving')}</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>{t('saveVariants')}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

