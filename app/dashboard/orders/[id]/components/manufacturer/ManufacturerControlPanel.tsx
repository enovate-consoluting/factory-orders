/**
 * ManufacturerControlPanel V2 - Clean, Compact Design
 * Control panel for manufacturer order actions
 * V2: Cleaner layout, no crazy gradients, compact buttons
 * Location: /app/dashboard/orders/[id]/v2/components/ManufacturerControlPanelV2.tsx
 * Last Modified: December 2025
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Package, Download, Printer, Save, Send, DollarSign,
  FileImage, FileText, X, Loader2, Calendar, FolderDown,
  File, Image, FileVideo, FileArchive, Clock, Truck, CheckCircle, Tag
} from 'lucide-react';
import { SetShipDatesModal } from '../modals/SetShipDatesModal';
import { SetProductionDaysModal } from '../modals/SetProductionDaysModal';
import { formatCurrency } from '../../../utils/orderCalculations';
import { AccessoriesModal } from '../modals/AccessoriesModal';
import { supabase } from '@/lib/supabase';

interface ManufacturerControlPanelV2Props {
  order: any;
  visibleProducts: any[];
  onSaveAndRoute: () => void;
  onPrintAll: () => void;
  onUpdate?: () => void;
  manufacturerId?: string;
}

// Helper to get file icon
const getFileIcon = (fileName: string, fileType?: string) => {
  const ext = fileName?.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) || fileType?.includes('image')) {
    return <Image className="w-4 h-4 text-blue-500" />;
  }
  if (['pdf'].includes(ext)) return <FileText className="w-4 h-4 text-red-500" />;
  if (['mp4', 'mov', 'avi', 'webm'].includes(ext) || fileType?.includes('video')) {
    return <FileVideo className="w-4 h-4 text-purple-500" />;
  }
  if (['zip', 'rar', '7z'].includes(ext)) return <FileArchive className="w-4 h-4 text-amber-500" />;
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) return <FileText className="w-4 h-4 text-blue-600" />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileText className="w-4 h-4 text-green-600" />;
  return <File className="w-4 h-4 text-gray-500" />;
};

export function ManufacturerControlPanelV2({
  order,
  visibleProducts,
  onSaveAndRoute,
  onPrintAll,
  onUpdate,
  manufacturerId,
}: ManufacturerControlPanelV2Props) {
  const [showAllMediaModal, setShowAllMediaModal] = useState(false);
  const [showShipDatesModal, setShowShipDatesModal] = useState(false);
  const [showProductionDaysModal, setShowProductionDaysModal] = useState(false);
  const [downloadingMedia, setDownloadingMedia] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [selectedMediaFiles, setSelectedMediaFiles] = useState<Set<string>>(new Set());
  const [showAccessoriesModal, setShowAccessoriesModal] = useState(false);
  const [accessoriesTotal, setAccessoriesTotal] = useState(0);

  // Calculate totals (manufacturer prices - their costs)
  // Includes: products, order-level sample fee, shipping, and accessories
  const totals = useMemo(() => {
    let productTotal = 0;
    let shippingTotal = 0;

    visibleProducts.forEach((product: any) => {
      const totalQty = product.order_items?.reduce(
        (sum: number, item: any) => sum + (item.quantity || 0), 0
      ) || 0;

      productTotal += parseFloat(product.product_price || 0) * totalQty;

      if (product.selected_shipping_method === 'air') {
        shippingTotal += parseFloat(product.shipping_air_price || 0);
      } else if (product.selected_shipping_method === 'boat') {
        shippingTotal += parseFloat(product.shipping_boat_price || 0);
      }
    });

    // Get sample fee from ORDER level (not product level)
    const sampleTotal = parseFloat(order?.sample_fee || 0);

    return {
      product: productTotal,
      sample: sampleTotal,
      shipping: shippingTotal,
      total: productTotal + sampleTotal + shippingTotal,
    };
  }, [visibleProducts, order]);

  // Fetch accessories total for this order
  useEffect(() => {
    const fetchAccessoriesTotal = async () => {
      if (!order?.id) return;
      try {
        const { data, error } = await supabase
          .from('order_accessories')
          .select('total_fee')
          .eq('order_id', order.id);
        
        if (!error && data) {
          const total = data.reduce((sum: number, acc: any) => sum + parseFloat(acc.total_fee || 0), 0);
          setAccessoriesTotal(total);
        }
      } catch (err) {
        console.error('Error fetching accessories total:', err);
      }
    };
    fetchAccessoriesTotal();
  }, [order?.id]);

  // Count products with ship dates/production days set
  const productsWithShipDates = visibleProducts.filter((p) => p.estimated_ship_date).length;
  const productsWithProductionDays = visibleProducts.filter((p) => p.production_days).length;

  // Collect ALL media files
  const allMediaFiles = useMemo(() => {
    const files: any[] = [];
    const seenIds = new Set<string>();

    visibleProducts.forEach((product) => {
      const productMedia = product.order_media || [];
      productMedia.forEach((file: any) => {
        if (!seenIds.has(file.id)) {
          seenIds.add(file.id);
          files.push({
            ...file,
            source: 'product',
            productCode: product.product_order_number || 'N/A',
            productName: product.description || product.product?.title || 'Product',
          });
        }
      });
    });

    if (order?.order_media) {
      order.order_media.forEach((file: any) => {
        if (!seenIds.has(file.id)) {
          seenIds.add(file.id);
          files.push({
            ...file,
            source: 'order',
            productCode: 'ORDER',
            productName: 'Order Sample/Tech Pack',
          });
        }
      });
    }

    return files;
  }, [visibleProducts, order]);

  // Open all media modal
  const openAllMediaModal = () => {
    setSelectedMediaFiles(new Set(allMediaFiles.map((f) => f.id)));
    setShowAllMediaModal(true);
  };

  // Toggle file selection
  const toggleMediaFileSelection = (fileId: string) => {
    const newSelected = new Set(selectedMediaFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedMediaFiles(newSelected);
  };

  // Download file helper
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

  // Download selected media files
  const downloadSelectedMediaFiles = async () => {
    const filesToDownload = allMediaFiles.filter((f) => selectedMediaFiles.has(f.id));

    setDownloadingMedia(true);
    setDownloadProgress({ current: 0, total: filesToDownload.length });
    setShowAllMediaModal(false);

    for (let i = 0; i < filesToDownload.length; i++) {
      const file = filesToDownload[i];
      const fileName = file.display_name || file.original_filename || `file-${i + 1}`;
      setDownloadProgress({ current: i + 1, total: filesToDownload.length });
      await downloadFile(file.file_url, fileName);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    setDownloadingMedia(false);
    setDownloadProgress({ current: 0, total: 0 });
  };

  const handleModalUpdate = () => {
    if (onUpdate) onUpdate();
  };

  return (
    <>
      {/* Control Panel - Clean Design */}
      <div className="mb-4 bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {/* Header Row - Order info + Total */}
        <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Order Info */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Order</p>
                <p className="font-bold text-lg text-gray-900">{order.order_number}</p>
              </div>
              {order.client?.name && (
                <>
                  <div className="hidden sm:block h-8 w-px bg-gray-300" />
                  <div className="hidden sm:block">
                    <p className="text-xs text-gray-500">Client</p>
                    <p className="font-medium text-gray-900">{order.client.name}</p>
                  </div>
                </>
              )}
            </div>

            {/* Total + Products Count */}
            <div className="flex items-center gap-4">
              <div className="text-center px-3 py-1.5 bg-gray-100 rounded-lg">
                <p className="text-xl font-bold text-gray-900">{visibleProducts.length}</p>
                <p className="text-xs text-gray-500">Products</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Mfg Total</p>
                <p className="text-2xl font-bold text-green-600">${formatCurrency(totals.total + accessoriesTotal)}</p>
              </div>
            </div>
          </div>

          {/* Mobile client name */}
          {order.client?.name && (
            <div className="sm:hidden mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
              Client: <span className="text-gray-900 font-medium">{order.client.name}</span>
            </div>
          )}
        </div>

        {/* Totals Breakdown - Compact inline */}
        <div className="px-3 sm:px-4 py-2 border-b border-gray-100 bg-white">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-gray-500">Products: <span className="font-semibold text-gray-900">${formatCurrency(totals.product)}</span></span>
            {totals.sample > 0 && (
              <span className="text-gray-500">Sample: <span className="font-semibold text-amber-600">${formatCurrency(totals.sample)}</span></span>
            )}
            {accessoriesTotal > 0 && (
              <span className="text-gray-500">Accessories: <span className="font-semibold text-purple-600">${formatCurrency(accessoriesTotal)}</span></span>
            )}
            {totals.shipping > 0 && (
              <span className="text-gray-500">Shipping: <span className="font-semibold text-blue-600">${formatCurrency(totals.shipping)}</span></span>
            )}
          </div>
        </div>

        {/* Action Buttons - Split Layout: LEFT group | DIVIDER | RIGHT group */}
        <div className="p-2 sm:p-3 flex items-center justify-between">
          {/* LEFT GROUP: Accessories, Ship, ETA Days */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Accessories */}
            <button
              onClick={() => setShowAccessoriesModal(true)}
              className="px-2.5 py-1.5 bg-purple-50 text-purple-700 rounded-md hover:bg-purple-100 transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-medium border border-purple-200"
            >
              <Tag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Accessories</span>
            </button>

            {/* Ship Dates */}
            <button
              onClick={() => setShowShipDatesModal(true)}
              className="px-2.5 py-1.5 bg-orange-50 text-orange-700 rounded-md hover:bg-orange-100 transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-medium border border-orange-200"
            >
              <Truck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ship</span>
              {productsWithShipDates > 0 && (
                <span className="text-xs bg-orange-200 text-orange-800 px-1 rounded">
                  {productsWithShipDates}/{visibleProducts.length}
                </span>
              )}
            </button>

            {/* Production Days / ETA */}
            <button
              onClick={() => setShowProductionDaysModal(true)}
              className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-medium border border-indigo-200"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ETA Days</span>
              {productsWithProductionDays > 0 && (
                <span className="text-xs bg-indigo-200 text-indigo-800 px-1 rounded">
                  {productsWithProductionDays}/{visibleProducts.length}
                </span>
              )}
            </button>
          </div>

          {/* VERTICAL DIVIDER */}
          <div className="hidden sm:block h-8 w-px bg-gray-300 mx-2"></div>

          {/* RIGHT GROUP: Print, Media, Save & Route */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Print */}
            <button
              onClick={onPrintAll}
              className="px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-medium border border-gray-200"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* Media Download */}
            {allMediaFiles.length > 0 && (
              <button
                onClick={openAllMediaModal}
                disabled={downloadingMedia}
                className="px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 disabled:opacity-50 transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-medium border border-blue-200"
              >
                {downloadingMedia ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-xs">{downloadProgress.current}/{downloadProgress.total}</span>
                  </>
                ) : (
                  <>
                    <FolderDown className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Media</span>
                    <span className="text-xs">({allMediaFiles.length})</span>
                  </>
                )}
              </button>
            )}

            {/* Save & Route - Primary */}
            <button
              onClick={onSaveAndRoute}
              className="px-2.5 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-medium"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save & Route</span>
              <span className="sm:hidden">Route</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <SetShipDatesModal
        isOpen={showShipDatesModal}
        onClose={() => setShowShipDatesModal(false)}
        products={visibleProducts}
        onUpdate={handleModalUpdate}
      />

      <SetProductionDaysModal
        isOpen={showProductionDaysModal}
        onClose={() => setShowProductionDaysModal(false)}
        products={visibleProducts}
        onUpdate={handleModalUpdate}
      />

      {/* Accessories Modal */}
      {manufacturerId && order?.client_id && (
        <AccessoriesModal
          isOpen={showAccessoriesModal}
          onClose={() => setShowAccessoriesModal(false)}
          orderId={order.id}
          clientId={order.client_id}
          clientName={order.client?.name || 'Client'}
          manufacturerId={manufacturerId}
          products={visibleProducts}
          onSuccess={() => {
            setShowAccessoriesModal(false);
            if (onUpdate) onUpdate();
          }}
        />
      )}

      {/* Download All Media Modal */}
      {showAllMediaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FolderDown className="w-5 h-5 text-blue-600" />
                Download All Media
              </h3>
              <button
                onClick={() => setShowAllMediaModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-3">
              Select files to download from this order.
            </p>

            <div className="flex items-center justify-between mb-2 pb-2 border-b">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={selectedMediaFiles.size === allMediaFiles.length}
                  onChange={() => {
                    if (selectedMediaFiles.size === allMediaFiles.length) {
                      setSelectedMediaFiles(new Set());
                    } else {
                      setSelectedMediaFiles(new Set(allMediaFiles.map((f) => f.id)));
                    }
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="font-medium">Select All</span>
              </label>
              <span className="text-sm text-gray-500">
                {selectedMediaFiles.size} of {allMediaFiles.length} selected
              </span>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="w-10 p-2"></th>
                    <th className="w-10 p-2"></th>
                    <th className="text-left p-2 font-medium text-gray-700">File Name</th>
                    <th className="text-left p-2 font-medium text-gray-700">Source</th>
                    <th className="text-left p-2 font-medium text-gray-700">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allMediaFiles.map((file) => (
                    <tr
                      key={file.id}
                      className={`hover:bg-gray-50 cursor-pointer ${
                        selectedMediaFiles.has(file.id) ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => toggleMediaFileSelection(file.id)}
                    >
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedMediaFiles.has(file.id)}
                          onChange={() => toggleMediaFileSelection(file.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                        />
                      </td>
                      <td className="p-2 text-center">
                        {getFileIcon(file.original_filename || file.display_name || '', file.file_type)}
                      </td>
                      <td className="p-2 text-gray-900 font-medium truncate max-w-[200px]" title={file.display_name || file.original_filename}>
                        {file.display_name || file.original_filename || 'Unnamed file'}
                      </td>
                      <td className="p-2">
                        {file.source === 'order' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Order Level
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">{file.productCode}</span>
                        )}
                      </td>
                      <td className="p-2 text-gray-500 text-xs capitalize">
                        {file.file_type?.replace(/_/g, ' ') || 'file'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {allMediaFiles.length === 0 && (
                <div className="p-8 text-center text-gray-500">No media files found.</div>
              )}
            </div>

            <div className="flex justify-between items-center mt-4 pt-3 border-t">
              <span className="text-sm text-gray-500">
                {selectedMediaFiles.size} file(s) will be downloaded
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAllMediaModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={downloadSelectedMediaFiles}
                  disabled={selectedMediaFiles.size === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
