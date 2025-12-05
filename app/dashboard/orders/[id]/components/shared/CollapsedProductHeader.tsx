import React from "react";
import {
  ChevronRight,
  History,
  Lock,
  Unlock,
  Loader2,
  CheckCircle,
  DollarSign,
  AlertTriangle,
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
  onToggleLock,
  isLocked = false,
  processingLock = false,
  hasNewHistory = false,
  userRole,
  trackingNumber,
  translate = (text) => text || "",
  t = (key) => key,
}: CollapsedProductHeaderProps) {
  const displayStatus = product.product_status || "pending";
  const productionTime = product.production_time;

  // Determine shipping status for admins
  const hasShippingPrices =
    !isManufacturerView &&
    (product.client_shipping_air_price > 0 ||
      product.client_shipping_boat_price > 0);
  const hasSelectedShipping =
    product.selected_shipping_method === "air" ||
    product.selected_shipping_method === "boat";
  const needsShippingSelection = hasShippingPrices && !hasSelectedShipping;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden hover:shadow-xl transition-shadow">
      <div className="p-3 sm:p-4 bg-gray-50 border-b-2 border-gray-200">
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
              <h3 className="font-semibold text-base text-gray-900 truncate">
                {translate(product.description || product.product?.title) ||
                  t("product")}
              </h3>
              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                <ProductStatusBadge
                  status={displayStatus}
                  translate={translate}
                  t={t}
                />

                {!isManufacturerView && product.payment_status === "paid" && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {t("paid")}
                  </span>
                )}

                {isManufacturerView && isLocked && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    {t("locked")}
                  </span>
                )}
              </div>

              {/* Product details */}
              <div className="mt-1 text-xs text-gray-600">
                <div>{product.product_order_number}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span>
                    {t("qtyLabel")}: {totalQuantity}
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

          {/* Action buttons - all in one row on mobile */}
          <div className="flex gap-2">
            {onRoute && (
              <button
                onClick={onRoute}
                className="flex-1 px-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-1.5"
              >
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

            {onToggleLock && (
              <button
                onClick={onToggleLock}
                disabled={processingLock}
                className={`flex-1 px-2 py-2 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-1.5 ${
                  isLocked
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-green-600 text-white hover:bg-green-700"
                } disabled:opacity-50`}
                title={isLocked ? t("unlock") : t("lock")}
              >
                {processingLock ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isLocked ? (
                  <>
                    <Lock className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs">{t("locked")}</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs">{t("lock")}</span>
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
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg text-gray-900">
                  {translate(product.description || product.product?.title) ||
                    t("product")}
                </h3>
                <ProductStatusBadge
                  status={displayStatus}
                  translate={translate}
                  t={t}
                />

                {!isManufacturerView && product.payment_status === "paid" && (
                  <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {t("paid")}
                  </span>
                )}

                {needsShippingSelection && (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {t("selectShipping")}
                  </span>
                )}

                {isManufacturerView && isLocked && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    {t("locked")}
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
                  {t("qtyLabel")}: {totalQuantity}
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

          <div className="flex items-center gap-2">
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

            {onRoute && (
              <button
                onClick={onRoute}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                {t("route")}
              </button>
            )}

            {onToggleLock && (
              <button
                onClick={onToggleLock}
                disabled={processingLock}
                className={`p-2 rounded-lg transition-colors ${
                  isLocked
                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                    : "bg-green-50 text-green-600 hover:bg-green-100"
                } disabled:opacity-50`}
                title={isLocked ? t("unlock") : t("lock")}
              >
                {processingLock ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isLocked ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
