/**
 * Product Selector Component
 * Grid display for selecting products with quantities
 * UPDATED: Edit button moved to bottom next to "Tap to add to order"
 * Used in step 2 of order creation
 * Last Modified: November 2025
 */

import React, { useState, useEffect } from 'react';
import { Trash2, Plus, X, Loader2, Edit2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { EditProductVariantsModal } from './EditProductVariantsModal';
import { useTranslation } from 'react-i18next';

interface Product {
  id: string;
  title: string;
  description?: string;
  variants?: {
    type: string;
    options: string[];
  }[];
}

interface ProductSelectorProps {
  products: Product[];
  selectedProducts: { [key: string]: number };
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onProductQuantityChange: (productId: string, quantity: number) => void;
  onProductClick: (productId: string) => void;
  showNotification: (type: 'success' | 'error' | 'info', message: string) => void;
  onProductsRefresh?: () => void;
}

export const ProductSelector: React.FC<ProductSelectorProps> = ({
  products,
  selectedProducts,
  searchQuery,
  onSearchChange,
  onProductQuantityChange,
  onProductClick,
  showNotification,
  onProductsRefresh
}) => {
  const { t } = useTranslation();
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [newProductTitle, setNewProductTitle] = useState('');
  const [selectedVariants, setSelectedVariants] = useState<any[]>([]);
  const [variantTypes, setVariantTypes] = useState<any[]>([]);
  const [addingVariantFor, setAddingVariantFor] = useState<string | null>(null);
  const [newVariantValues, setNewVariantValues] = useState<{ [key: string]: string[] }>({});
  const [saving, setSaving] = useState(false);
  const [savingVariant, setSavingVariant] = useState<string | null>(null);

  // Edit variants modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const getTotalProductsSelected = () => {
    return Object.values(selectedProducts).reduce((sum, qty) => sum + qty, 0);
  };

  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (showNewProductModal) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      fetchVariantTypes();
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    };
  }, [showNewProductModal]);

  const fetchVariantTypes = async () => {
    const { data } = await supabase
      .from('variant_types')
      .select(`
        *,
        variant_options(*)
      `)
      .order('name');
    
    if (data) {
      setVariantTypes(data);
    }
  };

  const handleAddVariant = (variantType: any) => {
    if (!selectedVariants.find(v => v.variant_type_id === variantType.id)) {
      setSelectedVariants([...selectedVariants, {
        variant_type_id: variantType.id,
        variant_type_name: variantType.name,
        options: variantType.variant_options || []
      }]);
    }
  };

  const startAddingOptions = (variantTypeId: string) => {
    setAddingVariantFor(variantTypeId);
    // Initialize with one empty input
    setNewVariantValues(prev => ({
      ...prev,
      [variantTypeId]: ['']
    }));
  };

  const addNewOptionInput = (variantTypeId: string) => {
    setNewVariantValues(prev => ({
      ...prev,
      [variantTypeId]: [...(Array.isArray(prev[variantTypeId]) ? prev[variantTypeId] : []), '']
    }));
  };

  const updateNewOptionValue = (variantTypeId: string, index: number, value: string) => {
    setNewVariantValues(prev => {
      const currentValues = Array.isArray(prev[variantTypeId]) ? prev[variantTypeId] : [];
      const updatedValues = [...currentValues];
      updatedValues[index] = value;
      return {
        ...prev,
        [variantTypeId]: updatedValues
      };
    });
  };

  const removeNewOptionInput = (variantTypeId: string, index: number) => {
    setNewVariantValues(prev => {
      const currentValues = Array.isArray(prev[variantTypeId]) ? prev[variantTypeId] : [];
      return {
        ...prev,
        [variantTypeId]: currentValues.filter((_, i) => i !== index)
      };
    });
  };

  const handleSaveNewVariantOptions = async (variantTypeId: string) => {
    const values = Array.isArray(newVariantValues[variantTypeId]) 
      ? newVariantValues[variantTypeId].filter(v => v.trim())
      : [];
    
    if (values.length === 0) {
      showNotification('error', 'Please enter at least one option');
      return;
    }

    setSavingVariant(variantTypeId);
    try {
      const newOptions: any[] = [];
      
      for (const value of values) {
        const { data: newOption, error } = await supabase
          .from('variant_options')
          .insert({
            type_id: variantTypeId,
            value: value.trim()
          })
          .select()
          .single();

        if (error) {
          console.error('Error adding variant option:', error.message);
          throw error;
        }
        
        if (newOption) {
          newOptions.push(newOption);
        }
      }

      // Update local state
      setSelectedVariants(prev => prev.map(v => 
        v.variant_type_id === variantTypeId
          ? { ...v, options: [...v.options, ...newOptions] }
          : v
      ));

      // Clear inputs
      setNewVariantValues(prev => {
        const updated = { ...prev };
        delete updated[variantTypeId];
        return updated;
      });
      setAddingVariantFor(null);
      showNotification('success', `Added ${newOptions.length} new option${newOptions.length > 1 ? 's' : ''}`);
    } catch (error: any) {
      console.error('Error adding variant options:', error?.message || error);
      showNotification('error', 'Failed to add variant options');
    } finally {
      setSavingVariant(null);
    }
  };

  const handleSaveProduct = async () => {
    if (!newProductTitle.trim()) {
      showNotification('error', 'Please enter a product title');
      return;
    }

    setSaving(true);
    try {
      // Create the product
      const { data: newProduct, error } = await supabase
        .from('products')
        .insert({
          title: newProductTitle.trim(),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Create product-variant mappings
      if (selectedVariants.length > 0) {
        for (const variant of selectedVariants) {
          for (const option of variant.options) {
            await supabase
              .from('product_variants')
              .insert({
                product_id: newProduct.id,
                variant_option_id: option.id
              });
          }
        }
      }

      showNotification('success', `Product "${newProductTitle}" created and added to order!`);
      
      // Auto-select the new product with quantity 1
      onProductQuantityChange(newProduct.id, 1);
      
      // Refresh products list
      if (onProductsRefresh) {
        onProductsRefresh();
      }

      // Reset and close modal
      setNewProductTitle('');
      setSelectedVariants([]);
      setNewVariantValues({});
      setAddingVariantFor(null);
      setShowNewProductModal(false);
    } catch (error) {
      console.error('Error creating product:', error);
      showNotification('error', 'Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  // Handle edit button click
  const handleEditProduct = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation(); // Prevent triggering product click
    setEditingProduct(product);
  };

  // Handle variants updated
  const handleVariantsUpdated = () => {
    if (onProductsRefresh) {
      onProductsRefresh();
    }
  };

  // Check if there are unselected variants available
  const hasAvailableVariants = variantTypes.some(vt => !selectedVariants.find(v => v.variant_type_id === vt.id));

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">{t('selectProductsToAdd')}</h2>
          <div className="flex items-center gap-2 sm:gap-3">
            {getTotalProductsSelected() > 0 && (
              <div className="bg-blue-100 text-blue-700 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium">
                {getTotalProductsSelected()} {t('productsAdded')}
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowNewProductModal(true)}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 sm:gap-2 shadow-md hover:shadow-lg transition-all text-sm"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">{t('product')}</span>
              <span className="xs:hidden">Add</span>
            </button>
          </div>
        </div>

        <div className="mb-3 sm:mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('searchProducts')}
            className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base text-gray-900 placeholder-gray-500"
          />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              onClick={() => onProductClick(product.id)}
              className={`border rounded-lg p-3 sm:p-4 transition-all cursor-pointer select-none ${
                selectedProducts[product.id] > 0
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-300 hover:border-gray-400 hover:shadow-md'
              }`}
            >
              <div className="relative">
                {selectedProducts[product.id] > 0 && (
                  <div className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm shadow-lg">
                    {selectedProducts[product.id]}
                  </div>
                )}
                
                <div className="mb-2 sm:mb-3">
                  <h3 className="font-semibold text-sm sm:text-base text-gray-900">{product.title}</h3>
                  {product.description && (
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">{product.description}</p>
                  )}
                  {product.variants && product.variants.length > 0 && (
                    <div className="mt-1.5 sm:mt-2">
                      {product.variants.map((variant, idx) => (
                        <div key={idx} className="text-xs text-gray-700">
                          <span className="font-medium text-gray-800">{variant.type}:</span> {variant.options.join(', ')}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom section - Edit button next to tap text */}
                <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200">
                  {selectedProducts[product.id] > 0 ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-600 font-medium">
                          Tap to add more
                        </span>
                        {/* Edit button */}
                        {product.variants && product.variants.length > 0 && (
                          <button
                            onClick={(e) => handleEditProduct(e, product)}
                            className="p-1 hover:bg-blue-100 rounded transition-colors"
                            title="Edit variants"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-500 hover:text-blue-700" />
                          </button>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onProductQuantityChange(product.id, 0);
                          showNotification('info', `${product.title} removed from order`);
                        }}
                        className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium bg-red-50 px-2 py-1 rounded hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-700">
                        Tap to add to order
                      </span>
                      {/* Edit button */}
                      {product.variants && product.variants.length > 0 && (
                        <button
                          onClick={(e) => handleEditProduct(e, product)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          title="Edit variants"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-gray-400 hover:text-blue-600" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Product Variants Modal */}
      {editingProduct && (
        <EditProductVariantsModal
          isOpen={!!editingProduct}
          onClose={() => setEditingProduct(null)}
          product={editingProduct}
          onVariantsUpdated={handleVariantsUpdated}
          showNotification={showNotification}
        />
      )}

      {/* New Product Modal - PROPERLY TRANSPARENT WITH FROSTED BACKGROUND */}
      {showNewProductModal && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNewProductModal(false);
              setNewProductTitle('');
              setSelectedVariants([]);
              setNewVariantValues({});
              setAddingVariantFor(null);
            }
          }}
        >
          <div className="min-h-screen flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-3xl max-h-[calc(100vh-2rem)] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Create New Product</h3>
              <button
                onClick={() => {
                  setShowNewProductModal(false);
                  setNewProductTitle('');
                  setSelectedVariants([]);
                  setNewVariantValues({});
                  setAddingVariantFor(null);
                }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4 flex-1 overflow-y-auto overflow-x-hidden">
              {/* Product Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  Product Title *
                </label>
                <input
                  type="text"
                  value={newProductTitle}
                  onChange={(e) => setNewProductTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 text-sm sm:text-base text-gray-900 placeholder-gray-500"
                  placeholder="Enter product name..."
                  autoFocus
                />
              </div>

              {/* Variants Section */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Product Variants
                </label>
                
                {/* Selected Variants */}
                {selectedVariants.length > 0 && (
                  <div className="space-y-3 mb-3 max-h-60 overflow-y-auto">
                    {selectedVariants.map((variant, idx) => (
                      <div key={idx} className="p-4 border-2 border-blue-200 rounded-lg bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative">
                        {/* Trash button INSIDE the box */}
                        <div className="flex items-start justify-between mb-3">
                          <span className="font-bold text-gray-900 text-base">{variant.variant_type_name}</span>
                          <button
                            onClick={() => setSelectedVariants(prev => prev.filter((_, i) => i !== idx))}
                            className="w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110"
                            title="Remove variant"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-3">
                          {variant.options.map((opt: any) => (
                            <span key={opt.id} className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm text-gray-800 font-medium shadow-sm">
                              {opt.value}
                            </span>
                          ))}
                        </div>
                        
                        {/* Add New Variant Options */}
                        {addingVariantFor === variant.variant_type_id ? (
                          <div className="space-y-2 mt-3 p-3 bg-white/70 rounded-lg">
                            {Array.isArray(newVariantValues[variant.variant_type_id]) && newVariantValues[variant.variant_type_id].map((value, index) => (
                              <div key={index} className="flex gap-2">
                                <input
                                  type="text"
                                  value={value}
                                  onChange={(e) => updateNewOptionValue(variant.variant_type_id, index, e.target.value)}
                                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-500"
                                  placeholder="Enter new option..."
                                  autoFocus={index === 0}
                                />
                                <button
                                  onClick={() => removeNewOptionInput(variant.variant_type_id, index)}
                                  className="px-2 py-1 text-red-600 hover:text-red-800"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            <div className="flex flex-wrap gap-2 mt-2">
                              <button
                                onClick={() => addNewOptionInput(variant.variant_type_id)}
                                className="px-3 py-1.5 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700 font-medium"
                              >
                                <Plus className="w-3 h-3 inline mr-1" />
                                Add More
                              </button>
                              <button
                                onClick={() => handleSaveNewVariantOptions(variant.variant_type_id)}
                                disabled={savingVariant === variant.variant_type_id || 
                                  !Array.isArray(newVariantValues[variant.variant_type_id]) || 
                                  !newVariantValues[variant.variant_type_id].some(v => v.trim())}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50 font-medium"
                              >
                                {savingVariant === variant.variant_type_id ? 'Saving...' : 'Save All'}
                              </button>
                              <button
                                onClick={() => {
                                  setAddingVariantFor(null);
                                  setNewVariantValues(prev => {
                                    const updated = { ...prev };
                                    delete updated[variant.variant_type_id];
                                    return updated;
                                  });
                                }}
                                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50 font-medium"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => startAddingOptions(variant.variant_type_id)}
                            className="mt-2 px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 font-medium shadow-md hover:shadow-lg transition-all"
                          >
                            <Plus className="w-3 h-3 inline mr-1" />
                            Add Options
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Available Variants List - only show if there are unselected variants */}
                {hasAvailableVariants && (
                  <div className="border-2 border-gray-200 rounded-lg p-4 max-h-40 overflow-y-auto bg-gradient-to-br from-gray-50 to-slate-50">
                    <p className="text-sm font-semibold text-gray-800 mb-2">Click to add variant types:</p>
                    <div className="space-y-1">
                      {variantTypes
                        .filter(vt => !selectedVariants.find(v => v.variant_type_id === vt.id))
                        .map(vt => (
                          <button
                            key={vt.id}
                            onClick={() => handleAddVariant(vt)}
                            className="w-full text-left px-3 py-2 hover:bg-white rounded-md border border-transparent hover:border-gray-300 transition-all hover:shadow-sm"
                          >
                            <span className="font-semibold text-gray-900">{vt.name}</span>
                            <span className="text-gray-600 text-sm ml-2">
                              ({vt.variant_options?.length || 0} options)
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 mt-4 sm:mt-6 pt-3 sm:pt-4 border-t">
              <button
                onClick={() => {
                  setShowNewProductModal(false);
                  setNewProductTitle('');
                  setSelectedVariants([]);
                  setNewVariantValues({});
                  setAddingVariantFor(null);
                }}
                className="w-full sm:w-auto px-4 sm:px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm sm:text-base"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProduct}
                className="w-full sm:w-auto px-4 sm:px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium shadow-md hover:shadow-lg transition-all text-sm sm:text-base"
                disabled={saving || !newProductTitle.trim()}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Product'
                )}
              </button>
            </div>
          </div>
        </div>
        </div>
      )}
    </>
  );
};