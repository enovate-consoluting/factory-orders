/**
 * Order List Translations
 * Bilingual (EN/ZH) translations for Orders Listing page
 * Location: app/dashboard/orders/utils/orderListTranslations.ts
 * UPDATED: Added readyToShip translation (configurable override from DB)
 * Last Modified: Nov 28 2025
 */

export type Language = 'en' | 'zh';

export interface Translations {
  // Page titles
  orders: string;
  yourOrders: string;
  newOrder: string;
  
  // Tabs
  myOrders: string;
  sentToManufacturer: string;
  sentToAdmin: string;
  productionStatus: string;
  invoiceApproval: string;
  
  // Production sub-tabs
  sampleApproved: string;
  approvedForProd: string;
  inProduction: string;
  shipped: string;
  
  // NEW: Ready to ship (default - can be overridden by config)
  readyToShip: string;
  
  // Table headers
  order: string;
  client: string;
  clientMfr: string;
  products: string;
  clientTotal: string;
  created: string;
  actions: string;
  
  // Status labels
  withAdmin: string;
  withManufacturer: string;
  needAction: string;
  productsWithFees: string;
  approved: string;
  production: string;
  completed: string;
  
  // Actions
  editOrder: string;
  viewDetails: string;
  deleteOrder: string;
  
  // Delete modal
  confirmDelete: string;
  deleteWarning: string;
  superAdminWarning: string;
  superAdminOverride: string;
  areYouSure: string;
  permanentDelete: string;
  cancel: string;
  deleting: string;
  
  // Empty states
  noOrders: string;
  noOrdersMessage: string;
  noProductionOrders: string;
  tryAdjustingSearch: string;
  getStarted: string;
  
  // Search
  searchPlaceholder: string;
  
  // Price toggle
  showPrices: string;
  hidePrices: string;
  
  // Misc
  untitledOrder: string;
  product: string;
  
  // Language toggle
  switchToChinese: string;
  
  // Invoice Approval View
  pendingApproval: string;
  readyForProduction: string;
  fees: string;
  shipping: string;
  productPrice: string;
  sampleFee: string;
  air: string;
  boat: string;
  ordersReadyForInvoicing: string;
  noOrdersReadyForInvoicing: string;
  withClient: string;
  invoiceReady: string;
  dayAgo: string;
  daysAgo: string;
  total: string;
  createInvoice: string;
  viewOrder: string;
  qty: string;
  unit: string;
  sample: string;
  shippingNotSet: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    // Page titles
    orders: 'Orders',
    yourOrders: 'Your Orders',
    newOrder: 'New Order',
    
    // Tabs
    myOrders: 'My Orders',
    sentToManufacturer: 'Sent to Manufacturer',
    sentToAdmin: 'Sent to Admin',
    productionStatus: 'Production',
    invoiceApproval: 'Invoice Approval',
    
    // Production sub-tabs
    sampleApproved: 'Sample Approved',
    approvedForProd: 'Approved for Prod',
    inProduction: 'In Production',
    shipped: 'Shipped',
    
    // NEW: Ready to ship default
    readyToShip: 'Ready to Ship',
    
    // Table headers
    order: 'Order',
    client: 'Client',
    clientMfr: 'Client / Manufacturer',
    products: 'Products',
    clientTotal: 'Client Total',
    created: 'Created',
    actions: 'Actions',
    
    // Status labels
    withAdmin: 'with Admin',
    withManufacturer: 'with Manufacturer',
    needAction: 'need action',
    productsWithFees: 'products with fees',
    approved: 'Approved',
    production: 'In Production',
    completed: 'Completed',
    
    // Actions
    editOrder: 'Edit Order',
    viewDetails: 'View Details',
    deleteOrder: 'Delete Order',
    
    // Delete modal
    confirmDelete: 'Confirm Delete',
    deleteWarning: 'Are you sure you want to delete order',
    superAdminWarning: 'Super Admin: This will permanently delete this order and all associated data.',
    superAdminOverride: 'Super Admin Override',
    areYouSure: 'Are you sure you want to delete order',
    permanentDelete: 'This action cannot be undone.',
    cancel: 'Cancel',
    deleting: 'Deleting...',
    
