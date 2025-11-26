'use client';

import React, { useState } from 'react';
import { 
  X, 
  DollarSign, 
  Calendar, 
  Upload, 
  Plane, 
  Truck,
  Package,
  Clock,
  Save
} from 'lucide-react';
import { OrderProduct } from '@/app/types/database';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createNotification } from '@/app/hooks/useNotifications';
import { ACCEPTED_FILE_TYPES } from '@/lib/constants/fileUpload';

interface ManufacturerProductModalProps {
  product: OrderProduct;
  orderId: string;
  onClose: () => void;
  onUpdate: () => void;
  currentUserId: string;
}

export default function ManufacturerProductModal({
  product,
  orderId,
  onClose,
  onUpdate,
  currentUserId
}: ManufacturerProductModalProps) {
  const supabase = createClientComponentClient();
  const [activeTab, setActiveTab] = useState<'sample' | 'production'>('sample');
  const [loading, setLoading] = useState(false);
  
  // Sample fields
  const [sampleFee, setSampleFee] = useState(product.sample_fee?.toString() || '');
  const [sampleEta, setSampleEta] = useState(product.sample_eta || '');
  const [sampleShippingMethod, setSampleShippingMethod] = useState<'air' | 'land' | ''>(
    product.sample_shipping_method || ''
  );
  const [sampleShippingCost, setSampleShippingCost] = useState(
    product.sample_shipping_cost?.toString() || ''
  );
  
  // Production fields
  const [standardPrice, setStandardPrice] = useState(product.standard_price?.toString() || '');
  const [bulkPrice, setBulkPrice] = useState(product.bulk_price?.toString() || '');
  const [fullOrderEta, setFullOrderEta] = useState(product.full_order_eta || '');
  const [fullShippingMethod, setFullShippingMethod] = useState<'air' | 'land' | ''>(
    product.full_shipping_method || ''
  );
  const [fullShippingCost, setFullShippingCost] = useState(
    product.full_shipping_cost?.toString() || ''
  );
  
  // Notes
  const [manufacturerNotes, setManufacturerNotes] = useState(product.manufacturer_notes || '');
  
  // Sample files
  const [sampleFiles, setSampleFiles] = useState<File[]>([]);

  const handleSubmit = async () => {
    setLoading(true);

    try {
      // Prepare update data
      const updateData: any = {
        manufacturer_notes: manufacturerNotes || null,
      };

      // Add sample data if provided
      if (activeTab === 'sample' || product.requires_sample) {
        if (sampleFee) updateData.sample_fee = parseFloat(sampleFee);
        if (sampleEta) updateData.sample_eta = sampleEta;
        if (sampleShippingMethod) updateData.sample_shipping_method = sampleShippingMethod;
        if (sampleShippingCost) updateData.sample_shipping_cost = parseFloat(sampleShippingCost);
      }

      // Add production data if provided
      if (activeTab === 'production' || !product.requires_sample) {
        if (standardPrice) updateData.standard_price = parseFloat(standardPrice);
        if (bulkPrice) updateData.bulk_price = parseFloat(bulkPrice);
        if (fullOrderEta) updateData.full_order_eta = fullOrderEta;
        if (fullShippingMethod) updateData.full_shipping_method = fullShippingMethod;
        if (fullShippingCost) updateData.full_shipping_cost = parseFloat(fullShippingCost);
      }

      // Update product status if pricing is provided
      if (product.product_status === 'manufacturer_review' || product.product_status === 'sample_required') {
        if (sampleFee || standardPrice) {
          updateData.product_status = 'manufacturer_processed';
        }
      }

      // Update the product
      const { error: updateError } = await supabase
        .from('order_products')
        .update(updateData)
        .eq('id', product.id);

      if (updateError) throw updateError;

      // Upload sample files if any
      if (sampleFiles.length > 0) {
        for (const file of sampleFiles) {
          // Upload to storage
          const fileName = `sample-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('order-media')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Save media record
          const { error: mediaError } = await supabase
            .from('order_media')
            .insert({
              order_product_id: product.id,
              file_url: uploadData.path,
              file_type: file.type,
              uploaded_by: currentUserId
            });

          if (mediaError) throw mediaError;
        }
      }

      // Update order status if needed
      const { data: orderData } = await supabase
        .from('orders')
        .select('status, created_by')
        .eq('id', orderId)
        .single();

      if (orderData && orderData.status === 'submitted_to_manufacturer') {
        await supabase
          .from('orders')
          .update({ status: 'manufacturer_processed' })
          .eq('id', orderId);

        // Notify admin
        await createNotification(supabase, {
          user_id: orderData.created_by,
          order_id: orderId,
          order_product_id: product.id,
          type: 'product_update',
          message: `Manufacturer has updated pricing for "${product.product?.title}"`
        });
      }

      // If sample is ready, notify admin
      if (sampleFiles.length > 0) {
        const { data: orderData } = await supabase
          .from('orders')
          .select('created_by')
          .eq('id', orderId)
          .single();

        if (orderData) {
          await createNotification(supabase, {
            user_id: orderData.created_by,
            order_id: orderId,
            order_product_id: product.id,
            type: 'sample_ready',
            message: `Sample uploaded for "${product.product?.title}"`
          });
        }
      }

      alert('Product information updated successfully');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Failed to update product information');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSampleFiles(Array.from(e.target.files));
    }
  };

  const requiresSample = product.requires_sample || product.product_status === 'sample_required';
  const showProductionTab = !requiresSample || product.product_status === 'sample_approved';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Update Product Information
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {product.product?.title} - {product.product_order_number}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            {requiresSample && (
              <button
                onClick={() => setActiveTab('sample')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'sample'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                Sample Information
              </button>
            )}
            {showProductionTab && (
              <button
                onClick={() => setActiveTab('production')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'production'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                Production Pricing
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'sample' && requiresSample && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-yellow-500" />
                  Sample Details
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Sample Fee ($)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="number"
                        value={sampleFee}
                        onChange={(e) => setSampleFee(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Sample ETA
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="date"
                        value={sampleEta}
                        onChange={(e) => setSampleEta(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Sample Shipping Method
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSampleShippingMethod('air')}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                          sampleShippingMethod === 'air'
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-blue-500'
                        }`}
                      >
                        <Plane className="w-4 h-4" />
                        Air
                      </button>
                      <button
                        type="button"
                        onClick={() => setSampleShippingMethod('land')}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                          sampleShippingMethod === 'land'
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-blue-500'
                        }`}
                      >
                        <Truck className="w-4 h-4" />
                        Land
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Sample Shipping Cost ($)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="number"
                        value={sampleShippingCost}
                        onChange={(e) => setSampleShippingCost(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Upload Sample Photos/Videos
                  </label>
                  <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <input
                      type="file"
                      multiple
                      accept={ACCEPTED_FILE_TYPES}
                      onChange={handleFileChange}
                      className="hidden"
                      id="sample-upload"
                    />
                    <label
                      htmlFor="sample-upload"
                      className="cursor-pointer text-blue-400 hover:text-blue-300"
                    >
                      Click to upload sample media
                    </label>
                    {sampleFiles.length > 0 && (
                      <p className="text-sm text-slate-400 mt-2">
                        {sampleFiles.length} file(s) selected
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'production' && showProductionTab && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-cyan-500" />
                  Production Pricing
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Standard Price (per unit)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="number"
                        value={standardPrice}
                        onChange={(e) => setStandardPrice(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Bulk Price (per unit)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="number"
                        value={bulkPrice}
                        onChange={(e) => setBulkPrice(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Full Order ETA
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="date"
                        value={fullOrderEta}
                        onChange={(e) => setFullOrderEta(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Full Order Shipping Cost ($)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="number"
                        value={fullShippingCost}
                        onChange={(e) => setFullShippingCost(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Full Order Shipping Method
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFullShippingMethod('air')}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                        fullShippingMethod === 'air'
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-blue-500'
                      }`}
                    >
                      <Plane className="w-4 h-4" />
                      Air Freight
                    </button>
                    <button
                      type="button"
                      onClick={() => setFullShippingMethod('land')}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                        fullShippingMethod === 'land'
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-blue-500'
                      }`}
                    >
                      <Truck className="w-4 h-4" />
                      Sea/Land Freight
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes Section (Always visible) */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Manufacturer Notes
            </label>
            <textarea
              value={manufacturerNotes}
              onChange={(e) => setManufacturerNotes(e.target.value)}
              placeholder="Add any notes about this product, production details, or special requirements..."
              rows={4}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700">
          <div className="flex justify-between items-center">
            <div className="text-sm text-slate-400">
              <Clock className="inline w-4 h-4 mr-1" />
              All changes will be saved and admin will be notified
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  loading
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <Save className="w-4 h-4" />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}