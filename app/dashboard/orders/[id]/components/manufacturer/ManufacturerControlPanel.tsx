/**
 * ManufacturerControlPanel - Control panel for manufacturer order actions
 * Shows order summary, totals, and action buttons
 * REDESIGNED: Cleaner layout with better organization
 * Roles: Manufacturer
 * Last Modified: December 5, 2025
 */

import React, { useState, useMemo } from "react";
import {
  Package,
  Download,
  Printer,
  Save,
  Send,
  DollarSign,
  FileImage,
  FileText,
  X,
  Loader2,
  Calendar,
  FolderDown,
  File,
  Image,
  FileVideo,
  FileArchive,
  Clock,
  Building2,
  ShoppingBag,
  Truck,
  CheckCircle,
} from "lucide-react";
import { SetShipDatesModal } from "../modals/SetShipDatesModal";
import { SetProductionDaysModal } from "../modals/SetProductionDaysModal";

interface ManufacturerControlPanelProps {
  order: any;
  visibleProducts: any[];
  onSaveAndRoute: () => void;
  onPrintAll: () => void;
  onUpdate?: () => void;
}

// Helper to get file icon based on type/extension
const getFileIcon = (fileName: string, fileType?: string) => {
  const ext = fileName?.split(".").pop()?.toLowerCase() || "";

  if (
    ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext) ||
    fileType?.includes("image")
  ) {
    return <Image className="w-4 h-4 text-blue-500" />;
  }
  if (["pdf"].includes(ext)) {
    return <FileText className="w-4 h-4 text-red-500" />;
  }
  if (
    ["mp4", "mov", "avi", "webm"].includes(ext) ||
    fileType?.includes("video")
  ) {
    return <FileVideo className="w-4 h-4 text-purple-500" />;
  }
  if (["zip", "rar", "7z"].includes(ext)) {
    return <FileArchive className="w-4 h-4 text-amber-500" />;
  }
  if (["doc", "docx", "txt", "rtf"].includes(ext)) {
    return <FileText className="w-4 h-4 text-blue-600" />;
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return <FileText className="w-4 h-4 text-green-600" />;
  }
  return <File className="w-4 h-4 text-gray-500" />;
};