    // Empty states
    noOrders: 'No orders found',
    noOrdersMessage: 'No orders need your attention right now.',
    noProductionOrders: 'No orders in this production stage.',
    tryAdjustingSearch: 'Try adjusting your search criteria.',
    getStarted: 'Get started by creating a new order.',
    
    // Search
    searchPlaceholder: 'Search orders...',
    
    // Price toggle
    showPrices: 'Show Prices',
    hidePrices: 'Hide Prices',
    
    // Misc
    untitledOrder: 'Untitled Order',
    product: 'product',
    
    // Language toggle
    switchToChinese: '中文',
    
    // Invoice Approval View
    pendingApproval: 'Pending Approval',
    readyForProduction: 'Ready for Production',
    fees: 'Fees',
    shipping: 'Shipping',
    productPrice: 'Product Price',
    sampleFee: 'Sample Fee',
    air: 'Air',
    boat: 'Boat',
    ordersReadyForInvoicing: 'Orders Ready for Invoicing',
    noOrdersReadyForInvoicing: 'No orders ready for invoicing.',
    withClient: 'With Client',
    invoiceReady: 'Invoice Ready',
    dayAgo: 'day ago',
    daysAgo: 'days ago',
    total: 'Total',
    createInvoice: 'Create Invoice',
    viewOrder: 'View Order',
    qty: 'Qty',
    unit: 'unit',
    sample: 'Sample',
    shippingNotSet: 'Shipping not set',
  },
  zh: {
    // Page titles
    orders: '订单',
    yourOrders: '您的订单',
    newOrder: '新订单',
    
    // Tabs
    myOrders: '我的订单',
    sentToManufacturer: '已发送给制造商',
    sentToAdmin: '已发送给管理员',
    productionStatus: '生产状态',
    invoiceApproval: '发票审批',
    
    // Production sub-tabs
    sampleApproved: '样品已批准',
    approvedForProd: '已批准生产',
    inProduction: '生产中',
    shipped: '已发货',
    
    // NEW: Ready to ship default
    readyToShip: '准备发货',
    
    // Table headers
    order: '订单',
    client: '客户',
    clientMfr: '客户 / 制造商',
    products: '产品',
    clientTotal: '客户总计',
    created: '创建日期',
    actions: '操作',
    
    // Status labels
    withAdmin: '在管理员处',
    withManufacturer: '在制造商处',
    needAction: '需要处理',
    productsWithFees: '有费用的产品',
    approved: '已批准',
    production: '生产中',
    completed: '已完成',
    
    // Actions
    editOrder: '编辑订单',
    viewDetails: '查看详情',
    deleteOrder: '删除订单',
    
    // Delete modal
    confirmDelete: '确认删除',
    deleteWarning: '您确定要删除订单吗',
    superAdminWarning: '超级管理员：这将永久删除此订单及所有相关数据。',
    superAdminOverride: '超级管理员覆盖',
    areYouSure: '您确定要删除订单',
    permanentDelete: '此操作无法撤消。',
    cancel: '取消',
    deleting: '删除中...',
    
    // Empty states
    noOrders: '未找到订单',
    noOrdersMessage: '目前没有需要您处理的订单。',
    noProductionOrders: '此生产阶段没有订单。',
    tryAdjustingSearch: '请尝试调整搜索条件。',
    getStarted: '开始创建新订单。',
    
    // Search
    searchPlaceholder: '搜索订单...',
    
    // Price toggle
    showPrices: '显示价格',
    hidePrices: '隐藏价格',
    
    // Misc
    untitledOrder: '未命名订单',
    product: '产品',
    
    // Language toggle
    switchToChinese: 'English',
    
    // Invoice Approval View
    pendingApproval: '待审批',
    readyForProduction: '准备生产',
    fees: '费用',
    shipping: '运费',
    productPrice: '产品价格',
    sampleFee: '样品费',
    air: '空运',
    boat: '海运',
    ordersReadyForInvoicing: '待开发票订单',
    noOrdersReadyForInvoicing: '没有待开发票的订单。',
    withClient: '在客户处',
    invoiceReady: '发票已准备',
    dayAgo: '天前',
    daysAgo: '天前',
    total: '总计',
    createInvoice: '创建发票',
    viewOrder: '查看订单',
    qty: '数量',
    unit: '单位',
    sample: '样品',
    shippingNotSet: '未设置运费',
  }
};