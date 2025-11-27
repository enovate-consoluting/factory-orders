/**
 * ClientProductCard Component - FIXED HIERARCHY
 * Shows: Product description, Product total (not order total)
 * Order-level info belongs in parent page, not here
 */

import React, { useState } from 'react';
import { 
  Package, Plane, Ship, Clock, 
  CheckCircle, MessageSquare, ChevronDown, ChevronUp,
  FileText, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ClientProductCardProps {
  product: any;
  items: any[];
  media: any[];
  order: any;
  allProducts: any[];
  onUpdate?: () => void;
}

export function ClientProductCard({ 
  product, 
  items, 
  media, 
  order,
  allProducts = [],
  onUpdate 
}: ClientProductCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [approving, setApproving] = useState(false);
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showSampleModal, setShowSampleModal] = useState(false);
  const [sampleComments, setSampleComments] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [changeNotes, setChangeNotes] = useState('');
  const [approvingSample, setApprovingSample] = useState(false);

  const hasSample = order?.sample_required && parseFloat(order?.sample_fee || 0) > 0;
  const sampleApproved = order?.sample_approved || false;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 3000);
  };

  const calculateProductTotal = () => {
    let total = 0;
    const totalQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    total += parseFloat(product.client_product_price || 0) * totalQty;
    
    if (product.selected_shipping_method === 'air') {
      total += parseFloat(product.client_shipping_air_price || 0);
    } else if (product.selected_shipping_method === 'boat') {
      total += parseFloat(product.client_shipping_boat_price || 0);
    }
    
    return total;
  };

  const handleApproveSample = async () => {
    if (!hasSample || sampleApproved) return;
    
    setApprovingSample(true);
    try {
      const userData = localStorage.getItem('user');
      const user = userData ? JSON.parse(userData) : null;

      const updateData: any = {
        sample_approved: true,
        sample_approved_at: new Date().toISOString(),
        sample_approved_by: user?.id
      };

      // Add client comments if provided
      if (sampleComments.trim()) {
        updateData.sample_client_notes = sampleComments;
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order?.id);

      if (updateError) throw updateError;

      if (order?.created_by && order?.id) {
        await supabase.from('notifications').insert({
          user_id: order.created_by,
          type: 'sample_approved',
          message: `${order.client?.name || 'Client'} approved sample fee for order ${order.order_number}`,
          order_id: order.id
        });
      }

      showSuccess('Sample fee approved! Admin has been notified.');
      setShowSampleModal(false);
      setSampleComments('');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error approving sample:', error);
      showSuccess('Error approving sample. Please try again.');
    } finally {
      setApprovingSample(false);
    }
  };

  const handleApproveOrder = async () => {
    setApproving(true);
    try {
      const userData = localStorage.getItem('user');
      const user = userData ? JSON.parse(userData) : null;

      const { error: updateError } = await supabase
        .from('order_products')
        .update({
          product_status: 'client_approved',
          routed_to: 'admin',
          routed_at: new Date().toISOString(),
          client_approved_at: new Date().toISOString(),
          client_approved_by: user?.id
        })
        .eq('id', product.id);

      if (updateError) throw updateError;

      if (order?.created_by && order?.id) {
        await supabase.from('notifications').insert({
          user_id: order.created_by,
          type: 'client_approved',
          message: `${order.client?.name || 'Client'} approved ${product.product_order_number}`,
          order_id: order.id,
          product_id: product.id
        });
      }

      showSuccess('Product approved! Admin has been notified.');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error approving product:', error);
      showSuccess('Error approving product. Please try again.');
    } finally {
      setApproving(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!changeNotes.trim()) {
      showSuccess('Please enter what changes you need');
      return;
    }

    setRequestingChanges(true);
    try {
      const userData = localStorage.getItem('user');
      const user = userData ? JSON.parse(userData) : null;

      const timestamp = new Date().toISOString();
      const noteWithTimestamp = `[${new Date(timestamp).toLocaleString()}] ${user?.name}: ${changeNotes}`;
      const existingNotes = product.client_notes || '';
      const updatedNotes = existingNotes 
        ? `${existingNotes}\n\n${noteWithTimestamp}`
        : noteWithTimestamp;

      const { error: updateError } = await supabase
        .from('order_products')
        .update({
          product_status: 'revision_requested',
          routed_to: 'admin',
          routed_at: new Date().toISOString(),
          client_notes: updatedNotes
        })
        .eq('id', product.id);

      if (updateError) throw updateError;

      if (order?.created_by && order?.id) {
        await supabase.from('notifications').insert({
          user_id: order.created_by,
          type: 'revision_requested',
          message: `${order.client?.name || 'Client'} requested changes to ${product.product_order_number}`,
          order_id: order.id,
          product_id: product.id
        });
      }

      showSuccess('Change request sent to admin!');
      setShowRequestModal(false);
      setChangeNotes('');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error requesting changes:', error);
      showSuccess('Error sending change request. Please try again.');
    } finally {
      setRequestingChanges(false);
    }
  };

  const totalQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const productTotal = calculateProductTotal();
  
  const images = media.filter(m => m.file_type?.startsWith('image/'));
  const documents = media.filter(m => !m.file_type?.startsWith('image/'));
  const adminNotes = product.manufacturer_notes || product.internal_notes || '';
  
  const clientProducts = allProducts.filter((p: any) => p.routed_to === 'client');
  const currentIndex = clientProducts.findIndex((p: any) => p.id === product.id) + 1;
  const totalClientProducts = clientProducts.length;

  const getStatusColor = (status: string) => {
    const colors = {
      'pending_client_approval': 'bg-blue-50 text-blue-700 border-blue-200',
      'client_approved': 'bg-green-50 text-green-700 border-green-200',
      'revision_requested': 'bg-gray-50 text-gray-700 border-gray-200',
      'in_production': 'bg-blue-50 text-blue-700 border-blue-200',
      'shipped': 'bg-gray-50 text-gray-700 border-gray-200'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      'pending_client_approval': 'Awaiting Your Approval',
      'client_approved': 'Approved',
      'revision_requested': 'Changes Requested',
      'in_production': 'In Production',
      'shipped': 'Shipped'
    };
    return labels[status as keyof typeof labels] || status;
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg overflow-hidden mb-4 shadow-sm">
      {/* PRODUCT HEADER - Shows product description */}
      <div className="bg-gray-50 border-b border-gray-300 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">
              {product.description || product.product?.title || 'Product'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Order #{order?.order_number || ''}
            </p>
            {totalClientProducts > 1 && (
              <p className="text-xs text-gray-500 mt-2">
                Product {currentIndex} of {totalClientProducts}
              </p>
            )}
          </div>
          
          <div className="text-right bg-white border border-gray-300 rounded-lg p-3 shadow-sm">
            <p className="text-xs text-gray-600 font-semibold">Product Total</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(productTotal)}
            </p>
          </div>
        </div>
      </div>

      {/* Admin Notes */}
      {adminNotes && (
        <div className="bg-blue-50 border-b border-blue-200 p-3">
          <div className="flex items-start gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-blue-900 mb-1">Message from Admin:</p>
              <p className="text-xs text-blue-800 whitespace-pre-wrap">{adminNotes}</p>
            </div>
          </div>
        </div>
      )}

      {/* SAMPLE SECTION - Amber/tan color, small button */}
      {hasSample && (
        <div className="border-b border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-amber-700" />
                <h4 className="text-sm font-semibold text-amber-900">Sample Request</h4>
              </div>
              
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-amber-700">Sample Fee:</span>
                  <span className="font-semibold text-amber-900">{formatCurrency(parseFloat(order?.sample_fee || 0))}</span>
                </div>
                
                {order?.sample_eta && (
                  <div className="flex justify-between">
                    <span className="text-amber-700">Estimated Delivery:</span>
                    <span className="font-semibold text-amber-900">
                      {new Date(order.sample_eta).toLocaleDateString()}
                    </span>
                  </div>
                )}
                
                {order?.sample_notes && (
                  <div className="bg-white rounded p-2 mt-2 border border-amber-200">
                    <p className="text-xs text-gray-700 whitespace-pre-wrap">{order.sample_notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* SMALL APPROVE BUTTON - Right side */}
            {!sampleApproved && product.product_status === 'pending_client_approval' && (
              <button
                onClick={() => setShowSampleModal(true)}
                className="ml-4 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 transition-colors whitespace-nowrap"
              >
                Approve Sample
              </button>
            )}

            {sampleApproved && (
              <span className="ml-4 inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold border border-green-300">
                <CheckCircle className="w-3 h-3" />
                Approved
              </span>
            )}
          </div>
        </div>
      )}

      {/* Product Status */}
      <div className="p-2 bg-white border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-600">PRODUCT FOR YOUR REVIEW</h3>
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${getStatusColor(product.product_status)}`}>
          {getStatusLabel(product.product_status)}
        </div>
      </div>

      {/* Product Details - Collapsible */}
      <div 
        className="p-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-200"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <Package className="w-5 h-5 text-gray-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-gray-900">
                {product.product_order_number}
              </h4>
              <p className="text-xs text-gray-600 mt-0.5">
                {product.description || 'Product'}
              </p>
              {product.production_time && (
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3 text-gray-500" />
                  <span className="text-xs text-gray-600">Production: {product.production_time}</span>
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3 inline mr-1" />
                Hide
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 inline mr-1" />
                Show Details
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-gray-200">
          {images.length > 0 && (
            <div className="p-3 border-b border-gray-200">
              <h5 className="text-xs font-semibold text-gray-700 mb-2">Product Images</h5>
              <div className="grid grid-cols-4 gap-2">
                {images.map((img) => (
                  <img
                    key={img.id}
                    src={img.file_url}
                    alt="Product"
                    className="w-full h-20 object-cover rounded border border-gray-200"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="p-3 border-b border-gray-200">
            <h5 className="text-xs font-semibold text-gray-700 mb-2">Variants & Quantities</h5>
            <div className="space-y-1">
              {items.filter(item => item.quantity > 0).map((item) => (
                <div key={item.id} className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                  <span className="text-gray-700">{item.variant_combo}</span>
                  <span className="font-semibold text-gray-900">{item.quantity} units</span>
                </div>
              ))}
              {items.filter(item => item.notes).map((item) => (
                <div key={`note-${item.id}`} className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-xs text-blue-800">
                    <span className="font-semibold">{item.variant_combo}:</span> {item.notes}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-300 flex justify-between text-xs font-semibold">
              <span className="text-gray-700">Total Quantity:</span>
              <span className="text-gray-900">{totalQty} units</span>
            </div>
          </div>

          {documents.length > 0 && (
            <div className="p-3 border-b border-gray-200">
              <h5 className="text-xs font-semibold text-gray-700 mb-2">Documents</h5>
              <div className="space-y-1">
                {documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded transition-colors"
                  >
                    <FileText className="w-3 h-3" />
                    {doc.file_name}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 bg-gray-50">
            <h5 className="text-xs font-semibold text-gray-700 mb-2">Pricing</h5>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Unit Price:</span>
                <span className="font-semibold text-gray-900">{formatCurrency(parseFloat(product.client_product_price || 0))}</span>
              </div>
              
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Quantity:</span>
                <span className="font-semibold text-gray-900">{totalQty} units</span>
              </div>
              
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(parseFloat(product.client_product_price || 0) * totalQty)}
                </span>
              </div>

              {product.selected_shipping_method && (
                <div className="flex justify-between text-xs items-center">
                  <span className="flex items-center gap-1 text-gray-600">
                    {product.selected_shipping_method === 'air' ? (
                      <Plane className="w-3 h-3" />
                    ) : (
                      <Ship className="w-3 h-3" />
                    )}
                    Shipping ({product.selected_shipping_method}):
                  </span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(
                      parseFloat(
                        product.selected_shipping_method === 'air'
                          ? product.client_shipping_air_price || 0
                          : product.client_shipping_boat_price || 0
                      )
                    )}
                  </span>
                </div>
              )}

              <div className="pt-2 mt-2 border-t border-gray-300 flex justify-between">
                <span className="text-sm font-bold text-gray-900">Product Total:</span>
                <span className="text-base font-bold text-gray-900">
                  {formatCurrency(productTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTION BUTTONS */}
      {product.product_status === 'pending_client_approval' && (
        <div className="p-3 bg-white border-t border-gray-200 flex gap-2">
          <button
            onClick={handleApproveOrder}
            disabled={approving}
            className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            {approving ? 'Approving...' : 'Approve Order'}
          </button>
          
          <button
            onClick={() => setShowRequestModal(true)}
            disabled={requestingChanges}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 text-sm font-semibold rounded hover:bg-gray-300 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Request Changes
          </button>
        </div>
      )}

      {/* SAMPLE APPROVAL MODAL - With comments field */}
      {showSampleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Approve Sample Fee</h3>
            <p className="text-sm text-gray-600 mb-4">
              Sample Fee: <strong>{formatCurrency(parseFloat(order?.sample_fee || 0))}</strong>
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Add any comments or instructions for the admin (optional):
            </p>
            <textarea
              value={sampleComments}
              onChange={(e) => setSampleComments(e.target.value)}
              placeholder="Comments for admin (optional)..."
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm text-gray-900 placeholder-gray-500"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowSampleModal(false);
                  setSampleComments('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={approvingSample}
              >
                Cancel
              </button>
              <button
                onClick={handleApproveSample}
                disabled={approvingSample}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {approvingSample ? 'Approving...' : 'Approve Sample'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Changes Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Request Changes</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please describe what changes you need for this product. Your message will be sent to the admin.
            </p>
            <textarea
              value={changeNotes}
              onChange={(e) => setChangeNotes(e.target.value)}
              placeholder="Describe the changes needed..."
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-sm text-gray-900 placeholder-gray-500"
              required
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowRequestModal(false);
                  setChangeNotes('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={requestingChanges}
              >
                Cancel
              </button>
              <button
                onClick={handleRequestChanges}
                disabled={!changeNotes.trim() || requestingChanges}
                className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50 transition-colors"
              >
                {requestingChanges ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Success</h3>
            </div>
            <p className="text-gray-700 mb-4">{successMessage}</p>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}