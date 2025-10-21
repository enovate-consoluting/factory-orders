'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Trash icon component
const TrashIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

type Product = {
  id: string
  title: string
  description: string
  created_at: string
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
  
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newProductTitle, setNewProductTitle] = useState('')
  const [newProductDescription, setNewProductDescription] = useState('')
  const [newProductVariants, setNewProductVariants] = useState<string[]>([])
  
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [selectedVariants, setSelectedVariants] = useState<string[]>([])

  // Notification state
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
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
      const { data: newProduct, error } = await supabase
        .from('products')
        .insert([{ 
          title: newProductTitle.trim(),
          description: newProductDescription.trim()
        }])
        .select()
        .single()
      
      if (error) throw error
      
      if (newProduct && newProductVariants.length > 0) {
        const inserts = newProductVariants.map(variantId => ({
          product_id: newProduct.id,
          variant_option_id: variantId
        }))
        
        const { error: variantError } = await supabase.from('product_variants').insert(inserts)
        if (variantError) throw variantError
      }
      
      setNewProductTitle('')
      setNewProductDescription('')
      setNewProductVariants([])
      setShowCreateForm(false)
      setNotification({ message: 'Product created successfully!', type: 'success' })
      loadData()
    } catch (error) {
      console.error('Error creating product:', error)
      setNotification({ message: 'Error creating product', type: 'error' })
    }
  }

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product? This action cannot be undone.')) return
    
    try {
      // First delete all product_variants
      const { error: variantError } = await supabase
        .from('product_variants')
        .delete()
        .eq('product_id', id)
      
      if (variantError) throw variantError
      
      // Then delete the product
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setNotification({ message: 'Product deleted successfully', type: 'success' })
      loadData()
    } catch (error) {
      console.error('Error deleting product:', error)
      setNotification({ message: 'Error deleting product', type: 'error' })
    }
  }

  const openEditVariants = (product: Product) => {
    setEditingProduct(product)
    const currentVariants = productVariants
      .filter(pv => pv.product_id === product.id)
      .map(pv => pv.variant_option_id)
    setSelectedVariants(currentVariants)
  }

  const saveProductVariants = async () => {
    if (!editingProduct) return
    
    try {
      // Delete existing variants
      const { error: deleteError } = await supabase
        .from('product_variants')
        .delete()
        .eq('product_id', editingProduct.id)
      
      if (deleteError) throw deleteError
      
      // Insert new variants
      if (selectedVariants.length > 0) {
        const inserts = selectedVariants.map(variantId => ({
          product_id: editingProduct.id,
          variant_option_id: variantId
        }))
        
        const { error: insertError } = await supabase
          .from('product_variants')
          .insert(inserts)
        
        if (insertError) throw insertError
      }
      
      setEditingProduct(null)
      setSelectedVariants([])
      setNotification({ message: 'Variants updated successfully!', type: 'success' })
      loadData()
    } catch (error) {
      console.error('Error saving variants:', error)
      setNotification({ message: 'Error saving variants', type: 'error' })
    }
  }

  const toggleVariant = (optionId: string, isCreating = false) => {
    if (isCreating) {
      if (newProductVariants.includes(optionId)) {
        setNewProductVariants(newProductVariants.filter(id => id !== optionId))
      } else {
        setNewProductVariants([...newProductVariants, optionId])
      }
    } else {
      if (selectedVariants.includes(optionId)) {
        setSelectedVariants(selectedVariants.filter(id => id !== optionId))
      } else {
        setSelectedVariants([...selectedVariants, optionId])
      }
    }
  }

  const selectAllForType = (typeId: string, isCreating = false) => {
    const typeOptions = getOptionsForType(typeId).map(opt => opt.id)
    
    if (isCreating) {
      const allSelected = typeOptions.every(id => newProductVariants.includes(id))
      if (allSelected) {
        setNewProductVariants(newProductVariants.filter(id => !typeOptions.includes(id)))
      } else {
        const newSet = new Set([...newProductVariants, ...typeOptions])
        setNewProductVariants(Array.from(newSet))
      }
    } else {
      const allSelected = typeOptions.every(id => selectedVariants.includes(id))
      if (allSelected) {
        setSelectedVariants(selectedVariants.filter(id => !typeOptions.includes(id)))
      } else {
        const newSet = new Set([...selectedVariants, ...typeOptions])
        setSelectedVariants(Array.from(newSet))
      }
    }
  }

  const getProductVariantDisplay = (productId: string) => {
    const variants = productVariants.filter(pv => pv.product_id === productId)
    if (variants.length === 0) return 'No variants assigned'
    
    const variantsByType: { [key: string]: string[] } = {}
    variants.forEach(pv => {
      const option = variantOptions.find(vo => vo.id === pv.variant_option_id)
      if (option) {
        const type = variantTypes.find(vt => vt.id === option.type_id)
        if (type) {
          if (!variantsByType[type.name]) variantsByType[type.name] = []
          variantsByType[type.name].push(option.value)
        }
      }
    })
    
    return Object.entries(variantsByType)
      .map(([type, values]) => `${type}: ${values.join(', ')}`)
      .join(' | ')
  }

  const getOptionsForType = (typeId: string) => {
    return variantOptions.filter(opt => opt.type_id === typeId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading products...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg text-white text-sm font-medium shadow-lg z-50 transition-all transform translate-x-0 ${
          notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Products</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-sm w-full sm:w-auto"
        >
          {showCreateForm ? 'Cancel' : '+ New Product'}
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="mb-6 bg-white rounded-lg p-4 sm:p-6 border border-gray-200 shadow-sm">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Create Product</h2>
          <form onSubmit={createProduct} className="space-y-4 sm:space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Product Title</label>
              <input
                type="text"
                value={newProductTitle}
                onChange={(e) => setNewProductTitle(e.target.value)}
                placeholder="e.g., Hoodie, T-Shirt, Pants"
                className="w-full px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={newProductDescription}
                onChange={(e) => setNewProductDescription(e.target.value)}
                placeholder="Quick description..."
                className="w-full px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Select Variants</label>
              <div className="space-y-3 sm:space-y-4">
                {variantTypes.map((type) => (
                  <div key={type.id} className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-base sm:text-lg font-medium text-gray-900">{type.name}</h3>
                      <button
                        type="button"
                        onClick={() => selectAllForType(type.id, true)}
                        className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition font-medium"
                      >
                        Select All
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {getOptionsForType(type.id).map((option) => (
                        <label
                          key={option.id}
                          className={`flex items-center px-2 sm:px-3 py-2 rounded cursor-pointer transition text-sm ${
                            newProductVariants.includes(option.id)
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={newProductVariants.includes(option.id)}
                            onChange={() => toggleVariant(option.id, true)}
                            className="mr-2 h-3 w-3 sm:h-4 sm:w-4"
                          />
                          <span className="truncate">{option.value}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full px-4 sm:px-6 py-2 sm:py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition shadow-sm text-sm sm:text-base"
            >
              Create Product
            </button>
          </form>
        </div>
      )}

      {/* Products List */}
      <div className="space-y-3 sm:space-y-4">
        {products.map((product) => (
          <div key={product.id} className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
              <div className="flex-1">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">{product.title}</h3>
                {product.description && (
                  <p className="text-gray-600 text-sm">{product.description}</p>
                )}
              </div>
              <button
                onClick={() => deleteProduct(product.id)}
                className="self-start sm:self-auto p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Delete product"
              >
                <TrashIcon />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs sm:text-sm text-gray-600 break-words">
                {getProductVariantDisplay(product.id)}
              </div>
              <button
                onClick={() => openEditVariants(product)}
                className="px-3 sm:px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs sm:text-sm transition font-medium w-full sm:w-auto"
              >
                Edit Variants
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {products.length === 0 && (
        <div className="text-center py-12 sm:py-16 bg-white rounded-lg border border-gray-200">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="mt-4 text-gray-600 text-sm sm:text-base">No products yet. Create one to get started!</p>
        </div>
      )}

      {/* Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-2xl w-full border border-gray-200 shadow-xl my-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
              Edit Variants for {editingProduct.title}
            </h2>

            <div className="space-y-3 sm:space-y-4 mb-6">
              {variantTypes.map((type) => (
                <div key={type.id} className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-base sm:text-lg font-medium text-gray-900">{type.name}</h3>
                    <button
                      onClick={() => selectAllForType(type.id, false)}
                      className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition font-medium"
                    >
                      Select All
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {getOptionsForType(type.id).map((option) => (
                      <label
                        key={option.id}
                        className={`flex items-center px-3 sm:px-4 py-2 rounded cursor-pointer transition text-sm ${
                          selectedVariants.includes(option.id)
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedVariants.includes(option.id)}
                          onChange={() => toggleVariant(option.id, false)}
                          className="mr-2 h-3 w-3 sm:h-4 sm:w-4"
                        />
                        <span className="truncate">{option.value}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setEditingProduct(null)
                  setSelectedVariants([])
                }}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={saveProductVariants}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition shadow-sm text-sm sm:text-base"
              >
                Save Variants
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}