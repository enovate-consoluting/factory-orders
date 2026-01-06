/**
 * Client Order Detail Page - /dashboard/orders/client/[id]
 * Simplified order view for clients
 * Last Modified: Nov 26 2025
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { 
  Package, Calendar, ArrowLeft, Loader2, 
  FileText, DollarSign, Truck, Check, 
  CheckCircle, Clock, Plane, Ship
} from 'lucide-react';

export default function ClientOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [approvingSample, setApprovingSample] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }
    fetchOrder();
  }, [orderId, router]);

  const fetchOrder = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_name,
          created_at,
          sample_required,
          sample_routed_to,
          sample_status,
          sample_fee,
          client_sample_fee,
          sample_eta,
          client:clients(name),
          order_products(
            id,
            product_order_number,
            description,
            product_status,
            routed_to,
            client_product_price,
            client_shipping_air_price,
            client_shipping_boat_price,
            selected_shipping_method,
            order_items(
              id,
              variant_combo,
              quantity,
              client_price
            )
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) {
        console.error('Supabase error:', error.message);
        throw error;
      }
      
      setOrder(data);
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveSample = async () => {
    if (!order) return;
    setApprovingSample(true);
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          sample_status: 'sample_approved',
          sample_client_approved: true,
          sample_client_approved_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;
      await fetchOrder();
    } catch (error) {
      console.error('Error approving sample:', error);
      alert('Failed to approve sample. Please try again.');
    } finally {
      setApprovingSample(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString: string) => {
    // Parse date-only strings (YYYY-MM-DD) as local time, not UTC
    // This prevents timezone offset from showing wrong day
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const calculateProductTotal = (product: any) => {
    let total = 0;
    
    if (product.order_items) {
      product.order_items.forEach((item: any) => {
        const price = item.client_price || product.client_product_price || 0;
        total += price * (item.quantity || 0);
      });
    }
    
    if (product.selected_shipping_method === 'air' && product.client_shipping_air_price) {
      total += product.client_shipping_air_price;
    } else if (product.selected_shipping_method === 'boat' && product.client_shipping_boat_price) {
      total += product.client_shipping_boat_price;
    }
    
    return total;
  };

  const calculateOrderTotal = () => {
    if (!order) return 0;
    
    let total = 0;
    
    if (order.sample_required && (order.client_sample_fee || order.sample_fee)) {
      total += order.client_sample_fee || order.sample_fee;
    }
    
    const clientProducts = order.order_products?.filter((p: any) => p.routed_to === 'client') || [];
    clientProducts.forEach((product: any) => {
      total += calculateProductTotal(product);
    });
    
    return total;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
          <p className="mt-3 text-gray-600">Loading order...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Order not found</p>
          <Link href="/dashboard/orders/client" className="text-blue-600 hover:underline mt-2 block">
            ← Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const clientProducts = order.order_products?.filter((p: any) => p.routed_to === 'client') || [];
  const hasSampleForClient = order.sample_required && order.sample_routed_to === 'client';
  const sampleNeedsApproval = hasSampleForClient && order.sample_status !== 'sample_approved';
  const orderTotal = calculateOrderTotal();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/dashboard/orders/client"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {order.order_name || 'Order'}
                </h1>
                <p className="text-sm text-gray-500">#{order.order_number}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Order Total</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(orderTotal)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Order Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Created: {formatDate(order.created_at)}
            </span>
          </div>
        </div>

        {/* Sample Request Section */}
        {hasSampleForClient && (
          <div className={`rounded-xl border-2 p-5 ${
            sampleNeedsApproval 
              ? 'bg-amber-50 border-amber-300' 
              : 'bg-green-50 border-green-300'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  sampleNeedsApproval ? 'bg-amber-500' : 'bg-green-500'
                }`}>
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Sample Request</h2>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    {(order.client_sample_fee || order.sample_fee) && (
                      <span className="flex items-center gap-1.5 font-medium">
                        <DollarSign className="w-4 h-4" />
                        {formatCurrency(order.client_sample_fee || order.sample_fee)}
                      </span>
                    )}
                    {order.sample_eta && (
                      <span className="flex items-center gap-1.5">
                        <Truck className="w-4 h-4" />
                        ETA: {formatDate(order.sample_eta)}
                      </span>
                    )}
                  </div>
                  {!sampleNeedsApproval && (
                    <div className="flex items-center gap-2 mt-3 text-green-700 font-medium">
                      <CheckCircle className="w-5 h-5" />
                      Sample Approved
                    </div>
                  )}
                </div>
              </div>

              {sampleNeedsApproval && (
                <button
                  onClick={handleApproveSample}
                  disabled={approvingSample}
                  className="px-5 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-green-600/20"
                >
                  {approvingSample ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                  Approve Sample
                </button>
              )}
            </div>
          </div>
        )}

        {/* Products Section */}
        {clientProducts.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="font-bold text-gray-900">Products ({clientProducts.length})</h2>
            </div>

            <div className="divide-y divide-gray-100">
              {clientProducts.map((product: any) => {
                const productTotal = calculateProductTotal(product);
                const totalQty = product.order_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;

                return (
                  <div key={product.id} className="p-5">
                    {/* Product Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Package className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{product.product_order_number}</h3>
                          <p className="text-sm text-gray-600">{product.description || 'Product'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(productTotal)}</p>
                      </div>
                    </div>

                    {/* Variants Table */}
                    {product.order_items && product.order_items.length > 0 && (
                      <div className="bg-gray-50 rounded-lg overflow-hidden mb-4">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3 font-medium text-gray-600">Variant</th>
                              <th className="text-center py-2 px-3 font-medium text-gray-600">Qty</th>
                              <th className="text-right py-2 px-3 font-medium text-gray-600">Unit Price</th>
                              <th className="text-right py-2 px-3 font-medium text-gray-600">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {product.order_items.map((item: any) => {
                              const unitPrice = item.client_price || product.client_product_price || 0;
                              const lineTotal = unitPrice * (item.quantity || 0);
                              return (
                                <tr key={item.id} className="border-b border-gray-100 last:border-0">
                                  <td className="py-2 px-3 text-gray-900">{item.variant_combo}</td>
                                  <td className="py-2 px-3 text-center text-gray-900">{item.quantity}</td>
                                  <td className="py-2 px-3 text-right text-gray-600">{formatCurrency(unitPrice)}</td>
                                  <td className="py-2 px-3 text-right font-medium text-gray-900">{formatCurrency(lineTotal)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-100">
                              <td className="py-2 px-3 font-medium text-gray-700">Total</td>
                              <td className="py-2 px-3 text-center font-medium text-gray-900">{totalQty}</td>
                              <td className="py-2 px-3"></td>
                              <td className="py-2 px-3 text-right font-bold text-gray-900">
                                {formatCurrency(product.order_items.reduce((sum: number, item: any) => {
                                  const unitPrice = item.client_price || product.client_product_price || 0;
                                  return sum + (unitPrice * (item.quantity || 0));
                                }, 0))}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}

                    {/* Shipping */}
                    {product.selected_shipping_method && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600">Shipping:</span>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium ${
                          product.selected_shipping_method === 'air' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-cyan-100 text-cyan-700'
                        }`}>
                          {product.selected_shipping_method === 'air' ? (
                            <Plane className="w-4 h-4" />
                          ) : (
                            <Ship className="w-4 h-4" />
                          )}
                          {product.selected_shipping_method === 'air' ? 'Air' : 'Sea'} - 
                          {formatCurrency(
                            product.selected_shipping_method === 'air' 
                              ? (product.client_shipping_air_price || 0)
                              : (product.client_shipping_boat_price || 0)
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-900 mb-4">Order Summary</h2>
          <div className="space-y-2 text-sm">
            {order.sample_required && (order.client_sample_fee || order.sample_fee) && (
              <div className="flex justify-between">
                <span className="text-gray-600">Sample Fee</span>
                <span className="font-medium text-gray-900">{formatCurrency(order.client_sample_fee || order.sample_fee)}</span>
              </div>
            )}
            {clientProducts.map((product: any) => (
              <div key={product.id} className="flex justify-between">
                <span className="text-gray-600">{product.product_order_number}</span>
                <span className="font-medium text-gray-900">{formatCurrency(calculateProductTotal(product))}</span>
              </div>
            ))}
            <div className="border-t border-gray-200 pt-2 mt-2">
              <div className="flex justify-between text-base">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-gray-900">{formatCurrency(orderTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <Link
          href="/dashboard/orders/client"
          className="block w-full py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors text-center"
        >
          ← Back to My Orders
        </Link>
      </div>
    </div>
  );
}