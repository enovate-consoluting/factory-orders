'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, 
  Plus, 
  X, 
  Package,
  User,
  Building2,
  AlertCircle,
  Save,
  Send,
  FileText,
  Hash,
  Trash2,
  Upload,
  Image as ImageIcon,
  File,
  Download,
  Paperclip
} from 'lucide-react'

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

interface Product {
  id: string
  title: string
  description: string
}

interface ProductVariant {
  id: string
  product_id: string
  variant_option_id: string
  variant_option: {
    id: string
    value: string
    variant_type: {
      id: string
      name: string
    }
  }
}

interface OrderProduct {
  product: Product
  variants: ProductVariant[]
  items: { [key: string]: { quantity: number; notes: string } }
  uploadedFiles?: Array<{
    name: string
    type: string
    size: number
    file: File
    preview?: string
  }>
}

export default function CreateOrderPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [user, setUser] = useState<any>(null)
  
  // Form data
  const [orderName, setOrderName] = useState('')
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('')
  const [orderProducts, setOrderProducts] = useState<OrderProduct[]>([])
  
  // Lists
  const [clients, setClients] = useState<Client[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  
  // Product picker state
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<{ [key: string]: boolean }>({})
  const [searchTerm, setSearchTerm] = useState('')
  
  // Quick fill
  const [quickFillQuantity, setQuickFillQuantity] = useState('')

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (!userData) {
      router.push('/')
      return
    }
    setUser(JSON.parse(userData))
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    try {
      const [clientsRes, manufacturersRes, productsRes] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('manufacturers').select('*').order('name'),
        supabase.from('products').select('*').order('title')
      ])

      if (clientsRes.data) setClients(clientsRes.data)
      if (manufacturersRes.data) setManufacturers(manufacturersRes.data)
      if (productsRes.data) setProducts(productsRes.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  // Helper function to generate client prefix
  const getClientPrefix = (clientName: string) => {
    const words = clientName.trim().split(' ')
    if (words.length === 1) {
      return clientName.substring(0, 3).toUpperCase()
    } else {
      return words.slice(0, 3).map(w => w[0]).join('').toUpperCase()
    }
  }

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }))
  }

  const addSelectedProducts = async () => {
    const selectedIds = Object.keys(selectedProducts).filter(id => selectedProducts[id])
    
    for (const productId of selectedIds) {
      const product = products.find(p => p.id === productId)
      if (!product) continue

      // Check if product already added
      if (orderProducts.some(op => op.product.id === productId)) continue

      // Fetch variants for this product
      const { data: variantsData, error } = await supabase
        .from('product_variants')
        .select(`
          id,
          product_id,
          variant_option_id,
          variant_option:variant_options (
            id,
            value,
            variant_type:variant_types (
              id,
              name
            )
          )
        `)
        .eq('product_id', productId)

      if (error) {
        console.error('Error fetching variants:', error)
        continue
      }

      // Group variants by type
      const variantsByType: { [key: string]: any[] } = {}
      variantsData?.forEach(variant => {
        const typeName = variant.variant_option?.variant_type?.name
        if (typeName && !variantsByType[typeName]) {
          variantsByType[typeName] = []
        }
        if (typeName) {
          variantsByType[typeName].push(variant.variant_option)
        }
      })

      // Generate all combinations
      const items: { [key: string]: { quantity: number; notes: string } } = {}
      const generateCombinations = (types: string[], index: number = 0, current: string[] = []) => {
        if (index === types.length) {
          const key = current.join(', ')
          items[key] = { quantity: 0, notes: '' }
          return
        }

        const typeName = types[index]
        variantsByType[typeName].forEach(option => {
          generateCombinations(types, index + 1, [...current, `${typeName}: ${option.value}`])
        })
      }

      const typeNames = Object.keys(variantsByType)
      if (typeNames.length > 0) {
        generateCombinations(typeNames)
      } else {
        items['No variants'] = { quantity: 0, notes: '' }
      }

      setOrderProducts(prev => [...prev, { product, variants: variantsData || [], items }])
    }

    setSelectedProducts({})
    setShowProductPicker(false)
  }

  const removeProduct = (index: number) => {
    setOrderProducts(orderProducts.filter((_, i) => i !== index))
  }

  const handleFileUpload = (productIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const updated = [...orderProducts]
    if (!updated[productIndex].uploadedFiles) {
      updated[productIndex].uploadedFiles = []
    }

    Array.from(files).forEach(file => {
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        file: file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      }
      updated[productIndex].uploadedFiles!.push(fileData)
    })

    setOrderProducts(updated)
  }

  const removeFile = (productIndex: number, fileIndex: number) => {
    const updated = [...orderProducts]
    if (updated[productIndex].uploadedFiles) {
      // Clean up preview URL if it exists
      const file = updated[productIndex].uploadedFiles![fileIndex]
      if (file.preview) {
        URL.revokeObjectURL(file.preview)
      }
      updated[productIndex].uploadedFiles!.splice(fileIndex, 1)
    }
    setOrderProducts(updated)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="w-4 h-4" />
    if (fileType.includes('pdf')) return <FileText className="w-4 h-4" />
    if (fileType.includes('doc') || fileType.includes('docx')) return <FileText className="w-4 h-4" />
    if (fileType.includes('xls') || fileType.includes('xlsx')) return <FileText className="w-4 h-4" />
    return <File className="w-4 h-4" />
  }

  const updateItemQuantity = (productIndex: number, itemKey: string, quantity: string) => {
    const updated = [...orderProducts]
    updated[productIndex].items[itemKey].quantity = parseInt(quantity) || 0
    setOrderProducts(updated)
  }

  const updateItemNotes = (productIndex: number, itemKey: string, notes: string) => {
    const updated = [...orderProducts]
    updated[productIndex].items[itemKey].notes = notes
    setOrderProducts(updated)
  }

  const applyQuickFill = (productIndex: number) => {
    if (!quickFillQuantity) return
    
    const updated = [...orderProducts]
    Object.keys(updated[productIndex].items).forEach(key => {
      updated[productIndex].items[key].quantity = parseInt(quickFillQuantity) || 0
    })
    setOrderProducts(updated)
  }

  const generateOrderNumber = async (isDraft: boolean, clientId: string) => {
    // Get client name for prefix
    const client = clients.find(c => c.id === clientId)
    if (!client) return null

    const clientPrefix = getClientPrefix(client.name)
    
    // Get the latest order number to generate the next one
    const { data: lastOrder } = await supabase
      .from('orders')
      .select('order_number')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let nextNumber = 1
    if (lastOrder?.order_number) {
      // Extract the number part from the last order
      const matches = lastOrder.order_number.match(/\d+/)
      if (matches) {
        nextNumber = parseInt(matches[0]) + 1
      }
    }

    const paddedNumber = nextNumber.toString().padStart(6, '0')
    
    // Generate order number with client prefix (no duplication)
    if (isDraft) {
      return `DRAFT-${clientPrefix}-${paddedNumber}`
    } else {
      return `${clientPrefix}-${paddedNumber}`
    }
  }

  const saveOrder = async (isDraft: boolean = false) => {
    if (!selectedClient || !selectedManufacturer) {
      alert('Please select client and manufacturer')
      return
    }

    if (!orderName.trim()) {
      alert('Please enter an order name')
      return
    }

    if (orderProducts.length === 0) {
      alert('Please add at least one product')
      return
    }

    setLoading(true)
    try {
      // Generate order number with client prefix
      const orderNumber = await generateOrderNumber(isDraft, selectedClient)
      if (!orderNumber) {
        throw new Error('Failed to generate order number')
      }

      // Create the order with order_name field
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          order_name: orderName.trim(), // Save the order name
          client_id: selectedClient,
          manufacturer_id: selectedManufacturer,
          status: isDraft ? 'draft' : 'submitted_to_manufacturer',
          created_by: user.id
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Create order products and items
      for (const orderProduct of orderProducts) {
        const { data: createdProduct, error: productError } = await supabase
          .from('order_products')
          .insert({
            order_id: order.id,
            product_id: orderProduct.product.id,
            product_order_number: `PRD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
          })
          .select()
          .single()

        if (productError) throw productError

        // Upload files if any
        if (orderProduct.uploadedFiles && orderProduct.uploadedFiles.length > 0) {
          for (const fileData of orderProduct.uploadedFiles) {
            const fileExt = fileData.name.split('.').pop()
            const fileName = `ref-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
            const filePath = `${order.id}/${createdProduct.id}/${fileName}`

            // Upload to storage
            const { error: uploadError } = await supabase.storage
              .from('order-media')
              .upload(filePath, fileData.file)

            if (uploadError) {
              console.error('Error uploading file:', uploadError)
              continue
            }

            // Save file reference in database
            const { error: dbError } = await supabase
              .from('order_media')
              .insert({
                order_product_id: createdProduct.id,
                file_url: filePath,
                file_type: fileData.type.startsWith('image/') ? 'image' : 'document',
                uploaded_by: user.id
              })

            if (dbError) {
              console.error('Error saving file reference:', dbError)
            }
          }
        }

        // Create order items
        const itemsToInsert = Object.entries(orderProduct.items)
          .filter(([_, item]) => item.quantity > 0)
          .map(([variantCombo, item]) => ({
            order_product_id: createdProduct.id,
            variant_combo: variantCombo,
            quantity: item.quantity,
            notes: item.notes
          }))

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(itemsToInsert)

          if (itemsError) throw itemsError
        }
      }

      router.push('/dashboard/orders')
    } catch (error) {
      console.error('Error saving order:', error)
      alert('Failed to save order')
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    if (step === 1) {
      return selectedClient && selectedManufacturer && orderName.trim()
    }
    if (step === 2) {
      return orderProducts.length > 0
    }
    if (step === 3) {
      return orderProducts.length > 0  // Allow saving in step 3 if there are products
    }
    return false
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <button
            onClick={() => router.push('/dashboard/orders')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Orders
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Create New Order</h1>
        </div>

        {/* Progress Steps */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center justify-between">
            <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm ${
                step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>
                1
              </div>
              <span className="ml-1 sm:ml-2 text-xs sm:text-sm font-medium hidden sm:inline">Order Details</span>
            </div>
            <div className={`flex-1 h-1 mx-2 sm:mx-4 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm ${
                step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>
                2
              </div>
              <span className="ml-1 sm:ml-2 text-xs sm:text-sm font-medium hidden sm:inline">Add Products</span>
            </div>
            <div className={`flex-1 h-1 mx-2 sm:mx-4 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`flex items-center ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm ${
                step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>
                3
              </div>
              <span className="ml-1 sm:ml-2 text-xs sm:text-sm font-medium hidden sm:inline">Review</span>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Order Information
              </h2>
              
              {/* Order Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Order Name *
                </label>
                <input
                  type="text"
                  value={orderName}
                  onChange={(e) => setOrderName(e.target.value)}
                  placeholder="e.g., Summer Collection 2024, Nike Shirts Order"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 placeholder-gray-400"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Give your order a descriptive name for easy reference
                </p>
              </div>

              {/* Client and Manufacturer side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="w-4 h-4 inline mr-1" />
                    Select Client *
                  </label>
                  <select
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
                  >
                    <option value="" className="text-gray-500">Choose a client...</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id} className="text-gray-700">
                        {client.name} ({getClientPrefix(client.name)})
                      </option>
                    ))}
                  </select>
                  {selectedClient && (
                    <p className="text-xs text-gray-500 mt-1">
                      Order ID prefix: {getClientPrefix(clients.find(c => c.id === selectedClient)?.name || '')}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Building2 className="w-4 h-4 inline mr-1" />
                    Select Manufacturer *
                  </label>
                  <select
                    value={selectedManufacturer}
                    onChange={(e) => setSelectedManufacturer(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
                  >
                    <option value="" className="text-gray-500">Choose a manufacturer...</option>
                    {manufacturers.map(manufacturer => (
                      <option key={manufacturer.id} value={manufacturer.id} className="text-gray-700">
                        {manufacturer.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Package className="w-5 h-5 mr-2 text-blue-600" />
                Add Products to Order
              </h2>

              <div>
                <button
                  onClick={() => setShowProductPicker(true)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Select Products
                </button>
              </div>

              {/* Quick Fill */}
              {orderProducts.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block">
                        Quick Fill Quantity
                      </label>
                      <p className="text-xs text-gray-600">Apply same quantity to all variants</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={quickFillQuantity}
                      onChange={(e) => setQuickFillQuantity(e.target.value)}
                      placeholder="Enter quantity"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                    />
                    <span className="text-sm text-gray-600">units</span>
                  </div>
                </div>
              )}

              {/* Products List */}
              <div className="space-y-4">
                {orderProducts.map((orderProduct, productIndex) => (
                  <div key={productIndex} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">{orderProduct.product.title}</h3>
                        {orderProduct.product.description && (
                          <p className="text-sm text-gray-600 mt-1">{orderProduct.product.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeProduct(productIndex)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* File Upload Section */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-700 flex items-center">
                          <Paperclip className="w-4 h-4 mr-2" />
                          Reference Documents
                        </h4>
                        <label className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer flex items-center">
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Files
                          <input
                            type="file"
                            multiple
                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
                            onChange={(e) => handleFileUpload(productIndex, e)}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {/* Uploaded Files List */}
                      {orderProduct.uploadedFiles && orderProduct.uploadedFiles.length > 0 && (
                        <div className="space-y-2 mt-3">
                          {orderProduct.uploadedFiles.map((file, fileIndex) => (
                            <div key={fileIndex} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                              <div className="flex items-center space-x-2 flex-1">
                                <div className="text-gray-500">
                                  {getFileIcon(file.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-900 truncate">{file.name}</p>
                                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                                </div>
                              </div>
                              {file.preview && (
                                <img 
                                  src={file.preview} 
                                  alt="Preview" 
                                  className="w-10 h-10 object-cover rounded ml-2"
                                />
                              )}
                              <button
                                onClick={() => removeFile(productIndex, fileIndex)}
                                className="ml-2 text-red-500 hover:text-red-700 p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {(!orderProduct.uploadedFiles || orderProduct.uploadedFiles.length === 0) && (
                        <p className="text-sm text-gray-500 mt-2">
                          No files uploaded. You can add images, PDFs, Word docs, or Excel files.
                        </p>
                      )}
                    </div>

                    {quickFillQuantity && (
                      <button
                        onClick={() => applyQuickFill(productIndex)}
                        className="mb-3 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 flex items-center space-x-2 text-sm font-medium shadow-sm hover:shadow-md"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6M12 9v6" />
                        </svg>
                        <span>Apply Quick Fill ({quickFillQuantity} units)</span>
                      </button>
                    )}

                    <div className="space-y-2">
                      {Object.entries(orderProduct.items).map(([variantCombo, item]) => (
                        <div key={variantCombo} className="flex flex-col sm:grid sm:grid-cols-12 gap-2 items-start sm:items-center p-2 bg-gray-50 rounded">
                          <div className="w-full sm:col-span-4 text-sm text-gray-700 font-medium">
                            {variantCombo}
                          </div>
                          <div className="w-full sm:col-span-3">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItemQuantity(productIndex, variantCombo, e.target.value)}
                              placeholder="Quantity"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-700 placeholder-gray-400"
                              min="0"
                            />
                          </div>
                          <div className="w-full sm:col-span-5">
                            <input
                              type="text"
                              value={item.notes}
                              onChange={(e) => updateItemNotes(productIndex, variantCombo, e.target.value)}
                              placeholder="Notes (optional)"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-600 placeholder-gray-400"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {orderProducts.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>No products added yet. Click "Add Products" above to get started.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Review Order</h2>
              
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <Hash className="w-4 h-4 mr-2 text-blue-600" />
                    Order Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Order Name:</span>
                      <span className="ml-2 font-medium text-gray-900">{orderName}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Client:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {clients.find(c => c.id === selectedClient)?.name}
                      </span>
                      <span className="ml-2 text-gray-500">
                        (Prefix: {getClientPrefix(clients.find(c => c.id === selectedClient)?.name || '')})
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Manufacturer:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {manufacturers.find(m => m.id === selectedManufacturer)?.name}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-3">Products ({orderProducts.length})</h3>
                  {orderProducts.map((orderProduct, index) => {
                    const totalQuantity = Object.values(orderProduct.items)
                      .reduce((sum, item) => sum + item.quantity, 0)
                    const variantCount = Object.keys(orderProduct.items).length
                    const fileCount = orderProduct.uploadedFiles?.length || 0

                    return (
                      <div key={index} className="mb-3 pb-3 border-b border-gray-200 last:border-0">
                        <div className="font-medium text-gray-900">{orderProduct.product.title}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {variantCount} variants, Total quantity: {totalQuantity} units
                        </div>
                        {fileCount > 0 && (
                          <div className="text-sm text-gray-600 mt-1 flex items-center">
                            <Paperclip className="w-3 h-3 mr-1" />
                            {fileCount} file{fileCount !== 1 ? 's' : ''} attached
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200">
            <div className="order-2 sm:order-1">
              {step > 1 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Previous
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 order-1 sm:order-2">
              {step === 3 && (
                <button
                  onClick={() => saveOrder(true)}
                  disabled={loading || !canProceed()}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save as Draft
                </button>
              )}

              {step < 3 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={!canProceed()}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={() => saveOrder(false)}
                  disabled={loading || !canProceed()}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Create Order
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Product Picker Modal - Compact and beautiful design */}
        {showProductPicker && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
              {/* Compact Header */}
              <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold text-gray-800">Select Products</h2>
                  <span className="text-sm text-gray-500">
                    {Object.keys(selectedProducts).filter(id => selectedProducts[id]).length} selected
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowProductPicker(false)
                    setSelectedProducts({})
                  }}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Compact Search bar */}
              <div className="px-4 py-2 border-b border-gray-100">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              {/* Product Grid - Compact cards */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2">
                  {products
                    .filter(product => 
                      product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
                    )
                    .map(product => {
                      const isSelected = !!selectedProducts[product.id]
                      const isAlreadyAdded = orderProducts.some(op => op.product.id === product.id)
                      
                      return (
                        <div
                          key={product.id}
                          onClick={() => {
                            if (!isAlreadyAdded) {
                              toggleProductSelection(product.id)
                            }
                          }}
                          className={`relative p-2 sm:p-3 rounded-lg border transition-all ${
                            isAlreadyAdded
                              ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                              : `cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-50 border-blue-400'
                                    : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                }`
                          }`}
                        >
                          {/* Selected indicator */}
                          {isSelected && !isAlreadyAdded && (
                            <div className="absolute top-1.5 right-1.5">
                              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            </div>
                          )}
                          
                          {/* Already added indicator */}
                          {isAlreadyAdded && (
                            <div className="absolute top-1.5 right-1.5">
                              <div className="text-xs bg-gray-500 text-white px-1.5 py-0.5 rounded">Added</div>
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
              <div className="px-4 py-3 border-t border-gray-200 flex justify-between">
                <button
                  onClick={() => {
                    setShowProductPicker(false)
                    setSelectedProducts({})
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={addSelectedProducts}
                  disabled={Object.keys(selectedProducts).filter(id => selectedProducts[id]).length === 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add {Object.keys(selectedProducts).filter(id => selectedProducts[id]).length > 0 && 
                       `(${Object.keys(selectedProducts).filter(id => selectedProducts[id]).length})`} Products
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}