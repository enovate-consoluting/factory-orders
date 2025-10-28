'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  ArrowLeft, 
  Package, 
  Calendar, 
  User, 
  Building,
  Mail,
  FileText,
  Image as ImageIcon,
  Download,
  X,
  Check,
  AlertCircle,
  Clock,
  Lock,
  Unlock,
  ChevronRight,
  ChevronLeft,
  Send,
  RotateCcw,
  CheckCircle,
  XCircle,
  Loader2,
  Edit,
  MessageSquare,
  ZoomIn,
  History,
  FileImage,
  Play,
  Eye,
  Upload,
  Plus,
  Save,
  ExternalLink,
  File,
  Bell
} from 'lucide-react';
import { notify } from '@/app/hooks/useUINotification';
import { OrderStatusBadge } from '@/app/components/StatusBadge';

// [Keep all the same interfaces - OrderDetail, OrderProduct, OrderItem, MediaFile, AuditLogEntry]
interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  client: {
    id: string;
    name: string;
    email: string;
  };
  manufacturer: {
    id: string;
    name: string;
    email: string;
  };
  creator?: {
    name: string;
    email: string;
  };
}

interface OrderProduct {
  id: string;
  product_order_number: string;
  product_status?: string;
  is_locked?: boolean;
  requires_sample?: boolean;
  requires_client_approval?: boolean;
  admin_notes?: string;
  product: {
    id: string;
    title: string;
    description: string;
  };
}

interface OrderItem {
  id: string;
  variant_combo: string;
  quantity: number;
  notes: string;
  admin_status: string;
  manufacturer_status: string;
  standard_price: number;
  bulk_price: number;
}

interface MediaFile {
  id: string;
  file_url: string;
  file_type: string;
  uploaded_by: string;
  created_at: string;
}

interface AuditLogEntry {
  id: string;
  user_name: string;
  action_type: string;
  target_type: string;
  target_id: string;
  old_value: string;
  new_value: string;
  timestamp: string;
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [orderProducts, setOrderProducts] = useState<OrderProduct[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [mediaFiles, setMediaFiles] = useState<Record<string, MediaFile[]>>({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [processingProduct, setProcessingProduct] = useState<string | null>(null);
  const [routingProduct, setRoutingProduct] = useState<OrderProduct | null>(null);
  const [routingNotes, setRoutingNotes] = useState('');
  const [selectedRoutingAction, setSelectedRoutingAction] = useState<string | null>(null);
  const [auditHistory, setAuditHistory] = useState<Record<string, AuditLogEntry[]>>({});
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const [selectedProductForUpload, setSelectedProductForUpload] = useState<string | null>(null);
  const [viewedHistory, setViewedHistory] = useState<Record<string, number>>({});
  
  // Media viewer states
  const [viewingMedia, setViewingMedia] = useState<MediaFile[] | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setCurrentUser(user);
    }
    
    // Load viewed history counts from localStorage
    const viewed = localStorage.getItem(`viewedHistory_${params.id}`);
    if (viewed) {
      setViewedHistory(JSON.parse(viewed));
    }
    
    fetchOrderDetails();
  }, [params.id]);

