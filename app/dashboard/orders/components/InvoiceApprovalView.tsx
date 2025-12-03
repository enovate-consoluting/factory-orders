

import React from 'react';
import Link from 'next/link';
import { 
  ChevronRight, ChevronDown, Package, Calendar, 
  Clock, FileText, ExternalLink, Plane, Ship, 
  AlertTriangle, Users, Building
} from 'lucide-react';

import { formatCurrency } from '../utils/orderCalculations';
import { 
  daysSinceInvoiceReady,
  calculateProductFees,
  calculateOrderFees,
  hasShippingSelected,
  getEarliestInvoiceReadyDate,
  productHasFees
} from '../utils/orderListCalculations';
import { formatOrderNumber } from '@/lib/utils/orderUtils';
import { Order, OrderProduct } from '../types/orderList.types';
import { TFunction } from 'i18next';
import { useDynamicTranslation } from '@/hooks/useDynamicTranslation';

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
  onNavigateToOrder
}) => {
  const { translate } = useDynamicTranslation();
  
  const getProductRoutingBadge = (product: OrderProduct) => {
    if (product.routed_to === 'client' || product.product_status === 'client_review') {
      return (
        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded flex items-center gap-1">
          <Users className="w-3 h-3" />
          {t('withClient')}
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded flex items-center gap-1">
        <Users className="w-3 h-3" />
        {t('withAdmin')}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-3 border-b bg-amber-50">
        <h2 className="text-base font-semibold text-gray-900">{t('ordersReadyForInvoicing')}</h2>
      </div>
      
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">{t('noOrders')}</h3>
          <p className="mt-1 text-sm text-gray-500">{t('noOrdersReadyForInvoicing')}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrders.has(order.id);
            const invoiceableProducts = order.order_products?.filter(p => 
              p.routed_to === 'admin' && productHasFees(p)
            ) || [];
            
            const earliestDate = getEarliestInvoiceReadyDate(order);
            const daysWaiting = earliestDate ? daysSinceInvoiceReady(earliestDate.toISOString()) : 0;
            const totalFees = calculateOrderFees(order);

            return (
              <div key={order.id} className="bg-white hover:bg-gray-50 transition-colors">
                <div 
                  className="p-3 cursor-pointer"
                  onDoubleClick={() => onNavigateToOrder(order.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleExpansion(order.id);
                        }}
                        className="p-0.5 hover:bg-gray-200 rounded"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h3 className="font-semibold text-gray-900 text-sm">
                                {order.order_name ? translate(order.order_name) : t('untitledOrder')}
                              </h3>
                              <span className="text-xs text-gray-500">
                                {formatOrderNumber(order.order_number)}
                              </span>
                              <span className="text-xs text-gray-500">
                                {order.client?.name ? translate(order.client.name) : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {t('created')}: {new Date(order.created_at).toLocaleDateString()}
                              </span>
                              {earliestDate && (
                                <span className="flex items-center gap-1 text-amber-600 font-medium">
                                  <Clock className="w-3 h-3" />
                                  {t('invoiceReady')}: {daysWaiting} {daysWaiting === 1 ? t('dayAgo') : t('daysAgo')}
                                </span>
                              )}
                              <span className="font-semibold text-gray-900">
                                {invoiceableProducts.length} {t('products')} • {t('total')}: ${formatCurrency(totalFees)}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/invoices/create?order=${order.id}`}
                              target="_blank"
                              onClick={(e) => e.stopPropagation()}
                              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                              title={t('createInvoice')}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              {t('createInvoice')}
                            </Link>
                            <Link
                              href={`/dashboard/orders/${order.id}`}
                              target="_blank"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                              title={t('viewOrder')}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="px-3 pb-3">
                    <div className="bg-gray-50 rounded-lg p-2 space-y-1">
                      {invoiceableProducts.map((product) => {
                        const fees = calculateProductFees(product);
                        const daysReady = daysSinceInvoiceReady(product.routed_at);
                        const totalQty = product.order_items?.reduce((sum, item) => 
                          sum + (item.quantity || 0), 0) || 0;
                        const hasShipping = hasShippingSelected(product);
                        
                        return (
                          <div 
                            key={product.id} 
                            className="bg-white rounded p-2 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                            onDoubleClick={() => onNavigateToOrder(order.id)}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-gray-900 text-sm">
                                    {product.product_order_number}
                                  </p>
                                  <span className="text-xs text-gray-600">
                                    {product.description ? translate(product.description) : (product.product?.title ? translate(product.product.title) : t('product'))}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                                  <span>{t('qty')}: {totalQty}</span>
                                  {(product.client_product_price || 0) > 0 && (
                                    <span>${formatCurrency(product.client_product_price || 0)}/{t('unit')}</span>
                                  )}
                                  {(product.sample_fee || 0) > 0 && (
                                    <span>{t('sample')}: ${formatCurrency(product.sample_fee || 0)}</span>
                                  )}
                                  {product.selected_shipping_method && hasShipping && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-300 rounded-full">
                                      {product.selected_shipping_method === 'air' ? (
                                        <Plane className="w-3 h-3 text-green-600" />
                                      ) : (
                                        <Ship className="w-3 h-3 text-green-600" />
                                      )}
                                      <span className="text-green-700 font-medium">
                                        ${formatCurrency(
                                          product.selected_shipping_method === 'air' 
                                            ? (product.client_shipping_air_price || 0)
                                            : (product.client_shipping_boat_price || 0)
                                        )}
                                      </span>
                                    </span>
                                  )}
                                  {daysReady > 0 && (
                                    <span className="text-amber-600 font-medium">
                                      {daysReady} {daysReady === 1 ? t('dayAgo') : t('daysAgo')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                              <div className="text-right">
                                <p className="text-sm font-semibold text-gray-900">
                                  ${formatCurrency(fees)}
                                </p>
                                {!hasShipping && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                                    <span className="text-xs text-amber-600 font-medium">
                                      {t('shippingNotSet')}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {getProductRoutingBadge(product)}
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