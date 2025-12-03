/**
 * Create Product Card Component
 * Used in create and edit order pages to display product configuration
 * Handles product description, variants, media uploads, and sample requests
 * UPDATED: Added Bulk Order Notes field
 * Roles: Admin, Super Admin
 * Last Modified: December 2025
 */

import React from 'react';
import { Package, Trash2, AlertCircle, Upload, X, Calendar, CreditCard } from 'lucide-react';
import { FileUploadSection } from './FileUploadSection';
import { VariantTable } from './VariantTable';

interface Product {
  id: string;
  title: string;
  description?: string;
  variants?: {
    type: string;
    options: string[];
  }[];
}

interface OrderProduct {
  product: Product;
  productOrderNumber: string;
  productDescription: string;
  standardPrice: string;
  bulkPrice: string;
  bulkNotes?: string; // NEW: Bulk order notes
  sampleRequired: boolean;
  sampleFee: string;
  sampleETA: string;
  sampleStatus: string;
  sampleNotes: string;
  shippingAirPrice: string;
  shippingBoatPrice: string;
  productionTime: string;
  items: {
    variantCombo: string;
    quantity: number;
    notes: string;
  }[];
  mediaFiles: File[];
  sampleMediaFiles: File[];
}

interface CreateProductCardProps {
  orderProduct: OrderProduct;
  productIndex: number;
  totalInstances: number;
  currentInstance: number;
  onUpdate: (index: number, field: string, value: any) => void;
  onDelete: (index: number) => void;
  onVariantUpdate: (productIndex: number, variantIndex: number, field: 'quantity' | 'notes', value: string) => void;
  onFileUpload: (productIndex: number, files: FileList | null, type: 'media' | 'sample') => void;
  onFileRemove: (productIndex: number, fileIndex: number, type: 'media' | 'sample') => void;
  showNotification: (type: 'success' | 'error' | 'info', message: string) => void;
  showSampleRequest?: boolean; // For hiding when we move to order level
}

const inputClassName = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400";

export const CreateProductCard: React.FC<CreateProductCardProps> = ({
  orderProduct,
  productIndex,
  totalInstances,
  currentInstance,
  onUpdate,
  onDelete,
  onVariantUpdate,
  onFileUpload,
  onFileRemove,
  showNotification,
  showSampleRequest = false // DEFAULT TO FALSE since we're moving to order level
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      {/* Product Header with Instance Number */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Package className="w-5 h-5 mr-2 text-blue-600" />
            {orderProduct.product.title}
            {totalInstances > 1 && (
              <span className="ml-2 text-sm text-gray-500">
                (Instance {currentInstance} of {totalInstances})
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Product order number will be assigned after creation
          </p>
        </div>
        {/* Delete Product Button */}
        <button
          onClick={() => onDelete(productIndex)}
          className="p-2 text-red-500 hover:text-white hover:bg-red-500 rounded-lg transition-all group"
          title="Remove this product from order"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Product Description - Single Line */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Product Description
        </label>
        <input
          type="text"
          value={orderProduct.productDescription}
          onChange={(e) => onUpdate(productIndex, 'productDescription', e.target.value)}
          placeholder="Enter brief product description..."
          className={inputClassName}
        />
      </div>

      {/* Sample Request Section - COMMENTED OUT but preserved for reference */}
      {/* We're moving this to order level, keeping code here in case we need it later */}
      {showSampleRequest && (
        <>
        {/* SAMPLE REQUEST - Moved to order level November 2025
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-300 mb-6">
          <h4 className="text-sm font-semibold text-amber-900 flex items-center mb-3">
            <AlertCircle className="w-4 h-4 mr-2" />
            Sample Request
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div className="opacity-60">
              <label className="block text-xs font-medium text-amber-800 mb-1">
                Sample Fee
              </label>
              <div className="relative">
                <CreditCard className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-amber-600" />
                <input
                  type="text"
                  placeholder="Set by manufacturer"
                  disabled
                  className="w-full pl-8 pr-3 py-2 border border-amber-200 rounded-lg bg-amber-50 text-gray-500"
                />
              </div>
            </div>

            <div className="opacity-60">
              <label className="block text-xs font-medium text-amber-800 mb-1">
                Sample ETA
              </label>
              <div className="relative">
                <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-amber-600" />
                <input
                  type="text"
                  placeholder="Set by manufacturer"
                  disabled
                  className="w-full pl-8 pr-3 py-2 border border-amber-200 rounded-lg bg-amber-50 text-gray-500"
                />
              </div>
            </div>

            <div className="opacity-60">
              <label className="block text-xs font-medium text-amber-800 mb-1">
                Status
              </label>
              <input
                type="text"
                value="Pending"
                disabled
                className="w-full px-3 py-2 border border-amber-200 rounded-lg bg-amber-50 text-gray-500"
              />
            </div>
          </div>

          <FileUploadSection
            label="Technical Pack / Sample Media"
            files={orderProduct.sampleMediaFiles}
            onUpload={(files) => onFileUpload(productIndex, files, 'sample')}
            onRemove={(fileIndex) => onFileRemove(productIndex, fileIndex, 'sample')}
            buttonText="Upload Tech Pack"
            buttonClassName="bg-amber-600 hover:bg-amber-700"
            fileClassName="bg-amber-100 text-amber-800"
          />

          <div className="mt-3">
            <label className="block text-xs font-medium text-amber-800 mb-1">
              Sample Notes / Instructions
            </label>
            <textarea
              value={orderProduct.sampleNotes}
              onChange={(e) => onUpdate(productIndex, 'sampleNotes', e.target.value)}
              placeholder="Add notes about the sample request, special instructions, materials, colors, etc..."
              rows={3}
              className="w-full px-3 py-2 border border-amber-300 rounded-lg text-gray-900 text-sm"
            />
          </div>
        </div>
        */}
        </>
      )}

      {/* Bulk Order Section */}
      <div className="border border-gray-300 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
          <Package className="w-4 h-4 mr-2" />
          Bulk Order Details
        </h4>

        {/* Reference Media Upload */}
        <div className="mb-4">
          <FileUploadSection
            label="Reference Media"
            files={orderProduct.mediaFiles}
            onUpload={(files) => onFileUpload(productIndex, files, 'media')}
            onRemove={(fileIndex) => onFileRemove(productIndex, fileIndex, 'media')}
            buttonText="Upload Files"
            buttonClassName="bg-gray-100 text-gray-700 hover:bg-gray-200"
            fileClassName="bg-gray-100 text-gray-700"
          />
        </div>

        {/* Bulk Order Notes - NEW */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bulk Order Notes
          </label>
          <textarea
            value={orderProduct.bulkNotes || ''}
            onChange={(e) => onUpdate(productIndex, 'bulkNotes', e.target.value)}
            placeholder="Add notes about this bulk order - special instructions, materials, colors, packaging requirements, etc..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Variants Table */}
        <VariantTable
          items={orderProduct.items}
          onQuantityChange={(variantIndex, value) => onVariantUpdate(productIndex, variantIndex, 'quantity', value)}
          onNotesChange={(variantIndex, value) => onVariantUpdate(productIndex, variantIndex, 'notes', value)}
        />
      </div>
    </div>
  );
};