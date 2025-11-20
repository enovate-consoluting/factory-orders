/**
 * Manufacturer Product Card Component
 * Product card for Manufacturer users with cost pricing
 * Uses shared components for collapsed view and file display
 * Last Modified: November 2024
 */

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { 
  Package, Clock, Lock, Unlock, Send, CheckCircle, 
  Loader2, Save, DollarSign, Plane, Ship, 
  Upload, X, ChevronDown, Calculator
} from 'lucide-react';
import { OrderProduct, OrderItem } from '../../types/order.types';
import { ProductStatusBadge } from '../../../shared-components/StatusBadge';
import { CollapsedProductHeader } from '../shared/CollapsedProductHeader';
import { getProductStatusIcon } from '../shared/ProductStatusIcon';
import { FileUploadDisplay } from '../shared/FileUploadDisplay';
import { usePermissions } from '../../hooks/usePermissions';
import { supabase } from '@/lib/supabase';

// Define the ref type for imperative handle
export interface ManufacturerProductCardRef {
  saveAll: () => Promise<boolean>;
  getState: () => any;
}

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
  isSuperAdminView?: boolean;
  autoCollapse?: boolean;
  forceExpanded?: boolean;
  onExpand?: () => void;
  onDataChange?: (data: any) => void;
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
    manufacturerId,
    isSuperAdminView = false,
    autoCollapse = false,
    forceExpanded = false,
    onExpand,
    onDataChange
  }, ref) {
    const permissions = usePermissions() as any;
    const userRole = isSuperAdminView ? 'super_admin' : 'manufacturer';

    // Collapsible state
    const [isCollapsed, setIsCollapsed] = useState(() => {
      if (forceExpanded) return false;
      if (autoCollapse) return true;
      const productStatus = (product as any)?.product_status;
      return (productStatus === 'in_production' || productStatus === 'in_transit');
    });
    
    // Auto-collapse when status changes
    useEffect(() => {
      if (forceExpanded) return;
      if (autoCollapse) return;
      const productStatus = (product as any)?.product_status;
      if (productStatus === 'in_production' || productStatus === 'in_transit') {
        setIsCollapsed(true);
      }
    }, [(product as any)?.product_status, autoCollapse, forceExpanded]);
    
    // State for notes
    const [tempNotes, setTempNotes] = useState('');
    const [tempBulkNotes, setTempBulkNotes] = useState('');
    
    // Loading states for save buttons
    const [savingNotes, setSavingNotes] = useState(false);
    const [savingBulkSection, setSavingBulkSection] = useState(false);
    const [savingVariantNotes, setSavingVariantNotes] = useState(false);
    
    // State for tracking if sections have changes
    const [bulkSectionDirty, setBulkSectionDirty] = useState(false);
    
    const [processingProduct, setProcessingProduct] = useState(false);
    const bulkFileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingBulkMedia, setUploadingBulkMedia] = useState(false);
    const [showNewHistoryDot, setShowNewHistoryDot] = useState(hasNewHistory);
    
    // State for variant notes and quantities
    const [variantNotes, setVariantNotes] = useState<{[key: string]: string}>({});
    const [itemQuantities, setItemQuantities] = useState<{[key: string]: string}>({});
    const [editingVariants, setEditingVariants] = useState(false);
    const [variantsDirty, setVariantsDirty] = useState(false);
    
    // State for bulk section - convert to strings for inputs
    const [productPrice, setProductPrice] = useState((product as any).product_price?.toString() || '');
    const [productionTime, setProductionTime] = useState((product as any).production_time || '');
    
    // State for shipping prices - convert to strings for inputs
    const [shippingAirPrice, setShippingAirPrice] = useState((product as any).shipping_air_price?.toString() || '');
    const [shippingBoatPrice, setShippingBoatPrice] = useState((product as any).shipping_boat_price?.toString() || '');
    const [selectedShippingMethod] = useState((product as any).selected_shipping_method || '');
    
    // State for sample data
    const [sampleFee, setSampleFee] = useState((product as any).sample_fee?.toString() || '');
    const [sampleETA, setSampleETA] = useState((product as any).sample_eta || '');
    
    // State for manufacturer notes
    const [manufacturerNotes, setManufacturerNotes] = useState((product as any).manufacturer_notes || '');
    
    // State for pending file uploads
    const [pendingBulkFiles, setPendingBulkFiles] = useState<File[]>([]);
    
    // Store original values for comparison
    const [originalValues, setOriginalValues] = useState({
      productPrice: (product as any).product_price?.toString() || '',
      productionTime: (product as any).production_time || '',
      bulkNotes: (product as any).client_notes || '',
      shippingAirPrice: (product as any).shipping_air_price?.toString() || '',
      shippingBoatPrice: (product as any).shipping_boat_price?.toString() || '',
      sampleFee: (product as any).sample_fee?.toString() || '',
      sampleETA: (product as any).sample_eta || '',
      manufacturerNotes: (product as any).manufacturer_notes || ''
    });
    
    // Initialize item quantities and notes from items
    useEffect(() => {
      const initialQuantities: {[key: string]: string} = {};
      const initialNotes: {[key: string]: string} = {};
      items.forEach(item => {
        initialQuantities[item.id] = item.quantity?.toString() || '0';
        initialNotes[item.id] = item.notes || '';
      });
      setItemQuantities(initialQuantities);
      setVariantNotes(initialNotes);
    }, [items]);
    
    // Calculate total quantity - NOW USES STATE VALUES
    const totalQuantity = Object.keys(itemQuantities).reduce((sum, itemId) => {
      return sum + (parseInt(itemQuantities[itemId]) || 0);
    }, 0);
    
    // Calculate manufacturer totals
    const calculateManufacturerTotal = () => {
      let total = 0;
      
      const unitPrice = parseFloat(productPrice) || 0;
      total += unitPrice * totalQuantity;
      
      if ((product as any).selected_shipping_method === 'air') {
        const airShipping = parseFloat(shippingAirPrice) || 0;
        total += airShipping;
      } else if ((product as any).selected_shipping_method === 'boat') {
        const boatShipping = parseFloat(shippingBoatPrice) || 0;
        total += boatShipping;
      }
      
      return total;
    };
    
    const manufacturerTotal = calculateManufacturerTotal();
    
    // Update original values when product changes
    useEffect(() => {
      setOriginalValues({
        productPrice: (product as any).product_price?.toString() || '',
        productionTime: (product as any).production_time || '',
        bulkNotes: (product as any).client_notes || '',
        shippingAirPrice: (product as any).shipping_air_price?.toString() || '',
        shippingBoatPrice: (product as any).shipping_boat_price?.toString() || '',
        sampleFee: (product as any).sample_fee?.toString() || '',
        sampleETA: (product as any).sample_eta || '',
        manufacturerNotes: (product as any).manufacturer_notes || ''
      });
      setProductPrice((product as any).product_price?.toString() || '');
      setProductionTime((product as any).production_time || '');
      setShippingAirPrice((product as any).shipping_air_price?.toString() || '');
      setShippingBoatPrice((product as any).shipping_boat_price?.toString() || '');
      setSampleFee((product as any).sample_fee?.toString() || '');
      setSampleETA((product as any).sample_eta || '');
      setManufacturerNotes((product as any).manufacturer_notes || '');
      setPendingBulkFiles([]);
    }, [product]);

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

    // FIXED: EXPOSE SAVE ALL FUNCTION TO PARENT - NOW PROPERLY SAVES ALL NOTES
    useImperativeHandle(ref, () => ({
      saveAll: async () => {
        console.log('=== SaveAll called for product:', (product as any).product_order_number);
        
        try {
          // STEP 1: Save all product pricing data AND notes
          console.log('Step 1: Saving product pricing data and notes...');
          console.log('Current tempNotes:', tempNotes);
          console.log('Current tempBulkNotes:', tempBulkNotes);
          console.log('Current manufacturerNotes:', manufacturerNotes);
          
          // Combine ALL notes - temp notes, bulk notes, and existing
          let finalManufacturerNotes = manufacturerNotes || '';
          let finalInternalNotes = (product as any).internal_notes || '';
          
          // Add temp bulk notes to manufacturer notes if they exist
          if (tempBulkNotes && tempBulkNotes.trim()) {
            const timestamp = new Date().toLocaleDateString();
            finalManufacturerNotes = manufacturerNotes 
              ? `${manufacturerNotes}\n\n[${timestamp} - Manufacturer] ${tempBulkNotes.trim()}`
              : `[${timestamp} - Manufacturer] ${tempBulkNotes.trim()}`;
          }
          
          // For general notes - if there's text in the temp field, use it
          if (tempNotes && tempNotes.trim()) {
            finalInternalNotes = tempNotes.trim();
          }
          
          const productUpdateData: any = {
            product_price: productPrice ? parseFloat(productPrice) : null,
            production_time: productionTime || null,
            shipping_air_price: shippingAirPrice ? parseFloat(shippingAirPrice) : null,
            shipping_boat_price: shippingBoatPrice ? parseFloat(shippingBoatPrice) : null,
            sample_fee: sampleFee ? parseFloat(sampleFee) : null,
            sample_eta: sampleETA || null,
            manufacturer_notes: finalManufacturerNotes || null,
            internal_notes: finalInternalNotes || null
          };
          
          console.log('Updating product with:', productUpdateData);
          console.log('Final internal_notes:', productUpdateData.internal_notes);
          console.log('Final manufacturer_notes:', productUpdateData.manufacturer_notes);
          
          const { error: productError } = await supabase
            .from('order_products')
            .update(productUpdateData)
            .eq('id', (product as any).id);
          
          if (productError) {
            console.error('Error updating product:', productError);
            throw productError;
          }
          
          console.log('Product updated successfully');
          
          // STEP 2: Save variant quantities and notes
          console.log('Step 2: Saving variant quantities and notes...');
          
          for (const item of items) {
            const newQty = parseInt(itemQuantities[item.id]) || 0;
            const newNote = variantNotes[item.id] || '';
            
            console.log(`Saving variant ${item.variant_combo}: qty=${newQty}, note="${newNote}"`);
            
            const { error: itemError } = await supabase
              .from('order_items')
              .update({ 
                quantity: newQty,
                notes: newNote 
              })
              .eq('id', item.id);
            
            if (itemError) {
              console.error(`Error updating item ${item.id}:`, itemError);
            }
          }
          
          // STEP 3: Upload any pending files
          if (pendingBulkFiles.length > 0) {
            console.log('Step 3: Uploading pending files...');
            const user = getCurrentUser();
            
            for (const file of pendingBulkFiles) {
              const timestamp = Date.now();
              const randomStr = Math.random().toString(36).substring(2, 8);
              const storagePath = `${(product as any).order_id}/${(product as any).id}/${timestamp}_${randomStr}_${file.name}`;
              
              console.log(`Uploading file: ${file.name}`);
              
              const { error: uploadError } = await supabase.storage
                .from('order-media')
                .upload(storagePath, file);
              
              if (!uploadError) {
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
                
                console.log(`File uploaded successfully: ${file.name}`);
              } else {
                console.error(`Error uploading file ${file.name}:`, uploadError);
              }
            }
          }
          
          // Update order status if needed
          try {
            const { data: orderData } = await supabase
              .from('orders')
              .select('status')
              .eq('id', (product as any).order_id)
              .single();
            
            if (orderData && orderData.status === 'sent_to_manufacturer') {
              await supabase
                .from('orders')
                .update({ status: 'in_progress' })
                .eq('id', (product as any).order_id);
            }
          } catch (orderError) {
            console.error('Error updating order status:', orderError);
          }
          
          console.log('=== SaveAll completed successfully for product:', (product as any).product_order_number);
          
          // Clear temp states after successful save
          setTempNotes('');
          setTempBulkNotes('');
          setPendingBulkFiles([]);
          setBulkSectionDirty(false);
          setEditingVariants(false);
          setVariantsDirty(false);
          
          // Update the manufacturer notes state with the combined value
          if (finalManufacturerNotes !== manufacturerNotes) {
            setManufacturerNotes(finalManufacturerNotes);
          }
          
          return true;
          
        } catch (error) {
          console.error('Error in saveAll:', error);
          return false;
        }
      },
      getState: () => {
        // Include ALL current state including temp values
        return {
          productPrice,
          productionTime,
          shippingAir: shippingAirPrice,
          shippingBoat: shippingBoatPrice,
          selectedShippingMethod,
          sampleFee,
          sampleETA,
          manufacturerNotes: manufacturerNotes,
          tempBulkNotes,
          tempNotes,
          itemQuantities,
          variantNotes,
          pendingBulkFiles
        };
      }
    }), [
      productPrice,
      productionTime,
      shippingAirPrice,
      shippingBoatPrice,
      selectedShippingMethod,
      sampleFee,
      sampleETA,
      manufacturerNotes,
      tempBulkNotes,
      tempNotes,
      itemQuantities,
      variantNotes,
      pendingBulkFiles,
      items,
      (product as any).id,
      (product as any).order_id,
      (product as any).product_order_number,
      (product as any).internal_notes
    ]);

    // Separate media types
    const referenceMedia = media.filter(m => m.file_type === 'document' || m.file_type === 'image');

    // Get variant type name
    const getVariantTypeName = () => {
      if (items.length > 0 && items[0].variant_combo) {
        const combo = items[0].variant_combo.toLowerCase();
        
        if (/\b\d+(\.\d+)?\b/.test(combo) && (combo.includes('us') || combo.includes('eu') || combo.includes('uk') || /^\d+(\.\d+)?$/.test(combo.trim()))) {
          return 'Shoe Size';
        }
        
        if (combo.includes('small') || combo.includes('medium') || combo.includes('large') || 
            combo.includes('s /') || combo.includes('m /') || combo.includes('l /') ||
            combo.includes('xl') || combo.includes('xxl') || combo.includes('xxxl') ||
            combo === 's' || combo === 'm' || combo === 'l') {
          return 'Size';
        }
        
        if (combo.includes('color') || combo.includes('colour') || 
            combo.includes('red') || combo.includes('blue') || combo.includes('green') || 
            combo.includes('black') || combo.includes('white')) {
          return 'Color';
        }
        
        return 'Variant';
      }
      return 'Variant';
    };

    const displayStatus = (product as any).product_status || 'sent_to_manufacturer';

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

        if (newLockStatus && !forceExpanded) {
          setIsCollapsed(true);
        }

        onUpdate();
      } catch (error) {
        console.error('Error toggling lock:', error);
      } finally {
        setProcessingProduct(false);
      }
    };

    // Save Bulk Section
    const handleSaveBulkSection = async () => {
      console.log('Starting bulk save with:', { 
        productPrice, 
        productionTime, 
        shippingAirPrice, 
        shippingBoatPrice,
        sampleFee,
        sampleETA,
        manufacturerNotes 
      });
      
      setSavingBulkSection(true);
      try {
        const user = getCurrentUser();
        const changes = [];
        
        // Validate no negative prices
        const price = parseFloat(productPrice) || 0;
        const airPrice = parseFloat(shippingAirPrice) || 0;
        const boatPrice = parseFloat(shippingBoatPrice) || 0;
        const samplePrice = parseFloat(sampleFee) || 0;
        
        if (price < 0 || airPrice < 0 || boatPrice < 0 || samplePrice < 0) {
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
        if (sampleFee !== originalValues.sampleFee) {
          changes.push(`Sample Fee: $${originalValues.sampleFee || '0'} → $${sampleFee || '0'}`);
        }
        if (sampleETA !== originalValues.sampleETA) {
          changes.push(`Sample ETA: ${originalValues.sampleETA || 'not set'} → ${sampleETA || 'not set'}`);
        }
        if (manufacturerNotes !== originalValues.manufacturerNotes) {
          changes.push('Manufacturer notes updated');
        }
        
        // Handle bulk notes
        let finalBulkNotes = tempBulkNotes.trim() || (product as any).client_notes || '';
        let finalManufacturerNotes = manufacturerNotes;
        
        // If there's a temp bulk note, append it to manufacturer notes
        if (tempBulkNotes && tempBulkNotes.trim()) {
          const timestamp = new Date().toLocaleDateString();
          finalManufacturerNotes = manufacturerNotes 
            ? `${manufacturerNotes}\n\n[${timestamp} - Manufacturer] ${tempBulkNotes.trim()}`
            : `[${timestamp} - Manufacturer] ${tempBulkNotes.trim()}`;
        }
        
        // Prepare update data
        const updateData: any = {
          product_price: productPrice ? parseFloat(productPrice) : null,
          production_time: productionTime || null,
          shipping_air_price: shippingAirPrice ? parseFloat(shippingAirPrice) : null,
          shipping_boat_price: shippingBoatPrice ? parseFloat(shippingBoatPrice) : null,
          sample_fee: sampleFee ? parseFloat(sampleFee) : null,
          sample_eta: sampleETA || null,
          manufacturer_notes: finalManufacturerNotes || null
        };

        // Only update client notes if there's a new note
        if (tempBulkNotes && tempBulkNotes.trim()) {
          updateData.client_notes = finalBulkNotes;
        }
        
        console.log('Update data:', updateData);
        
        // Update database
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

        // Update ORDER status to 'in_progress' if currently 'sent_to_manufacturer'
        try {
          const { data: orderData } = await supabase
            .from('orders')
            .select('status')
            .eq('id', (product as any).order_id)
            .single();

          if (orderData && orderData.status === 'sent_to_manufacturer') {
            await supabase
              .from('orders')
              .update({ status: 'in_progress' })
              .eq('id', (product as any).order_id);
            console.log('Order status updated to in_progress');
          }
        } catch (orderError) {
          console.error('Error updating order status:', orderError);
        }

        // Upload files
        if (pendingBulkFiles.length > 0) {
          console.log('Uploading bulk files...');

          for (const file of pendingBulkFiles) {
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(2, 8);
            const storagePath = `${(product as any).order_id}/${(product as any).id}/${timestamp}_${randomStr}_${file.name}`;

            const { error: uploadError } = await supabase.storage
              .from('order-media')
              .upload(storagePath, file);

            if (!uploadError) {
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
          console.log('Files uploaded successfully with original names');
        }

        // Log audit if there were changes
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
          }
        }

        // Update original values
        setOriginalValues(prev => ({
          ...prev,
          productPrice,
          productionTime,
          shippingAirPrice,
          shippingBoatPrice,
          sampleFee,
          sampleETA,
          manufacturerNotes: finalManufacturerNotes,
          bulkNotes: finalBulkNotes
        }));
        
        // Update manufacturer notes state if changed
        setManufacturerNotes(finalManufacturerNotes);
        
        // Clear temporary states
        setTempBulkNotes('');
        setPendingBulkFiles([]);
        setBulkSectionDirty(false);
        setShowNewHistoryDot(true);
        
        if (onExpand) onExpand();
        
        await onUpdate();
        
      } catch (error) {
        console.error('Error in handleSaveBulkSection:', error);
        alert('An error occurred while saving. Please try again.');
      } finally {
        setSavingBulkSection(false);
      }
    };

    // Save Generic Note
    const handleSaveGenericNotes = async () => {
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

        setTempNotes('');
        setShowNewHistoryDot(true);
        await onUpdate();
      } catch (error) {
        console.error('Error saving notes:', error);
        alert('Failed to save note. Please try again.');
      } finally {
        setSavingNotes(false);
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

    // Save variant quantities and notes
    const handleSaveVariantNotes = async () => {
      setSavingVariantNotes(true);
      try {
        let hasChanges = false;
        
        // Save both quantities and notes
        for (const item of items) {
          const newQty = parseInt(itemQuantities[item.id]) || 0;
          const newNote = variantNotes[item.id] || '';
          
          if (newQty !== item.quantity || newNote !== (item.notes || '')) {
            await supabase
              .from('order_items')
              .update({ 
                quantity: newQty,
                notes: newNote 
              })
              .eq('id', item.id);
            hasChanges = true;
            console.log(`Updated item ${item.id}: qty=${newQty}, note="${newNote}"`);
          }
        }

        // Update ORDER status to 'in_progress' if currently 'sent_to_manufacturer' and changes were made
        if (hasChanges) {
          try {
            const { data: orderData } = await supabase
              .from('orders')
              .select('status')
              .eq('id', (product as any).order_id)
              .single();

            if (orderData && orderData.status === 'sent_to_manufacturer') {
              await supabase
                .from('orders')
                .update({ status: 'in_progress' })
                .eq('id', (product as any).order_id);
              console.log('Order status updated to in_progress');
            }
          } catch (orderError) {
            console.error('Error updating order status:', orderError);
          }
        }

        setEditingVariants(false);
        setVariantsDirty(false);
        await onUpdate();
      } catch (error) {
        console.error('Error saving variant notes:', error);
      } finally {
        setSavingVariantNotes(false);
      }
    };

    // Handle expand/collapse
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
          totalPrice={manufacturerTotal}
          isManufacturerView={true}
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

    // FULL EXPANDED VIEW
    return (
      <div className="bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden hover:shadow-xl transition-shadow">
        {/* Product Header with Collapse Button */}
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
                  {/* MANUFACTURER TOTAL BADGE */}
                  {manufacturerTotal > 0 && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full flex items-center gap-1">
                      <Calculator className="w-4 h-4" />
                      Mfg Total: ${manufacturerTotal.toFixed(2)}
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
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onViewHistory && (
                <button
                  onClick={handleViewHistory}
                  className="px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium flex items-center gap-2 relative"
                >
                  <Clock className="w-4 h-4" />
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
                    disabled={savingNotes}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveGenericNotes}
                    disabled={savingNotes}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50"
                  >
                    {savingNotes ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-3 h-3" />
                        Save Note
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
              
              {manufacturerNotes && (
                <div className="mb-2 p-2 bg-blue-50 rounded text-sm text-blue-700">
                  <strong>Current notes:</strong>
                  <div className="whitespace-pre-wrap mt-1">{manufacturerNotes}</div>
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

            {/* Shipping Options & Pricing */}
            <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border-2 border-blue-300">
              <h5 className="text-sm font-semibold text-gray-800 mb-3">Shipping Options & Pricing</h5>
              
              {(product as any).selected_shipping_method && (
                <div className="mb-4 p-3 bg-white rounded-lg border-2 border-blue-400 shadow-sm">
                  <p className="text-xs font-medium text-blue-700 mb-2">CLIENT SELECTED:</p>
                  <div className="flex items-center gap-3">
                    {(product as any).selected_shipping_method === 'air' ? (
                      <>
                        <div className="p-2 bg-blue-100 rounded-full">
                          <Plane className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <span className="text-base font-bold text-blue-800">AIR SHIPPING</span>
                          {shippingAirPrice && (
                            <p className="text-sm text-blue-600">Price: ${parseFloat(shippingAirPrice).toFixed(2)}</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-2 bg-cyan-100 rounded-full">
                          <Ship className="w-5 h-5 text-cyan-600" />
                        </div>
                        <div>
                          <span className="text-base font-bold text-cyan-800">BOAT SHIPPING</span>
                          {shippingBoatPrice && (
                            <p className="text-sm text-cyan-600">Price: ${parseFloat(shippingBoatPrice).toFixed(2)}</p>
                          )}
                        </div>
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

            {/* MANUFACTURER PRICING SUMMARY */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-300">
              <h5 className="text-sm font-semibold text-green-800 mb-3 flex items-center">
                <Calculator className="w-4 h-4 mr-2" />
                Manufacturing Cost Summary
              </h5>
              <div className="space-y-2 text-sm">
                {productPrice && totalQuantity > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Product: ${parseFloat(productPrice).toFixed(2)} × {totalQuantity} units</span>
                    <span className="font-semibold text-gray-900">${(parseFloat(productPrice) * totalQuantity).toFixed(2)}</span>
                  </div>
                )}
                {(product as any).selected_shipping_method && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">
                      Shipping ({(product as any).selected_shipping_method === 'air' ? 'Air' : 'Boat'})
                    </span>
                    <span className="font-semibold text-gray-900">
                      ${(product as any).selected_shipping_method === 'air' 
                        ? (parseFloat(shippingAirPrice) || 0).toFixed(2)
                        : (parseFloat(shippingBoatPrice) || 0).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-green-300">
                  <div className="flex justify-between">
                    <span className="font-semibold text-green-800">Total Manufacturing Cost</span>
                    <span className="font-bold text-green-800 text-base">${manufacturerTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Save button for Bulk Section */}
            {bulkSectionDirty && (
              <div className="flex justify-end gap-2 pt-2 mt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setProductPrice(originalValues.productPrice);
                    setProductionTime(originalValues.productionTime);
                    setShippingAirPrice(originalValues.shippingAirPrice);
                    setShippingBoatPrice(originalValues.shippingBoatPrice);
                    setSampleFee(originalValues.sampleFee);
                    setSampleETA(originalValues.sampleETA);
                    setManufacturerNotes(originalValues.manufacturerNotes);
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
                      <th className="text-left py-2 px-1 text-sm font-medium text-gray-700" style={{width: '15%'}}>Qty</th>
                      <th className="text-left py-2 pl-2 pr-3 text-sm font-medium text-gray-700" style={{width: '60%'}}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                        <td className="py-2 px-3 text-sm text-gray-900">{item.variant_combo}</td>
                        <td className="py-2 px-1">
                          <input
                            type="number"
                            min="0"
                            value={itemQuantities[item.id] || '0'}
                            onChange={(e) => {
                              setItemQuantities(prev => ({
                                ...prev,
                                [item.id]: e.target.value
                              }));
                              setVariantsDirty(true);
                              if (!editingVariants) setEditingVariants(true);
                            }}
                            className="w-full px-2 py-1 text-sm text-gray-900 font-medium border border-gray-300 rounded placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
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
                              setVariantsDirty(true);
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
                      const originalQtys: {[key: string]: string} = {};
                      items.forEach(item => {
                        originalNotes[item.id] = item.notes || '';
                        originalQtys[item.id] = item.quantity?.toString() || '0';
                      });
                      setVariantNotes(originalNotes);
                      setItemQuantities(originalQtys);
                      setEditingVariants(false);
                      setVariantsDirty(false);
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
                        Save Variant Details
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