  const fetchOrderDetails = async () => {
    try {
      // Fetch order details with creator info
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(id, name, email),
          manufacturer:manufacturers(id, name, email),
          creator:users(name, email)
        `)
        .eq('id', params.id)
        .single();

      if (orderError) throw orderError;
      
      // If creator is not populated, try to get it from the created_by field
      if (!orderData.creator && orderData.created_by) {
        const { data: creatorData } = await supabase
          .from('users')
          .select('name, email')
          .eq('id', orderData.created_by)
          .single();
        
        if (creatorData) {
          orderData.creator = creatorData;
        }
      }
      
      // If still no creator info, use current user as fallback for display
      if (!orderData.creator) {
        const userData = localStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          orderData.creator = {
            name: user.name || user.email || 'Admin User',
            email: user.email
          };
        }
      }
      
      setOrder(orderData);

      // Fetch order products
      const { data: productsData, error: productsError } = await supabase
        .from('order_products')
        .select(`
          *,
          product:products(id, title, description)
        `)
        .eq('order_id', params.id)
        .order('created_at');

      if (productsError) throw productsError;
      
      // Set default values for missing fields
      const productsWithDefaults = (productsData || []).map(p => ({
        ...p,
        product_status: p.product_status || 'pending',
        is_locked: p.is_locked || false,
        requires_sample: p.requires_sample || false,
        requires_client_approval: p.requires_client_approval || false,
        admin_notes: p.admin_notes || ''
      }));
      
      setOrderProducts(productsWithDefaults);

      // Fetch items, media, and audit history for each product
      const itemsMap: Record<string, OrderItem[]> = {};
      const mediaMap: Record<string, MediaFile[]> = {};
      const historyMap: Record<string, AuditLogEntry[]> = {};

      for (const product of productsData || []) {
        // Fetch items
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_product_id', product.id)
          .order('variant_combo');

        itemsMap[product.id] = itemsData || [];

        // Fetch media
        const { data: mediaData } = await supabase
          .from('order_media')
          .select('*')
          .eq('order_product_id', product.id)
          .order('created_at', { ascending: false });

        mediaMap[product.id] = mediaData || [];

        // Fetch audit history
        const { data: historyData } = await supabase
          .from('audit_log')
          .select('*')
          .eq('target_id', product.id)
          .eq('target_type', 'order_product')
          .order('timestamp', { ascending: false });

        historyMap[product.id] = historyData || [];
      }

      setOrderItems(itemsMap);
      setMediaFiles(mediaMap);
      setAuditHistory(historyMap);
    } catch (error) {
      console.error('Error fetching order details:', error);
      notify.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const canRouteProduct = (product: OrderProduct) => {
    // Admin can only route when product is pending or revision_requested
    const routableStatuses = ['pending', 'revision_requested'];
    return routableStatuses.includes(product.product_status || 'pending');
  };

  const handleToggleLock = async (product: OrderProduct) => {
    setProcessingProduct(product.id);
    
    try {
      const newLockStatus = !product.is_locked;
      const newProductStatus = newLockStatus ? 'in_production' : 'pending';

      const { data: updateData, error } = await supabase
        .from('order_products')
        .update({ 
          is_locked: newLockStatus,
          product_status: newProductStatus
        })
        .eq('id', product.id)
        .select()
        .single();

      if (error) {
        console.error('Lock toggle error:', error);
        throw new Error(error.message || 'Failed to update lock status');
      }

      // Update local state
      setOrderProducts(prev => 
        prev.map(p => 
          p.id === product.id 
            ? { ...p, is_locked: newLockStatus, product_status: newProductStatus }
            : p
        )
      );

      // Log action with current user info
      await supabase
        .from('audit_log')
        .insert({
          user_id: currentUser?.id || crypto.randomUUID(),
          user_name: currentUser?.name || currentUser?.email || 'Admin User',
          action_type: newLockStatus ? 'product_locked' : 'product_unlocked',
          target_type: 'order_product',
          target_id: product.id,
          old_value: product.product_status || 'pending',
          new_value: newProductStatus,
          timestamp: new Date().toISOString()
        });

      // Refresh audit history
      fetchOrderDetails();

      notify.success(
        newLockStatus 
          ? `${product.product.title} locked for production`
          : `${product.product.title} unlocked and set to pending`
      );
    } catch (error: any) {
      console.error('Error toggling lock:', error);
      notify.error(error.message || 'Failed to update product lock status');
    } finally {
      setProcessingProduct(null);
    }
  };

  // FIXED: Notes saving with proper state management - clears notes after saving to history
  const handleSaveNotes = async (productId: string) => {
    try {
      // First, clear the admin_notes field (set to empty string)
      const { error } = await supabase
        .from('order_products')
        .update({ admin_notes: '' })  // Clear the notes field
        .eq('id', productId);

      if (error) throw error;

      // Log the note content to history (if there's content to save)
      if (tempNotes.trim()) {
        await supabase
          .from('audit_log')
          .insert({
            user_id: currentUser?.id || crypto.randomUUID(),
            user_name: currentUser?.name || currentUser?.email || 'Admin User',
            action_type: 'note_added',
            target_type: 'order_product',
            target_id: productId,
            new_value: tempNotes,
            timestamp: new Date().toISOString()
          });
      }

      // Update local state to clear the notes
      setOrderProducts(prev => 
        prev.map(p => 
          p.id === productId 
            ? { ...p, admin_notes: '' }  // Clear notes in local state
            : p
        )
      );
      
      // Clear editing state
      setEditingNotes(null);
      setTempNotes('');
      
      notify.success('Note added to history');
      
      // Refresh to update history
      setTimeout(() => {
        fetchOrderDetails();
      }, 100);
    } catch (error) {
      console.error('Error saving notes:', error);
      notify.error('Failed to save notes');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, productId: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingMedia(productId);

    try {
      for (const file of files) {
        // Upload to Supabase Storage
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const fileName = `${timestamp}-${randomStr}-${file.name}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('order-media')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('order-media')
          .getPublicUrl(fileName);

        // Determine file type
        let fileType = 'document';
        if (file.type.startsWith('image/')) {
          fileType = 'image';
        } else if (file.type.startsWith('video/')) {
          fileType = 'video';
        } else if (file.type === 'application/pdf') {
          fileType = 'pdf';
        }

        // Save to database
        const { error: dbError } = await supabase
          .from('order_media')
          .insert({
            order_product_id: productId,
            file_url: publicUrl,
            file_type: fileType,
            uploaded_by: currentUser?.id || crypto.randomUUID()
          });

        if (dbError) throw dbError;
      }

      notify.success(`${files.length} file(s) uploaded successfully`);
      fetchOrderDetails(); // Refresh to show new media
    } catch (error) {
      console.error('Error uploading files:', error);
      notify.error('Failed to upload files');
    } finally {
      setUploadingMedia(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRouteProduct = async () => {
    if (!routingProduct || !order || !selectedRoutingAction) {
      notify.error('Please select a routing action');
      return;
    }
    
    setProcessingProduct(routingProduct.id);
    
    try {
      // Build updates based on selected action
      let updates: any = {};
      let newOrderStatus = order.status;
      
      switch (selectedRoutingAction) {
        case 'send_to_production':
          updates.product_status = 'in_production';
          updates.is_locked = true;
          break;
          
        case 'request_sample':
          updates.requires_sample = true;
          updates.product_status = 'sample_requested';
          newOrderStatus = 'submitted_for_sample';
          break;
          
        case 'send_for_approval':
          updates.requires_client_approval = true;
          updates.product_status = 'pending_client_approval';
          newOrderStatus = 'submitted_to_client';
          break;
          
        case 'send_back_to_manufacturer':
          updates.product_status = 'revision_requested';
          newOrderStatus = 'submitted_to_manufacturer';
          break;
      }

      // Update the product
      const { data: updateData, error: productError } = await supabase
        .from('order_products')
        .update(updates)
        .eq('id', routingProduct.id)
        .select()
        .single();

      if (productError) {
        throw new Error(`Failed to update product: ${productError.message}`);
      }

      // Update order status if needed
      if (newOrderStatus !== order.status) {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .update({ status: newOrderStatus })
          .eq('id', order.id)
          .select()
          .single();

        if (orderError) {
          notify.warning('Product routed but order status update failed');
        } else {
          setOrder(prev => prev ? { ...prev, status: newOrderStatus } : null);
        }
      }

      // Add routing action to audit log with current user info
      await supabase
        .from('audit_log')
        .insert({
          user_id: currentUser?.id || crypto.randomUUID(),
          user_name: currentUser?.name || currentUser?.email || 'Admin User',
          action_type: `product_routed_${selectedRoutingAction}`,
          target_type: 'order_product',
          target_id: routingProduct.id,
          old_value: routingProduct.product_status || 'pending',
          new_value: updates.product_status,
          timestamp: new Date().toISOString()
        });

      // Add note if provided
      if (routingNotes) {
        await supabase
          .from('audit_log')
          .insert({
            user_id: currentUser?.id || crypto.randomUUID(),
            user_name: currentUser?.name || currentUser?.email || 'Admin User',
            action_type: 'routing_note',
            target_type: 'order_product',
            target_id: routingProduct.id,
            new_value: routingNotes,
            timestamp: new Date().toISOString()
          });
      }

      // Update local state
      setOrderProducts(prev => 
        prev.map(p => 
          p.id === routingProduct.id 
            ? { ...p, ...updates }
            : p
        )
      );

      // Refresh audit history
      fetchOrderDetails();

      notify.success(`Product routed successfully`);
      setRoutingProduct(null);
      setRoutingNotes('');
      setSelectedRoutingAction(null);
    } catch (error: any) {
      console.error('Error routing product:', error);
      notify.error(error.message || 'Failed to route product');
    } finally {
      setProcessingProduct(null);
    }
  };

  const openMediaViewer = (media: MediaFile[], index: number) => {
    console.log('Opening media viewer:', media[index]);
    setViewingMedia(media);
    setCurrentMediaIndex(index);
  };

  const closeMediaViewer = () => {
    setViewingMedia(null);
    setCurrentMediaIndex(0);
  };

  const navigateMedia = (direction: 'prev' | 'next') => {
    if (!viewingMedia) return;
    
    if (direction === 'prev') {
      setCurrentMediaIndex((prev) => (prev > 0 ? prev - 1 : viewingMedia.length - 1));
    } else {
      setCurrentMediaIndex((prev) => (prev < viewingMedia.length - 1 ? prev + 1 : 0));
    }
  };

  const handleViewHistory = (productId: string) => {
    setShowHistory(showHistory === productId ? null : productId);
    
    // Mark history as viewed
    const historyCount = auditHistory[productId]?.length || 0;
    const newViewed = { ...viewedHistory, [productId]: historyCount };
    setViewedHistory(newViewed);
    localStorage.setItem(`viewedHistory_${params.id}`, JSON.stringify(newViewed));
  };

  const hasNewHistory = (productId: string) => {
    const currentCount = auditHistory[productId]?.length || 0;
    const viewedCount = viewedHistory[productId] || 0;
    return currentCount > viewedCount;
  };

  const getProductStatusIcon = (status: string) => {
    const normalizedStatus = status || 'pending';
    switch (normalizedStatus) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'in_production':
        return <Package className="w-5 h-5 text-blue-500" />;
      case 'sample_requested':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'revision_requested':
        return <RotateCcw className="w-5 h-5 text-orange-500" />;
      case 'pending_client_approval':
        return <Clock className="w-5 h-5 text-purple-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getProductStatusBadge = (status: string) => {
    const normalizedStatus = status || 'pending';
    const statusColors: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-700',
      in_production: 'bg-blue-100 text-blue-700',
      sample_requested: 'bg-yellow-100 text-yellow-700',
      pending_client_approval: 'bg-purple-100 text-purple-700',
      revision_requested: 'bg-orange-100 text-orange-700',
      completed: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700'
    };

    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[normalizedStatus] || statusColors.pending}`}>
        {normalizedStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </span>
    );
  };

  const formatActionType = (action: string) => {
    const actionLabels: Record<string, string> = {
      'product_routed_send_to_production': 'Sent to Production',
      'product_routed_request_sample': 'Sample Requested',
      'product_routed_send_for_approval': 'Sent for Client Approval',
      'product_routed_send_back_to_manufacturer': 'Sent Back to Manufacturer',
      'product_locked': 'Product Locked',
      'product_unlocked': 'Product Unlocked',
      'routing_note': 'Routing Note',
      'note_added': 'Note Added'
    };
    return actionLabels[action] || action;
  };

  // Helper to get media type
  const getMediaType = (file: MediaFile): 'image' | 'video' | 'pdf' | 'document' => {
    // First check the file_type from database
    if (file.file_type === 'pdf') return 'pdf';
    if (file.file_type === 'image') return 'image';
    if (file.file_type === 'video') return 'video';
    
    // Fallback to checking URL extension
    const url = file.file_url.toLowerCase();
    if (url.includes('.pdf')) return 'pdf';
    if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.gif') || url.includes('.webp')) return 'image';
    if (url.includes('.mp4') || url.includes('.webm') || url.includes('.mov') || url.includes('.avi')) return 'video';
    
    return 'document';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">Order not found</p>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin' || currentUser?.role === 'order_approver';
  const isManufacturer = currentUser?.role === 'manufacturer';
  const isClient = currentUser?.role === 'client';

  // Get display name for creator
  const creatorName = order.creator 
    ? (order.creator.name || order.creator.email)
    : (currentUser?.name || currentUser?.email || 'Admin User');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,.pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          if (selectedProductForUpload) {
            handleFileUpload(e, selectedProductForUpload);
          }
        }}
      />

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">{order.order_number}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>Created {new Date(order.created_at).toLocaleDateString()}</span>
            <span className="text-gray-400">by:</span>
            <span className="font-medium text-gray-900">{creatorName}</span>
          </div>
        </div>
      </div>

      {/* Order Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Client Card */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Client</p>
              <p className="font-semibold text-gray-900">{order.client.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail className="w-4 h-4" />
            <span>{order.client.email}</span>
          </div>
        </div>

        {/* Manufacturer Card */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Building className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Manufacturer</p>
              <p className="font-semibold text-gray-900">{order.manufacturer.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail className="w-4 h-4" />
            <span>{order.manufacturer.email}</span>
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Order Products</h2>
        
        {orderProducts.map((product) => {
          const items = orderItems[product.id] || [];
          const media = mediaFiles[product.id] || [];
          const history = auditHistory[product.id] || [];
          const hasNotes = items.some(item => item.notes);
          const canRoute = canRouteProduct(product);
          const hasNew = hasNewHistory(product.id);

          // Check if order number is PLU-000003 or status is not routable
          const shouldDisableRoute = order.order_number === 'PLU-000003' || !canRoute;

          return (
            <div key={product.id} className="bg-white rounded-lg border overflow-hidden">
              {/* Product Header */}
              <div className="p-4 bg-gray-50 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getProductStatusIcon(product.product_status || 'pending')}
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg text-gray-900">
                          {product.product.title}
                        </h3>
                        {getProductStatusBadge(product.product_status || 'pending')}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{product.product.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Product Order: {product.product_order_number}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewHistory(product.id)}
                      className="px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium flex items-center gap-2 relative"
                    >
                      <History className="w-4 h-4" />
                      History
                      {hasNew && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      )}
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => {
                            if (!shouldDisableRoute) {
                              setRoutingProduct(product);
                              setSelectedRoutingAction(null);
                            }
                          }}
                          disabled={shouldDisableRoute}
                          className={`px-3 py-1.5 rounded-lg transition-colors text-sm font-medium ${
                            shouldDisableRoute
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                          title={shouldDisableRoute ? 'Product must be returned to admin for routing' : 'Route product'}
                        >
                          Route Product
                        </button>
                        <button
                          onClick={() => handleToggleLock(product)}
                          disabled={processingProduct === product.id}
                          className={`p-2 rounded-lg transition-colors ${
                            product.is_locked 
                              ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                          } disabled:opacity-50`}
                          title={product.is_locked ? 'Unlock for editing' : 'Lock for production'}
                        >
                          {processingProduct === product.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : product.is_locked ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <Unlock className="w-4 h-4" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Notes Section */}
                <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700 mb-1">Notes:</p>
                      {editingNotes === product.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={tempNotes}
                            onChange={(e) => setTempNotes(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            rows={3}
                            placeholder="Add notes to history..."
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveNotes(product.id)}
                              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                            >
                              <Save className="w-3 h-3 inline mr-1" />
                              Add to History
                            </button>
                            <button
                              onClick={() => {
                                setEditingNotes(null);
                                setTempNotes('');
                              }}
                              className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <p className="text-sm text-gray-600">
                            {product.admin_notes || 'Click edit to add notes to history'}
                          </p>
                          {(isAdmin || isManufacturer) && (
                            <button
                              onClick={() => {
                                setEditingNotes(product.id);
                                setTempNotes('');  // Always start with empty field
                              }}
                              className="ml-2 p-1 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Display variant notes if any */}
                {hasNotes && (
                  <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-yellow-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-yellow-800 mb-1">Variant Notes:</p>
                        <div className="space-y-1">
                          {items.filter(item => item.notes).map(item => (
                            <p key={item.id} className="text-yellow-700">
                              <span className="font-medium">{item.variant_combo}:</span> {item.notes}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* History Panel */}
                {showHistory === product.id && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200 max-h-60 overflow-y-auto">
                    <div className="text-sm">
                      <p className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                        <History className="w-4 h-4" />
                        History & Notes
                        {hasNew && (
                          <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">New</span>
                        )}
                      </p>
                      {history.length > 0 ? (
                        <div className="space-y-2">
                          {history.map((entry, index) => (
                            <div key={entry.id} className={`bg-white p-2 rounded border ${index === 0 && hasNew ? 'border-red-300' : 'border-blue-100'}`}>
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {formatActionType(entry.action_type)}
                                  </p>
                                  {(entry.action_type === 'routing_note' || entry.action_type === 'note_added') && entry.new_value && (
                                    <p className="text-gray-600 mt-1">{entry.new_value}</p>
                                  )}
                                  {entry.old_value && entry.new_value && entry.action_type !== 'routing_note' && entry.action_type !== 'note_added' && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      {entry.old_value} → {entry.new_value}
                                    </p>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 text-right">
                                  <p>{entry.user_name}</p>
                                  <p>{new Date(entry.timestamp).toLocaleString()}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500">No history available</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Product Content */}
              <div className="p-4">
                {/* Variants Table */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Variants</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Variant</th>
                          <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Quantity</th>
                          <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Standard Price</th>
                          <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Bulk Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => (
                          <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                            <td className="py-2 px-3 text-sm text-gray-900">{item.variant_combo}</td>
                            <td className="py-2 px-3 text-sm text-gray-900">{item.quantity}</td>
                            <td className="py-2 px-3 text-sm text-gray-900">
                              {item.standard_price ? `$${item.standard_price}` : '-'}
                            </td>
                            <td className="py-2 px-3 text-sm text-gray-900">
                              {item.bulk_price ? `$${item.bulk_price}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Media Files */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Media Files</h4>
                    <button
                      onClick={() => {
                        setSelectedProductForUpload(product.id);
                        fileInputRef.current?.click();
                      }}
                      disabled={uploadingMedia === product.id}
                      className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
                    >
                      {uploadingMedia === product.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      Upload Media
                    </button>
                  </div>
                  
                  {media.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {media.map((file, index) => {
                        const mediaType = getMediaType(file);
                        
                        return (
                          <button
                            key={file.id}
                            onClick={() => openMediaViewer(media, index)}
                            className="relative group aspect-square rounded-lg border overflow-hidden bg-gray-50 hover:ring-2 hover:ring-blue-500 transition-all"
                          >
                            {mediaType === 'image' ? (
                              <img
                                src={file.file_url}
                                alt="Media"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  console.log('Image failed to load:', file.file_url);
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML = '<div class="flex items-center justify-center h-full"><svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>';
                                  }
                                }}
                              />
                            ) : mediaType === 'video' ? (
                              <div className="flex items-center justify-center h-full bg-gray-900">
                                <Play className="w-8 h-8 text-white" />
                              </div>
                            ) : mediaType === 'pdf' ? (
                              <div className="flex items-center justify-center h-full bg-red-50">
                                <File className="w-8 h-8 text-red-600" />
                                <span className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-xs py-0.5">PDF</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <FileText className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No media files uploaded</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Routing Modal */}
      {routingProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Route Product</h2>
                <p className="text-sm text-gray-500 mt-1">{routingProduct.product.title}</p>
              </div>
              <button
                onClick={() => {
                  setRoutingProduct(null);
                  setRoutingNotes('');
                  setSelectedRoutingAction(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Routing Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => setSelectedRoutingAction('send_to_production')}
                className={`p-4 border-2 rounded-lg transition-all text-left group ${
                  selectedRoutingAction === 'send_to_production'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    selectedRoutingAction === 'send_to_production'
                      ? 'bg-blue-200'
                      : 'bg-blue-100 group-hover:bg-blue-200'
                  }`}>
                    <Send className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Direct to Production</h3>
                </div>
                <p className="text-sm text-gray-500">Send directly to production line</p>
              </button>

              <button
                onClick={() => setSelectedRoutingAction('request_sample')}
                className={`p-4 border-2 rounded-lg transition-all text-left group ${
                  selectedRoutingAction === 'request_sample'
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-gray-200 hover:border-yellow-500 hover:bg-yellow-50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    selectedRoutingAction === 'request_sample'
                      ? 'bg-yellow-200'
                      : 'bg-yellow-100 group-hover:bg-yellow-200'
                  }`}>
                    <Package className="w-5 h-5 text-yellow-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Request Sample First</h3>
                </div>
                <p className="text-sm text-gray-500">Request sample before production</p>
              </button>

              <button
                onClick={() => setSelectedRoutingAction('send_for_approval')}
                className={`p-4 border-2 rounded-lg transition-all text-left group ${
                  selectedRoutingAction === 'send_for_approval'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-500 hover:bg-purple-50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    selectedRoutingAction === 'send_for_approval'
                      ? 'bg-purple-200'
                      : 'bg-purple-100 group-hover:bg-purple-200'
                  }`}>
                    <CheckCircle className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Send to Client</h3>
                </div>
                <p className="text-sm text-gray-500">Send for client approval</p>
              </button>

              <button
                onClick={() => setSelectedRoutingAction('send_back_to_manufacturer')}
                className={`p-4 border-2 rounded-lg transition-all text-left group ${
                  selectedRoutingAction === 'send_back_to_manufacturer'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-orange-500 hover:bg-orange-50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    selectedRoutingAction === 'send_back_to_manufacturer'
                      ? 'bg-orange-200'
                      : 'bg-orange-100 group-hover:bg-orange-200'
                  }`}>
                    <RotateCcw className="w-5 h-5 text-orange-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Back to Manufacturer</h3>
                </div>
                <p className="text-sm text-gray-500">Request revisions from manufacturer</p>
              </button>
            </div>

            {/* Routing Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Routing Notes (Optional)
              </label>
              <textarea
                value={routingNotes}
                onChange={(e) => setRoutingNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Add any notes or instructions..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setRoutingProduct(null);
                  setRoutingNotes('');
                  setSelectedRoutingAction(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRouteProduct}
                disabled={!selectedRoutingAction || processingProduct === routingProduct.id}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {processingProduct === routingProduct.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Routing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Routing
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIXED: Media Viewer Modal with Better PDF Support */}
      {viewingMedia && viewingMedia[currentMediaIndex] && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4">
          {/* Close button */}
          <button
            onClick={closeMediaViewer}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Navigation buttons - Only show if more than 1 file */}
          {viewingMedia.length > 1 && (
            <>
              <button
                onClick={() => navigateMedia('prev')}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={() => navigateMedia('next')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            </>
          )}

          {/* Media content */}
          <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center">
            {(() => {
              const currentFile = viewingMedia[currentMediaIndex];
              const mediaType = getMediaType(currentFile);

              if (mediaType === 'pdf') {
                // For PDFs, we'll use a different approach
                // Most browsers can't display PDFs from Supabase URLs directly in iframes
                // So we provide a direct link instead
                return (
                  <div className="bg-white rounded-lg p-8 text-center max-w-md">
                    <File className="w-16 h-16 text-red-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">PDF Document</h3>
                    <p className="text-gray-600 mb-4">
                      PDF preview is not available in this viewer. Click below to open the PDF in a new tab.
                    </p>
                    <a 
                      href={currentFile.file_url} 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <ExternalLink className="w-5 h-5" />
                      Open PDF in New Tab
                    </a>
                    <div className="mt-4 text-sm text-gray-500">
                      File uploaded: {new Date(currentFile.created_at).toLocaleDateString()}
                    </div>
                  </div>
                );
              } else if (mediaType === 'image') {
                return (
                  <img
                    src={currentFile.file_url}
                    alt="Media preview"
                    className="max-w-full max-h-[80vh] object-contain rounded-lg"
                  />
                );
              } else if (mediaType === 'video') {
                return (
                  <video
                    src={currentFile.file_url}
                    controls
                    autoPlay
                    className="max-w-full max-h-[80vh] rounded-lg"
                  >
                    Your browser does not support the video tag.
                  </video>
                );
              } else {
                return (
                  <div className="bg-white p-8 rounded-lg text-center">
                    <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">Document preview not available</p>
                    <a 
                      href={currentFile.file_url} 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in New Tab
                    </a>
                  </div>
                );
              }
            })()}

            {/* File info */}
            <div className="mt-4 text-center">
              <p className="text-white text-sm">
                File {currentMediaIndex + 1} of {viewingMedia.length}
              </p>
            </div>

            {/* Pagination dots - Only show if more than 1 file */}
            {viewingMedia.length > 1 && (
              <div className="mt-4 flex items-center gap-2">
                {viewingMedia.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentMediaIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentMediaIndex
                        ? 'bg-white w-8'
                        : 'bg-white/50 hover:bg-white/75'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}