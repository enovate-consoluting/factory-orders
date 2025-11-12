'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, ArrowRight, Plus, Minus, Trash2, Upload, X, Package, DollarSign, FileText, Tag, Ship, Plane, Clock, StickyNote, Calendar, CreditCard, AlertCircle } from 'lucide-react'

interface Product {
  id: string
  title: string
  description: string
  variants?: {
    type: string
    options: string[]
  }[]
}

interface Client {
  id: string
  name: string
  email: string
}

interface Manufacturer {
  id: string
  name: string
  email: string
}

interface OrderProduct {
  product: Product
  productOrderNumber: string
  productDescription: string
  standardPrice: string
  bulkPrice: string
  // Sample Request fields
  sampleRequired: boolean
  sampleFee: string
  sampleETA: string
  sampleStatus: string
  sampleNotes: string
  shippingAirPrice: string
  shippingBoatPrice: string
  productionTime: string
  items: {
    variantCombo: string
    quantity: number
    notes: string
  }[]
  mediaFiles: File[]
  sampleMediaFiles: File[]
}

// Consistent dark text for all inputs
const inputClassName = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
const selectClassName = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"

export default function CreateOrderPage() {
  const router = useRouter()
  const productDataRef = useRef<any>({}) // Store products persistently
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Notification state
  const [notification, setNotification] = useState<{
    show: boolean
    type: 'success' | 'error' | 'info'
    message: string
  }>({
    show: false,
    type: 'success',
    message: ''
  })
  
  // Function to show notification
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ show: true, type, message })
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }))
    }, 3000)
  }
  
  // ============================================
  // NOTIFICATION HELPER FUNCTION
  // ============================================
  const createManufacturerNotification = async (
    orderId: string,
    manufacturerId: string,
    orderNumber: string,
    orderStatus: string
  ) => {
    try {
      // Determine notification type and message based on status
      let notificationType = 'new_order';
      let message = `New order ${orderNumber} has been assigned to you`;
      
      if (orderStatus === 'submitted_for_sample') {
        notificationType = 'sample_requested';
        message = `New order ${orderNumber} with sample request`;
      } else if (orderStatus === 'submitted_to_manufacturer') {
        notificationType = 'new_order';
        message = `New order ${orderNumber} submitted for review`;
      }

      console.log('Creating manufacturer notification:', {
        manufacturerId,
        orderId,
        notificationType,
        message
      });

      // Create the notification
      const { error } = await supabase
        .from('manufacturer_notifications')
        .insert({
          manufacturer_id: manufacturerId,
          order_id: orderId,
          product_id: null, // Order-level notification
          type: notificationType,
          message: message,
          is_read: false,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error creating manufacturer notification:', error);
      } else {
        console.log('✅ Manufacturer notification created successfully');
      }
    } catch (error) {
      console.error('Error in createManufacturerNotification:', error);
    }
  };
  
  // Step 1: Basic Info
  const [orderName, setOrderName] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedManufacturer, setSelectedManufacturer] = useState('')
  
  // Step 2: Products with quantities
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProducts, setSelectedProducts] = useState<{[key: string]: number}>({})
  const [productSearch, setProductSearch] = useState('')
  
  // Step 3: Order Details
  const [orderProducts, setOrderProducts] = useState<OrderProduct[]>([])
  const [quickFillQuantity, setQuickFillQuantity] = useState('')

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    setLoading(true)
    try {
      // Fetch clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .order('name')
      
      // Fetch manufacturers
      const { data: manufacturersData } = await supabase
        .from('manufacturers')
        .select('*')
        .order('name')
      
      // Fetch products with variants
      const { data: productsData } = await supabase
        .from('products')
        .select(`
          *,
          product_variants (
            variant_option_id,
            variant_options (
              id,
              value,
              variant_types (
                id,
                name
              )
            )
          )
        `)
        .order('title')

      setClients(clientsData || [])
      setManufacturers(manufacturersData || [])
      
      // AUTO-DEFAULT MANUFACTURER IF ONLY ONE
      if (manufacturersData && manufacturersData.length === 1) {
        setSelectedManufacturer(manufacturersData[0].id)
      }
      
      // Process products to group variants by type
      if (productsData) {
        const processedProducts = productsData.map(product => {
          const variantsByType: { [key: string]: string[] } = {}
          
          product.product_variants?.forEach((pv: any) => {
            const typeName = pv.variant_options?.variant_types?.name
            const optionValue = pv.variant_options?.value
            
            if (typeName && optionValue) {
              if (!variantsByType[typeName]) {
                variantsByType[typeName] = []
              }
              variantsByType[typeName].push(optionValue)
            }
          })
          
          return {
            ...product,
            variants: Object.entries(variantsByType).map(([type, options]) => ({
              type,
              options
            }))
          }
        })
        
        setProducts(processedProducts)
        
        // CRITICAL: Store products in ref for persistence
        processedProducts.forEach(p => {
          productDataRef.current[p.id] = p;
        });
      }
    } catch (error) {
      console.error('Error fetching initial data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProductQuantityChange = (productId: string, quantity: number) => {
    setSelectedProducts(prev => {
      const newSelection = { ...prev }
      if (quantity === 0) {
        delete newSelection[productId]
      } else {
        newSelection[productId] = quantity
      }
      return newSelection
    })
  }

  const initializeOrderProducts = () => {
    console.log('Initializing order products...');
    console.log('Selected products:', selectedProducts);
    console.log('Available products in ref:', productDataRef.current);
    console.log('Available products in state:', products);
    
    const orderProds: OrderProduct[] = []
    
    Object.entries(selectedProducts).forEach(([productId, quantity]) => {
      // TRY TO GET FROM REF FIRST, THEN FALL BACK TO STATE
      const product = productDataRef.current[productId] || products.find(p => p.id === productId)
      
      if (!product) {
        console.error(`Product not found for ID: ${productId}`);
        return; // Skip this product
      }
      
      console.log(`Found product: ${product.title} (${product.id})`);
      
      // Create multiple instances of the same product based on quantity
      for (let i = 0; i < quantity; i++) {
        const productOrderNumber = `PRD-${Math.random().toString(36).substr(2, 4).toUpperCase()}`
        
        // Generate all variant combinations
        const variantCombos: string[] = []
        if (product.variants && product.variants.length > 0) {
          const generateCombos = (index: number, current: string[]) => {
            if (index === product.variants!.length) {
              variantCombos.push(current.join(' / '))
              return
            }
            
            product.variants![index].options.forEach((option: string) => {
              generateCombos(index + 1, [...current, option])
            })
          }
          
          generateCombos(0, [])
        } else {
          variantCombos.push('No Variants')
        }
        
        orderProds.push({
          product: JSON.parse(JSON.stringify(product)), // Deep copy to prevent reference loss
          productOrderNumber,
          productDescription: '',
          standardPrice: '',
          bulkPrice: '',
          sampleRequired: false,
          sampleFee: '',
          sampleETA: '',
          sampleStatus: 'pending',
          sampleNotes: '',
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
        })
      }
    })
    
    setOrderProducts(orderProds)
  }

  const handleQuickFill = () => {
    const totalQty = parseInt(quickFillQuantity)
    if (!isNaN(totalQty) && totalQty > 0) {
      // For each product, divide the total by that product's variant count
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

  const updateProductField = (productIndex: number, field: string, value: any) => {
    setOrderProducts(prev => prev.map((op, idx) => 
      idx === productIndex 
        ? { ...op, [field]: value }
        : op
    ))
  }

  const updateVariantQuantity = (productIndex: number, variantIndex: number, quantity: string) => {
    const qty = parseInt(quantity) || 0
    setOrderProducts(prev => prev.map((op, idx) => {
      if (idx === productIndex) {
        const newItems = [...op.items]
        newItems[variantIndex] = { ...newItems[variantIndex], quantity: qty }
        return { ...op, items: newItems }
      }
      return op
    }))
  }

  const updateVariantNotes = (productIndex: number, variantIndex: number, notes: string) => {
    setOrderProducts(prev => prev.map((op, idx) => {
      if (idx === productIndex) {
        const newItems = [...op.items]
        newItems[variantIndex] = { ...newItems[variantIndex], notes }
        return { ...op, items: newItems }
      }
      return op
    }))
  }

  const handleFileUpload = (productIndex: number, files: FileList | null) => {
    if (!files) return
    
    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB limit
    const newFiles = Array.from(files).filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        showNotification('error', `File "${file.name}" is too large. Maximum size is 50MB.`)
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
    
    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB limit
    const newFiles = Array.from(files).filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        showNotification('error', `File "${file.name}" is too large. Maximum size is 50MB.`)
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

  const handleSubmit = async (isDraft = false) => {
    console.log('=== HANDLE SUBMIT STARTED ===')
    console.log('Draft mode:', isDraft)
    console.log('Order name:', orderName)
    console.log('Client:', selectedClient)
    console.log('Manufacturer:', selectedManufacturer)
    
    setSaving(true)
    
    try {
      const userData = localStorage.getItem('user')
      const user = userData ? JSON.parse(userData) : null
      
      // Get the client name for the prefix
      const { data: clientData } = await supabase
        .from('clients')
        .select('name')
        .eq('id', selectedClient)
        .single()
      
      const clientPrefix = clientData?.name?.substring(0, 3).toUpperCase() || 'ORD'
      
      // Generate order number - Get the next sequential number
      const { data: lastOrder } = await supabase
        .from('orders')
        .select('order_number')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      let nextNumber = 1200 // Starting number
      if (lastOrder?.order_number) {
        const match = lastOrder.order_number.match(/(\d{6})/)
        if (match) {
          nextNumber = parseInt(match[1]) + 1
        }
      }
      
      const orderNumber = isDraft 
        ? `DRAFT-${nextNumber.toString().padStart(6, '0')}`
        : `${clientPrefix}-${nextNumber.toString().padStart(6, '0')}`

      // Check if any product has sample information filled
      let hasSampleRequest = false
      for (const orderProduct of orderProducts) {
        if (orderProduct.sampleNotes && orderProduct.sampleNotes.trim() !== '') {
          hasSampleRequest = true
          break
        }
      }

      // UPDATED: Use simplified statuses
      let orderStatus = 'draft'
      if (!isDraft) {
        orderStatus = 'in_progress'  // SIMPLIFIED: All non-draft orders are 'in_progress'
        console.log('Status: in_progress (order submitted)')
      } else {
        console.log('Status: draft (saved as draft)')
      }
      
      console.log('Final order status:', orderStatus)
      console.log('Has sample request:', hasSampleRequest)
      
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          order_name: orderName || 'New Order',
          client_id: selectedClient,
          manufacturer_id: selectedManufacturer,
          status: orderStatus,
          created_by: user?.id
        })
        .select()
        .single()

      if (orderError) {
        console.error('Database error creating order:', orderError)
        throw new Error(orderError.message || 'Failed to create order')
      }

      console.log('Order created successfully!')
      console.log('Order ID:', orderData.id)
      console.log('Order Number:', orderNumber)
      
      // ============================================
      // CREATE MANUFACTURER NOTIFICATION
      // ============================================
      
      // Create manufacturer notification if not a draft
      if (!isDraft && orderData && selectedManufacturer) {
        console.log('🔔 Creating notification for manufacturer...');
        await createManufacturerNotification(
          orderData.id,
          selectedManufacturer,
          orderNumber,
          'sent_to_manufacturer'  // UPDATED: Use new status
        );
      } else {
        console.log('ℹ️ No notification needed (draft or missing data)');
      }
      
      // ============================================
      
      // Extract numeric part from order number for product numbers
      const orderNumeric = orderNumber.includes('-') 
        ? orderNumber.split('-')[1]
        : nextNumber.toString().padStart(6, '0')
      
      // Now save all the products with proper product numbers
      console.log(`Saving ${orderProducts.length} products...`)
      
      for (const orderProduct of orderProducts) {
        console.log('Saving product:', orderProduct.product.title)
        
        // Generate product code from product title (first 3 letters)
        const productCode = orderProduct.product.title 
          ? orderProduct.product.title.substring(0, 3).toUpperCase() 
          : 'PRD'
        
        // Generate description code (first 3 letters)
        const descCode = orderProduct.productDescription 
          ? orderProduct.productDescription.substring(0, 3).toUpperCase()
          : 'GEN'
        
        // Create final product number: 001234-SLI-PER
        const finalProductOrderNumber = `${orderNumeric}-${productCode}-${descCode}`
        
        // FIXED: Check if product_id exists before saving
        if (!orderProduct.product.id) {
          console.error('Product ID is missing for:', orderProduct.product.title)
          showNotification('error', `Failed to save product ${orderProduct.product.title}: Missing product ID`)
          continue
        }
        
        // FIXED: Conditional status and routing based on draft mode
        const { data: productData, error: productError } = await supabase
          .from('order_products')
          .insert({
            order_id: orderData.id,
            product_id: orderProduct.product.id,
            product_order_number: finalProductOrderNumber,
            description: orderProduct.productDescription || '',
            sample_notes: orderProduct.sampleNotes || '',
            sample_required: orderProduct.sampleRequired || false,
            // FIXED: Conditional status and routing based on draft mode
            product_status: isDraft ? 'pending' : 'sent_to_manufacturer',
            routed_to: isDraft ? 'admin' : 'manufacturer'
          })
          .select()
          .single()

        if (productError) {
          console.error('Error saving product:', productError)
          showNotification('error', `Failed to save product ${orderProduct.product.title}: ${productError.message}`)
          continue
        }

        console.log('Product saved with ID:', productData.id)
        console.log('Product Order Number:', finalProductOrderNumber)
        console.log('Product Status:', isDraft ? 'pending' : 'sent_to_manufacturer')
        console.log('Routed To:', isDraft ? 'admin' : 'manufacturer')

        // Save ALL order items (variants) - not just ones with quantity > 0
        const itemsToSave = orderProduct.items.map((item: any) => ({
          order_product_id: productData.id,
          variant_combo: item.variantCombo,
          quantity: item.quantity || 0,
          notes: item.notes || '',
          admin_status: 'pending',
          manufacturer_status: 'pending'
        }))

        console.log(`Saving ${itemsToSave.length} variant items...`)

        if (itemsToSave.length > 0) {
          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(itemsToSave)

          if (itemsError) {
            console.error('Error saving items:', itemsError)
          } else {
            console.log('Items saved successfully')
          }
        }

        // FIXED: Upload and save media files with display_name
        if (orderProduct.mediaFiles && orderProduct.mediaFiles.length > 0) {
          console.log(`Uploading ${orderProduct.mediaFiles.length} media files...`)
          
          let bulkFileCounter = 1;
          for (const file of orderProduct.mediaFiles) {
            try {
              const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file'
              // Create display name using product code and sequential number
              const displayName = `${finalProductOrderNumber}-bulk-${String(bulkFileCounter).padStart(2, '0')}.${fileExt}`
              const filePath = `${orderData.id}/${productData.id}/${displayName}`

              // Upload to Supabase storage
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

              // Get public URL
              const { data: { publicUrl } } = supabase.storage
                .from('order-media')
                .getPublicUrl(filePath)

              // Save media record with both original filename and display_name
              await supabase
                .from('order_media')
                .insert({
                  order_product_id: productData.id,
                  file_url: publicUrl,
                  file_type: file.type.startsWith('image/') ? 'image' : 'document',
                  uploaded_by: user?.id,
                  original_filename: file.name,
                  display_name: displayName  // ADDED: Save the display name
                })

              console.log('Media file uploaded with display name:', displayName)
              bulkFileCounter++;
            } catch (mediaError) {
              console.error('Error with media:', mediaError)
            }
          }
        }

        // FIXED: Upload and save sample media files with display_name
        if (orderProduct.sampleMediaFiles && orderProduct.sampleMediaFiles.length > 0) {
          console.log(`Uploading ${orderProduct.sampleMediaFiles.length} sample media files...`)
          
          let sampleFileCounter = 1;
          for (const file of orderProduct.sampleMediaFiles) {
            try {
              const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file'
              // Create display name using product code and sequential number
              const displayName = `${finalProductOrderNumber}-sample-${String(sampleFileCounter).padStart(2, '0')}.${fileExt}`
              const filePath = `${orderData.id}/${productData.id}/${displayName}`

              // Upload to Supabase storage
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

              // Get public URL
              const { data: { publicUrl } } = supabase.storage
                .from('order-media')
                .getPublicUrl(filePath)

              // Save media record with both original filename and display_name
              await supabase
                .from('order_media')
                .insert({
                  order_product_id: productData.id,
                  file_url: publicUrl,
                  file_type: file.type.startsWith('image/') ? 'sample_image' : 'sample_document',
                  uploaded_by: user?.id,
                  original_filename: file.name,
                  display_name: displayName  // ADDED: Save the display name
                })

              console.log('Sample media file uploaded with display name:', displayName)
              sampleFileCounter++;
            } catch (mediaError) {
              console.error('Error with sample media:', mediaError)
            }
          }
        }
      }
      
      console.log('All products and items saved!')
      console.log('✅ Order creation complete!')
      
      // Show success notification
      showNotification('success', `Order ${orderNumber} ${isDraft ? 'saved as draft' : 'created'} successfully!`)
      
      // Log that we're about to navigate
      console.log('Navigating to orders list in 1.5 seconds...')
      
      // Navigate after a short delay to let user see the notification
      setTimeout(() => {
        console.log('Now navigating to /dashboard/orders')
        router.push('/dashboard/orders')
      }, 1500)
    } catch (error) {
      console.error('Error creating order:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error creating order'
      showNotification('error', errorMessage)
      setSaving(false)
    }
  }

  const nextStep = () => {
    if (currentStep === 1) {
      if (!orderName.trim()) {
        showNotification('error', 'Please enter an order name')
        return
      }
      if (!selectedClient || !selectedManufacturer) {
        showNotification('error', 'Please select both client and manufacturer')
        return
      }
      setCurrentStep(2)
    } else if (currentStep === 2) {
      if (Object.keys(selectedProducts).length === 0) {
        showNotification('error', 'Please select at least one product')
        return
      }
      initializeOrderProducts()
      setCurrentStep(3)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const getTotalProductsSelected = () => {
    return Object.values(selectedProducts).reduce((sum, qty) => sum + qty, 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Beautiful Notification Toast */}
      {notification.show && (
        <div className={`
          fixed top-4 right-4 z-50 min-w-[300px] transform transition-all duration-500 ease-out
          ${notification.show ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        `}>
          <div className={`
            p-4 rounded-xl shadow-2xl backdrop-blur-lg border
            ${notification.type === 'success' 
              ? 'bg-gradient-to-r from-emerald-500/90 to-green-600/90 border-emerald-400/50 text-white' 
              : notification.type === 'error'
              ? 'bg-gradient-to-r from-red-500/90 to-rose-600/90 border-red-400/50 text-white'
              : 'bg-gradient-to-r from-blue-500/90 to-indigo-600/90 border-blue-400/50 text-white'
            }
          `}>
            <div className="flex items-center space-x-3">
              {notification.type === 'success' && (
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
              {notification.type === 'error' && (
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold text-white">
                  {notification.message}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Orders
        </button>
        
        <h1 className="text-2xl font-bold text-gray-900">Create New Order</h1>
        
        {/* Progress Steps */}
        <div className="mt-6 flex items-center justify-between">
          <div 
            className={`flex items-center cursor-pointer ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}
            onClick={() => currentStep > 1 && setCurrentStep(1)}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-white'
            }`}>
              1
            </div>
            <span className="ml-2 font-medium">Basic Info</span>
          </div>
          
          <div className="flex-1 h-0.5 bg-gray-300 mx-4" />
          
          <div 
            className={`flex items-center cursor-pointer ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}
            onClick={() => {
              if (currentStep > 2) {
                setCurrentStep(2)
              } else if (currentStep === 1 && orderName && selectedClient && selectedManufacturer) {
                setCurrentStep(2)
              }
            }}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-white'
            }`}>
              2
            </div>
            <span className="ml-2 font-medium">Select Products</span>
          </div>
          
          <div className="flex-1 h-0.5 bg-gray-300 mx-4" />
          
          <div 
            className={`flex items-center cursor-pointer ${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}
            onClick={() => {
              if (currentStep === 3) return
              if (currentStep === 2 && Object.keys(selectedProducts).length > 0) {
                initializeOrderProducts()
                setCurrentStep(3)
              }
            }}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-white'
            }`}>
              3
            </div>
            <span className="ml-2 font-medium">Order Details</span>
          </div>
        </div>
      </div>

      {/* Step 1: Basic Info */}
      {currentStep === 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Information</h2>
          
          {/* Order Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Order Name *
            </label>
            <input
              type="text"
              value={orderName}
              onChange={(e) => setOrderName(e.target.value)}
              placeholder='e.g., "Spring 2024 Collection" or "Holiday Drop"'
              className={inputClassName}
              required
            />
          </div>
          
          {/* Client and Manufacturer Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Client *
              </label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className={selectClassName}
                required
              >
                <option value="">Choose a client...</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Manufacturer *
                {manufacturers.length === 1 && (
                  <span className="ml-2 text-xs text-green-600">(Auto-selected)</span>
                )}
              </label>
              <select
                value={selectedManufacturer}
                onChange={(e) => setSelectedManufacturer(e.target.value)}
                className={selectClassName}
                required
              >
                {manufacturers.length > 1 && (
                  <option value="">Choose a manufacturer...</option>
                )}
                {manufacturers.map((manufacturer) => (
                  <option key={manufacturer.id} value={manufacturer.id}>
                    {manufacturer.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={nextStep}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select Products with Quantities */}
      {currentStep === 2 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Select Products & Quantities</h2>
            {getTotalProductsSelected() > 0 && (
              <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                Total: {getTotalProductsSelected()} product{getTotalProductsSelected() > 1 ? 's' : ''} selected
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div className="mb-4">
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search products by name..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products
              .filter(product => 
                product.title.toLowerCase().includes(productSearch.toLowerCase()) ||
                (product.description && product.description.toLowerCase().includes(productSearch.toLowerCase()))
              )
              .map((product) => (
              <div
                key={product.id}
                onClick={() => {
                  const currentQty = selectedProducts[product.id] || 0
                  handleProductQuantityChange(product.id, currentQty + 1)
                }}
                className={`border rounded-lg p-4 transition-all cursor-pointer select-none ${
                  selectedProducts[product.id] > 0
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-300 hover:border-gray-400 hover:shadow-md'
                }`}
              >
                <div className="relative">
                  {/* Quantity Badge */}
                  {selectedProducts[product.id] > 0 && (
                    <div className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                      {selectedProducts[product.id]}
                    </div>
                  )}
                  
                  <div className="mb-3">
                    <h3 className="font-semibold text-gray-900">{product.title}</h3>
                    {product.description && (
                      <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                    )}
                    {product.variants && product.variants.length > 0 && (
                      <div className="mt-2">
                        {product.variants.map((variant, idx) => (
                          <div key={idx} className="text-xs text-gray-500">
                            <span className="font-medium">{variant.type}:</span> {variant.options.join(', ')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tap Instructions or Remove Button */}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    {selectedProducts[product.id] > 0 ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-blue-600 font-medium">
                          Tap to add more
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleProductQuantityChange(product.id, 0)
                            showNotification('info', `${product.title} removed from order`)
                          }}
                          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium bg-red-50 px-2 py-1 rounded hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Remove
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">
                        Tap to add to order
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-between">
            <button
              onClick={prevStep}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </button>
            <button
              onClick={nextStep}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Order Details */}
      {currentStep === 3 && (
        <div>
          {/* Order Summary Info - Clean Card Design */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="border-b border-gray-200 pb-3 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{orderName}</h3>
              <p className="text-sm text-gray-500 mt-1">Order details and configuration</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Client Info */}
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Client</p>
                  <p className="font-semibold text-gray-900">
                    {clients.find(c => c.id === selectedClient)?.name || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {clients.find(c => c.id === selectedClient)?.email || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Manufacturer Info */}
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Manufacturer</p>
                  <p className="font-semibold text-gray-900">
                    {manufacturers.find(m => m.id === selectedManufacturer)?.name || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {manufacturers.find(m => m.id === selectedManufacturer)?.email || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Fill Tool */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-blue-900">Quick Fill Quantities</h3>
                <p className="text-sm text-blue-700">Distribute quantity evenly across all variants</p>
              </div>
              <div className="flex items-center gap-3">
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
                  className="w-40 px-3 py-2 border border-blue-300 rounded-lg text-gray-900 placeholder-gray-500"
                  min="0"
                />
                <button
                  onClick={handleQuickFill}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Distribute
                </button>
              </div>
            </div>
          </div>

          {/* Products */}
          {orderProducts.map((orderProduct, productIndex) => (
            <div key={productIndex} className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              {/* Product Header with Instance Number */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Package className="w-5 h-5 mr-2 text-blue-600" />
                    {orderProduct.product.title}
                    {orderProducts.filter(op => op.product.id === orderProduct.product.id).length > 1 && (
                      <span className="ml-2 text-sm text-gray-500">
                        (Instance {orderProducts.filter(op => op.product.id === orderProduct.product.id).indexOf(orderProduct) + 1} of {orderProducts.filter(op => op.product.id === orderProduct.product.id).length})
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Product order number will be assigned after creation
                  </p>
                </div>
                {/* Delete Product Button */}
                <button
                  onClick={() => {
                    if (orderProducts.length === 1) {
                      showNotification('error', 'Cannot remove the last product. Add another product first or go back to step 2.');
                      return;
                    }
                    const updatedProducts = orderProducts.filter((_, index) => index !== productIndex);
                    setOrderProducts(updatedProducts);
                    showNotification('info', `${orderProduct.product.title} removed from order`);
                  }}
                  className="p-2 text-red-500 hover:text-white hover:bg-red-500 rounded-lg transition-all group"
                  title="Remove this product from order"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Product Description - Single Line */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Description
                </label>
                <input
                  type="text"
                  value={orderProduct.productDescription}
                  onChange={(e) => updateProductField(productIndex, 'productDescription', e.target.value)}
                  placeholder="Enter brief product description..."
                  className={inputClassName}
                />
              </div>

              {/* Sample Request Section - Always Open at Top */}
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-300 mb-6">
                <h4 className="text-sm font-semibold text-amber-900 flex items-center mb-3">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Sample Request
                </h4>

                {/* Fields that will be filled by manufacturer - display only */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div className="opacity-60">
                    <label className="block text-xs font-medium text-amber-800 mb-1">
                      Sample Fee
                    </label>
                    <div className="relative">
                      <CreditCard className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-amber-600" />
                      <input
                        type="text"
                        placeholder="Set by manufacturer"
                        disabled
                        className="w-full pl-8 pr-3 py-2 border border-amber-200 rounded-lg bg-amber-50 text-gray-500"
                      />
                    </div>
                  </div>

                  <div className="opacity-60">
                    <label className="block text-xs font-medium text-amber-800 mb-1">
                      Sample ETA
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-amber-600" />
                      <input
                        type="text"
                        placeholder="Set by manufacturer"
                        disabled
                        className="w-full pl-8 pr-3 py-2 border border-amber-200 rounded-lg bg-amber-50 text-gray-500"
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
                      className="w-full px-3 py-2 border border-amber-200 rounded-lg bg-amber-50 text-gray-500"
                    />
                  </div>
                </div>

                {/* Sample Tech Pack Upload */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-amber-800 mb-1">
                    Technical Pack / Sample Media
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 cursor-pointer flex items-center text-sm">
                      <Upload className="w-4 h-4 mr-1" />
                      Upload Tech Pack
                      <input
                        type="file"
                        multiple
                        onChange={(e) => handleSampleFileUpload(productIndex, e.target.files)}
                        className="hidden"
                      />
                    </label>
                    {orderProduct.sampleMediaFiles.length > 0 && (
                      <span className="text-xs text-amber-700">
                        {orderProduct.sampleMediaFiles.length} file(s)
                      </span>
                    )}
                  </div>
                  {orderProduct.sampleMediaFiles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {orderProduct.sampleMediaFiles.map((file, fileIndex) => (
                        <div key={fileIndex} className="flex items-center gap-1 bg-amber-100 px-2 py-1 rounded text-xs">
                          <span className="text-amber-800">{file.name}</span>
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
                  <div className="flex items-center gap-4">
                    <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer flex items-center">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Files
                      <input
                        type="file"
                        multiple
                        onChange={(e) => handleFileUpload(productIndex, e.target.files)}
                        className="hidden"
                      />
                    </label>
                    {orderProduct.mediaFiles.length > 0 && (
                      <span className="text-sm text-gray-600">
                        {orderProduct.mediaFiles.length} file(s) selected
                      </span>
                    )}
                  </div>
                  {orderProduct.mediaFiles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {orderProduct.mediaFiles.map((file, fileIndex) => (
                        <div key={fileIndex} className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-lg">
                          <span className="text-sm text-gray-700">{file.name}</span>
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

                {/* Variants Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-4 text-sm font-medium text-gray-700" style={{width: '26%'}}>Variant</th>
                        <th className="text-left py-2 pl-5 pr-4 text-sm font-medium text-gray-700" style={{width: '10%'}}>Quantity</th>
                        <th className="text-left py-2 px-4 text-sm font-medium text-gray-700" style={{width: '64%'}}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderProduct.items.map((item, variantIndex) => (
                        <tr key={variantIndex} className="border-b border-gray-100">
                          <td className="py-2 px-4 text-sm text-gray-900">{item.variantCombo}</td>
                          <td className="py-2 pl-5 pr-4">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateVariantQuantity(productIndex, variantIndex, e.target.value)}
                              min="0"
                              className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-center text-gray-900"
                            />
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="text"
                              value={item.notes}
                              onChange={(e) => updateVariantNotes(productIndex, variantIndex, e.target.value)}
                              placeholder="Optional notes..."
                              className="w-full px-2 py-1 border border-gray-300 rounded-lg text-gray-900"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}

          {/* Action Buttons with Loading Spinners */}
          <div className="flex justify-between">
            <button
              onClick={prevStep}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </button>
            
            <div className="flex gap-3">
              <button
                onClick={() => handleSubmit(true)}
                disabled={saving}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                onClick={() => handleSubmit(false)}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          </div>
        </div>
      )}
    </div>
  )
}
