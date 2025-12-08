/**
 * CollapsedProductHeader - Shared collapsed view for product cards
 * UPDATED: Added "Waiting for Sample" badge and grayed out state
 * UPDATED: Delete hidden for Manufacturer/Client, blocked if invoiced for Admin
 * UPDATED: Lock button REMOVED from collapsed view (still available in expanded card)
 * UPDATED: Added onToggleLock, isLocked, processingLock props for compatibility
 * Roles: Admin, Super Admin, Manufacturer
 * Last Modified: December 2025
 */

import React, { useState } from "react";
import {
  ChevronRight,
  History,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Send,
  Trash2,
  FileText,
  FlaskConical,
} from "lucide-react";
import { ProductStatusBadge } from "../../../shared-components/StatusBadge";
import { getProductStatusIcon } from "./ProductStatusIcon";
import { formatCurrency } from "../../../utils/orderCalculations";

interface CollapsedProductHeaderProps {
  product: any;
  totalQuantity: number;
  totalPrice?: number;
  isManufacturerView?: boolean;
  onExpand: () => void;
  onViewHistory?: () => void;
  onRoute?: () => void;
  onDelete?: (productId: string) => void;
  onToggleLock?: () => void;
  isLocked?: boolean;
  processingLock?: boolean;
  hasNewHistory?: boolean;
  userRole?: string;
  trackingNumber?: string;
  translate?: (text: string | null | undefined) => string;
  t?: (key: string) => string;
}

