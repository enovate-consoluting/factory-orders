'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
// Icon components using inline SVGs
const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
)

const XMarkIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
)

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

const ExclamationTriangleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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
  existingMediaIds?: string[]
}

type ExistingMedia = {
  id: string
  file_url: string
  file_type: string
}

export default function EditDraftPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [order, setOrder] = useState<any>(null)
  
  // Form data
  const [orderName, setOrderName] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedManufacturerId, setSelectedManufacturerId] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  
  // Data from database
  const [clients, setClients] = useState<Client[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [variantTypes, setVariantTypes] = useState<VariantType[]>([])
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([])
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([])
  
  // Selected products for order
  const [selectedProducts, setSelectedProducts] = useState<{ [key: string]: SelectedProduct }>({})
  const [existingMedia, setExistingMedia] = useState<{ [productId: string]: ExistingMedia[] }>({})
  
  const [showProductPicker, setShowProductPicker] = useState(false)
  
  // Media viewer state
  const [viewingMedia, setViewingMedia] = useState<{ files: (File | ExistingMedia)[]; index: number; title: string } | null>(null)
  
  // Notification state
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (orderId) {
      loadData()
      loadExistingOrder()
    }
  }, [orderId])
  
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
  }

  const loadExistingOrder = async () => {
    setLoading(true)
    
    try {
      // Load order details
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()
      
      if (orderError) throw orderError
      if (!orderData) throw new Error('Order not found')
      
      setOrder(orderData)
      setOrderName(orderData.order_number.replace('DRAFT-', ''))
      setSelectedClientId(orderData.client_id || '')
      setSelectedManufacturerId(orderData.manufacturer_id || '')
      
      // Load client email
      if (orderData.client_id) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('email')
          .eq('id', orderData.client_id)
          .single()
        
        if (clientData) {
          setClientEmail(clientData.email)
        }
      }
      
      // Load order products and items
      const { data: orderProducts } = await supabase
        .from('order_products')
        .select('*')
        .eq('order_id', orderId)
      
      if (orderProducts && orderProducts.length > 0) {
        const loadedProducts: { [key: string]: SelectedProduct } = {}
        const loadedMedia: { [productId: string]: ExistingMedia[] } = {}
        
        for (const orderProduct of orderProducts) {
          // Load items for this product
          const { data: items } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_product_id', orderProduct.id)
          
          // Load media for this product
          const { data: media } = await supabase
            .from('order_media')
            .select('*')
            .eq('order_product_id', orderProduct.id)
            .eq('is_sample', false)
          
          if (media && media.length > 0) {
            loadedMedia[orderProduct.product_id] = media
          }
          
          // Build variant combos
          const variantCombos: { [combo: string]: { quantity: number; notes: string } } = {}
          
          if (items && items.length > 0) {
            items.forEach(item => {
              variantCombos[item.variant_combo] = {
                quantity: item.quantity || 0,
                notes: item.notes || ''
              }
            })
          }
          
          loadedProducts[orderProduct.product_id] = {
            productId: orderProduct.product_id,
            variantCombos,
            referenceMedia: [],
            existingMediaIds: media?.map(m => m.id) || []
          }
        }
        
        setSelectedProducts(loadedProducts)
        setExistingMedia(loadedMedia)
      }
      
    } catch (error) {
      console.error('Error loading order:', error)
      setNotification({ message: 'Error loading draft order', type: 'error' })
      router.push('/dashboard/orders')
    } finally {
      setLoading(false)
    }
  }

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId)
    const client = clients.find(c => c.id === clientId)
    if (client) {
      setClientEmail(client.email)
    }
  }

  const addProduct = (productId: string) => {
    if (selectedProducts[productId]) return // Already added
    
    const product = products.find(p => p.id === productId)
    if (!product) return
    
    // Get variants for this product
    const productVariantIds = productVariants
      .filter(pv => pv.product_id === productId)
      .map(pv => pv.variant_option_id)
    
    if (productVariantIds.length === 0) {
      setNotification({ message: 'This product has no variants configured. Please add variants first.', type: 'error' })
      return
    }
    
    // Group variants by type
    const variantsByType: { [typeId: string]: string[] } = {}
    
    productVariantIds.forEach(optionId => {
      const option = variantOptions.find(vo => vo.id === optionId)
      if (option) {
        if (!variantsByType[option.type_id]) {
          variantsByType[option.type_id] = []
        }
        variantsByType[option.type_id].push(optionId)
      }
    })
    
    // Generate all combinations
    const typesArray = Object.entries(variantsByType)
    const combinations = generateCombinations(typesArray)
    
    const variantCombos: { [combo: string]: { quantity: number; notes: string } } = {}
    combinations.forEach(combo => {
      variantCombos[combo] = { quantity: 0, notes: '' }
    })
    
    setSelectedProducts({
      ...selectedProducts,
      [productId]: {
        productId,
        variantCombos,
        referenceMedia: []
      }
    })
    
    setShowProductPicker(false)
  }

  const generateCombinations = (typesArray: [string, string[]][]): string[] => {
    if (typesArray.length === 0) return ['']
    
    const [first, ...rest] = typesArray
    const restCombinations = generateCombinations(rest)
    
    const result: string[] = []
    first[1].forEach(optionId => {
      restCombinations.forEach(restCombo => {
        result.push(restCombo ? `${optionId},${restCombo}` : optionId)
      })
    })
    
    return result
  }

  const removeProduct = async (productId: string) => {
    // If this product exists in the database, delete it
    const { data: existingProduct } = await supabase
      .from('order_products')
      .select('id')
      .eq('order_id', orderId)
      .eq('product_id', productId)
      .single()
    
    if (existingProduct) {
      // Delete items first
      await supabase
        .from('order_items')
        .delete()
        .eq('order_product_id', existingProduct.id)
      
      // Delete media
      await supabase
        .from('order_media')
        .delete()
        .eq('order_product_id', existingProduct.id)
      
      // Delete product
      await supabase
        .from('order_products')
        .delete()
        .eq('id', existingProduct.id)
    }
    
    const newSelected = { ...selectedProducts }
    delete newSelected[productId]
    setSelectedProducts(newSelected)
    
    const newMedia = { ...existingMedia }
    delete newMedia[productId]
    setExistingMedia(newMedia)
    
    setNotification({ message: 'Product removed', type: 'success' })
  }

  const updateQuantity = (productId: string, combo: string, quantity: number) => {
    setSelectedProducts({
      ...selectedProducts,
      [productId]: {
        ...selectedProducts[productId],
        variantCombos: {
          ...selectedProducts[productId].variantCombos,
          [combo]: {
            ...selectedProducts[productId].variantCombos[combo],
            quantity
          }
        }
      }
    })
  }

  const quickFillQuantity = (productId: string, quantity: number) => {
    const product = selectedProducts[productId]
    const updatedCombos = { ...product.variantCombos }
    
    Object.keys(updatedCombos).forEach(combo => {
      updatedCombos[combo] = {
        ...updatedCombos[combo],
        quantity
      }
    })
    
    setSelectedProducts({
      ...selectedProducts,
      [productId]: {
        ...product,
        variantCombos: updatedCombos
      }
    })
  }

  const updateNotes = (productId: string, combo: string, notes: string) => {
    setSelectedProducts({
      ...selectedProducts,
      [productId]: {
        ...selectedProducts[productId],
        variantCombos: {
          ...selectedProducts[productId].variantCombos,
          [combo]: {
            ...selectedProducts[productId].variantCombos[combo],
            notes
          }
        }
      }
    })
  }

  const handleMediaUpload = (productId: string, files: FileList | null) => {
    if (!files) return
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'video/mp4', 'video/quicktime']
    const validFiles = Array.from(files).filter(file => allowedTypes.includes(file.type))
    
    if (validFiles.length === 0) {
      setNotification({ message: 'Please upload only JPG, PNG, MP4, or MOV files', type: 'error' })
      return
    }
    
    setSelectedProducts({
      ...selectedProducts,
      [productId]: {
        ...selectedProducts[productId],
        referenceMedia: [...selectedProducts[productId].referenceMedia, ...validFiles]
      }
    })
    
    setNotification({ message: `Added ${validFiles.length} file${validFiles.length > 1 ? 's' : ''}`, type: 'success' })
  }

  const removeMedia = (productId: string, index: number) => {
    const updatedMedia = selectedProducts[productId].referenceMedia.filter((_, i) => i !== index)
    setSelectedProducts({
      ...selectedProducts,
      [productId]: {
        ...selectedProducts[productId],
        referenceMedia: updatedMedia
      }
    })
    setNotification({ message: 'File removed', type: 'success' })
  }

  const deleteExistingMedia = async (productId: string, mediaId: string) => {
    try {
      const { error } = await supabase
        .from('order_media')
        .delete()
        .eq('id', mediaId)
      
      if (error) throw error
      
      const newMedia = { ...existingMedia }
      newMedia[productId] = newMedia[productId].filter(m => m.id !== mediaId)
      setExistingMedia(newMedia)
      
      setNotification({ message: 'File deleted', type: 'success' })
    } catch (error) {
      console.error('Error deleting media:', error)
      setNotification({ message: 'Error deleting file', type: 'error' })
    }
  }

  const getVariantComboDisplay = (combo: string) => {
    const optionIds = combo.split(',')
    return optionIds.map(id => {
      const option = variantOptions.find(vo => vo.id === id)
      return option?.value || ''
    }).join(' / ')
  }

  const updateDraft = async () => {
    if (!orderName) {
      setNotification({ message: 'Please enter an order name', type: 'error' })
      return
    }
    
    setSaving(true)
    
    try {
      // Update order
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          client_id: selectedClientId || clients[0]?.id,
          manufacturer_id: selectedManufacturerId || manufacturers[0]?.id,
        })
        .eq('id', orderId)
      
      if (updateError) throw updateError
      
      // Update products and items
      for (const [productId, productData] of Object.entries(selectedProducts)) {
        // Check if this product already exists
        const { data: existingProduct } = await supabase
          .from('order_products')
          .select('id')
          .eq('order_id', orderId)
          .eq('product_id', productId)
          .single()
        
        let orderProductId: string
        
        if (existingProduct) {
          orderProductId = existingProduct.id
          
          // Update existing items
          for (const [combo, data] of Object.entries(productData.variantCombos)) {
            const { data: existingItem } = await supabase
              .from('order_items')
              .select('id')
              .eq('order_product_id', orderProductId)
              .eq('variant_combo', combo)
              .single()
            
            if (existingItem) {
              // Update existing
              await supabase
                .from('order_items')
                .update({
                  quantity: data.quantity || 0,
                  notes: data.notes || null
                })
                .eq('id', existingItem.id)
            } else {
              // Insert new
              await supabase
                .from('order_items')
                .insert([{
                  order_product_id: orderProductId,
                  variant_combo: combo,
                  quantity: data.quantity || 0,
                  notes: data.notes || null,
                  admin_status: 'pending',
                  manufacturer_status: 'pending'
                }])
            }
          }
        } else {
          // Create new product
          const productOrderNumber = `${order.order_number}-P${Date.now().toString().slice(-4)}`
          
          const { data: newProduct, error: productError } = await supabase
            .from('order_products')
            .insert([{
              order_id: orderId,
              product_id: productId,
              product_order_number: productOrderNumber
            }])
            .select()
            .single()
          
          if (productError) throw productError
          orderProductId = newProduct.id
          
          // Insert items
          const items = Object.entries(productData.variantCombos)
            .map(([combo, data]) => ({
              order_product_id: orderProductId,
              variant_combo: combo,
              quantity: data.quantity || 0,
              notes: data.notes || null,
              admin_status: 'pending',
              manufacturer_status: 'pending'
            }))
          
          if (items.length > 0) {
            await supabase.from('order_items').insert(items)
          }
        }
        
        // Upload new media
        if (productData.referenceMedia.length > 0) {
          const userEmail = localStorage.getItem('userEmail')
          const { data: userData } = await supabase
            .from('users')
            .select('id')
            .eq('email', userEmail)
            .single()
          
          for (const file of productData.referenceMedia) {
            const fileExt = file.name.split('.').pop()
            const fileName = `${orderId}/${orderProductId}/ref-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('order-media')
              .upload(fileName, file)
            
            if (!uploadError && uploadData) {
              const { data: urlData } = supabase.storage
                .from('order-media')
                .getPublicUrl(fileName)
              
              await supabase.from('order_media').insert([{
                order_product_id: orderProductId,
                file_url: urlData.publicUrl,
                file_type: file.type.startsWith('image') ? 'image' : 'video',
                uploaded_by: userData?.id || null,
                is_sample: false
              }])
            }
          }
        }
      }
      
      setNotification({ message: 'Draft updated successfully!', type: 'success' })
      setTimeout(() => {
        router.push(`/dashboard/orders`)
      }, 1500)
      
    } catch (error: any) {
      console.error('Error updating draft:', error)
      setNotification({ message: error?.message || 'Error updating draft', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const completeOrder = async () => {
    if (!orderName || !selectedClientId || !selectedManufacturerId) {
      setNotification({ message: 'Please fill in all required fields', type: 'error' })
      return
    }
    
    if (Object.keys(selectedProducts).length === 0) {
      setNotification({ message: 'Please add at least one product', type: 'error' })
      return
    }
    
    // Check if any products have quantities
    const hasQuantities = Object.values(selectedProducts).some(product => 
      Object.values(product.variantCombos).some(combo => combo.quantity > 0)
    )
    
    if (!hasQuantities) {
      setNotification({ message: 'Please add quantities to at least one variant', type: 'error' })
      return
    }
    
    setCompleting(true)
    
    try {
      // Generate proper order number
      const orderNumber = `ORD-${Date.now().toString().slice(-6)}`
      
      // Update order status and number
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          order_number: orderNumber,
          status: 'draft', // Ready to submit status
          client_id: selectedClientId,
          manufacturer_id: selectedManufacturerId,
        })
        .eq('id', orderId)
      
      if (updateError) throw updateError
      
      setNotification({ message: 'Order completed and ready to submit!', type: 'success' })
      setTimeout(() => {
        router.push(`/dashboard/orders/${orderId}`)
      }, 1500)
      
    } catch (error: any) {
      console.error('Error completing order:', error)
      setNotification({ message: error?.message || 'Error completing order', type: 'error' })
    } finally {
      setCompleting(false)
    }
  }

  if (loading && products.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading draft...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Notification Toast */}
        {notification && (
          <div className={`fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 animate-slide-in`}>
            <div className={`flex items-center gap-3 px-4 sm:px-6 py-4 rounded-lg shadow-xl border backdrop-blur-sm transition-all duration-300 ${
              notification.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-center gap-3 flex-1">
                {notification.type === 'success' ? (
                  <CheckIcon className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm sm:text-base">{notification.message}</p>
                </div>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard/orders')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
              </button>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Edit Draft Order</h1>
            </div>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full self-start sm:self-auto">
              DRAFT
            </span>
          </div>
        </div>

        {/* Order Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order Name *
              </label>
              <input
                type="text"
                value={orderName}
                onChange={(e) => setOrderName(e.target.value)}
                placeholder="e.g., October Drop"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client *
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select client...</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client Email
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Manufacturer *
              </label>
              <select
                value={selectedManufacturerId}
                onChange={(e) => setSelectedManufacturerId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Products</h2>
            <button
              onClick={() => setShowProductPicker(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm sm:text-base"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Add Product</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>

          {Object.keys(selectedProducts).length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500">No products added yet</p>
              <button
                onClick={() => setShowProductPicker(true)}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Add your first product
              </button>
            </div>
          )}

          {Object.entries(selectedProducts).map(([productId, productData]) => {
            const product = products.find(p => p.id === productId)
            if (!product) return null
            
            return (
              <div key={productId} className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900">{product.title}</h3>
                    {product.description && (
                      <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeProduct(productId)}
                    className="self-start sm:self-auto p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                    title="Remove product"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Fill */}
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-sm text-gray-600">Quick fill:</span>
                  <input
                    type="number"
                    placeholder="Quantity"
                    className="w-full sm:w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const value = parseInt((e.target as HTMLInputElement).value)
                        if (!isNaN(value)) {
                          quickFillQuantity(productId, value)
                          ;(e.target as HTMLInputElement).value = ''
                        }
                      }
                    }}
                  />
                  <span className="text-xs text-gray-500">Press Enter to apply to all</span>
                </div>

                {/* Reference Media Upload */}
                <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📸 Reference Media
                  </label>
                  
                  {/* Existing Media */}
                  {existingMedia[productId] && existingMedia[productId].length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-2">Existing files:</p>
                      <div className="flex flex-wrap gap-2">
                        {existingMedia[productId].map((media) => (
                          <div key={media.id} className="relative bg-gray-100 rounded-lg px-3 py-2 pr-8 text-xs text-gray-700">
                            <a href={media.file_url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                              {media.file_type === 'image' ? '🖼️' : '🎥'} View
                            </a>
                            <button
                              onClick={() => deleteExistingMedia(productId, media.id)}
                              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-red-500 hover:text-red-700"
                            >
                              <XMarkIcon className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg,video/mp4,video/quicktime"
                    multiple
                    onChange={(e) => handleMediaUpload(productId, e.target.files)}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG, MP4, or MOV files</p>
                  
                  {/* New uploaded files */}
                  {productData.referenceMedia.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">New files to upload:</p>
                      <div className="flex flex-wrap gap-2">
                        {productData.referenceMedia.map((file, index) => (
                          <div key={index} className="relative bg-blue-50 rounded-lg px-3 py-2 pr-8 text-xs text-blue-700">
                            <span className="truncate max-w-[150px] inline-block">{file.name}</span>
                            <button
                              onClick={() => removeMedia(productId, index)}
                              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-red-500 hover:text-red-700"
                            >
                              <XMarkIcon className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Variant Rows */}
                <div className="space-y-2">
                  {Object.entries(productData.variantCombos).map(([combo, data]) => (
                    <div key={combo} className="flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:gap-3 sm:items-center bg-white p-3 rounded-lg border border-gray-200">
                      <div className="sm:col-span-4 text-gray-700 text-sm font-medium">
                        {getVariantComboDisplay(combo)}
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          value={data.quantity || ''}
                          onChange={(e) => updateQuantity(productId, combo, parseInt(e.target.value) || 0)}
                          placeholder="Qty"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div className="sm:col-span-6">
                        <input
                          type="text"
                          value={data.notes}
                          onChange={(e) => updateNotes(productId, combo, e.target.value)}
                          placeholder="Notes (optional)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Submit Buttons */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <button
              onClick={updateDraft}
              disabled={saving || completing}
              className={`w-full sm:w-auto px-6 py-3 font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${
                saving 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {saving ? 'Saving...' : 'Update Draft'}
            </button>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => router.push('/dashboard/orders')}
                className="w-full sm:w-auto px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                onClick={completeOrder}
                disabled={saving || completing}
                className={`w-full sm:w-auto px-6 py-3 font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2 ${
                  completing 
                    ? 'bg-green-600 text-white' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {completing ? 'Completing...' : 'Complete Order'}
              </button>
            </div>
          </div>
        </div>

        {/* Product Picker Modal */}
        {showProductPicker && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Product</h2>
              
              <div className="space-y-2 overflow-y-auto flex-1">
                {products.map(product => (
                  <button
                    key={product.id}
                    onClick={() => addProduct(product.id)}
                    disabled={!!selectedProducts[product.id]}
                    className={`w-full text-left px-4 py-3 rounded-lg transition ${
                      selectedProducts[product.id]
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-900 border border-gray-200'
                    }`}
                  >
                    <div className="font-semibold">{product.title}</div>
                    {product.description && (
                      <div className="text-sm text-gray-600 mt-1">{product.description}</div>
                    )}
                    {selectedProducts[product.id] && (
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <CheckIcon className="w-3 h-3" />
                        Already added
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowProductPicker(false)}
                className="mt-4 w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}