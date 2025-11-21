'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  FileText, Plus, Calendar, Building, DollarSign, 
  Package, ChevronRight, Filter, Search
} from 'lucide-react';
import { notify } from '@/app/hooks/useUINotification';

interface InvoiceableOrder {
  id: string;
  order_number: string;
  order_name: string;
  status: string;
  client: {
    id: string;
    name: string;
  };
  total_value: number;
  order_total: number;
  invoiced_amount: number;
  ready_to_invoice: number;
  approved_products: number;
  total_products: number;
  has_samples: boolean;
  sample_total: number;
  production_total: number;
  invoices?: any[];
}

export default function InvoicesPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  const [orders, setOrders] = useState<InvoiceableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ready');
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    fetchInvoiceableOrders();
  }, [activeTab]);
  
  const fetchInvoiceableOrders = async () => {
    try {
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(*),
          order_products (
            id,
            product_status,
            routed_to,
            sample_fee,
            product_price,
            shipping_air_price,
            shipping_boat_price,
            order_items (
              quantity
            )
          ),
          invoices (
            id,
            amount,
            status
          )
        `)
        .neq('status', 'draft')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processedOrders = ordersData?.map(order => {
        // UPDATED LOGIC: Include products that are either:
        // 1. Approved for production/in production/completed OR
        // 2. Routed to admin with fees (sample fee or product price)
        const approvedProducts = order.order_products.filter(
          (p: any) => {
            // Check if product has fees and is routed to admin
            const hasFeesAndRoutedToAdmin = 
              p.routed_to === 'admin' && 
              (parseFloat(p.product_price || 0) > 0 || parseFloat(p.sample_fee || 0) > 0);
            
            // Include if it meets either condition
            return hasFeesAndRoutedToAdmin ||
                   p.product_status === 'approved_for_production' || 
                   p.product_status === 'in_production' ||
                   p.product_status === 'completed';
          }
        );
        
        // Calculate totals for invoiceable products
        let sampleTotal = 0;
        let productionTotal = 0;
        
        approvedProducts.forEach((product: any) => {
          // Add sample fee
          const fee = parseFloat(product.sample_fee || 0);
          sampleTotal += fee;
          
          // Calculate production total (product price × quantity + shipping)
          const totalQty = product.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0);
          const productPrice = parseFloat(product.product_price || 0);
          const airShipping = parseFloat(product.shipping_air_price || 0);
          const boatShipping = parseFloat(product.shipping_boat_price || 0);
          
          // Note: Including both shipping prices as per your calculation method
          productionTotal += (totalQty * productPrice) + airShipping + boatShipping;
        });
        
        const totalValue = sampleTotal + productionTotal;  // For invoice calculations
        
        // Calculate ENTIRE order total (ALL products, not just approved)
        let orderTotal = 0;
        order.order_products.forEach((product: any) => {
          const sampleFee = parseFloat(product.sample_fee || 0);
          const airShipping = parseFloat(product.shipping_air_price || 0);
          const boatShipping = parseFloat(product.shipping_boat_price || 0);
          
          const totalQty = product.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0);
          const productPrice = parseFloat(product.product_price || 0);
          
          orderTotal += sampleFee + (totalQty * productPrice) + airShipping + boatShipping;
        });
        
        // Calculate already invoiced amount (only SENT invoices)
        const invoicedAmount = order.invoices?.reduce((sum: number, inv: any) => {
          if (inv.status === 'sent') {
            return sum + parseFloat(inv.amount || 0);
          }
          return sum;
        }, 0) || 0;
        
        return {
          id: order.id,
          order_number: order.order_number,
          order_name: order.order_name,
          status: order.status,
          client: order.client,
          total_value: totalValue,      // Invoiceable products total
          order_total: orderTotal,       // ENTIRE order total
          invoiced_amount: invoicedAmount,
          ready_to_invoice: Math.max(0, totalValue - invoicedAmount),
          approved_products: approvedProducts.length,
          total_products: order.order_products.length,
          has_samples: sampleTotal > 0,
          sample_total: sampleTotal,
          production_total: productionTotal,
          invoices: order.invoices || []
        };
      }).filter(order => order.approved_products > 0) || [];

      // Filter based on tab
      let filtered = processedOrders;
      if (activeTab === 'ready') {
        filtered = processedOrders.filter(o => o.ready_to_invoice > 0);
      } else if (activeTab === 'draft') {
        filtered = processedOrders.filter(o => 
          o.invoices?.some((inv: any) => inv.status === 'draft')
        );
      } else if (activeTab === 'sent') {
        filtered = processedOrders.filter(o => 
          o.invoices?.some((inv: any) => inv.status === 'sent')
        );
      }

      setOrders(filtered);
    } catch (error) {
      console.error('Error fetching orders:', error);
      notify.error('Failed to load invoiceable orders');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (!searchTerm) return true;
    return (
      order.order_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.client.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setLoading(true);
                fetchInvoiceableOrders();
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => router.push('/dashboard/invoices/create')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Invoice
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('ready')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'ready'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Ready to Invoice
            {orders.filter(o => o.ready_to_invoice > 0).length > 0 && (
              <span className="ml-2 bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs">
                {orders.filter(o => o.ready_to_invoice > 0).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('draft')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'draft'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Draft Invoices
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'sent'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Sent Invoices
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'all'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            All Orders
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by order name, number, or client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
          />
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {activeTab === 'ready' 
                ? 'No orders ready for invoicing' 
                : 'No orders found'}
            </p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <div
              key={order.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Order Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-semibold text-lg text-gray-900">
                        {order.order_name || order.order_number}
                      </h3>
                      <span className="text-sm text-gray-500">
                        #{order.order_number}
                      </span>
                    </div>

                    {/* Client Info */}
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                      <div className="flex items-center gap-1">
                        <Building className="w-4 h-4" />
                        <span>{order.client.name}</span>
                      </div>
                      <span className="text-gray-400">•</span>
                      <span>
                        {order.approved_products} of {order.total_products} products invoiceable
                      </span>
                    </div>

                    {/* Financial Summary */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Order Total</p>
                        <p className="font-semibold text-gray-900">
                          ${order.order_total.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Sent Invoices</p>
                        <p className="font-semibold text-gray-600">
                          ${order.invoiced_amount.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Ready to Invoice</p>
                        <p className="font-semibold text-green-600">
                          ${order.ready_to_invoice.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 ml-4">
                    {order.ready_to_invoice > 0 && (
                      <button
                        onClick={() => router.push(`/dashboard/invoices/create?order=${order.id}`)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        Create Invoice
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                    >
                      View Order
                    </button>
                  </div>
                </div>

                {/* Breakdown if has samples */}
                {order.has_samples && order.ready_to_invoice > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-700 font-medium mb-2">Available to invoice:</p>
                    <div className="flex gap-4">
                      {order.sample_total > 0 && (
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-amber-600" />
                          <span className="text-sm text-gray-700">
                            Sample fees: <span className="font-semibold text-gray-900">${order.sample_total.toFixed(2)}</span>
                          </span>
                        </div>
                      )}
                      {order.production_total > 0 && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-gray-700">
                            Production: <span className="font-semibold text-gray-900">${order.production_total.toFixed(2)}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
