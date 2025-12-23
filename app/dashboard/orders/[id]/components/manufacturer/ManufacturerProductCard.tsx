/**
 * Manufacturer Product Card V2 Component - Clean Header Layout
 * Product card for Manufacturer users with COST pricing
 * V2: Redesigned header with buttons on right, clean compact layout
 * Location: /app/dashboard/orders/[id]/v2/components/ManufacturerProductCardV2.tsx
 * Last Modified: December 2025
 */

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import {
  Package, Clock, Lock, Unlock, Send, CheckCircle,
  Loader2, MessageSquare, Save, DollarSign, Plane, Ship,
  Upload, X, ChevronDown, Edit2, Eye, EyeOff, Link2, AlertCircle,
  Calendar, FolderOpen, Calculator
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

// Define the ref type for imperative handle
export interface ManufacturerProductCardV2Ref {
  saveAll: () => Promise<boolean>;
  getState: () => any;
}

interface ManufacturerProductCardV2Props {
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
  allOrderProducts?: OrderProduct[];
  translate?: (text: string | null | undefined) => string;
  t?: (key: string) => string;
}

export const ManufacturerProductCardV2 = forwardRef<
  ManufacturerProductCardV2Ref,
  ManufacturerProductCardV2Props
>(function ManufacturerProductCardV2(
  {
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
    onDataChange,
    allOrderProducts = [],
    translate = (text) => text || '',
    t = (key) => key,
  },
  ref
) {
  const permissions = usePermissions() as any;
  const userRole = isSuperAdminView ? 'super_admin' : 'manufacturer';

  // State for finance margins
  const [productMargin, setProductMargin] = useState(80);
  const [shippingMargin, setShippingMargin] = useState(5);
  const [sampleMargin, setSampleMargin] = useState(80);
  const [clothingFee, setClothingFee] = useState(6); // Flat fee for clothing products
  const [marginsLoaded, setMarginsLoaded] = useState(false);

  // Collapsible state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (forceExpanded) return false;
    if (autoCollapse) return true;
    const productStatus = (product as any)?.product_status;
    return productStatus === 'in_production' || productStatus === 'in_transit';
  });

  // State for notes
  const [tempBulkNotes, setTempBulkNotes] = useState('');

  // Loading states
  const [savingBulkSection, setSavingBulkSection] = useState(false);
  const [savingVariantNotes, setSavingVariantNotes] = useState(false);
  const [bulkSectionDirty, setBulkSectionDirty] = useState(false);
  const [processingProduct, setProcessingProduct] = useState(false);
  
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingBulkMedia, setUploadingBulkMedia] = useState(false);
  const [showNewHistoryDot, setShowNewHistoryDot] = useState(hasNewHistory);

  // Variant state
  const [variantNotes, setVariantNotes] = useState<{ [key: string]: string }>({});
  const [itemQuantities, setItemQuantities] = useState<{ [key: string]: string }>({});
  const [editingVariants, setEditingVariants] = useState(false);
  const [showAllVariants, setShowAllVariants] = useState(false);
  const [variantsDirty, setVariantsDirty] = useState(false);

  // Pricing state
  const [productPrice, setProductPrice] = useState((product as any).product_price?.toString() || '');
  const [productionTime, setProductionTime] = useState((product as any).production_time || '');
  const [productionDays, setProductionDays] = useState((product as any).production_days?.toString() || '');
  const [shippingAirPrice, setShippingAirPrice] = useState((product as any).shipping_air_price?.toString() || '');
  const [shippingBoatPrice, setShippingBoatPrice] = useState((product as any).shipping_boat_price?.toString() || '');
  const [manufacturerNotes, setManufacturerNotes] = useState((product as any).manufacturer_notes || '');

  // Pending files
  const [pendingBulkFiles, setPendingBulkFiles] = useState<File[]>([]);

  // Shipping allocation
  const [applyShippingToOthers, setApplyShippingToOthers] = useState(false);
  const [selectedProductsForShipping, setSelectedProductsForShipping] = useState<string[]>([]);

  // Original values for comparison
  const [originalValues, setOriginalValues] = useState({
    productPrice: (product as any).product_price?.toString() || '',
    productionTime: (product as any).production_time || '',
    productionDays: (product as any).production_days?.toString() || '',
    shippingAirPrice: (product as any).shipping_air_price?.toString() || '',
    shippingBoatPrice: (product as any).shipping_boat_price?.toString() || '',
    manufacturerNotes: (product as any).manufacturer_notes || '',
  });

  // Calculate total quantity from state values
  const totalQuantity = Object.keys(itemQuantities).reduce((sum, itemId) => {
    return sum + (parseInt(itemQuantities[itemId]) || 0);
  }, 0);

  // Calculate manufacturer total
  const manufacturerTotal = useMemo(() => {
    let total = 0;
    const unitPrice = parseFloat(productPrice) || 0;
    total += unitPrice * totalQuantity;

    if ((product as any).selected_shipping_method === 'air') {
      total += parseFloat(shippingAirPrice) || 0;
    } else if ((product as any).selected_shipping_method === 'boat') {
      total += parseFloat(shippingBoatPrice) || 0;
    }
    return total;
  }, [productPrice, totalQuantity, shippingAirPrice, shippingBoatPrice, (product as any).selected_shipping_method]);

  // Load margins with client priority
  useEffect(() => {
    const loadMargins = async () => {
      try {
        const orderId = (product as any).order_id;
        if (!orderId) {
          setMarginsLoaded(true);
          return;
        }

        const { data: orderData } = await supabase
          .from('orders')
          .select('client_id')
          .eq('id', orderId)
          .single();

        if (!orderData?.client_id) {
          setMarginsLoaded(true);
          return;
        }

        const { data: clientData } = await supabase
          .from('clients')
          .select('custom_margin_percentage, custom_shipping_margin_percentage, custom_sample_margin_percentage')
          .eq('id', orderData.client_id)
          .single();

        const { data: systemConfig } = await supabase
          .from('system_config')
          .select('config_key, config_value')
          .in('config_key', ['default_margin_percentage', 'default_shipping_margin_percentage', 'default_sample_margin_percentage', 'clothing_product_fee']);

        let sysProduct = 80, sysShipping = 5, sysSample = 80, sysClothingFee = 6;
        if (systemConfig) {
          systemConfig.forEach((c) => {
            if (c.config_key === 'default_margin_percentage') sysProduct = parseFloat(c.config_value) || 80;
            if (c.config_key === 'default_shipping_margin_percentage') sysShipping = parseFloat(c.config_value) || 5;
            if (c.config_key === 'default_sample_margin_percentage') sysSample = parseFloat(c.config_value) || 80;
            if (c.config_key === 'clothing_product_fee') sysClothingFee = parseFloat(c.config_value) || 6;
          });
        }

        setProductMargin(clientData?.custom_margin_percentage ?? sysProduct);
        setShippingMargin(clientData?.custom_shipping_margin_percentage ?? sysShipping);
        setSampleMargin(clientData?.custom_sample_margin_percentage ?? sysSample);
        setClothingFee(sysClothingFee);
        setMarginsLoaded(true);
      } catch (error) {
        console.error('Error loading margins:', error);
        setMarginsLoaded(true);
      }
    };
    loadMargins();
  }, [(product as any).order_id]);

  // Initialize variants from items
  useEffect(() => {
    const initialQuantities: { [key: string]: string } = {};
    const initialNotes: { [key: string]: string } = {};
    items.forEach((item) => {
      initialQuantities[item.id] = item.quantity?.toString() || '0';
      initialNotes[item.id] = item.notes || '';
    });
    setItemQuantities(initialQuantities);
    setVariantNotes(initialNotes);
  }, [items]);

  // Update original values when product changes
  useEffect(() => {
    setOriginalValues({
      productPrice: (product as any).product_price?.toString() || '',
      productionTime: (product as any).production_time || '',
      productionDays: (product as any).production_days?.toString() || '',
      shippingAirPrice: (product as any).shipping_air_price?.toString() || '',
      shippingBoatPrice: (product as any).shipping_boat_price?.toString() || '',
      manufacturerNotes: (product as any).manufacturer_notes || '',
    });
    setProductPrice((product as any).product_price?.toString() || '');
    setProductionTime((product as any).production_time || '');
    setProductionDays((product as any).production_days?.toString() || '');
    setShippingAirPrice((product as any).shipping_air_price?.toString() || '');
    setShippingBoatPrice((product as any).shipping_boat_price?.toString() || '');
    setManufacturerNotes((product as any).manufacturer_notes || '');
    setPendingBulkFiles([]);
  }, [product]);

  // Initialize shipping allocation from database
  useEffect(() => {
    if ((product as any).shipping_linked_products) {
      try {
        const linkedProducts = JSON.parse((product as any).shipping_linked_products);
        if (Array.isArray(linkedProducts) && linkedProducts.length > 0) {
          setApplyShippingToOthers(true);
          setSelectedProductsForShipping(linkedProducts);
        }
      } catch (e) {
        console.error('Error parsing shipping_linked_products:', e);
      }
    }
  }, [(product as any).shipping_linked_products]);

  const getCurrentUser = () => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      return { id: user.id || crypto.randomUUID(), name: user.name || user.email || 'Unknown User' };
    }
    return { id: crypto.randomUUID(), name: 'Unknown User' };
  };

  // SAVE ALL FUNCTION
  useImperativeHandle(ref, () => ({
    saveAll: async () => {
      try {
        const mfgProductPrice = productPrice ? parseFloat(productPrice) : null;
        const mfgAirPrice = shippingAirPrice ? parseFloat(shippingAirPrice) : null;
        const mfgBoatPrice = shippingBoatPrice ? parseFloat(shippingBoatPrice) : null;

        // Check if product is marked as clothing - use flat fee instead of percentage margin
        const isClothing = (product as any).product?.is_clothing === true;
        const clientProductPrice = mfgProductPrice
          ? (isClothing
              ? mfgProductPrice + clothingFee  // Clothing: add flat fee (e.g., $27.50 + $6 = $33.50)
              : mfgProductPrice * (1 + productMargin / 100))  // Regular: apply margin %
          : null;
        const clientAirPrice = mfgAirPrice ? mfgAirPrice * (1 + shippingMargin / 100) : null;
        const clientBoatPrice = mfgBoatPrice ? mfgBoatPrice * (1 + shippingMargin / 100) : null;

        let finalManufacturerNotes = manufacturerNotes || '';
        if (tempBulkNotes && tempBulkNotes.trim()) {
          const timestamp = new Date().toLocaleDateString();
          finalManufacturerNotes = manufacturerNotes
            ? `${manufacturerNotes}\n\n[${timestamp} - Manufacturer] ${tempBulkNotes.trim()}`
            : `[${timestamp} - Manufacturer] ${tempBulkNotes.trim()}`;
        }

        let shippingLinkNote = '';
        if (applyShippingToOthers && selectedProductsForShipping.length > 0) {
          const selectedNames = selectedProductsForShipping
            .map((id) => {
              const prod = allOrderProducts.find((p) => (p as any).id === id);
              return (prod as any)?.product_order_number || id;
            })
            .join(', ');
          shippingLinkNote = `Shipping fees apply to: ${selectedNames}`;
        }

        const productUpdateData: any = {
          product_price: mfgProductPrice,
          shipping_air_price: mfgAirPrice,
          shipping_boat_price: mfgBoatPrice,
          client_product_price: clientProductPrice,
          client_shipping_air_price: clientAirPrice,
          client_shipping_boat_price: clientBoatPrice,
          production_time: productionTime || null,
          production_days: productionDays ? parseInt(productionDays) : null,
          manufacturer_notes: finalManufacturerNotes || null,
          shipping_linked_products: applyShippingToOthers && selectedProductsForShipping.length > 0
            ? JSON.stringify(selectedProductsForShipping) : null,
          shipping_link_note: shippingLinkNote || null,
        };

        if (tempBulkNotes && tempBulkNotes.trim()) {
          productUpdateData.client_notes = tempBulkNotes.trim();
        }

        const { error: productError } = await supabase
          .from('order_products')
          .update(productUpdateData)
          .eq('id', (product as any).id);

        if (productError) throw productError;

        // Update linked products
        if (applyShippingToOthers && selectedProductsForShipping.length > 0) {
          for (const linkedProductId of selectedProductsForShipping) {
            await supabase
              .from('order_products')
              .update({
                shipping_link_note: `Shipping fees included with ${(product as any).product_order_number}`,
                shipping_air_price: 0,
                shipping_boat_price: 0,
                client_shipping_air_price: 0,
                client_shipping_boat_price: 0,
              })
              .eq('id', linkedProductId);
          }
        }

        // Save variants
        for (const item of items) {
          const newQty = parseInt(itemQuantities[item.id]) || 0;
          const newNote = variantNotes[item.id] || '';
          await supabase
            .from('order_items')
            .update({ quantity: newQty, notes: newNote })
            .eq('id', item.id);
        }

        // Upload pending files
        if (pendingBulkFiles.length > 0) {
          const user = getCurrentUser();
          for (const file of pendingBulkFiles) {
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(2, 8);
            const storagePath = `${(product as any).order_id}/${(product as any).id}/${timestamp}_${randomStr}_${file.name}`;

            const { error: uploadError } = await supabase.storage
              .from('order-media')
              .upload(storagePath, file);

            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage.from('order-media').getPublicUrl(storagePath);
              await supabase.from('order_media').insert({
                order_product_id: (product as any).id,
                file_url: publicUrl,
                file_type: file.type.startsWith('image/') ? 'image' : 'document',
                uploaded_by: user.id,
                original_filename: file.name,
                display_name: file.name,
              });
            }
          }
        }

        setTempBulkNotes('');
        setPendingBulkFiles([]);
        setBulkSectionDirty(false);
        setEditingVariants(false);
        setVariantsDirty(false);

        if (finalManufacturerNotes !== manufacturerNotes) {
          setManufacturerNotes(finalManufacturerNotes);
        }

        return true;
      } catch (error) {
        console.error('SaveAll error:', error);
        return false;
      }
    },
    getState: () => ({
      productPrice,
      productionTime,
      productionDays,
      shippingAir: shippingAirPrice,
      shippingBoat: shippingBoatPrice,
      manufacturerNotes,
      tempBulkNotes,
      itemQuantities,
      variantNotes,
      pendingBulkFiles,
      margins: { product: productMargin, shipping: shippingMargin, sample: sampleMargin }
    }),
  }), [
    productPrice, productionTime, productionDays, shippingAirPrice, shippingBoatPrice,
    manufacturerNotes, tempBulkNotes, itemQuantities, variantNotes, pendingBulkFiles,
    items, productMargin, shippingMargin, sampleMargin, marginsLoaded,
    applyShippingToOthers, selectedProductsForShipping, allOrderProducts,
    (product as any).id, (product as any).order_id
  ]);

  // Handlers
  const handleToggleLock = async () => {
    setProcessingProduct(true);
    try {
      const newLockStatus = !(product as any).is_locked;
      const newProductStatus = newLockStatus ? 'in_production' : 'pending_manufacturer';

      // Build update data
      const updateData: any = {
        is_locked: newLockStatus,
        product_status: newProductStatus,
      };

      // Set production_start_date when locking (starting production)
      if (newLockStatus) {
        updateData.production_start_date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      }

      await supabase
        .from('order_products')
        .update(updateData)
        .eq('id', (product as any).id);

      if (newLockStatus && !forceExpanded) setIsCollapsed(true);
      onUpdate();
    } catch (error) {
      console.error('Error toggling lock:', error);
    } finally {
      setProcessingProduct(false);
    }
  };

  const handleSaveBulkSection = async () => {
    setSavingBulkSection(true);
    try {
      const user = getCurrentUser();
      const price = parseFloat(productPrice) || 0;
      const airPrice = parseFloat(shippingAirPrice) || 0;
      const boatPrice = parseFloat(shippingBoatPrice) || 0;

      if (price < 0 || airPrice < 0 || boatPrice < 0) {
        alert('Prices cannot be negative');
        return;
      }

      let finalManufacturerNotes = manufacturerNotes;
      if (tempBulkNotes && tempBulkNotes.trim()) {
        const timestamp = new Date().toLocaleDateString();
        finalManufacturerNotes = manufacturerNotes
          ? `${manufacturerNotes}\n\n[${timestamp} - Manufacturer] ${tempBulkNotes.trim()}`
          : `[${timestamp} - Manufacturer] ${tempBulkNotes.trim()}`;
      }

      let shippingLinkNote = '';
      if (applyShippingToOthers && selectedProductsForShipping.length > 0) {
        const selectedNames = selectedProductsForShipping
          .map((id) => {
            const prod = allOrderProducts.find((p) => (p as any).id === id);
            return (prod as any)?.product_order_number || id;
          })
          .join(', ');
        shippingLinkNote = `Shipping fees apply to: ${selectedNames}`;
      }

      const mfgProductPrice = productPrice ? parseFloat(productPrice) : null;
      const mfgAirPrice = shippingAirPrice ? parseFloat(shippingAirPrice) : null;
      const mfgBoatPrice = shippingBoatPrice ? parseFloat(shippingBoatPrice) : null;

      // Check if product is marked as clothing - use flat fee instead of percentage margin
      const isClothing = (product as any).product?.is_clothing === true;
      const clientProductPrice = mfgProductPrice
        ? (isClothing
            ? mfgProductPrice + clothingFee  // Clothing: add flat fee
            : mfgProductPrice * (1 + productMargin / 100))  // Regular: apply margin %
        : null;
      const clientAirPrice = mfgAirPrice ? mfgAirPrice * (1 + shippingMargin / 100) : null;
      const clientBoatPrice = mfgBoatPrice ? mfgBoatPrice * (1 + shippingMargin / 100) : null;

      const updateData: any = {
        product_price: mfgProductPrice,
        shipping_air_price: mfgAirPrice,
        shipping_boat_price: mfgBoatPrice,
        client_product_price: clientProductPrice,
        client_shipping_air_price: clientAirPrice,
        client_shipping_boat_price: clientBoatPrice,
        production_time: productionTime || null,
        production_days: productionDays ? parseInt(productionDays) : null,
        manufacturer_notes: finalManufacturerNotes || null,
        shipping_linked_products: applyShippingToOthers && selectedProductsForShipping.length > 0
          ? JSON.stringify(selectedProductsForShipping) : null,
        shipping_link_note: shippingLinkNote || null,
      };

      if (tempBulkNotes && tempBulkNotes.trim()) {
        updateData.client_notes = tempBulkNotes.trim();
      }

      const { error } = await supabase
        .from('order_products')
        .update(updateData)
        .eq('id', (product as any).id);

      if (error) {
        alert(`Failed to save: ${error.message || 'Unknown error'}`);
        return;
      }

      // Update linked products
      if (applyShippingToOthers && selectedProductsForShipping.length > 0) {
        for (const linkedProductId of selectedProductsForShipping) {
          await supabase
            .from('order_products')
            .update({
              shipping_link_note: `Shipping fees included with ${(product as any).product_order_number}`,
              shipping_air_price: 0,
              shipping_boat_price: 0,
              client_shipping_air_price: 0,
              client_shipping_boat_price: 0,
            })
            .eq('id', linkedProductId);
        }
      }

      // Upload files
      if (pendingBulkFiles.length > 0) {
        for (const file of pendingBulkFiles) {
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(2, 8);
          const storagePath = `${(product as any).order_id}/${(product as any).id}/${timestamp}_${randomStr}_${file.name}`;

          const { error: uploadError } = await supabase.storage
            .from('order-media')
            .upload(storagePath, file);

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('order-media').getPublicUrl(storagePath);
            await supabase.from('order_media').insert({
              order_product_id: (product as any).id,
              file_url: publicUrl,
              file_type: file.type.startsWith('image/') ? 'image' : 'document',
              uploaded_by: user.id,
              original_filename: file.name,
              display_name: file.name,
            });
          }
        }
      }

      setOriginalValues((prev) => ({
        ...prev,
        productPrice,
        productionTime,
        productionDays,
        shippingAirPrice,
        shippingBoatPrice,
        manufacturerNotes: finalManufacturerNotes,
      }));

      setManufacturerNotes(finalManufacturerNotes);
      setTempBulkNotes('');
      setPendingBulkFiles([]);
      setBulkSectionDirty(false);
      setShowNewHistoryDot(true);

      if (onExpand) onExpand();
      await onUpdate();
    } catch (error) {
      console.error('Error saving bulk section:', error);
      alert('An error occurred while saving. Please try again.');
    } finally {
      setSavingBulkSection(false);
    }
  };

  const handleBulkFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setPendingBulkFiles((prev) => [...prev, ...Array.from(files)]);
    setBulkSectionDirty(true);
    if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
  };

  const removePendingBulkFile = (index: number) => {
    setPendingBulkFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteMedia = async (mediaId: string) => {
    try {
      await supabase.from('order_media').delete().eq('id', mediaId);
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
        const newQty = parseInt(itemQuantities[item.id]) || 0;
        const newNote = variantNotes[item.id] || '';

        if (newQty !== item.quantity || newNote !== (item.notes || '')) {
          await supabase
            .from('order_items')
            .update({ quantity: newQty, notes: newNote })
            .eq('id', item.id);
        }
      }
      setEditingVariants(false);
      setVariantsDirty(false);
      setShowAllVariants(false);
      await onUpdate();
    } catch (error) {
      console.error('Error saving variant notes:', error);
    } finally {
      setSavingVariantNotes(false);
    }
  };

  const handleExpand = () => {
    setIsCollapsed(false);
    if (onExpand) onExpand();
  };

  const toggleExpanded = () => setIsCollapsed(!isCollapsed);

  // Filter variants for display
  const visibleVariants = showAllVariants || editingVariants
    ? items
    : items.filter((item) => parseInt(itemQuantities[item.id]) || 0 > 0);

  const hasHiddenVariants = items.some((item) => (parseInt(itemQuantities[item.id]) || 0) === 0);

  // Separate media types
  const referenceMedia = media.filter((m) => m.file_type === 'document' || m.file_type === 'image');

  // Get variant type name
  const getVariantTypeName = () => {
    if (items.length > 0 && items[0].variant_combo) {
      const combo = items[0].variant_combo.toLowerCase();
      if (/\b\d+(\.\d+)?\b/.test(combo) && (combo.includes('us') || combo.includes('eu') || combo.includes('uk'))) {
        return 'Shoe Size';
      }
      if (combo.includes('small') || combo.includes('medium') || combo.includes('large') || combo.includes('xl')) {
        return 'Size';
      }
      if (combo.includes('color') || combo.includes('colour')) {
        return 'Color';
      }
      return 'Variant';
    }
    return 'Variant';
  };

  const displayStatus = (product as any).product_status || 'sent_to_manufacturer';
  const productName = (product as any).description || (product as any).product?.title || 'Product';
  const hasUnreadMessages = showNewHistoryDot || hasNewHistory;

  const getStatusColor = (status: string): string => {
    const statusColors: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-700',
      pending_manufacturer: 'bg-purple-100 text-purple-700',
      sent_to_manufacturer: 'bg-purple-100 text-purple-700',
      in_production: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      shipped: 'bg-green-100 text-green-700',
      in_transit: 'bg-cyan-100 text-cyan-700',
    };
    return statusColors[status] || statusColors.pending;
  };

  const formatStatus = (status: string): string => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // COLLAPSED VIEW - Use shared component
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
        translate={translate}
        t={t}
      />
    );
  }

  // EXPANDED VIEW
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden hover:shadow-xl transition-shadow">
      {/* HEADER - Tight layout matching Admin V2 */}
      <div className="p-2.5 sm:p-3 border-b-2 cursor-pointer bg-gray-50 border-gray-200" onClick={toggleExpanded}>
        {/* Row 1: Product name + status + action buttons */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
            <button
              className="p-0.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
              onClick={(e) => { e.stopPropagation(); toggleExpanded(); }}
            >
              <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
            </button>
            
            <div className="flex-shrink-0">
              {hasUnreadMessages ? (
                <MessageSquare className="w-4 h-4 text-orange-500" />
              ) : (
                <FolderOpen className="w-4 h-4 text-gray-400" />
              )}
            </div>
            
            <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">{productName}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(displayStatus)}`}>
                {formatStatus(displayStatus)}
              </span>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {onViewHistory && (
              <button
                onClick={(e) => { e.stopPropagation(); handleViewHistory(); }}
                className="px-2 py-1 bg-gray-600 text-white rounded text-xs font-medium flex items-center gap-1 relative"
              >
                <MessageSquare className="w-3 h-3" />
                <span>History</span>
                {hasUnreadMessages && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
              </button>
            )}
            {onRoute && (
              <button
                onClick={(e) => { e.stopPropagation(); onRoute(product); }}
                className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
                <span>Route</span>
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); handleToggleLock(); }}
              disabled={processingProduct}
              className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                (product as any).is_locked
                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                  : 'bg-green-100 text-green-600 hover:bg-green-200'
              } disabled:opacity-50`}
            >
              {processingProduct ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (product as any).is_locked ? (
                <Lock className="w-3 h-3" />
              ) : (
                <Unlock className="w-3 h-3" />
              )}
              <span>{(product as any).is_locked ? 'Unlock' : 'Lock'}</span>
            </button>
          </div>
        </div>
        
        {/* Row 2: Product number + Qty + Mfg Total */}
        <div className="flex items-center justify-between mt-1 ml-6 sm:ml-7">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">{(product as any).product_order_number || 'No number'}</span>
            <span className="text-gray-300 text-xs">•</span>
            <span className="text-xs text-gray-500">Qty: <span className="font-semibold text-gray-700">{totalQuantity}</span></span>
            
            {/* Mfg Total Badge */}
            {manufacturerTotal > 0 && (
              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">
                <Calculator className="w-3 h-3" />
                <span>Mfg Total: ${formatCurrency(manufacturerTotal)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="p-3 sm:p-4">
        {/* Shipping link note */}
        {(product as any).shipping_link_note && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-300 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <span className="font-medium">Shipping Note:</span> {(product as any).shipping_link_note}
            </div>
          </div>
        )}

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
            onChange={(e) => { setTempBulkNotes(e.target.value); setBulkSectionDirty(true); }}
            placeholder="Add bulk order instructions, shipping details, production notes..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>

        {/* Bulk Order Media */}
        <input ref={bulkFileInputRef} type="file" multiple accept={ACCEPTED_FILE_TYPES} onChange={handleBulkFileUpload} className="hidden" />
        
        <FileUploadDisplay
          files={referenceMedia}
          pendingFiles={pendingBulkFiles}
          onFileClick={handleFileClick}
          onDeleteFile={handleDeleteMedia}
          onRemovePending={removePendingBulkFile}
          onAddFiles={() => bulkFileInputRef.current?.click()}
          title="Bulk Order Media"
          loading={uploadingBulkMedia}
          translate={translate}
          t={t}
        />

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Price (Your Cost)</label>
            <div className="relative">
              <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={productPrice}
                onChange={(e) => { setProductPrice(e.target.value); setBulkSectionDirty(true); }}
                placeholder="Enter price"
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Production Time</label>
            <div className="relative">
              <Clock className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={productionTime}
                onChange={(e) => { setProductionTime(e.target.value); setBulkSectionDirty(true); }}
                placeholder="e.g., 2-3 weeks"
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Production Days</label>
            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                min="1"
                value={productionDays}
                onChange={(e) => { setProductionDays(e.target.value); setBulkSectionDirty(true); }}
                placeholder="e.g., 25"
                className="w-full pl-8 pr-12 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-400">days</span>
            </div>
          </div>
        </div>

        {/* Shipping Options */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-sm font-semibold text-gray-800">Shipping Options & Pricing</h5>
            
            {/* Shipping allocation checkbox */}
            {allOrderProducts && allOrderProducts.length > 1 && (
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyShippingToOthers}
                  onChange={(e) => {
                    setApplyShippingToOthers(e.target.checked);
                    if (!e.target.checked) setSelectedProductsForShipping([]);
                    setBulkSectionDirty(true);
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <Link2 className="w-4 h-4 text-yellow-600" />
                <span>Apply to multiple products</span>
              </label>
            )}
          </div>

          {/* Shipping allocation dropdown */}
          {applyShippingToOthers && allOrderProducts && allOrderProducts.length > 1 && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-gray-600 mb-2">Select products to share shipping:</p>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded p-2 bg-white">
                {allOrderProducts
                  .filter((p) => (p as any).id !== (product as any).id)
                  .map((p) => (
                    <label key={(p as any).id} className="flex items-start gap-2 py-1.5 px-2 hover:bg-gray-50 cursor-pointer rounded">
                      <input
                        type="checkbox"
                        checked={selectedProductsForShipping.includes((p as any).id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProductsForShipping((prev) => [...prev, (p as any).id]);
                          } else {
                            setSelectedProductsForShipping((prev) => prev.filter((id) => id !== (p as any).id));
                          }
                          setBulkSectionDirty(true);
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded mt-0.5"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-semibold text-gray-900">{(p as any).product_order_number}</span>
                        <span className="text-xs text-gray-600 ml-2">- {(p as any).description || 'No description'}</span>
                      </div>
                    </label>
                  ))}
              </div>
              {selectedProductsForShipping.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-green-600 font-medium mt-2">
                  <CheckCircle className="w-3 h-3" />
                  Shipping linked with {selectedProductsForShipping.length} product(s)
                </div>
              )}
            </div>
          )}

          {/* Client selected shipping method indicator */}
          {(product as any).selected_shipping_method && (
            <div className="mb-4 p-3 bg-white rounded-lg border-2 border-blue-400">
              <p className="text-xs font-medium text-blue-700 mb-2">CLIENT SELECTED:</p>
              <div className="flex items-center gap-3">
                {(product as any).selected_shipping_method === 'air' ? (
                  <>
                    <div className="p-2 bg-blue-100 rounded-full"><Plane className="w-5 h-5 text-blue-600" /></div>
                    <div>
                      <span className="text-base font-bold text-blue-800">AIR SHIPPING</span>
                      {shippingAirPrice && <p className="text-sm text-blue-600">Price: ${formatCurrency(parseFloat(shippingAirPrice))}</p>}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-2 bg-cyan-100 rounded-full"><Ship className="w-5 h-5 text-cyan-600" /></div>
                    <div>
                      <span className="text-base font-bold text-cyan-800">BOAT SHIPPING</span>
                      {shippingBoatPrice && <p className="text-sm text-cyan-600">Price: ${formatCurrency(parseFloat(shippingBoatPrice))}</p>}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Shipping price inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Air Shipping Price (Your Cost)</label>
              <div className="relative">
                <Plane className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingAirPrice}
                  onChange={(e) => { setShippingAirPrice(e.target.value); setBulkSectionDirty(true); }}
                  placeholder="Enter air price"
                  disabled={!!(product as any).shipping_link_note}
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Boat Shipping Price (Your Cost)</label>
              <div className="relative">
                <Ship className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingBoatPrice}
                  onChange={(e) => { setShippingBoatPrice(e.target.value); setBulkSectionDirty(true); }}
                  placeholder="Enter boat price"
                  disabled={!!(product as any).shipping_link_note}
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Manufacturing Cost Summary */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4">
          <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
            <Calculator className="w-4 h-4 mr-2" />
            Manufacturing Cost Summary
          </h5>
          <div className="space-y-2 text-sm">
            {productPrice && totalQuantity > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-700">Product: ${formatCurrency(parseFloat(productPrice))} × {totalQuantity} units</span>
                <span className="font-semibold text-gray-900">${formatCurrency(parseFloat(productPrice) * totalQuantity)}</span>
              </div>
            )}
            {(product as any).selected_shipping_method && !(product as any).shipping_link_note && (
              <div className="flex justify-between">
                <span className="text-gray-700">
                  Shipping ({(product as any).selected_shipping_method === 'air' ? 'Air' : 'Boat'})
                  {applyShippingToOthers && selectedProductsForShipping.length > 0 && (
                    <span className="text-xs text-green-600 ml-1">(shared with {selectedProductsForShipping.length} products)</span>
                  )}
                </span>
                <span className="font-semibold text-gray-900">
                  ${(product as any).selected_shipping_method === 'air'
                    ? formatCurrency(parseFloat(shippingAirPrice) || 0)
                    : formatCurrency(parseFloat(shippingBoatPrice) || 0)}
                </span>
              </div>
            )}
            {(product as any).shipping_link_note && (
              <div className="text-xs text-blue-600 italic">{(product as any).shipping_link_note}</div>
            )}
            <div className="pt-2 border-t border-gray-300">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-800">Total Manufacturing Cost</span>
                <span className="font-bold text-gray-900 text-base">${formatCurrency(manufacturerTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Save button */}
        {bulkSectionDirty && (
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 mb-4">
            <button
              onClick={() => {
                setProductPrice(originalValues.productPrice);
                setProductionTime(originalValues.productionTime);
                setProductionDays(originalValues.productionDays);
                setShippingAirPrice(originalValues.shippingAirPrice);
                setShippingBoatPrice(originalValues.shippingBoatPrice);
                setManufacturerNotes(originalValues.manufacturerNotes);
                setTempBulkNotes('');
                setPendingBulkFiles([]);
                setBulkSectionDirty(false);
                setApplyShippingToOthers(false);
                setSelectedProductsForShipping([]);
              }}
              disabled={savingBulkSection}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveBulkSection}
              disabled={savingBulkSection}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 font-medium"
            >
              {savingBulkSection ? (
                <><Loader2 className="w-3 h-3 animate-spin" />Saving...</>
              ) : (
                <><Save className="w-3 h-3" />Save Bulk Section</>
              )}
            </button>
          </div>
        )}

        {/* Variant Details */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-sm font-semibold text-gray-800">
              {getVariantTypeName()} Details
              {!showAllVariants && hasHiddenVariants && !editingVariants && (
                <span className="ml-2 text-xs text-gray-500 font-normal">
                  (Showing {visibleVariants.length} of {items.length})
                </span>
              )}
            </h5>
            <div className="flex items-center gap-2">
              {!editingVariants && hasHiddenVariants && (
                <button
                  onClick={() => setShowAllVariants(!showAllVariants)}
                  className="px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1.5"
                >
                  {showAllVariants ? <><EyeOff className="w-3.5 h-3.5" />Hide Empty</> : <><Eye className="w-3.5 h-3.5" />Show All</>}
                </button>
              )}
              {!editingVariants && (
                <button
                  onClick={() => { setEditingVariants(true); setShowAllVariants(true); }}
                  className="px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />Edit
                </button>
              )}
            </div>
          </div>

          {/* Variant table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700" style={{ width: '30%' }}>{getVariantTypeName()}</th>
                  <th className="text-left py-2 px-1 text-sm font-medium text-gray-700" style={{ width: '20%' }}>Qty</th>
                  <th className="text-left py-2 pl-2 pr-3 text-sm font-medium text-gray-700" style={{ width: '50%' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {visibleVariants.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="py-2 px-3 text-sm text-gray-900 font-medium">{translate(item.variant_combo)}</td>
                    <td className="py-2 px-1">
                      {editingVariants ? (
                        <input
                          type="number"
                          min="0"
                          value={itemQuantities[item.id] || '0'}
                          onChange={(e) => { setItemQuantities((prev) => ({ ...prev, [item.id]: e.target.value })); setVariantsDirty(true); }}
                          className="w-24 px-2 py-1 text-sm text-gray-900 font-medium border border-gray-300 rounded"
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-900">{itemQuantities[item.id] || '0'}</span>
                      )}
                    </td>
                    <td className="py-2 pl-2 pr-3">
                      <input
                        type="text"
                        value={variantNotes[item.id] || ''}
                        onChange={(e) => { setVariantNotes((prev) => ({ ...prev, [item.id]: e.target.value })); setVariantsDirty(true); if (!editingVariants) setEditingVariants(true); }}
                        placeholder="Add note..."
                        disabled={!editingVariants}
                        className="w-full px-2 py-1 text-sm text-gray-900 border border-gray-300 rounded placeholder-gray-500 disabled:bg-gray-50 disabled:text-gray-700"
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
                  const originalNotes: { [key: string]: string } = {};
                  const originalQtys: { [key: string]: string } = {};
                  items.forEach((item) => {
                    originalNotes[item.id] = item.notes || '';
                    originalQtys[item.id] = item.quantity?.toString() || '0';
                  });
                  setVariantNotes(originalNotes);
                  setItemQuantities(originalQtys);
                  setEditingVariants(false);
                  setVariantsDirty(false);
                  setShowAllVariants(false);
                }}
                disabled={savingVariantNotes}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
              >
                <X className="w-4 h-4" />Cancel
              </button>
              <button
                onClick={handleSaveVariantNotes}
                disabled={savingVariantNotes}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                {savingVariantNotes ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save Variants</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
