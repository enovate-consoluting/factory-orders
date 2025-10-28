'use client';

import React, { useState } from 'react';
import { 
  Package, 
  Send, 
  FlaskConical, 
  Users, 
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { OrderProduct, ProductStatus } from '@/app/types/database';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createNotification } from '@/app/hooks/useNotifications';

interface ProductRoutingPanelProps {
  product: OrderProduct;
  orderId: string;
  manufacturerId: string;
  clientId: string;
  onRoutingComplete: () => void;
  currentUserId: string;
}

type RoutingOption = 'direct' | 'sample' | 'client';

export default function ProductRoutingPanel({
  product,
  orderId,
  manufacturerId,
  clientId,
  onRoutingComplete,
  currentUserId
}: ProductRoutingPanelProps) {
  const [selectedRoute, setSelectedRoute] = useState<RoutingOption | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notes, setNotes] = useState('');
  const supabase = createClientComponentClient();

  const handleRouteSubmit = async () => {
    if (!selectedRoute) {
      alert('Please select a routing option');
      return;
    }

    setIsProcessing(true);

    try {
      let newStatus: ProductStatus;
      let requiresSample = false;
      let requiresClientApproval = false;
      let notificationUserId: string | null = null;
      let notificationMessage = '';

      switch (selectedRoute) {
        case 'direct':
          // Direct to production - no sample or client review needed
          newStatus = 'approved';
          notificationUserId = manufacturerId;
          notificationMessage = `Product "${product.product?.title}" approved for direct production`;
          break;

        case 'sample':
          // Request sample from manufacturer
          newStatus = 'sample_required';
          requiresSample = true;
          notificationUserId = manufacturerId;
          notificationMessage = `Sample requested for product "${product.product?.title}"`;
          break;

        case 'client':
          // Send to client for review
          newStatus = 'client_review';
          requiresClientApproval = true;
          notificationUserId = clientId;
          notificationMessage = `Product "${product.product?.title}" requires your approval`;
          break;

        default:
          throw new Error('Invalid routing option');
      }

      // Update product status and flags
      const { error: updateError } = await supabase
        .from('order_products')
        .update({
          product_status: newStatus,
          requires_sample: requiresSample,
          requires_client_approval: requiresClientApproval,
          admin_notes: notes || null
        })
        .eq('id', product.id);

      if (updateError) throw updateError;

      // Update order status if needed
      if (selectedRoute === 'direct' || selectedRoute === 'sample') {
        const { error: orderError } = await supabase
          .from('orders')
          .update({ 
            status: selectedRoute === 'sample' ? 'submitted_for_sample' : 'submitted_to_manufacturer' 
          })
          .eq('id', orderId);

        if (orderError) throw orderError;
      } else if (selectedRoute === 'client') {
        const { error: orderError } = await supabase
          .from('orders')
          .update({ status: 'submitted_to_client' })
          .eq('id', orderId);

        if (orderError) throw orderError;
      }

      // Create notification for the relevant party
      if (notificationUserId) {
        await createNotification(supabase, {
          user_id: notificationUserId,
          order_id: orderId,
          order_product_id: product.id,
          type: selectedRoute === 'client' ? 'approval_needed' : 'new_order',
          message: notificationMessage
        });
      }

      // Log the routing decision
      await supabase
        .from('audit_log')
        .insert({
          user_id: currentUserId,
          user_name: 'Admin',
          action_type: 'product_routing',
          target_type: 'order_product',
          target_id: product.id,
          new_value: selectedRoute,
          timestamp: new Date().toISOString()
        });

      alert(`Product routed successfully: ${selectedRoute === 'direct' ? 'Direct to Production' : selectedRoute === 'sample' ? 'Sample Requested' : 'Sent to Client'}`);
      onRoutingComplete();
    } catch (error) {
      console.error('Error routing product:', error);
      alert('Failed to route product. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Don't show routing panel if product is already routed or locked
  if (product.is_locked || product.product_status !== 'pending') {
    return null;
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <Package className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-semibold text-white">
          Route Product: {product.product?.title}
        </h3>
      </div>

      <div className="bg-blue-950/20 border border-blue-800 rounded p-3 mb-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-400 mt-0.5" />
          <p className="text-sm text-blue-300">
            Choose how to proceed with this product. You can send it directly to production, 
            request a sample first, or send it to the client for approval.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Direct to Production */}
        <label
          className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
            selectedRoute === 'direct'
              ? 'border-green-600 bg-green-950/20'
              : 'border-slate-600 hover:bg-slate-700/50'
          }`}
        >
          <input
            type="radio"
            name="routing"
            value="direct"
            checked={selectedRoute === 'direct'}
            onChange={() => setSelectedRoute('direct')}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <p className="font-medium text-green-400">Direct to Production</p>
            </div>
            <p className="text-sm text-slate-400">
              No sample needed. Product will go directly into manufacturing.
              Best for repeat orders or pre-approved designs.
            </p>
          </div>
        </label>

        {/* Request Sample */}
        <label
          className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
            selectedRoute === 'sample'
              ? 'border-yellow-600 bg-yellow-950/20'
              : 'border-slate-600 hover:bg-slate-700/50'
          }`}
        >
          <input
            type="radio"
            name="routing"
            value="sample"
            checked={selectedRoute === 'sample'}
            onChange={() => setSelectedRoute('sample')}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <FlaskConical className="w-4 h-4 text-yellow-400" />
              <p className="font-medium text-yellow-400">Request Sample First</p>
            </div>
            <p className="text-sm text-slate-400">
              Manufacturer will create a sample for approval before full production.
              Recommended for new designs or quality verification.
            </p>
          </div>
        </label>

        {/* Client Review */}
        <label
          className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
            selectedRoute === 'client'
              ? 'border-blue-600 bg-blue-950/20'
              : 'border-slate-600 hover:bg-slate-700/50'
          }`}
        >
          <input
            type="radio"
            name="routing"
            value="client"
            checked={selectedRoute === 'client'}
            onChange={() => setSelectedRoute('client')}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-400" />
              <p className="font-medium text-blue-400">Send to Client for Approval</p>
            </div>
            <p className="text-sm text-slate-400">
              Client will review and approve before production begins.
              Use when client input is needed on specifications or pricing.
            </p>
          </div>
        </label>
      </div>

      {/* Optional Notes */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-slate-400 mb-2">
          Admin Notes (Optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes about this routing decision..."
          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          rows={3}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-slate-400">
          {selectedRoute && (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>
                {selectedRoute === 'direct' && 'Product will be sent directly to manufacturing'}
                {selectedRoute === 'sample' && 'Manufacturer will be notified to create a sample'}
                {selectedRoute === 'client' && 'Client will be notified for approval'}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={handleRouteSubmit}
          disabled={!selectedRoute || isProcessing}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
            selectedRoute && !isProcessing
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Send className="w-4 h-4" />
          {isProcessing ? 'Processing...' : 'Confirm Routing'}
        </button>
      </div>
    </div>
  );
}