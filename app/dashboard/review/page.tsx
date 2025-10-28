'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { Order, OrderProduct, User } from '@/app/types/database';
import { OrderStatusBadge, ProductStatusBadge } from '@/app/components/StatusBadge';
import { createNotification } from '@/app/hooks/useNotifications';

interface OrderWithDetails extends Order {
  client?: { name: string; email: string };
  manufacturer?: { name: string; email: string };
  products?: OrderProduct[];
}

export default function ClientReviewPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<{ [key: string]: string }>({});
  const [processingApproval, setProcessingApproval] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setCurrentUser(user);
      
      // Only allow client users to access this page
      if (user.role !== 'client') {
        router.push('/dashboard/orders');
        return;
      }
    } else {
      router.push('/');
      return;
    }
    
    fetchClientOrders();
  }, []);

  const fetchClientOrders = async () => {
    try {
      // Fetch orders that are submitted to client or require client approval
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(name, email),
          manufacturer:manufacturers(name, email),
          products:order_products(
            id,
            product_id,
            product_order_number,
            product_status,
            requires_client_approval,
            requires_sample,
            admin_notes,
            sample_eta,
            full_order_eta,
            product:products(title, description),
            items:order_items(
              id,
              variant_combo,
              quantity
            )
          )
        `)
        .in('status', [
          'submitted_to_client',
          'client_reviewed',
          'approved_by_client'
        ])
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter products that need client approval
      const ordersWithClientProducts = data?.map(order => ({
        ...order,
        products: order.products?.filter((p: OrderProduct) => 
          p.requires_client_approval || p.product_status === 'client_review'
        )
      })).filter(order => order.products && order.products.length > 0);

      setOrders(ordersWithClientProducts || []);
    } catch (error) {
      console.error('Error fetching client orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductApproval = async (orderId: string, productId: string, approved: boolean) => {
    setProcessingApproval(true);
    const notes = approvalNotes[productId] || '';

    try {
      // Update product status
      const newStatus = approved ? 'client_approved' : 'client_review';
      
      const { error: productError } = await supabase
        .from('order_products')
        .update({
          product_status: newStatus,
          admin_notes: notes ? 
            `Client ${approved ? 'approved' : 'rejected'}: ${notes}` : 
            null
        })
        .eq('id', productId);

      if (productError) throw productError;

      // Get order details for notification
      const { data: orderData } = await supabase
        .from('orders')
        .select('created_by, manufacturer_id')
        .eq('id', orderId)
        .single();

      if (orderData) {
        // Notify admin
        await createNotification(supabase, {
          user_id: orderData.created_by,
          order_id: orderId,
          order_product_id: productId,
          type: approved ? 'product_update' : 'approval_needed',
          message: approved ? 
            `Client approved product` : 
            `Client requested changes to product`
        });

        // If approved, also notify manufacturer
        if (approved && orderData.manufacturer_id) {
          await createNotification(supabase, {
            user_id: orderData.manufacturer_id,
            order_id: orderId,
            order_product_id: productId,
            type: 'product_update',
            message: `Product approved by client and ready for production`
          });
        }
      }

      // Check if all products in order are approved
      const { data: allProducts } = await supabase
        .from('order_products')
        .select('product_status')
        .eq('order_id', orderId);

      const allApproved = allProducts?.every(p => 
        p.product_status === 'client_approved' || 
        p.product_status === 'approved' ||
        p.product_status === 'in_production'
      );

      if (allApproved) {
        // Update order status if all products approved
        await supabase
          .from('orders')
          .update({ status: 'approved_by_client' })
          .eq('id', orderId);
      }

      alert(approved ? 'Product approved successfully' : 'Feedback sent to admin');
      setApprovalNotes(prev => ({ ...prev, [productId]: '' }));
      await fetchClientOrders();
    } catch (error) {
      console.error('Error processing approval:', error);
      alert('Failed to process approval');
    } finally {
      setProcessingApproval(false);
    }
  };

  const updateNote = (productId: string, value: string) => {
    setApprovalNotes(prev => ({ ...prev, [productId]: value }));
  };

  const renderProductForApproval = (order: OrderWithDetails, product: OrderProduct) => {
    const needsApproval = product.product_status === 'client_review';
    const isApproved = product.product_status === 'client_approved';
    const note = approvalNotes[product.id] || '';

    return (
      <div key={product.id} className="border border-slate-700 rounded-lg p-4 mb-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h4 className="font-medium text-white">{product.product?.title}</h4>
            <p className="text-sm text-slate-400">
              {product.product?.description}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Product Code: {product.product_order_number}
            </p>
          </div>
          <ProductStatusBadge status={product.product_status} />
        </div>

        {/* Timeline Information (No pricing shown) */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {product.requires_sample && product.sample_eta && (
            <div className="bg-slate-800/50 rounded p-3">
              <h5 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Sample Timeline
              </h5>
              <div className="text-sm text-white">
                Expected: {new Date(product.sample_eta).toLocaleDateString()}
              </div>
            </div>
          )}
          
          {product.full_order_eta && (
            <div className="bg-slate-800/50 rounded p-3">
              <h5 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Production Timeline
              </h5>
              <div className="text-sm text-white">
                Expected: {new Date(product.full_order_eta).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>

        {/* Variant Quantities */}
        {product.items && product.items.length > 0 && (
          <div className="mb-4">
            <h5 className="text-xs font-medium text-slate-400 mb-2">Variants & Quantities</h5>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {product.items.map((item: any) => (
                <div key={item.id} className="flex justify-between text-xs bg-slate-800/30 p-2 rounded">
                  <span className="text-white">{item.variant_combo}</span>
                  <span className="text-slate-400">Qty: {item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin Notes Only (No manufacturer notes shown) */}
        {product.admin_notes && !product.admin_notes.startsWith('Client') && (
          <div className="bg-blue-950/20 border border-blue-800 rounded p-3 mb-4">
            <p className="text-xs font-medium text-blue-400 mb-1">Notes from Admin</p>
            <p className="text-sm text-white">{product.admin_notes}</p>
          </div>
        )}

        {/* Sample Required Indicator */}
        {product.requires_sample && (
          <div className="bg-yellow-950/20 border border-yellow-800 rounded p-3 mb-4">
            <div className="flex items-center gap-2 text-yellow-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Sample will be provided for approval before production</span>
            </div>
          </div>
        )}

        {/* Approval Actions */}
        {needsApproval && (
          <div className="space-y-3">
            <textarea
              value={note}
              onChange={(e) => updateNote(product.id, e.target.value)}
              placeholder="Add any notes or feedback (optional for approval, required for changes)..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleProductApproval(order.id, product.id, true)}
                disabled={processingApproval}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white rounded transition-colors"
              >
                <ThumbsUp className="w-4 h-4" />
                Approve Product
              </button>
              <button
                onClick={() => handleProductApproval(order.id, product.id, false)}
                disabled={processingApproval || !note}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white rounded transition-colors"
              >
                <ThumbsDown className="w-4 h-4" />
                Request Changes
              </button>
            </div>
            {!note && (
              <p className="text-xs text-yellow-500 text-center">
                Note: Feedback is required when requesting changes
              </p>
            )}
          </div>
        )}

        {/* Already Approved */}
        {isApproved && (
          <div className="bg-green-950/20 border border-green-800 rounded p-3">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Product Approved</span>
            </div>
            <p className="text-xs text-green-400/80 mt-1">
              This product has been approved and will proceed with production
            </p>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white">Loading orders for review...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Product Approval</h1>
        <p className="text-slate-400 mt-1">
          Review and approve product specifications before production
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-950/20 border border-blue-800 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
          <div className="text-sm text-blue-300">
            <p className="font-medium mb-1">Review Guidelines:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-300/80">
              <li>Review product specifications and quantities</li>
              <li>Check expected delivery timelines</li>
              <li>Approve products to proceed with manufacturing</li>
              <li>Request changes if modifications are needed</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="bg-slate-800 rounded-lg p-8 text-center">
          <Package className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No products pending your review</p>
          <p className="text-sm text-slate-500 mt-2">
            You'll be notified when products need your approval
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="bg-slate-800 rounded-lg p-6">
              {/* Order Header */}
              <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-700">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Order: {order.order_number}
                  </h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                    <span>Manufacturer: {order.manufacturer?.name}</span>
                    <span>•</span>
                    <span>Submitted: {new Date(order.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>

              {/* Products for Review */}
              <div className="space-y-4">
                <h4 className="font-medium text-white flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Products for Approval ({order.products?.length || 0})
                </h4>
                {order.products?.map((product) => 
                  renderProductForApproval(order, product)
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}