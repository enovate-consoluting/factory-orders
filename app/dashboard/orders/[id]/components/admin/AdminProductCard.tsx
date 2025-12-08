/**
 * Admin Product Card Component - WITH WAITING FOR SAMPLE
 * Product card for Admin/Super Admin users with CLIENT pricing
 * ADDED: "Waiting for Sample" checkbox - grays out card when checked
 * ADDED: Auto-unchecks when sample ships (via database trigger)
 * Last Modified: December 2025
 */

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import {
  Package, Clock, Lock, Unlock, Send, CheckCircle,
  Loader2, MessageSquare, Save, DollarSign, Plane, Ship,
  Upload, X, ChevronDown, Edit2, Eye, EyeOff, Link2, AlertCircle,
  FlaskConical
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

export const AdminProductCard = forwardRef<any, AdminProductCardProps>(
  function AdminProductCard({
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
        {/* Product Header */}
        <div className={`p-3 sm:p-4 border-b-2 ${
          isGrayedOut ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 sm:gap-3">
              {/* Collapse Button */}
              {autoCollapse && (
                <button
                  onClick={handleCollapse}
                  className="p-1 hover:bg-gray-200 rounded transition-colors mt-1 flex-shrink-0"
                  title={t('collapseDetails')}
                >
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                </button>
              )}
              {getProductStatusIcon(displayStatus)}
              <div className="flex-1 min-w-0">
                {/* Title and Status Badge */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className={`font-semibold text-base sm:text-lg truncate flex-1 min-w-0 ${
                    isGrayedOut ? 'text-gray-500' : 'text-gray-900'
                  }`}>
                    {(product as any).description || (product as any).product?.title || 'Product'}
                  </h3>
                  <div className="flex items-center gap-1">
                    <ProductStatusBadge status={displayStatus} translate={translate} t={t} />
                    {(product as any).payment_status === 'paid' && (
                      <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        <span className="hidden sm:inline">Paid</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* WAITING FOR SAMPLE CHECKBOX - Admin/Super Admin only */}
                {(userRole === 'admin' || userRole === 'super_admin') && (
                  <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isWaitingForSample}
                        onChange={handleToggleWaitingForSample}
                        disabled={savingWaitingForSample}
                        className="w-5 h-5 text-amber-600 border-amber-300 rounded focus:ring-amber-500 cursor-pointer"
                      />
                      <div className="flex items-center gap-2">
                        <FlaskConical className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-800">
                          Waiting for Sample
                        </span>
                        {savingWaitingForSample && (
                          <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                        )}
                      </div>
                    </label>
                    {isWaitingForSample && (
                      <p className="mt-1.5 ml-8 text-xs text-amber-600">
                        This product is on hold until sample ships. Card is grayed out for non-admins.
                      </p>
                    )}
                  </div>
                )}

                {/* Waiting for Sample Badge (shown when not admin/super_admin) */}
                {isWaitingForSample && userRole !== 'admin' && userRole !== 'super_admin' && (
                  <div className="mb-3 p-2.5 bg-amber-100 border border-amber-300 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800">
                        ⏳ Waiting for Sample - Product on hold
                      </span>
                    </div>
                  </div>
                )}

                {/* CLIENT TOTAL BADGE */}
                {totalPrice > 0 && (
                  <div className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-1 text-xs sm:text-sm font-semibold rounded-lg mb-2 ${
                    shippingPrice > 0 || hasShippingLink
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="whitespace-nowrap">Client: ${formatCurrency(totalPrice)}</span>
                    {shippingPrice > 0 || hasShippingLink ? (
                      <span className="hidden sm:inline text-green-600">(+ shipping)</span>
                    ) : (
                      <span className="hidden sm:inline text-red-600">(no ship)</span>
                    )}
                  </div>
                )}

                {(product as any).description && (product as any).product?.title && (
                  <p className="text-xs sm:text-sm text-gray-600 mb-2">{(product as any).product?.title}</p>
                )}

                {/* Product Info Row */}
                <div className="flex items-center gap-2 sm:gap-4 text-xs text-gray-500">
                  <span className="font-medium">{(product as any).product_order_number}</span>
                  <span className="hidden sm:inline">•</span>
                  <span>{t('qty')}: <span className="font-semibold text-gray-700">{totalQuantity}</span></span>
                </div>
              </div>
            </div>

            {/* Status Dropdown - Super Admin Only */}
            <div className={`flex flex-col sm:flex-row gap-2 ${isGrayedOut ? 'pointer-events-none' : ''}`}>
              {userRole === 'super_admin' && (
                <select
                  value={displayStatus}
                  onChange={(e) => handleProductStatusChange(e.target.value)}
                  className="flex-1 px-2 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="pending">{t('pending')}</option>
                  <option value="sample_requested">{t('sampleRequested')}</option>
                  <option value="sent_to_manufacturer">{t('sentToManufacturer')}</option>
                  <option value="pending_admin">{t('pendingAdmin')}</option>
                  <option value="approved_for_production">{t('approvedForProduction')}</option>
                  <option value="in_production">{t('inProduction')}</option>
                  <option value="pending_client_approval">{t('pendingClient')}</option>
                  <option value="revision_requested">{t('revisionRequested')}</option>
                  <option value="completed">{t('completed')}</option>
                  <option value="rejected">{t('rejected')}</option>
                  <option value="shipped">{t('shipped')}</option>
                  <option value="in_transit">{t('inTransit')}</option>
                </select>
              )}

              {/* Lock/Unlock button */}
              {canLockProducts && !isGrayedOut && (
                <button
                  onClick={handleToggleLock}
                  disabled={processingProduct}
                  className={`px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    (product as any).is_locked
                      ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                      : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                  } disabled:opacity-50 whitespace-nowrap`}
                  title={(product as any).is_locked ? 'Unlock for editing' : 'Lock for production'}
                >
                  {processingProduct ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (product as any).is_locked ? (
                    <>
                      <Lock className="w-4 h-4" />
                      <span className="text-sm font-medium">{t('unlock')}</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span className="text-sm font-medium">{t('lock')}</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className={`grid grid-cols-2 sm:flex gap-2 ${isGrayedOut ? 'pointer-events-none' : ''}`}>
              {onViewHistory && (
                <button
                  onClick={handleViewHistory}
                  className="px-3 py-2 sm:py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 relative"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{t('history')}</span>
                  {showNewHistoryDot && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  )}
                </button>
              )}

              {(userRole === 'admin' || userRole === 'super_admin') && onRoute && !isGrayedOut && (
                <button
                  onClick={() => onRoute(product)}
                  className="px-3 py-2 sm:py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{t('route')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Bulk Order Information - only show if not grayed out or super admin */}
          {(!isGrayedOut || userRole === 'super_admin') && (
            <div className="mt-3 bg-white rounded-lg border border-gray-300 p-3 sm:p-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4">
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