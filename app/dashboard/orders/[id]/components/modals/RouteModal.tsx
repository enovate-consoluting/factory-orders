// app/dashboard/orders/[id]/components/modals/RouteModal.tsx - WITH SHIPPING ADDED

import React, { useState } from 'react';
import { X, Send, Package, AlertCircle, CheckCircle, RotateCcw, Loader2, Factory, Truck, Ship as ShipIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface RouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  onUpdate: () => void;
  userRole?: string;
}

export function RouteModal({ isOpen, onClose, product, onUpdate, userRole }: RouteModalProps) {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  
  // Shipping fields
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingCarrier, setShippingCarrier] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');

  if (!isOpen || !product) return null;

  const isManufacturer = userRole === 'manufacturer';
  const isInProduction = product?.is_locked || product?.product_status === 'in_production';

  // Helper function to create admin notification
  const createAdminNotification = async (
    orderId: string,
    productId: string,
    type: string,
    message: string
  ) => {
    try {
      const { data: orderData } = await supabase
        .from('orders')
        .select('created_by, order_number')
        .eq('id', orderId)
        .single();

      if (orderData?.created_by) {
        await supabase
          .from('notifications')
          .insert({
            user_id: orderData.created_by,
            type: type,
            message: `${message} - Order ${orderData.order_number}`,
            is_read: false,
            created_at: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error('Error creating admin notification:', error);
    }
  };

  const handleRoute = async () => {
    if (!selectedRoute) return;

    setSending(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      // Get order ID from product
      const { data: productData } = await supabase
        .from('order_products')
        .select('order_id')
        .eq('id', product.id)
        .single();

      const orderId = productData?.order_id || product.order_id;

      let updates: any = {};
      let notificationType = '';
      let notificationMessage = '';
      
      if (isManufacturer) {
        // MANUFACTURER ROUTING OPTIONS
        switch (selectedRoute) {
          case 'send_to_admin':
            // Route product back to admin
            updates.product_status = 'pending_admin';
            updates.routed_to = 'admin';
            updates.routed_at = new Date().toISOString();
            updates.routed_by = user.id || null;
            notificationType = 'manufacturer_question';
            notificationMessage = `Manufacturer has a question about ${product.product_order_number || 'product'}`;
            break;
            
          case 'in_production':
            // Mark as in production (stays with manufacturer but visible to all)
            updates.product_status = 'in_production';
            updates.routed_to = 'manufacturer';
            updates.routed_at = new Date().toISOString();
            updates.routed_by = user.id || null;
            updates.is_locked = true;
            notificationType = 'production_started';
            notificationMessage = `Product ${product.product_order_number || ''} is now in production`;
            break;
            
          case 'shipped':
            // NEW: Ship to client/admin
            updates.product_status = 'shipped';
            updates.routed_to = 'admin';
            updates.routed_at = new Date().toISOString();
            updates.routed_by = user.id || null;
            updates.tracking_number = trackingNumber || null;
            updates.shipping_carrier = shippingCarrier || null;
            updates.shipping_notes = shippingNotes || null;
            updates.shipped_date = new Date().toISOString();
            updates.estimated_delivery = estimatedDelivery || null;
            notificationType = 'product_shipped';
            
            // Create a clean notification message
            let shippingDetails = `Product ${product.product_order_number || ''} has been shipped`;
            if (trackingNumber && shippingCarrier) {
              shippingDetails += ` via ${shippingCarrier} (${trackingNumber})`;
            } else if (trackingNumber) {
              shippingDetails += ` - Tracking: ${trackingNumber}`;
            } else if (shippingCarrier) {
              shippingDetails += ` via ${shippingCarrier}`;
            }
            notificationMessage = shippingDetails;
            break;
        }
        
        // Notify admin of changes
        if (notificationType && notificationMessage && orderId) {
          await createAdminNotification(orderId, product.id, notificationType, notificationMessage);
        }
        
      } else {
        // ADMIN ROUTING OPTIONS (unchanged)
        switch (selectedRoute) {
          case 'approve_for_production':
            // Send to manufacturer for production
            updates.product_status = 'approved_for_production';
            updates.routed_to = 'manufacturer';
            updates.routed_at = new Date().toISOString();
            updates.routed_by = user.id || null;
            updates.is_locked = false;
            break;
            
          case 'request_sample':
            // Request sample from manufacturer
            updates.sample_required = true;
            updates.product_status = 'sample_requested';
            updates.routed_to = 'manufacturer';
            updates.routed_at = new Date().toISOString();
            updates.routed_by = user.id || null;
            break;
            
          case 'send_for_approval':
            // Keep with admin but mark for client approval
            updates.requires_client_approval = true;
            updates.product_status = 'pending_client_approval';
            updates.routed_to = 'admin';
            break;
            
          case 'send_back_to_manufacturer':
            // Send back to manufacturer for revisions
            updates.product_status = 'revision_requested';
            updates.routed_to = 'manufacturer';
            updates.routed_at = new Date().toISOString();
            updates.routed_by = user.id || null;
            break;
        }
      }

      // Add notes to manufacturer_notes field if provided
      if (notes || (selectedRoute === 'shipped' && shippingNotes)) {
        const timestamp = new Date().toLocaleDateString();
        const userIdentifier = isManufacturer ? 'Manufacturer' : 'Admin';
        const noteContent = selectedRoute === 'shipped' && shippingNotes 
          ? `SHIPPED: ${shippingNotes}${trackingNumber ? ` | Tracking: ${trackingNumber}` : ''}`
          : notes;
        
        updates.manufacturer_notes = product.manufacturer_notes 
          ? `${product.manufacturer_notes}\n\n[${timestamp} - ${userIdentifier}] ${noteContent}`
          : `[${timestamp} - ${userIdentifier}] ${noteContent}`;
      }

      // Update product with new routing
      await supabase
        .from('order_products')
        .update(updates)
        .eq('id', product.id);

      // Log to audit
      await supabase
        .from('audit_log')
        .insert({
          user_id: user.id || crypto.randomUUID(),
          user_name: user.name || user.email || (isManufacturer ? 'Manufacturer' : 'Admin'),
          action_type: `product_routed_${selectedRoute}`,
          target_type: 'order_product',
          target_id: product.id,
          old_value: `${product.product_status || 'pending'} / routed_to: ${product.routed_to || 'admin'}`,
          new_value: `${updates.product_status} / routed_to: ${updates.routed_to}`,
          timestamp: new Date().toISOString()
        });

      // Add routing notes to audit if provided
      if (notes || (selectedRoute === 'shipped' && (trackingNumber || shippingNotes))) {
        let auditNote = '';
        
        if (selectedRoute === 'shipped') {
          // Group all shipping info together in one clean format
          const shippingInfo = [];
          
          if (trackingNumber) {
            shippingInfo.push(`Tracking: ${trackingNumber}`);
          }
          if (shippingCarrier) {
            shippingInfo.push(`Carrier: ${shippingCarrier}`);
          }
          if (estimatedDelivery) {
            const deliveryDate = new Date(estimatedDelivery).toLocaleDateString();
            shippingInfo.push(`Est. Delivery: ${deliveryDate}`);
          }
          if (shippingNotes) {
            shippingInfo.push(`Notes: ${shippingNotes}`);
          }
          
          // Create one consolidated shipping info entry
          auditNote = `📦 SHIPPING INFO:\n${shippingInfo.length > 0 ? shippingInfo.join('\n') : 'Product shipped (no tracking details provided)'}`;
        } else {
          auditNote = notes;
        }
        
        if (auditNote) {
          await supabase
            .from('audit_log')
            .insert({
              user_id: user.id || crypto.randomUUID(),
              user_name: user.name || user.email || (isManufacturer ? 'Manufacturer' : 'Admin'),
              action_type: selectedRoute === 'shipped' ? 'shipping_info' : 'routing_note',
              target_type: 'order_product',
              target_id: product.id,
              new_value: auditNote,
              timestamp: new Date().toISOString()
            });
        }
      }

      onUpdate();
      handleClose();
    } catch (error) {
      console.error('Error routing product:', error);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSelectedRoute(null);
    setNotes('');
    setTrackingNumber('');
    setShippingCarrier('');
    setShippingNotes('');
    setEstimatedDelivery('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              {isManufacturer ? 'Update Product Status' : 'Route Product'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {product.description || product.product?.title || 'Product'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Routing Options */}
        {isManufacturer ? (
          // MANUFACTURER OPTIONS - NOW 3 OPTIONS
          <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <button
              onClick={() => setSelectedRoute('send_to_admin')}
              className={`p-3 sm:p-4 border-2 rounded-lg transition-all text-left group ${
                selectedRoute === 'send_to_admin'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors ${
                  selectedRoute === 'send_to_admin'
                    ? 'bg-blue-200'
                    : 'bg-blue-100 group-hover:bg-blue-200'
                }`}>
                  <Send className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Send to Admin</h3>
                  <p className="text-xs sm:text-sm text-gray-500">Send question or update to admin for review</p>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => setSelectedRoute('in_production')}
              className={`p-3 sm:p-4 border-2 rounded-lg transition-all text-left group ${
                selectedRoute === 'in_production'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-500 hover:bg-green-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors ${
                  selectedRoute === 'in_production'
                    ? 'bg-green-200'
                    : 'bg-green-100 group-hover:bg-green-200'
                }`}>
                  <Factory className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">In Production</h3>
                  <p className="text-xs sm:text-sm text-gray-500">Mark this product as currently in production</p>
                </div>
              </div>
            </button>
            
            {/* NEW: Shipping option - only show when in production */}
            {isInProduction && (
              <button
                onClick={() => setSelectedRoute('shipped')}
                className={`p-3 sm:p-4 border-2 rounded-lg transition-all text-left group ${
                  selectedRoute === 'shipped'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-500 hover:bg-purple-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors ${
                    selectedRoute === 'shipped'
                      ? 'bg-purple-200'
                      : 'bg-purple-100 group-hover:bg-purple-200'
                  }`}>
                    <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Ship to Client</h3>
                    <p className="text-xs sm:text-sm text-gray-500">Product is complete and ready to ship</p>
                  </div>
                </div>
              </button>
            )}
          </div>
        ) : (
          // ADMIN OPTIONS (unchanged)
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <button
              onClick={() => setSelectedRoute('approve_for_production')}
              className={`p-3 sm:p-4 border-2 rounded-lg transition-all text-left group ${
                selectedRoute === 'approve_for_production'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-500 hover:bg-green-50'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors ${
                  selectedRoute === 'approve_for_production'
                    ? 'bg-green-200'
                    : 'bg-green-100 group-hover:bg-green-200'
                }`}>
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Approve for Production</h3>
              </div>
              <p className="text-xs sm:text-sm text-gray-500">Send to manufacturer for production</p>
            </button>

            <button
              onClick={() => setSelectedRoute('request_sample')}
              className={`p-3 sm:p-4 border-2 rounded-lg transition-all text-left group ${
                selectedRoute === 'request_sample'
                  ? 'border-yellow-500 bg-yellow-50'
                  : 'border-gray-200 hover:border-yellow-500 hover:bg-yellow-50'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors ${
                  selectedRoute === 'request_sample'
                    ? 'bg-yellow-200'
                    : 'bg-yellow-100 group-hover:bg-yellow-200'
                }`}>
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Request Sample</h3>
              </div>
              <p className="text-xs sm:text-sm text-gray-500">Request sample before production</p>
            </button>

            <button
              onClick={() => setSelectedRoute('send_for_approval')}
              className={`p-3 sm:p-4 border-2 rounded-lg transition-all text-left group ${
                selectedRoute === 'send_for_approval'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-500 hover:bg-purple-50'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors ${
                  selectedRoute === 'send_for_approval'
                    ? 'bg-purple-200'
                    : 'bg-purple-100 group-hover:bg-purple-200'
                }`}>
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Send to Client</h3>
              </div>
              <p className="text-xs sm:text-sm text-gray-500">Send for client approval</p>
            </button>

            <button
              onClick={() => setSelectedRoute('send_back_to_manufacturer')}
              className={`p-3 sm:p-4 border-2 rounded-lg transition-all text-left group ${
                selectedRoute === 'send_back_to_manufacturer'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-orange-500 hover:bg-orange-50'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors ${
                  selectedRoute === 'send_back_to_manufacturer'
                    ? 'bg-orange-200'
                    : 'bg-orange-100 group-hover:bg-orange-200'
                }`}>
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Back to Manufacturer</h3>
              </div>
              <p className="text-xs sm:text-sm text-gray-500">Request revisions from manufacturer</p>
            </button>
          </div>
        )}

        {/* Shipping Fields - Show when "shipped" is selected */}
        {selectedRoute === 'shipped' && (
          <div className="mb-4 sm:mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-600" />
              Shipping Information
            </h3>
            
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Tracking Number (Optional)
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Enter tracking number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium placeholder-gray-500 focus:ring-2 focus:ring-purple-500 bg-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Shipping Carrier (Optional)
              </label>
              <select
                value={shippingCarrier}
                onChange={(e) => setShippingCarrier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-purple-500 bg-white"
              >
                <option value="">Select carrier...</option>
                <option value="DHL">DHL</option>
                <option value="FedEx">FedEx</option>
                <option value="UPS">UPS</option>
                <option value="USPS">USPS</option>
                <option value="China Post">China Post</option>
                <option value="SF Express">SF Express</option>
                <option value="EMS">EMS</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Estimated Delivery Date (Optional)
              </label>
              <input
                type="date"
                value={estimatedDelivery}
                onChange={(e) => setEstimatedDelivery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-purple-500 bg-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Shipping Notes (Optional)
              </label>
              <textarea
                value={shippingNotes}
                onChange={(e) => setShippingNotes(e.target.value)}
                placeholder="Package details, special instructions..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium placeholder-gray-500 focus:ring-2 focus:ring-purple-500 bg-white"
              />
            </div>
          </div>
        )}

        {/* Routing Notes - Hide when shipping is selected (use shipping notes instead) */}
        {selectedRoute !== 'shipped' && (
          <div className="mb-4 sm:mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isManufacturer ? 'Notes for Admin' : 'Routing Notes'} (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder={isManufacturer ? "Add any questions or updates for admin..." : "Add any notes or instructions..."}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <button
            onClick={handleClose}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRoute}
            disabled={!selectedRoute || sending}
            className={`w-full sm:w-auto px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              selectedRoute === 'shipped' 
                ? 'bg-purple-600 hover:bg-purple-700' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {selectedRoute === 'shipped' ? 'Shipping...' : 'Routing...'}
              </>
            ) : (
              <>
                {selectedRoute === 'shipped' ? <Truck className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                {selectedRoute === 'shipped' ? 'Ship Product' : 'Submit Routing'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}