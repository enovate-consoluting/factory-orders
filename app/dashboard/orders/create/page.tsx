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
    const client = clients.find(c => c.id === clientId)
    if (client) {
      setClientEmail(client.email)
    }
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
    
    // Don't close the modal - removed setShowProductPicker(false)
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

  const removeProduct = (productId: string) => {
    const newSelected = { ...selectedProducts }
    delete newSelected[productId]
    setSelectedProducts(newSelected)
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

  const deleteMediaFromViewer = () => {
    if (!viewingMedia) return
    
    const productId = Object.keys(selectedProducts).find(id => 
      selectedProducts[id].referenceMedia === viewingMedia.files
    )
    
    if (productId) {
      const updatedMedia = viewingMedia.files.filter((_, i) => i !== viewingMedia.index)
      setSelectedProducts({
        ...selectedProducts,
        [productId]: {
          ...selectedProducts[productId],
          referenceMedia: updatedMedia
        }
      })
      
      // Update or close viewer
      if (updatedMedia.length === 0) {
        setViewingMedia(null)
      } else if (viewingMedia.index >= updatedMedia.length) {
        setViewingMedia({ ...viewingMedia, files: updatedMedia, index: updatedMedia.length - 1 })
      } else {
        setViewingMedia({ ...viewingMedia, files: updatedMedia })
      }
      
      setNotification({ message: 'File removed', type: 'success' })
    }
  }

  const openMediaViewer = (files: File[], startIndex: number, productTitle: string) => {
    setViewingMedia({ files, index: startIndex, title: `Reference Media - ${productTitle}` })
  }

  const navigateMedia = (direction: 'prev' | 'next') => {
    if (!viewingMedia) return
    
    let newIndex = viewingMedia.index
    if (direction === 'next') {
      newIndex = (viewingMedia.index + 1) % viewingMedia.files.length
    } else {
      newIndex = viewingMedia.index === 0 ? viewingMedia.files.length - 1 : viewingMedia.index - 1
    }
    
    setViewingMedia({ ...viewingMedia, index: newIndex })
  }

  const getVariantComboDisplay = (combo: string) => {
    const optionIds = combo.split(',')
    return optionIds.map(id => {
      const option = variantOptions.find(vo => vo.id === id)
      return option?.value || ''
    }).join(' / ')
  }

  const saveAsDraft = async () => {
    if (!orderName) {
      setNotification({ message: 'Please enter an order name before saving', type: 'error' })
      return
    }
    
    setLoading(true)
    
    try {
      // Get current user - check both localStorage methods
      const userEmail = localStorage.getItem('userEmail') || localStorage.getItem('user')
      let userId = null
      
      if (userEmail) {
        try {
          // If it's a JSON string (from 'user' key), parse it
          const userObj = typeof userEmail === 'string' && userEmail.includes('{') 
            ? JSON.parse(userEmail) 
            : null
          
          if (userObj?.email) {
            const { data: userData } = await supabase
              .from('users')
              .select('id')
              .eq('email', userObj.email)
              .single()
            userId = userData?.id
          } else if (typeof userEmail === 'string' && userEmail.includes('@')) {
            const { data: userData } = await supabase
              .from('users')
              .select('id')
              .eq('email', userEmail)
              .single()
            userId = userData?.id
          }
        } catch (e) {
          console.log('Could not find user, continuing without user ID')
        }
      }
      
      // Generate order number with DRAFT prefix
      const orderNumber = `DRAFT-${Date.now().toString().slice(-6)}`
      
      // Need at least placeholder client and manufacturer
      let clientId = selectedClientId
      let manufacturerId = selectedManufacturerId
      
      if (!clientId && clients.length > 0) {
        clientId = clients[0].id
      }
      if (!manufacturerId && manufacturers.length > 0) {
        manufacturerId = manufacturers[0].id
      }
      
      if (!clientId || !manufacturerId) {
        setNotification({ message: 'Unable to save draft. Please ensure clients and manufacturers exist.', type: 'error' })
        setLoading(false)
        return
      }
      
      // Create order with 'draft' status
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          order_number: orderNumber,
          client_id: clientId,
          manufacturer_id: manufacturerId,
          status: 'draft',
          created_by: userId
        }])
        .select()
        .single()
      
      if (orderError) {
        console.error('Order creation error:', orderError)
        throw new Error(orderError.message || 'Failed to create order')
      }
      
      // Save products if any are selected
      for (const [productId, productData] of Object.entries(selectedProducts)) {
        const productOrderNumber = `PRD-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
        
        const { data: orderProduct, error: productError } = await supabase
          .from('order_products')
          .insert([{
            order_id: order.id,
            product_id: productId,
            product_order_number: productOrderNumber
          }])
          .select()
          .single()
        
        if (productError) {
          console.error('Product insert error:', productError)
          throw new Error(productError.message || 'Failed to add product')
        }
        
        // Upload reference media if any
        if (productData.referenceMedia.length > 0) {
          for (const file of productData.referenceMedia) {
            const fileExt = file.name.split('.').pop()
            const fileName = `${order.id}/${orderProduct.id}/ref-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('order-media')
              .upload(fileName, file)
            
            if (!uploadError && uploadData) {
              const { data: urlData } = supabase.storage
                .from('order-media')
                .getPublicUrl(fileName)
              
              await supabase.from('order_media').insert([{
                order_product_id: orderProduct.id,
                file_url: urlData.publicUrl,
                file_type: file.type.startsWith('image') ? 'image' : 'video',
                uploaded_by: userId
              }])
            }
          }
        }
        
        // Save variant combos (even if quantities are 0)
        const items = Object.entries(productData.variantCombos)
          .map(([combo, data]) => ({
            order_product_id: orderProduct.id,
            variant_combo: combo,
            quantity: data.quantity || 0,
            notes: data.notes || null,
            admin_status: 'pending',
            manufacturer_status: 'pending'
          }))
        
        if (items.length > 0) {
          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(items)
          
          if (itemsError) {
            console.error('Items insert error:', itemsError)
            throw new Error(itemsError.message || 'Failed to add items')
          }
        }
      }
      
      // Log audit
      await supabase
        .from('audit_log')
        .insert([{
          user_id: userId,
          user_name: userEmail || 'Unknown',
          action_type: 'saved_draft',
          target_type: 'order',
          target_id: order.id,
          new_value: orderNumber,
          timestamp: new Date().toISOString()
        }])
      
      setNotification({ message: 'Draft saved successfully! Redirecting...', type: 'success' })
      setTimeout(() => {
        router.push(`/dashboard/orders/${order.id}`)
      }, 1500)
      
    } catch (error: any) {
      console.error('Error saving draft:', error)
      const errorMessage = error?.message || 'Error saving draft. Please try again.'
      setNotification({ message: errorMessage, type: 'error' })
      setLoading(false)
    }
  }

  const createOrder = async () => {
    if (!orderName || !selectedClientId || !selectedManufacturerId) {
      setNotification({ message: 'Please fill in order name, client, and manufacturer', type: 'error' })
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
    
    setLoading(true)
    
    try {
      // Get current user - check both localStorage methods
      const userEmail = localStorage.getItem('userEmail') || localStorage.getItem('user')
      let userId = null
      
      if (userEmail) {
        try {
          // If it's a JSON string (from 'user' key), parse it
          const userObj = typeof userEmail === 'string' && userEmail.includes('{') 
            ? JSON.parse(userEmail) 
            : null
          
          if (userObj?.email) {
            const { data: userData } = await supabase
              .from('users')
              .select('id')
              .eq('email', userObj.email)
              .single()
            userId = userData?.id
          } else if (typeof userEmail === 'string' && userEmail.includes('@')) {
            const { data: userData } = await supabase
              .from('users')
              .select('id')
              .eq('email', userEmail)
              .single()
            userId = userData?.id
          }
        } catch (e) {
          console.log('Could not find user, continuing without user ID')
        }
      }
      
      // Generate order number
      const orderNumber = `ORD-${Date.now().toString().slice(-6)}`
      
      // Create order with 'submitted' status (ready to process)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          order_number: orderNumber,
          client_id: selectedClientId,
          manufacturer_id: selectedManufacturerId,  // Fixed typo here
          status: 'submitted',  // Changed from 'draft' to 'submitted' for created orders
          created_by: userId
        }])
        .select()
        .single()
      
      if (orderError) {
        console.error('Order creation error:', orderError)
        throw orderError
      }
      
      // Create order products and items
      for (const [productId, productData] of Object.entries(selectedProducts)) {
        const productOrderNumber = `PRD-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
        
        const { data: orderProduct, error: productError } = await supabase
          .from('order_products')
          .insert([{
            order_id: order.id,
            product_id: productId,
            product_order_number: productOrderNumber
          }])
          .select()
          .single()
        
        if (productError) {
          console.error('Product error:', productError)
          throw productError
        }
        
        // Upload reference media to Supabase Storage
        if (productData.referenceMedia.length > 0) {
          for (const file of productData.referenceMedia) {
            const fileExt = file.name.split('.').pop()
            const fileName = `${order.id}/${orderProduct.id}/ref-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('order-media')
              .upload(fileName, file)
            
            if (!uploadError && uploadData) {
              const { data: urlData } = supabase.storage
                .from('order-media')
                .getPublicUrl(fileName)
              
              // Save to order_media table
              await supabase.from('order_media').insert([{
                order_product_id: orderProduct.id,
                file_url: urlData.publicUrl,
                file_type: file.type.startsWith('image') ? 'image' : 'video',
                uploaded_by: userId
              }])
            }
          }
        }
        
        // Create order items for each variant combo with quantity > 0
        const items = Object.entries(productData.variantCombos)
          .filter(([_, data]) => data.quantity > 0)
          .map(([combo, data]) => ({
            order_product_id: orderProduct.id,
            variant_combo: combo,
            quantity: data.quantity,
            notes: data.notes || null,
            admin_status: 'pending',
            manufacturer_status: 'pending'
          }))
        
        if (items.length > 0) {
          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(items)
          
          if (itemsError) {
            console.error('Items error:', itemsError)
            throw itemsError
          }
        }
      }
      
      // Log audit
      await supabase
        .from('audit_log')
        .insert([{
          user_id: userId,
          user_name: userEmail || 'Unknown',
          action_type: 'created_order',
          target_type: 'order',
          target_id: order.id,
          new_value: orderNumber,
          timestamp: new Date().toISOString()
        }])
      
      setNotification({ message: 'Order created successfully!', type: 'success' })
      setTimeout(() => {
        router.push('/dashboard/orders')
      }, 1500)
      
    } catch (error: any) {
      console.error('Error creating order:', error)
      const errorMessage = error?.message || 'Error creating order. Please try again.'
      setNotification({ message: errorMessage, type: 'error' })
      setLoading(false)
    }
  }

  if (loading && clients.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-gray-600 text-center py-8">Loading...</div>
      </div>
    )
  }

  // SINGLE RETURN STATEMENT - NO DUPLICATION
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 left-4 sm:left-auto max-w-sm z-50 animate-slide-in`}>
          <div className={`flex items-center gap-3 px-4 sm:px-6 py-4 rounded-lg shadow-lg border ${
            notification.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-3 flex-1">
              {notification.type === 'success' ? (
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold text-sm sm:text-base">{notification.message}</p>
                <p className="text-xs opacity-75 mt-0.5">Just now</p>
              </div>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Add CSS for animations */}
      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Create Factory Order</h1>
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-1 md:col-span-2 lg:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Order Name *
            </label>
            <input
              type="text"
              value={orderName}
              onChange={(e) => setOrderName(e.target.value)}
              placeholder="e.g., October Drop"
              className="w-full px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client *
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => handleClientChange(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
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
              className="w-full px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Manufacturer *
            </label>
            <select
              value={selectedManufacturerId}
              onChange={(e) => setSelectedManufacturerId(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Products</h2>
          <button
            onClick={() => setShowProductPicker(true)}
            className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2 text-sm sm:text-base"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Product</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>

        {Object.keys(selectedProducts).length === 0 && (
          <p className="text-gray-500 text-center py-8">No products added yet</p>
        )}

        {Object.entries(selectedProducts).map(([productId, productData]) => {
          const product = products.find(p => p.id === productId)
          if (!product) return null
          
          return (
            <div key={productId} className="mb-6 bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">{product.title}</h3>
                  {product.description && (
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">{product.description}</p>
                  )}
                </div>
                <button
                  onClick={() => removeProduct(productId)}
                  className="text-red-600 hover:text-red-700 text-sm font-medium ml-4"
                >
                  Remove
                </button>
              </div>

              {/* Quick Fill - Make mobile friendly */}
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <span className="text-sm text-gray-600 whitespace-nowrap">Quick fill quantity:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Quantity"
                    className="w-32 sm:w-36 px-3 py-1.5 bg-white border border-gray-300 rounded text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <span className="text-xs text-gray-500 whitespace-nowrap">Press Enter</span>
                </div>
              </div>

              {/* Reference Media Upload */}
              <div className="mb-4 p-3 sm:p-4 bg-white rounded-lg border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Upload className="w-4 h-4 inline-block mr-1" />
                  Reference Media
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,video/mp4,video/quicktime"
                  multiple
                  onChange={(e) => handleMediaUpload(productId, e.target.files)}
                  className="block w-full text-xs sm:text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:sm:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                <p className="text-xs text-gray-500 mt-1">Upload JPG, PNG, MP4, or MOV files</p>
                
                {/* Show uploaded files with view option */}
                {productData.referenceMedia.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs sm:text-sm text-gray-700">Uploaded files ({productData.referenceMedia.length})</span>
                      {productData.referenceMedia.length > 0 && (
                        <button
                          onClick={() => openMediaViewer(productData.referenceMedia, 0, product.title)}
                          className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                        >
                          View All
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {productData.referenceMedia.map((file, index) => (
                        <div key={index} className="relative bg-gray-100 rounded px-2 sm:px-3 py-1.5 sm:py-2 pr-7 sm:pr-8 text-xs text-gray-700 cursor-pointer hover:bg-gray-200"
                             onClick={() => openMediaViewer(productData.referenceMedia, index, product.title)}>
                          <span className="truncate max-w-[100px] sm:max-w-none">{file.name}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              removeMedia(productId, index)
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Variant Rows - Optimized for mobile */}
              <div className="space-y-2">
                {Object.entries(productData.variantCombos).map(([combo, data]) => (
                  <div key={combo} className="flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:gap-3 items-start sm:items-center bg-white p-3 rounded border border-gray-200">
                    <div className="sm:col-span-4 text-gray-700 text-sm font-medium w-full">
                      {getVariantComboDisplay(combo)}
                    </div>
                    <div className="sm:col-span-2 w-full sm:w-auto">
                      <input
                        type="number"
                        value={data.quantity || ''}
                        onChange={(e) => updateQuantity(productId, combo, parseInt(e.target.value) || 0)}
                        placeholder="Qty"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="sm:col-span-6 w-full">
                      <input
                        type="text"
                        value={data.notes}
                        onChange={(e) => updateNotes(productId, combo, e.target.value)}
                        placeholder="Notes (optional)"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Submit Buttons - Mobile optimized */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <button
          onClick={() => saveAsDraft()}
          disabled={loading}
          className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : 'Save as Draft'}
        </button>
        
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/dashboard/orders')}
            className="flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition border border-gray-200 text-sm sm:text-base"
          >
            Cancel
          </button>
          <button
            onClick={createOrder}
            disabled={loading}
            className="flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </div>

      {/* Product Picker Modal - Redesigned for better space usage */}
      {showProductPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            {/* Compact Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-gray-800">Select Products</h2>
                <span className="text-sm text-gray-500">
                  {Object.keys(selectedProducts).length} selected
                </span>
              </div>
              <button
                onClick={() => setShowProductPicker(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Compact Search bar */}
            <div className="px-4 py-2 border-b border-gray-100">
              <input
                type="text"
                placeholder="Search..."
                className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {/* Product Grid - More compact cards */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
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

      {/* Media Viewer Modal with Carousel - Fixed Size */}
      {viewingMedia && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={() => setViewingMedia(null)}>
          <div className="relative max-w-4xl w-full bg-white rounded-lg overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold text-gray-800">{viewingMedia.title}</h3>
                {viewingMedia.files.length > 1 && (
                  <span className="text-sm text-gray-600">
                    {viewingMedia.index + 1} of {viewingMedia.files.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setViewingMedia(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="relative bg-gray-100" style={{ height: '60vh' }}>
              <div className="absolute inset-0 flex items-center justify-center p-4">
                {/* Previous Button */}
                {viewingMedia.files.length > 1 && (
                  <button
                    onClick={() => navigateMedia('prev')}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 z-10 shadow-lg transition"
                  >
                    <ChevronLeft className="w-6 h-6 text-gray-800" />
                  </button>
                )}
                
                {/* Media Content - Fixed sizing */}
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
                          style={{ maxHeight: 'calc(60vh - 2rem)' }}
                        />
                      )
                    } else if (file.type.startsWith('video/')) {
                      return (
                        <video 
                          src={url} 
                          controls 
                          className="max-w-full max-h-full"
                          style={{ maxHeight: 'calc(60vh - 2rem)' }}
                          autoPlay
                        />
                      )
                    } else {
                      return (
                        <div className="text-gray-500 text-center">
                          <Package className="w-12 h-12 mx-auto mb-2" />
                          <p>{file.name}</p>
                          <p className="text-sm mt-1">Preview not available</p>
                        </div>
                      )
                    }
                  })()}
                </div>
                
                {/* Next Button */}
                {viewingMedia.files.length > 1 && (
                  <button
                    onClick={() => navigateMedia('next')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 z-10 shadow-lg transition"
                  >
                    <ChevronRight className="w-6 h-6 text-gray-800" />
                  </button>
                )}
                
                {/* Delete button in viewer */}
                <button
                  onClick={deleteMediaFromViewer}
                  className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white rounded-full p-2 z-10 shadow-lg transition"
                  title="Delete this file"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Thumbnail Strip */}
            {viewingMedia.files.length > 1 && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex gap-2 overflow-x-auto">
                  {viewingMedia.files.map((file, index) => (
                    <button
                      key={index}
                      onClick={() => setViewingMedia({ ...viewingMedia, index })}
                      className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition ${
                        index === viewingMedia.index ? 'border-blue-500' : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {file.type.startsWith('image/') ? (
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt={`Thumbnail ${index + 1}`} 
                          className="w-full h-full object-cover"
                        />
                      ) : file.type.startsWith('video/') ? (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <Video className="w-8 h-8 text-gray-500" />
                        </div>
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-500" />
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