'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, 
  Package, 
  User, 
  Building2, 
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Upload,
  Image as ImageIcon,
  Video,
  X,
  ChevronLeft,
  ChevronRight,
  Mail,
  Loader2,
  Hash,
  FileText
} from 'lucide-react'
import EmailModal from '@/components/email/EmailModal'

interface OrderDetail {
  id: string
  order_number: string
  order_name?: string  // Adding order_name field
  name?: string        // Alternative field name
  status: string
  created_at: string
  updated_at: string
  created_by: string
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
  products: Array<{
    id: string
    product_order_number: string
    product: {
      id: string
      title: string
      description: string
    }
    variants?: Array<{
      type: string
      value: string
    }>
    items: Array<{
      id: string
      variant_combo: string
      quantity: number
      notes: string
      admin_status: string
      manufacturer_status: string
      standard_price: number
      bulk_price: number
    }>
    media: Array<{
      id: string
      file_url: string
      file_type: string
      uploaded_by: string
    }>
  }>
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [mediaModalOpen, setMediaModalOpen] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<any[]>([])
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0)
  const [savingPrice, setSavingPrice] = useState<string | null>(null)
  const [approvingItem, setApprovingItem] = useState<string | null>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  
  // Email modal states
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailRecipientType, setEmailRecipientType] = useState<'manufacturer' | 'client'>('manufacturer')

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (!userData) {
      router.push('/')
      return
    }
    setUser(JSON.parse(userData))
    fetchOrderDetails()
  }, [params.id])

  // Helper function to generate client prefix
  const getClientPrefix = (clientName: string) => {
    // Take first 3 characters of each word in client name
    const words = clientName.trim().split(' ')
    if (words.length === 1) {
      // Single word: take first 3 characters
      return clientName.substring(0, 3).toUpperCase()
    } else {
      // Multiple words: take first character of each word (up to 3 words)
      return words.slice(0, 3).map(w => w[0]).join('').toUpperCase()
    }
  }

  const fetchOrderDetails = async () => {
    try {
      // Fetch the order with all fields including potential order_name or name field
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(*),
          manufacturer:manufacturers(*),
          products:order_products(
            *,
            product:products(*),
            items:order_items(*),
            media:order_media(*)
          )
        `)
        .eq('id', params.id)
        .single()

      if (error) throw error
      
      console.log('Full order data:', data) // DEBUG - check all fields
      console.log('Order fields:', Object.keys(data)) // DEBUG - see what fields exist
      
      // Fetch variants for each product
      if (data && data.products) {
        const productsWithVariants = await Promise.all(
          data.products.map(async (orderProduct: any) => {
            // Method 1: Try to fetch from product_variants table
            const { data: variantData, error: variantError } = await supabase
              .from('product_variants')
              .select(`
                id,
                variant_option_id,
                product_id,
                variant_options (
                  id,
                  value,
                  type_id,
                  variant_types (
                    id,
                    name
                  )
                )
              `)
              .eq('product_id', orderProduct.product.id)

            console.log('Variant data for product', orderProduct.product.title, ':', variantData)
            
            let variants: { type: string; value: string }[] = []
            
            if (!variantError && variantData && variantData.length > 0) {
              // Extract variants from database
              variants = variantData.map((pv: any) => ({
                type: pv.variant_options?.variant_types?.name || 'Unknown',
                value: pv.variant_options?.value || 'Unknown'
              })).filter(v => v.type !== 'Unknown' && v.value !== 'Unknown')
            }
            
            // Method 2: If no variants from DB, extract from order items
            if (variants.length === 0 && orderProduct.items && orderProduct.items.length > 0) {
              const uniqueVariants = new Map<string, Set<string>>()
              
              orderProduct.items.forEach((item: any) => {
                if (item.variant_combo) {
                  // Parse "Size: M, Color: Red, Fabric: Cotton"
                  const parts = item.variant_combo.split(',').map((p: string) => p.trim())
                  parts.forEach((part: string) => {
                    if (part.includes(':')) {
                      const [type, value] = part.split(':').map((s: string) => s.trim())
                      if (type && value) {
                        if (!uniqueVariants.has(type)) {
                          uniqueVariants.set(type, new Set())
                        }
                        uniqueVariants.get(type)!.add(value)
                      }
                    }
                  })
                }
              })
              
              // Convert to array
              uniqueVariants.forEach((values, type) => {
                values.forEach(value => {
                  variants.push({ type, value })
                })
              })
            }
            
            console.log('Final variants for product:', variants)
            
            return {
              ...orderProduct,
              variants
            }
          })
        )
        
        setOrder({
          ...data,
          products: productsWithVariants
        })
      } else {
        setOrder(data)
      }
    } catch (error) {
      console.error('Error fetching order:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateOrderStatus = async (newStatus: string) => {
    if (!order) return

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', order.id)

      if (error) throw error

      fetchOrderDetails()
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const handleApproveRejectItem = async (itemId: string, status: 'approved' | 'rejected', type: 'admin' | 'manufacturer') => {
    setApprovingItem(itemId)
    try {
      const field = type === 'admin' ? 'admin_status' : 'manufacturer_status'
      const { error } = await supabase
        .from('order_items')
        .update({ [field]: status })
        .eq('id', itemId)

      if (error) throw error

      fetchOrderDetails()
    } catch (error) {
      console.error('Error updating item status:', error)
    } finally {
      setApprovingItem(null)
    }
  }

  const handlePriceUpdate = async (itemId: string, priceType: 'standard_price' | 'bulk_price', value: string) => {
    setSavingPrice(itemId)
    try {
      const { error } = await supabase
        .from('order_items')
        .update({ [priceType]: parseFloat(value) || 0 })
        .eq('id', itemId)

      if (error) throw error

      fetchOrderDetails()
    } catch (error) {
      console.error('Error updating price:', error)
    } finally {
      setSavingPrice(null)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, orderProductId: string) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingFor(orderProductId)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `sample-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${order?.id}/${orderProductId}/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('order-media')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Save to database
      const { error: dbError } = await supabase
        .from('order_media')
        .insert({
          order_product_id: orderProductId,
          file_url: filePath,
          file_type: file.type.startsWith('image/') ? 'image' : 'video',
          uploaded_by: user?.id
        })

      if (dbError) throw dbError

      fetchOrderDetails()
    } catch (error) {
      console.error('Error uploading file:', error)
    } finally {
      setUploadingFor(null)
    }
  }

  const openMediaModal = (media: any[]) => {
    setSelectedMedia(media)
    setCurrentMediaIndex(0)
    setMediaModalOpen(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-500 text-white'
      case 'submitted': return 'bg-blue-500 text-white'
      case 'in_progress': return 'bg-yellow-500 text-white'
      case 'completed': return 'bg-green-500 text-white'
      case 'rejected': return 'bg-red-500 text-white'
      case 'pending': return 'bg-gray-500 text-white'
      case 'approved': return 'bg-green-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const canEditOrder = () => {
    if (!user || !order) return false
    if (order.status !== 'draft') return false
    return user.role === 'super_admin' || 
           user.role === 'order_approver' || 
           user.role === 'order_creator'
  }

  const canChangeStatus = () => {
    if (!user || !order) return false
    return user.role === 'super_admin' || user.role === 'order_approver'
  }

  const canApproveItems = () => {
    if (!user || !order) return false
    if (order.status === 'draft') return false
    return user.role === 'super_admin' || user.role === 'order_approver'
  }

  const canEditPrices = () => {
    if (!user || !order) return false
    if (order.status === 'draft') return false
    return user.role === 'manufacturer'
  }

  const canUploadSamples = () => {
    if (!user || !order) return false
    if (order.status === 'draft') return false
    return user.role === 'manufacturer'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Order not found</p>
          <button
            onClick={() => router.push('/dashboard/orders')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Back to Orders
          </button>
        </div>
      </div>
    )
  }

  // Generate the custom order ID with client prefix
  const clientPrefix = getClientPrefix(order.client.name)
  const customOrderId = `${clientPrefix}-${order.order_number.replace('ORD-', '')}`

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/orders')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Orders
        </button>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* PROMINENT ORDER INFORMATION DISPLAY */}
          <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            {/* Order Name if it exists */}
            {(order.order_name || order.name) && (
              <div className="mb-4">
                <div className="flex items-center justify-center mb-2">
                  <FileText className="w-6 h-6 text-blue-600 mr-2" />
                  <h2 className="text-xl font-semibold text-gray-700">Order Name</h2>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 text-center">
                  {order.order_name || order.name}
                </h1>
              </div>
            )}
            
            {/* Custom Order ID with Client Prefix */}
            <div className={`${(order.order_name || order.name) ? 'border-t border-blue-200 pt-4' : ''}`}>
              <div className="flex items-center justify-center mb-2">
                <Hash className="w-5 h-5 text-blue-600 mr-2" />
                <p className="text-lg font-medium text-gray-700">Order ID</p>
              </div>
              <p className="text-2xl font-bold text-gray-900 text-center">
                {customOrderId}
              </p>
              <p className="text-sm text-gray-500 text-center mt-1">
                (System ID: {order.order_number})
              </p>
            </div>
          </div>
          
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center space-x-4">
                <span className="flex items-center text-gray-600">
                  <Calendar className="w-4 h-4 mr-1" />
                  {new Date(order.created_at).toLocaleDateString()}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                  {order.status.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="flex space-x-3">
              {canEditOrder() && (
                <button
                  onClick={() => router.push(`/dashboard/orders/edit/${order.id}`)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Edit Order
                </button>
              )}
              
              <button
                onClick={() => {
                  setEmailRecipientType('manufacturer')
                  setEmailModalOpen(true)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 font-medium"
              >
                <Mail className="w-4 h-4" />
                <span>Email Manufacturer</span>
              </button>
              
              <button
                onClick={() => {
                  setEmailRecipientType('client')
                  setEmailModalOpen(true)
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2 font-medium"
              >
                <Mail className="w-4 h-4" />
                <span>Email Client</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center text-gray-600 mb-2">
                <User className="w-4 h-4 mr-2" />
                Client
              </div>
              <div className="text-gray-900 font-semibold">{order.client.name}</div>
              <div className="text-sm text-gray-600">{order.client.email}</div>
              <div className="text-xs text-gray-500 mt-1">Prefix: {clientPrefix}</div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center text-gray-600 mb-2">
                <Building2 className="w-4 h-4 mr-2" />
                Manufacturer
              </div>
              <div className="text-gray-900 font-semibold">{order.manufacturer.name}</div>
              <div className="text-sm text-gray-600">{order.manufacturer.email}</div>
            </div>
          </div>

          {canChangeStatus() && order.status !== 'completed' && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center space-x-3">
                <span className="text-gray-600 font-medium">Change Status:</span>
                {order.status === 'draft' && (
                  <button
                    onClick={() => updateOrderStatus('submitted')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Submit Order
                  </button>
                )}
                {order.status === 'submitted' && (
                  <>
                    <button
                      onClick={() => updateOrderStatus('in_progress')}
                      className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium"
                    >
                      Mark In Progress
                    </button>
                    <button
                      onClick={() => updateOrderStatus('rejected')}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                    >
                      Reject Order
                    </button>
                  </>
                )}
                {order.status === 'in_progress' && (
                  <button
                    onClick={() => updateOrderStatus('completed')}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                  >
                    Mark Completed
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Products */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Products</h2>
        
        {order.products && order.products.map((orderProduct) => (
          <div key={orderProduct.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <Package className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    {orderProduct.product.title}
                  </h3>
                  <span className="text-sm text-gray-500">
                    ({orderProduct.product_order_number})
                  </span>
                </div>
                {orderProduct.product.description && (
                  <p className="text-sm text-gray-600 mt-2">
                    {orderProduct.product.description}
                  </p>
                )}
              </div>

              {canUploadSamples && (
                <div>
                  <label className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors cursor-pointer flex items-center space-x-2 font-medium">
                    <Upload className="w-4 h-4" />
                    <span>Upload Sample</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,video/*"
                      onChange={(e) => handleFileUpload(e, orderProduct.id)}
                      disabled={uploadingFor === orderProduct.id}
                    />
                  </label>
                  {uploadingFor === orderProduct.id && (
                    <div className="text-sm text-gray-500 mt-2">Uploading...</div>
                  )}
                </div>
              )}
            </div>

            {/* Media */}
            {orderProduct.media && orderProduct.media.length > 0 && (
              <div className="mb-4">
                <button
                  onClick={() => openMediaModal(orderProduct.media)}
                  className="text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-2 font-medium"
                >
                  {orderProduct.media[0].file_type === 'image' ? (
                    <ImageIcon className="w-4 h-4" />
                  ) : (
                    <Video className="w-4 h-4" />
                  )}
                  <span>View {orderProduct.media.length} media file(s)</span>
                </button>
              </div>
            )}

            {/* Items Table */}
            {orderProduct.items && orderProduct.items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-y border-gray-200">
                    <tr className="text-left text-sm text-gray-700">
                      <th className="py-3 px-4 font-semibold">Variant</th>
                      <th className="py-3 px-4 font-semibold">Quantity</th>
                      <th className="py-3 px-4 font-semibold">Notes</th>
                      {canEditPrices && (
                        <>
                          <th className="py-3 px-4 font-semibold">Standard Price</th>
                          <th className="py-3 px-4 font-semibold">Bulk Price</th>
                        </>
                      )}
                      <th className="py-3 px-4 font-semibold">Admin Status</th>
                      {user?.role === 'manufacturer' && (
                        <th className="py-3 px-4 font-semibold">Manufacturer Status</th>
                      )}
                      {(canApproveItems || canEditPrices) && (
                        <th className="py-3 px-4 font-semibold">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {orderProduct.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-900">{item.variant_combo}</td>
                        <td className="py-3 px-4 text-gray-900">{item.quantity}</td>
                        <td className="py-3 px-4 text-gray-600">{item.notes || '-'}</td>
                        
                        {canEditPrices && (
                          <>
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-2">
                                <DollarSign className="w-4 h-4 text-gray-400" />
                                <input
                                  type="number"
                                  step="0.01"
                                  defaultValue={item.standard_price || ''}
                                  onBlur={(e) => handlePriceUpdate(item.id, 'standard_price', e.target.value)}
                                  className="w-24 px-2 py-1 border border-gray-300 rounded text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                  placeholder="0.00"
                                />
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-2">
                                <DollarSign className="w-4 h-4 text-gray-400" />
                                <input
                                  type="number"
                                  step="0.01"
                                  defaultValue={item.bulk_price || ''}
                                  onBlur={(e) => handlePriceUpdate(item.id, 'bulk_price', e.target.value)}
                                  className="w-24 px-2 py-1 border border-gray-300 rounded text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                  placeholder="0.00"
                                />
                              </div>
                            </td>
                          </>
                        )}
                        
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(item.admin_status)}`}>
                            {item.admin_status}
                          </span>
                        </td>
                        
                        {user?.role === 'manufacturer' && (
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(item.manufacturer_status)}`}>
                              {item.manufacturer_status}
                            </span>
                          </td>
                        )}
                        
                        {(canApproveItems || canEditPrices) && (
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              {canApproveItems && item.admin_status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleApproveRejectItem(item.id, 'approved', 'admin')}
                                    disabled={approvingItem === item.id}
                                    className="text-green-600 hover:text-green-700 disabled:opacity-50"
                                  >
                                    {approvingItem === item.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <CheckCircle className="w-4 h-4" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleApproveRejectItem(item.id, 'rejected', 'admin')}
                                    disabled={approvingItem === item.id}
                                    className="text-red-600 hover:text-red-700 disabled:opacity-50"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              
                              {canEditPrices && item.manufacturer_status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleApproveRejectItem(item.id, 'approved', 'manufacturer')}
                                    disabled={approvingItem === item.id}
                                    className="text-green-600 hover:text-green-700 disabled:opacity-50"
                                  >
                                    {approvingItem === item.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <CheckCircle className="w-4 h-4" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleApproveRejectItem(item.id, 'rejected', 'manufacturer')}
                                    disabled={approvingItem === item.id}
                                    className="text-red-600 hover:text-red-700 disabled:opacity-50"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Media Modal */}
      {mediaModalOpen && selectedMedia.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
          <button
            onClick={() => setMediaModalOpen(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-50"
          >
            <X className="w-8 h-8" />
          </button>

          {selectedMedia.length > 1 && (
            <>
              <button
                onClick={() => setCurrentMediaIndex(Math.max(0, currentMediaIndex - 1))}
                className="absolute left-4 text-white hover:text-gray-300"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                onClick={() => setCurrentMediaIndex(Math.min(selectedMedia.length - 1, currentMediaIndex + 1))}
                className="absolute right-4 text-white hover:text-gray-300"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}

          <div className="max-w-4xl max-h-screen p-4">
            {selectedMedia[currentMediaIndex].file_type === 'image' ? (
              <img
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/order-media/${selectedMedia[currentMediaIndex].file_url}`}
                alt="Order media"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <video
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/order-media/${selectedMedia[currentMediaIndex].file_url}`}
                controls
                className="max-w-full max-h-full"
              />
            )}
          </div>

          {selectedMedia.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white">
              {currentMediaIndex + 1} / {selectedMedia.length}
            </div>
          )}
        </div>
      )}

      {/* Email Modal */}
      {emailModalOpen && order && (
        <EmailModal
          isOpen={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          order={order}
          recipientType={emailRecipientType}
          recipientEmail={
            emailRecipientType === 'manufacturer' 
              ? order.manufacturer.email 
              : order.client.email
          }
          recipientName={
            emailRecipientType === 'manufacturer' 
              ? order.manufacturer.name 
              : order.client.name
          }
        />
      )}
    </div>
  )
}