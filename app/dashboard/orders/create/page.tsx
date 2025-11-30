/**
 * Create Order Page - FIXED VERSION
 * UPDATED: Client selection uses autocomplete with keyboard navigation (arrow keys + enter)
 * FIXED: Order sample files now attach to first product so they show in detail page
 * FIXED: Order sample files now use correct file_type (document/image) not 'order_sample'
 * Last Modified: November 2025
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, ArrowRight, Search, X, Check } from 'lucide-react'

// Import all our new shared components
import { StepIndicator } from '../shared-components/StepIndicator'
import { OrderSummaryCard } from '../shared-components/OrderSummaryCard'
import { OrderSampleRequest } from '../shared-components/OrderSampleRequest'
import { QuickFillTool } from '../shared-components/QuickFillTool'
import { ProductSelector } from '../shared-components/ProductSelector'
import { CreateProductCard } from '../shared-components/CreateProductCard'

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
  const productDataRef = useRef<any>({})
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Client autocomplete refs and state
  const clientInputRef = useRef<HTMLInputElement>(null)
  const clientDropdownRef = useRef<HTMLDivElement>(null)
  const [clientSearchQuery, setClientSearchQuery] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [filteredClients, setFilteredClients] = useState<Client[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  // Manufacturer autocomplete refs and state
  const manufacturerInputRef = useRef<HTMLInputElement>(null)
  const manufacturerDropdownRef = useRef<HTMLDivElement>(null)
  const [manufacturerSearchQuery, setManufacturerSearchQuery] = useState('')
  const [showManufacturerDropdown, setShowManufacturerDropdown] = useState(false)
  const [filteredManufacturers, setFilteredManufacturers] = useState<Manufacturer[]>([])
  const [manufacturerHighlightedIndex, setManufacturerHighlightedIndex] = useState(-1)
  
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
  
  // Step 1: Basic Info
  const [orderName, setOrderName] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedClientName, setSelectedClientName] = useState('')
  const [selectedManufacturer, setSelectedManufacturer] = useState('')
  const [selectedManufacturerName, setSelectedManufacturerName] = useState('')
  
  // Step 2: Products with quantities
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProducts, setSelectedProducts] = useState<{[key: string]: number}>({})
  const [productSearch, setProductSearch] = useState('')
  
  // Step 3: Order Details
  const [orderProducts, setOrderProducts] = useState<OrderProduct[]>([])
  
  // Order-level sample request state (no checkbox needed)
  const [orderSampleFee, setOrderSampleFee] = useState('')
  const [orderSampleETA, setOrderSampleETA] = useState('')
  const [orderSampleStatus, setOrderSampleStatus] = useState('pending')
  const [orderSampleNotes, setOrderSampleNotes] = useState('')
  const [orderSampleFiles, setOrderSampleFiles] = useState<File[]>([])

  // Click outside handler for client and manufacturer dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Handle client dropdown
      if (
        clientDropdownRef.current &&
        !clientDropdownRef.current.contains(event.target as Node) &&
        clientInputRef.current &&
        !clientInputRef.current.contains(event.target as Node)
      ) {
        setShowClientDropdown(false)
        setHighlightedIndex(-1)
      }

      // Handle manufacturer dropdown
      if (
        manufacturerDropdownRef.current &&
        !manufacturerDropdownRef.current.contains(event.target as Node) &&
        manufacturerInputRef.current &&
        !manufacturerInputRef.current.contains(event.target as Node)
      ) {
        setShowManufacturerDropdown(false)
        setManufacturerHighlightedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter clients based on search query
  useEffect(() => {
    if (clientSearchQuery.trim() === '') {
      setFilteredClients(clients)
    } else {
      const query = clientSearchQuery.toLowerCase()
      const filtered = clients.filter(client =>
        client.name.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query)
      )
      setFilteredClients(filtered)
    }
    // Reset highlighted index when results change
    setHighlightedIndex(-1)
  }, [clientSearchQuery, clients])

  // Filter manufacturers based on search query
  useEffect(() => {
    if (manufacturerSearchQuery.trim() === '') {
      setFilteredManufacturers(manufacturers)
    } else {
      const query = manufacturerSearchQuery.toLowerCase()
      const filtered = manufacturers.filter(manufacturer =>
        manufacturer.name.toLowerCase().includes(query) ||
        manufacturer.email.toLowerCase().includes(query)
      )
      setFilteredManufacturers(filtered)
    }
    // Reset highlighted index when results change
    setManufacturerHighlightedIndex(-1)
  }, [manufacturerSearchQuery, manufacturers])

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    setLoading(true)
    try {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .order('name')
      
      const { data: manufacturersData } = await supabase
        .from('manufacturers')
        .select('*')
        .order('name')
      
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
      setFilteredClients(clientsData || [])
      setManufacturers(manufacturersData || [])
      setFilteredManufacturers(manufacturersData || [])

      if (manufacturersData && manufacturersData.length === 1) {
        setSelectedManufacturer(manufacturersData[0].id)
        setSelectedManufacturerName(manufacturersData[0].name)
        setManufacturerSearchQuery(manufacturersData[0].name)
      }
      
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

  // Client selection handlers
  const handleClientSelect = (client: Client) => {
    setSelectedClient(client.id)
    setSelectedClientName(client.name)
    setClientSearchQuery(client.name)
    setShowClientDropdown(false)
    setHighlightedIndex(-1)
  }

  const handleClientInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setClientSearchQuery(value)
    setShowClientDropdown(true)
    
    // If user clears the input, clear the selection
    if (value === '') {
      setSelectedClient('')
      setSelectedClientName('')
    }
  }

  const handleClientInputFocus = () => {
    setShowClientDropdown(true)
  }

  const handleClientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showClientDropdown) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setShowClientDropdown(true)
        return
      }
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => {
          const nextIndex = prev < filteredClients.length - 1 ? prev + 1 : prev
          // Scroll into view
          const element = document.getElementById(`client-option-${nextIndex}`)
          element?.scrollIntoView({ block: 'nearest' })
          return nextIndex
        })
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => {
          const nextIndex = prev > 0 ? prev - 1 : 0
          // Scroll into view
          const element = document.getElementById(`client-option-${nextIndex}`)
          element?.scrollIntoView({ block: 'nearest' })
          return nextIndex
        })
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredClients.length) {
          handleClientSelect(filteredClients[highlightedIndex])
        }
        break
      case 'Escape':
        setShowClientDropdown(false)
        setHighlightedIndex(-1)
        break
      case 'Tab':
        setShowClientDropdown(false)
        setHighlightedIndex(-1)
        break
    }
  }

  const clearClientSelection = () => {
    setSelectedClient('')
    setSelectedClientName('')
    setClientSearchQuery('')
    setShowClientDropdown(false)
    setHighlightedIndex(-1)
    clientInputRef.current?.focus()
  }

  // Manufacturer selection handlers
  const handleManufacturerSelect = (manufacturer: Manufacturer) => {
    setSelectedManufacturer(manufacturer.id)
    setSelectedManufacturerName(manufacturer.name)
    setManufacturerSearchQuery(manufacturer.name)
    setShowManufacturerDropdown(false)
    setManufacturerHighlightedIndex(-1)
  }

  const handleManufacturerInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setManufacturerSearchQuery(value)
    setShowManufacturerDropdown(true)

    // If user clears the input, clear the selection
    if (value === '') {
      setSelectedManufacturer('')
      setSelectedManufacturerName('')
    }
  }

  const handleManufacturerInputFocus = () => {
    setShowManufacturerDropdown(true)
  }

  const handleManufacturerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showManufacturerDropdown) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setShowManufacturerDropdown(true)
        return
      }
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setManufacturerHighlightedIndex(prev => {
          const nextIndex = prev < filteredManufacturers.length - 1 ? prev + 1 : prev
          // Scroll into view
          const element = document.getElementById(`manufacturer-option-${nextIndex}`)
          element?.scrollIntoView({ block: 'nearest' })
          return nextIndex
        })
        break
      case 'ArrowUp':
        e.preventDefault()
        setManufacturerHighlightedIndex(prev => {
          const nextIndex = prev > 0 ? prev - 1 : 0
          // Scroll into view
          const element = document.getElementById(`manufacturer-option-${nextIndex}`)
          element?.scrollIntoView({ block: 'nearest' })
          return nextIndex
        })
        break
      case 'Enter':
        e.preventDefault()
        if (manufacturerHighlightedIndex >= 0 && manufacturerHighlightedIndex < filteredManufacturers.length) {
          handleManufacturerSelect(filteredManufacturers[manufacturerHighlightedIndex])
        }
        break
      case 'Escape':
        setShowManufacturerDropdown(false)
        setManufacturerHighlightedIndex(-1)
        break
      case 'Tab':
        setShowManufacturerDropdown(false)
        setManufacturerHighlightedIndex(-1)
        break
    }
  }

  const clearManufacturerSelection = () => {
    setSelectedManufacturer('')
    setSelectedManufacturerName('')
    setManufacturerSearchQuery('')
    setShowManufacturerDropdown(false)
    setManufacturerHighlightedIndex(-1)
    manufacturerInputRef.current?.focus()
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

  const handleProductClick = (productId: string) => {
    const currentQty = selectedProducts[productId] || 0
    handleProductQuantityChange(productId, currentQty + 1)
  }

  const initializeOrderProducts = () => {
    const orderProds: OrderProduct[] = []
    
    Object.entries(selectedProducts).forEach(([productId, quantity]) => {
      const product = productDataRef.current[productId] || products.find(p => p.id === productId)
      
      if (!product) {
        console.error(`Product not found for ID: ${productId}`)
        return
      }
      
      for (let i = 0; i < quantity; i++) {
        const productOrderNumber = `PRD-${Math.random().toString(36).substr(2, 4).toUpperCase()}`
        
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
          product: JSON.parse(JSON.stringify(product)),
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

  const handleQuickDistribute = (totalQty: number) => {
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

  const updateProductField = (productIndex: number, field: string, value: any) => {
    setOrderProducts(prev => prev.map((op, idx) => 
      idx === productIndex 
        ? { ...op, [field]: value }
        : op
    ))
  }

  const deleteProduct = (productIndex: number) => {
    if (orderProducts.length === 1) {
      showNotification('error', 'Cannot remove the last product. Add another product first.')
      return
    }
    const product = orderProducts[productIndex]
    setOrderProducts(prev => prev.filter((_, idx) => idx !== productIndex))
    showNotification('info', `${product.product.title} removed from order`)
  }

  const updateVariantData = (productIndex: number, variantIndex: number, field: 'quantity' | 'notes', value: string) => {
    setOrderProducts(prev => prev.map((op, idx) => {
      if (idx === productIndex) {
        const newItems = [...op.items]
        if (field === 'quantity') {
          newItems[variantIndex] = { ...newItems[variantIndex], quantity: parseInt(value) || 0 }
        } else {
          newItems[variantIndex] = { ...newItems[variantIndex], notes: value }
        }
        return { ...op, items: newItems }
      }
      return op
    }))
  }

  const handleFileUpload = (productIndex: number, files: FileList | null, type: 'media' | 'sample') => {
    if (!files) return
    
    const MAX_FILE_SIZE = 50 * 1024 * 1024
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
          ? { 
              ...op, 
              [type === 'media' ? 'mediaFiles' : 'sampleMediaFiles']: [
                ...op[type === 'media' ? 'mediaFiles' : 'sampleMediaFiles'], 
                ...newFiles
              ]
            }
          : op
      ))
    }
  }

  const removeFile = (productIndex: number, fileIndex: number, type: 'media' | 'sample') => {
    setOrderProducts(prev => prev.map((op, idx) => {
      if (idx === productIndex) {
        const filesKey = type === 'media' ? 'mediaFiles' : 'sampleMediaFiles'
        const newFiles = op[filesKey].filter((_, i) => i !== fileIndex)
        return { ...op, [filesKey]: newFiles }
      }
      return op
    }))
  }

  // Order-level sample file handlers
  const handleOrderSampleFileUpload = (files: FileList | null) => {
    if (!files) return
    
    const MAX_FILE_SIZE = 50 * 1024 * 1024
    const newFiles = Array.from(files).filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        showNotification('error', `File "${file.name}" is too large. Maximum size is 50MB.`)
        return false
      }
      return true
    })
    
    if (newFiles.length > 0) {
      setOrderSampleFiles(prev => [...prev, ...newFiles])
    }
  }

  const removeOrderSampleFile = (index: number) => {
    setOrderSampleFiles(prev => prev.filter((_, i) => i !== index))
  }

  const updateOrderSampleField = (field: string, value: any) => {
    switch (field) {
      case 'sampleFee':
        setOrderSampleFee(value)
        break
      case 'sampleETA':
        setOrderSampleETA(value)
        break
      case 'sampleStatus':
        setOrderSampleStatus(value)
        break
      case 'sampleNotes':
        setOrderSampleNotes(value)
        break
    }
  }

  // Helper function to sanitize filename
  const sanitizeFileName = (filename: string) => {
    // Remove extension first
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename
    // Replace spaces with hyphens, remove special characters
    return nameWithoutExt
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 50) // Limit length
  }

  const createManufacturerNotification = async (
    orderId: string,
    manufacturerId: string,
    orderNumber: string,
    hasSampleRequest: boolean
  ) => {
    try {
      let notificationType = 'new_order'
      let message = `New order ${orderNumber} has been assigned to you`
      
      if (hasSampleRequest) {
        notificationType = 'sample_requested'
        message = `New order ${orderNumber} with sample request`
      }

      const { error } = await supabase
        .from('manufacturer_notifications')
        .insert({
          manufacturer_id: manufacturerId,
          order_id: orderId,
          product_id: null,
          type: notificationType,
          message: message,
          is_read: false,
          created_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error creating manufacturer notification:', error)
      }
    } catch (error) {
      console.error('Error in createManufacturerNotification:', error)
    }
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
      
      const { data: clientData } = await supabase
        .from('clients')
        .select('name')
        .eq('id', selectedClient)
        .single()
      
      const clientPrefix = clientData?.name?.substring(0, 3).toUpperCase() || 'ORD'
      
      const { data: lastOrder } = await supabase
        .from('orders')
        .select('order_number')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      let nextNumber = 1200
      if (lastOrder?.order_number) {
        const match = lastOrder.order_number.match(/(\d{6})/)
        if (match) {
          nextNumber = parseInt(match[1]) + 1
        }
      }
      
      const orderNumber = isDraft 
        ? `DRAFT-${nextNumber.toString().padStart(6, '0')}`
        : `${clientPrefix}-${nextNumber.toString().padStart(6, '0')}`

      // Check if sample is requested based on whether notes or files are provided
      const hasSampleRequest = (orderSampleNotes && orderSampleNotes.trim() !== '') || orderSampleFiles.length > 0

      // Determine order status
      let orderStatus = 'draft'
      if (!isDraft) {
        orderStatus = 'sent_to_manufacturer'
        console.log('Status: sent_to_manufacturer (order submitted)')
      } else {
        console.log('Status: draft (saved as draft)')
      }
      
      console.log('Final order status:', orderStatus)
      console.log('Has sample request:', hasSampleRequest)
      
      // Create order with order-level sample fields
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          order_name: orderName || 'New Order',
          client_id: selectedClient,
          manufacturer_id: selectedManufacturer,
          status: orderStatus,
          created_by: user?.id,
          // Order-level sample fields
          sample_required: hasSampleRequest, // Auto-determine based on content
          sample_fee: orderSampleFee ? parseFloat(orderSampleFee) : null,
          sample_eta: orderSampleETA || null,
          sample_status: orderSampleStatus,
          sample_notes: orderSampleNotes || null
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
      
      // Create manufacturer notification if not a draft
      if (!isDraft && orderData && selectedManufacturer) {
        console.log('🔔 Creating notification for manufacturer...')
        await createManufacturerNotification(
          orderData.id,
          selectedManufacturer,
          orderNumber,
          hasSampleRequest
        )
      } else {
        console.log('ℹ️ No notification needed (draft or missing data)')
      }
      
      // Save products
      const orderNumeric = orderNumber.includes('-') 
        ? orderNumber.split('-')[1]
        : nextNumber.toString().padStart(6, '0')
      
      console.log(`Saving ${orderProducts.length} products...`)
      
      // Track global bulk file counter across all products
      let globalBulkFileCounter = 1
      
      // FIXED: Track the first product ID for order-level sample files
      let firstProductId: string | null = null
      
      for (const orderProduct of orderProducts) {
        console.log('Saving product:', orderProduct.product.title)
        
        const productCode = orderProduct.product.title?.substring(0, 3).toUpperCase() || 'PRD'
        const descCode = orderProduct.productDescription?.substring(0, 3).toUpperCase() || 'GEN'
        const finalProductOrderNumber = `${orderNumeric}-${productCode}-${descCode}`
        
        if (!orderProduct.product.id) {
          console.error('Product ID is missing for:', orderProduct.product.title)
          showNotification('error', `Failed to save product ${orderProduct.product.title}: Missing product ID`)
          continue
        }
        
        const { data: productData, error: productError } = await supabase
          .from('order_products')
          .insert({
            order_id: orderData.id,
            product_id: orderProduct.product.id,
            product_order_number: finalProductOrderNumber,
            description: orderProduct.productDescription || '',
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
        
        // FIXED: Store the first product ID for order-level sample files
        if (!firstProductId) {
          firstProductId = productData.id
          console.log('First product ID stored for sample files:', firstProductId)
        }

        // Save variants
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

        // Upload media files (bulk files for products)
        if (orderProduct.mediaFiles && orderProduct.mediaFiles.length > 0) {
          console.log(`Uploading ${orderProduct.mediaFiles.length} bulk files...`)
          
          for (const file of orderProduct.mediaFiles) {
            try {
              const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file'
              const cleanName = sanitizeFileName(file.name)
              // New naming: originalname-bulk-001.ext (using global counter)
              const displayName = `${cleanName}-bulk-${String(globalBulkFileCounter).padStart(3, '0')}.${fileExt}`
              const filePath = `${orderData.id}/${productData.id}/${displayName}`
              
              console.log('Uploading bulk file:', displayName)

              const { error: uploadError } = await supabase.storage
                .from('order-media')
                .upload(filePath, file)

              if (uploadError) {
                console.error('Error uploading file:', uploadError)
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
                  original_filename: file.name,
                  display_name: displayName
                })

              console.log('Bulk file uploaded:', displayName)
              globalBulkFileCounter++
            } catch (mediaError) {
              console.error('Error with media:', mediaError)
            }
          }
        }
      }
      
      // FIXED: Upload order-level sample files AFTER products are created
      // Attach to first product so they show up in detail page queries
      if (orderSampleFiles.length > 0 && firstProductId) {
        console.log(`Uploading ${orderSampleFiles.length} order-level sample files...`)
        console.log('Attaching to first product ID:', firstProductId)
        
        for (let i = 0; i < orderSampleFiles.length; i++) {
          const file = orderSampleFiles[i]
          try {
            const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file'
            const cleanName = sanitizeFileName(file.name)
            // New naming: originalname-sample-001.ext
            const displayName = `${cleanName}-sample-${String(i + 1).padStart(3, '0')}.${fileExt}`
            // Store in order folder (not product subfolder) for clarity
            const filePath = `${orderData.id}/${displayName}`
            
            console.log('Uploading order sample file:', displayName)

            const { error: uploadError } = await supabase.storage
              .from('order-media')
              .upload(filePath, file)

            if (uploadError) {
              console.error('Error uploading order sample file:', uploadError)
              continue
            }

            const { data: { publicUrl } } = supabase.storage
              .from('order-media')
              .getPublicUrl(filePath)

            // FIXED: Attach to first product AND set is_sample flag
            // This ensures the file shows up in detail page queries
            await supabase
              .from('order_media')
              .insert({
                order_id: orderData.id,
                order_product_id: firstProductId, // FIXED: Link to first product!
                file_url: publicUrl,
                file_type: file.type.startsWith('image/') ? 'image' : 'document',
                is_sample: true, // Mark as order-level sample
                uploaded_by: user?.id,
                original_filename: file.name,
                display_name: displayName
              })

            console.log('Order sample file uploaded and linked to product:', displayName)
          } catch (error) {
            console.error('Error uploading order sample file:', error)
          }
        }
      } else if (orderSampleFiles.length > 0 && !firstProductId) {
        console.error('Cannot upload order sample files: No products were created')
        showNotification('error', 'Sample files could not be uploaded - no products in order')
      }
      
      console.log('All products and items saved!')
      console.log('✅ Order creation complete!')
      
      showNotification('success', `Order ${orderNumber} ${isDraft ? 'saved as draft' : 'created'} successfully!`)
      
      console.log('Navigating to orders list in 1.5 seconds...')
      
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  // Helper to get instances for product cards
  const getProductInstances = (product: Product) => {
    return orderProducts.filter(op => op.product.id === product.id)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Notification Toast */}
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
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <p className="font-semibold text-white">{notification.message}</p>
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
        
        {/* Progress Steps using new component */}
        <div className="mt-6">
          <StepIndicator 
            currentStep={currentStep} 
            onStepClick={(step) => {
              if (step < currentStep) {
                setCurrentStep(step)
              }
            }}
          />
        </div>
      </div>

      {/* Step 1: Basic Info */}
      {currentStep === 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Information</h2>
          
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Client Autocomplete */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Client *
              </label>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    ref={clientInputRef}
                    type="text"
                    value={clientSearchQuery}
                    onChange={handleClientInputChange}
                    onFocus={handleClientInputFocus}
                    onKeyDown={handleClientKeyDown}
                    placeholder="Type to search clients..."
                    className={`${inputClassName} pl-9 pr-10`}
                    autoComplete="off"
                  />
                  {selectedClient && (
                    <button
                      type="button"
                      onClick={clearClientSelection}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {/* Dropdown - Fixed rounded corners */}
                {showClientDropdown && (
                  <div 
                    ref={clientDropdownRef}
                    className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                  >
                    {filteredClients.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        No clients found
                      </div>
                    ) : (
                      filteredClients.map((client, index) => (
                        <button
                          key={client.id}
                          id={`client-option-${index}`}
                          type="button"
                          onClick={() => handleClientSelect(client)}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          className={`w-full px-4 py-3 text-left flex items-center justify-between transition-colors
                            ${index === 0 ? 'rounded-t-lg' : ''}
                            ${index === filteredClients.length - 1 ? 'rounded-b-lg' : ''}
                            ${highlightedIndex === index ? 'bg-blue-50' : 'hover:bg-gray-50'}
                            ${selectedClient === client.id ? 'bg-blue-50' : ''}
                          `}
                        >
                          <div>
                            <div className="font-medium text-gray-900">{client.name}</div>
                            <div className="text-sm text-gray-500">{client.email}</div>
                          </div>
                          {selectedClient === client.id && (
                            <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              
              {/* Selected client indicator */}
              {selectedClient && (
                <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  <span>Selected: {selectedClientName}</span>
                </div>
              )}
            </div>

            {/* Manufacturer Autocomplete */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Manufacturer *
                {manufacturers.length === 1 && (
                  <span className="ml-2 text-xs text-green-600">(Auto-selected)</span>
                )}
              </label>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    ref={manufacturerInputRef}
                    type="text"
                    value={manufacturerSearchQuery}
                    onChange={handleManufacturerInputChange}
                    onFocus={handleManufacturerInputFocus}
                    onKeyDown={handleManufacturerKeyDown}
                    placeholder="Type to search manufacturers..."
                    className={`${inputClassName} pl-9 pr-10`}
                    autoComplete="off"
                  />
                  {selectedManufacturer && (
                    <button
                      type="button"
                      onClick={clearManufacturerSelection}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Dropdown */}
                {showManufacturerDropdown && (
                  <div
                    ref={manufacturerDropdownRef}
                    className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                  >
                    {filteredManufacturers.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        No manufacturers found
                      </div>
                    ) : (
                      filteredManufacturers.map((manufacturer, index) => (
                        <button
                          key={manufacturer.id}
                          id={`manufacturer-option-${index}`}
                          type="button"
                          onClick={() => handleManufacturerSelect(manufacturer)}
                          onMouseEnter={() => setManufacturerHighlightedIndex(index)}
                          className={`w-full px-4 py-3 text-left flex items-center justify-between transition-colors
                            ${index === 0 ? 'rounded-t-lg' : ''}
                            ${index === filteredManufacturers.length - 1 ? 'rounded-b-lg' : ''}
                            ${manufacturerHighlightedIndex === index ? 'bg-blue-50' : 'hover:bg-gray-50'}
                            ${selectedManufacturer === manufacturer.id ? 'bg-blue-50' : ''}
                          `}
                        >
                          <div>
                            <div className="font-medium text-gray-900">{manufacturer.name}</div>
                            <div className="text-sm text-gray-500">{manufacturer.email}</div>
                          </div>
                          {selectedManufacturer === manufacturer.id && (
                            <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Selected manufacturer indicator */}
              {selectedManufacturer && (
                <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  <span>Selected: {selectedManufacturerName}</span>
                </div>
              )}
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

      {/* Step 2: Product Selection using new component with refresh callback */}
      {currentStep === 2 && (
      <>
        <ProductSelector
          products={products}
          selectedProducts={selectedProducts}
          searchQuery={productSearch}
          onSearchChange={setProductSearch}
          onProductQuantityChange={handleProductQuantityChange}
          onProductClick={handleProductClick}
          showNotification={showNotification}
          onProductsRefresh={fetchInitialData}
        />
        
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
      </>
    )}

      {/* Step 3: Order Details with new components */}
      {currentStep === 3 && (
        <div>
          {/* Order Summary Card */}
          <OrderSummaryCard
            orderName={orderName}
            client={clients.find(c => c.id === selectedClient)}
            manufacturer={manufacturers.find(m => m.id === selectedManufacturer)}
          />

          {/* Order-level Sample Request */}
          <OrderSampleRequest
            sampleFee={orderSampleFee}
            sampleETA={orderSampleETA}
            sampleStatus={orderSampleStatus}
            sampleNotes={orderSampleNotes}
            sampleFiles={orderSampleFiles}
            onUpdate={updateOrderSampleField}
            onFileUpload={handleOrderSampleFileUpload}
            onFileRemove={removeOrderSampleFile}
            isManufacturer={false}
            readOnly={false}
          />

          {/* Quick Fill Tool */}
          <QuickFillTool onDistribute={handleQuickDistribute} />

          {/* Products using new CreateProductCard */}
          {orderProducts.map((orderProduct, productIndex) => {
            const instances = getProductInstances(orderProduct.product)
            const currentInstance = instances.indexOf(orderProduct) + 1
            const totalInstances = instances.length
            
            return (
              <CreateProductCard
                key={productIndex}
                orderProduct={orderProduct}
                productIndex={productIndex}
                totalInstances={totalInstances}
                currentInstance={currentInstance}
                onUpdate={updateProductField}
                onDelete={deleteProduct}
                onVariantUpdate={updateVariantData}
                onFileUpload={handleFileUpload}
                onFileRemove={removeFile}
                showNotification={showNotification}
                showSampleRequest={false} // Sample request is now at order level
              />
            )
          })}

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