export function ManufacturerControlPanel({
  order,
  visibleProducts,
  onSaveAndRoute,
  onPrintAll,
  onUpdate,
}: ManufacturerControlPanelProps) {
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showAllMediaModal, setShowAllMediaModal] = useState(false);
  const [showShipDatesModal, setShowShipDatesModal] = useState(false);
  const [showProductionDaysModal, setShowProductionDaysModal] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadingMedia, setDownloadingMedia] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({
    current: 0,
    total: 0,
  });
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedMediaFiles, setSelectedMediaFiles] = useState<Set<string>>(
    new Set()
  );

  // Calculate totals (MANUFACTURER prices - their costs)
  const calculateTotals = () => {
    let productTotal = 0;
    let sampleTotal = 0;
    let shippingTotal = 0;

    visibleProducts.forEach((product: any) => {
      const totalQty =
        product.order_items?.reduce(
          (sum: number, item: any) => sum + (item.quantity || 0),
          0
        ) || 0;

      // Use manufacturer prices (their costs)
      productTotal += parseFloat(product.product_price || 0) * totalQty;
      sampleTotal += parseFloat(product.sample_fee || 0);

      if (product.selected_shipping_method === "air") {
        shippingTotal += parseFloat(product.shipping_air_price || 0);
      } else if (product.selected_shipping_method === "boat") {
        shippingTotal += parseFloat(product.shipping_boat_price || 0);
      }
    });

    return {
      product: productTotal,
      sample: sampleTotal,
      shipping: shippingTotal,
      total: productTotal + sampleTotal + shippingTotal,
    };
  };

  const totals = calculateTotals();

  // Count products with ship dates set
  const productsWithShipDates = visibleProducts.filter(
    (p) => p.estimated_ship_date
  ).length;

  // Count products with production days set
  const productsWithProductionDays = visibleProducts.filter(
    (p) => p.production_days
  ).length;

  // Collect all sample media (existing functionality)
  const allSampleFiles = useMemo(() => {
    const files: any[] = [];
    visibleProducts.forEach((product) => {
      const sampleMedia =
        product.order_media?.filter(
          (m: any) =>
            m.file_type === "sample_image" || m.file_type === "sample_document"
        ) || [];

      sampleMedia.forEach((file: any) => {
        files.push({
          ...file,
          productCode: product.product_order_number,
          productName: product.description || "Product",
        });
      });
    });
    return files;
  }, [visibleProducts]);

  // Collect ALL media files (products + order-level samples)
  const allMediaFiles = useMemo(() => {
    const files: any[] = [];
    const seenIds = new Set<string>();

    // 1. Get ALL media from visible products (routed to manufacturer)
    visibleProducts.forEach((product) => {
      const productMedia = product.order_media || [];

      productMedia.forEach((file: any) => {
        if (!seenIds.has(file.id)) {
          seenIds.add(file.id);
          files.push({
            ...file,
            source: "product",
            productCode: product.product_order_number || "N/A",
            productName:
              product.description || product.product?.title || "Product",
          });
        }
      });
    });

    // 2. Get order-level sample/tech pack files
    if (order?.order_media) {
      order.order_media.forEach((file: any) => {
        if (!seenIds.has(file.id)) {
          seenIds.add(file.id);
          files.push({
            ...file,
            source: "order",
            productCode: "ORDER",
            productName: "Order Sample/Tech Pack",
          });
        }
      });
    }

    return files;
  }, [visibleProducts, order]);

  // Open download modal (samples only - existing)
  const openDownloadModal = () => {
    const allFileIds = new Set(allSampleFiles.map((f) => f.id));
    setSelectedFiles(allFileIds);
    setShowDownloadModal(true);
  };

  // Open all media download modal
  const openAllMediaModal = () => {
    const allFileIds = new Set(allMediaFiles.map((f) => f.id));
    setSelectedMediaFiles(allFileIds);
    setShowAllMediaModal(true);
  };

  // Toggle file selection (samples)
  const toggleFileSelection = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  // Toggle file selection (all media)
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
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading file:", error);
    }
  };

  // Download selected sample files (existing)
  const downloadSelectedFiles = async () => {
    setDownloadingAll(true);
    setShowDownloadModal(false);

    const filesToDownload = allSampleFiles.filter((f) =>
      selectedFiles.has(f.id)
    );

    for (const file of filesToDownload) {
      const fileName =
        file.display_name || file.original_filename || "sample-file";
      await downloadFile(file.file_url, fileName);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setDownloadingAll(false);
  };

  // Download selected media files (all media)
  const downloadSelectedMediaFiles = async () => {
    const filesToDownload = allMediaFiles.filter((f) =>
      selectedMediaFiles.has(f.id)
    );

    setDownloadingMedia(true);
    setDownloadProgress({ current: 0, total: filesToDownload.length });
    setShowAllMediaModal(false);

    for (let i = 0; i < filesToDownload.length; i++) {
      const file = filesToDownload[i];
      const fileName =
        file.display_name || file.original_filename || `file-${i + 1}`;
      setDownloadProgress({ current: i + 1, total: filesToDownload.length });
      await downloadFile(file.file_url, fileName);
      // Small delay between downloads to prevent browser issues
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    setDownloadingMedia(false);
    setDownloadProgress({ current: 0, total: 0 });
  };

  // Handle modal close with refresh
  const handleModalUpdate = () => {
    if (onUpdate) {
      onUpdate();
    }
  };

  return (
    <>
      {/* Main Control Panel - Redesigned */}
      <div className="mb-4 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header Section - Order Info */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Order & Client Info */}
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <p className="text-white/70 text-xs uppercase tracking-wide">Order</p>
                <p className="font-bold text-xl">{order.order_number}</p>
              </div>
              <div className="hidden sm:block h-10 w-px bg-white/20" />
              <div className="hidden sm:block">
                <p className="text-white/70 text-xs uppercase tracking-wide">Client</p>
                <p className="font-semibold">{order.client?.name || "—"}</p>
              </div>
            </div>
            
            {/* Products Count Badge */}
            <div className="flex items-center gap-2">
              <div className="px-4 py-2 bg-white/10 rounded-lg text-center">
                <p className="text-2xl font-bold">{visibleProducts.length}</p>
                <p className="text-xs text-white/70">Products</p>
              </div>
            </div>
          </div>
          
          {/* Mobile: Show client name */}
          <div className="sm:hidden mt-2 pt-2 border-t border-white/10">
            <p className="text-white/70 text-xs">Client: <span className="text-white font-medium">{order.client?.name || "—"}</span></p>
          </div>
        </div>

        {/* Totals Section */}
        <div className="bg-gray-50 border-b border-gray-200 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Products Total */}
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 uppercase">Products</span>
              </div>
              <p className="text-lg font-bold text-gray-900">${totals.product.toFixed(2)}</p>
            </div>

            {/* Samples Total */}
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <FileImage className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-gray-500 uppercase">Samples</span>
              </div>
              <p className="text-lg font-bold text-amber-600">${totals.sample.toFixed(2)}</p>
            </div>

            {/* Shipping Total */}
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <Truck className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-gray-500 uppercase">Shipping</span>
              </div>
              <p className="text-lg font-bold text-blue-600">${totals.shipping.toFixed(2)}</p>
            </div>

            {/* Grand Total */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg p-3 text-white">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-white/80" />
                <span className="text-xs text-white/80 uppercase">Total</span>
              </div>
              <p className="text-xl font-bold">${totals.total.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons Section */}
        <div className="p-4">
          {/* Primary Action - Save & Route */}
          <button
            onClick={onSaveAndRoute}
            className="w-full mb-3 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 font-semibold text-base shadow-md hover:shadow-lg"
          >
            <Save className="w-5 h-5" />
            Save All & Route to Admin
          </button>

          {/* Secondary Actions Grid */}
          <div className="grid grid-cols-2 gap-2">
            {/* Print All */}
            <button
              onClick={onPrintAll}
              className="px-3 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 font-medium text-sm border border-gray-200"
            >
              <Printer className="w-4 h-4" />
              <span>Print All</span>
            </button>

            {/* All Media Download */}
            {allMediaFiles.length > 0 && (
              <button
                onClick={openAllMediaModal}
                disabled={downloadingMedia}
                className="px-3 py-2.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 font-medium text-sm border border-blue-200"
              >
                {downloadingMedia ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{downloadProgress.current}/{downloadProgress.total}</span>
                  </>
                ) : (
                  <>
                    <FolderDown className="w-4 h-4" />
                    <span>Media ({allMediaFiles.length})</span>
                  </>
                )}
              </button>
            )}

            {/* Ship Dates */}
            <button
              onClick={() => setShowShipDatesModal(true)}
              className="px-3 py-2.5 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors flex items-center justify-center gap-2 font-medium text-sm border border-orange-200"
            >
              <Calendar className="w-4 h-4" />
              <span>Ship Dates</span>
              {productsWithShipDates > 0 && (
                <span className="bg-orange-200 text-orange-800 text-xs px-1.5 py-0.5 rounded-full">
                  {productsWithShipDates}/{visibleProducts.length}
                </span>
              )}
            </button>

            {/* Production Days */}
            <button
              onClick={() => setShowProductionDaysModal(true)}
              className="px-3 py-2.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 font-medium text-sm border border-indigo-200"
            >
              <Clock className="w-4 h-4" />
              <span>Prod. Days</span>
              {productsWithProductionDays > 0 && (
                <span className="bg-indigo-200 text-indigo-800 text-xs px-1.5 py-0.5 rounded-full">
                  {productsWithProductionDays}/{visibleProducts.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Set Ship Dates Modal */}
      <SetShipDatesModal
        isOpen={showShipDatesModal}
        onClose={() => setShowShipDatesModal(false)}
        products={visibleProducts}
        onUpdate={handleModalUpdate}
      />

      {/* Set Production Days Modal */}
      <SetProductionDaysModal
        isOpen={showProductionDaysModal}
        onClose={() => setShowProductionDaysModal(false)}
        products={visibleProducts}
        onUpdate={handleModalUpdate}
      />

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
              Select files to download from this order. Includes product media
              and order-level tech packs.
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
                      setSelectedMediaFiles(
                        new Set(allMediaFiles.map((f) => f.id))
                      );
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
                    <th className="text-left p-2 font-medium text-gray-700">
                      File Name
                    </th>
                    <th className="text-left p-2 font-medium text-gray-700">
                      Source
                    </th>
                    <th className="text-left p-2 font-medium text-gray-700">
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allMediaFiles.map((file) => (
                    <tr
                      key={file.id}
                      className={`hover:bg-gray-50 cursor-pointer ${
                        selectedMediaFiles.has(file.id) ? "bg-blue-50" : ""
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
                        {getFileIcon(
                          file.original_filename || file.display_name || "",
                          file.file_type
                        )}
                      </td>
                      <td
                        className="p-2 text-gray-900 font-medium truncate max-w-[200px]"
                        title={file.display_name || file.original_filename}
                      >
                        {file.display_name ||
                          file.original_filename ||
                          "Unnamed file"}
                      </td>
                      <td className="p-2">
                        {file.source === "order" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Order Level
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">
                            {file.productCode}
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-gray-500 text-xs capitalize">
                        {file.file_type?.replace(/_/g, " ") || "file"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {allMediaFiles.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No media files found for this order.
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mt-4 pt-3 border-t">
              <span className="text-sm text-gray-500">
                {selectedMediaFiles.size} file(s) will be downloaded
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAllMediaModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={downloadSelectedMediaFiles}
                  disabled={selectedMediaFiles.size === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Download Selection Modal - Samples Only (existing) */}
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
                      setSelectedFiles(
                        new Set(allSampleFiles.map((f) => f.id))
                      );
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
                        {file.file_type === "sample_image" ? (
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