// ManufacturerProductCard.tsx - FULLY FIXED - All TypeScript errors resolved

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { 
  Package, Calendar, Clock, Lock, Unlock, Send, CheckCircle, 
  XCircle, Loader2, MessageSquare, Save, History, AlertCircle,
  DollarSign, CreditCard, Plane, Ship, Upload, X, Play, File,
  RotateCcw, FileText, Image, Paperclip, ChevronDown, ChevronRight
} from 'lucide-react';
import { OrderProduct, OrderItem } from '../../types/order.types';
import { ProductStatusBadge } from '../shared/StatusBadge';
import { usePermissions } from '../../hooks/usePermissions';
import { supabase } from '@/lib/supabase';

interface ManufacturerProductCardProps {
  product: OrderProduct;
  items: OrderItem[];
  media: any[];
  orderStatus: string;
  onUpdate: () => void;
  onRoute?: (product: OrderProduct) => void;
  onViewHistory?: (productId: string) => void;
  hasNewHistory?: boolean;
  manufacturerId?: string | null;
}

// Define the ref type for imperative handle
export interface ManufacturerProductCardRef {
  saveAll: () => Promise<boolean>;
}

export const ManufacturerProductCard = forwardRef<ManufacturerProductCardRef, ManufacturerProductCardProps>(
  function ManufacturerProductCard({ 
    product, 
    items = [],
    media = [],
    orderStatus,
    onUpdate,
    onRoute,
    onViewHistory,
    hasNewHistory = false,
    manufacturerId
  }, ref) {
    const permissions = usePermissions() as any;
    const userRole = 'manufacturer';
    
    // COLLAPSIBLE STATE - Each card manages its own state independently
    const [isCollapsed, setIsCollapsed] = useState(
      (product as any).product_status === 'in_production' || (product as any).is_locked
    );
    
    // Auto-collapse when status changes to in_production
    useEffect(() => {
      if ((product as any).product_status === 'in_production' || (product as any).is_locked) {
        setIsCollapsed(true);
      }
    }, [(product as any).product_status, (product as any).is_locked]);
    
    // State for notes
    const [tempNotes, setTempNotes] = useState('');
    const [tempSampleNotes, setTempSampleNotes] = useState('');
    const [tempBulkNotes, setTempBulkNotes] = useState('');
    
    // State for tracking if sections have changes
    const [sampleSectionDirty, setSampleSectionDirty] = useState(false);
    const [bulkSectionDirty, setBulkSectionDirty] = useState(false);
    
    const [processingProduct, setProcessingProduct] = useState(false);
    const bulkFileInputRef = useRef<HTMLInputElement>(null);
    const sampleFileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [uploadingBulkMedia, setUploadingBulkMedia] = useState(false);
    const [showNewHistoryDot, setShowNewHistoryDot] = useState(hasNewHistory);
    
    // State for variant notes
    const [variantNotes, setVariantNotes] = useState<{[key: string]: string}>({});
    const [editingVariants, setEditingVariants] = useState(false);
    
    // State for sample section - convert to strings for inputs
    const [sampleFee, setSampleFee] = useState((product as any).sample_fee?.toString() || '');
    const [sampleEta, setSampleEta] = useState((product as any).sample_eta || '');
    const [sampleStatus, setSampleStatus] = useState((product as any).sample_status || 'pending');
    
    // State for bulk section - convert to strings for inputs
    const [productPrice, setProductPrice] = useState((product as any).product_price?.toString() || '');
    const [productionTime, setProductionTime] = useState((product as any).production_time || '');
    
    // State for shipping prices - convert to strings for inputs
    const [shippingAirPrice, setShippingAirPrice] = useState((product as any).shipping_air_price?.toString() || '');
    const [shippingBoatPrice, setShippingBoatPrice] = useState((product as any).shipping_boat_price?.toString() || '');
    
    // State for pending file uploads
    const [pendingSampleFiles, setPendingSampleFiles] = useState<File[]>([]);
    const [pendingBulkFiles, setPendingBulkFiles] = useState<File[]>([]);
    
    // Store original values for comparison
    const [originalValues, setOriginalValues] = useState({
      sampleFee: (product as any).sample_fee?.toString() || '',
      sampleEta: (product as any).sample_eta || '',
      sampleStatus: (product as any).sample_status || 'pending',
      sampleNotes: (product as any).sample_notes || '',
      productPrice: (product as any).product_price?.toString() || '',
      productionTime: (product as any).production_time || '',
      bulkNotes: (product as any).client_notes || '',
      shippingAirPrice: (product as any).shipping_air_price?.toString() || '',
      shippingBoatPrice: (product as any).shipping_boat_price?.toString() || ''
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
        sampleFee: (product as any).sample_fee?.toString() || '',
        sampleEta: (product as any).sample_eta || '',
        sampleStatus: (product as any).sample_status || 'pending',
        sampleNotes: (product as any).sample_notes || '',
        productPrice: (product as any).product_price?.toString() || '',
        productionTime: (product as any).production_time || '',
        bulkNotes: (product as any).client_notes || '',
        shippingAirPrice: (product as any).shipping_air_price?.toString() || '',
        shippingBoatPrice: (product as any).shipping_boat_price?.toString() || ''
      });
      setSampleFee((product as any).sample_fee?.toString() || '');
      setSampleEta((product as any).sample_eta || '');
      setSampleStatus((product as any).sample_status || 'pending');
      setProductPrice((product as any).product_price?.toString() || '');
      setProductionTime((product as any).production_time || '');
      setShippingAirPrice((product as any).shipping_air_price?.toString() || '');
      setShippingBoatPrice((product as any).shipping_boat_price?.toString() || '');
      setPendingSampleFiles([]);
      setPendingBulkFiles([]);
    }, [product]);

    // EXPOSE SAVE FUNCTIONS TO PARENT VIA REF
    useImperativeHandle(ref, () => ({
      saveAll: async () => {
        console.log('SaveAll called for product:', (product as any).id);
        let changesMade = false;
        
        // Check if sample section has any changes (not just dirty flag)
        const hasSampleChanges = 
          sampleSectionDirty || 
          sampleFee !== originalValues.sampleFee || 
          sampleEta !== originalValues.sampleEta || 
          sampleStatus !== originalValues.sampleStatus ||
          (tempSampleNotes && tempSampleNotes.trim() !== '') || 
          pendingSampleFiles.length > 0;
          
        if (hasSampleChanges) {
          console.log('Saving sample section...');
          await handleSaveSampleSection();
          changesMade = true;
        }
        
        // Check if bulk section has any changes
        const hasBulkChanges = 
          bulkSectionDirty || 
          productPrice !== originalValues.productPrice || 
          productionTime !== originalValues.productionTime ||
          shippingAirPrice !== originalValues.shippingAirPrice ||
          shippingBoatPrice !== originalValues.shippingBoatPrice ||
          (tempBulkNotes && tempBulkNotes.trim() !== '') || 
          pendingBulkFiles.length > 0;
          
        if (hasBulkChanges) {
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
        
        // Save generic notes if any
        if (tempNotes && tempNotes.trim() !== '') {
          console.log('Saving generic notes...');
          await handleSaveGenericNotes();
          changesMade = true;
        }
        
        console.log('SaveAll complete for product:', (product as any).id, 'Changes made:', changesMade);
        return changesMade;
      }
    }), [
      // Add all dependencies
      sampleSectionDirty,
      bulkSectionDirty,
      editingVariants,
      tempNotes,
      tempSampleNotes,
      tempBulkNotes,
      sampleFee,
      sampleEta,
      sampleStatus,
      productPrice,
      productionTime,
      shippingAirPrice,
      shippingBoatPrice,
      pendingSampleFiles,
      pendingBulkFiles,
      originalValues,
      (product as any).id
    ]);
    
    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    
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

    // Separate media types
    const referenceMedia = media.filter(m => m.file_type === 'document' || m.file_type === 'image');
    const sampleMedia = media.filter(m => m.file_type?.startsWith('sample'));

    // Better variant type detection
    const getVariantTypeName = () => {
      if (items.length > 0 && items[0].variant_combo) {
        const combo = items[0].variant_combo.toLowerCase();
        
        // Check for shoe sizes
        if (/\b\d+(\.\d+)?\b/.test(combo) && (combo.includes('us') || combo.includes('eu') || combo.includes('uk') || /^\d+(\.\d+)?$/.test(combo.trim()))) {
          return 'Shoe Size';
        }
        
        // Check for clothing sizes
        if (combo.includes('small') || combo.includes('medium') || combo.includes('large') || 
            combo.includes('s /') || combo.includes('m /') || combo.includes('l /') ||
            combo.includes('xl') || combo.includes('xxl') || combo.includes('xxxl') ||
            combo === 's' || combo === 'm' || combo === 'l') {
          return 'Size';
        }
        
        // Check for colors
        if (combo.includes('color') || combo.includes('colour') || 
            combo.includes('red') || combo.includes('blue') || combo.includes('green') || 
            combo.includes('black') || combo.includes('white')) {
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
          return <Ship className="w-5 h-5 text-purple-500" />;
        case 'sample_requested':
          return <AlertCircle className="w-5 h-5 text-yellow-500" />;
        case 'revision_requested':
          return <RotateCcw className="w-5 h-5 text-orange-500" />;
        case 'pending_client_approval':
          return <Clock className="w-5 h-5 text-purple-500" />;
        case 'rejected':
          return <XCircle className="w-5 h-5 text-red-500" />;
        case 'sent_to_manufacturer':
          return <Send className="w-5 h-5 text-blue-500" />;
        default:
          return <Clock className="w-5 h-5 text-gray-500" />;
      }
    };

    const getCorrectProductStatus = () => {
      return (product as any).product_status || 'sent_to_manufacturer';
    };

    const displayStatus = getCorrectProductStatus();

    const handleToggleLock = async () => {
      setProcessingProduct(true);
      try {
        const newLockStatus = !(product as any).is_locked;
        const newProductStatus = newLockStatus ? 'in_production' : 'pending_manufacturer';

        await supabase
          .from('order_products')
          .update({ 
            is_locked: newLockStatus,
            product_status: newProductStatus
          })
          .eq('id', (product as any).id);

        // Auto-collapse when locking
        if (newLockStatus) {
          setIsCollapsed(true);
        }

        onUpdate();
      } catch (error) {
        console.error('Error toggling lock:', error);
      } finally {
        setProcessingProduct(false);
      }
    };

    // FIXED: Save Sample Section - now properly saves all fields
    const handleSaveSampleSection = async () => {
      console.log('Starting sample save with:', { sampleFee, sampleEta, sampleStatus, tempSampleNotes });
      
      try {
        const user = getCurrentUser();
        const changes = [];
        
        // Validate no negative prices
        const fee = parseFloat(sampleFee) || 0;
        if (fee < 0) {
          alert('Sample fee cannot be negative');
          return;
        }
        
        // Check what changed
        if (sampleFee !== originalValues.sampleFee) {
          changes.push(`Sample Fee: $${originalValues.sampleFee || '0'} → $${sampleFee || '0'}`);
        }
        if (sampleEta !== originalValues.sampleEta) {
          changes.push(`Sample ETA: ${originalValues.sampleEta || 'not set'} → ${sampleEta || 'not set'}`);
        }
        if (sampleStatus !== originalValues.sampleStatus) {
          changes.push(`Sample Status: ${originalValues.sampleStatus} → ${sampleStatus}`);
        }
        
        // Handle sample notes - just replace, don't append
        let finalSampleNotes = tempSampleNotes.trim() || (product as any).sample_notes || '';
        
        // Prepare update data - use empty string instead of null for text fields
        const updateData: any = {
          sample_fee: sampleFee ? parseFloat(sampleFee) : null,
          sample_eta: sampleEta || null,
          sample_status: sampleStatus || 'pending'  // Ensure we always have a status
        };
        
        // Only update notes if there's a new note
        if (tempSampleNotes && tempSampleNotes.trim()) {
          updateData.sample_notes = finalSampleNotes;
        }
        
        console.log('Update data:', updateData);
        
        // Update database - don't use .select() to avoid relationship issues
        const { error } = await supabase
          .from('order_products')
          .update(updateData)
          .eq('id', (product as any).id);

        if (error) {
          console.error('Error updating sample section:', error);
          console.error('Error details:', {
            message: error.message,
            details: (error as any).details,
            hint: (error as any).hint,
            code: (error as any).code
          });
          alert(`Failed to save sample section: ${error.message || 'Unknown error'}`);
          return;
        }
        
        console.log('Sample section updated successfully');

        // Upload pending sample files if any
        if (pendingSampleFiles.length > 0) {
          console.log('Uploading sample files...');
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
          console.log('Files uploaded successfully');
        }

        // Log audit if there were changes - do this separately
        if (changes.length > 0) {
          try {
            await supabase
              .from('audit_log')
              .insert({
                user_id: user.id,
                user_name: user.name,
                action_type: 'sample_section_updated',
                target_type: 'order_product',
                target_id: (product as any).id,
                old_value: JSON.stringify(originalValues),
                new_value: changes.join(', '),
                timestamp: new Date().toISOString()
              });
          } catch (auditError) {
            console.error('Failed to log audit:', auditError);
            // Don't fail the whole operation just because audit log failed
          }
        }

        // Update original values to new values
        setOriginalValues(prev => ({
          ...prev,
          sampleFee,
          sampleEta,
          sampleStatus,
          sampleNotes: finalSampleNotes
        }));
        
        // Clear temporary states
        setTempSampleNotes('');
        setPendingSampleFiles([]);
        setSampleSectionDirty(false);
        setShowNewHistoryDot(true);
        
        // Call onUpdate to refresh parent
        await onUpdate();
        
      } catch (error) {
        console.error('Error in handleSaveSampleSection:', error);
        alert('An error occurred while saving. Please try again.');
      }
    };

    // FIXED: Save Bulk Section - now includes shipping prices
    const handleSaveBulkSection = async () => {
      console.log('Starting bulk save with:', { productPrice, productionTime, shippingAirPrice, shippingBoatPrice });
      
      try {
        const user = getCurrentUser();
        const changes = [];
        
        // Validate no negative prices
        const price = parseFloat(productPrice) || 0;
        const airPrice = parseFloat(shippingAirPrice) || 0;
        const boatPrice = parseFloat(shippingBoatPrice) || 0;
        
        if (price < 0 || airPrice < 0 || boatPrice < 0) {
          alert('Prices cannot be negative');
          return;
        }
        
        // Check what changed
        if (productPrice !== originalValues.productPrice) {
          changes.push(`Product Price: $${originalValues.productPrice || '0'} → $${productPrice || '0'}`);
        }
        if (productionTime !== originalValues.productionTime) {
          changes.push(`Production Time: ${originalValues.productionTime || 'not set'} → ${productionTime || 'not set'}`);
        }
        if (shippingAirPrice !== originalValues.shippingAirPrice) {
          changes.push(`Air Shipping: $${originalValues.shippingAirPrice || '0'} → $${shippingAirPrice || '0'}`);
        }
        if (shippingBoatPrice !== originalValues.shippingBoatPrice) {
          changes.push(`Boat Shipping: $${originalValues.shippingBoatPrice || '0'} → $${shippingBoatPrice || '0'}`);
        }
        
        // Handle bulk notes - just replace, don't append
        let finalBulkNotes = tempBulkNotes.trim() || (product as any).client_notes || '';
        
        // Prepare update data
        const updateData: any = {
          product_price: productPrice ? parseFloat(productPrice) : null,
          production_time: productionTime || null,
          shipping_air_price: shippingAirPrice ? parseFloat(shippingAirPrice) : null,
          shipping_boat_price: shippingBoatPrice ? parseFloat(shippingBoatPrice) : null
        };
        
        // Only update notes if there's a new note
        if (tempBulkNotes && tempBulkNotes.trim()) {
          updateData.client_notes = finalBulkNotes;
        }
        
        console.log('Update data:', updateData);
        
        // Update database - don't use .select() to avoid relationship issues
        const { error } = await supabase
          .from('order_products')
          .update(updateData)
          .eq('id', (product as any).id);

        if (error) {
          console.error('Error updating bulk section:', error);
          alert(`Failed to save bulk section: ${error.message || 'Unknown error'}`);
          return;
        }
        
        console.log('Bulk section updated successfully');

        // Upload pending bulk files if any
        if (pendingBulkFiles.length > 0) {
          console.log('Uploading bulk files...');
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
          console.log('Files uploaded successfully');
        }

        // Log audit if there were changes - do this separately
        if (changes.length > 0) {
          try {
            await supabase
              .from('audit_log')
              .insert({
                user_id: user.id,
                user_name: user.name,
                action_type: 'bulk_section_updated',
                target_type: 'order_product',
                target_id: (product as any).id,
                old_value: JSON.stringify(originalValues),
                new_value: changes.join(', '),
                timestamp: new Date().toISOString()
              });
          } catch (auditError) {
            console.error('Failed to log audit:', auditError);
            // Don't fail the whole operation just because audit log failed
          }
        }

        // Update original values
        setOriginalValues(prev => ({
          ...prev,
          productPrice,
          productionTime,
          shippingAirPrice,
          shippingBoatPrice,
          bulkNotes: finalBulkNotes
        }));
        
        // Clear temporary states
        setTempBulkNotes('');
        setPendingBulkFiles([]);
        setBulkSectionDirty(false);
        setShowNewHistoryDot(true);
        
        // Call onUpdate to refresh parent
        await onUpdate();
        
      } catch (error) {
        console.error('Error in handleSaveBulkSection:', error);
        alert('An error occurred while saving. Please try again.');
      }
    };

    // Save Generic Note - just replace, don't append
    const handleSaveGenericNotes = async () => {
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

        // Try to log audit but don't fail if it doesn't work
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

        setTempNotes('');
        setShowNewHistoryDot(true);
        await onUpdate();
      } catch (error) {
        console.error('Error saving notes:', error);
        alert('Failed to save note. Please try again.');
      }
    };

    // Handle sample file selection
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

    // Handle bulk file selection
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
    };

    const removePendingBulkFile = (index: number) => {
      setPendingBulkFiles(prev => prev.filter((_, i) => i !== index));
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
                  {(product as any).is_locked && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                      🔒 Locked
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                  <span>{(product as any).product_order_number}</span>
                  <span>•</span>
                  <span>Qty: {totalQuantity}</span>
                  {productionTime && (
                    <>
                      <span>•</span>
                      <span>Production: {productionTime}</span>
                    </>
                  )}
                  {/* Show tracking info if shipped */}
                  {displayStatus === 'shipped' && (product as any).tracking_number && (
                    <>
                      <span>•</span>
                      <span className="text-blue-600">Tracking: {(product as any).tracking_number}</span>
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
              
              {/* ALWAYS show Route button for manufacturers */}
              {onRoute && (
                <button
                  onClick={() => onRoute(product)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Route
                </button>
              )}
              
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
            </div>
          </div>
        </div>
      </div>
    );

    // MAIN RENDER - Show collapsed or full view based on state
    if (isCollapsed) {
      return <CollapsedHeader />;
    }

    // FULL EXPANDED VIEW (your existing full card content)
    return (
      <div className="bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden hover:shadow-xl transition-shadow">
        {/* Product Header with Collapse Button */}
        <div className="p-4 bg-gray-50 border-b-2 border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              {/* Collapse Button - Only show when in production */}
              {((product as any).product_status === 'in_production' || (product as any).is_locked) && (
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
              
              {onRoute && (
                <button
                  onClick={() => onRoute(product)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Route
                </button>
              )}
              
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
            </div>
          </div>

          {/* ALL YOUR EXISTING CONTENT SECTIONS BELOW - No changes needed! */}
          {/* Generic Notes Section */}
          <div className="mt-3 p-4 bg-white rounded-lg border border-gray-300">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Notes / Instructions</h4>
            
            {(product as any).internal_notes && (
              <div className="mb-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                <strong>Current notes:</strong>
                <div className="whitespace-pre-wrap mt-1">{(product as any).internal_notes}</div>
              </div>
            )}
            
            <div className="space-y-2">
              <textarea
                value={tempNotes}
                onChange={(e) => setTempNotes(e.target.value)}
                placeholder="Add general notes or instructions for this product..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium text-sm placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
              {tempNotes && (
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setTempNotes('')}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveGenericNotes}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-1"
                  >
                    <Save className="w-3 h-3" />
                    Save Note
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sample Request Section - CONTINUES UNCHANGED */}
          <div className="mt-3 bg-amber-50 rounded-lg p-4 border border-amber-300">
            <h4 className="text-sm font-semibold text-amber-900 flex items-center mb-3">
              <AlertCircle className="w-4 h-4 mr-2" />
              Sample Request
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-amber-800 mb-1">
                  Sample Price
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-amber-600" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={sampleFee}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || parseFloat(val) >= 0) {
                        setSampleFee(val);
                        setSampleSectionDirty(true);
                      }
                    }}
                    placeholder="Enter price"
                    className="w-full pl-8 pr-3 py-2 border border-amber-200 rounded-lg bg-white text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-amber-800 mb-1">
                  Sample ETA
                </label>
                <div className="relative">
                  <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-amber-600" />
                  <input
                    type="date"
                    value={sampleEta}
                    onChange={(e) => {
                      setSampleEta(e.target.value);
                      setSampleSectionDirty(true);
                    }}
                    className="w-full pl-8 pr-3 py-2 border border-amber-200 rounded-lg bg-white text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-amber-800 mb-1">
                  Status
                </label>
                <select
                  value={sampleStatus}
                  onChange={(e) => {
                    setSampleStatus(e.target.value);
                    setSampleSectionDirty(true);
                  }}
                  className="w-full px-3 py-2 border border-amber-200 rounded-lg bg-white text-gray-900"
                >
                  <option value="pending">Pending</option>
                  <option value="in_production">In Production</option>
                  <option value="ready">Ready</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Sample Notes */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-amber-800 mb-1">
                Sample Notes / Instructions
              </label>
              
              {(product as any).sample_notes && (
                <div className="mb-2 p-2 bg-amber-100 rounded text-sm text-amber-800">
                  <strong>Current notes:</strong>
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
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-amber-800">
                  Sample Media {sampleMedia.length > 0 && `(${sampleMedia.length})`}
                </label>
                <button 
                  onClick={() => sampleFileInputRef.current?.click()}
                  disabled={uploadingMedia}
                  className="text-xs px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 flex items-center gap-1 disabled:opacity-50 transition-colors"
                >
                  {uploadingMedia ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3" />
                  )}
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
                <div className="flex flex-wrap gap-1">
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
            </div>

            {/* Save button for Sample Section */}
            {sampleSectionDirty && (
              <div className="flex justify-end gap-2 pt-2 border-t border-amber-200">
                <button
                  onClick={() => {
                    setSampleFee(originalValues.sampleFee);
                    setSampleEta(originalValues.sampleEta);
                    setSampleStatus(originalValues.sampleStatus);
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

          {/* REST OF YOUR EXISTING CONTENT - Bulk Order, Variants, etc. */}
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
                  <strong>Current notes:</strong>
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
                  disabled={uploadingBulkMedia}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50 transition-colors"
                >
                  {uploadingBulkMedia ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3" />
                  )}
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
                <div className="flex flex-wrap gap-1">
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
            </div>

            {/* Product Price and Production Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Price
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={productPrice}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || parseFloat(val) >= 0) {
                        setProductPrice(val);
                        setBulkSectionDirty(true);
                      }
                    }}
                    placeholder="Enter price"
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900"
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
                    value={productionTime}
                    onChange={(e) => {
                      setProductionTime(e.target.value);
                      setBulkSectionDirty(true);
                    }}
                    placeholder="e.g., 2-3 weeks"
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* Shipping Options & Pricing - EDITABLE */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <h5 className="text-sm font-medium text-gray-700 mb-3">Shipping Options & Pricing</h5>
              
              {(product as any).selected_shipping_method && (
                <div className="mb-3 p-2 bg-white rounded border border-blue-300">
                  <p className="text-xs text-blue-700 mb-1">Client selected:</p>
                  <div className="flex items-center gap-2">
                    {(product as any).selected_shipping_method === 'air' ? (
                      <>
                        <Plane className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-blue-700 font-medium">Air Shipping</span>
                      </>
                    ) : (
                      <>
                        <Ship className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-blue-700 font-medium">Boat Shipping</span>
                      </>
                    )}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Air Shipping Price
                  </label>
                  <div className="relative">
                    <Plane className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={shippingAirPrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || parseFloat(val) >= 0) {
                          setShippingAirPrice(val);
                          setBulkSectionDirty(true);
                        }
                      }}
                      placeholder="Enter air price"
                      className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Boat Shipping Price
                  </label>
                  <div className="relative">
                    <Ship className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={shippingBoatPrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || parseFloat(val) >= 0) {
                          setShippingBoatPrice(val);
                          setBulkSectionDirty(true);
                        }
                      }}
                      placeholder="Enter boat price"
                      className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Save button for Bulk Section */}
            {bulkSectionDirty && (
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  onClick={() => {
                    setProductPrice(originalValues.productPrice);
                    setProductionTime(originalValues.productionTime);
                    setShippingAirPrice(originalValues.shippingAirPrice);
                    setShippingBoatPrice(originalValues.shippingBoatPrice);
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