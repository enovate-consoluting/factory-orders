/**
 * Edit Product Variants Modal
 * Allows adding new variant options to a product inline during order creation
 * Matches the styling of the Variants management page
 * Location: app/dashboard/orders/shared-components/EditProductVariantsModal.tsx
 * Last Modified: November 2025
 */

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  X, 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  Tag,
  Layers,
  Check,
  AlertCircle
} from 'lucide-react';

interface VariantType {
  id: string;
  name: string;
}

interface VariantOption {
  id: string;
  type_id: string;
  value: string;
}

interface ProductVariant {
  type: string;
  typeId: string;
  options: { id: string; value: string }[];
}

interface EditProductVariantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    title: string;
    variants?: { type: string; options: string[] }[];
  };
  onVariantsUpdated: () => void;
  showNotification: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function EditProductVariantsModal({
  isOpen,
  onClose,
  product,
  onVariantsUpdated,
  showNotification
}: EditProductVariantsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [variantTypes, setVariantTypes] = useState<VariantType[]>([]);
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [newOptions, setNewOptions] = useState<{ [typeId: string]: string[] }>({});

  useEffect(() => {
    if (isOpen && product) {
      fetchVariantData();
    }
  }, [isOpen, product]);

  const fetchVariantData = async () => {
    setLoading(true);
    try {
      // Fetch all variant types
      const { data: typesData, error: typesError } = await supabase
        .from('variant_types')
        .select('*')
        .order('name');

      if (typesError) throw typesError;

      // Fetch product's current variants with full details
      const { data: productVariantsData, error: pvError } = await supabase
        .from('product_variants')
        .select(`
          id,
          variant_option_id,
          variant_options (
            id,
            value,
            type_id,
            variant_types (
              id,
              name
            )
          )
        `)
        .eq('product_id', product.id);

      if (pvError) throw pvError;

      setVariantTypes(typesData || []);

      // Group variants by type
      const variantsByType: { [key: string]: ProductVariant } = {};
      
      productVariantsData?.forEach((pv: any) => {
        const typeName = pv.variant_options?.variant_types?.name;
        const typeId = pv.variant_options?.variant_types?.id;
        const optionValue = pv.variant_options?.value;
        const optionId = pv.variant_options?.id;

        if (typeName && typeId && optionValue) {
          if (!variantsByType[typeId]) {
            variantsByType[typeId] = {
              type: typeName,
              typeId: typeId,
              options: []
            };
          }
          // Avoid duplicates
          if (!variantsByType[typeId].options.find(o => o.id === optionId)) {
            variantsByType[typeId].options.push({ id: optionId, value: optionValue });
          }
        }
      });

      setProductVariants(Object.values(variantsByType));
      
      // Initialize new options state for each type
      const initialNewOptions: { [typeId: string]: string[] } = {};
      Object.keys(variantsByType).forEach(typeId => {
        initialNewOptions[typeId] = [''];
      });
      setNewOptions(initialNewOptions);

    } catch (error) {
      console.error('Error fetching variant data:', error);
      showNotification('error', 'Failed to load variant data');
    } finally {
      setLoading(false);
    }
  };

  const addNewOptionField = (typeId: string) => {
    setNewOptions(prev => ({
      ...prev,
      [typeId]: [...(prev[typeId] || []), '']
    }));
  };

  const updateNewOption = (typeId: string, index: number, value: string) => {
    setNewOptions(prev => ({
      ...prev,
      [typeId]: prev[typeId].map((opt, i) => i === index ? value : opt)
    }));
  };

  const removeNewOptionField = (typeId: string, index: number) => {
    setNewOptions(prev => ({
      ...prev,
      [typeId]: prev[typeId].filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    let addedCount = 0;

    try {
      // Process each variant type
      for (const [typeId, options] of Object.entries(newOptions)) {
        const validOptions = options.filter(opt => opt.trim() !== '');
        
        for (const optionValue of validOptions) {
          // Check if this option already exists for this type
          let { data: existingOption } = await supabase
            .from('variant_options')
            .select('id')
            .eq('type_id', typeId)
            .eq('value', optionValue.trim())
            .single();

          let optionId: string;

          if (existingOption) {
            // Option exists, use it
            optionId = existingOption.id;
          } else {
            // Create new option in variant_options table
            const { data: newOption, error: optionError } = await supabase
              .from('variant_options')
              .insert({
                type_id: typeId,
                value: optionValue.trim()
              })
              .select()
              .single();

            if (optionError) throw optionError;
            optionId = newOption.id;
          }

          // Check if product already has this variant option
          const { data: existingPV } = await supabase
            .from('product_variants')
            .select('id')
            .eq('product_id', product.id)
            .eq('variant_option_id', optionId)
            .single();

          if (!existingPV) {
            // Link option to product
            const { error: linkError } = await supabase
              .from('product_variants')
              .insert({
                product_id: product.id,
                variant_option_id: optionId
              });

            if (linkError) throw linkError;
            addedCount++;
          }
        }
      }

      if (addedCount > 0) {
        showNotification('success', `Added ${addedCount} new variant option${addedCount > 1 ? 's' : ''} to ${product.title}`);
        onVariantsUpdated();
        onClose();
      } else {
        showNotification('info', 'No new options were added');
      }

    } catch (error: any) {
      console.error('Error saving variants:', error);
      showNotification('error', error.message || 'Failed to save variants');
    } finally {
      setSaving(false);
    }
  };

  const hasNewOptions = () => {
    return Object.values(newOptions).some(opts => 
      opts.some(opt => opt.trim() !== '')
    );
  };

  if (!isOpen) return null;

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="min-h-screen flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-xl w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0 pr-2">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                <span className="truncate">Edit Variants</span>
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 truncate">
                Add new variant options for <span className="font-medium">{product.title}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : productVariants.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Variants Configured</h3>
              <p className="text-gray-500">
                This product doesn't have any variant types assigned yet.
                <br />
                Go to Products → Edit to add variant types first.
              </p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {productVariants.map((variant) => (
                <div 
                  key={variant.typeId}
                  className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden"
                >
                  {/* Variant Type Header */}
                  <div className="bg-gradient-to-r from-gray-100 to-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-gray-600" />
                      <h3 className="font-semibold text-gray-900">{variant.type}</h3>
                      <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full">
                        {variant.options.length} option{variant.options.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    {/* Existing Options */}
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Current Options
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {variant.options.map((option) => (
                          <span 
                            key={option.id}
                            className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 font-medium flex items-center gap-1"
                          >
                            <Check className="w-3 h-3 text-green-500" />
                            {option.value}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Add New Options */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Add New Options
                        </label>
                        <button
                          type="button"
                          onClick={() => addNewOptionField(variant.typeId)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Add More
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(newOptions[variant.typeId] || ['']).map((option, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => updateNewOption(variant.typeId, index, e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              placeholder={
                                variant.type.toLowerCase() === 'size' 
                                  ? 'e.g., 3XL, 4XL'
                                  : variant.type.toLowerCase() === 'color'
                                  ? 'e.g., Navy, Gold'
                                  : `New ${variant.type} option`
                              }
                            />
                            {(newOptions[variant.typeId] || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeNewOptionField(variant.typeId, index)}
                                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Info Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">New variants will be available everywhere</p>
                  <p className="text-blue-600">
                    Adding a new option (like "3XL") will make it available for this product 
                    in all orders, including existing ones when they're viewed.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasNewOptions() || loading}
            className="w-full sm:flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save New Options
              </>
            )}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
