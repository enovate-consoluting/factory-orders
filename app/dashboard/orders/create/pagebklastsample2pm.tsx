'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, ArrowRight, Plus, Trash2, Upload, X, Package, DollarSign, FileText, Tag } from 'lucide-react'

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
  sampleRequired: boolean
  sampleNotes: string
  sampleQuantity: string
  items: {
    variantCombo: string
    quantity: number
    notes: string
  }[]
  mediaFiles: File[]
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
  const [clients, setClients] = useState<Client[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedManufacturer, setSelectedManufacturer] = useState('')
  
  // Step 2: Products
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  
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

  const handleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId)
      }
      return [...prev, productId]
    })
  }

  const initializeOrderProducts = () => {
    const orderProds: OrderProduct[] = selectedProducts.map(productId => {
      const product = products.find(p => p.id === productId)!
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
      
      return {
        product,
        productOrderNumber,
        productDescription: '',
        standardPrice: '',
        bulkPrice: '',
        sampleRequired: false,
        sampleNotes: '',
        sampleQuantity: '1',
        items: variantCombos.map(combo => ({
          variantCombo: combo,
          quantity: 0,
          notes: ''
        })),
        mediaFiles: []
      }
    })
    
    setOrderProducts(orderProds)
  }

  const handleQuickFill = () => {
    const qty = parseInt(quickFillQuantity)
    if (!isNaN(qty) && qty > 0) {
      setOrderProducts(prev => prev.map(op => ({
        ...op,
        items: op.items.map(item => ({
          ...item,
          quantity: qty
        }))
      })))
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

  const removeFile = (productIndex: number, fileIndex: number) => {
    setOrderProducts(prev => prev.map((op, idx) => {
      if (idx === productIndex) {
        const newFiles = op.mediaFiles.filter((_, i) => i !== fileIndex)
        return { ...op, mediaFiles: newFiles }
      }
      return op
    }))
  }

  const handleSubmit = async (isDraft = false) => {
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

      // Create order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          client_id: selectedClient,
          manufacturer_id: selectedManufacturer,
          status: isDraft ? 'draft' : 'submitted',
          created_by: user.id
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Create order products and items
      for (const orderProduct of orderProducts) {
        // Create order_product
        const { data: orderProductData, error: productError } = await supabase
          .from('order_products')
          .insert({
            order_id: orderData.id,
            product_id: orderProduct.product.id,
            product_order_number: orderProduct.productOrderNumber,
            product_description: orderProduct.productDescription,
            standard_price: orderProduct.standardPrice || null,
            bulk_price: orderProduct.bulkPrice || null,
            sample_required: orderProduct.sampleRequired,
            sample_notes: orderProduct.sampleNotes || null,
            sample_quantity: orderProduct.sampleQuantity ? parseInt(orderProduct.sampleQuantity) : null
          })
          .select()
          .single()

        if (productError) throw productError

        // Create order_items for each variant
        const itemsToInsert = orderProduct.items
          .filter(item => item.quantity > 0)
          .map(item => ({
            order_product_id: orderProductData.id,
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

          if (itemsError) throw itemsError
        }

        // Upload media files
        for (const file of orderProduct.mediaFiles) {
          const fileExt = file.name.split('.').pop()
          const fileName = `ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
          const filePath = `${orderData.id}/${orderProductData.id}/${fileName}`

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
                order_product_id: orderProductData.id,
                file_url: publicUrl,
                file_type: file.type.startsWith('image/') ? 'image' : 'other',
                uploaded_by: user.id
              })
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

      router.push(`/dashboard/orders/${orderData.id}`)
    } catch (error) {
      console.error('Error creating order:', error)
      alert('Failed to create order. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const nextStep = () => {
    if (currentStep === 1) {
      if (!selectedClient || !selectedManufacturer) {
        alert('Please select both client and manufacturer')
        return
      }
      setCurrentStep(2)
    } else if (currentStep === 2) {
      if (selectedProducts.length === 0) {
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
        <div className="mt-6 flex items-center justify-between max-w-2xl">
          <div className={`flex items-center ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-white'
            }`}>
              1
            </div>
            <span className="ml-2 font-medium">Basic Info</span>
          </div>
          
          <div className="flex-1 h-0.5 bg-gray-300 mx-4" />
          
          <div className={`flex items-center ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-white'
            }`}>
              2
            </div>
            <span className="ml-2 font-medium">Select Products</span>
          </div>
          
          <div className="flex-1 h-0.5 bg-gray-300 mx-4" />
          
          <div className={`flex items-center ${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
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
              </label>
              <select
                value={selectedManufacturer}
                onChange={(e) => setSelectedManufacturer(e.target.value)}
                className={selectClassName}
                required
              >
                <option value="">Choose a manufacturer...</option>
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

      {/* Step 2: Select Products */}
      {currentStep === 2 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Products</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <div
                key={product.id}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedProducts.includes(product.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onClick={() => handleProductSelection(product.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
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
                  <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                    selectedProducts.includes(product.id)
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-gray-300'
                  }`}>
                    {selectedProducts.includes(product.id) && (
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
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
          {/* Quick Fill Tool */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-blue-900">Quick Fill Quantities</h3>
                <p className="text-sm text-blue-700">Set the same quantity for all variants</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={quickFillQuantity}
                  onChange={(e) => setQuickFillQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  className="w-32 px-3 py-2 border border-blue-300 rounded-lg text-gray-900"
                />
                <button
                  onClick={handleQuickFill}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Apply to All
                </button>
              </div>
            </div>
          </div>

          {/* Products */}
          {orderProducts.map((orderProduct, productIndex) => (
            <div key={productIndex} className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              {/* Product Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Package className="w-5 h-5 mr-2 text-blue-600" />
                    {orderProduct.product.title}
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

              {/* Pricing Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <label className="flex items-center text-sm font-medium text-green-900 mb-2">
                    <DollarSign className="w-4 h-4 mr-1" />
                    Standard Price
                  </label>
                  <input
                    type="text"
                    value={orderProduct.standardPrice}
                    onChange={(e) => updateProductField(productIndex, 'standardPrice', e.target.value)}
                    placeholder="Enter standard price..."
                    className="w-full px-3 py-2 border border-green-300 rounded-lg text-gray-900"
                  />
                </div>

                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <label className="flex items-center text-sm font-medium text-yellow-900 mb-2">
                    <Tag className="w-4 h-4 mr-1" />
                    Bulk Price
                  </label>
                  <input
                    type="text"
                    value={orderProduct.bulkPrice}
                    onChange={(e) => updateProductField(productIndex, 'bulkPrice', e.target.value)}
                    placeholder="Enter bulk price..."
                    className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-gray-900"
                  />
                </div>
              </div>

              {/* Sample Section */}
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center text-sm font-medium text-purple-900">
                    <input
                      type="checkbox"
                      checked={orderProduct.sampleRequired}
                      onChange={(e) => updateProductField(productIndex, 'sampleRequired', e.target.checked)}
                      className="mr-2"
                    />
                    Sample Required
                  </label>
                  {orderProduct.sampleRequired && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-purple-700">Quantity:</span>
                      <input
                        type="number"
                        value={orderProduct.sampleQuantity}
                        onChange={(e) => updateProductField(productIndex, 'sampleQuantity', e.target.value)}
                        min="1"
                        className="w-20 px-2 py-1 border border-purple-300 rounded text-gray-900"
                      />
                    </div>
                  )}
                </div>
                {orderProduct.sampleRequired && (
                  <div>
                    <label className="block text-sm font-medium text-purple-900 mb-1">
                      Sample Notes
                    </label>
                    <textarea
                      value={orderProduct.sampleNotes}
                      onChange={(e) => updateProductField(productIndex, 'sampleNotes', e.target.value)}
                      placeholder="Enter sample requirements, specifications, or notes..."
                      rows={2}
                      className="w-full px-3 py-2 border border-purple-300 rounded-lg text-gray-900"
                    />
                  </div>
                )}
              </div>

              {/* Media Upload */}
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
                      <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Variant</th>
                      <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">Quantity</th>
                      <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderProduct.items.map((item, variantIndex) => (
                      <tr key={variantIndex} className="border-b border-gray-100">
                        <td className="py-2 px-4 text-sm text-gray-900">{item.variantCombo}</td>
                        <td className="py-2 px-4">
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