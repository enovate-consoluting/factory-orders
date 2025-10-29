'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  Layers, 
  Plus, 
  Edit2,
  Trash2, 
  X, 
  Check,
  Loader2,
  AlertTriangle,
  Tag,
  Save,
  MoreHorizontal
} from 'lucide-react';
import { notify } from '@/app/hooks/useUINotification';

interface VariantType {
  id: string;
  name: string;
  created_at: string;
}

interface VariantOption {
  id: string;
  type_id: string;
  value: string;
  created_at: string;
  type?: VariantType;
}

export default function VariantsPage() {
  const [variantTypes, setVariantTypes] = useState<VariantType[]>([]);
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingType, setEditingType] = useState<VariantType | null>(null);
  const [editingOption, setEditingOption] = useState<VariantOption | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'type' | 'option', item: any } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  // Form states
  const [newTypeName, setNewTypeName] = useState('');
  const [optionsList, setOptionsList] = useState<string[]>(['', '', '']); // Start with 3 empty fields
  const [existingOptionIds, setExistingOptionIds] = useState<string[]>([]); // Track existing option IDs for updates

  // Maximum options to display on card
  const MAX_VISIBLE_OPTIONS = 5;

  useEffect(() => {
    fetchVariants();
  }, []);

  const fetchVariants = async () => {
    try {
      // Fetch variant types
      const { data: typesData, error: typesError } = await supabase
        .from('variant_types')
        .select('*')
        .order('name', { ascending: true });

      if (typesError) throw typesError;

      // Fetch variant options with type info
      const { data: optionsData, error: optionsError } = await supabase
        .from('variant_options')
        .select('*, type:variant_types(*)')
        .order('value', { ascending: true });

      if (optionsError) throw optionsError;

      setVariantTypes(typesData || []);
      setVariantOptions(optionsData || []);
    } catch (error) {
      console.error('Error fetching variants:', error);
      notify.error('Failed to load variants. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  // Helper functions for options list
  const addOptionField = () => {
    setOptionsList([...optionsList, '']);
    setExistingOptionIds([...existingOptionIds, '']); // Add empty ID for new option
  };

  const removeOptionField = (index: number) => {
    // If this is an existing option (has an ID), we need to delete it from the database
    if (existingOptionIds[index]) {
      // Mark for deletion or handle immediately
      const optionId = existingOptionIds[index];
      // You might want to track these for deletion when saving
    }
    setOptionsList(optionsList.filter((_, i) => i !== index));
    setExistingOptionIds(existingOptionIds.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, value: string) => {
    const updated = [...optionsList];
    updated[index] = value;
    setOptionsList(updated);
  };

  const hasValidOptions = () => {
    return optionsList.some(option => option.trim() !== '');
  };

  const openEditModal = (type: VariantType) => {
    // Get existing options for this type
    const existingOptions = variantOptions.filter(opt => opt.type_id === type.id);
    
    // Set up the form with existing data
    setEditingType(type);
    setNewTypeName(type.name);
    
    // If there are existing options, populate them; otherwise start with 3 empty fields
    if (existingOptions.length > 0) {
      setOptionsList(existingOptions.map(opt => opt.value));
      setExistingOptionIds(existingOptions.map(opt => opt.id));
      // Add a few empty fields for new options
      setOptionsList(prev => [...prev, '', '', '']);
      setExistingOptionIds(prev => [...prev, '', '', '']);
    } else {
      setOptionsList(['', '', '']);
      setExistingOptionIds(['', '', '']);
    }
    
    setShowTypeModal(true);
  };

  const handleCreateTypeWithOptions = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('create-type');

    try {
      if (editingType) {
        // Update existing type name
        const { error: updateError } = await supabase
          .from('variant_types')
          .update({ name: newTypeName })
          .eq('id', editingType.id);

        if (updateError) throw updateError;

        // Handle options updates
        for (let i = 0; i < optionsList.length; i++) {
          const optionValue = optionsList[i].trim();
          const optionId = existingOptionIds[i];

          if (optionValue) {
            if (optionId) {
              // Update existing option
              const { error } = await supabase
                .from('variant_options')
                .update({ value: optionValue })
                .eq('id', optionId);
              
              if (error) throw error;
            } else {
              // Create new option
              const { error } = await supabase
                .from('variant_options')
                .insert({
                  type_id: editingType.id,
                  value: optionValue
                });
              
              if (error) throw error;
            }
          } else if (optionId) {
            // If the field is empty but had an ID, delete the option
            const { error } = await supabase
              .from('variant_options')
              .delete()
              .eq('id', optionId);
            
            if (error) console.error('Error deleting option:', error);
          }
        }

        notify.success(`Variant type "${newTypeName}" updated successfully!`);
      } else {
        // Create new type
        const { data: newType, error: typeError } = await supabase
          .from('variant_types')
          .insert({ name: newTypeName })
          .select()
          .single();

        if (typeError) throw typeError;

        // Create options for the new type
        const validOptions = optionsList
          .filter(option => option.trim() !== '')
          .map(option => ({
            type_id: newType.id,
            value: option.trim()
          }));

        if (validOptions.length > 0) {
          const { error: optionsError } = await supabase
            .from('variant_options')
            .insert(validOptions);

          if (optionsError) throw optionsError;
        }

        notify.success(`Variant type "${newTypeName}" created with ${validOptions.length} option(s)!`);
      }

      setShowTypeModal(false);
      setNewTypeName('');
      setOptionsList(['', '', '']);
      setExistingOptionIds([]);
      setEditingType(null);
      await fetchVariants();
    } catch (error: any) {
      console.error('Error saving variant type:', error);
      notify.error(error.message || 'Failed to save variant type');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteType = async (type: VariantType) => {
    setProcessingId(type.id);
    
    try {
      const { error } = await supabase
        .from('variant_types')
        .delete()
        .eq('id', type.id);

      if (error) throw error;

      notify.success(`Variant type "${type.name}" deleted successfully!`);
      await fetchVariants();
    } catch (error: any) {
      console.error('Error deleting variant type:', error);
      notify.error(error.message || 'Failed to delete variant type');
    } finally {
      setProcessingId(null);
      setDeleteConfirm(null);
    }
  };

  const handleDeleteOption = async (option: VariantOption) => {
    setProcessingId(option.id);
    
    try {
      const { error } = await supabase
        .from('variant_options')
        .delete()
        .eq('id', option.id);

      if (error) throw error;

      notify.success('Option deleted successfully!');
      await fetchVariants();
    } catch (error: any) {
      console.error('Error deleting option:', error);
      notify.error(error.message || 'Failed to delete option');
    } finally {
      setProcessingId(null);
      setDeleteConfirm(null);
    }
  };

  const handleDeleteSingleOption = async (option: VariantOption) => {
    setProcessingId(option.id);
    
    try {
      const { error } = await supabase
        .from('variant_options')
        .delete()
        .eq('id', option.id);

      if (error) throw error;

      notify.success('Option deleted successfully!');
      await fetchVariants();
    } catch (error: any) {
      console.error('Error deleting option:', error);
      notify.error(error.message || 'Failed to delete option');
    } finally {
      setProcessingId(null);
    }
  };

  const getOptionsForType = (typeId: string) => {
    return variantOptions.filter(opt => opt.type_id === typeId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header - Mobile Responsive */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
              <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Variant Management</h1>
          </div>
          <p className="text-sm sm:text-base text-gray-600">Manage product variants like sizes, colors, and materials</p>
        </div>

        {/* Add Variant Type Button - Mobile Responsive */}
        <div className="mb-4 sm:mb-6">
          <button
            onClick={() => {
              setShowTypeModal(true);
              setEditingType(null);
              setNewTypeName('');
              setOptionsList(['', '', '']);
              setExistingOptionIds([]);
            }}
            className="w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Add Variant Type
          </button>
        </div>

        {/* Variant Types Grid - Mobile Responsive with Fixed Heights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {variantTypes.map((type) => {
            const options = getOptionsForType(type.id);
            const isProcessing = processingId === type.id;
            const visibleOptions = options.slice(0, MAX_VISIBLE_OPTIONS);
            const hasMore = options.length > MAX_VISIBLE_OPTIONS;
            const remainingCount = options.length - MAX_VISIBLE_OPTIONS;

            return (
              <div 
                key={type.id} 
                className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col ${
                  isProcessing ? 'opacity-50' : ''
                }`}
              >
                {/* Card Header - Fixed Height */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 flex-shrink-0">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                      <h3 className="font-semibold text-gray-900 text-base sm:text-lg">{type.name}</h3>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditModal(type)}
                        disabled={isProcessing}
                        className="p-1 sm:p-1.5 hover:bg-white rounded-lg transition-colors group"
                        title="Edit type"
                      >
                        <Edit2 className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 group-hover:text-blue-600" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'type', item: type })}
                        disabled={isProcessing}
                        className="p-1 sm:p-1.5 hover:bg-white rounded-lg transition-colors group"
                        title="Delete type"
                      >
                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 group-hover:text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Options List - Dynamic Height */}
                <div className="flex-1 flex flex-col p-4 sm:p-5">
                  <div className="flex-1 mb-3">
                    {options.length > 0 ? (
                      <div className="space-y-1.5 sm:space-y-2">
                        {/* Show visible options */}
                        {visibleOptions.map((option) => (
                          <div
                            key={option.id}
                            className={`flex justify-between items-center px-2.5 sm:px-3 py-1.5 sm:py-2 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors text-sm sm:text-base ${
                              processingId === option.id ? 'opacity-50' : ''
                            }`}
                          >
                            <span className="text-gray-700 font-medium truncate">{option.value}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleDeleteSingleOption(option)}
                                disabled={processingId === option.id}
                                className="p-0.5 sm:p-1 hover:bg-white rounded transition-colors"
                                title="Delete option"
                              >
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </button>
                            </div>
                          </div>
                        ))}
                        
                        {/* Show more indicator if there are more than 5 */}
                        {hasMore && (
                          <div 
                            className="flex items-center justify-center py-1 text-gray-500 cursor-pointer hover:text-gray-700"
                            onClick={() => openEditModal(type)}
                          >
                            <MoreHorizontal className="w-4 h-4 mr-1" />
                            <span className="text-xs font-medium">
                              {remainingCount} more option{remainingCount > 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p className="text-sm">No options yet</p>
                        <p className="text-xs mt-1">Click below to add options</p>
                      </div>
                    )}
                  </div>

                  {/* Add Options Button - Always at bottom */}
                  <button
                    onClick={() => openEditModal(type)}
                    className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm font-medium flex-shrink-0 mt-auto"
                  >
                    <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                    {options.length > 0 ? 'Manage Options' : 'Add Options'}
                  </button>
                </div>
              </div>
            );
          })}

          {variantTypes.length === 0 && (
            <div className="col-span-full text-center py-8 sm:py-12">
              <Layers className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-1 sm:mb-2">No variant types yet</h3>
              <p className="text-sm sm:text-base text-gray-500">Get started by adding your first variant type</p>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Type Modal with Options - Mobile Responsive */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
                  {editingType ? 'Edit Variant Type' : 'Create Variant Type'}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  {editingType 
                    ? 'Update the variant type name and manage its options' 
                    : 'Create a variant type and add its options all at once'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowTypeModal(false);
                  setNewTypeName('');
                  setEditingType(null);
                  setOptionsList(['', '', '']);
                  setExistingOptionIds([]);
                }}
                className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTypeWithOptions}>
              {/* Type Name Field */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Type Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg text-gray-900 font-medium placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                  placeholder="e.g. Size, Color, Material"
                  required
                  autoFocus
                />
                <p className="mt-1 text-xs sm:text-sm text-gray-500">
                  This will be the category name for your variants
                </p>
              </div>

              {/* Options Section */}
              <div className="mb-4 sm:mb-6">
                <div className="flex justify-between items-center mb-2 sm:mb-3">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700">
                    Options <span className="text-gray-400">(Add at least one)</span>
                  </label>
                  <button
                    type="button"
                    onClick={addOptionField}
                    className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                    Add More
                  </button>
                </div>

                <div className="space-y-2 max-h-48 sm:max-h-64 overflow-y-auto">
                  {optionsList.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm sm:text-base"
                        placeholder={
                          existingOptionIds[index] 
                            ? `Current: ${option}` 
                            : newTypeName.toLowerCase() === 'size' 
                              ? index === 0 ? 'e.g. Small' : index === 1 ? 'e.g. Medium' : index === 2 ? 'e.g. Large' : 'Enter option'
                            : newTypeName.toLowerCase() === 'color'
                              ? index === 0 ? 'e.g. Red' : index === 1 ? 'e.g. Blue' : index === 2 ? 'e.g. Green' : 'Enter option'
                            : `Option ${index + 1}`
                        }
                      />
                      {optionsList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeOptionField(index)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title={existingOptionIds[index] ? "Remove this option (will be deleted)" : "Remove this field"}
                        >
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <p className="mt-2 text-xs sm:text-sm text-gray-500">
                  {editingType 
                    ? 'Empty fields will be ignored. Removed existing options will be deleted.'
                    : 'You can always add more options later'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowTypeModal(false);
                    setNewTypeName('');
                    setEditingType(null);
                    setOptionsList(['', '', '']);
                    setExistingOptionIds([]);
                  }}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId === 'create-type' || (!editingType && !hasValidOptions())}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  {processingId === 'create-type' ? (
                    <>
                      <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                      {editingType ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      {editingType ? <Save className="w-3 h-3 sm:w-4 sm:h-4" /> : <Check className="w-3 h-3 sm:w-4 sm:h-4" />}
                      {editingType ? 'Update Type & Options' : 'Create Type & Options'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal - Mobile Responsive */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-md animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  Delete {deleteConfirm.type === 'type' ? 'Variant Type' : 'Option'}?
                </h3>
                <p className="text-xs sm:text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="mb-4 sm:mb-6">
              {deleteConfirm.type === 'type' ? (
                <p className="text-sm sm:text-base text-gray-700">
                  Are you sure you want to delete <span className="font-semibold">{deleteConfirm.item.name}</span>? 
                  This will also delete all its options.
                </p>
              ) : (
                <p className="text-sm sm:text-base text-gray-700">
                  Are you sure you want to delete the option <span className="font-semibold">{deleteConfirm.item.value}</span>?
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteConfirm.type === 'type') {
                    handleDeleteType(deleteConfirm.item);
                  } else {
                    handleDeleteOption(deleteConfirm.item);
                  }
                }}
                disabled={processingId === deleteConfirm.item.id}
                className="flex-1 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                {processingId === deleteConfirm.item.id ? (
                  <>
                    <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}