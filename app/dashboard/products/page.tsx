'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Plus, 
  X, 
  Package, 
  Edit2, 
  Trash2, 
  Search,
  Filter,
  Tag,
  Check,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Grid3x3,
  List
} from 'lucide-react'

type Product = {
  id: string
  title: string
  created_at: string
  is_clothing: boolean
}

type VariantType = {
  id: string
  name: string
}

type VariantOption = {
  id: string
  type_id: string
  value: string
}

type ProductVariant = {
  id: string
  product_id: string
  variant_option_id: string
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [variantTypes, setVariantTypes] = useState<VariantType[]>([])
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([])
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [user, setUser] = useState<any>(null)
  
  // Modal states
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newProductTitle, setNewProductTitle] = useState('')
  const [newProductVariants, setNewProductVariants] = useState<string[]>([])
  const [newProductIsClothing, setNewProductIsClothing] = useState(false)
  
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [selectedVariants, setSelectedVariants] = useState<string[]>([])

  // Delete confirmation
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Notification state
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

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

  // Lock body scroll when modals are open
  useEffect(() => {
    if (showCreateForm || editingProduct || deleteModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showCreateForm, editingProduct, deleteModalOpen])

  const loadData = async () => {
    setLoading(true)
    try {
      const [productsData, typesData, optionsData, productVariantsData] = await Promise.all([
        supabase.from('products').select('*').order('title'),
        supabase.from('variant_types').select('*').order('name'),
        supabase.from('variant_options').select('*').order('value'),
        supabase.from('product_variants').select('*')
      ])
      
      if (productsData.error) throw productsData.error
      if (typesData.error) throw typesData.error
      if (optionsData.error) throw optionsData.error
      if (productVariantsData.error) throw productVariantsData.error
      
      setProducts(productsData.data || [])
      setVariantTypes(typesData.data || [])
      setVariantOptions(optionsData.data || [])
      setProductVariants(productVariantsData.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
      setNotification({ message: 'Error loading products', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const createProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newProductTitle.trim()) {
      setNotification({ message: 'Please enter a product title', type: 'error' })
      return
    }
    
    try {
      // Create the product
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          title: newProductTitle,
          is_clothing: newProductIsClothing
        })
        .select()
        .single()
      
      if (productError) throw productError
      
      // Create product variants
      if (newProductVariants.length > 0) {
        const variantsToInsert = newProductVariants.map(variantId => ({
          product_id: product.id,
          variant_option_id: variantId
        }))
        
        const { error: variantError } = await supabase
          .from('product_variants')
          .insert(variantsToInsert)
        
        if (variantError) throw variantError
      }
      
      setNotification({ message: 'Product created successfully!', type: 'success' })
      setShowCreateForm(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error creating product:', error)
      setNotification({ message: 'Error creating product', type: 'error' })
    }
  }

  const updateProduct = async () => {
    if (!editingProduct || !editingProduct.title.trim()) {
      setNotification({ message: 'Please enter a product title', type: 'error' })
      return
    }
    
    try {
      // Update the product
      const { error: updateError } = await supabase
        .from('products')
        .update({
          title: editingProduct.title,
          is_clothing: editingProduct.is_clothing
        })
        .eq('id', editingProduct.id)
      
      if (updateError) throw updateError
      
      // Delete existing variants
      const { error: deleteError } = await supabase
        .from('product_variants')
        .delete()
        .eq('product_id', editingProduct.id)
      
      if (deleteError) throw deleteError
      
      // Insert new variants
      if (selectedVariants.length > 0) {
        const variantsToInsert = selectedVariants.map(variantId => ({
          product_id: editingProduct.id,
          variant_option_id: variantId
        }))
        
        const { error: variantError } = await supabase
          .from('product_variants')
          .insert(variantsToInsert)
        
        if (variantError) throw variantError
      }
      
      setNotification({ message: 'Product updated successfully!', type: 'success' })
      setEditingProduct(null)
      setSelectedVariants([])
      loadData()
    } catch (error) {
      console.error('Error updating product:', error)
      setNotification({ message: 'Error updating product', type: 'error' })
    }
  }

  const deleteProduct = async () => {
    if (!productToDelete) return
    
    setDeleting(true)
    try {
      // Delete product variants first
      const { error: variantsError } = await supabase
        .from('product_variants')
        .delete()
        .eq('product_id', productToDelete.id)
      
      if (variantsError) throw variantsError
      
      // Delete the product
      const { error: productError } = await supabase
        .from('products')
        .delete()
        .eq('id', productToDelete.id)
      
      if (productError) throw productError
      
      setNotification({ message: 'Product deleted successfully!', type: 'success' })
      setDeleteModalOpen(false)
      setProductToDelete(null)
      loadData()
    } catch (error) {
      console.error('Error deleting product:', error)
      setNotification({ message: 'Error deleting product', type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const resetForm = () => {
    setNewProductTitle('')
    setNewProductVariants([])
    setNewProductIsClothing(false)
  }

  const toggleVariantType = (typeId: string) => {
    const typeOptions = variantOptions.filter(opt => opt.type_id === typeId)
    const typeOptionIds = typeOptions.map(opt => opt.id)
    const allSelected = typeOptionIds.every(id => 
      showCreateForm ? newProductVariants.includes(id) : selectedVariants.includes(id)
    )
    
    if (showCreateForm) {
      if (allSelected) {
        setNewProductVariants(newProductVariants.filter(id => !typeOptionIds.includes(id)))
      } else {
        setNewProductVariants([...new Set([...newProductVariants, ...typeOptionIds])])
      }
    } else {
      if (allSelected) {
        setSelectedVariants(selectedVariants.filter(id => !typeOptionIds.includes(id)))
      } else {
        setSelectedVariants([...new Set([...selectedVariants, ...typeOptionIds])])
      }
    }
  }

  const getProductVariants = (productId: string) => {
    const variants = productVariants.filter(pv => pv.product_id === productId)
    return variants.map(v => {
      const option = variantOptions.find(opt => opt.id === v.variant_option_id)
      const type = variantTypes.find(t => t.id === option?.type_id)
      return { type: type?.name, value: option?.value }
    }).filter(v => v.type && v.value)
  }

  // Group variants by type for display
  const getGroupedVariants = (productId: string) => {
    const variants = getProductVariants(productId)
    const grouped: { [key: string]: string[] } = {}
    
    variants.forEach(v => {
      if (v.type) {
        if (!grouped[v.type]) {
          grouped[v.type] = []
        }
        if (v.value) {
          grouped[v.type].push(v.value)
        }
      }
    })
    
    return grouped
  }

  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const canManageProducts = () => {
  return user?.role === 'super_admin' || user?.role === 'admin'
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
            <Package className="w-8 h-8 mr-3 text-blue-600" />
            Products Management
          </h1>
          {canManageProducts() && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Product
            </button>
          )}
        </div>

        {/* Search and View Toggle */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium placeholder-gray-400"
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

      {/* Products Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map(product => {
            const groupedVariants = getGroupedVariants(product.id)
            const hasVariants = Object.keys(groupedVariants).length > 0
            
            return (
              <div key={product.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{product.title}</h3>
                      {product.is_clothing && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                          Clothing
                        </span>
                      )}
                    </div>
                    {canManageProducts() && (
                      <div className="flex space-x-1">
                        <button
                          onClick={() => {
                            setEditingProduct({ ...product, is_clothing: product.is_clothing || false })
                            const currentVariants = productVariants
                              .filter(pv => pv.product_id === product.id)
                              .map(pv => pv.variant_option_id)
                            setSelectedVariants(currentVariants)
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors font-medium"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => {
                            setProductToDelete(product)
                            setDeleteModalOpen(true)
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors font-medium"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* VARIANTS ALWAYS VISIBLE */}
                  {hasVariants ? (
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-600 mb-2">
                        <Tag className="w-4 h-4 mr-1" />
                        <span className="font-medium">Variants</span>
                      </div>
                      {Object.entries(groupedVariants).map(([typeName, values]) => (
                        <div key={typeName} className="bg-gray-50 rounded p-2">
                          <span className="text-xs font-medium text-gray-700">{typeName}:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {values.map((value, idx) => (
                              <span key={idx} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600">
                                {value}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No variants assigned</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Variants
                </th>
                {canManageProducts() && (
                  <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map(product => {
                const variants = getProductVariants(product.id)
                
                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm">{product.title}</span>
                        {product.is_clothing && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                            Clothing
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 py-3">
                      {variants.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {variants.slice(0, 3).map((v, idx) => (
                            <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs whitespace-nowrap">
                              {v.value}
                            </span>
                          ))}
                          {variants.length > 3 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs whitespace-nowrap">
                              +{variants.length - 3} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">No variants</span>
                      )}
                    </td>
                    {canManageProducts() && (
                      <td className="px-3 sm:px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingProduct({ ...product, is_clothing: product.is_clothing || false })
                              const currentVariants = productVariants
                                .filter(pv => pv.product_id === product.id)
                                .map(pv => pv.variant_option_id)
                              setSelectedVariants(currentVariants)
                            }}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors font-medium text-sm whitespace-nowrap"
                          >
                            <Edit2 className="w-4 h-4 flex-shrink-0" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => {
                              setProductToDelete(product)
                              setDeleteModalOpen(true)
                            }}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors font-medium text-sm whitespace-nowrap"
                          >
                            <Trash2 className="w-4 h-4 flex-shrink-0" />
                            <span>Delete</span>
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
      )}

      {/* Create/Edit Modal - FIXED: Using bg-black/50 for semi-transparent background */}
      {(showCreateForm || editingProduct) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto my-auto">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center">
                  <Package className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-blue-600" />
                  {editingProduct ? 'Edit Product' : 'Create New Product'}
                </h2>
                <button
                  onClick={() => {
                    setShowCreateForm(false)
                    setEditingProduct(null)
                    resetForm()
                    setSelectedVariants([])
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>

              <form onSubmit={editingProduct ? (e) => { e.preventDefault(); updateProduct(); } : createProduct}>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      Product Title *
                    </label>
                    <input
                      type="text"
                      value={editingProduct ? editingProduct.title : newProductTitle}
                      onChange={(e) => editingProduct
                        ? setEditingProduct({...editingProduct, title: e.target.value})
                        : setNewProductTitle(e.target.value)
                      }
                      className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium placeholder-gray-400"
                      placeholder="Enter product title"
                      required
                    />
                  </div>

                  {/* Clothing Product Checkbox */}
                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <input
                      type="checkbox"
                      id="is_clothing"
                      checked={editingProduct ? editingProduct.is_clothing : newProductIsClothing}
                      onChange={(e) => {
                        if (editingProduct) {
                          setEditingProduct({ ...editingProduct, is_clothing: e.target.checked })
                        } else {
                          setNewProductIsClothing(e.target.checked)
                        }
                      }}
                      className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <div>
                      <label htmlFor="is_clothing" className="text-sm font-semibold text-gray-900 cursor-pointer">
                        Clothing Product
                      </label>
                      <p className="text-xs text-gray-600">
                        Uses flat fee pricing instead of percentage margin
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      Variants
                    </label>
                    {variantTypes.map(type => {
                      const typeOptions = variantOptions.filter(opt => opt.type_id === type.id)
                      const selectedOptions = showCreateForm ? newProductVariants : selectedVariants
                      const allSelected = typeOptions.every(opt => selectedOptions.includes(opt.id))
                      const someSelected = typeOptions.some(opt => selectedOptions.includes(opt.id))
                      
                      return (
                        <div key={type.id} className="mb-3 sm:mb-4 p-2 sm:p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm sm:text-base font-medium text-gray-700">{type.name}</h4>
                            <button
                              type="button"
                              onClick={() => toggleVariantType(type.id)}
                              className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium transition-colors ${
                                allSelected
                                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                                  : someSelected
                                  ? 'bg-blue-200 text-blue-800 hover:bg-blue-300'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              {allSelected ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {typeOptions.map(option => {
                              const isSelected = selectedOptions.includes(option.id)
                              
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => {
                                    if (showCreateForm) {
                                      setNewProductVariants(
                                        isSelected
                                          ? newProductVariants.filter(id => id !== option.id)
                                          : [...newProductVariants, option.id]
                                      )
                                    } else {
                                      setSelectedVariants(
                                        isSelected
                                          ? selectedVariants.filter(id => id !== option.id)
                                          : [...selectedVariants, option.id]
                                      )
                                    }
                                  }}
                                  className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                                    isSelected
                                      ? 'bg-blue-600 text-white shadow-md'
                                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                                  {option.value}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-4 sm:mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false)
                      setEditingProduct(null)
                      resetForm()
                      setSelectedVariants([])
                    }}
                    className="px-4 py-2 text-sm sm:text-base bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm sm:text-base bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    {editingProduct ? 'Update Product' : 'Create Product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal - ALSO FIXED with bg-black/50 */}
      {deleteModalOpen && productToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-md w-full p-4 sm:p-6 my-auto">
            <div className="mb-4">
              <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full mx-auto mb-3 sm:mb-4">
                <Trash2 className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 text-center mb-2">
                Delete Product
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 text-center">
                Are you sure you want to delete "{productToDelete.title}"? This action cannot be undone.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 sm:p-3 mb-4 sm:mb-6">
              <p className="text-xs sm:text-sm text-amber-800">
                <strong>Warning:</strong> This will also remove this product from any existing orders.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => {
                  setDeleteModalOpen(false)
                  setProductToDelete(null)
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm sm:text-base bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={deleteProduct}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm sm:text-base bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                    Delete Product
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