/**
 * Create Order Page - /dashboard/orders/create
 * Allows admins to create new orders with products and variants
 * OPTIMIZED: Bulk DB inserts, parallel file uploads, sleek loading overlay
 * UPDATED: Added bulkNotes field that saves to client_notes column
 * Roles: Admin, Super Admin
 * Last Modified: December 2025
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, ArrowRight, Search, X, Check, Loader2, CheckCircle2 } from 'lucide-react'
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/lib/constants/fileUpload'

// Translation imports
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/contexts/LanguageContext'
import { useDynamicTranslation } from '@/hooks/useDynamicTranslation'
import '../../../i18n'

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
  bulkNotes: string  // NEW: Bulk order notes
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
const inputClassName = "w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
const selectClassName = "w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"

// Sleek loading overlay component
function LoadingOverlay({
  isVisible,
  currentStep,
  steps,
  orderNumber,
  t
}: {
  isVisible: boolean
  currentStep: number
  steps: string[]
  orderNumber?: string
  t: any
}) {
  if (!isVisible) return null

  const isComplete = currentStep >= steps.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-purple-900/30 to-indigo-900/40 backdrop-blur-md" />

      {/* Content */}
      <div className="relative">
        {/* Glowing ring effect */}
        <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-3xl opacity-20 blur-xl animate-pulse" />

        {/* Main card - compact and sleek */}
        <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl px-4 sm:px-8 py-4 sm:py-6 min-w-[280px] sm:min-w-[320px]">
          {/* Header with spinner or checkmark */}
          <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
            {isComplete ? (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
            ) : (
              <div className="relative w-10 h-10 sm:w-12 sm:h-12">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 animate-pulse" />
                <div className="absolute inset-1 rounded-full bg-white flex items-center justify-center">
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 animate-spin" />
                </div>
              </div>
            )}
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                {isComplete ? t('complete') : t('processing')}
              </h3>
              {orderNumber && (
                <p className="text-xs sm:text-sm font-mono text-blue-600">{orderNumber}</p>
              )}
            </div>
          </div>
          
          {/* Progress steps - compact */}
          <div className="space-y-2">
            {steps.map((step, index) => {
              const isDone = index < currentStep
              const isActive = index === currentStep
              
              return (
                <div 
                  key={index}
                  className={`flex items-center gap-3 transition-all duration-300 ${
                    isDone ? 'text-emerald-600' : isActive ? 'text-blue-600' : 'text-gray-300'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-current flex-shrink-0" />
                  )}
                  <span className={`text-sm ${isDone || isActive ? 'font-medium' : ''}`}>
                    {step}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CreateOrderPage() {
  const { translate, translateBatch } = useDynamicTranslation();
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const router = useRouter()
  const productDataRef = useRef<any>({})
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Smart loading overlay state
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [loadingSteps, setLoadingSteps] = useState<string[]>([])
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string>('')
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null)
  
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
          bulkNotes: '',  // NEW: Initialize bulkNotes
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

    const newFiles = Array.from(files).filter(file => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showNotification('error', `File "${file.name}" is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`)
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

  // OPTIMIZED: Upload single file helper (for parallel uploads)
  const uploadFile = async (
    file: File,
    orderId: string,
    productId: string | null,
    userId: string | null,
    fileIndex: number,
    prefix: string,
    isSample: boolean = false
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file'
      const cleanName = sanitizeFileName(file.name)
      const displayName = `${cleanName}-${prefix}-${String(fileIndex).padStart(3, '0')}.${fileExt}`
      const filePath = productId 
        ? `${orderId}/${productId}/${displayName}`
        : `${orderId}/${displayName}`

      const { error: uploadError } = await supabase.storage
        .from('order-media')
        .upload(filePath, file)

      if (uploadError) {
        console.error('Error uploading file:', uploadError)
        return { success: false, error: uploadError.message }
      }

      const { data: { publicUrl } } = supabase.storage
        .from('order-media')
        .getPublicUrl(filePath)

      await supabase
        .from('order_media')
        .insert({
          order_id: orderId,
          order_product_id: productId,
          file_url: publicUrl,
          file_type: file.type.startsWith('image/') ? 'image' : 'document',
          is_sample: isSample,
          uploaded_by: userId,
          original_filename: file.name,
          display_name: displayName
        })

      return { success: true }
    } catch (error) {
      console.error('Error in uploadFile:', error)
      return { success: false, error: String(error) }
    }
  }

  // OPTIMIZED: Main submit handler with bulk inserts and parallel uploads
  const handleSubmit = async (isDraft = false) => {
    console.log('=== HANDLE SUBMIT STARTED (OPTIMIZED) ===')
    console.log('Draft mode:', isDraft)
    
    setSaving(true)
    setCreatedOrderNumber('') // Reset order number
    
    // Count total files for progress display
    const totalProductFiles = orderProducts.reduce((sum, op) => sum + op.mediaFiles.length, 0)
    const totalFiles = totalProductFiles + orderSampleFiles.length
    
    // Setup loading steps
    const steps = [
      t('creatingOrder'),
      t('addingProducts'),
    ]
    if (totalFiles > 0) {
      steps.push(t('uploadingFiles'))
    }
    steps.push(t('processing'))
    
    setLoadingSteps(steps)
    setLoadingStep(0)
    
    // Smart delay - only show overlay if operation takes > 500ms
    loadingTimerRef.current = setTimeout(() => {
      setShowLoadingOverlay(true)
    }, 500)
    
    try {
      const userData = localStorage.getItem('user')
      const user = userData ? JSON.parse(userData) : null
      
      // Get client name for order prefix
      const clientName = clients.find(c => c.id === selectedClient)?.name
      const clientPrefix = clientName?.substring(0, 3).toUpperCase() || 'ORD'
      
      // Get last order number
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

      // Show order number in overlay immediately
      setCreatedOrderNumber(orderNumber)

      // Check if sample is requested
      const hasSampleRequest = (orderSampleNotes && orderSampleNotes.trim() !== '') || orderSampleFiles.length > 0

      // Determine order status - EXPLICIT for debugging
      // When NOT a draft, we set to 'sent_to_manufacturer'
      const orderStatus = isDraft ? 'draft' : 'sent_to_manufacturer'
      
      console.log('========================================')
      console.log('ORDER STATUS BEING SET:', orderStatus)
      console.log('isDraft:', isDraft)
      console.log('========================================')
      
      // Step 1: Create order with EXPLICIT status
      const orderInsertData = {
        order_number: orderNumber,
        order_name: orderName || 'New Order',
        client_id: selectedClient,
        manufacturer_id: selectedManufacturer,
        status: orderStatus, // This should be 'sent_to_manufacturer' when not draft
        workflow_status: orderStatus, // Also set workflow_status to match
        created_by: user?.id,
        sample_required: hasSampleRequest,
        sample_fee: orderSampleFee ? parseFloat(orderSampleFee) : null,
        sample_eta: orderSampleETA || null,
        sample_status: orderSampleStatus,
        sample_notes: orderSampleNotes || null
      }
      
      console.log('Order insert data:', JSON.stringify(orderInsertData, null, 2))
      
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert(orderInsertData)
        .select()
        .single()

      if (orderError) {
        throw new Error(orderError.message || 'Failed to create order')
      }

      console.log('Order created successfully!')
      console.log('Order ID:', orderData.id)
      console.log('Order status in DB:', orderData.status)
      console.log('Order workflow_status in DB:', orderData.workflow_status)
      
      setLoadingStep(1) // Move to "Saving products..."
      
      // Create manufacturer notification if not a draft
      if (!isDraft && orderData && selectedManufacturer) {
        await createManufacturerNotification(
          orderData.id,
          selectedManufacturer,
          orderNumber,
          hasSampleRequest
        )
      }
      
      // Step 2: BULK INSERT all products at once
      const orderNumeric = orderNumber.includes('-') 
        ? orderNumber.split('-')[1]
        : nextNumber.toString().padStart(6, '0')
      
      // Product status should also be 'sent_to_manufacturer' when not draft
      const productStatus = isDraft ? 'pending' : 'sent_to_manufacturer'
      const routedTo = isDraft ? 'admin' : 'manufacturer'
      
      console.log('Product status being set:', productStatus)
      console.log('Routed to:', routedTo)
      
      const productsToInsert = orderProducts.map((orderProduct, index) => {
        const productCode = orderProduct.product.title?.substring(0, 3).toUpperCase() || 'PRD'
        const descCode = orderProduct.productDescription?.substring(0, 3).toUpperCase() || 'GEN'
        const sequenceNum = (index + 1).toString().padStart(2, '0')
        const finalProductOrderNumber = `${orderNumeric}-${productCode}-${descCode}-${sequenceNum}`
        
        return {
          order_id: orderData.id,
          product_id: orderProduct.product.id,
          product_order_number: finalProductOrderNumber,
          description: orderProduct.productDescription || '',
          client_notes: orderProduct.bulkNotes || '',  // NEW: Save bulkNotes to client_notes
          product_status: productStatus,
          routed_to: routedTo
        }
      })
      
      console.log(`Bulk inserting ${productsToInsert.length} products...`)
      
      const { data: insertedProducts, error: productsError } = await supabase
        .from('order_products')
        .insert(productsToInsert)
        .select()

      if (productsError) {
        throw new Error(`Failed to save products: ${productsError.message}`)
      }

      console.log('Products inserted:', insertedProducts?.length)
      
      // Step 3: BULK INSERT all order items at once
      const allItemsToInsert: any[] = []
      
      orderProducts.forEach((orderProduct, index) => {
        const productData = insertedProducts?.[index]
        if (!productData) return
        
        orderProduct.items.forEach(item => {
          allItemsToInsert.push({
            order_product_id: productData.id,
            variant_combo: item.variantCombo,
            quantity: item.quantity || 0,
            notes: item.notes || '',
            admin_status: 'pending',
            manufacturer_status: 'pending'
          })
        })
      })
      
      if (allItemsToInsert.length > 0) {
        console.log(`Bulk inserting ${allItemsToInsert.length} items...`)
        
        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(allItemsToInsert)

        if (itemsError) {
          console.error('Error bulk inserting items:', itemsError)
        }
      }
      
      // Step 4: PARALLEL file uploads
      if (totalFiles > 0) {
        setLoadingStep(2) // Move to "Uploading files..."
        console.log(`Starting parallel upload of ${totalFiles} files...`)
        
        const uploadPromises: Promise<{ success: boolean; error?: string }>[] = []
        let globalFileIndex = 1
        
        // Product media files
        orderProducts.forEach((orderProduct, productIndex) => {
          const productData = insertedProducts?.[productIndex]
          if (!productData) return
          
          orderProduct.mediaFiles.forEach((file) => {
            uploadPromises.push(
              uploadFile(
                file,
                orderData.id,
                productData.id,
                user?.id,
                globalFileIndex++,
                'bulk',
                false
              )
            )
          })
        })
        
        // Order-level sample files (attach to first product)
        const firstProductId = insertedProducts?.[0]?.id || null
        if (orderSampleFiles.length > 0 && firstProductId) {
          orderSampleFiles.forEach((file, index) => {
            uploadPromises.push(
              uploadFile(
                file,
                orderData.id,
                firstProductId,
                user?.id,
                index + 1,
                'sample',
                true
              )
            )
          })
        }
        
        // Wait for all uploads to complete in parallel
        const uploadResults = await Promise.all(uploadPromises)
        const failedUploads = uploadResults.filter(r => !r.success)
        
        if (failedUploads.length > 0) {
          console.warn(`${failedUploads.length} file(s) failed to upload`)
        }
        
        console.log(`File uploads complete: ${uploadResults.length - failedUploads.length}/${uploadResults.length} succeeded`)
      }
      
      // Step 5: Finalize
      setLoadingStep(steps.length - 1) // Move to "Finalizing..."
      
      console.log('✅ Order creation complete!')
      
      // Clear the loading timer
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current)
      }
      
      // Brief pause to show completion
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setShowLoadingOverlay(false)
      showNotification('success', `Order ${orderNumber} ${isDraft ? 'saved as draft' : 'created'} successfully!`)
      
      setTimeout(() => {
        router.push('/dashboard/orders')
      }, 1000)
      
    } catch (error) {
      console.error('Error creating order:', error)
      
      // Clear the loading timer
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current)
      }
      setShowLoadingOverlay(false)
      
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
        <div className="text-sm sm:text-base text-gray-500">Loading...</div>
      </div>
    )
  }

  // Helper to get instances for product cards
  const getProductInstances = (product: Product) => {
    return orderProducts.filter(op => op.product.id === product.id)
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {/* Smart Loading Overlay */}
      <LoadingOverlay
        isVisible={showLoadingOverlay}
        currentStep={loadingStep}
        steps={loadingSteps}
        orderNumber={createdOrderNumber}
        t={t}
      />

      {/* Notification Toast */}
      {notification.show && (
        <div className={`
          fixed top-4 right-4 z-50 min-w-[280px] sm:min-w-[300px] max-w-[90vw] sm:max-w-none transform transition-all duration-500 ease-out
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
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <p className="font-semibold text-white text-sm sm:text-base">{notification.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base"
        >
          <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          {t('backToOrders')}
        </button>

        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('createNewOrder')}</h1>

        {/* Progress Steps using new component */}
        <div className="mt-4 sm:mt-6">
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
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">{t('basicInfo')}</h2>

          <div className="mb-4 sm:mb-6">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              {t('orderName')}
            </label>
            <input
              type="text"
              value={orderName}
              onChange={(e) => setOrderName(e.target.value)}
              placeholder={t('e.gSpringCollection2024')}
              className={inputClassName}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Client Autocomplete */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                {t('selectClient')}
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
                    placeholder={t('searchClient')}
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
                        {t('noClientsFound')}
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
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                {t('selectManufacturer')}
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
                    placeholder={t('searchManufacturer')}
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
                        {t('noManufacturersFound')}
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

          <div className="mt-4 sm:mt-6 flex justify-end">
            <button
              onClick={nextStep}
              className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center text-sm sm:text-base"
            >
              {t('next')}
              <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
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
        
        <div className="mt-4 sm:mt-6 flex justify-between">
          <button
            onClick={prevStep}
            className="px-4 sm:px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center text-sm sm:text-base"
          >
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            {t('previous')}
          </button>
          <button
            onClick={nextStep}
            className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center text-sm sm:text-base"
          >
            {t('next')}
            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
          </button>
        </div>
      </>
    )}

      {/* Step 3: Order Details with new components */}
      {currentStep === 3 && (
        <div>
          {/* Order Summary Card */}
          <OrderSummaryCard
            orderName={orderName ? translate(orderName) : ''}
            client={(() => {
              const client = clients.find(c => c.id === selectedClient);
              return client ? { ...client, name: client.name ? translate(client.name) : client.name } : undefined;
            })()}
            manufacturer={(() => {
              const manufacturer = manufacturers.find(m => m.id === selectedManufacturer);
              return manufacturer ? { ...manufacturer, name: manufacturer.name ? translate(manufacturer.name) : manufacturer.name } : undefined;
            })()}
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
            // Translate product title for card
            const translatedOrderProduct = {
              ...orderProduct,
              product: {
                ...orderProduct.product,
                title: orderProduct.product.title ? translate(orderProduct.product.title) : orderProduct.product.title
              }
            };
            return (
              <CreateProductCard
                key={productIndex}
                orderProduct={translatedOrderProduct}
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
          <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0">
            <button
              onClick={prevStep}
              className="px-4 sm:px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center text-sm sm:text-base"
            >
              <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Previous
            </button>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => handleSubmit(true)}
                disabled={saving}
                className="px-4 sm:px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                {saving && (
                  <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                )}
                {saving ? 'Saving...' : 'Save as Draft'}
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={saving}
                className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                {saving && (
                  <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
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