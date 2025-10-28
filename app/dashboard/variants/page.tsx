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
  Save
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
  const [showOptionModal, setShowOptionModal] = useState(false);
  const [selectedTypeForOption, setSelectedTypeForOption] = useState<VariantType | null>(null);
  const [editingType, setEditingType] = useState<VariantType | null>(null);
  const [editingOption, setEditingOption] = useState<VariantOption | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'type' | 'option', item: any } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  // Form states
  const [newTypeName, setNewTypeName] = useState('');
  const [newOptionValue, setNewOptionValue] = useState('');

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

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('create-type');

    try {
      if (editingType) {
        // Update existing type
        const { error } = await supabase
          .from('variant_types')
          .update({ name: newTypeName })
          .eq('id', editingType.id);

        if (error) throw error;
        notify.success(`Variant type updated to "${newTypeName}"!`);
        setEditingType(null);
      } else {
        // Create new type
        const { error } = await supabase
          .from('variant_types')
          .insert({ name: newTypeName });

        if (error) throw error;
        notify.success(`Variant type "${newTypeName}" has been created successfully!`);
      }

      setNewTypeName('');
      setShowTypeModal(false);
      await fetchVariants();
    } catch (error: any) {
      console.error('Error saving variant type:', error);
      notify.error(error.message || 'Failed to save variant type.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTypeForOption && !editingOption) return;

    setProcessingId('create-option');

    try {
      if (editingOption) {
        // Update existing option
        const { error } = await supabase
          .from('variant_options')
          .update({ value: newOptionValue })
          .eq('id', editingOption.id);

        if (error) throw error;
        notify.success(`Option updated to "${newOptionValue}"!`);
        setEditingOption(null);
      } else {
        // Create new option
        const { error } = await supabase
          .from('variant_options')
          .insert({
            type_id: selectedTypeForOption!.id,
            value: newOptionValue
          });

        if (error) throw error;
        notify.success(`Option "${newOptionValue}" added to ${selectedTypeForOption!.name}!`);
      }

      setNewOptionValue('');
      setShowOptionModal(false);
      setSelectedTypeForOption(null);
      await fetchVariants();
    } catch (error: any) {
      console.error('Error saving variant option:', error);
      notify.error(error.message || 'Failed to save variant option.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleEditType = (type: VariantType) => {
    setEditingType(type);
    setNewTypeName(type.name);
    setShowTypeModal(true);
  };

  const handleEditOption = (option: VariantOption) => {
    setEditingOption(option);
    setNewOptionValue(option.value);
    setShowOptionModal(true);
  };

  const handleDeleteType = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'type') return;
    
    const type = deleteConfirm.item as VariantType;
    setProcessingId(type.id);

    try {
      // First delete all options for this type
      const { error: optionsError } = await supabase
        .from('variant_options')
        .delete()
        .eq('type_id', type.id);

      if (optionsError) throw optionsError;

      // Then delete the type
      const { error: typeError } = await supabase
        .from('variant_types')
        .delete()
        .eq('id', type.id);

      if (typeError) throw typeError;

      notify.success(`Variant type "${type.name}" and all its options have been deleted.`);
      await fetchVariants();
      setDeleteConfirm(null);
    } catch (error: any) {
      console.error('Error deleting variant type:', error);
      notify.error('Failed to delete variant type. It may be in use by products.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteOption = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'option') return;
    
    const option = deleteConfirm.item as VariantOption;
    setProcessingId(option.id);

    try {
      const { error } = await supabase
        .from('variant_options')
        .delete()
        .eq('id', option.id);

      if (error) throw error;

      notify.success(`Option "${option.value}" has been deleted.`);
      await fetchVariants();
      setDeleteConfirm(null);
    } catch (error: any) {
      console.error('Error deleting variant option:', error);
      notify.error('Failed to delete option. It may be in use by products.');
    } finally {
      setProcessingId(null);
    }
  };

  const getOptionsForType = (typeId: string) => {
    return variantOptions.filter(option => option.type_id === typeId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Variant Configuration</h1>
          <p className="text-gray-500 mt-2">Manage product variant types and options</p>
        </div>
        <button
          onClick={() => {
            setEditingType(null);
            setNewTypeName('');
            setShowTypeModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Variant Type
        </button>
      </div>

      {/* Variant Types Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Type Name</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Options</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {variantTypes.map((type) => {
              const options = getOptionsForType(type.id);
              
              return (
                <tr 
                  key={type.id} 
                  className={`hover:bg-gray-50 transition-colors ${
                    processingId === type.id ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Layers className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{type.name}</p>
                        <p className="text-sm text-gray-500">
                          {options.length} {options.length === 1 ? 'option' : 'options'}
                        </p>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5 max-w-2xl">
                      {options.length > 0 ? (
                        options.map((option) => (
                          <div 
                            key={option.id}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-sm group hover:bg-gray-200 transition-colors ${
                              processingId === option.id ? 'opacity-50' : ''
                            }`}
                          >
                            <span className="font-medium">{option.value}</span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEditOption(option)}
                                className="p-0.5 hover:text-blue-600"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm({ type: 'option', item: option })}
                                className="p-0.5 hover:text-red-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <span className="text-gray-400 text-sm italic">No options added</span>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedTypeForOption(type);
                          setEditingOption(null);
                          setNewOptionValue('');
                          setShowOptionModal(true);
                        }}
                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Add Option"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditType(type)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Type"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'type', item: type })}
                        disabled={processingId === type.id}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete Type"
                      >
                        {processingId === type.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {variantTypes.length === 0 && (
          <div className="text-center py-12">
            <Layers className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No variant types found</p>
            <p className="text-gray-400 text-sm mt-1">Create your first variant type to get started</p>
          </div>
        )}
      </div>

      {/* Create/Edit Type Modal */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">
                {editingType ? 'Edit Variant Type' : 'Create Variant Type'}
              </h2>
              <button
                onClick={() => {
                  setShowTypeModal(false);
                  setNewTypeName('');
                  setEditingType(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateType}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type Name
                </label>
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
                  placeholder="e.g. Size, Color, Material"
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  This will be the category name for your variants
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowTypeModal(false);
                    setNewTypeName('');
                    setEditingType(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId === 'create-type'}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processingId === 'create-type' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {editingType ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      {editingType ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      {editingType ? 'Update Type' : 'Create Type'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Option Modal */}
      {showOptionModal && (selectedTypeForOption || editingOption) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  {editingOption ? 'Edit Option' : 'Add Option'}
                </h2>
                {!editingOption && (
                  <p className="text-sm text-gray-500 mt-1">
                    Adding to: <span className="font-semibold">{selectedTypeForOption?.name}</span>
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowOptionModal(false);
                  setSelectedTypeForOption(null);
                  setEditingOption(null);
                  setNewOptionValue('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOption}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Option Value
                </label>
                <input
                  type="text"
                  value={newOptionValue}
                  onChange={(e) => setNewOptionValue(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
                  placeholder={
                    selectedTypeForOption?.name === 'Size' ? 'e.g. Small, Medium, Large' :
                    selectedTypeForOption?.name === 'Color' ? 'e.g. Red, Blue, Green' :
                    'Enter option value'
                  }
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowOptionModal(false);
                    setSelectedTypeForOption(null);
                    setEditingOption(null);
                    setNewOptionValue('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId === 'create-option'}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processingId === 'create-option' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {editingOption ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    <>
                      {editingOption ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      {editingOption ? 'Update Option' : 'Add Option'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete {deleteConfirm.type === 'type' ? 'Variant Type' : 'Option'}?
                </h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700 mb-2">
                You are about to permanently delete:
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white">
                  {deleteConfirm.type === 'type' ? (
                    <Layers className="w-5 h-5" />
                  ) : (
                    <Tag className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {deleteConfirm.type === 'type' 
                      ? (deleteConfirm.item as VariantType).name
                      : (deleteConfirm.item as VariantOption).value}
                  </p>
                  {deleteConfirm.type === 'type' && (
                    <p className="text-sm text-red-600">
                      Warning: This will also delete all options under this type
                    </p>
                  )}
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              {deleteConfirm.type === 'type' 
                ? 'All products using this variant type will be affected.'
                : 'Any products using this option will be affected.'}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteConfirm.type === 'type' ? handleDeleteType : handleDeleteOption}
                disabled={!!processingId}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processingId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete {deleteConfirm.type === 'type' ? 'Type' : 'Option'}
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