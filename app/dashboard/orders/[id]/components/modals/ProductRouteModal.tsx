/**
 * Route Modal Component - Individual Product Routing
 * Used by manufacturers AND admins to route individual products
 * UPDATED: Removed sample request option (now handled independently)
 * Last Modified: November 30, 2025
 */

import React, { useState } from 'react';
import { X, Send, Package, AlertCircle, CheckCircle, RotateCcw, Loader2, Factory, Truck, Ship as ShipIcon, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';

interface ProductRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  onUpdate: () => void;
  userRole?: string;
}

export function ProductRouteModal({ isOpen, onClose, product, onUpdate, userRole }: ProductRouteModalProps) {
  const { t } = useTranslation();
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  // Shipping fields
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingCarrier, setShippingCarrier] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');

  // Prevent background scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    };
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const isManufacturer = userRole === 'manufacturer';
  const isInProduction = product?.is_locked || product?.product_status === 'in_production';
  const isShipped = product?.product_status === 'shipped' || product?.product_status === 'in_transit' || product?.product_status === 'delivered';

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

  // Helper function to create client notification
  const createClientNotification = async (
    orderId: string,
    productId: string,
    type: string,
    message: string
  ) => {
    try {
      const { data: orderData } = await supabase
        .from('orders')
        .select('client_id, order_number')
        .eq('id', orderId)
        .single();

      if (orderData?.client_id) {
        // Find user(s) associated with this client
        const { data: clientUsers } = await supabase
          .from('users')
          .select('id')
          .eq('client_id', orderData.client_id);

        if (clientUsers && clientUsers.length > 0) {
          // Create notification for each client user
          const notifications = clientUsers.map(user => ({
            user_id: user.id,
            type: type,
            message: `${message} - Order ${orderData.order_number}`,
            is_read: false,
            created_at: new Date().toISOString()
          }));

          await supabase
            .from('notifications')
            .insert(notifications);
        }
      }
    } catch (error) {
      console.error('Error creating client notification:', error);
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
      let notifyClient = false;
      
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
            // Ship to client/admin
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
        // ADMIN ROUTING OPTIONS - UPDATED: Removed request_sample
        switch (selectedRoute) {
          case 'approve_for_production':
            // Send to manufacturer for production
            updates.product_status = 'approved_for_production';
            updates.routed_to = 'manufacturer';
            updates.routed_at = new Date().toISOString();
            updates.routed_by = user.id || null;
            updates.is_locked = false;
            break;
            
          case 'send_for_approval':
            // Route to CLIENT for approval
            updates.requires_client_approval = true;
            updates.product_status = 'pending_client_approval';
            updates.routed_to = 'client';
            updates.routed_at = new Date().toISOString();
            updates.routed_by = user.id || null;
            notificationType = 'approval_requested';
            notificationMessage = `Product ${product.product_order_number || ''} needs your approval`;
            notifyClient = true;
            break;
            
          case 'send_back_to_manufacturer':
            // Send back to manufacturer for revisions
            updates.product_status = 'revision_requested';
            updates.routed_to = 'manufacturer';
            updates.routed_at = new Date().toISOString();
            updates.routed_by = user.id || null;
            break;
        }
        
        // Notify client if sending for approval
        if (notifyClient && notificationType && notificationMessage && orderId) {
          await createClientNotification(orderId, product.id, notificationType, notificationMessage);
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
              {isManufacturer ? t('updateProductStatus') : t('routeProduct')}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {product.description || product.product?.title || t('product')}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning for shipped products */}
        {isShipped && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800">Product Already Shipped</h3>
                <p className="text-sm text-amber-700 mt-1">
                  This product has been shipped and cannot be re-routed. The shipping information is locked.
                </p>
                {product?.tracking_number && (
                  <p className="text-sm text-amber-700 mt-2">
                    <strong>Tracking:</strong> {product.tracking_number}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Routing Options */}
        {isShipped ? null : isManufacturer ? (
          // MANUFACTURER OPTIONS - 3 OPTIONS
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
                  <h3 className="font-semibold text-gray-900">{t('sendToAdmin')}</h3>
                  <p className="text-xs sm:text-sm text-gray-500">{t('sendQuestionToAdmin')}</p>
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
                  <h3 className="font-semibold text-gray-900">{t('markInProduction')}</h3>
                  <p className="text-xs sm:text-sm text-gray-500">{t('markProductInProduction')}</p>
                </div>
              </div>
            </button>
            
            {/* Shipping option - only show when in production */}
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
                    <h3 className="font-semibold text-gray-900">{t('shipToClient')}</h3>
                    <p className="text-xs sm:text-sm text-gray-500">{t('productCompleteReadyToShip')}</p>
                  </div>
                </div>
              </button>
            )}
          </div>
        ) : (
          // ADMIN OPTIONS - UPDATED: Removed "Request Sample" option (now 3 options instead of 4)
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
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
                <h3 className="font-semibold text-gray-900">{t('approveForProduction')}</h3>
              </div>
              <p className="text-xs sm:text-sm text-gray-500">{t('sendToManufacturerForProduction')}</p>
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
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900">{t('sendForApproval')}</h3>
              </div>
              <p className="text-xs sm:text-sm text-gray-500">{t('sendForClientApproval')}</p>
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
                <h3 className="font-semibold text-gray-900">{t('backToManufacturer')}</h3>
              </div>
              <p className="text-xs sm:text-sm text-gray-500">{t('requestRevisionsFromManufacturer')}</p>
            </button>
          </div>
        )}

        {/* Shipping Fields - Show when "shipped" is selected */}
        {selectedRoute === 'shipped' && (
          <div className="mb-4 sm:mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-600" />
              {t('shippingInformation')}
            </h3>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                {t('trackingNumberOptional')}
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder={t('enterTrackingNumber')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium placeholder-gray-500 focus:ring-2 focus:ring-purple-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                {t('shippingCarrierOptional')}
              </label>
              <select
                value={shippingCarrier}
                onChange={(e) => setShippingCarrier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-purple-500 bg-white"
              >
                <option value="">{t('selectCarrier')}</option>
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
                {t('estimatedDeliveryDateOptional')}
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
                {t('shippingNotesOptional')}
              </label>
              <textarea
                value={shippingNotes}
                onChange={(e) => setShippingNotes(e.target.value)}
                placeholder={t('packageDetails')}
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
              {isManufacturer ? t('notesForAdmin') : t('routingNotes')} ({t('optional')})
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder={isManufacturer ? t('addQuestionsForAdmin') : t('addNotesOrInstructions')}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <button
            onClick={handleClose}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleRoute}
            disabled={!selectedRoute || sending || isShipped}
            className={`w-full sm:w-auto px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              selectedRoute === 'shipped'
                ? 'bg-purple-600 hover:bg-purple-700'
                : selectedRoute === 'send_for_approval'
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {selectedRoute === 'shipped' ? t('shipping') : t('routing')}
              </>
            ) : (
              <>
                {selectedRoute === 'shipped' ? <Truck className="w-4 h-4" /> :
                 selectedRoute === 'send_for_approval' ? <User className="w-4 h-4" /> :
                 <Send className="w-4 h-4" />}
                {selectedRoute === 'shipped' ? t('shipProduct') :
                 selectedRoute === 'send_for_approval' ? t('sendForApproval') :
                 t('submitRouting')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}