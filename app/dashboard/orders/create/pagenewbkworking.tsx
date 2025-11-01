'use client'

import { useState, useEffect, useRef } from 'react'
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
  Paperclip,
  Search
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

interface SelectedProductVariant {
  productId: string
  productTitle: string
  variants: { [key: string]: string }
  variantString: string
  quantity: number
  notes: string
}

interface OrderProduct {
  id: string
  title: string
  description?: string
  variants: SelectedProductVariant[]
  media: File[]
  mediaPreviews: string[]
  quantity?: number
}

export default function CreateOrderPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [user, setUser] = useState<any>(null)
  const clientDropdownRef = useRef<HTMLDivElement>(null)
  
  // Form data
  const [orderName, setOrderName] = useState('')
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('')
  const [orderProducts, setOrderProducts] = useState<any[]>([])
  
  // Lists
  const [clients, setClients] = useState<Client[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  
  // Product picker state
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<{ [key: string]: boolean }>({})
  const [productQuantities, setProductQuantities] = useState<{ [key: string]: number }>({})
  const [searchTerm, setSearchTerm] = useState('')
  
  // Quick fill
  const [quickFill, setQuickFill] = useState('')
  const [showNotification, setShowNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')
  
  // Client search states
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [filteredClients, setFilteredClients] = useState<Client[]>([])

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (!userData) {
      router.push('/')
      return
    }
    setUser(JSON.parse(userData))
    fetchInitialData()
  }, [])

  // Auto-select manufacturer if only one
  useEffect(() => {
    if (manufacturers.length === 1 && !selectedManufacturer) {
      setSelectedManufacturer(manufacturers[0].id)
    }
  }, [manufacturers])

  // Filter clients based on search
  useEffect(() => {
    if (clientSearch) {
      const filtered = clients.filter(client =>
        client.name.toLowerCase().includes(clientSearch.toLowerCase())
      )
      setFilteredClients(filtered)
    } else {
      setFilteredClients(clients)
    }
  }, [clientSearch, clients])

  // Handle click outside for client dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchInitialData = async () => {
    try {
      const [clientsRes, manufacturersRes, productsRes] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('manufacturers').select('*').order('name'),
        supabase.from('products').select('*').order('title')
      ])

      if (clientsRes.data) {
        setClients(clientsRes.data)
        setFilteredClients(clientsRes.data)
      }
      if (manufacturersRes.data) {
        setManufacturers(manufacturersRes.data)
        // Auto-select if only one manufacturer
        if (manufacturersRes.data.length === 1) {
          setSelectedManufacturer(manufacturersRes.data[0].id)
        }
      }
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

  const handleSelectClient = (clientId: string, clientName: string) => {
    setSelectedClient(clientId)
    setClientSearch(clientName)
    setShowClientDropdown(false)
  }

  const handleProductQuantityChange = (productId: string, quantity: number) => {
    if (quantity < 0) return
    setProductQuantities(prev => ({
      ...prev,
      [productId]: quantity
    }))
  }

  const addSelectedProducts = async () => {
    const selectedWithQuantity = Object.keys(productQuantities).filter(id => productQuantities[id] > 0)
    
    if (selectedWithQuantity.length === 0) {
      setNotificationMessage('Please select products with quantities')
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 3000)
      return
    }

    for (const productId of selectedWithQuantity) {
      const product = products.find(p => p.id === productId)
      if (!product) continue

      const quantity = productQuantities[productId] || 1

      // Add multiple instances of the same product
      for (let i = 0; i < quantity; i++) {
        const { data: variants } = await supabase
          .from('product_variants')
          .select(`
            id,
            product_id,
            variant_option_id,
            variant_option:variant_options!inner (
              id,
              value,
              variant_type:variant_types!inner (
                id,
                name
              )
            )
          `)
          .eq('product_id', productId)

        if (!variants || variants.length === 0) {
          setOrderProducts(prev => [...prev, {
            id: `${productId}-${Date.now()}-${i}`,
            product,
            variants: [{
              combination: 'Standard',
              quantity: 0,
              notes: ''
            }],
            files: [],
            description: ''
          }])
        } else {
          const groupedVariants: { [key: string]: any[] } = {}
          variants.forEach(v => {
            const typeName = v.variant_option.variant_type.name
            if (!groupedVariants[typeName]) {
              groupedVariants[typeName] = []
            }
            groupedVariants[typeName].push(v.variant_option)
          })

          const combinations = generateVariantCombinations(groupedVariants)
          
          setOrderProducts(prev => [...prev, {
            id: `${productId}-${Date.now()}-${i}`,
            product,
            variants: combinations.map(combo => ({
              combination: combo,
              quantity: 0,
              notes: ''
            })),
            files: [],
            description: ''
          }])
        }
      }
    }

    setShowProductPicker(false)
    setProductQuantities({})
    setSelectedProducts({})
    setNotificationMessage('Products added successfully')
    setShowNotification(true)
    setTimeout(() => setShowNotification(false), 3000)
  }

  const generateVariantCombinations = (groupedVariants: { [key: string]: any[] }) => {
    const types = Object.keys(groupedVariants)
    const combinations: string[] = []

    const generate = (index: number, current: string[]) => {
      if (index === types.length) {
        combinations.push(current.join(' / '))
        return
      }

      const type = types[index]
      for (const option of groupedVariants[type]) {
        generate(index + 1, [...current, option.value])
      }
    }

    generate(0, [])
    return combinations
  }

  const applyQuickFill = () => {
    if (!quickFill || parseFloat(quickFill) <= 0) {
      setNotificationMessage('Please enter a valid quantity')
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 3000)
      return
    }

    const totalUnits = parseFloat(quickFill)
    
    // Apply to EACH product individually
    setOrderProducts(prev => prev.map(product => {
      const variantCount = product.variants.length
      const unitsPerVariant = Math.floor(totalUnits / variantCount)
      const remainder = totalUnits % variantCount

      return {
        ...product,
        variants: product.variants.map((variant: any, index: number) => ({
          ...variant,
          quantity: unitsPerVariant + (index < remainder ? 1 : 0)
        }))
      }
    }))

    setNotificationMessage(`Applied ${totalUnits} units to each product`)
    setShowNotification(true)
    setTimeout(() => setShowNotification(false), 3000)
  }

  const handleFileUpload = (productId: string, files: FileList) => {
    const fileArray = Array.from(files)
    setOrderProducts(prev => prev.map(p => 
      p.id === productId 
        ? { ...p, files: [...p.files, ...fileArray] }
        : p
    ))
  }

  const removeFile = (productId: string, fileIndex: number) => {
    setOrderProducts(prev => prev.map(p => 
      p.id === productId 
        ? { ...p, files: p.files.filter((_: any, i: number) => i !== fileIndex) }
        : p
    ))
  }

  const removeProduct = (productId: string) => {
    setOrderProducts(prev => prev.filter(p => p.id !== productId))
  }

  const updateProductDescription = (productId: string, description: string) => {
    setOrderProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, description } : p
    ))
  }

  const updateVariantQuantity = (productId: string, variantIndex: number, quantity: number) => {
    if (quantity < 0) return
    setOrderProducts(prev => prev.map(p => 
      p.id === productId 
        ? {
            ...p,
            variants: p.variants.map((v: any, i: number) => 
              i === variantIndex ? { ...v, quantity } : v
            )
          }
        : p
    ))
  }

  const updateVariantNotes = (productId: string, variantIndex: number, notes: string) => {
    setOrderProducts(prev => prev.map(p => 
      p.id === productId 
        ? {
            ...p,
            variants: p.variants.map((v: any, i: number) => 
              i === variantIndex ? { ...v, notes } : v
            )
          }
        : p
    ))
  }

  const getTotalQuantity = () => {
    return orderProducts.reduce((sum, product) => 
      sum + product.variants.reduce((vSum: number, v: any) => vSum + (v.quantity || 0), 0), 0
    )
  }

  const saveOrder = async (isDraft = false) => {
    setLoading(true)
    
    try {
      const clientName = clients.find(c => c.id === selectedClient)?.name || ''
      const orderNumber = isDraft 
        ? `DRAFT-${Math.floor(100000 + Math.random() * 900000)}`
        : `${getClientPrefix(clientName)}-${Math.floor(100000 + Math.random() * 900000)}`

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          order_name: orderName || null,
          client_id: selectedClient,
          manufacturer_id: selectedManufacturer,
          status: isDraft ? 'draft' : 'submitted',
          created_by: user?.id
        })
        .select()
        .single()

      if (orderError) throw orderError

      for (const orderProduct of orderProducts) {
        const productOrderNumber = `PRD-${Math.floor(1000 + Math.random() * 9000)}`
        
        const { data: orderProductData, error: orderProductError } = await supabase
          .from('order_products')
          .insert({
            order_id: order.id,
            product_id: orderProduct.product.id,
            product_order_number: productOrderNumber,
            description: orderProduct.description || null
          })
          .select()
          .single()

        if (orderProductError) throw orderProductError

        for (const variant of orderProduct.variants) {
          if (variant.quantity > 0 || isDraft) {
            await supabase
              .from('order_items')
              .insert({
                order_product_id: orderProductData.id,
                variant_combo: variant.combination,
                quantity: variant.quantity,
                notes: variant.notes || null,
                admin_status: 'pending',
                manufacturer_status: 'pending'
              })
          }
        }

        for (const file of orderProduct.files) {
          const fileName = `ref-${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`
          await supabase.storage
            .from('order-media')
            .upload(fileName, file)

          await supabase
            .from('order_media')
            .insert({
              order_product_id: orderProductData.id,
              file_url: fileName,
              file_type: file.type,
              uploaded_by: user?.id
            })
        }
      }

      // Create notification for manufacturer if not draft
      if (!isDraft && selectedManufacturer) {
        await supabase
          .from('notifications')
          .insert({
            user_id: selectedManufacturer,
            order_id: order.id,
            type: 'new_order',
            message: `New order ${orderNumber} has been submitted for review`,
            is_read: false
          })
      }

      setNotificationMessage(isDraft ? 'Draft saved successfully!' : 'Order submitted successfully!')
      setShowNotification(true)
      
      setTimeout(() => {
        router.push('/dashboard/orders')
      }, 2000)
    } catch (error) {
      console.error('Error saving order:', error)
      setNotificationMessage('Failed to save order')
      setShowNotification(true)
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(p => 
    p.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard/orders')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Orders
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900">Create New Order</h1>
          
          {/* Progress Steps */}
          <div className="mt-6 flex items-center gap-4">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>1</div>
              <span className="font-medium">Order Details</span>
            </div>
            
            <div className={`w-16 h-0.5 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>2</div>
              <span className="font-medium">Products</span>
            </div>
            
            <div className={`w-16 h-0.5 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            
            <div className={`flex items-center gap-2 ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>3</div>
              <span className="font-medium">Review</span>
            </div>
          </div>
        </div>

        {/* Notification */}
        {showNotification && (
          <div className="mb-6 bg-green-50 text-green-800 p-4 rounded-lg flex items-center justify-between">
            <span>{notificationMessage}</span>
            <button onClick={() => setShowNotification(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 1: Order Details */}
        {step === 1 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Information</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order Name (Optional)
                </label>
                <input
                  type="text"
                  value={orderName}
                  onChange={(e) => setOrderName(e.target.value)}
                  placeholder="e.g., Summer Collection 2024"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div ref={clientDropdownRef} className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value)
                      setShowClientDropdown(true)
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    placeholder="Search for client..."
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
                
                {showClientDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredClients.length > 0 ? (
                      filteredClients.map(client => (
                        <button
                          key={client.id}
                          onClick={() => handleSelectClient(client.id, client.name)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        >
                          <div className="font-medium text-gray-900">{client.name}</div>
                          <div className="text-sm text-gray-500">{client.email}</div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-gray-500">No clients found</div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Manufacturer <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedManufacturer}
                  onChange={(e) => setSelectedManufacturer(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={manufacturers.length === 1}
                >
                  {manufacturers.length === 1 ? (
                    <option value={manufacturers[0].id}>{manufacturers[0].name}</option>
                  ) : (
                    <>
                      <option value="">Select a manufacturer</option>
                      {manufacturers.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={() => {
                  if (!selectedClient || !selectedManufacturer) {
                    setNotificationMessage('Please select both client and manufacturer')
                    setShowNotification(true)
                    setTimeout(() => setShowNotification(false), 3000)
                    return
                  }
                  setStep(2)
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Next: Add Products
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Products */}
        {step === 2 && (
          <div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Add Products to Order</h2>
                <button
                  onClick={() => {
                    setShowProductPicker(true)
                    setProductQuantities({})
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Select Products
                </button>
              </div>

              {orderProducts.length > 0 && (
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    value={quickFill}
                    onChange={(e) => setQuickFill(e.target.value)}
                    placeholder="Total Units"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={applyQuickFill}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    Apply to All
                  </button>
                  <span className="text-sm text-gray-500">
                    This will distribute units evenly across each product's variants
                  </span>
                </div>
              )}
            </div>

            {/* Order Products */}
            {orderProducts.map((product, productIndex) => (
              <div key={product.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {productIndex + 1}. {product.product.title}
                    </h3>
                    {product.product.description && (
                      <p className="text-sm text-gray-600 mt-1">{product.product.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeProduct(product.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Description (Optional)
                  </label>
                  <textarea
                    value={product.description || ''}
                    onChange={(e) => updateProductDescription(product.id, e.target.value)}
                    placeholder="Add any special instructions for this product..."
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-3 mb-4">
                  {product.variants.map((variant: any, vIndex: number) => (
                    <div key={vIndex} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Variant: {variant.combination}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={variant.quantity || 0}
                          onChange={(e) => updateVariantQuantity(product.id, vIndex, parseInt(e.target.value) || 0)}
                          placeholder="Quantity"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notes
                        </label>
                        <input
                          type="text"
                          value={variant.notes || ''}
                          onChange={(e) => updateVariantNotes(product.id, vIndex, e.target.value)}
                          placeholder="Optional notes..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reference Files
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {product.files.map((file: File, index: number) => (
                      <div key={index} className="relative group">
                        <div className="w-24 h-24 bg-gray-100 rounded-lg border flex items-center justify-center">
                          {file.type.startsWith('image/') ? (
                            <ImageIcon className="w-8 h-8 text-gray-400" />
                          ) : (
                            <File className="w-8 h-8 text-gray-400" />
                          )}
                        </div>
                        <button
                          onClick={() => removeFile(product.id, index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    
                    <label className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500 transition">
                      <Upload className="w-8 h-8 text-gray-400" />
                      <input
                        type="file"
                        multiple
                        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,video/*"
                        onChange={(e) => e.target.files && handleFileUpload(product.id, e.target.files)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            ))}

            {orderProducts.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No products added yet</p>
                <button
                  onClick={() => setShowProductPicker(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Products
                </button>
              </div>
            )}

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (orderProducts.length === 0) {
                    setNotificationMessage('Please add at least one product')
                    setShowNotification(true)
                    setTimeout(() => setShowNotification(false), 3000)
                    return
                  }
                  setStep(3)
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Next: Review Order
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Review Order</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b">
                  <span className="text-gray-600">Order Name</span>
                  <span className="font-medium">{orderName || 'N/A'}</span>
                </div>
                
                <div className="flex items-center justify-between py-3 border-b">
                  <span className="text-gray-600">Client</span>
                  <span className="font-medium">
                    {clients.find(c => c.id === selectedClient)?.name}
                  </span>
                </div>
                
                <div className="flex items-center justify-between py-3 border-b">
                  <span className="text-gray-600">Manufacturer</span>
                  <span className="font-medium">
                    {manufacturers.find(m => m.id === selectedManufacturer)?.name}
                  </span>
                </div>
                
                <div className="flex items-center justify-between py-3 border-b">
                  <span className="text-gray-600">Total Products</span>
                  <span className="font-medium">{orderProducts.length}</span>
                </div>
                
                <div className="flex items-center justify-between py-3">
                  <span className="text-gray-600">Total Quantity</span>
                  <span className="font-medium">{getTotalQuantity()} units</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Products Summary</h3>
              
              {orderProducts.map((product, index) => (
                <div key={product.id} className="mb-4 pb-4 border-b last:border-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {index + 1}. {product.product.title}
                      </h4>
                      {product.description && (
                        <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                      )}
                      <div className="mt-2 space-y-1">
                        {product.variants.filter((v: any) => v.quantity > 0).map((v: any, i: number) => (
                          <div key={i} className="text-sm text-gray-600">
                            • {v.combination}: {v.quantity} units
                            {v.notes && <span className="text-gray-500"> - {v.notes}</span>}
                          </div>
                        ))}
                      </div>
                      {product.files.length > 0 && (
                        <div className="text-sm text-gray-500 mt-2">
                          <Paperclip className="w-4 h-4 inline mr-1" />
                          {product.files.length} file(s) attached
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-gray-600">Total:</span>
                      <p className="font-semibold">
                        {product.variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0)} units
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => saveOrder(true)}
                  disabled={loading}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <Save className="w-4 h-4 inline mr-2" />
                  Save as Draft
                </button>
                <button
                  onClick={() => saveOrder(false)}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send className="w-4 h-4 inline mr-2" />
                  Submit Order
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Product Selection Modal */}
      {showProductPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Select Products</h3>
                <button
                  onClick={() => setShowProductPicker(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products..."
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition"
                  >
                    <h4 className="font-medium text-gray-900 mb-2">{product.title}</h4>
                    {product.description && (
                      <p className="text-sm text-gray-600 mb-3">{product.description}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Qty:</label>
                      <input
                        type="number"
                        min="0"
                        value={productQuantities[product.id] || 0}
                        onChange={(e) => handleProductQuantityChange(product.id, parseInt(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-gray-900"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-6 border-t flex justify-between">
              <div className="text-sm text-gray-600">
                Selected: {Object.values(productQuantities).reduce((sum, qty) => sum + qty, 0)} products
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowProductPicker(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={addSelectedProducts}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}