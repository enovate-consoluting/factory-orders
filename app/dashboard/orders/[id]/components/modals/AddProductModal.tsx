/**
 * AddProductModal - Modal for adding a new product to an existing order
 * REDESIGNED: Large modal, card-style product grid, two-step flow
 * Step 1: Select product from card grid (like ProductSelector)
 * Step 2: Configure variants, description, notes, media
 * Shows invoice warning if invoices already exist
 * Roles: Admin, Super Admin
 * Last Modified: December 2025
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  X, Package, Plus, Search, Loader2, AlertTriangle,
  Upload, FileText, ChevronLeft, Check, ArrowRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/lib/constants/fileUpload';

interface Product {
  id: string;
  title: string;
  description?: string;
  variants?: {
    type: string;
    options: string[];
  }[];
}

interface VariantItem {
  variantCombo: string;
  quantity: number;
  notes: string;
}

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  onSuccess: () => void;
}

export function AddProductModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  onSuccess
}: AddProductModalProps) {
  // Step state: 1 = select product, 2 = configure
  const [step, setStep] = useState<1 | 2>(1);

  // Product catalog state
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected product state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDescription, setProductDescription] = useState('');
  const [bulkNotes, setBulkNotes] = useState('');
  const [variantItems, setVariantItems] = useState<VariantItem[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);

  // Invoice warning state
  const [invoiceCount, setInvoiceCount] = useState(0);

  // Submission state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load products catalog
  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      checkExistingInvoices();
      // Reset state when opening
      setStep(1);
      setSelectedProduct(null);
      setProductDescription('');
      setBulkNotes('');
      setVariantItems([]);
      setMediaFiles([]);
      setSearchTerm('');
      setError('');
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    };
  }, [isOpen]);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      // Fetch products with variants using same pattern as create order
      const { data: productsData, error } = await supabase
        .from('products')
        .select(`
          *,
          product_variants (
            variant_option_id,
            variant_options (
              id,
              value,
              variant_types (
                id,
                name
              )
            )
          )
        `)
        .order('title');

      if (error) {
        console.error('Error fetching products:', error);
        throw error;
      }

      if (productsData) {
        // Process variants into the same format as create order
        const processedProducts = productsData.map(product => {
          const variantsByType: { [key: string]: string[] } = {};

          product.product_variants?.forEach((pv: any) => {
            const typeName = pv.variant_options?.variant_types?.name;
            const optionValue = pv.variant_options?.value;

            if (typeName && optionValue) {
              if (!variantsByType[typeName]) {
                variantsByType[typeName] = [];
              }
              if (!variantsByType[typeName].includes(optionValue)) {
                variantsByType[typeName].push(optionValue);
              }
            }
          });

          return {
            id: product.id,
            title: product.title,
            description: product.description,
            variants: Object.entries(variantsByType).map(([type, options]) => ({
              type,
              options
            }))
          };
        });

        setProducts(processedProducts);
      }
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError('Failed to load products');
    } finally {
      setLoadingProducts(false);
    }
  };

  const checkExistingInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id')
        .eq('order_id', orderId)
        .neq('status', 'voided');

      if (!error && data) {
        setInvoiceCount(data.length);
      }
    } catch (err) {
      console.error('Error checking invoices:', err);
    }
  };

  const generateVariantCombinations = (product: Product) => {
    if (!product.variants || product.variants.length === 0) {
      setVariantItems([{ variantCombo: 'Default', quantity: 0, notes: '' }]);
      return;
    }

    // Generate all combinations (same logic as create order)
    const combinations: string[] = [];
    const generateCombos = (index: number, current: string[]) => {
      if (index === product.variants!.length) {
        combinations.push(current.join(' / '));
        return;
      }
      const variant = product.variants![index];
      for (const option of variant.options) {
        generateCombos(index + 1, [...current, option]);
      }
    };

    generateCombos(0, []);

    setVariantItems(
      combinations.map(combo => ({
        variantCombo: combo,
        quantity: 0,
        notes: ''
      }))
    );
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setProductDescription(product.description || '');
    generateVariantCombinations(product);
    setStep(2);
  };

  const handleBackToProducts = () => {
    setStep(1);
    setSelectedProduct(null);
    setProductDescription('');
    setBulkNotes('');
    setVariantItems([]);
    setMediaFiles([]);
    setError('');
  };

  const handleQuantityChange = (index: number, value: string) => {
    const qty = parseInt(value) || 0;
    setVariantItems(prev =>
      prev.map((item, i) => (i === index ? { ...item, quantity: qty } : item))
    );
  };

  const handleNotesChange = (index: number, value: string) => {
    setVariantItems(prev =>
      prev.map((item, i) => (i === index ? { ...item, notes: value } : item))
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const validFiles = Array.from(files).filter(file => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(`File "${file.name}" is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
        return false;
      }
      return true;
    });

    setMediaFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getTotalQuantity = () => {
    return variantItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleSubmit = async () => {
    if (!selectedProduct) {
      setError('Please select a product');
      return;
    }

    const totalQty = getTotalQuantity();
    if (totalQty === 0) {
      setError('Please enter quantity for at least one variant');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      // Generate product order number
      const timestamp = Date.now().toString().slice(-4);
      const randomStr = Math.random().toString(36).substring(2, 4).toUpperCase();
      const productOrderNumber = `PRD-${timestamp}${randomStr}`;

      // 1. Insert order_product
      console.log('=== ADDING PRODUCT TO ORDER ===');
      console.log('Order ID:', orderId);
      console.log('Product ID:', selectedProduct.id);
      console.log('User:', user);

      const insertData = {
        order_id: orderId,
        product_id: selectedProduct.id,
        product_order_number: productOrderNumber,
        description: productDescription,
        client_notes: bulkNotes,  // Column is client_notes, not bulk_notes
        product_status: 'pending',
        routed_to: 'admin',
        routed_by: user.id || null,
        routed_at: new Date().toISOString(),
        is_locked: false,
        sample_required: false,
        payment_status: 'unpaid'
      };

      console.log('Insert data:', insertData);

      const { data: orderProduct, error: productError } = await supabase
        .from('order_products')
        .insert(insertData)
        .select()
        .single();

      console.log('Insert result - data:', orderProduct);
      console.log('Insert result - error:', productError);

      if (productError) {
        console.error('Product insert error details:', JSON.stringify(productError, null, 2));
        throw new Error(productError.message || 'Failed to insert product');
      }

      // 2. Insert order_items (variants with quantity > 0)
      const itemsToInsert = variantItems
        .filter(item => item.quantity > 0)
        .map(item => ({
          order_product_id: orderProduct.id,
          variant_combo: item.variantCombo,
          quantity: item.quantity,
          notes: item.notes,
          admin_status: 'pending',
          manufacturer_status: 'pending'
        }));

      console.log('Items to insert:', itemsToInsert);

      if (itemsToInsert.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .insert(itemsToInsert)
          .select();

        console.log('Items insert result:', itemsData);
        if (itemsError) {
          console.error('Items insert error:', JSON.stringify(itemsError, null, 2));
          throw new Error(itemsError.message || 'Failed to insert items');
        }
      }

      // 3. Upload media files
      if (mediaFiles.length > 0) {
        console.log('=== MEDIA UPLOAD START ===');
        console.log('Files to upload:', mediaFiles.length);
        console.log('Order ID:', orderId);
        console.log('Product ID:', orderProduct.id);

        for (let i = 0; i < mediaFiles.length; i++) {
          const file = mediaFiles[i];
          console.log(`\n--- File ${i + 1}/${mediaFiles.length} ---`);
          console.log('File name:', file.name);
          console.log('File type:', file.type);
          console.log('File size:', file.size);

          const ts = Date.now();
          const rand = Math.random().toString(36).substring(2, 8);
          const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
          const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file';
          const uniqueFileName = `${fileNameWithoutExt}_${ts}_${rand}.${fileExt}`;
          const filePath = `${orderId}/${orderProduct.id}/${uniqueFileName}`;

          console.log('Storage path:', filePath);

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('order-media')
            .upload(filePath, file);

          console.log('Storage upload result:', uploadData);

          if (uploadError) {
            console.error('❌ Storage upload error:', JSON.stringify(uploadError, null, 2));
            continue;
          }

          console.log('✅ File uploaded to storage');

          const { data: { publicUrl } } = supabase.storage
            .from('order-media')
            .getPublicUrl(filePath);

          console.log('Public URL:', publicUrl);

          // Use same file_type logic as create order page
          const fileType = file.type.startsWith('image/') ? 'image' : 'document';

          const mediaInsertData = {
            order_id: orderId,
            order_product_id: orderProduct.id,
            file_url: publicUrl,
            file_type: fileType,
            uploaded_by: user.id || null,
            original_filename: file.name,
            display_name: file.name,
            is_sample: false
          };

          console.log('Media record to insert:', mediaInsertData);

          const { data: mediaData, error: mediaError } = await supabase
            .from('order_media')
            .insert(mediaInsertData)
            .select();

          if (mediaError) {
            console.error('❌ order_media insert error:', JSON.stringify(mediaError, null, 2));
          } else {
            console.log('✅ order_media record created:', mediaData);
          }
        }

        console.log('=== MEDIA UPLOAD COMPLETE ===\n');
      } else {
        console.log('No media files to upload');
      }

      // 4. Log audit entry (non-blocking)
      try {
        await supabase.from('audit_log').insert({
          user_id: user.id || null,
          user_name: user.name || user.email || 'Admin',
          action_type: 'product_added_to_order',
          target_type: 'order',
          target_id: orderId,
          new_value: `Added product: ${selectedProduct.title} (${productOrderNumber}) - ${totalQty} units`
        });
      } catch (auditErr) {
        console.warn('Audit log failed (non-critical):', auditErr);
      }

      console.log('✅ Product added successfully!');

      // Success
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('=== ERROR ADDING PRODUCT ===');
      console.error('Error object:', err);
      console.error('Error message:', err?.message);
      console.error('Error details:', err?.details);
      console.error('Error hint:', err?.hint);
      console.error('Error code:', err?.code);
      console.error('Full error JSON:', JSON.stringify(err, null, 2));
      
      const errorMsg = err?.message || err?.details || 'Failed to add product. Please try again.';
      setError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-xl w-full max-w-5xl h-[95vh] sm:h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button
                onClick={handleBackToProducts}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Back to products"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
            )}
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm sm:text-base">
                {step === 1 ? 'Select Product' : `Configure: ${selectedProduct?.title}`}
              </h3>
              <p className="text-xs sm:text-sm text-blue-100">{orderNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Invoice Warning */}
        {invoiceCount > 0 && (
          <div className="flex items-start gap-3 px-4 sm:px-6 py-3 bg-amber-50 border-b border-amber-200 flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                This order has {invoiceCount} invoice{invoiceCount > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-amber-700">
                You may need to void and recreate invoices after adding this product.
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* STEP 1: Product Selection Grid */}
          {step === 1 && (
            <div className="p-4 sm:p-6">
              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search products..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
              </div>

              {/* Product Grid */}
              {loadingProducts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">
                    {products.length === 0 ? 'No products in catalog' : 'No products found'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {filteredProducts.map(product => (
                    <button
                      key={product.id}
                      onClick={() => handleProductSelect(product)}
                      className="text-left border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md hover:bg-blue-50/50 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                          {product.title}
                        </h4>
                        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-1" />
                      </div>
                      
                      {product.description && (
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {product.description}
                        </p>
                      )}

                      {product.variants && product.variants.length > 0 && (
                        <div className="space-y-1">
                          {product.variants.slice(0, 2).map((variant, idx) => (
                            <div key={idx} className="text-xs text-gray-500">
                              <span className="font-medium text-gray-700">{variant.type}:</span>{' '}
                              {variant.options.slice(0, 4).join(', ')}
                              {variant.options.length > 4 && ` +${variant.options.length - 4} more`}
                            </div>
                          ))}
                          {product.variants.length > 2 && (
                            <p className="text-xs text-gray-400">
                              +{product.variants.length - 2} more variant types
                            </p>
                          )}
                        </div>
                      )}

                      <div className="mt-3 pt-2 border-t border-gray-100">
                        <span className="text-xs text-blue-600 font-medium group-hover:text-blue-700">
                          Tap to select →
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Configure Selected Product */}
          {step === 2 && selectedProduct && (
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
              {/* Product Info Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{selectedProduct.title}</h4>
                    {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                      <p className="text-xs text-gray-600">
                        {selectedProduct.variants.map(v => v.type).join(' × ')} • {variantItems.length} combinations
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Product Description
                </label>
                <input
                  type="text"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Enter description for this order..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Bulk Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Bulk Order Notes
                </label>
                <textarea
                  value={bulkNotes}
                  onChange={(e) => setBulkNotes(e.target.value)}
                  placeholder="Special instructions, materials, colors, packaging requirements..."
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Variants Table */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Variants & Quantities
                </label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="max-h-64 sm:max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                            Variant
                          </th>
                          <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase w-20 sm:w-24">
                            Qty
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {variantItems.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-3 py-2.5 text-gray-900 font-medium text-xs sm:text-sm">
                              {item.variantCombo}
                            </td>
                            <td className="px-3 py-2.5">
                              <input
                                type="number"
                                min="0"
                                value={item.quantity || ''}
                                onChange={(e) => handleQuantityChange(index, e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-center text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-3 py-2.5 hidden sm:table-cell">
                              <input
                                type="text"
                                value={item.notes}
                                onChange={(e) => handleNotesChange(index, e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                placeholder="Optional notes"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-gray-50 px-3 py-2.5 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Total: <strong className="text-gray-900">{getTotalQuantity()}</strong> units
                    </span>
                    {getTotalQuantity() === 0 && (
                      <span className="text-xs text-amber-600">Enter at least one quantity</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Media Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Reference Media (optional)
                </label>
                <div className="space-y-2">
                  <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    <Upload className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Upload files</span>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx"
                    />
                  </label>

                  {mediaFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {mediaFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm"
                        >
                          <FileText className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-gray-700 max-w-[120px] sm:max-w-[150px] truncate">
                            {file.name}
                          </span>
                          <button
                            onClick={() => removeFile(index)}
                            className="p-0.5 hover:bg-gray-200 rounded"
                          >
                            <X className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          {step === 1 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} available
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="text-sm text-gray-500 hidden sm:block">
                {selectedProduct && (
                  <span>
                    Adding <strong>{selectedProduct.title}</strong>
                    {getTotalQuantity() > 0 && ` • ${getTotalQuantity()} units`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleBackToProducts}
                  disabled={saving}
                  className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!selectedProduct || getTotalQuantity() === 0 || saving}
                  className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add to Order
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}