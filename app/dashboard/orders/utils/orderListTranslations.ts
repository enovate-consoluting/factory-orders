/**
 * Order List Translations
 * English and Chinese translations for Orders Listing page
 * Location: app/dashboard/orders/utils/orderListTranslations.ts
 * Last Modified: Nov 26 2025
 */

export type Language = 'en' | 'zh';

export interface TranslationStrings {
  // Header
  orders: string;
  yourOrders: string;
  newOrder: string;
  
  // Tabs
  myOrders: string;
  invoiceApproval: string;
  sentToAdmin: string;
  sentToManufacturer: string;
  productionStatus: string;
  approvedForProduction: string;
  inProduction: string;
  shipped: string;
  
  // Production sub-tabs
  approved: string;
  production: string;
  
  // Table Headers
  order: string;
  orderNumber: string;
  clientMfr: string;
  client: string;
  manufacturer: string;
  products: string;
  productsWithFees: string;
  clientTotal: string;
  totalFees: string;
  created: string;
  orderCreated: string;
  invoiceReady: string;
  actions: string;
  fees: string;
  
  // Order Details
  untitledOrder: string;
  product: string;
  withAdmin: string;
  withClient: string;
  withManufacturer: string;
  needAction: string;
  completed: string;
  reviewInvoice: string;
  createInvoice: string;
  viewOrder: string;
  sampleFee: string;
  unitPrice: string;
  shipping: string;
  shippingNotSet: string;
  withShipping: string;
  noShipping: string;
  qty: string;
  daysAgo: string;
  dayAgo: string;
  
  // Search
  searchPlaceholder: string;
  noOrders: string;
  noOrdersMessage: string;
  noInvoicesMessage: string;
  noProductionOrders: string;
  tryAdjustingSearch: string;
  getStarted: string;
  
  // Actions
  showPrices: string;
  hidePrices: string;
  viewDetails: string;
  editOrder: string;
  deleteOrder: string;
  
  // Delete Modal
  confirmDelete: string;
  superAdminOverride: string;
  areYouSure: string;
  permanentDelete: string;
  cancel: string;
  deleting: string;
  
  // Status
  draft: string;
  newOrderStatus: string;
  awaitingPrice: string;
  priced: string;
  readyToProduce: string;
  
  // Language Toggle
  switchToChinese: string;
}

