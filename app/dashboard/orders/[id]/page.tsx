'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

type Order = {
  id: string
  order_number: string
  client_id: string
  manufacturer_id: string
  status: string
  created_at: string
  created_by: string
}

type OrderProduct = {
  id: string
  order_id: string
  product_id: string
  product_order_number: string
}

type OrderItem = {
  id: string
  order_product_id: string
  variant_combo: string
  quantity: number
  notes: string | null
  admin_status: string
  manufacturer_status: string
  standard_price: number | null
  bulk_price: number | null
}

export default function OrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [orderProducts, setOrderProducts] = useState<OrderProduct[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [manufacturers, setManufacturers] = useState<any[]>([])
  const [variantOptions, setVariantOptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [expandedProducts, setExpandedProducts] = useState<{ [key: string]: boolean }>({})
  const [orderMedia, setOrderMedia] = useState<any[]>([])
  const [viewingMedia, setViewingMedia] = useState<{ url: string; type: string; title: string } | null>(null)
  const [viewingMediaIndex, setViewingMediaIndex] = useState(0)
  const [viewingMediaList, setViewingMediaList] = useState<any[]>([])
  const [uploadingMedia, setUploadingMedia] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    const role = localStorage.getItem('userRole')
    setUserRole(role || '')
    
    if (orderId) {
      loadOrderData()
    }
  }, [orderId])

  useEffect(() => {
    // Auto-expand products in negotiation, collapse completed/ready ones
    if (orderProducts.length > 0) {
      const expanded: { [key: string]: boolean } = {}
      orderProducts.forEach(op => {
        const status = getProductStatus(op.id)
        // Expand yellow (negotiation), collapse green/blue/gray
        expanded[op.id] = status === 'negotiation'
      })
      setExpandedProducts(expanded)
    }
  }, [orderProducts, orderItems])

  useEffect(() => {
    // Auto-hide notification after 4 seconds
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const loadOrderData = async () => {
    setLoading(true)

    const [orderRes, productsRes, clientsRes, mfrsRes, variantsRes, orderProductsRes, itemsRes, auditRes, mediaRes] = await Promise.all([
      supabase.from('orders').select('*').eq('id', orderId).single(),
      supabase.from('products').select('*'),
      supabase.from('clients').select('*'),
      supabase.from('manufacturers').select('*'),
      supabase.from('variant_options').select('*'),
      supabase.from('order_products').select('*').eq('order_id', orderId),
      supabase.from('order_items').select('*'),
      supabase.from('audit_log').select('*').eq('target_id', orderId).order('timestamp', { ascending: false }),
      supabase.from('order_media').select('*')
    ])

    setOrder(orderRes.data)
    setProducts(productsRes.data || [])
    setClients(clientsRes.data || [])
    setManufacturers(mfrsRes.data || [])
    setVariantOptions(variantsRes.data || [])
    setOrderProducts(orderProductsRes.data || [])
    setAuditLog(auditRes.data || [])
    setOrderMedia(mediaRes.data || [])
    
    const productIds = (orderProductsRes.data || []).map(op => op.id)
    const filteredItems = (itemsRes.data || []).filter(item => 
      productIds.includes(item.order_product_id)
    )
    setOrderItems(filteredItems)

    setLoading(false)
  }

  const getClientName = (clientId: string) => {
    return clients.find(c => c.id === clientId)?.name || 'Unknown'
  }

  const getManufacturerName = (mfrId: string) => {
    return manufacturers.find(m => m.id === mfrId)?.name || 'Unknown'
  }

  const getProductName = (productId: string) => {
    return products.find(p => p.id === productId)?.title || 'Unknown'
  }

  const getVariantDisplay = (combo: string) => {
    const optionIds = combo.split(',')
    return optionIds.map(id => {
      const option = variantOptions.find(vo => vo.id === id)
      return option?.value || ''
    }).join(' / ')
  }

  const getItemsForProduct = (orderProductId: string) => {
    const items = orderItems.filter(item => item.order_product_id === orderProductId)
    // Sort by variant combo alphabetically for consistent display
    return items.sort((a, b) => {
      const aDisplay = getVariantDisplay(a.variant_combo)
      const bDisplay = getVariantDisplay(b.variant_combo)
      return aDisplay.localeCompare(bDisplay)
    })
  }

  const getProductStatus = (orderProductId: string) => {
    const items = getItemsForProduct(orderProductId)
    if (items.length === 0) return 'negotiation'
    
    const allAdminApproved = items.every(item => item.admin_status === 'approved')
    const allMfrApproved = items.every(item => item.manufacturer_status === 'approved')
    
    if (allAdminApproved && allMfrApproved) {
      return 'ready'
    }
    
    return 'negotiation'
  }

  const getProductStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'border-green-300 bg-green-50'
      case 'in_production':
        return 'border-blue-300 bg-blue-50'
      case 'completed':
        return 'border-gray-300 bg-gray-50'
      case 'negotiation':
      default:
        return 'border-yellow-300 bg-yellow-50'
    }
  }

  const getProductStatusBadge = (status: string, items: OrderItem[]) => {
    const adminApproved = items.filter(i => i.admin_status === 'approved').length
    const mfrApproved = items.filter(i => i.manufacturer_status === 'approved').length
    const total = items.length
    
    switch (status) {
      case 'ready':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            ✓ Ready for Production
          </span>
        )
      case 'in_production':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
            🚀 In Production
          </span>
        )
      case 'completed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
            ✓ Completed
          </span>
        )
      case 'negotiation':
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
            ⚠️ In Negotiation ({Math.min(adminApproved, mfrApproved)}/{total} approved)
          </span>
        )
    }
  }

  const toggleProductExpanded = (productId: string) => {
    setExpandedProducts(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }))
  }

  const startProduction = async (orderProductId: string) => {
    if (!confirm('Start production on this product? This will lock it from further edits.')) return
    
    alert('Production started! (This will be fully implemented with product status tracking)')
  }

  const getReferenceMedia = (orderProductId: string) => {
    return orderMedia.filter(m => m.order_product_id === orderProductId && !m.is_sample)
  }

  const getSampleMedia = (orderProductId: string) => {
    return orderMedia.filter(m => m.order_product_id === orderProductId && m.is_sample)
  }

  const openMediaViewer = (mediaList: any[], startIndex: number, title: string) => {
    setViewingMediaList(mediaList)
    setViewingMediaIndex(startIndex)
    setViewingMedia({ url: mediaList[startIndex].file_url, type: mediaList[startIndex].file_type, title })
  }

  const navigateMedia = (direction: 'prev' | 'next') => {
    if (!viewingMediaList.length) return
    
    let newIndex = viewingMediaIndex
    if (direction === 'next') {
      newIndex = (viewingMediaIndex + 1) % viewingMediaList.length
    } else {
      newIndex = viewingMediaIndex === 0 ? viewingMediaList.length - 1 : viewingMediaIndex - 1
    }
    
    setViewingMediaIndex(newIndex)
    setViewingMedia({
      url: viewingMediaList[newIndex].file_url,
      type: viewingMediaList[newIndex].file_type,
      title: viewingMedia!.title
    })
  }

  const deleteMedia = async (mediaId: string, orderProductId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return
    
    try {
      const { error } = await supabase
        .from('order_media')
        .delete()
        .eq('id', mediaId)
      
      if (error) {
        console.error('Delete error:', error)
        setNotification({ message: 'Error deleting file', type: 'error' })
      } else {
        await loadOrderData()
        setNotification({ message: '🗑️ File deleted successfully', type: 'success' })
      }
    } catch (error) {
      console.error('Delete error:', error)
      setNotification({ message: 'Error deleting file', type: 'error' })
    }
  }

  const handleSampleUpload = async (orderProductId: string, files: FileList | null) => {
    if (!files || !order) return
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'video/mp4', 'video/quicktime']
    const validFiles = Array.from(files).filter(file => allowedTypes.includes(file.type))
    
    if (validFiles.length === 0) {
      setNotification({ message: 'Please upload only JPG, PNG, MP4, or MOV files', type: 'error' })
      return
    }
    
    setUploadingMedia(orderProductId)
    
    try {
      const userEmail = localStorage.getItem('userEmail')
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', userEmail)
        .single()
      
      console.log('Starting upload for', validFiles.length, 'files')
      
      for (const file of validFiles) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${order.id}/${orderProductId}/sample-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        
        console.log('Uploading:', fileName)
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('order-media')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          })
        
        if (uploadError) {
          console.error('Upload error:', uploadError)
          alert(`Error uploading ${file.name}: ${uploadError.message}`)
          continue
        }
        
        console.log('Upload successful:', uploadData)
        
        if (uploadData) {
          const { data: urlData } = supabase.storage
            .from('order-media')
            .getPublicUrl(fileName)
          
          console.log('Public URL:', urlData.publicUrl)
          
          const { data: mediaData, error: mediaError } = await supabase.from('order_media').insert([{
            order_product_id: orderProductId,
            file_url: urlData.publicUrl,
            file_type: file.type.startsWith('image') ? 'image' : 'video',
            uploaded_by: userData?.id || null,
            is_sample: true
          }]).select()
          
          if (mediaError) {
            console.error('Database insert error:', mediaError)
            alert(`Error saving ${file.name} to database: ${mediaError.message}`)
          } else {
            console.log('Database insert successful:', mediaData)
          }
        }
      }
      
      console.log('All uploads complete, reloading data...')
      await loadOrderData()
      setNotification({ message: `✨ Successfully uploaded ${validFiles.length} sample${validFiles.length > 1 ? 's' : ''}!`, type: 'success' })
      
    } catch (error) {
      console.error('Upload error:', error)
      setNotification({ message: 'Error uploading files. Please try again.', type: 'error' })
    } finally {
      setUploadingMedia(null)
    }
  }

  const handleReferenceUpload = async (orderProductId: string, files: FileList | null) => {
    if (!files || !order) return
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'video/mp4', 'video/quicktime']
    const validFiles = Array.from(files).filter(file => allowedTypes.includes(file.type))
    
    if (validFiles.length === 0) {
      setNotification({ message: 'Please upload only JPG, PNG, MP4, or MOV files', type: 'error' })
      return
    }
    
    setUploadingMedia(orderProductId)
    
    try {
      const userEmail = localStorage.getItem('userEmail')
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', userEmail)
        .single()
      
      console.log('Starting reference upload for', validFiles.length, 'files')
      
      for (const file of validFiles) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${order.id}/${orderProductId}/ref-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        
        console.log('Uploading reference:', fileName)
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('order-media')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          })
        
        if (uploadError) {
          console.error('Upload error:', uploadError)
          alert(`Error uploading ${file.name}: ${uploadError.message}`)
          continue
        }
        
        console.log('Upload successful:', uploadData)
        
        if (uploadData) {
          const { data: urlData } = supabase.storage
            .from('order-media')
            .getPublicUrl(fileName)
          
          console.log('Public URL:', urlData.publicUrl)
          
          const { data: mediaData, error: mediaError } = await supabase.from('order_media').insert([{
            order_product_id: orderProductId,
            file_url: urlData.publicUrl,
            file_type: file.type.startsWith('image') ? 'image' : 'video',
            uploaded_by: userData?.id || null,
            is_sample: false  // This is the key difference - reference media is NOT a sample
          }]).select()
          
          if (mediaError) {
            console.error('Database insert error:', mediaError)
            alert(`Error saving ${file.name} to database: ${mediaError.message}`)
          } else {
            console.log('Database insert successful:', mediaData)
          }
        }
      }
      
      console.log('All reference uploads complete, reloading data...')
      await loadOrderData()
      setNotification({ message: `📸 Successfully uploaded ${validFiles.length} reference file${validFiles.length > 1 ? 's' : ''}!`, type: 'success' })
      
    } catch (error) {
      console.error('Upload error:', error)
      setNotification({ message: 'Error uploading files. Please try again.', type: 'error' })
    } finally {
      setUploadingMedia(null)
    }
  }

  const updateItemStatus = async (itemId: string, status: 'approved' | 'rejected') => {
    const statusField = userRole === 'manufacturer' ? 'manufacturer_status' : 'admin_status'
    
    await supabase
      .from('order_items')
      .update({ [statusField]: status })
      .eq('id', itemId)
    
    const userEmail = localStorage.getItem('userEmail')
    await supabase.from('audit_log').insert([{
      user_id: null,
      user_name: userEmail || 'Unknown',
      action_type: `${statusField}_updated`,
      target_type: 'order',
      target_id: orderId,
      new_value: status
    }])
    
    loadOrderData()
  }

  const updateItemQuantity = async (itemId: string, quantity: number) => {
    // Update local state immediately
    setOrderItems(prevItems => 
      prevItems.map(item => 
        item.id === itemId ? { ...item, quantity } : item
      )
    )
    
    await supabase
      .from('order_items')
      .update({ quantity })
      .eq('id', itemId)
    
    const userEmail = localStorage.getItem('userEmail')
    await supabase.from('audit_log').insert([{
      user_id: null,
      user_name: userEmail || 'Unknown',
      action_type: 'quantity_updated',
      target_type: 'order',
      target_id: orderId,
      new_value: quantity.toString()
    }])
  }

  const updateItemPrice = async (itemId: string, field: 'standard_price' | 'bulk_price', value: number) => {
    // Update local state immediately to prevent re-render jumping
    setOrderItems(prevItems => 
      prevItems.map(item => 
        item.id === itemId ? { ...item, [field]: value } : item
      )
    )
    
    // Debounce the actual database update
    await supabase
      .from('order_items')
      .update({ [field]: value })
      .eq('id', itemId)
    
    const userEmail = localStorage.getItem('userEmail')
    await supabase.from('audit_log').insert([{
      user_id: null,
      user_name: userEmail || 'Unknown',
      action_type: `${field}_updated`,
      target_type: 'order',
      target_id: orderId,
      new_value: value.toString()
    }])
  }

  const massApprove = async (orderProductId: string) => {
    const items = getItemsForProduct(orderProductId)
    const statusField = userRole === 'manufacturer' ? 'manufacturer_status' : 'admin_status'
    
    const updates = items.map(item => 
      supabase.from('order_items')
        .update({ [statusField]: 'approved' })
        .eq('id', item.id)
    )
    await Promise.all(updates)
    loadOrderData()
  }

  const submitOrder = async () => {
    if (!confirm('Submit this order to the manufacturer?')) return
    
    await supabase
      .from('orders')
      .update({ status: 'submitted' })
      .eq('id', orderId)
    
    const userEmail = localStorage.getItem('userEmail')
    await supabase.from('audit_log').insert([{
      user_id: null,
      user_name: userEmail || 'Unknown',
      action_type: 'order_submitted',
      target_type: 'order',
      target_id: orderId,
      new_value: 'submitted'
    }])
    
    loadOrderData()
  }

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

  const getItemStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-gray-500'
      case 'approved': return 'text-green-600'
      case 'rejected': return 'text-red-600'
      default: return 'text-gray-500'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading order...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-600">Order not found</p>
        <button
          onClick={() => router.push('/dashboard/orders')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Back to Orders
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 animate-slide-in`}>
          <div className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-xl border backdrop-blur-sm transition-all duration-300 ${
            notification.type === 'success' 
              ? 'bg-gradient-to-r from-green-600 to-green-700 border-green-500 text-white' 
              : 'bg-gradient-to-r from-red-600 to-red-700 border-red-500 text-white'
          }`}>
            <div className="flex items-center gap-3">
              {notification.type === 'success' ? (
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <div>
                <p className="font-semibold">{notification.message}</p>
                <p className="text-xs opacity-90 mt-0.5">Just now</p>
              </div>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="ml-4 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="h-1 bg-white/20 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-white/40 rounded-full animate-progress" style={{ animationDuration: '4s' }}></div>
          </div>
        </div>
      )}

      {/* Add CSS for animations */}
      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        .animate-progress {
          animation: progress linear forwards;
        }
      `}</style>

      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">{order.order_number}</h1>
            <span className={`text-xs font-semibold px-3 py-1 rounded ${getStatusColor(order.status)}`}>
              {order.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <p className="text-gray-600">Client: {getClientName(order.client_id)}</p>
          <p className="text-gray-600">Manufacturer: {getManufacturerName(order.manufacturer_id)}</p>
          <p className="text-gray-500 text-sm">Created: {new Date(order.created_at).toLocaleDateString()}</p>
        </div>
        <div className="flex gap-3">
          {order.status === 'draft' && userRole !== 'manufacturer' && (
            <button
              onClick={submitOrder}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition shadow-sm"
            >
              Submit to Manufacturer
            </button>
          )}
          <button
            onClick={() => router.push('/dashboard/orders')}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
          >
            Back to Orders
          </button>
        </div>
      </div>

      {/* Order Products */}
      <div className="space-y-4">
        {orderProducts.map((orderProduct) => {
          const product = products.find(p => p.id === orderProduct.product_id)
          const items = getItemsForProduct(orderProduct.id)
          const status = getProductStatus(orderProduct.id)
          const isExpanded = expandedProducts[orderProduct.id]
          const statusColor = getProductStatusColor(status)

          return (
            <div key={orderProduct.id} className={`bg-white rounded-lg border-2 shadow-sm transition-all ${statusColor}`}>
              {/* Product Header */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      onClick={() => toggleProductExpanded(orderProduct.id)}
                      className="text-gray-500 hover:text-gray-700 transition"
                    >
                      <svg 
                        className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900">{getProductName(orderProduct.product_id)}</h3>
                      <p className="text-sm text-gray-600 mt-1">{orderProduct.product_order_number}</p>
                      
                      {/* Reference Media - More Prominent */}
                      {getReferenceMedia(orderProduct.id).length > 0 && (
                        <div className="mt-2">
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                            <button
                              onClick={() => {
                                const mediaList = getReferenceMedia(orderProduct.id)
                                openMediaViewer(mediaList, 0, 'Reference Media')
                              }}
                              className="inline-flex items-center gap-2 hover:opacity-80 text-blue-700 transition text-sm font-medium"
                            >
                              <span className="text-lg">📸</span>
                              <span>Reference Media ({getReferenceMedia(orderProduct.id).length})</span>
                              <span className="text-xs">Click to view</span>
                            </button>
                            {userRole !== 'manufacturer' && (
                              <div className="flex gap-1 ml-2 pl-2 border-l border-blue-300">
                                {getReferenceMedia(orderProduct.id).slice(0, 3).map((media, index) => (
                                  <button
                                    key={media.id}
                                    onClick={() => deleteMedia(media.id, orderProduct.id)}
                                    className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition"
                                    title={`Delete file ${index + 1}`}
                                  >
                                    🗑️
                                  </button>
                                ))}
                                {getReferenceMedia(orderProduct.id).length > 3 && (
                                  <span className="text-xs text-blue-600 px-1">+{getReferenceMedia(orderProduct.id).length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Sample Media - More Prominent */}
                      {getSampleMedia(orderProduct.id).length > 0 && (
                        <div className="mt-2">
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg border border-green-200">
                            <button
                              onClick={() => {
                                const mediaList = getSampleMedia(orderProduct.id)
                                openMediaViewer(mediaList, 0, 'Sample Media from Manufacturer')
                              }}
                              className="inline-flex items-center gap-2 hover:opacity-80 text-green-700 transition text-sm font-medium"
                            >
                              <span className="text-lg">✨</span>
                              <span>Manufacturer Samples ({getSampleMedia(orderProduct.id).length})</span>
                              <span className="text-xs">Click to view</span>
                            </button>
                            {userRole === 'manufacturer' && (
                              <div className="flex gap-1 ml-2 pl-2 border-l border-green-300">
                                {getSampleMedia(orderProduct.id).slice(0, 3).map((media, index) => (
                                  <button
                                    key={media.id}
                                    onClick={() => deleteMedia(media.id, orderProduct.id)}
                                    className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition"
                                    title={`Delete file ${index + 1}`}
                                  >
                                    🗑️
                                  </button>
                                ))}
                                {getSampleMedia(orderProduct.id).length > 3 && (
                                  <span className="text-xs text-green-600 px-1">+{getSampleMedia(orderProduct.id).length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {getProductStatusBadge(status, items)}
                  </div>

                  <div className="flex items-center gap-3">
                    {status === 'ready' && userRole !== 'manufacturer' && (
                      <button
                        onClick={() => startProduction(orderProduct.id)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-sm shadow-sm font-medium"
                      >
                        Start Production
                      </button>
                    )}
                    
                    {status === 'negotiation' && (
                      <button
                        onClick={() => massApprove(orderProduct.id)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-sm shadow-sm font-medium"
                      >
                        Approve All
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Product Details */}
              {isExpanded && (
                <div className="px-6 pb-6 border-t border-gray-200">
                  <div className="space-y-3 mt-4">
                    {items.map((item) => (
                      <div key={item.id} className="p-4 bg-white rounded-lg border border-gray-200">
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 mb-1">{getVariantDisplay(item.variant_combo)}</p>
                            {item.notes && (
                              <p className="text-sm text-gray-600">Note: {item.notes}</p>
                            )}
                            <div className="flex gap-4 mt-2">
                              <div className={`text-xs font-medium ${getItemStatusColor(item.admin_status)}`}>
                                Admin: {item.admin_status.toUpperCase()}
                              </div>
                              <div className={`text-xs font-medium ${getItemStatusColor(item.manufacturer_status)}`}>
                                Mfr: {item.manufacturer_status.toUpperCase()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-start gap-3">
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Quantity</label>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 0)}
                                className="w-20 px-3 py-2 border border-gray-300 rounded text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={userRole === 'manufacturer'}
                              />
                            </div>

                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Std Price</label>
                              <input
                                type="number"
                                step="0.01"
                                value={item.standard_price || ''}
                                onChange={(e) => updateItemPrice(item.id, 'standard_price', parseFloat(e.target.value) || 0)}
                                placeholder="$0.00"
                                className="w-24 px-3 py-2 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={userRole !== 'manufacturer' && order.status === 'draft'}
                              />
                            </div>

                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Bulk Price</label>
                              <input
                                type="number"
                                step="0.01"
                                value={item.bulk_price || ''}
                                onChange={(e) => updateItemPrice(item.id, 'bulk_price', parseFloat(e.target.value) || 0)}
                                placeholder="$0.00"
                                className="w-24 px-3 py-2 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={userRole !== 'manufacturer' && order.status === 'draft'}
                              />
                            </div>

                            {(userRole !== 'manufacturer' || order.status !== 'draft') && (
                              <div className="flex gap-2 mt-5">
                                <button
                                  onClick={() => updateItemStatus(item.id, 'approved')}
                                  className="px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded text-sm transition font-medium"
                                  disabled={
                                    (userRole === 'manufacturer' && item.manufacturer_status === 'approved') ||
                                    (userRole !== 'manufacturer' && item.admin_status === 'approved')
                                  }
                                >
                                  ✓ {userRole === 'manufacturer' ? 'Accept' : 'Approve'}
                                </button>
                                <button
                                  onClick={() => updateItemStatus(item.id, 'rejected')}
                                  className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm transition font-medium"
                                  disabled={
                                    (userRole === 'manufacturer' && item.manufacturer_status === 'rejected') ||
                                    (userRole !== 'manufacturer' && item.admin_status === 'rejected')
                                  }
                                >
                                  ✕ Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Admin/Customer Upload Section */}
                        {userRole !== 'manufacturer' && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <label className="text-xs text-gray-500 block mb-2">Customer Reference Images</label>
                            <input
                              type="file"
                              accept="image/*,video/*"
                              multiple
                              onChange={(e) => handleReferenceUpload(orderProduct.id, e.target.files)}
                              disabled={uploadingMedia === orderProduct.id}
                              className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            {uploadingMedia === orderProduct.id && (
                              <p className="text-xs text-blue-600 mt-1 animate-pulse">Uploading files...</p>
                            )}
                          </div>
                        )}

                        {/* Manufacturer Upload Section */}
                        {userRole === 'manufacturer' && order.status !== 'draft' && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <label className="text-xs text-gray-500 block mb-2">Sample Images</label>
                            <input
                              type="file"
                              accept="image/*,video/*"
                              multiple
                              onChange={(e) => handleSampleUpload(orderProduct.id, e.target.files)}
                              disabled={uploadingMedia === orderProduct.id}
                              className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            {uploadingMedia === orderProduct.id && (
                              <p className="text-xs text-green-600 mt-1 animate-pulse">Uploading samples...</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {orderProducts.length === 0 && (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-600">No products in this order</p>
        </div>
      )}

      {/* Order History */}
      <div className="mt-8 bg-white rounded-lg border border-gray-200 shadow-sm">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition"
        >
          <h3 className="text-lg font-semibold text-gray-900">Order History</h3>
          <svg 
            className={`w-5 h-5 text-gray-500 transition-transform ${showHistory ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showHistory && (
          <div className="px-6 pb-6 border-t border-gray-200">
            {auditLog.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">No history yet</p>
            ) : (
              <div className="space-y-3 mt-4">
                {auditLog.map((log, index) => (
                  <div key={index} className="flex gap-3 text-sm">
                    <div className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-blue-500"></div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-medium text-gray-900">{log.user_name}</span>
                          <span className="text-gray-600"> {log.action_type.replace(/_/g, ' ')}</span>
                          {log.new_value && (
                            <span className="text-gray-500"> → {log.new_value}</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Media Viewer Modal with Carousel - Fixed Size */}
      {viewingMedia && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={() => {
          setViewingMedia(null)
          setViewingMediaList([])
          setViewingMediaIndex(0)
        }}>
          <div className="relative max-w-4xl w-full bg-white rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold text-gray-900">{viewingMedia.title}</h3>
                {viewingMediaList.length > 1 && (
                  <span className="text-sm text-gray-600">
                    {viewingMediaIndex + 1} of {viewingMediaList.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setViewingMedia(null)
                  setViewingMediaList([])
                  setViewingMediaIndex(0)
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="relative bg-black" style={{ height: '60vh' }}>
              <div className="absolute inset-0 flex items-center justify-center p-4">
                {/* Previous Button */}
                {viewingMediaList.length > 1 && (
                  <button
                    onClick={() => navigateMedia('prev')}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 z-10 shadow-lg transition"
                  >
                    <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                
                {/* Media Content - Fixed sizing */}
                {viewingMedia.type === 'image' ? (
                  <img 
                    src={viewingMedia.url} 
                    alt={`Media ${viewingMediaIndex + 1}`} 
                    className="max-w-full max-h-full object-contain"
                    style={{ maxHeight: 'calc(60vh - 2rem)' }}
                  />
                ) : (
                  <video 
                    src={viewingMedia.url} 
                    controls 
                    className="max-w-full max-h-full"
                    style={{ maxHeight: 'calc(60vh - 2rem)' }}
                    autoPlay
                  />
                )}
                
                {/* Next Button */}
                {viewingMediaList.length > 1 && (
                  <button
                    onClick={() => navigateMedia('next')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 z-10 shadow-lg transition"
                  >
                    <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
                
                {/* Delete button in viewer */}
                <button
                  onClick={() => {
                    if (viewingMediaList[viewingMediaIndex]?.id) {
                      deleteMedia(viewingMediaList[viewingMediaIndex].id, viewingMediaList[viewingMediaIndex].order_product_id)
                      setViewingMedia(null)
                      setViewingMediaList([])
                      setViewingMediaIndex(0)
                    }
                  }}
                  className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white rounded-full p-2 z-10 shadow-lg transition"
                  title="Delete this file"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Thumbnail Strip */}
            {viewingMediaList.length > 1 && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex gap-2 overflow-x-auto">
                  {viewingMediaList.map((media, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setViewingMediaIndex(index)
                        setViewingMedia({
                          url: media.file_url,
                          type: media.file_type,
                          title: viewingMedia.title
                        })
                      }}
                      className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition ${
                        index === viewingMediaIndex ? 'border-blue-500' : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {media.file_type === 'image' ? (
                        <img 
                          src={media.file_url} 
                          alt={`Thumbnail ${index + 1}`} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}