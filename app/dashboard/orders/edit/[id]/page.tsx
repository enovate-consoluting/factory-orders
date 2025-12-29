'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Plus, Minus, Trash2, Package, AlertCircle, ShoppingCart, Upload, X, CreditCard, Calendar } from 'lucide-react'
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/lib/constants/fileUpload'

interface Product {
  id: string
  title: string
  description?: string
  variants?: Array<{
    type: string
    options: string[]
  }>
}

interface OrderProduct {
  product: Product
  productOrderNumber: string
  productDescription: string
  sampleNotes: string
  standardPrice: string
  bulkPrice: string
  sampleRequired: boolean
  sampleFee: string
  sampleETA: string
  sampleStatus: string
  shippingAirPrice: string
  shippingBoatPrice: string
  productionTime: string
  items: Array<{
    variantCombo: string
    quantity: number
    notes: string
  }>
  mediaFiles: File[]
  sampleMediaFiles: File[]
  // Track existing files from database
  existingMedia?: Array<{
    id: string
    file_url: string
    file_type: string
    original_filename?: string
  }>
  existingSampleMedia?: Array<{
    id: string
    file_url: string
    file_type: string
    original_filename?: string
  }>
}

const inputClassName = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"

export default function EditOrderPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Order data - matching create order structure
  const [orderData, setOrderData] = useState<any>(null)
  const [orderName, setOrderName] = useState('')
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedManufacturer, setSelectedManufacturer] = useState('')
  const [orderProducts, setOrderProducts] = useState<OrderProduct[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  
  // Modal for adding products
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  
  // Quick fill - same as create order
  const [quickFillQuantity, setQuickFillQuantity] = useState('')
  
  // Notification state - same as create order
  const [notification, setNotification] = useState<{
    show: boolean
    type: 'success' | 'error' | 'info'
    message: string
  }>({
    show: false,
    type: 'success',
    message: ''
  })
  
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ show: true, type, message })
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }))
    }, 3000)
  }

  useEffect(() => {
    if (orderId) {
      fetchOrderData()
      fetchAllProducts()
    }
  }, [orderId])

  const fetchAllProducts = async () => {
    console.log('=== FETCH ALL PRODUCTS STARTED ===')
    
    try {
      // Check database schema
      const { data: productsTest } = await supabase
        .from('products')
        .select('*')
        .limit(1)
      
      const hasDescription = productsTest && productsTest[0] && 'description' in productsTest[0]
      const productsColumns = hasDescription ? 'id, title, description' : 'id, title'
      
      // Try full query with variants
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          ${productsColumns},
          product_variants(
            variant_option_id,
            variant_options(
              id,
              value,
              type_id,
              variant_types(
                id,
                name
              )
            )
          )
        `)
        .order('title')

      if (error) {
        console.error('Full query error:', JSON.stringify(error, null, 2))
        
        // Fallback to simple query
        const { data: simpleProducts } = await supabase
          .from('products')
          .select(productsColumns)
          .order('title')
        
        if (simpleProducts) {
          const processedSimple = simpleProducts.map((p: any) => ({
            id: p.id,
            title: p.title || 'Unnamed Product',
            description: hasDescription ? (p.description || '') : '',
            variants: []
          }))
          setAllProducts(processedSimple)
          return
        }
      }

      if (products) {
        const processedProducts = products.map((product: any) => {
          const variantsByType: any = {}
          
          if (product.product_variants && Array.isArray(product.product_variants)) {
            product.product_variants.forEach((pv: any) => {
              const typeName = pv.variant_options?.variant_types?.name
              const value = pv.variant_options?.value
              
              if (typeName && value) {
                if (!variantsByType[typeName]) {
                  variantsByType[typeName] = []
                }
                variantsByType[typeName].push(value)
              }
            })
          }

          return {
            id: product.id,
            title: product.title || 'Unnamed Product',
            description: hasDescription ? (product.description || '') : '',
            variants: Object.entries(variantsByType).map(([type, options]) => ({
              type,
              options: options as string[]
            }))
          }
        })
        
        setAllProducts(processedProducts)
      }
      
    } catch (error: any) {
      console.error('Fetch products error:', error)
      setAllProducts([])
    }
  }

  const fetchOrderData = async () => {
    console.log('=== FETCH ORDER DATA STARTED ===')
    
    try {
      // Fetch the order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          clients (id, name),
          manufacturers (id, name)
        `)
        .eq('id', orderId)
        .single()

      if (orderError) throw orderError

      if (!order) {
        showNotification('error', 'Order not found')
        router.push('/dashboard/orders')
        return
      }

      // Only draft orders can be edited
      if (order.status !== 'draft') {
        showNotification('error', 'Only draft orders can be edited')
        router.push('/dashboard/orders')
        return
      }

      setOrderData(order)
      setOrderName(order.order_name || '')
      setSelectedClient(order.client_id)
      setSelectedManufacturer(order.manufacturer_id)

      // Fetch order products
      const { data: orderProds, error: prodsError } = await supabase
        .from('order_products')
        .select(`
          *,
          products (id, title)
        `)
        .eq('order_id', orderId)

      if (prodsError) {
        console.error('Error fetching order products:', JSON.stringify(prodsError, null, 2))
        showNotification('error', 'Failed to load order products')
        setLoading(false)
        return
      }

      console.log(`Found ${orderProds?.length || 0} order products`)

      // Load each product's details
      const processedOrderProducts: OrderProduct[] = []
      
      if (!orderProds || orderProds.length === 0) {
        setOrderProducts([])
        setLoading(false)
        return
      }
      
      for (const op of orderProds) {
        // Get full product details with variants
        const { data: product } = await supabase
          .from('products')
          .select(`
            id, 
            title,
            product_variants(
              variant_option_id,
              variant_options(
                id,
                value,
                type_id,
                variant_types(
                  id,
                  name
                )
              )
            )
          `)
          .eq('id', op.product_id)
          .single()

        // Get the items for this order product
        const { data: items } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_product_id', op.id)

        // Get existing media files for this order product
        const { data: existingMediaFiles } = await supabase
          .from('order_media')
          .select('id, file_url, file_type, original_filename')
          .eq('order_product_id', op.id)
        
        console.log(`Found ${existingMediaFiles?.length || 0} existing media files for product`)
        
        // Separate reference media from sample media based on file URL pattern
        const existingRefMedia = existingMediaFiles?.filter(m => 
          m.file_url.includes('/ref-') || !m.file_url.includes('/sample-')
        ) || []
        
        const existingSampleMedia = existingMediaFiles?.filter(m => 
          m.file_url.includes('/sample-')
        ) || []

        // Process variants
        let processedVariants: any[] = []
        if (product && product.product_variants) {
          const variantsByType: any = {}
          product.product_variants.forEach((pv: any) => {
            const typeName = pv.variant_options?.variant_types?.name
            const value = pv.variant_options?.value
            
            if (typeName && value) {
              if (!variantsByType[typeName]) {
                variantsByType[typeName] = []
              }
              variantsByType[typeName].push(value)
            }
          })
          
          processedVariants = Object.entries(variantsByType).map(([type, options]) => ({
            type,
            options: options as string[]
          }))
        }

        // If no items exist, generate them from variants
        let productItems = items || []
        if (productItems.length === 0 && processedVariants.length > 0) {
          const variantCombos: string[] = []
          const generateCombos = (index: number, current: string[]) => {
            if (index === processedVariants.length) {
              variantCombos.push(current.join(' / '))
              return
            }
            
            processedVariants[index].options.forEach((option: string) => {
              generateCombos(index + 1, [...current, option])
            })
          }
          
          generateCombos(0, [])
          
          productItems = variantCombos.map(combo => ({
            variant_combo: combo,
            quantity: 0,
            notes: ''
          }))
        } else if (productItems.length === 0) {
          productItems = [{
            variant_combo: 'No Variants',
            quantity: 0,
            notes: ''
          }]
        }

        processedOrderProducts.push({
          product: {
            id: op.product_id,
            title: product?.title || op.products?.title || 'Unknown Product',
            description: op.description || '',
            variants: processedVariants
          },
          productOrderNumber: op.product_order_number || `PRD-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
          productDescription: op.description || '',
          sampleNotes: op.sample_notes || '',
          standardPrice: op.standard_price || '',
          bulkPrice: op.bulk_price || '',
          sampleRequired: op.sample_required || false,
          sampleFee: op.sample_fee || '',
          sampleETA: op.sample_eta || '',
          sampleStatus: op.sample_status || 'pending',
          shippingAirPrice: op.shipping_air_price || '',
          shippingBoatPrice: op.shipping_boat_price || '',
          productionTime: op.production_time || '',
          items: productItems.map((item: any) => ({
            variantCombo: item.variant_combo,
            quantity: item.quantity || 0,
            notes: item.notes || ''
          })),
          mediaFiles: [], // New files to upload
          sampleMediaFiles: [], // New sample files to upload
          existingMedia: existingRefMedia, // Existing reference media
          existingSampleMedia: existingSampleMedia // Existing sample media
        })
      }

      console.log(`Successfully processed ${processedOrderProducts.length} products`)
      setOrderProducts(processedOrderProducts)
      setLoading(false)
      
    } catch (error: any) {
      console.error('Error loading order:', error)
      showNotification('error', `Failed to load order: ${error.message || 'Unknown error'}`)
      setLoading(false)
    }
  }

  const handleAddProductClick = async () => {
    setShowAddProduct(true)
    if (allProducts.length === 0) {
      await fetchAllProducts()
    }
  }

  const addProductToOrder = (product: Product) => {
    // Generate variant combinations
    const variantCombos: string[] = []
    if (product.variants && product.variants.length > 0) {
      const generateCombos = (index: number, current: string[]) => {
        if (index === product.variants!.length) {
          variantCombos.push(current.join(' / '))
          return
        }
        
        product.variants![index].options.forEach(option => {
          generateCombos(index + 1, [...current, option])
        })
      }
      
      generateCombos(0, [])
    } else {
      variantCombos.push('No Variants')
    }

    const newOrderProduct: OrderProduct = {
      product: product,
      productOrderNumber: `PRD-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      productDescription: '',
      sampleNotes: '',
      standardPrice: '',
      bulkPrice: '',
      sampleRequired: false,
      sampleFee: '',
      sampleETA: '',
      sampleStatus: 'pending',
      shippingAirPrice: '',
      shippingBoatPrice: '',
      productionTime: '',
      items: variantCombos.map(combo => ({
        variantCombo: combo,
        quantity: 0,
        notes: ''
      })),
      mediaFiles: [],
      sampleMediaFiles: []
    }

    setOrderProducts(prev => [...prev, newOrderProduct])
    // DON'T close the modal - let user add more products
    // setShowAddProduct(false)
    showNotification('success', `${product.title} added to order`)
  }

  const updateProductField = (productIndex: number, field: string, value: any) => {
    setOrderProducts(prev => prev.map((op, idx) => 
      idx === productIndex ? { ...op, [field]: value } : op
    ))
  }

  const updateVariantQuantity = (productIndex: number, itemIndex: number, quantity: string) => {
    const qty = parseInt(quantity) || 0
    setOrderProducts(prev => prev.map((op, idx) => {
      if (idx === productIndex) {
        const newItems = [...op.items]
        newItems[itemIndex] = { ...newItems[itemIndex], quantity: qty }
        return { ...op, items: newItems }
      }
      return op
    }))
  }

  const updateVariantNotes = (productIndex: number, itemIndex: number, notes: string) => {
    setOrderProducts(prev => prev.map((op, idx) => {
      if (idx === productIndex) {
        const newItems = [...op.items]
        newItems[itemIndex] = { ...newItems[itemIndex], notes }
        return { ...op, items: newItems }
      }
      return op
    }))
  }

  const handleQuickFill = () => {
    const totalQty = parseInt(quickFillQuantity)
    if (!isNaN(totalQty) && totalQty > 0) {
      setOrderProducts(prev => prev.map(op => {
        const variantCount = op.items.length
        const qtyPerVariant = Math.floor(totalQty / variantCount)
        
        return {
          ...op,
          items: op.items.map(item => ({
            ...item,
            quantity: qtyPerVariant
          }))
        }
      }))
    }
  }

  const handleFileUpload = (productIndex: number, files: FileList | null) => {
    if (!files) return

    const newFiles = Array.from(files).filter(file => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showNotification('error', `File "${file.name}" is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`)
        return false
      }
      return true
    })
    
    if (newFiles.length > 0) {
      setOrderProducts(prev => prev.map((op, idx) => 
        idx === productIndex 
          ? { ...op, mediaFiles: [...op.mediaFiles, ...newFiles] }
          : op
      ))
    }
  }

  const handleSampleFileUpload = (productIndex: number, files: FileList | null) => {
    if (!files) return

    const newFiles = Array.from(files).filter(file => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showNotification('error', `File "${file.name}" is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`)
        return false
      }
      return true
    })
    
    if (newFiles.length > 0) {
      setOrderProducts(prev => prev.map((op, idx) => 
        idx === productIndex 
          ? { ...op, sampleMediaFiles: [...op.sampleMediaFiles, ...newFiles] }
          : op
      ))
    }
  }

  const removeFile = (productIndex: number, fileIndex: number) => {
    setOrderProducts(prev => prev.map((op, idx) => {
      if (idx === productIndex) {
        const newFiles = op.mediaFiles.filter((_, i) => i !== fileIndex)
        return { ...op, mediaFiles: newFiles }
      }
      return op
    }))
  }

  const removeSampleFile = (productIndex: number, fileIndex: number) => {
    setOrderProducts(prev => prev.map((op, idx) => {
      if (idx === productIndex) {
        const newFiles = op.sampleMediaFiles.filter((_, i) => i !== fileIndex)
        return { ...op, sampleMediaFiles: newFiles }
      }
      return op
    }))
  }

  const handleSaveOrder = async (isDraft: boolean) => {
    setSaving(true)
    
    try {
      const userData = localStorage.getItem('user')
      const user = userData ? JSON.parse(userData) : null
      
      // Check for sample notes
      let hasSampleRequest = false
      for (const orderProduct of orderProducts) {
        if (orderProduct.sampleNotes && orderProduct.sampleNotes.trim() !== '') {
          hasSampleRequest = true
          break
        }
      }

      // Determine status and order number
      let orderStatus = 'draft'
      let newOrderNumber = orderData.order_number
      
      if (!isDraft) {
        if (orderData.status === 'draft') {
          // Generate new order number with client prefix
          const { data: clientData } = await supabase
            .from('clients')
            .select('name')
            .eq('id', selectedClient || orderData.client_id)
            .single()
          
          const clientPrefix = clientData?.name?.substring(0, 3).toUpperCase() || 'ORD'
          newOrderNumber = `${clientPrefix}-${Date.now().toString(36).toUpperCase()}`
        }
        
        // Set status based on sample notes
        orderStatus = hasSampleRequest ? 'submitted_for_sample' : 'submitted_to_manufacturer'
      }

      // Update order
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          order_number: newOrderNumber,
          order_name: orderName,
          client_id: selectedClient,
          manufacturer_id: selectedManufacturer,
          status: orderStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)

      if (updateError) throw updateError

      // IMPORTANT: Delete ALL existing order products first
      // But we need to handle media files properly
      console.log('Deleting all existing order products...')
      
      // First, get all existing order_product_ids to clean up media
      const { data: existingProducts } = await supabase
        .from('order_products')
        .select('id')
        .eq('order_id', orderId)
      
      if (existingProducts && existingProducts.length > 0) {
        const productIds = existingProducts.map(p => p.id)
        
        // Delete all media files associated with these products
        console.log('Deleting existing media files...')
        await supabase
          .from('order_media')
          .delete()
          .in('order_product_id', productIds)
      }
      
      // Now delete the order products
      const { error: deleteError } = await supabase
        .from('order_products')
        .delete()
        .eq('order_id', orderId)
        
      if (deleteError) {
        console.error('Error deleting existing products:', deleteError)
        throw deleteError
      }

      console.log('All existing products deleted. Now saving current products...')

      // Save new order products
      for (const orderProduct of orderProducts) {
        // Build the insert data with description
        const insertData = {
          order_id: orderId,
          product_id: orderProduct.product.id,
          product_order_number: orderProduct.productOrderNumber,
          description: orderProduct.productDescription || '', // Save the description!
          sample_notes: orderProduct.sampleNotes || null,
          sample_required: !!orderProduct.sampleNotes
        }
        
        console.log('Attempting to save product with data:', insertData)
        
        const { data: productData, error: productError } = await supabase
          .from('order_products')
          .insert(insertData)
          .select()
          .single()

        if (productError) {
          console.error('Error saving product:', productError)
          console.error('Insert data that failed:', insertData)
          console.error('Error details:', JSON.stringify(productError, null, 2))
          
          showNotification('error', `Failed to save product ${orderProduct.product.title}: ${productError.message}`)
          throw productError
        }

        console.log('Product saved successfully with ID:', productData.id)
        
        // Re-associate existing media files with the new product record
        if (orderProduct.existingMedia && orderProduct.existingMedia.length > 0) {
          console.log(`Re-associating ${orderProduct.existingMedia.length} existing reference media files...`)
          
          for (const media of orderProduct.existingMedia) {
            // Insert a new media record pointing to the existing file
            await supabase
              .from('order_media')
              .insert({
                order_product_id: productData.id,
                file_url: media.file_url,
                file_type: media.file_type,
                original_filename: media.original_filename,
                uploaded_by: user?.id
              })
          }
        }
        
        // Re-associate existing sample media files
        if (orderProduct.existingSampleMedia && orderProduct.existingSampleMedia.length > 0) {
          console.log(`Re-associating ${orderProduct.existingSampleMedia.length} existing sample media files...`)
          
          for (const media of orderProduct.existingSampleMedia) {
            await supabase
              .from('order_media')
              .insert({
                order_product_id: productData.id,
                file_url: media.file_url,
                file_type: media.file_type,
                original_filename: media.original_filename,
                uploaded_by: user?.id
              })
          }
        }

        // Save ALL items (not just ones with quantity > 0)
        // This ensures all variants are available when editing later
        const itemsToSave = orderProduct.items.map(item => ({
          order_product_id: productData.id,
          variant_combo: item.variantCombo,
          quantity: item.quantity || 0,
          notes: item.notes || '',
          admin_status: 'pending',
          manufacturer_status: 'pending'
        }))

        if (itemsToSave.length > 0) {
          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(itemsToSave)
            
          if (itemsError) {
            console.error('Error saving items:', itemsError)
            console.error('Items data:', itemsToSave)
          }
        }

        // Upload media files if any
        for (const file of orderProduct.mediaFiles) {
          try {
            const fileExt = file.name.split('.').pop()
            const fileName = `ref-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `${orderId}/${productData.id}/${fileName}`

            const { error: uploadError } = await supabase.storage
              .from('order-media')
              .upload(filePath, file)

            if (uploadError) {
              console.error('Error uploading file:', uploadError)
              if (uploadError.message?.includes('exceeded the maximum allowed size')) {
                showNotification('error', `File "${file.name}" is too large for storage. Please reduce file size.`)
              } else {
                showNotification('error', `Failed to upload "${file.name}": ${uploadError.message}`)
              }
              continue
            }

            const { data: { publicUrl } } = supabase.storage
              .from('order-media')
              .getPublicUrl(filePath)

            await supabase
              .from('order_media')
              .insert({
                order_product_id: productData.id,
                file_url: publicUrl,
                file_type: file.type.startsWith('image/') ? 'image' : 'document',
                uploaded_by: user?.id,
                original_filename: file.name // Save the original filename
              })
          } catch (mediaError) {
            console.error('Error with media:', mediaError)
          }
        }

        // Upload sample media files
        for (const file of orderProduct.sampleMediaFiles) {
          try {
            const fileExt = file.name.split('.').pop()
            const fileName = `sample-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `${orderId}/${productData.id}/${fileName}`

            const { error: uploadError } = await supabase.storage
              .from('order-media')
              .upload(filePath, file)

            if (uploadError) {
              console.error('Error uploading sample file:', uploadError)
              if (uploadError.message?.includes('exceeded the maximum allowed size')) {
                showNotification('error', `File "${file.name}" is too large for storage. Please reduce file size.`)
              } else {
                showNotification('error', `Failed to upload "${file.name}": ${uploadError.message}`)
              }
              continue
            }

            const { data: { publicUrl } } = supabase.storage
              .from('order-media')
              .getPublicUrl(filePath)

            await supabase
              .from('order_media')
              .insert({
                order_product_id: productData.id,
                file_url: publicUrl,
                file_type: file.type.startsWith('image/') ? 'image' : 'document',
                uploaded_by: user?.id,
                original_filename: file.name // Save the original filename
              })
          } catch (mediaError) {
            console.error('Error with sample media:', mediaError)
          }
        }
      }

      showNotification('success', `Order ${orderData.order_number} updated successfully!`)
      
      setTimeout(() => {
        router.push('/dashboard/orders')
      }, 1500)
      
    } catch (error) {
      console.error('Error updating order:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error updating order'
      showNotification('error', errorMessage)
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading order...</div>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      {/* Notification Toast - Mobile Responsive */}
      {notification.show && (
        <div className={`
          fixed top-3 right-3 sm:top-4 sm:right-4 z-50 min-w-[280px] sm:min-w-[300px] max-w-[calc(100vw-24px)] sm:max-w-none transform transition-all duration-500 ease-out
          ${notification.show ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        `}>
          <div className={`
            p-3 sm:p-4 rounded-xl shadow-2xl backdrop-blur-lg border
            ${notification.type === 'success'
              ? 'bg-gradient-to-r from-emerald-500/90 to-green-600/90 border-emerald-400/50 text-white'
              : notification.type === 'error'
              ? 'bg-gradient-to-r from-red-500/90 to-rose-600/90 border-red-400/50 text-white'
              : 'bg-gradient-to-r from-blue-500/90 to-indigo-600/90 border-blue-400/50 text-white'
            }
          `}>
            <div className="flex items-center space-x-2 sm:space-x-3">
              {notification.type === 'success' && (
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
              {notification.type === 'error' && (
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm sm:text-base break-words">
                  {notification.message}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header - Mobile Responsive */}
      <div className="mb-4 sm:mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Orders
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Edit Order</h1>
          <button
            onClick={handleAddProductClick}
            className="px-3 sm:px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Order Summary Info - Mobile Responsive */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="border-b border-gray-200 pb-2 sm:pb-3 mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words">{orderName}</h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Order details and configuration</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="flex items-start space-x-2 sm:space-x-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-900">Client</p>
              <p className="text-xs sm:text-sm text-gray-600 break-words">{orderData?.clients?.name}</p>
            </div>
          </div>

          <div className="flex items-start space-x-2 sm:space-x-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-900">Manufacturer</p>
              <p className="text-xs sm:text-sm text-gray-600 break-words">{orderData?.manufacturers?.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Fill Section - Mobile Responsive */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-5">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            <span className="text-xs sm:text-sm font-medium text-blue-900">Quick Fill Quantities</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={quickFillQuantity}
              onChange={(e) => {
                const value = e.target.value
                if (value === '' || parseInt(value) >= 0) {
                  setQuickFillQuantity(value)
                }
              }}
              placeholder="Total quantity"
              className="flex-1 sm:w-32 md:w-40 px-2 sm:px-3 py-2 text-sm sm:text-base border border-blue-300 rounded-lg text-gray-900 placeholder-gray-500"
              min="0"
            />
            <button
              onClick={handleQuickFill}
              className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
            >
              Distribute
            </button>
          </div>
        </div>
      </div>

      {/* Products - Mobile Responsive */}
      {orderProducts.map((orderProduct, productIndex) => (
        <div key={productIndex} className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          {/* Product Header - Mobile Responsive */}
          <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center flex-wrap gap-1 sm:gap-0">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-blue-600 flex-shrink-0" />
                <span className="break-words">{orderProduct.product.title}</span>
                {orderProducts.filter(op => op.product.id === orderProduct.product.id).length > 1 && (
                  <span className="ml-1 sm:ml-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                    (Instance {orderProducts.filter(op => op.product.id === orderProduct.product.id).indexOf(orderProduct) + 1} of {orderProducts.filter(op => op.product.id === orderProduct.product.id).length})
                  </span>
                )}
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 break-words">
                Product Order Number: {orderProduct.productOrderNumber}
              </p>
            </div>
            <button
              onClick={() => {
                if (orderProducts.length === 1) {
                  showNotification('error', 'Cannot remove the last product. Add another product first.')
                  return
                }
                const updatedProducts = orderProducts.filter((_, index) => index !== productIndex)
                setOrderProducts(updatedProducts)
                showNotification('info', `${orderProduct.product.title} removed from order`)
              }}
              className="p-1.5 sm:p-2 text-red-500 hover:text-white hover:bg-red-500 rounded-lg transition-all group flex-shrink-0"
              title="Remove this product from order"
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Product Description - Mobile Responsive */}
          <div className="mb-3 sm:mb-4">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Product Description
            </label>
            <input
              type="text"
              value={orderProduct.productDescription}
              onChange={(e) => updateProductField(productIndex, 'productDescription', e.target.value)}
              placeholder="Enter brief product description..."
              className="w-full px-2 sm:px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
            />
          </div>

          {/* Sample Request Section - Mobile Responsive */}
          <div className="bg-amber-50 rounded-lg p-3 sm:p-4 border border-amber-300 mb-4 sm:mb-6">
            <h4 className="text-xs sm:text-sm font-semibold text-amber-900 flex items-center mb-2 sm:mb-3">
              <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Sample Request
            </h4>

            {/* Fields that will be filled by manufacturer - display only */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 mb-2 sm:mb-3">
              <div className="opacity-60">
                <label className="block text-xs font-medium text-amber-800 mb-1">
                  Sample Fee
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
                  <input
                    type="text"
                    placeholder="Set by manufacturer"
                    disabled
                    className="w-full pl-7 sm:pl-8 pr-2 sm:pr-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-amber-200 rounded-lg bg-amber-50 text-gray-500"
                  />
                </div>
              </div>

              <div className="opacity-60">
                <label className="block text-xs font-medium text-amber-800 mb-1">
                  Sample ETA
                </label>
                <div className="relative">
                  <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
                  <input
                    type="text"
                    placeholder="Set by manufacturer"
                    disabled
                    className="w-full pl-7 sm:pl-8 pr-2 sm:pr-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-amber-200 rounded-lg bg-amber-50 text-gray-500"
                  />
                </div>
              </div>

              <div className="opacity-60">
                <label className="block text-xs font-medium text-amber-800 mb-1">
                  Status
                </label>
                <input
                  type="text"
                  value="Pending"
                  disabled
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-amber-200 rounded-lg bg-amber-50 text-gray-500"
                />
              </div>
            </div>

            {/* Sample Tech Pack Upload */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-amber-800 mb-1">
                Technical Pack / Sample Media
              </label>
              
              {/* Show existing sample files */}
              {orderProduct.existingSampleMedia && orderProduct.existingSampleMedia.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-amber-700 mb-1">Existing files:</p>
                  <div className="flex flex-wrap gap-2">
                    {orderProduct.existingSampleMedia.map((media) => (
                      <div key={media.id} className="flex items-center gap-1 bg-amber-100 px-2 py-1 rounded text-xs">
                        <a 
                          href={media.file_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-amber-800 hover:text-amber-900 underline"
                        >
                          {media.file_type === 'image' ? '📷' : '📄'} {media.original_filename || media.file_url.split('/').pop()?.substring(0, 20)}...
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Upload new files */}
              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 cursor-pointer flex items-center text-sm">
                  <Upload className="w-4 h-4 mr-1" />
                  Upload Tech Pack
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf"
                    onChange={(e) => handleSampleFileUpload(productIndex, e.target.files)}
                    className="hidden"
                  />
                </label>
                {orderProduct.sampleMediaFiles.length > 0 && (
                  <span className="text-xs text-amber-700">
                    {orderProduct.sampleMediaFiles.length} new file(s)
                  </span>
                )}
              </div>
              
              {/* Show newly added files */}
              {orderProduct.sampleMediaFiles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {orderProduct.sampleMediaFiles.map((file, fileIndex) => (
                    <div key={fileIndex} className="flex items-center gap-1 bg-amber-100 px-2 py-1 rounded text-xs">
                      <span className="text-amber-800">📎 {file.name}</span>
                      <button
                        onClick={() => removeSampleFile(productIndex, fileIndex)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sample Notes */}
            <div>
              <label className="block text-xs font-medium text-amber-800 mb-1">
                Sample Notes / Instructions
              </label>
              <textarea
                value={orderProduct.sampleNotes}
                onChange={(e) => updateProductField(productIndex, 'sampleNotes', e.target.value)}
                placeholder="Add notes about the sample request, special instructions, materials, colors, etc..."
                rows={3}
                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-gray-900 text-sm"
              />
            </div>
          </div>

          {/* Bulk Order Section - Separated */}
          <div className="border border-gray-300 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <Package className="w-4 h-4 mr-2" />
              Bulk Order Details
            </h4>

            {/* Reference Media Upload */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reference Media
              </label>
              
              {/* Show existing reference files */}
              {orderProduct.existingMedia && orderProduct.existingMedia.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-gray-600 mb-1">Existing files:</p>
                  <div className="flex flex-wrap gap-2">
                    {orderProduct.existingMedia.map((media) => (
                      <div key={media.id} className="bg-gray-100 px-3 py-1 rounded-lg">
                        <a 
                          href={media.file_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 underline"
                        >
                          {media.file_type === 'image' ? '📷' : '📄'} {media.original_filename || media.file_url.split('/').pop()?.substring(0, 20)}...
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Upload new files */}
              <div className="flex items-center gap-4">
                <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer flex items-center">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Files
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={(e) => handleFileUpload(productIndex, e.target.files)}
                    className="hidden"
                  />
                </label>
                {orderProduct.mediaFiles.length > 0 && (
                  <span className="text-sm text-gray-600">
                    {orderProduct.mediaFiles.length} new file(s) selected
                  </span>
                )}
              </div>
              
              {/* Show newly added files */}
              {orderProduct.mediaFiles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {orderProduct.mediaFiles.map((file, fileIndex) => (
                    <div key={fileIndex} className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-lg">
                      <span className="text-sm text-gray-700">📎 {file.name}</span>
                      <button
                        onClick={() => removeFile(productIndex, fileIndex)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Variants Table - Mobile Responsive */}
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-700" style={{minWidth: '100px'}}>Variant</th>
                      <th className="text-left py-2 px-2 sm:pl-5 sm:pr-4 text-xs sm:text-sm font-medium text-gray-700" style={{minWidth: '80px'}}>Qty</th>
                      <th className="text-left py-2 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-700" style={{minWidth: '120px'}}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderProduct.items.map((item, itemIndex) => (
                      <tr key={itemIndex} className="border-b border-gray-100">
                        <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm text-gray-900">{item.variantCombo}</td>
                        <td className="py-2 px-2 sm:pl-5 sm:pr-4">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateVariantQuantity(productIndex, itemIndex, e.target.value)}
                            min="0"
                            className="w-16 sm:w-20 px-1 sm:px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded-lg text-center text-gray-900"
                          />
                        </td>
                        <td className="py-2 px-2 sm:px-4">
                          <input
                            type="text"
                            value={item.notes || ''}
                            onChange={(e) => updateVariantNotes(productIndex, itemIndex, e.target.value)}
                            placeholder="Optional notes..."
                            className="w-full px-1 sm:px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded-lg text-gray-900"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Action Buttons - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 mt-6 sm:mt-8">
        <button
          onClick={() => handleSaveOrder(true)}
          disabled={saving}
          className="w-full sm:w-auto px-4 sm:px-6 py-2 text-sm sm:text-base border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving && (
            <svg className="animate-spin h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {saving ? 'Saving...' : 'Save as Draft'}
        </button>
        <button
          onClick={() => handleSaveOrder(false)}
          disabled={saving}
          className="w-full sm:w-auto px-4 sm:px-6 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving && (
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {saving ? 'Submitting...' : 'Submit Order'}
        </button>
      </div>

      {/* Add Product Modal - Mobile Responsive */}
      {showAddProduct && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-3 sm:p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-3xl w-full max-h-[80vh] sm:max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 break-words">Select Products to Add</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Click products to add them to the order</p>
              </div>
              <button
                onClick={() => {
                  setShowAddProduct(false)
                  setProductSearch('')
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none flex-shrink-0 -mt-1"
              >
                ×
              </button>
            </div>

            {/* Search Bar */}
            <div className="mb-3 sm:mb-4">
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products by name..."
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
              />
            </div>

            {/* Products Grid */}
            <div className="overflow-y-auto flex-1 -mx-4 sm:mx-0 px-4 sm:px-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                {allProducts.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-gray-500">
                    <p className="mb-2">No products available</p>
                    <p className="text-sm">Please check the Products section or database connection</p>
                  </div>
                )}
                
                {allProducts
                  .filter(p =>
                    p.title.toLowerCase().includes(productSearch.toLowerCase())
                  )
                  .map(product => {
                    const instanceCount = orderProducts.filter(op => op.product.id === product.id).length
                    return (
                      <div
                        key={product.id}
                        onClick={() => addProductToOrder(product)}
                        className={`border rounded-lg p-2.5 sm:p-3 transition-all cursor-pointer select-none ${
                          instanceCount > 0
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400 hover:shadow-md'
                        }`}
                      >
                        <div className="relative">
                          <div className="mb-2">
                            <h3 className="font-semibold text-gray-900 text-xs sm:text-sm break-words">
                              {product.title}
                              {instanceCount > 0 && (
                                <span className="ml-1 sm:ml-2 text-xs text-blue-600 bg-blue-100 px-1.5 sm:px-2 py-0.5 rounded whitespace-nowrap">
                                  {instanceCount} in order
                                </span>
                              )}
                            </h3>
                            {product.description && (
                              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{product.description}</p>
                            )}
                          </div>
                          <div className="pt-2 border-t border-gray-200">
                            <span className="text-xs text-gray-500">
                              {instanceCount > 0 ? 'Add another instance' : 'Click to add'}
                              {product.variants && product.variants.length > 0 && (
                                <span className="block text-xs text-gray-400 mt-1">
                                  {product.variants.map(v => `${v.type}: ${v.options.length}`).join(', ')}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>

              {allProducts.length > 0 && allProducts.filter(p =>
                p.title.toLowerCase().includes(productSearch.toLowerCase())
              ).length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm sm:text-base">
                  No products match your search
                </div>
              )}
            </div>

            {/* Done Button */}
            <div className="mt-3 sm:mt-4 flex justify-end">
              <button
                onClick={() => {
                  setShowAddProduct(false)
                  setProductSearch('')
                }}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Done Adding Products
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}