export function CollapsedProductHeader({
  product,
  totalQuantity,
  totalPrice,
  isManufacturerView = false,
  onExpand,
  onViewHistory,
  onRoute,
  onDelete,
  onToggleLock,
  isLocked = false,
  processingLock = false,
  hasNewHistory = false,
  userRole,
  trackingNumber,
  translate = (text) => text || "",
  t = (key) => key,
}: CollapsedProductHeaderProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const displayStatus = product.product_status || "pending";
  const productionTime = product.production_time;

  // Check if product is invoiced
  const isInvoiced = product.invoiced === true;
  
  // Check if waiting for sample
  const isWaitingForSample = product.waiting_for_sample === true;

  // Determine shipping status for admins
  const hasShippingPrices =
    !isManufacturerView &&
    (product.client_shipping_air_price > 0 ||
      product.client_shipping_boat_price > 0);
  const hasSelectedShipping =
    product.selected_shipping_method === "air" ||
    product.selected_shipping_method === "boat";
  const needsShippingSelection = hasShippingPrices && !hasSelectedShipping;

  // Delete permission logic
  const canSeeDelete = (userRole === 'admin' || userRole === 'super_admin') && !isManufacturerView;
  const canDelete = userRole === 'super_admin' || (userRole === 'admin' && !isInvoiced);

  const handleDeleteClick = () => {
    if (!canDelete && userRole === 'admin') {
      alert('Cannot delete this product because it has been invoiced. Please void the invoice first or contact a Super Admin.');
      return;
    }
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(product.id);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Gray out entire card if waiting for sample (except for super_admin)
  const isGrayedOut = isWaitingForSample && userRole !== 'super_admin';

  return (
    <>
      <div className={`bg-white rounded-lg shadow-lg border overflow-hidden transition-shadow ${
        isGrayedOut 
          ? 'border-amber-300 opacity-60' 
          : 'border-gray-300 hover:shadow-xl'
      }`}>
        <div className={`p-3 sm:p-4 border-b-2 ${
          isGrayedOut ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'
        }`}>
          {/* Mobile Layout */}
          <div className="sm:hidden">
            <div className="flex items-start gap-2 mb-2">
              {/* Left side: Expand button + Icon */}
              <button
                onClick={onExpand}
                className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                title={t("expandDetails")}
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>

              <div className="flex-shrink-0">
                {getProductStatusIcon(displayStatus)}
              </div>

              {/* Middle: Product info */}
              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold text-base truncate ${isGrayedOut ? 'text-gray-500' : 'text-gray-900'}`}>
                  {translate(product.description || product.product?.title) ||
                    t("product")}
                </h3>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  <ProductStatusBadge
                    status={displayStatus}
                    translate={translate}
                    t={t}
                  />

                  {/* Waiting for Sample Badge - PROMINENT */}
                  {isWaitingForSample && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full flex items-center gap-1 border border-amber-300">
                      <FlaskConical className="w-3 h-3" />
                      Waiting for Sample
                    </span>
                  )}

                  {!isManufacturerView && product.payment_status === "paid" && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {t("paid")}
                    </span>
                  )}

                  {isInvoiced && !isManufacturerView && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      Invoiced
                    </span>
                  )}
                </div>

                {/* Product details */}
                <div className="mt-1 text-xs text-gray-600">
                  <div>{product.product_order_number}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span>
                      {t("qtyLabel") || "Qty"}: {totalQuantity}
                    </span>
                    {totalPrice && totalPrice > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-green-600 font-semibold">
                          ${formatCurrency(totalPrice)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons - Mobile */}
            <div className={`flex gap-2 flex-wrap ${isGrayedOut ? 'pointer-events-none' : ''}`}>
              {onRoute && !isGrayedOut && (
                <button
                  onClick={onRoute}
                  className="flex-1 px-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-1.5"
                >
                  <Send className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs">{t("route")}</span>
                </button>
              )}
              
              {onViewHistory && (
                <button
                  onClick={onViewHistory}
                  className="flex-1 px-2 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium flex items-center justify-center gap-1.5 relative"
                  title={t("viewHistory")}
                >
                  <History className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs">{t("history")}</span>
                  {hasNewHistory && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  )}
                </button>
              )}

              {/* Delete Button - Only for Admin/Super Admin, hidden when grayed */}
              {canSeeDelete && onDelete && !isGrayedOut && (
                <button
                  onClick={handleDeleteClick}
                  disabled={deleting}
                  className={`flex-1 px-2 py-2 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-1.5 ${
                    isInvoiced && userRole === 'admin'
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-red-600 text-white hover:bg-red-700"
                  } disabled:opacity-50`}
                  title={isInvoiced && userRole === 'admin' ? "Cannot delete - product is invoiced" : "Delete product"}
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 flex-shrink-0" />
                      <span className="text-xs">Delete</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={onExpand}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title={t("expandDetails")}
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>

              {getProductStatusIcon(displayStatus)}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`font-semibold text-lg ${isGrayedOut ? 'text-gray-500' : 'text-gray-900'}`}>
                    {translate(product.description || product.product?.title) ||
                      t("product")}
                  </h3>
                  <ProductStatusBadge
                    status={displayStatus}
                    translate={translate}
                    t={t}
                  />

                  {/* Waiting for Sample Badge - PROMINENT */}
                  {isWaitingForSample && (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full flex items-center gap-1 border border-amber-300">
                      <FlaskConical className="w-3 h-3" />
                      Waiting for Sample
                    </span>
                  )}

                  {!isManufacturerView && product.payment_status === "paid" && (
                    <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {t("paid")}
                    </span>
                  )}

                  {needsShippingSelection && !isGrayedOut && (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {t("selectShipping")}
                    </span>
                  )}

                  {isInvoiced && !isManufacturerView && (
                    <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      Invoiced
                    </span>
                  )}

                  {product.product_status === "shipped" && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {t("shipped")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                  <span>{product.product_order_number}</span>
                  <span>•</span>
                  <span>
                    {t("qtyLabel") || "Qty"}: {totalQuantity}
                  </span>

                  {isManufacturerView && productionTime && (
                    <>
                      <span>•</span>
                      <span>
                        {t("productionLabel")}: {productionTime}
                      </span>
                    </>
                  )}

                  {totalPrice && totalPrice > 0 && (
                    <>
                      <span>•</span>
                      <span className="font-semibold">
                        {isManufacturerView ? (
                          <span className="text-green-600">
                            {t("total")}: ${formatCurrency(totalPrice)}
                          </span>
                        ) : (
                          <>
                            <span className="text-green-600">
                              {t("total")}: ${formatCurrency(totalPrice)}
                            </span>
                            {!hasSelectedShipping && (
                              <span className="text-red-600 ml-1">
                                {t("withoutShipping")}
                              </span>
                            )}
                            {hasSelectedShipping && (
                              <span className="text-green-600 ml-1">
                                {t("withShipping")}
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    </>
                  )}

                  {trackingNumber && (
                    <>
                      <span>•</span>
                      <span className="text-purple-600 font-medium">
                        {t("trackingLabel")}: {trackingNumber}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className={`flex items-center gap-2 ${isGrayedOut && userRole !== 'super_admin' ? 'pointer-events-none' : ''}`}>
              {onViewHistory && (
                <button
                  onClick={onViewHistory}
                  className="px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium flex items-center gap-2 relative"
                >
                  <History className="w-4 h-4" />
                  {hasNewHistory && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  )}
                </button>
              )}

              {onRoute && !isGrayedOut && (
                <button
                  onClick={onRoute}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {t("route")}
                </button>
              )}

              {/* Delete Button - Only for Admin/Super Admin */}
              {canSeeDelete && onDelete && !isGrayedOut && (
                <button
                  onClick={handleDeleteClick}
                  disabled={deleting}
                  className={`p-2 rounded-lg transition-colors ${
                    isInvoiced && userRole === 'admin'
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-red-50 text-red-600 hover:bg-red-100"
                  } disabled:opacity-50`}
                  title={isInvoiced && userRole === 'admin' ? "Cannot delete - product is invoiced" : "Delete product"}
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Product?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Are you sure you want to delete "{product.description || product.product?.title || 'this product'}"?
                </p>
              </div>
            </div>

            {/* Warnings */}
            <div className="space-y-2 mb-6">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>This will permanently delete:</strong>
                </p>
                <ul className="text-sm text-amber-700 mt-1 list-disc list-inside">
                  <li>All {totalQuantity} variant items</li>
                  <li>All uploaded media files</li>
                  <li>All notes and history</li>
                </ul>
              </div>

              {isInvoiced && userRole === 'super_admin' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Warning: This product has been invoiced!
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    You may need to void or update the related invoice after deletion.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Product
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}