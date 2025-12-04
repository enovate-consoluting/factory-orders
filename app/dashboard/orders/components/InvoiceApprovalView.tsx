import React from "react";
import Link from "next/link";
import {
  ChevronRight,
  ChevronDown,
  Package,
  Calendar,
  Clock,
  FileText,
  ExternalLink,
  Plane,
  Ship,
  AlertTriangle,
  Users,
  Building,
} from "lucide-react";

import { formatCurrency } from "../utils/orderCalculations";
import {
  daysSinceInvoiceReady,
  calculateProductFees,
  calculateOrderFees,
  hasShippingSelected,
  getEarliestInvoiceReadyDate,
  productHasFees,
} from "../utils/orderListCalculations";
import { formatOrderNumber } from "@/lib/utils/orderUtils";
import { Order, OrderProduct } from "../types/orderList.types";
import { TFunction } from "i18next";
import { useDynamicTranslation } from "@/hooks/useDynamicTranslation";

interface InvoiceApprovalViewProps {
  filteredOrders: Order[];
  expandedOrders: Set<string>;
  t: TFunction;
  userRole: string | null;
  onToggleExpansion: (orderId: string) => void;
  onNavigateToOrder: (orderId: string) => void;
}

export const InvoiceApprovalView: React.FC<InvoiceApprovalViewProps> = ({
  filteredOrders,
  expandedOrders,
  t,
  userRole,
  onToggleExpansion,
  onNavigateToOrder,
}) => {
  const { translate } = useDynamicTranslation();

  const getProductRoutingBadge = (product: OrderProduct) => {
    if (
      product.routed_to === "client" ||
      product.product_status === "client_review"
    ) {
      return (
        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded flex items-center gap-1">
          <Users className="w-3 h-3" />
          {t("withClient")}
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded flex items-center gap-1">
        <Users className="w-3 h-3" />
        {t("withAdmin")}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-3 sm:p-4 border-b bg-amber-50">
        <h2 className="text-sm sm:text-base font-semibold text-gray-900">
          {t("ordersReadyForInvoicing")}
        </h2>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 px-4">
          <FileText className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-300" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {t("noOrders")}
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">
            {t("noOrdersReadyForInvoicing")}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrders.has(order.id);
            const invoiceableProducts =
              order.order_products?.filter(
                (p) => p.routed_to === "admin" && productHasFees(p)
              ) || [];

            const earliestDate = getEarliestInvoiceReadyDate(order);
            const daysWaiting = earliestDate
              ? daysSinceInvoiceReady(earliestDate.toISOString())
              : 0;
            const totalFees = calculateOrderFees(order);

            return (
              <div
                key={order.id}
                className="bg-white hover:bg-gray-50 transition-colors"
              >
                {/* Mobile & Desktop Order Header */}
                <div
                  className="p-3 sm:p-4 cursor-pointer"
                  onDoubleClick={() => onNavigateToOrder(order.id)}
                >
                  <div className="flex flex-col gap-3">
                    {/* Top Row - Toggle, Title, and Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpansion(order.id);
                          }}
                          className="p-0.5 hover:bg-gray-200 rounded flex-shrink-0 mt-0.5"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                            {order.order_name
                              ? translate(order.order_name)
                              : t("untitledOrder")}
                          </h3>
                          <div className="flex flex-wrap flex-col  gap-x-2 gap-y-1 mt-1">
                            <span className="text-xs text-gray-500">
                              {formatOrderNumber(order.order_number)}
                            </span>
                            <span className="text-xs text-gray-500 truncate max-w-[150px]">
                              {order.client?.name
                                ? translate(order.client.name)
                                : ""}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons - Optimized for mobile */}
                      {/* Action Buttons - Optimized for mobile */}
                      <div
                        className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0
                max-xs:flex-col max-xs:items-end max-xs:gap-1"
                      >
                        <Link
                          href={`/dashboard/invoices/create?order=${order.id}`}
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg 
               hover:bg-blue-700 transition-colors flex items-center gap-1
               w-full max-xs:w-[120px] justify-center"
                          title={t("createInvoice")}
                        >
                          <FileText className="w-4 h-4 flex-shrink-0" />
                          <span>{t("invoice")}</span>
                        </Link>

                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 border border-gray-300 text-gray-700 rounded-lg 
               hover:bg-gray-50 transition-colors flex items-center justify-center
               w-full max-xs:w-[40px]"
                          title={t("viewOrder")}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>

                    {/* Info Row - Optimized for mobile */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] sm:text-xs ml-6">
                      <span className="flex items-center gap-1 text-gray-500 whitespace-nowrap">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        <span>
                          {t("created")}:{" "}
                          {new Date(order.created_at).toLocaleDateString()}
                        </span>
                      </span>
                      {earliestDate && (
                        <span className="flex items-center gap-1 text-amber-600 font-medium whitespace-nowrap">
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          {t("invoiceReady")}: {daysWaiting}{" "}
                          {daysWaiting === 1 ? t("dayAgo") : t("daysAgo")}
                        </span>
                      )}
                      <span className="font-semibold text-gray-900 whitespace-nowrap">
                        {invoiceableProducts.length} {t("products")} • $
                        {formatCurrency(totalFees)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Product List */}
                {isExpanded && (
                  <div className="px-2 sm:px-3 md:px-4 pb-3 sm:pb-4">
                    <div className="bg-gray-50 rounded-lg p-1.5 sm:p-2 space-y-1.5 sm:space-y-2">
                      {invoiceableProducts.map((product) => {
                        const fees = calculateProductFees(product);
                        const daysReady = daysSinceInvoiceReady(
                          product.routed_at
                        );
                        const totalQty =
                          product.order_items?.reduce(
                            (sum, item) => sum + (item.quantity || 0),
                            0
                          ) || 0;
                        const hasShipping = hasShippingSelected(product);

                        return (
                          <div
                            key={product.id}
                            className="bg-white rounded p-2 sm:p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                            onDoubleClick={() => onNavigateToOrder(order.id)}
                          >
                            <div className="flex flex-col gap-2">
                              {/* Left Section - Product Info */}
                              <div className="flex items-start gap-2 w-full">
                                <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                    <p className="font-medium text-gray-900 text-xs sm:text-sm">
                                      {product.product_order_number}
                                    </p>
                                    <span className="text-[11px] sm:text-xs text-gray-600 truncate max-w-[150px] sm:max-w-[200px]">
                                      {product.description
                                        ? translate(product.description)
                                        : product.product?.title
                                          ? translate(product.product.title)
                                          : t("product")}
                                    </span>
                                  </div>

                                  {/* Product Details - Wrap on mobile */}
                                  <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 mt-1 text-[10px] sm:text-xs text-gray-500">
                                    <span className="whitespace-nowrap">
                                      {t("qty")}: {totalQty}
                                    </span>
                                    {(product.client_product_price || 0) >
                                      0 && (
                                      <span className="whitespace-nowrap">
                                        $
                                        {formatCurrency(
                                          product.client_product_price || 0
                                        )}
                                        /{t("unit")}
                                      </span>
                                    )}
                                    {(product.sample_fee || 0) > 0 && (
                                      <span className="whitespace-nowrap">
                                        {t("sample")}: $
                                        {formatCurrency(
                                          product.sample_fee || 0
                                        )}
                                      </span>
                                    )}
                                    {product.selected_shipping_method &&
                                      hasShipping && (
                                        <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 bg-green-50 border border-green-300 rounded-full whitespace-nowrap">
                                          {product.selected_shipping_method ===
                                          "air" ? (
                                            <Plane className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-600" />
                                          ) : (
                                            <Ship className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-600" />
                                          )}
                                          <span className="text-green-700 font-medium">
                                            $
                                            {formatCurrency(
                                              product.selected_shipping_method ===
                                                "air"
                                                ? product.client_shipping_air_price ||
                                                    0
                                                : product.client_shipping_boat_price ||
                                                    0
                                            )}
                                          </span>
                                        </span>
                                      )}
                                    {daysReady > 0 && (
                                      <span className="text-amber-600 font-medium whitespace-nowrap">
                                        {daysReady}{" "}
                                        {daysReady === 1
                                          ? t("dayAgo")
                                          : t("daysAgo")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right Section - Price and Badge */}
                              <div className="flex items-center justify-between gap-2 ml-5 sm:ml-6">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm sm:text-base font-semibold text-gray-900">
                                    ${formatCurrency(fees)}
                                  </p>
                                  {!hasShipping && (
                                    <div className="flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                                      <span className="text-[10px] sm:text-xs text-amber-600 font-medium whitespace-nowrap">
                                        {t("shippingNotSet")}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex-shrink-0">
                                  {getProductRoutingBadge(product)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
