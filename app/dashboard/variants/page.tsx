'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Plus, 
  X, 
  Edit2, 
  Trash2, 
  Search,
  Tag,
  Check,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Layers,
  Hash,
  Palette,
  Ruler,
  Package2,
  Grid3x3,
  List,
  Settings2
} from 'lucide-react'

type VariantType = {
  id: string
  name: string
  created_at: string
}

type VariantOption = {
  id: string
  type_id: string
  value: string
  created_at: string
}

export default function VariantsPage() {
  const [variantTypes, setVariantTypes] = useState<VariantType[]>([])
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [user, setUser] = useState<any>(null)
  
  // Modal states
  const [showCreateTypeModal, setShowCreateTypeModal] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  
  const [showAddOptionsModal, setShowAddOptionsModal] = useState(false)
  const [selectedTypeForOptions, setSelectedTypeForOptions] = useState<VariantType | null>(null)
  const [newOptions, setNewOptions] = useState<string[]>([''])
  
  const [editingType, setEditingType] = useState<VariantType | null>(null)
  const [editingOption, setEditingOption] = useState<VariantOption | null>(null)
  
  // Delete confirmation
  const [deleteTypeModalOpen, setDeleteTypeModalOpen] = useState(false)
  const [typeToDelete, setTypeToDelete] = useState<VariantType | null>(null)
  const [deleteOptionModalOpen, setDeleteOptionModalOpen] = useState(false)
  const [optionToDelete, setOptionToDelete] = useState<VariantOption | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Notification state
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Expanded types for option display
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set())

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      setUser(JSON.parse(userData))
    }
    loadData()
  }, [])

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const loadData = async () => {
    setLoading(true)
    try {
      const [typesData, optionsData] = await Promise.all([
        supabase.from('variant_types').select('*').order('name'),
        supabase.from('variant_options').select('*').order('value')
      ])
      
      if (typesData.error) throw typesData.error
      if (optionsData.error) throw optionsData.error
      
      setVariantTypes(typesData.data || [])
      setVariantOptions(optionsData.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
      setNotification({ message: 'Error loading variants', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const createVariantType = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newTypeName.trim()) {
      setNotification({ message: 'Please enter a variant type name', type: 'error' })
      return
    }
    
    try {
      const { error } = await supabase
        .from('variant_types')
        .insert({ name: newTypeName })
      
      if (error) throw error
      
      setNotification({ message: 'Variant type created successfully!', type: 'success' })
      setShowCreateTypeModal(false)
      setNewTypeName('')
      loadData()
    } catch (error) {
      console.error('Error creating variant type:', error)
      setNotification({ message: 'Error creating variant type', type: 'error' })
    }
  }

  const updateVariantType = async () => {
    if (!editingType || !editingType.name.trim()) {
      setNotification({ message: 'Please enter a variant type name', type: 'error' })
      return
    }
    
    try {
      const { error } = await supabase
        .from('variant_types')
        .update({ name: editingType.name })
        .eq('id', editingType.id)
      
      if (error) throw error
      
      setNotification({ message: 'Variant type updated successfully!', type: 'success' })
      setEditingType(null)
      loadData()
    } catch (error) {
      console.error('Error updating variant type:', error)
      setNotification({ message: 'Error updating variant type', type: 'error' })
    }
  }

  const deleteVariantType = async () => {
    if (!typeToDelete) return
    
    setDeleting(true)
    try {
      // Delete all options for this type first
      const { error: optionsError } = await supabase
        .from('variant_options')
        .delete()
        .eq('type_id', typeToDelete.id)
      
      if (optionsError) throw optionsError
      
      // Delete the variant type
      const { error: typeError } = await supabase
        .from('variant_types')
        .delete()
        .eq('id', typeToDelete.id)
      
      if (typeError) throw typeError
      
      setNotification({ message: 'Variant type deleted successfully!', type: 'success' })
      setDeleteTypeModalOpen(false)
      setTypeToDelete(null)
      loadData()
    } catch (error) {
      console.error('Error deleting variant type:', error)
      setNotification({ message: 'Error deleting variant type', type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const addVariantOptions = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedTypeForOptions) return
    
    const validOptions = newOptions.filter(opt => opt.trim())
    if (validOptions.length === 0) {
      setNotification({ message: 'Please enter at least one option', type: 'error' })
      return
    }
    
    try {
      const optionsToInsert = validOptions.map(option => ({
        type_id: selectedTypeForOptions.id,
        value: option.trim()
      }))
      
      const { error } = await supabase
        .from('variant_options')
        .insert(optionsToInsert)
      
      if (error) throw error
      
      setNotification({ message: 'Options added successfully!', type: 'success' })
      setShowAddOptionsModal(false)
      setSelectedTypeForOptions(null)
      setNewOptions([''])
      loadData()
    } catch (error) {
      console.error('Error adding options:', error)
      setNotification({ message: 'Error adding options', type: 'error' })
    }
  }

  const updateVariantOption = async () => {
    if (!editingOption || !editingOption.value.trim()) {
      setNotification({ message: 'Please enter an option value', type: 'error' })
      return
    }
    
    try {
      const { error } = await supabase
        .from('variant_options')
        .update({ value: editingOption.value })
        .eq('id', editingOption.id)
      
      if (error) throw error
      
      setNotification({ message: 'Option updated successfully!', type: 'success' })
      setEditingOption(null)
      loadData()
    } catch (error) {
      console.error('Error updating option:', error)
      setNotification({ message: 'Error updating option', type: 'error' })
    }
  }

  const deleteVariantOption = async () => {
    if (!optionToDelete) return
    
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('variant_options')
        .delete()
        .eq('id', optionToDelete.id)
      
      if (error) throw error
      
      setNotification({ message: 'Option deleted successfully!', type: 'success' })
      setDeleteOptionModalOpen(false)
      setOptionToDelete(null)
      loadData()
    } catch (error) {
      console.error('Error deleting option:', error)
      setNotification({ message: 'Error deleting option', type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const toggleTypeExpansion = (typeId: string) => {
    const newExpanded = new Set(expandedTypes)
    if (newExpanded.has(typeId)) {
      newExpanded.delete(typeId)
    } else {
      newExpanded.add(typeId)
    }
    setExpandedTypes(newExpanded)
  }

  const getTypeIcon = (typeName: string) => {
    const name = typeName.toLowerCase()
    if (name.includes('size')) return <Ruler className="w-5 h-5" />
    if (name.includes('color') || name.includes('colour')) return <Palette className="w-5 h-5" />
    if (name.includes('material') || name.includes('fabric')) return <Layers className="w-5 h-5" />
    if (name.includes('style') || name.includes('type')) return <Package2 className="w-5 h-5" />
    return <Tag className="w-5 h-5" />
  }

  const filteredTypes = variantTypes.filter(type =>
    type.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getOptionsForType = (typeId: string) => {
    return variantOptions.filter(opt => opt.type_id === typeId)
  }

  const canManageVariants = () => {
    return user?.role === 'super_admin'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
            <Settings2 className="w-8 h-8 mr-3 text-blue-600" />
            Variants Management
          </h1>
          {canManageVariants() && (
            <button
              onClick={() => setShowCreateTypeModal(true)}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Variant Type
            </button>
          )}
        </div>

        {/* Search and View Toggle */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search variant types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center space-x-3 ${
          notification.type === 'success' 
            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' 
            : 'bg-gradient-to-r from-red-500 to-red-600 text-white'
        }`}>
          {notification.type === 'success' ? (
            <Check className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* Variants Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTypes.map(type => {
            const options = getOptionsForType(type.id)
            const isExpanded = expandedTypes.has(type.id)
            
            return (
              <div key={type.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center">
                      <div className="text-blue-600 mr-2">
                        {getTypeIcon(type.name)}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">{type.name}</h3>
                    </div>
                    {canManageVariants() && (
                      <div className="flex space-x-1">
                        <button
                          onClick={() => setEditingType(type)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit type"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setTypeToDelete(type)
                            setDeleteTypeModalOpen(true)
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete type"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-3">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => toggleTypeExpansion(type.id)}
                        className="flex items-center text-sm text-blue-600 hover:text-blue-700"
                      >
                        <Hash className="w-4 h-4 mr-1" />
                        {options.length} option{options.length !== 1 ? 's' : ''}
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 ml-1" />
                        ) : (
                          <ChevronDown className="w-4 h-4 ml-1" />
                        )}
                      </button>
                      {canManageVariants() && (
                        <button
                          onClick={() => {
                            setSelectedTypeForOptions(type)
                            setShowAddOptionsModal(true)
                          }}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          + Add Options
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="flex flex-wrap gap-2">
                      {options.map(option => (
                        <div
                          key={option.id}
                          className="group relative px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-200"
                        >
                          {option.value}
                          {canManageVariants() && (
                            <div className="absolute -top-2 -right-2 hidden group-hover:flex space-x-1">
                              <button
                                onClick={() => setEditingOption(option)}
                                className="p-1 bg-white rounded shadow-md text-blue-600 hover:bg-blue-50"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => {
                                  setOptionToDelete(option)
                                  setDeleteOptionModalOpen(true)
                                }}
                                className="p-1 bg-white rounded shadow-md text-red-600 hover:bg-red-50"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      {options.length === 0 && (
                        <p className="text-sm text-gray-500 italic">No options added yet</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Variant Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Options
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Count
                  </th>
                  {canManageVariants() && (
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTypes.map(type => {
                  const options = getOptionsForType(type.id)
                  
                  return (
                    <tr key={type.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div className="text-blue-600 mr-2">
                            {getTypeIcon(type.name)}
                          </div>
                          <div className="font-medium text-gray-900">{type.name}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {options.slice(0, 5).map(option => (
                            <span key={option.id} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                              {option.value}
                            </span>
                          ))}
                          {options.length > 5 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                              +{options.length - 5} more
                            </span>
                          )}
                          {options.length === 0 && (
                            <span className="text-sm text-gray-500 italic">No options</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-700">
                          {options.length}
                        </span>
                      </td>
                      {canManageVariants() && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => {
                                setSelectedTypeForOptions(type)
                                setShowAddOptionsModal(true)
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Add options"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingType(type)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit type"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setTypeToDelete(type)
                                setDeleteTypeModalOpen(true)
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete type"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Type Modal */}
      {(showCreateTypeModal || editingType) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <Settings2 className="w-6 h-6 mr-2 text-blue-600" />
                  {editingType ? 'Edit Variant Type' : 'Create Variant Type'}
                </h2>
                <button
                  onClick={() => {
                    setShowCreateTypeModal(false)
                    setEditingType(null)
                    setNewTypeName('')
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={editingType ? (e) => { e.preventDefault(); updateVariantType(); } : createVariantType}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type Name *
                  </label>
                  <input
                    type="text"
                    value={editingType ? editingType.name : newTypeName}
                    onChange={(e) => editingType 
                      ? setEditingType({...editingType, name: e.target.value})
                      : setNewTypeName(e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
                    placeholder="e.g., Size, Color, Material"
                    required
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateTypeModal(false)
                      setEditingType(null)
                      setNewTypeName('')
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    {editingType ? 'Update' : 'Create'} Type
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Options Modal */}
      {showAddOptionsModal && selectedTypeForOptions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Add Options to {selectedTypeForOptions.name}
                </h2>
                <button
                  onClick={() => {
                    setShowAddOptionsModal(false)
                    setSelectedTypeForOptions(null)
                    setNewOptions([''])
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={addVariantOptions}>
                <div className="space-y-3 mb-4">
                  {newOptions.map((option, index) => (
                    <div key={index} className="flex space-x-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const updated = [...newOptions]
                          updated[index] = e.target.value
                          setNewOptions(updated)
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
                        placeholder="Enter option value"
                      />
                      {newOptions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewOptions(newOptions.filter((_, i) => i !== index))
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setNewOptions([...newOptions, ''])}
                  className="mb-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4 inline mr-2" />
                  Add Another Option
                </button>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddOptionsModal(false)
                      setSelectedTypeForOptions(null)
                      setNewOptions([''])
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    Add Options
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Option Modal */}
      {editingOption && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Edit Option
                </h2>
                <button
                  onClick={() => setEditingOption(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); updateVariantOption(); }}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Option Value *
                  </label>
                  <input
                    type="text"
                    value={editingOption.value}
                    onChange={(e) => setEditingOption({...editingOption, value: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
                    required
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditingOption(null)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    Update Option
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Type Confirmation Modal */}
      {deleteTypeModalOpen && typeToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="mb-4">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Delete Variant Type
              </h3>
              <p className="text-sm text-gray-600 text-center">
                Are you sure you want to delete "{typeToDelete.name}"? This will also delete all its options.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-amber-800">
                <strong>Warning:</strong> This will remove this variant type and all its options from existing products.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setDeleteTypeModalOpen(false)
                  setTypeToDelete(null)
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={deleteVariantType}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Type
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Option Confirmation Modal */}
      {deleteOptionModalOpen && optionToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="mb-4">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Delete Option
              </h3>
              <p className="text-sm text-gray-600 text-center">
                Are you sure you want to delete "{optionToDelete.value}"?
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setDeleteOptionModalOpen(false)
                  setOptionToDelete(null)
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={deleteVariantOption}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Option
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}