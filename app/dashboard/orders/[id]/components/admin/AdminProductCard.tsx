/**
 * Admin Product Card Component
 * Product card for Admin/Super Admin users with client pricing
 * Uses shared components for collapsed view and file display
 * Last Modified: November 2024
 */

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { 
  Package, Clock, Lock, Unlock, Send, CheckCircle, 
  Loader2, MessageSquare, Save, DollarSign, Plane, Ship, 
  Upload, X, ChevronDown
} from 'lucide-react';
import { OrderProduct, OrderItem } from '../../types/order.types';
import { ProductStatusBadge } from '../../../shared-components/StatusBadge';
import { CollapsedProductHeader } from '../shared/CollapsedProductHeader';
import { getProductStatusIcon } from '../shared/ProductStatusIcon';
import { FileUploadDisplay } from '../shared/FileUploadDisplay';
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
  autoCollapse?: boolean;
  forceExpanded?: boolean;
  onExpand?: () => void;
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
    autoCollapse = false,
    forceExpanded = false,
    onExpand
  }, ref) {
    const permissions = usePermissions() as any;
    const userRole = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).role : null;
    const canLockProducts = permissions?.canLockProducts || userRole === 'super_admin' || userRole === 'admin';
    const canEditPricing = userRole === 'super_admin';
    
    // State for finance margins
    const [productMargin, setProductMargin] = useState(80);
    const [shippingMargin, setShippingMargin] = useState(5);
    const [marginsLoaded, setMarginsLoaded] = useState(false);
    
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
    const [savingVariantNotes, setSavingVariantNotes] = useState(false);
    
    // State for tracking if sections have changes
    const [notesSectionDirty, setNotesSectionDirty] = useState(false);
    const [bulkSectionDirty, setBulkSectionDirty] = useState(false);
    
    const [processingProduct, setProcessingProduct] = useState(false);
    const bulkFileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingBulkMedia, setUploadingBulkMedia] = useState(false);
    const [showNewHistoryDot, setShowNewHistoryDot] = useState(hasNewHistory);
    
    // State for variant notes
    const [variantNotes, setVariantNotes] = useState<{[key: string]: string}>({});
    const [editingVariants, setEditingVariants] = useState(false);
    
    // State for pending file uploads
    const [pendingBulkFiles, setPendingBulkFiles] = useState<File[]>([]);
    
    // Store original values for comparison
    const [originalValues, setOriginalValues] = useState({
      internalNotes: (product as any).internal_notes || '',
      bulkNotes: (product as any).client_notes || ''
    });
    
    // Calculate total quantity
    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    
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
          setMarginsLoaded(true);
        }
      };
      loadMargins();
    }, []);
    
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

    // EXPOSE SAVE FUNCTIONS TO PARENT VIA REF
    useImperativeHandle(ref, () => ({
      saveAll: async () => {
        console.log('SaveAll called for admin product:', (product as any).id);
        let changesMade = false;
        
        if (notesSectionDirty || tempNotes) {
          await handleSaveNotesSection();
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
      bulkSectionDirty,
      editingVariants,
      tempNotes,
      tempBulkNotes,
      pendingBulkFiles,
      (product as any).id
    ]);
    
    // Calculate with DYNAMIC margins for admins
    const calculateClientPrice = (manufacturerPrice: number, isShipping: boolean = false) => {
      if (!manufacturerPrice || manufacturerPrice === 0) return 0;
      const margin = isShipping ? shippingMargin : productMargin;
      return manufacturerPrice * (1 + margin / 100);
    };
    
    // Calculate totals - ALWAYS use client prices for admin/super_admin
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
    
    const totalPrice = productPrice + shippingPrice;

    // Separate media types
    const referenceMedia = media.filter(m => m.file_type === 'document' || m.file_type === 'image');

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

    const displayStatus = (product as any).product_status || 'pending';

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

        // NO FILE RENAMING - Keep original filenames
        if (pendingBulkFiles.length > 0) {
          console.log('Starting bulk file uploads...', pendingBulkFiles.length, 'files');

          for (const file of pendingBulkFiles) {
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(2, 8);
            const storagePath = `${(product as any).order_id}/${(product as any).id}/${timestamp}_${randomStr}_${file.name}`;

            console.log('Uploading file to storage:', storagePath);
            const { data: uploadData, error: uploadError } = await supabase.storage
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
            console.log('File uploaded successfully:', uploadData);

            const { data: { publicUrl } } = supabase.storage
              .from('order-media')
              .getPublicUrl(storagePath);

            // KEEP ORIGINAL FILENAME IN DATABASE
            const { data: insertData, error: insertError } = await supabase
              .from('order_media')
              .insert({
                order_product_id: (product as any).id,
                file_url: publicUrl,
                file_type: file.type.startsWith('image/') ? 'image' : 'document',
                uploaded_by: user.id,
                original_filename: file.name,
                display_name: file.name
              })
              .select();

            if (insertError) {
              console.error('Database insert error:', insertError);
              alert(`Failed to save ${file.name} to database: ${insertError.message}`);
            } else {
              console.log('File saved to database with original name:', file.name);
            }
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

    const handleSaveVariantNotes = async () => {
      setSavingVariantNotes(true);
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
      } finally {
        setSavingVariantNotes(false);
      }
    };

    // Handle expand/collapse with onExpand callback
    const handleExpand = () => {
      setIsCollapsed(false);
      if (onExpand) onExpand();
    };

    const handleCollapse = () => {
      setIsCollapsed(true);
    };

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
          onToggleLock={handleToggleLock}
          isLocked={(product as any).is_locked}
          processingLock={processingProduct}
          hasNewHistory={showNewHistoryDot}
          userRole={userRole}
          trackingNumber={(product as any).tracking_number}
        />
      );
    }

    // MAIN EXPANDED VIEW
    return (
      <div className="bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden hover:shadow-xl transition-shadow">
        {/* Product Header */}
        <div className="p-4 bg-gray-50 border-b-2 border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              {/* Collapse Button */}
              {autoCollapse && (
                <button
                  onClick={handleCollapse}
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
                  
                  {/* GREEN TOTAL BADGE */}
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
                  <MessageSquare className="w-4 h-4" />
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
                    disabled={savingNotes}
                    className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNotesSection}
                    disabled={savingNotes}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50"
                  >
                    {savingNotes ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-3 h-3" />
                        Save Notes
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bulk Order Information */}
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

            {/* Bulk Order Media - Using Shared Component */}
            <input
              ref={bulkFileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*,video/*"
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
              title="Bulk Order Media"
              loading={uploadingBulkMedia}
            />

            {/* Product Price and Production Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Price {!canEditPricing && '(Client Price)'}
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={unitPrice > 0 ? `$${unitPrice.toFixed(2)}` : 'Set by manufacturer'}
                    disabled={true}
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
                    disabled={true}
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                  />
                </div>
              </div>
            </div>

            {/* Shipping Method Selection */}
            <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border-2 border-blue-300">
              <h5 className="text-sm font-semibold text-gray-800 mb-3">
                Select Shipping Method {!canEditPricing && '(Client Prices)'}
              </h5>
              
              {((product as any).shipping_air_price || (product as any).shipping_boat_price) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Air Shipping Option */}
                  <div className="space-y-3">
                    <label className={`flex items-center gap-3 p-3 border-2 rounded-lg transition-all cursor-pointer ${
                      (product as any).selected_shipping_method === 'air' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:bg-blue-50'
                    } ${!(product as any).shipping_air_price ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input
                        type="radio"
                        name={`shipping-${(product as any).id}`}
                        value="air"
                        checked={(product as any).selected_shipping_method === 'air'}
                        onChange={() => handleShippingMethodChange('air')}
                        disabled={!(product as any).shipping_air_price}
                        className="w-4 h-4 text-blue-600"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Plane className="w-5 h-5 text-blue-600" />
                          <span className="font-medium text-gray-900">Air Shipping</span>
                        </div>
                        {(product as any).shipping_air_price ? (
                          <div className="mt-1">
                            <span className="text-sm text-gray-600">
                              ${calculateClientPrice((product as any).shipping_air_price || 0, true).toFixed(2)}
                            </span>
                            {(product as any).shipping_air_days && (
                              <span className="text-xs text-gray-500 ml-2">
                                ({(product as any).shipping_air_days} days)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Not priced yet</span>
                        )}
                      </div>
                    </label>
                  </div>

                  {/* Boat Shipping Option */}
                  <div className="space-y-3">
                    <label className={`flex items-center gap-3 p-3 border-2 rounded-lg transition-all cursor-pointer ${
                      (product as any).selected_shipping_method === 'boat' 
                        ? 'border-cyan-500 bg-cyan-50' 
                        : 'border-gray-200 hover:bg-cyan-50'
                    } ${!(product as any).shipping_boat_price ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input
                        type="radio"
                        name={`shipping-${(product as any).id}`}
                        value="boat"
                        checked={(product as any).selected_shipping_method === 'boat'}
                        onChange={() => handleShippingMethodChange('boat')}
                        disabled={!(product as any).shipping_boat_price}
                        className="w-4 h-4 text-cyan-600"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Ship className="w-5 h-5 text-cyan-600" />
                          <span className="font-medium text-gray-900">Boat Shipping</span>
                        </div>
                        {(product as any).shipping_boat_price ? (
                          <div className="mt-1">
                            <span className="text-sm text-gray-600">
                              ${calculateClientPrice((product as any).shipping_boat_price || 0, true).toFixed(2)}
                            </span>
                            {(product as any).shipping_boat_days && (
                              <span className="text-xs text-gray-500 ml-2">
                                ({(product as any).shipping_boat_days} days)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Not priced yet</span>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Shipping prices not yet set by manufacturer</p>
              )}
              
              {/* Show selected shipping badge */}
              {(product as any).selected_shipping_method && (
                <div className="mt-4 p-3 bg-white rounded-lg border-2 border-green-400 shadow-sm">
                  <p className="text-sm font-medium text-green-800 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Selected: {(product as any).selected_shipping_method === 'air' ? 'Air' : 'Boat'} Shipping 
                    - ${(product as any).selected_shipping_method === 'air' 
                      ? calculateClientPrice((product as any).shipping_air_price || 0, true).toFixed(2)
                      : calculateClientPrice((product as any).shipping_boat_price || 0, true).toFixed(2)}
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
                  Cancel
                </button>
                <button
                  onClick={handleSaveBulkSection}
                  disabled={savingBulkSection}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50"
                >
                  {savingBulkSection ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-3 h-3" />
                      Save Bulk Section
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Variant Details Table - Keep inline since it's specific to each card */}
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
                    disabled={savingVariantNotes}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveVariantNotes}
                    disabled={savingVariantNotes}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50"
                  >
                    {savingVariantNotes ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-3 h-3" />
                        Save Variant Notes
                      </>
                    )}
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