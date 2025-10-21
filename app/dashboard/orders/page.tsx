'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Order = {
  id: string
  order_number: string
  client_id: string
  manufacturer_id: string
  status: string
  created_at: string
}

type OrderProduct = {
  id: string
  order_id: string
  product_id: string
}

type OrderItem = {
  id: string
  order_product_id: string
  variant_combo: string
  quantity: number
}

type Product = {
  id: string
  title: string
}

type Client = {
  id: string
  name: string
}

type Manufacturer = {
  id: string
  name: string
}

type VariantOption = {
  id: string
  value: string
  type_id: string
}

type VariantType = {
  id: string
  name: string
}

export default function OrdersListPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [orderProducts, setOrderProducts] = useState<OrderProduct[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([])
  const [variantTypes, setVariantTypes] = useState<VariantType[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const role = localStorage.getItem('userRole')
    setUserRole(role || '')
    loadOrders()
  }, [])

  const loadOrders = async () => {
    setLoading(true)
    
    const [
      ordersRes, 
      orderProductsRes, 
      orderItemsRes,
      productsRes, 
      clientsRes, 
      manufacturersRes,
      variantOptionsRes,
      variantTypesRes
    ] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('order_products').select('*'),
      supabase.from('order_items').select('*'),
      supabase.from('products').select('*'),
      supabase.from('clients').select('*'),
      supabase.from('manufacturers').select('*'),
      supabase.from('variant_options').select('*'),
      supabase.from('variant_types').select('*')
    ])
    
    setOrders(ordersRes.data || [])
    setOrderProducts(orderProductsRes.data || [])
    setOrderItems(orderItemsRes.data || [])
    setProducts(productsRes.data || [])
    setClients(clientsRes.data || [])
    setManufacturers(manufacturersRes.data || [])
    setVariantOptions(variantOptionsRes.data || [])
    setVariantTypes(variantTypesRes.data || [])
    setLoading(false)
  }

  const getClientName = (clientId: string) => {
    return clients.find(c => c.id === clientId)?.name || 'Unknown'
  }

  const getManufacturerName = (manufacturerId: string) => {
    return manufacturers.find(m => m.id === manufacturerId)?.name || 'Unknown'
  }

  const getProductName = (productId: string) => {
    return products.find(p => p.id === productId)?.title || 'Unknown'
  }

  const getOrderProductDetails = (orderId: string) => {
    const orderProductsList = orderProducts.filter(op => op.order_id === orderId)
    const productNames = orderProductsList.map(op => {
      const product = products.find(p => p.id === op.product_id)
      return product?.title || ''
    }).filter(name => name)
    
    return productNames
  }

  const getOrderSizes = (orderId: string) => {
    const orderProductsList = orderProducts.filter(op => op.order_id === orderId)
    const allSizes = new Set<string>()
    
    orderProductsList.forEach(op => {
      const items = orderItems.filter(item => item.order_product_id === op.id)
      items.forEach(item => {
        if (item.quantity > 0) {
          const variantIds = item.variant_combo.split(',')
          variantIds.forEach(id => {
            const option = variantOptions.find(vo => vo.id === id)
            if (option) {
              // Check if this is a size variant (you might need to adjust this logic)
              const type = variantTypes.find(vt => vt.id === option.type_id)
              if (type && (type.name.toLowerCase().includes('size') || 
                         ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'].includes(option.value))) {
                allSizes.add(option.value)
              }
            }
          })
        }
      })
    })
    
    // Sort sizes in logical order
    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']
    return Array.from(allSizes).sort((a, b) => {
      const aIndex = sizeOrder.indexOf(a)
      const bIndex = sizeOrder.indexOf(b)
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      return a.localeCompare(b)
    })
  }

  const getTotalQuantity = (orderId: string) => {
    const orderProductsList = orderProducts.filter(op => op.order_id === orderId)
    let total = 0
    
    orderProductsList.forEach(op => {
      const items = orderItems.filter(item => item.order_product_id === op.id)
      items.forEach(item => {
        total += item.quantity
      })
    })
    
    return total
  }

  const getStatusColor = (status: string, isDraft: boolean) => {
    if (isDraft) return 'bg-amber-500 text-white'
    switch (status) {
      case 'submitted': return 'bg-blue-500 text-white'
      case 'in_progress': return 'bg-yellow-500 text-white'
      case 'completed': return 'bg-green-500 text-white'
      case 'rejected': return 'bg-red-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const handleViewOrder = (order: Order) => {
    // If it's a DRAFT order, go to edit mode
    if (order.order_number.startsWith('DRAFT-')) {
      router.push(`/dashboard/orders/edit/${order.id}`)
    } else {
      router.push(`/dashboard/orders/${order.id}`)
    }
  }

  // Filter orders based on status and search
  const filteredOrders = orders.filter(order => {
    const isDraft = order.order_number.startsWith('DRAFT-')
    
    // Status filter
    let matchesStatus = false
    if (statusFilter === 'all') {
      matchesStatus = true
    } else if (statusFilter === 'draft') {
      matchesStatus = isDraft
    } else if (statusFilter === 'active') {
      matchesStatus = !isDraft && (order.status === 'submitted' || order.status === 'in_progress')
    } else if (statusFilter === 'completed') {
      matchesStatus = !isDraft && (order.status === 'completed' || order.status === 'rejected')
    } else {
      matchesStatus = !isDraft && order.status === statusFilter
    }
    
    // Search filter
    const matchesSearch = searchTerm === '' || 
                          order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          getClientName(order.client_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
                          getManufacturerName(order.manufacturer_id).toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesStatus && matchesSearch
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Factory Orders</h1>
        <button
          onClick={() => router.push('/dashboard/orders/create')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition inline-flex items-center justify-center sm:w-auto w-full"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Order
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 mb-6 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Status Filter */}
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Status:</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                    statusFilter === 'all'
                      ? 'bg-gray-800 text-white shadow-md'
                      : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  All Orders
                </button>
                <button
                  onClick={() => setStatusFilter('draft')}
                  className={`px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                    statusFilter === 'draft'
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'bg-white text-gray-600 border border-gray-300 hover:bg-amber-50 hover:border-amber-300'
                  }`}
                >
                  <svg className="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Drafts
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                    statusFilter === 'active'
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-white text-gray-600 border border-gray-300 hover:bg-blue-50 hover:border-blue-300'
                  }`}
                >
                  <svg className="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Active
                </button>
                <button
                  onClick={() => setStatusFilter('completed')}
                  className={`px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                    statusFilter === 'completed'
                      ? 'bg-green-500 text-white shadow-md'
                      : 'bg-white text-gray-600 border border-gray-300 hover:bg-green-50 hover:border-green-300'
                  }`}
                >
                  <svg className="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Completed
                </button>
              </div>
            </div>
          </div>
          
          {/* Search */}
          <div className="w-full lg:w-auto">
            <label className="block text-sm font-medium text-gray-600 mb-2">Search</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search orders..."
                className="w-full lg:w-64 px-4 py-2 pl-10 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-700 placeholder-gray-400"
              />
              <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center border border-gray-200">
          <p className="text-gray-500">No orders found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const productNames = getOrderProductDetails(order.id)
            const sizes = getOrderSizes(order.id)
            const totalQty = getTotalQuantity(order.id)
            const isDraft = order.order_number.startsWith('DRAFT-')
            
            return (
              <div 
                key={order.id} 
                onClick={() => handleViewOrder(order)}
                className={`rounded-lg p-4 sm:p-6 transition-all duration-200 shadow-sm cursor-pointer ${
                  isDraft 
                    ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-400 hover:border-amber-500 hover:shadow-md' 
                    : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h3 className={`text-lg sm:text-xl font-semibold ${isDraft ? 'text-amber-600' : 'text-gray-800'}`}>
                        {order.order_number}
                      </h3>
                      <span className={`text-xs font-semibold px-3 py-1 rounded ${getStatusColor(order.status, isDraft)}`}>
                        {isDraft ? 'DRAFT' : order.status.replace('_', ' ').toUpperCase()}
                      </span>
                      {totalQty > 0 && (
                        <span className="text-xs font-semibold px-3 py-1 rounded bg-gray-100 text-gray-700">
                          {totalQty} units
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm text-gray-600 mb-3">
                      <div>
                        <span className="text-gray-500">Client:</span> {getClientName(order.client_id)}
                      </div>
                      <div>
                        <span className="text-gray-500">Manufacturer:</span> {getManufacturerName(order.manufacturer_id)}
                      </div>
                    </div>

                    {/* Product Details Section */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      {productNames.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-gray-500">Products:</span>
                            {productNames.map((name, index) => (
                              <span key={index} className={`px-2 py-1 rounded text-xs font-medium text-white ${
                                isDraft ? 'bg-amber-500' : 'bg-blue-600'
                              }`}>
                                {name}
                              </span>
                            ))}
                          </div>
                          
                          {sizes.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm text-gray-500">Sizes:</span>
                              {sizes.map((size, index) => (
                                <span key={index} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                                  {size}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No products added yet</p>
                      )}
                    </div>

                    <div className="mt-3 text-xs text-gray-500">
                      Created: {new Date(order.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="sm:ml-6 mt-4 sm:mt-0">
                    <button
                      onClick={() => handleViewOrder(order)}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 font-medium w-full sm:w-auto ${
                        isDraft 
                          ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {isDraft ? 'Edit' : 'View'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}