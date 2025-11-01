'use client'

import { useState, useEffect } from 'react'
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
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
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
    console.log('Available products:', products);
    
    const orderProds: OrderProduct[] = []
    
    Object.entries(selectedProducts).forEach(([productId, quantity]) => {
      const product = products.find(p => p.id === productId)
      
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
            
            product.variants![index].options.forEach(option => {
              generateCombos(index + 1, [...current, option])
            })
          }
          
          generateCombos(0, [])
        } else {
          variantCombos.push('No Variants')
        }
        
        orderProds.push({
          product,
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
    
    const newFiles = Array.from(files)
    setOrderProducts(prev => prev.map((op, idx) => 
      idx === productIndex 
        ? { ...op, mediaFiles: [...op.mediaFiles, ...newFiles] }
        : op
    ))
  }

  const handleSampleFileUpload = (productIndex: number, files: FileList | null) => {
    if (!files) return
    
    const newFiles = Array.from(files)
    setOrderProducts(prev => prev.map((op, idx) => 
      idx === productIndex 
        ? { ...op, sampleMediaFiles: [...op.sampleMediaFiles, ...newFiles] }
        : op
    ))
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
    console.log('=== STARTING ORDER SUBMISSION ===');
    console.log('orderProducts at submission time:', orderProducts);
    console.log('Number of products selected:', orderProducts.length);
    console.log('Products details:', orderProducts.map(op => ({
      productId: op.product?.id,
      productTitle: op.product?.title,
      hasItems: op.items?.length > 0,
      itemsWithQuantity: op.items?.filter(i => i.quantity > 0).length,
      fullProduct: op.product
    })));
    
    // Make sure we have products
    if (orderProducts.length === 0) {
      alert('No products in order! Please go back and select products.');
      setSaving(false);
      return;
    }
    
    setSaving(true)
    try {
      const userData = localStorage.getItem('user')
      const user = userData ? JSON.parse(userData) : null
      
      if (!user) {
        alert('User not found. Please login again.')
        return
      }

      // Generate order number
      const orderNumber = isDraft 
        ? `DRAFT-${Date.now().toString(36).toUpperCase()}`
        : `ORD-${Date.now().toString(36).toUpperCase()}`

      // Check if any product has sample information filled
      let hasSampleRequest = false
      for (const orderProduct of orderProducts) {
        if (orderProduct.sampleNotes || orderProduct.sampleMediaFiles.length > 0) {
          hasSampleRequest = true
          break
        }
      }

      // Determine the correct status
      let orderStatus = 'draft'
      if (!isDraft) {
        if (hasSampleRequest) {
          orderStatus = 'sample_requested'
        } else {
          orderStatus = 'submitted_to_manufacturer'
        }
      }

      // Create order with proper status
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          order_name: orderName,
          client_id: selectedClient,
          manufacturer_id: selectedManufacturer,
          status: orderStatus,
          created_by: user.id
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Create notification for manufacturer when order is submitted
      if (!isDraft) {
        const manufacturer = manufacturers.find(m => m.id === selectedManufacturer)
        const client = clients.find(c => c.id === selectedClient)
        
        // Create notification
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: selectedManufacturer,
            type: 'new_order',
            title: 'New Order Received',
            message: `You have received a new order ${orderNumber} from ${client?.name || 'Unknown Client'}`,
            metadata: {
              order_id: orderData.id,
              order_number: orderNumber,
              client_name: client?.name,
              status: 'submitted_to_manufacturer'
            },
            read: false
          })

        if (notificationError) {
          console.error('Error creating notification:', notificationError)
        }
      }

      // Create order products and items
      console.log('Starting to save products. Count:', orderProducts.length);
      console.log('Order products data:', orderProducts);
      
      for (const orderProduct of orderProducts) {
        // Generate a unique product order number
        const productOrderNumber = `PRD-${Date.now().toString(36).substring(2, 6).toUpperCase()}${Math.random().toString(36).substring(2, 4).toUpperCase()}`;
        
        // Create order_product - handle fields that might not exist in DB yet
        const orderProductData: any = {
          order_id: orderData.id,
          product_id: orderProduct.product.id,
          product_order_number: productOrderNumber,
          description: orderProduct.productDescription || '',  // Note: using 'description' not 'product_description'
        }

        // Add optional fields only if they have values
        if (orderProduct.standardPrice) {
          orderProductData.standard_price = parseFloat(orderProduct.standardPrice)
        }
        if (orderProduct.bulkPrice) {
          orderProductData.bulk_price = parseFloat(orderProduct.bulkPrice)
        }

        // Try to add sample fields - they might not exist in DB yet
        try {
          if (orderProduct.sampleRequired !== undefined) {
            orderProductData.sample_required = orderProduct.sampleRequired
          }
          if (orderProduct.sampleFee) {
            orderProductData.sample_fee = parseFloat(orderProduct.sampleFee)
          }
          if (orderProduct.sampleETA) {
            orderProductData.sample_eta = orderProduct.sampleETA
          }
          if (orderProduct.sampleStatus) {
            orderProductData.sample_status = orderProduct.sampleStatus
          }
          if (orderProduct.sampleNotes) {
            orderProductData.sample_notes = orderProduct.sampleNotes
          }
          if (orderProduct.shippingAirPrice) {
            orderProductData.shipping_air_price = parseFloat(orderProduct.shippingAirPrice)
          }
          if (orderProduct.shippingBoatPrice) {
            orderProductData.shipping_boat_price = parseFloat(orderProduct.shippingBoatPrice)
          }
          if (orderProduct.productionTime) {
            orderProductData.production_time = orderProduct.productionTime
          }
        } catch (e) {
          console.log('Some sample fields might not exist in database yet')
        }

        console.log('Attempting to insert order_product:', orderProductData);

        const { data: orderProductDataResult, error: productError } = await supabase
          .from('order_products')
          .insert(orderProductData)
          .select()
          .single()

        if (productError) {
          console.error('Error creating order product:', productError);
          console.error('Failed data:', orderProductData);
          // Don't continue silently - show the actual error
          alert(`Error saving product: ${productError.message}`);
          throw productError;
        }

        if (orderProductDataResult) {
          // Create order_items for each variant
          const itemsToInsert = orderProduct.items
            .filter(item => item.quantity > 0)
            .map(item => ({
              order_product_id: orderProductDataResult.id,
              variant_combo: item.variantCombo,
              quantity: item.quantity,
              notes: item.notes || null,
              admin_status: 'pending',
              manufacturer_status: 'pending'
            }))

          if (itemsToInsert.length > 0) {
            const { error: itemsError } = await supabase
              .from('order_items')
              .insert(itemsToInsert)

            if (itemsError) {
              console.error('Error creating order items:', itemsError)
            }
          }

          // Upload reference media files
          for (const file of orderProduct.mediaFiles) {
            const fileExt = file.name.split('.').pop()
            const fileName = `ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
            const filePath = `${orderData.id}/${orderProductDataResult.id}/${fileName}`

            const { error: uploadError } = await supabase.storage
              .from('order-media')
              .upload(filePath, file)

            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('order-media')
                .getPublicUrl(filePath)

              await supabase
                .from('order_media')
                .insert({
                  order_product_id: orderProductDataResult.id,
                  file_url: publicUrl,
                  file_type: 'reference_' + (file.type.startsWith('image/') ? 'image' : 'other'),
                  uploaded_by: user.id
                })
            }
          }

          // Upload sample media files
          for (const file of orderProduct.sampleMediaFiles) {
            const fileExt = file.name.split('.').pop()
            const fileName = `sample-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
            const filePath = `${orderData.id}/${orderProductDataResult.id}/${fileName}`

            const { error: uploadError } = await supabase.storage
              .from('order-media')
              .upload(filePath, file)

            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('order-media')
                .getPublicUrl(filePath)

              await supabase
                .from('order_media')
                .insert({
                  order_product_id: orderProductDataResult.id,
                  file_url: publicUrl,
                  file_type: 'sample_' + (file.type.startsWith('image/') ? 'image' : 'other'),
                  uploaded_by: user.id
                })
            }
          }
        }
      }

      // Log activity
      await supabase
        .from('audit_log')
        .insert({
          user_id: user.id,
          user_name: user.name,
          action_type: isDraft ? 'order_draft_created' : 'order_submitted',
          target_type: 'order',
          target_id: orderData.id,
          new_value: orderNumber
        })

      // Redirect to orders list
      router.push('/dashboard/orders')
    } catch (error) {
      console.error('Error creating order:', error)
      alert('Order created but some features might be missing. Please check the order details.')
      // Still try to navigate even if there were partial errors
      router.push('/dashboard/orders')
    } finally {
      setSaving(false)
    }
  }

  const nextStep = () => {
    if (currentStep === 1) {
      if (!orderName.trim()) {
        alert('Please enter an order name')
        return
      }
      if (!selectedClient || !selectedManufacturer) {
        alert('Please select both client and manufacturer')
        return
      }
      setCurrentStep(2)
    } else if (currentStep === 2) {
      if (Object.keys(selectedProducts).length === 0) {
        alert('Please select at least one product')
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
                          }}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          Remove all
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
                    Product Order Number: {orderProduct.productOrderNumber}
                  </p>
                </div>
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
                        accept="image/*,video/*,.pdf"
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
                        accept="image/*,video/*"
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

          {/* Action Buttons */}
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
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save as Draft'}
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Submitting...' : 'Submit Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}