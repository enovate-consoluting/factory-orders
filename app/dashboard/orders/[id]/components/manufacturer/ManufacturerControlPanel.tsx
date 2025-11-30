/**
 * ManufacturerControlPanel - Control panel for manufacturer order actions
 * Shows order summary, totals, and action buttons
 * UPDATED: Now uses useBulkRouting hook for consistency
 * Roles: Manufacturer
 * Last Modified: November 29, 2025
 */

import React, { useState, useMemo } from 'react';
import { 
  Package, Download, Printer, Save, Send, DollarSign, 
  FileImage, FileText, X, Loader2, Calendar 
} from 'lucide-react';
import { SetShipDatesModal } from '../modals/SetShipDatesModal';

interface ManufacturerControlPanelProps {
  order: any;
  visibleProducts: any[];
  onSaveAndRoute: () => void;
  onPrintAll: () => void;
  onUpdate?: () => void;
}

export function ManufacturerControlPanel({ 
  order, 
  visibleProducts,
  onSaveAndRoute,
  onPrintAll,
  onUpdate
}: ManufacturerControlPanelProps) {
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showShipDatesModal, setShowShipDatesModal] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // Calculate totals (MANUFACTURER prices - their costs)
  const calculateTotals = () => {
    let productTotal = 0;
    let sampleTotal = 0;
    let shippingTotal = 0;
    
    visibleProducts.forEach((product: any) => {
      const totalQty = product.order_items?.reduce((sum: number, item: any) => 
        sum + (item.quantity || 0), 0) || 0;
      
      // Use manufacturer prices (their costs)
      productTotal += (parseFloat(product.product_price || 0) * totalQty);
      sampleTotal += parseFloat(product.sample_fee || 0);
      
      if (product.selected_shipping_method === 'air') {
        shippingTotal += parseFloat(product.shipping_air_price || 0);
      } else if (product.selected_shipping_method === 'boat') {
        shippingTotal += parseFloat(product.shipping_boat_price || 0);
      }
    });
    
    return {
      product: productTotal,
      sample: sampleTotal,
      shipping: shippingTotal,
      total: productTotal + sampleTotal + shippingTotal
    };
  };

  const totals = calculateTotals();

  // Count products with ship dates set
  const productsWithShipDates = visibleProducts.filter(p => p.estimated_ship_date).length;

  // Collect all sample media
  const allSampleFiles = useMemo(() => {
    const files: any[] = [];
    visibleProducts.forEach(product => {
      const sampleMedia = product.order_media?.filter(
        (m: any) => m.file_type === 'sample_image' || m.file_type === 'sample_document'
      ) || [];
      
      sampleMedia.forEach((file: any) => {
        files.push({
          ...file,
          productCode: product.product_order_number,
          productName: product.description || 'Product'
        });
      });
    });
    return files;
  }, [visibleProducts]);

  // Open download modal
  const openDownloadModal = () => {
    const allFileIds = new Set(allSampleFiles.map(f => f.id));
    setSelectedFiles(allFileIds);
    setShowDownloadModal(true);
  };

  // Toggle file selection
  const toggleFileSelection = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  // Download file
  const downloadFile = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  // Download selected files
  const downloadSelectedFiles = async () => {
    setDownloadingAll(true);
    setShowDownloadModal(false);
    
    const filesToDownload = allSampleFiles.filter(f => selectedFiles.has(f.id));
    
    for (const file of filesToDownload) {
      const fileName = file.display_name || file.original_filename || 'sample-file';
      await downloadFile(file.file_url, fileName);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setDownloadingAll(false);
  };

  // Handle ship dates modal close with refresh
  const handleShipDatesUpdate = () => {
    if (onUpdate) {
      onUpdate();
    }
  };

  return (
    <>
      {/* Main Control Panel */}
      <div className="mb-4 bg-white rounded-lg shadow-lg border border-gray-300 p-4">
        {/* Order Info Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs text-gray-500">Order</span>
              <p className="font-bold text-lg text-gray-900">{order.order_number}</p>
            </div>
            <div className="h-10 w-px bg-gray-300" />
            <div>
              <span className="text-xs text-gray-500">Client</span>
              <p className="font-semibold text-gray-900">{order.client?.name}</p>
            </div>
            <div className="h-10 w-px bg-gray-300" />
            <div>
              <span className="text-xs text-gray-500">Products</span>
              <p className="font-semibold text-gray-900">{visibleProducts.length}</p>
            </div>
          </div>
          
          {/* Totals */}
          <div className="flex items-center gap-4">
            {totals.sample > 0 && (
              <div className="text-right">
                <span className="text-xs text-gray-500">Samples</span>
                <p className="font-semibold text-amber-600">${totals.sample.toFixed(2)}</p>
              </div>
            )}
            {totals.shipping > 0 && (
              <div className="text-right">
                <span className="text-xs text-gray-500">Shipping</span>
                <p className="font-semibold text-blue-600">${totals.shipping.toFixed(2)}</p>
              </div>
            )}
            <div className="text-right">
              <span className="text-xs text-gray-500">Total</span>
              <p className="font-bold text-xl text-green-600">${totals.total.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t">
          {/* Print All */}
          <button
            onClick={onPrintAll}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
          >
            <Printer className="w-4 h-4" />
            Print All
          </button>

          {/* Download Samples - only show if there are sample files */}
          {allSampleFiles.length > 0 && (
            <button
              onClick={openDownloadModal}
              disabled={downloadingAll}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center gap-2 font-medium"
            >
              <Download className="w-4 h-4" />
              {downloadingAll ? 'Downloading...' : `Download Samples (${allSampleFiles.length})`}
            </button>
          )}

          {/* Set Ship Dates */}
          <button
            onClick={() => setShowShipDatesModal(true)}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2 font-medium"
          >
            <Calendar className="w-4 h-4" />
            Set Ship Dates
            {productsWithShipDates > 0 && (
              <span className="bg-orange-800 text-orange-100 text-xs px-1.5 py-0.5 rounded">
                {productsWithShipDates}/{visibleProducts.length}
              </span>
            )}
          </button>

          {/* Save All & Route */}
          <button
            onClick={onSaveAndRoute}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-medium ml-auto"
          >
            <Save className="w-4 h-4" />
            Save All & Route
          </button>
        </div>
      </div>

      {/* Set Ship Dates Modal */}
      <SetShipDatesModal
        isOpen={showShipDatesModal}
        onClose={() => setShowShipDatesModal(false)}
        products={visibleProducts}
        onUpdate={handleShipDatesUpdate}
      />

      {/* Download Selection Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 max-w-lg w-full max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900">
                Select Sample Files
              </h3>
              <button
                onClick={() => setShowDownloadModal(false)}
                className="p-0.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between mb-2 pb-2 border-b">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={selectedFiles.size === allSampleFiles.length}
                  onChange={() => {
                    if (selectedFiles.size === allSampleFiles.length) {
                      setSelectedFiles(new Set());
                    } else {
                      setSelectedFiles(new Set(allSampleFiles.map(f => f.id)));
                    }
                  }}
                  className="w-3.5 h-3.5 text-amber-600 border-gray-300 rounded"
                />
                <span>Select All</span>
              </label>
              <span className="text-xs text-gray-500">
                {selectedFiles.size} of {allSampleFiles.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <tbody>
                  {allSampleFiles.map((file) => (
                    <tr key={file.id} className="hover:bg-gray-50">
                      <td className="py-1 pr-2">
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(file.id)}
                          onChange={() => toggleFileSelection(file.id)}
                          className="w-3.5 h-3.5 text-amber-600 border-gray-300 rounded"
                        />
                      </td>
                      <td className="py-1 px-1">
                        {file.file_type === 'sample_image' ? (
                          <FileImage className="w-3 h-3 text-amber-600" />
                        ) : (
                          <FileText className="w-3 h-3 text-amber-600" />
                        )}
                      </td>
                      <td className="py-1 px-1 text-gray-900 font-medium">
                        {file.display_name || file.original_filename}
                      </td>
                      <td className="py-1 pl-2 text-gray-500">
                        {file.productCode}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
              <button
                onClick={() => setShowDownloadModal(false)}
                className="px-3 py-1.5 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={downloadSelectedFiles}
                disabled={selectedFiles.size === 0}
                className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                Download {selectedFiles.size}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}