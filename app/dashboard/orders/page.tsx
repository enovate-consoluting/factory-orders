'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Plus, 
  Search, 
  Filter, 
  Package, 
  Calendar, 
  Building2, 
  User,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Hash,
  FileText,
  ChevronDown,
  ChevronUp,
  Tag,
  Trash2
} from 'lucide-react'

interface Order {
  id: string
  order_number: string
  order_name?: string
  status: string
  created_at: string
  client: {
    id: string
    name: string
    email: string
  }
  manufacturer: {
    id: string
    name: string
    email: string
  }
  products?: Array<{
    id: string
    product: {
      title: string
      description: string
    }
    items: Array<{
      variant_combo: string
      quantity: number
    }>
  }>
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [user, setUser] = useState<any>(null)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (!userData) {
      router.push('/')
      return
    }
    setUser(JSON.parse(userData))
    fetchOrders()
  }, [])

  // Helper function to extract unique variants from items
  const extractVariantsFromItems = (items: any[]) => {
    const variantMap = new Map<string, Set<string>>()
    
    items.forEach(item => {
      if (item.variant_combo) {
        const parts = item.variant_combo.split(',').map(p => p.trim())
        parts.forEach(part => {
          if (part.includes(':')) {
            const [type, value] = part.split(':').map(s => s.trim())
            if (type && value) {
              if (!variantMap.has(type)) {
                variantMap.set(type, new Set())
              }
              variantMap.get(type)!.add(value)
            }
          }
        })
      }
    })
    
    return variantMap
  }

  const fetchOrders = async () => {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          client:clients(*),
          manufacturer:manufacturers(*),
          products:order_products(
            id,
            product:products(title, description),
            items:order_items(variant_combo, quantity)
          )
        `)
        .order('created_at', { ascending: false })

      // Filter based on user role
      if (user?.role === 'manufacturer') {
        query = query.neq('status', 'draft')
      }

      const { data, error } = await query

      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.order_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.manufacturer.name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesFilter = filterStatus === 'all' || order.status === filterStatus
    
    return matchesSearch && matchesFilter
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700'
      case 'submitted': return 'bg-blue-100 text-blue-700'
      case 'in_progress': return 'bg-yellow-100 text-yellow-700'
      case 'completed': return 'bg-green-100 text-green-700'
      case 'rejected': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Edit className="w-4 h-4" />
      case 'submitted': return <Clock className="w-4 h-4" />
      case 'in_progress': return <AlertCircle className="w-4 h-4" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'rejected': return <XCircle className="w-4 h-4" />
      default: return null
    }
  }

  const toggleOrderExpansion = (orderId: string) => {
    const newExpanded = new Set(expandedOrders)
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId)
    } else {
      newExpanded.add(orderId)
    }
    setExpandedOrders(newExpanded)
  }

  const canCreateOrder = () => {
    return user?.role === 'super_admin' || 
           user?.role === 'order_creator' || 
           user?.role === 'order_approver'
  }

  const canDeleteOrder = () => {
    return user?.role === 'super_admin'
  }

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return
    
    setDeleting(true)
    try {
      // Delete related records first (due to foreign key constraints)
      // Delete order_items
      const { data: orderProducts } = await supabase
        .from('order_products')
        .select('id')
        .eq('order_id', orderToDelete.id)
      
      if (orderProducts && orderProducts.length > 0) {
        const productIds = orderProducts.map(p => p.id)
        
        // Delete order_items
        await supabase
          .from('order_items')
          .delete()
          .in('order_product_id', productIds)
        
        // Delete order_media
        await supabase
          .from('order_media')
          .delete()
          .in('order_product_id', productIds)
        
        // Delete order_products
        await supabase
          .from('order_products')
          .delete()
          .eq('order_id', orderToDelete.id)
      }
      
      // Finally delete the order
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderToDelete.id)
      
      if (error) throw error
      
      // Refresh the orders list
      fetchOrders()
      
      // Close modal
      setDeleteModalOpen(false)
      setOrderToDelete(null)
    } catch (error) {
      console.error('Error deleting order:', error)
      alert('Failed to delete order. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const openDeleteModal = (order: Order) => {
    setOrderToDelete(order)
    setDeleteModalOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
            {canCreateOrder() && (
              <button
                onClick={() => router.push('/dashboard/orders/create')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>New Order</span>
              </button>
            )}
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search orders, clients, or manufacturers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders Grid */}
        <div className="grid gap-4">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No orders found</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isExpanded = expandedOrders.has(order.id)
              
              return (
                <div key={order.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow relative">
                  <div className="p-6">
                    {/* Order Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        {/* Order Name and IDs */}
                        <div className="mb-3">
                          {order.order_name && (
                            <div className="flex items-center mb-2">
                              <FileText className="w-5 h-5 text-blue-600 mr-2" />
                              <h3 className="text-lg font-semibold text-gray-900">{order.order_name}</h3>
                            </div>
                          )}
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center">
                              <Hash className="w-4 h-4 text-gray-400 mr-1" />
                              <span className="text-sm font-medium text-gray-700">
                                ID: {order.order_number}
                              </span>
                            </div>
                            {/* Only show system ID if it's different from order_number (for old orders) */}
                            {order.order_number.startsWith('ORD-') && (
                              <span className="text-xs text-gray-500">(System: {order.order_number})</span>
                            )}
                          </div>
                        </div>

                        {/* Status and Date */}
                        <div className="flex items-center space-x-4 mb-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(order.status)}`}>
                            {getStatusIcon(order.status)}
                            <span>{order.status.replace('_', ' ').toUpperCase()}</span>
                          </span>
                          <div className="flex items-center text-sm text-gray-500">
                            <Calendar className="w-4 h-4 mr-1" />
                            {new Date(order.created_at).toLocaleDateString()}
                          </div>
                        </div>

                        {/* Client and Manufacturer */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-lg">
                            <User className="w-4 h-4 text-gray-500" />
                            <div>
                              <p className="text-xs text-gray-500">Client</p>
                              <p className="text-sm font-medium text-gray-900">{order.client.name}</p>
                              {/* Extract prefix from order number if it exists */}
                              {order.order_number && !order.order_number.startsWith('ORD-') && (
                                <p className="text-xs text-gray-500">
                                  Prefix: {order.order_number.split('-')[0]}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-lg">
                            <Building2 className="w-4 h-4 text-gray-500" />
                            <div>
                              <p className="text-xs text-gray-500">Manufacturer</p>
                              <p className="text-sm font-medium text-gray-900">{order.manufacturer.name}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Top Right Actions (View and Products toggle) */}
                      <div className="flex items-start space-x-2 ml-4">
                        <button
                          onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center space-x-1 text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View</span>
                        </button>
                        {order.products && order.products.length > 0 && (
                          <button
                            onClick={() => toggleOrderExpansion(order.id)}
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors flex items-center space-x-1 text-sm"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                <span>Hide</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                <span>Products ({order.products.length})</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Products Section */}
                    {isExpanded && order.products && order.products.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                          <Package className="w-4 h-4 mr-2 text-blue-600" />
                          Order Products
                        </h4>
                        <div className="space-y-3">
                          {order.products.map((product) => {
                            const variantMap = extractVariantsFromItems(product.items)
                            const totalQuantity = product.items.reduce((sum, item) => sum + item.quantity, 0)
                            
                            return (
                              <div key={product.id} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="mb-2">
                                  <h5 className="font-medium text-gray-900">{product.product.title}</h5>
                                  {product.product.description && (
                                    <p className="text-sm text-gray-600 mt-1">{product.product.description}</p>
                                  )}
                                  <p className="text-sm text-gray-500 mt-1">Total Quantity: {totalQuantity} units</p>
                                </div>
                                
                                {/* Variants Display */}
                                {variantMap.size > 0 && (
                                  <div className="mt-2">
                                    <div className="flex items-center mb-2">
                                      <Tag className="w-4 h-4 text-blue-600 mr-1" />
                                      <span className="text-xs font-semibold text-gray-700">Variants in this order:</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {Array.from(variantMap.entries()).map(([type, values]) => (
                                        <div key={type} className="bg-white border border-gray-300 px-2 py-1 rounded text-xs">
                                          <span className="font-medium text-gray-700">{type}:</span>
                                          <span className="ml-1 text-gray-600">{Array.from(values).join(', ')}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Delete Button - Bottom Right Corner */}
                  {canDeleteOrder() && (
                    <div className="absolute bottom-4 right-4">
                      <button
                        onClick={() => openDeleteModal(order)}
                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                        title="Delete Order"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && orderToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="mb-4">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Delete Order
              </h3>
              <p className="text-sm text-gray-600 text-center">
                Are you sure you want to delete this order? This action cannot be undone.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="space-y-2">
                {orderToDelete.order_name && (
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-900">{orderToDelete.order_name}</span>
                  </div>
                )}
                <div className="flex items-center">
                  <Hash className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-700">ID: {orderToDelete.order_number}</span>
                </div>
                <div className="flex items-center">
                  <User className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-700">Client: {orderToDelete.client.name}</span>
                </div>
                <div className="flex items-center">
                  <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-700">Manufacturer: {orderToDelete.manufacturer.name}</span>
                </div>
                <div className="flex items-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(orderToDelete.status)}`}>
                    {orderToDelete.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
              <p className="font-medium mb-1">⚠️ Warning</p>
              <p>Deleting this order will also remove:</p>
              <ul className="list-disc list-inside mt-1 text-xs">
                <li>All product items and quantities</li>
                <li>All uploaded media files</li>
                <li>All pricing information</li>
                <li>All approval statuses</li>
              </ul>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setDeleteModalOpen(false)
                  setOrderToDelete(null)
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteOrder}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Order
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}