export const translations: Record<Language, TranslationStrings> = {
  en: {
    // Header
    orders: "Orders",
    yourOrders: "Your Orders",
    newOrder: "New Order",
    
    // Tabs
    myOrders: "My Orders",
    invoiceApproval: "Invoice Approval",
    sentToAdmin: "Sent to Admin",
    sentToManufacturer: "Sent to Manufacturer",
    productionStatus: "Production Status",
    approvedForProduction: "Approved for Production",
    inProduction: "In Production",
    shipped: "Shipped",
    
    // Production sub-tabs
    approved: "Approved",
    production: "Production",
    
    // Table Headers
    order: "Order",
    orderNumber: "Order Number",
    clientMfr: "Client/Mfr",
    client: "Client",
    manufacturer: "Manufacturer",
    products: "Products",
    productsWithFees: "Products with Fees",
    clientTotal: "Client Total",
    totalFees: "Total Fees",
    created: "Created",
    orderCreated: "Order Created",
    invoiceReady: "Invoice Ready",
    actions: "Actions",
    fees: "Fees",
    
    // Order Details
    untitledOrder: "Untitled Order",
    product: "Product",
    withAdmin: "With Admin",
    withClient: "With Client",
    withManufacturer: "With Manufacturer",
    needAction: "Need Action",
    completed: "Completed",
    reviewInvoice: "Review Invoice",
    createInvoice: "Create Invoice",
    viewOrder: "View Order",
    sampleFee: "Sample Fee",
    unitPrice: "Unit Price",
    shipping: "Shipping",
    shippingNotSet: "No Shipping Selected",
    withShipping: "w/ shipping",
    noShipping: "no shipping",
    qty: "Qty",
    daysAgo: "days ago",
    dayAgo: "day ago",
    
    // Search
    searchPlaceholder: "Search orders, clients, or manufacturers...",
    noOrders: "No orders",
    noOrdersMessage: "No orders need your action right now",
    noInvoicesMessage: "No orders with fees awaiting invoice approval",
    noProductionOrders: "No orders in this production stage",
    tryAdjustingSearch: "Try adjusting your search",
    getStarted: "Get started by creating a new order",
    
    // Actions
    showPrices: "Show Prices",
    hidePrices: "Hide Prices",
    viewDetails: "View Details",
    editOrder: "Edit Order",
    deleteOrder: "Delete Order",
    
    // Delete Modal
    confirmDelete: "Confirm Delete",
    superAdminOverride: "Super Admin Override",
    areYouSure: "Are you sure you want to delete order",
    permanentDelete: "This will permanently delete the order and all associated products, variants, and media files.",
    cancel: "Cancel",
    deleting: "Deleting...",
    
    // Status
    draft: "Draft",
    newOrderStatus: "New Order",
    awaitingPrice: "Awaiting Price",
    priced: "Priced",
    readyToProduce: "Ready to Produce",
    
    // Language Toggle
    switchToChinese: "中文"
  },
  
  zh: {
    // Header
    orders: "订单",
    yourOrders: "您的订单",
    newOrder: "新建订单",
    
    // Tabs
    myOrders: "我的订单",
    invoiceApproval: "发票审批",
    sentToAdmin: "发送给管理员",
    sentToManufacturer: "发送给制造商",
    productionStatus: "生产状态",
    approvedForProduction: "已批准生产",
    inProduction: "生产中",
    shipped: "已发货",
    
    // Production sub-tabs
    approved: "已批准",
    production: "生产中",
    
    // Table Headers
    order: "订单",
    orderNumber: "订单号",
    clientMfr: "客户/制造商",
    client: "客户",
    manufacturer: "制造商",
    products: "产品",
    productsWithFees: "带费用的产品",
    clientTotal: "客户总额",
    totalFees: "总费用",
    created: "创建时间",
    orderCreated: "订单创建",
    invoiceReady: "可开票时间",
    actions: "操作",
    fees: "费用",
    
    // Order Details
    untitledOrder: "未命名订单",
    product: "产品",
    withAdmin: "管理员处理中",
    withClient: "客户处理中",
    withManufacturer: "制造商处理中",
    needAction: "需要处理",
    completed: "已完成",
    reviewInvoice: "查看发票",
    createInvoice: "创建发票",
    viewOrder: "查看订单",
    sampleFee: "样品费",
    unitPrice: "单价",
    shipping: "运费",
    shippingNotSet: "未选择运输",
    withShipping: "含运费",
    noShipping: "无运费",
    qty: "数量",
    daysAgo: "天前",
    dayAgo: "天前",
    
    // Search
    searchPlaceholder: "搜索订单、客户或制造商...",
    noOrders: "没有订单",
    noOrdersMessage: "目前没有需要您处理的订单",
    noInvoicesMessage: "没有等待发票审批的订单",
    noProductionOrders: "此生产阶段没有订单",
    tryAdjustingSearch: "请尝试调整搜索条件",
    getStarted: "创建新订单开始",
    
    // Actions
    showPrices: "显示价格",
    hidePrices: "隐藏价格",
    viewDetails: "查看详情",
    editOrder: "编辑订单",
    deleteOrder: "删除订单",
    
    // Delete Modal
    confirmDelete: "确认删除",
    superAdminOverride: "超级管理员权限",
    areYouSure: "您确定要删除订单",
    permanentDelete: "这将永久删除订单及所有相关产品、变体和媒体文件。",
    cancel: "取消",
    deleting: "删除中...",
    
    // Status
    draft: "草稿",
    newOrderStatus: "新订单",
    awaitingPrice: "等待报价",
    priced: "已报价",
    readyToProduce: "准备生产",
    
    // Language Toggle
    switchToChinese: "English"
  }
};

/**
 * Get translations for a specific language
 */
export const getTranslations = (language: Language): TranslationStrings => {
  return translations[language];
};
