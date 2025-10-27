'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// Icon components as inline SVGs to avoid dependencies
const ChevronLeft = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
)

const ChevronRight = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
)

const Plus = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

const X = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const Upload = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
)

const Save = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
  </svg>
)

const Send = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
)

const Package = ({ className = "w-12 h-12" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
)

const Video = ({ className = "w-8 h-8" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
)

const Trash2 = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const FileText = ({ className = "w-8 h-8" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

type Client = {
  id: string
  name: string
  email: string
}

type Manufacturer = {
  id: string
  name: string
  email: string
}

type Product = {
  id: string
  title: string
  description: string
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

type SelectedProduct = {
  productId: string
  variantCombos: {
    [combo: string]: {
      quantity: number
      notes: string
    }
  }
  referenceMedia: File[]
}

export default function CreateOrderPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  // Form data
  const [orderName, setOrderName] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedManufacturerId, setSelectedManufacturerId] = useState('')
  
  // Data from database
  const [clients, setClients] = useState<Client[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [variantTypes, setVariantTypes] = useState<VariantType[]>([])
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([])
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([])
  
  // Selected products for order
  const [selectedProducts, setSelectedProducts] = useState<{ [key: string]: SelectedProduct }>({})
  
  const [showProductPicker, setShowProductPicker] = useState(false)
  
  // Media viewer state
  const [viewingMedia, setViewingMedia] = useState<{ files: File[]; index: number; title: string } | null>(null)
  
  // Notification state
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadData()
  }, [])
  
  useEffect(() => {
    // Auto-hide notification after 4 seconds
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const loadData = async () => {
    setLoading(true)
    
    const [clientsRes, manufacturersRes, productsRes, typesRes, optionsRes, productVariantsRes] = await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('manufacturers').select('*').order('name'),
      supabase.from('products').select('*').order('title'),
      supabase.from('variant_types').select('*').order('name'),
      supabase.from('variant_options').select('*').order('value'),
      supabase.from('product_variants').select('*')
    ])
    
    setClients(clientsRes.data || [])
    setManufacturers(manufacturersRes.data || [])
    setProducts(productsRes.data || [])
    setVariantTypes(typesRes.data || [])
    setVariantOptions(optionsRes.data || [])
    setProductVariants(productVariantsRes.data || [])
    setLoading(false)
  }

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId)
  }

  const addProduct = (productId: string) => {
    // Don't close modal or do anything if already selected
    if (selectedProducts[productId]) return
    
    const product = products.find(p => p.id === productId)
    if (!product) return
    
    // Get variants for this product
    const productVariantIds = productVariants
      .filter(pv => pv.product_id === productId)
      .map(pv => pv.variant_option_id)
    
    // Group variants by type
    const variantsByType: { [typeId: string]: { typeName: string; options: string[] } } = {}
    
    productVariantIds.forEach(optionId => {
      const option = variantOptions.find(vo => vo.id === optionId)
      if (option) {
        const type = variantTypes.find(vt => vt.id === option.type_id)
        if (type) {
          if (!variantsByType[type.id]) {
            variantsByType[type.id] = {
              typeName: type.name,
              options: []
            }
          }
          variantsByType[type.id].options.push(option.value)
        }
      }
    })
    
    // Generate all combinations
    const combinations = generateVariantCombinations(variantsByType)
    
    // Initialize product with empty combos
    const variantCombos: { [combo: string]: { quantity: number; notes: string } } = {}
    combinations.forEach(combo => {
      variantCombos[combo] = { quantity: 0, notes: '' }
    })
    
    setSelectedProducts(prev => ({
      ...prev,
      [productId]: {
        productId,
        variantCombos,
        referenceMedia: []
      }
    }))
  }
  
  const removeProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const newProducts = { ...prev }
      delete newProducts[productId]
      return newProducts
    })
  }
  
  const generateVariantCombinations = (variantsByType: { [typeId: string]: { typeName: string; options: string[] } }): string[] => {
    const typeIds = Object.keys(variantsByType)
    
    if (typeIds.length === 0) {
      return ['Standard'] // No variants, return standard option
    }
    
    const combinations: string[] = []
    
    const generate = (index: number, current: string[]) => {
      if (index === typeIds.length) {
        combinations.push(current.join(' / '))
        return
      }
      
      const typeId = typeIds[index]
      const { options } = variantsByType[typeId]
      
      options.forEach(option => {
        generate(index + 1, [...current, option])
      })
    }
    
    generate(0, [])
    return combinations
  }
  
  const updateQuantity = (productId: string, combo: string, value: string) => {
    const quantity = Math.max(0, parseInt(value) || 0) // Prevent negative quantities
    setSelectedProducts(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        variantCombos: {
          ...prev[productId].variantCombos,
          [combo]: {
            ...prev[productId].variantCombos[combo],
            quantity
          }
        }
      }
    }))
  }
  
  const updateNotes = (productId: string, combo: string, notes: string) => {
    setSelectedProducts(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        variantCombos: {
          ...prev[productId].variantCombos,
          [combo]: {
            ...prev[productId].variantCombos[combo],
            notes
          }
        }
      }
    }))
  }
  
  const quickFillQuantity = (productId: string, value: number) => {
    const quantity = Math.max(0, value) // Prevent negative quantities
    setSelectedProducts(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        variantCombos: Object.keys(prev[productId].variantCombos).reduce((acc, combo) => {
          acc[combo] = {
            ...prev[productId].variantCombos[combo],
            quantity
          }
          return acc
        }, {} as { [combo: string]: { quantity: number; notes: string } })
      }
    }))
  }
  
  const handleMediaUpload = (productId: string, files: FileList | null) => {
    if (!files) return
    
    // Accept images, videos, and PDFs
    const validFiles = Array.from(files).filter(file => {
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/') || 
                      file.name.toLowerCase().endsWith('.mp4') || 
                      file.name.toLowerCase().endsWith('.mov')
      const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      return isImage || isVideo || isPDF
    })
    
    setSelectedProducts(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        referenceMedia: [...prev[productId].referenceMedia, ...validFiles]
      }
    }))
  }
  
  const removeMedia = (productId: string, index: number) => {
    setSelectedProducts(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        referenceMedia: prev[productId].referenceMedia.filter((_, i) => i !== index)
      }
    }))
  }
  
  const navigateMedia = (direction: 'prev' | 'next') => {
    if (!viewingMedia) return
    
    const newIndex = direction === 'next' 
      ? (viewingMedia.index + 1) % viewingMedia.files.length
      : (viewingMedia.index - 1 + viewingMedia.files.length) % viewingMedia.files.length
    
    setViewingMedia({ ...viewingMedia, index: newIndex })
  }
  
  const deleteMediaFromViewer = () => {
    if (!viewingMedia) return
    
    // Find which product has this media
    for (const productId in selectedProducts) {
      const product = selectedProducts[productId]
      const mediaIndex = product.referenceMedia.indexOf(viewingMedia.files[viewingMedia.index])
      
      if (mediaIndex !== -1) {
        removeMedia(productId, mediaIndex)
        
        // Update viewer
        if (viewingMedia.files.length === 1) {
          setViewingMedia(null)
        } else {
          const newFiles = viewingMedia.files.filter((_, i) => i !== viewingMedia.index)
          const newIndex = Math.min(viewingMedia.index, newFiles.length - 1)
          setViewingMedia({
            ...viewingMedia,
            files: newFiles,
            index: newIndex
          })
        }
        break
      }
    }
  }
  
  const createOrder = async (isDraft: boolean = false) => {
    try {
      // Validation
      if (!selectedClientId || !selectedManufacturerId) {
        setNotification({
          message: 'Please select a client and manufacturer',
          type: 'error'
        })
        return
      }

      if (Object.keys(selectedProducts).length === 0) {
        setNotification({
          message: 'Please add at least one product to the order',
          type: 'error'
        })
        return
      }

      setIsSaving(true)
      
      // Get the user from localStorage
      const userData = localStorage.getItem('user')
      const currentUser = userData ? JSON.parse(userData) : null
      
      // Use system UUID if no user is logged in
      const systemUserId = '00000000-0000-0000-0000-000000000000' // System user UUID
      const createdBy = currentUser?.id || systemUserId
      
      console.log('Creating order with:', {
        client: selectedClientId,
        manufacturer: selectedManufacturerId,
        products: Object.keys(selectedProducts).length,
        user: createdBy,
        userName: currentUser?.name || 'System'
      })
      
      // Generate order number
      const orderNumber = isDraft 
        ? `DRAFT-${Date.now().toString().slice(-6)}`
        : `ORD-${Date.now().toString().slice(-6)}`
      
      // Build order data - explicitly set created_by to null if no user
      const orderInsertData = {
        order_number: orderNumber,
        client_id: selectedClientId,
        manufacturer_id: selectedManufacturerId,
        status: isDraft ? 'draft' : 'submitted',
        created_by: currentUser?.id || null  // Explicitly use null, not undefined
      }
      
      console.log('Order insert data:', orderInsertData)
      
      // Create the order
      const { data: orderResult, error: orderError } = await supabase
        .from('orders')
        .insert(orderInsertData)
        .select()
        .single()
      
      if (orderError) {
        console.error('Order creation error:', orderError)
        console.error('Order data that failed:', orderInsertData)
        
        // More specific error messages
        if (orderError.message?.includes('created_by_fkey')) {
          throw new Error('User authentication issue. Please try logging out and back in, or contact support.')
        }
        throw new Error(`Failed to create order: ${orderError.message}`)
      }

      if (!orderResult) {
        throw new Error('No order data returned')
      }

      console.log('Order created:', orderResult)
      
      // Add products to the order
      for (const productId in selectedProducts) {
        const selectedProduct = selectedProducts[productId]
        const product = products.find(p => p.id === productId)
        if (!product) {
          console.warn(`Product not found: ${productId}`)
          continue
        }
        
        console.log(`Adding product ${product.title} to order`)
        
        // Create order_product entry
        const { data: orderProductData, error: opError } = await supabase
          .from('order_products')
          .insert({
            order_id: orderResult.id,
            product_id: productId,
            product_order_number: `PRD-${Date.now().toString().slice(-4)}`
          })
          .select()
          .single()
        
        if (opError) {
          console.error('Order product error:', opError)
          throw new Error(`Failed to add product ${product.title}: ${opError.message}`)
        }

        if (!orderProductData) {
          throw new Error(`No order product data returned for ${product.title}`)
        }
        
        // Add order items (variant combinations)
        const itemsToInsert = Object.entries(selectedProduct.variantCombos)
          .filter(([_, data]) => data.quantity > 0)
          .map(([combo, data]) => ({
            order_product_id: orderProductData.id,
            variant_combo: combo,
            quantity: data.quantity,
            notes: data.notes || null,
            admin_status: 'pending',
            manufacturer_status: 'pending'
          }))
        
        console.log(`Inserting ${itemsToInsert.length} items for product ${product.title}`)
        
        if (itemsToInsert.length > 0) {
          const { error: itemError } = await supabase
            .from('order_items')
            .insert(itemsToInsert)
          
          if (itemError) {
            console.error('Order items error:', itemError)
            throw new Error(`Failed to add items for ${product.title}: ${itemError.message}`)
          }
        }
        
        // Upload media files
        if (selectedProduct.referenceMedia && selectedProduct.referenceMedia.length > 0) {
          console.log(`Uploading ${selectedProduct.referenceMedia.length} media files`)
          
          for (const file of selectedProduct.referenceMedia) {
            try {
              const fileExt = file.name.split('.').pop()
              const fileName = `ref-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
              
              console.log(`Uploading file: ${fileName}`)
              
              const { error: uploadError } = await supabase.storage
                .from('order-media')
                .upload(fileName, file)
              
              if (uploadError) {
                console.error('File upload error:', uploadError)
                // Continue with other files even if one fails
                continue
              }

              const { data: { publicUrl } } = supabase.storage
                .from('order-media')
                .getPublicUrl(fileName)
              
              await supabase
                .from('order_media')
                .insert({
                  order_product_id: orderProductData.id,
                  file_url: publicUrl,
                  file_type: file.type.startsWith('image/') ? 'image' : 
                           file.type.startsWith('video/') ? 'video' : 'pdf',
                  uploaded_by: currentUser?.id || null
                })
            } catch (fileError) {
              console.error('Error processing file:', file.name, fileError)
              // Continue with order creation even if media upload fails
            }
          }
        }
      }
      
      // Log the action
      try {
        await supabase
          .from('audit_log')
          .insert({
            user_id: currentUser?.id || null,
            user_name: currentUser?.name || 'System',
            action_type: 'create_order',
            target_type: 'order',
            target_id: orderResult.id,
            new_value: JSON.stringify({ 
              status: isDraft ? 'draft' : 'submitted',
              order_number: orderNumber 
            })
          })
      } catch (auditError) {
        console.error('Audit log error (non-critical):', auditError)
        // Don't fail the order creation if audit log fails
      }
      
      setNotification({
        message: `Order ${orderNumber} ${isDraft ? 'saved as draft' : 'created'} successfully!`,
        type: 'success'
      })
      
      // Redirect after a short delay to show the success message
      setTimeout(() => {
        router.push('/dashboard/orders')
      }, 1500)
      
    } catch (error) {
      console.error('Error creating order:', error)
      
      // Better error message handling
      let errorMessage = 'Failed to create order. Please try again.'
      
      if (error instanceof Error) {
        errorMessage = error.message
        
        // Check for specific Supabase errors
        if (error.message.includes('duplicate key')) {
          errorMessage = 'An order with this number already exists. Please try again.'
        } else if (error.message.includes('foreign key')) {
          errorMessage = 'Invalid client or manufacturer selected. Please refresh and try again.'
        } else if (error.message.includes('permission denied')) {
          errorMessage = 'You do not have permission to create orders. Please contact an administrator.'
        }
      }
      
      setNotification({
        message: errorMessage,
        type: 'error'
      })
    } finally {
      setIsSaving(false)
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all transform animate-slide-in ${
          notification.type === 'success' 
            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' 
            : 'bg-gradient-to-r from-red-500 to-red-600 text-white'
        }`}>
          <p className="font-medium">{notification.message}</p>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Create New Order</h1>
          <button
            onClick={() => router.push('/dashboard/orders')}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition border border-gray-200 text-sm sm:text-base"
          >
            Cancel
          </button>
        </div>

        {/* Order Details */}
        <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200 shadow-sm mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Order Details</h2>
          
          {/* Order Name - Full width on top */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Order Name
            </label>
            <input
              type="text"
              value={orderName}
              onChange={(e) => setOrderName(e.target.value)}
              placeholder="e.g., Summer Collection 2024"
              className="w-full px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
            />
          </div>
          
          {/* Client and Manufacturer - Side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client *
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="w-full min-h-[42px] px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                required
              >
                <option value="">Select client...</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Manufacturer *
              </label>
              <select
                value={selectedManufacturerId}
                onChange={(e) => setSelectedManufacturerId(e.target.value)}
                className="w-full min-h-[42px] px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                required
              >
                <option value="">Select manufacturer...</option>
                {manufacturers.map(mfr => (
                  <option key={mfr.id} value={mfr.id}>{mfr.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Products Section */}
        <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Add Product(s)</h2>
            <button
              onClick={() => setShowProductPicker(true)}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <Plus />
              Add Products to This Order
            </button>
          </div>

          {Object.keys(selectedProducts).length === 0 && (
            <p className="text-gray-500 text-center py-8">No products added yet</p>
          )}

          {Object.entries(selectedProducts).map(([productId, productData]) => {
            const product = products.find(p => p.id === productId)
            if (!product) return null
            
            return (
              <div key={productId} className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800">{product.title}</h3>
                    {product.description && (
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">{product.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeProduct(productId)}
                    className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition ml-4"
                    title="Remove product"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Fill - Mobile friendly with Apply button */}
                <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Quick fill quantity:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="Quantity"
                        className="w-24 sm:w-32 px-3 py-1.5 bg-white border border-gray-300 rounded text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            const value = parseInt((e.target as HTMLInputElement).value)
                            if (!isNaN(value) && value >= 0) {
                              quickFillQuantity(productId, value)
                              ;(e.target as HTMLInputElement).value = ''
                            }
                          }
                        }}
                        id={`quick-fill-${productId}`}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById(`quick-fill-${productId}`) as HTMLInputElement
                          const value = parseInt(input.value)
                          if (!isNaN(value) && value >= 0) {
                            quickFillQuantity(productId, value)
                            input.value = ''
                          }
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition whitespace-nowrap"
                      >
                        Apply
                      </button>
                      <span className="text-xs text-gray-500 hidden sm:inline">or press Enter</span>
                    </div>
                  </div>
                </div>

                {/* Variants - Mobile responsive */}
                <div className="space-y-2 mb-4">
                  {Object.entries(productData.variantCombos).map(([combo, data]) => (
                    <div key={combo} className="flex flex-col sm:flex-row gap-2 p-3 bg-white rounded-lg border border-gray-200">
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-700">{combo}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="number"
                          min="0"
                          placeholder="Quantity"
                          value={data.quantity || ''}
                          onChange={(e) => updateQuantity(productId, combo, e.target.value)}
                          className="w-full sm:w-24 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Notes (optional)"
                          value={data.notes}
                          onChange={(e) => updateNotes(productId, combo, e.target.value)}
                          className="w-full sm:w-48 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reference Media */}
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reference Media
                  </label>
                  
                  {/* Upload Button with clear file types */}
                  <div className="mb-3">
                    <label className="relative cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition">
                      <Upload />
                      <span className="text-sm">Upload Files</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*,.pdf,.mp4,.mov,.MP4,.MOV"
                        onChange={(e) => handleMediaUpload(productId, e.target.files)}
                        className="hidden"
                      />
                    </label>
                    <span className="text-xs text-gray-500 ml-2 block sm:inline mt-1 sm:mt-0">
                      Accepted: JPEG, PNG, PDF, MP4, MOV files
                    </span>
                  </div>
                  
                  {/* Media Grid - Mobile responsive */}
                  {productData.referenceMedia.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {productData.referenceMedia.map((file, index) => (
                        <div
                          key={index}
                          className="relative group cursor-pointer"
                          onClick={() => setViewingMedia({
                            files: productData.referenceMedia,
                            index,
                            title: product.title
                          })}
                        >
                          <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                            {file.type.startsWith('image/') ? (
                              <img
                                src={URL.createObjectURL(file)}
                                alt={`Reference ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            ) : file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.mp4') || file.name.toLowerCase().endsWith('.mov') ? (
                              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                <Video className="w-6 h-6 sm:w-8 sm:h-8 text-gray-500" />
                              </div>
                            ) : file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') ? (
                              <div className="w-full h-full flex items-center justify-center bg-red-50">
                                <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
                              </div>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                <Package className="w-6 h-6 sm:w-8 sm:h-8 text-gray-500" />
                              </div>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              removeMedia(productId, index)
                            }}
                            className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Action Buttons - Mobile responsive */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pb-6">
          <button
            onClick={() => createOrder(true)}
            disabled={isSaving}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-lg transition flex items-center justify-center gap-2 ${
              isSaving
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
            }`}
          >
            <Save />
            Save as Draft
          </button>
          <button
            onClick={() => createOrder(false)}
            disabled={isSaving}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-lg transition flex items-center justify-center gap-2 ${
              isSaving
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Send />
                <span>Create Order</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Product Picker Modal - Mobile responsive */}
      {showProductPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]">
          <div className="relative z-[10000] bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Select Products</h2>
              <button
                onClick={() => setShowProductPicker(false)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            
            {/* Search bar */}
            <div className="px-4 py-2 border-b border-gray-100">
              <input
                type="text"
                placeholder="Search products..."
                className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {/* Product Grid - Mobile responsive */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {products.map(product => {
                  const isSelected = !!selectedProducts[product.id]
                  return (
                    <div
                      key={product.id}
                      onClick={() => {
                        if (isSelected) {
                          removeProduct(product.id)
                        } else {
                          addProduct(product.id)
                        }
                      }}
                      className={`relative p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 border-blue-400'
                          : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      {/* Selected indicator */}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5">
                          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      )}
                      
                      <div className="text-sm font-medium text-gray-800 mb-0.5 pr-6">{product.title}</div>
                      {product.description && (
                        <div className="text-xs text-gray-500 line-clamp-2">{product.description}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowProductPicker(false)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Viewer Modal - Mobile responsive */}
      {viewingMedia && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={() => setViewingMedia(null)}>
          <div className="relative max-w-4xl w-full bg-white rounded-lg overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800">{viewingMedia.title}</h3>
                {viewingMedia.files.length > 1 && (
                  <span className="text-xs sm:text-sm text-gray-600">
                    {viewingMedia.index + 1} of {viewingMedia.files.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setViewingMedia(null)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            <div className="relative bg-gray-100" style={{ height: '50vh', maxHeight: '600px' }}>
              <div className="absolute inset-0 flex items-center justify-center p-4">
                {/* Previous Button */}
                {viewingMedia.files.length > 1 && (
                  <button
                    onClick={() => navigateMedia('prev')}
                    className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-1.5 sm:p-2 z-10 shadow-lg transition"
                  >
                    <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-800" />
                  </button>
                )}
                
                {/* Media Content */}
                <div className="max-w-full max-h-full flex items-center justify-center">
                  {(() => {
                    const file = viewingMedia.files[viewingMedia.index]
                    const url = URL.createObjectURL(file)
                    
                    if (file.type.startsWith('image/')) {
                      return (
                        <img 
                          src={url} 
                          alt={`Media ${viewingMedia.index + 1}`} 
                          className="max-w-full max-h-full object-contain"
                          style={{ maxHeight: 'calc(50vh - 2rem)' }}
                        />
                      )
                    } else if (file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.mp4') || file.name.toLowerCase().endsWith('.mov')) {
                      return (
                        <video 
                          src={url} 
                          controls 
                          className="max-w-full max-h-full"
                          style={{ maxHeight: 'calc(50vh - 2rem)' }}
                          autoPlay
                        />
                      )
                    } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                      return (
                        <div className="text-gray-500 text-center">
                          <FileText className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 text-red-500" />
                          <p className="font-medium text-sm sm:text-base">{file.name}</p>
                          <p className="text-xs sm:text-sm mt-1">PDF Preview not available</p>
                          <p className="text-xs mt-2 text-gray-400">Click outside to close</p>
                        </div>
                      )
                    } else {
                      return (
                        <div className="text-gray-500 text-center">
                          <Package className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2" />
                          <p className="text-sm sm:text-base">{file.name}</p>
                          <p className="text-xs sm:text-sm mt-1">Preview not available</p>
                        </div>
                      )
                    }
                  })()}
                </div>
                
                {/* Next Button */}
                {viewingMedia.files.length > 1 && (
                  <button
                    onClick={() => navigateMedia('next')}
                    className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-1.5 sm:p-2 z-10 shadow-lg transition"
                  >
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-800" />
                  </button>
                )}
                
                {/* Delete button in viewer */}
                <button
                  onClick={deleteMediaFromViewer}
                  className="absolute top-2 sm:top-4 right-2 sm:right-4 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 sm:p-2 z-10 shadow-lg transition"
                  title="Delete this file"
                >
                  <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
            
            {/* Thumbnail Strip - Mobile responsive */}
            {viewingMedia.files.length > 1 && (
              <div className="p-3 sm:p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex gap-2 overflow-x-auto">
                  {viewingMedia.files.map((file, index) => (
                    <button
                      key={index}
                      onClick={() => setViewingMedia({ ...viewingMedia, index })}
                      className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition ${
                        index === viewingMedia.index ? 'border-blue-500' : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {file.type.startsWith('image/') ? (
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt={`Thumbnail ${index + 1}`} 
                          className="w-full h-full object-cover"
                        />
                      ) : file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.mp4') || file.name.toLowerCase().endsWith('.mov') ? (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <Video className="w-6 h-6 sm:w-8 sm:h-8 text-gray-500" />
                        </div>
                      ) : file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') ? (
                        <div className="w-full h-full bg-red-50 flex items-center justify-center">
                          <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
                        </div>
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <Package className="w-6 h-6 sm:w-8 sm:h-8 text-gray-500" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}