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
  Hash,
  CheckCircle,
  XCircle,
  Upload,
  DollarSign,
  FileText,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Download,
  Clock,
  AlertCircle
} from 'lucide-react'

interface OrderDetail {
  id: string
  order_number: string
  status: string
  created_at: string
  updated_at: string
  client: {
    name: string
    email: string
  }
  manufacturer: {
    name: string
    email: string
  }
  created_by: {
    name: string
    email: string
  }
  products: Array<{
    id: string
    product_id: string
    product_order_number: string
    product: {
      title: string
      description: string
    }
    variants: Array<{
      variant_type: string
      variant_value: string
    }>
    order_items: Array<{
      id: string
      variant_combo: string
      quantity: number
      notes: string
      admin_status: string
      manufacturer_status: string
      standard_price: number | null
      bulk_price: number | null
    }>
    order_media: Array<{
      id: string
      file_url: string
      file_type: string
      uploaded_by: {
        name: string
        role: string
      }
      created_at: string
    }>
  }>
  audit_log: Array<{
    id: string
    user_name: string
    action_type: string
    old_value: string | null
    new_value: string | null
    timestamp: string
  }>
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [activeMediaViewer, setActiveMediaViewer] = useState<{
    media: any[]
    currentIndex: number
  } | null>(null)
  const [uploadingMedia, setUploadingMedia] = useState<string | null>(null)
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      setUser(JSON.parse(userData))
    }
    fetchOrderDetails()
  }, [params.id])

  const fetchOrderDetails = async () => {
    try {
      // Fetch order with all related data
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          clients(name, email),
          manufacturers(name, email),
          users!orders_created_by_fkey(name, email)
        `)
        .eq('id', params.id)
        .single()

      if (orderError) {
        console.error('Order fetch error:', orderError)
        throw orderError
      }

      // Fetch order products with items and media
      const { data: productsData, error: productsError } = await supabase
        .from('order_products')
        .select(`
          *,
          products(title, description),
          order_items(*),
          order_media(*, users!order_media_uploaded_by_fkey(name, role))
        `)
        .eq('order_id', params.id)
        .order('created_at', { ascending: true })

      if (productsError) {
        console.error('Products fetch error:', productsError)
        throw productsError
      }

      // Fetch product variants for each product
      let productsWithVariants = []
      if (productsData && productsData.length > 0) {
        productsWithVariants = await Promise.all(
          productsData.map(async (orderProduct) => {
            // Fetch variants for this product
            const { data: variantsData, error: variantsError } = await supabase
              .from('product_variants')
              .select(`
                *,
                variant_options(
                  value,
                  variant_types(name)
                )
              `)
              .eq('product_id', orderProduct.product_id)

            if (variantsError) {
              console.error('Variants fetch error for product:', orderProduct.product_id, variantsError)
              // Continue without variants if there's an error
              return {
                ...orderProduct,
                product: orderProduct.products,
                variants: []
              }
            }

            const variants = variantsData?.map(v => ({
              variant_type: v.variant_options?.variant_types?.name || 'Unknown',
              variant_value: v.variant_options?.value || 'Unknown'
            })) || []

            return {
              ...orderProduct,
              product: orderProduct.products,
              variants
            }
          })
        )
      }

      // Fetch audit log
      const { data: auditData } = await supabase
        .from('audit_log')
        .select('*')
        .eq('target_id', params.id)
        .eq('target_type', 'order')
        .order('timestamp', { ascending: false })
        .limit(10)

      // Format the data properly
      const formattedOrder = {
        ...orderData,
        client: orderData.clients,
        manufacturer: orderData.manufacturers,
        created_by: orderData.users,
        products: productsWithVariants,
        audit_log: auditData || []
      }

      setOrder(formattedOrder)
    } catch (error) {
      console.error('Error fetching order:', error)
      showNotification('error', 'Failed to load order details')
    } finally {
      setLoading(false)
    }
  }

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  const handleApproveRejectItem = async (itemId: string, status: 'approved' | 'rejected', isManufacturer: boolean = false) => {
    try {
      const field = isManufacturer ? 'manufacturer_status' : 'admin_status'
      
      const { error } = await supabase
        .from('order_items')
        .update({ [field]: status })
        .eq('id', itemId)

      if (error) throw error

      // Log the action
      await supabase.from('audit_log').insert({
        user_id: user.id,
        user_name: user.name,
        action_type: `item_${status}`,
        target_type: 'order_item',
        target_id: itemId,
        new_value: status,
        timestamp: new Date().toISOString()
      })

      showNotification('success', `Item ${status} successfully`)
      fetchOrderDetails()
    } catch (error) {
      console.error('Error updating item status:', error)
      showNotification('error', 'Failed to update item status')
    }
  }

  const handleSetPricing = async (itemId: string, standardPrice: number, bulkPrice: number) => {
    try {
      const { error } = await supabase
        .from('order_items')
        .update({ 
          standard_price: standardPrice,
          bulk_price: bulkPrice
        })
        .eq('id', itemId)

      if (error) throw error

      showNotification('success', 'Pricing updated successfully')
      fetchOrderDetails()
    } catch (error) {
      console.error('Error updating pricing:', error)
      showNotification('error', 'Failed to update pricing')
    }
  }

  const handleUploadMedia = async (orderProductId: string, file: File) => {
    try {
      setUploadingMedia(orderProductId)
      
      const fileExt = file.name.split('.').pop()
      const fileName = `sample-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('order-media')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('order-media')
        .getPublicUrl(fileName)

      const { error: dbError } = await supabase
        .from('order_media')
        .insert({
          order_product_id: orderProductId,
          file_url: publicUrl,
          file_type: file.type.startsWith('image/') ? 'image' : 'video',
          uploaded_by: user.id
        })

      if (dbError) throw dbError

      showNotification('success', 'Media uploaded successfully')
      fetchOrderDetails()
    } catch (error) {
      console.error('Error uploading media:', error)
      showNotification('error', 'Failed to upload media')
    } finally {
      setUploadingMedia(null)
    }
  }

  const openMediaViewer = (media: any[], index: number) => {
    setActiveMediaViewer({ media, currentIndex: index })
  }

  const closeMediaViewer = () => {
    setActiveMediaViewer(null)
  }

  const navigateMedia = (direction: 'prev' | 'next') => {
    if (!activeMediaViewer) return
    
    const { media, currentIndex } = activeMediaViewer
    let newIndex = currentIndex
    
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : media.length - 1
    } else {
      newIndex = currentIndex < media.length - 1 ? currentIndex + 1 : 0
    }
    
    setActiveMediaViewer({ media, currentIndex: newIndex })
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-600',
      submitted: 'bg-blue-600',
      in_progress: 'bg-yellow-600',
      completed: 'bg-green-600',
      rejected: 'bg-red-600',
      pending: 'bg-gray-600',
      approved: 'bg-green-600'
    }
    return colors[status] || 'bg-gray-600'
  }

  const canEditOrder = () => {
    if (!user || !order) return false
    if (order.status !== 'draft') return false
    return user.role === 'super_admin' || 
           user.role === 'order_approver' ||
           (user.role === 'order_creator' && order.created_by.email === user.email)
  }

  const canApproveItems = () => {
    if (!user) return false
    return user.role === 'super_admin' || user.role === 'order_approver'
  }

  const canSetPricing = () => {
    if (!user) return false
    return user.role === 'manufacturer'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-gray-400 mb-4">Order not found</p>
        <button
          onClick={() => router.push('/dashboard/orders')}
          className="text-blue-400 hover:text-blue-300"
        >
          Back to Orders
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Notifications */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
          notification.type === 'error' ? 'bg-gradient-to-r from-red-500 to-pink-600' :
          'bg-gradient-to-r from-blue-500 to-indigo-600'
        } text-white`}>
          <p className="font-medium">{notification.message}</p>
        </div>
      )}

      {/* Media Viewer Modal */}
      {activeMediaViewer && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
          <button
            onClick={closeMediaViewer}
            className="absolute top-4 right-4 text-white hover:text-gray-300"
          >
            <X className="w-8 h-8" />
          </button>

          <button
            onClick={() => navigateMedia('prev')}
            className="absolute left-4 text-white hover:text-gray-300"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          <div className="max-w-4xl max-h-[90vh] flex items-center justify-center">
            {activeMediaViewer.media[activeMediaViewer.currentIndex].file_type === 'image' ? (
              <img
                src={activeMediaViewer.media[activeMediaViewer.currentIndex].file_url}
                alt="Media"
                className="max-w-full max-h-[90vh] object-contain"
              />
            ) : (
              <video
                src={activeMediaViewer.media[activeMediaViewer.currentIndex].file_url}
                controls
                className="max-w-full max-h-[90vh]"
              />
            )}
          </div>

          <button
            onClick={() => navigateMedia('next')}
            className="absolute right-4 text-white hover:text-gray-300"
          >
            <ChevronRight className="w-8 h-8" />
          </button>

          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white">
            {activeMediaViewer.currentIndex + 1} / {activeMediaViewer.media.length}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-800 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/dashboard/orders')}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-white">Order Details</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${getStatusColor(order.status)}`}>
              {order.status.toUpperCase()}
            </span>
          </div>
          {canEditOrder() && (
            <button
              onClick={() => router.push(`/dashboard/orders/edit/${order.id}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Edit Order
            </button>
          )}
        </div>

        {/* Order Name Display */}
        <div className="mb-4">
          <h2 className="text-3xl font-bold text-white">{order.order_number}</h2>
        </div>

        {/* Order Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center space-x-3 text-gray-300">
            <Hash className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-xs text-gray-500">Order Number</p>
              <p className="font-semibold">{order.order_number}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 text-gray-300">
            <User className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-xs text-gray-500">Client</p>
              <p className="font-semibold">{order.client.name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 text-gray-300">
            <Building2 className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-xs text-gray-500">Manufacturer</p>
              <p className="font-semibold">{order.manufacturer.name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 text-gray-300">
            <Calendar className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-xs text-gray-500">Created</p>
              <p className="font-semibold">{new Date(order.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Products Section */}
      <div className="space-y-6 mb-6">
        <h2 className="text-xl font-bold text-white">Products</h2>
        
        {order.products.map((orderProduct) => (
          <div key={orderProduct.id} className="bg-slate-800 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <Package className="w-5 h-5 mr-2" />
                  {orderProduct.product.title}
                </h3>
                <p className="text-sm text-gray-400 mt-1">{orderProduct.product.description}</p>
                <p className="text-xs text-gray-500 mt-1">Product Order: {orderProduct.product_order_number}</p>
                
                {/* Display Product Variants */}
                {orderProduct.variants && orderProduct.variants.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-400 mb-2">Available Variants:</p>
                    <div className="flex flex-wrap gap-2">
                      {orderProduct.variants.reduce((acc, variant) => {
                        const existingType = acc.find(v => v.type === variant.variant_type)
                        if (existingType) {
                          if (!existingType.values.includes(variant.variant_value)) {
                            existingType.values.push(variant.variant_value)
                          }
                        } else {
                          acc.push({ type: variant.variant_type, values: [variant.variant_value] })
                        }
                        return acc
                      }, [] as { type: string; values: string[] }[]).map((variantGroup) => (
                        <div key={variantGroup.type} className="bg-slate-700 px-3 py-1 rounded">
                          <span className="text-xs text-gray-400">{variantGroup.type}: </span>
                          <span className="text-xs text-white font-medium">
                            {variantGroup.values.join(', ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Media Section */}
            {orderProduct.order_media && orderProduct.order_media.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-400 mb-2">Media Files</h4>
                <div className="grid grid-cols-6 gap-2">
                  {orderProduct.order_media.map((media, index) => (
                    <div
                      key={media.id}
                      className="relative group cursor-pointer"
                      onClick={() => openMediaViewer(orderProduct.order_media, index)}
                    >
                      {media.file_type === 'image' ? (
                        <img
                          src={media.file_url}
                          alt="Product media"
                          className="w-full h-20 object-cover rounded"
                        />
                      ) : (
                        <div className="w-full h-20 bg-slate-700 rounded flex items-center justify-center">
                          <Play className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                        <Eye className="w-4 h-4 text-white" />
                      </div>
                      <span className="absolute bottom-0 left-0 right-0 text-xs text-white bg-black bg-opacity-50 px-1 truncate">
                        {media.uploaded_by?.role === 'manufacturer' ? 'Sample' : 'Reference'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Items Table */}
            {orderProduct.order_items && orderProduct.order_items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-slate-700">
                      <th className="pb-2 text-sm font-semibold text-gray-400">Variant Combination</th>
                      <th className="pb-2 text-sm font-semibold text-gray-400">Quantity</th>
                      <th className="pb-2 text-sm font-semibold text-gray-400">Notes</th>
                      {(canApproveItems() || canSetPricing()) && (
                        <>
                          <th className="pb-2 text-sm font-semibold text-gray-400">Admin Status</th>
                          <th className="pb-2 text-sm font-semibold text-gray-400">Manufacturer Status</th>
                        </>
                      )}
                      {canSetPricing() && (
                        <th className="pb-2 text-sm font-semibold text-gray-400">Pricing</th>
                      )}
                      <th className="pb-2 text-sm font-semibold text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderProduct.order_items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-700">
                        <td className="py-3 text-sm text-gray-300">{item.variant_combo}</td>
                        <td className="py-3 text-sm text-gray-300">{item.quantity}</td>
                        <td className="py-3 text-sm text-gray-300">{item.notes || '-'}</td>
                        {(canApproveItems() || canSetPricing()) && (
                          <>
                            <td className="py-3">
                              <span className={`px-2 py-1 rounded text-xs font-semibold text-white ${getStatusColor(item.admin_status)}`}>
                                {item.admin_status}
                              </span>
                            </td>
                            <td className="py-3">
                              <span className={`px-2 py-1 rounded text-xs font-semibold text-white ${getStatusColor(item.manufacturer_status)}`}>
                                {item.manufacturer_status}
                              </span>
                            </td>
                          </>
                        )}
                        {canSetPricing() && (
                          <td className="py-3 text-sm text-gray-300">
                            {item.standard_price ? (
                              <div>
                                <p>Std: ${item.standard_price}</p>
                                <p>Bulk: ${item.bulk_price}</p>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  const std = prompt('Enter standard price:')
                                  const bulk = prompt('Enter bulk price:')
                                  if (std && bulk) {
                                    handleSetPricing(item.id, parseFloat(std), parseFloat(bulk))
                                  }
                                }}
                                className="text-blue-400 hover:text-blue-300"
                              >
                                <DollarSign className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        )}
                        <td className="py-3">
                          <div className="flex space-x-2">
                            {canApproveItems() && item.admin_status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApproveRejectItem(item.id, 'approved')}
                                  className="text-green-400 hover:text-green-300"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleApproveRejectItem(item.id, 'rejected')}
                                  className="text-red-400 hover:text-red-300"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {canSetPricing() && item.manufacturer_status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApproveRejectItem(item.id, 'approved', true)}
                                  className="text-green-400 hover:text-green-300"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleApproveRejectItem(item.id, 'rejected', true)}
                                  className="text-red-400 hover:text-red-300"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Upload Media for Manufacturers */}
            {canSetPricing() && (
              <div className="mt-4">
                <label className="block text-sm font-semibold text-gray-400 mb-2">
                  Upload Sample Media
                </label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleUploadMedia(orderProduct.id, e.target.files[0])
                    }
                  }}
                  disabled={uploadingMedia === orderProduct.id}
                  className="block w-full text-sm text-gray-400
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-slate-700 file:text-white
                    hover:file:bg-slate-600"
                />
                {uploadingMedia === orderProduct.id && (
                  <p className="text-xs text-gray-500 mt-2">Uploading...</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Audit Log */}
      {order.audit_log && order.audit_log.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Activity History
          </h2>
          <div className="space-y-2">
            {order.audit_log.map((log) => (
              <div key={log.id} className="flex items-start space-x-3 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                <div className="flex-1">
                  <p className="text-gray-300">
                    <span className="font-semibold text-white">{log.user_name}</span>
                    {' '}
                    <span>{log.action_type.replace('_', ' ')}</span>
                    {log.new_value && (
                      <>
                        {' to '}
                        <span className="font-semibold text-blue-400">{log.new_value}</span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}