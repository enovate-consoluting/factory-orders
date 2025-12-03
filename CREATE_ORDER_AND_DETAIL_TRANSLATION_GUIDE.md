# Create Order & Order Detail Pages - Translation Implementation Guide

## Overview
This guide provides step-by-step instructions to add bilingual (English/Chinese) translation support to:
1. **Create Order Page** (`app/dashboard/orders/create/page.tsx`)
2. **Order Detail Page** (`app/dashboard/orders/[id]/page.tsx`)

---

## ✅ Prerequisites (Already Completed)

- ✅ Translation system is set up with `react-i18next`
- ✅ `LanguageContext` is available globally
- ✅ `useDynamicTranslation` hook is ready for database content
- ✅ Orders List page translation is working
- ✅ Variants page translation is working

---

## 📝 STEP 1: Add Translation Keys to JSON Files

### Add to `public/locales/en.json`:

```json
{
  "existing keys...": "...",

  "_comment_createOrder": "=== Create Order Page ===",
  "createNewOrder": "Create New Order",
  "backToOrders": "Back to Orders",
  "step": "Step",
  "of": "of",
  "basicInfo": "Basic Information",
  "selectClientAndManufacturer": "Select Client and Manufacturer",
  "selectClient": "Select Client",
  "searchClient": "Search clients...",
  "noClientsFound": "No clients found",
  "selectManufacturer": "Select Manufacturer",
  "searchManufacturer": "Search manufacturers...",
  "noManufacturersFound": "No manufacturers found",
  "orderName": "Order Name (Optional)",
  "e.gSpringCollection2024": "e.g., Spring Collection 2024",
  "next": "Next",
  "addProducts": "Add Products",
  "selectProductsToAdd": "Select products to add to this order",
  "searchProducts": "Search products...",
  "noProductsAvailable": "No products available",
  "addSelectedProducts": "Add Selected Product(s)",
  "productsAdded": "product(s) added",
  "configureProducts": "Configure Products",
  "configureEachProduct": "Configure each product with variants, quantities, and pricing",
  "previous": "Previous",
  "reviewSubmit": "Review & Submit",
  "reviewOrderDetails": "Review order details before submitting",
  "submit": "Submit",
  "submitting": "Submitting...",
  "processing": "Processing...",
  "complete": "Complete!",
  "creatingOrder": "Creating order record",
  "addingProducts": "Adding products",
  "uploadingFiles": "Uploading files",
  "orderCreated": "Order created successfully!",
  "viewOrder": "View Order",
  "createAnother": "Create Another Order",

  "_comment_productConfig": "=== Product Configuration ===",
  "productOrderNumber": "Product Order Number",
  "e.gP001": "e.g., P-001",
  "productDescription": "Product Description",
  "describeThisProduct": "Describe this specific product",
  "pricing": "Pricing",
  "standardPrice": "Standard Price (per unit)",
  "bulkPrice": "Bulk Price (per unit)",
  "enterPrice": "Enter price",
  "sample": "Sample",
  "sampleRequired": "Sample Required",
  "notes": "Notes",
  "sampleEta": "Sample ETA",
  "sampleStatus": "Sample Status",
  "pending": "Pending",
  "inProgress": "In Progress",
  "completed": "Completed",
  "shipping": "Shipping",
  "shippingAirPrice": "Air Shipping Price",
  "shippingBoatPrice": "Boat/Sea Shipping Price",
  "productionTime": "Production Time",
  "e.g2_3weeks": "e.g., 2-3 weeks",
  "variants": "Variants",
  "variantCombination": "Variant Combination",
  "quantity": "Quantity",
  "addVariant": "Add Variant",
  "removeProduct": "Remove Product",
  "mediaFiles": "Media Files",
  "uploadImages": "Upload Images/Files",
  "dragAndDrop": "Drag and drop files here, or click to select",
  "sampleFiles": "Sample Files",
  "uploadSampleFiles": "Upload Sample Files",
  "remove": "Remove",

  "_comment_orderSummary": "=== Order Summary ===",
  "orderSummary": "Order Summary",
  "totalProducts": "Total Products",
  "totalItems": "Total Items",
  "estimatedTotal": "Estimated Total",

  "_comment_orderDetail": "=== Order Detail Page ===",
  "orderDetails": "Order Details",
  "orderNumber": "Order Number",
  "status": "Status",
  "draft": "Draft",
  "active": "Active",
  "editDraft": "Edit Draft",
  "markAsPaid": "Mark as Paid",
  "markAsUnpaid": "Mark as Unpaid",
  "paid": "Paid",
  "unpaid": "Unpaid",
  "clientInfo": "Client",
  "manufacturerInfo": "Manufacturer",
  "editClient": "Edit Client",
  "selectNewClient": "Select New Client",
  "save": "Save",
  "saving": "Saving...",
  "noteOrderNumberWillChange": "Note: Order number will change to use new client's prefix",
  "orderProducts": "Order Products",
  "productDetail": "Product Detail",
  "hideManufacturerProducts": "Hide Manufacturer Products",
  "showAllProducts": "Show All Products",
  "noProductsAssigned": "No products assigned to you yet.",
  "noProductsWithAdmin": "No products with admin. Check 'Show All Products' to see products with manufacturer.",
  "totalProductsInOrder": "Total products in order",
  "productsForYourReview": "Products for Your Review",
  "noProductsPendingReview": "No Products Pending Review",
  "allProductsReviewed": "All products have been reviewed or are still being processed.",
  "saveAll": "Save All",
  "saveAndRoute": "Save & Route",
  "printAll": "Print All",
  "routeTo": "Route To",
  "admin": "Admin",
  "manufacturer": "Manufacturer",
  "draftOnly": "Draft Only",

  "_comment_quickFill": "=== Quick Fill Tool ===",
  "quickFill": "Quick Fill",
  "applyToAll": "Apply to All Products",
  "applyPricingToAll": "Apply pricing and shipping to all products at once",
  "applyToAllProducts": "Apply to All Products"
}
```

### Add to `public/locales/zh.json`:

```json
{
  "existing keys...": "...",

  "_comment_createOrder": "=== 创建订单页面 ===",
  "createNewOrder": "创建新订单",
  "backToOrders": "返回订单列表",
  "step": "步骤",
  "of": "/",
  "basicInfo": "基本信息",
  "selectClientAndManufacturer": "选择客户和制造商",
  "selectClient": "选择客户",
  "searchClient": "搜索客户...",
  "noClientsFound": "未找到客户",
  "selectManufacturer": "选择制造商",
  "searchManufacturer": "搜索制造商...",
  "noManufacturersFound": "未找到制造商",
  "orderName": "订单名称（可选）",
  "e.gSpringCollection2024": "例如：2024春季系列",
  "next": "下一步",
  "addProducts": "添加产品",
  "selectProductsToAdd": "选择要添加到此订单的产品",
  "searchProducts": "搜索产品...",
  "noProductsAvailable": "没有可用产品",
  "addSelectedProducts": "添加选定的产品",
  "productsAdded": "个产品已添加",
  "configureProducts": "配置产品",
  "configureEachProduct": "为每个产品配置变体、数量和定价",
  "previous": "上一步",
  "reviewSubmit": "审核并提交",
  "reviewOrderDetails": "提交前审核订单详情",
  "submit": "提交",
  "submitting": "提交中...",
  "processing": "处理中...",
  "complete": "完成！",
  "creatingOrder": "创建订单记录",
  "addingProducts": "添加产品",
  "uploadingFiles": "上传文件",
  "orderCreated": "订单创建成功！",
  "viewOrder": "查看订单",
  "createAnother": "创建另一个订单",

  "_comment_productConfig": "=== 产品配置 ===",
  "productOrderNumber": "产品订单号",
  "e.gP001": "例如：P-001",
  "productDescription": "产品描述",
  "describeThisProduct": "描述此特定产品",
  "pricing": "定价",
  "standardPrice": "标准价格（每单位）",
  "bulkPrice": "批量价格（每单位）",
  "enterPrice": "输入价格",
  "sample": "样品",
  "sampleRequired": "需要样品",
  "notes": "备注",
  "sampleEta": "样品预计到达时间",
  "sampleStatus": "样品状态",
  "pending": "待处理",
  "inProgress": "进行中",
  "completed": "已完成",
  "shipping": "运输",
  "shippingAirPrice": "空运价格",
  "shippingBoatPrice": "海运价格",
  "productionTime": "生产时间",
  "e.g2_3weeks": "例如：2-3周",
  "variants": "变体",
  "variantCombination": "变体组合",
  "quantity": "数量",
  "addVariant": "添加变体",
  "removeProduct": "删除产品",
  "mediaFiles": "媒体文件",
  "uploadImages": "上传图片/文件",
  "dragAndDrop": "拖放文件到此处，或点击选择",
  "sampleFiles": "样品文件",
  "uploadSampleFiles": "上传样品文件",
  "remove": "删除",

  "_comment_orderSummary": "=== 订单摘要 ===",
  "orderSummary": "订单摘要",
  "totalProducts": "总产品数",
  "totalItems": "总项目数",
  "estimatedTotal": "预估总计",

  "_comment_orderDetail": "=== 订单详情页面 ===",
  "orderDetails": "订单详情",
  "orderNumber": "订单号",
  "status": "状态",
  "draft": "草稿",
  "active": "活动",
  "editDraft": "编辑草稿",
  "markAsPaid": "标记为已付款",
  "markAsUnpaid": "标记为未付款",
  "paid": "已付款",
  "unpaid": "未付款",
  "clientInfo": "客户",
  "manufacturerInfo": "制造商",
  "editClient": "编辑客户",
  "selectNewClient": "选择新客户",
  "save": "保存",
  "saving": "保存中...",
  "noteOrderNumberWillChange": "注意：订单编号将更改为使用新客户的前缀",
  "orderProducts": "订单产品",
  "productDetail": "产品详情",
  "hideManufacturerProducts": "隐藏制造商产品",
  "showAllProducts": "显示所有产品",
  "noProductsAssigned": "尚未分配给您产品。",
  "noProductsWithAdmin": "管理员处没有产品。勾选"显示所有产品"查看制造商处的产品。",
  "totalProductsInOrder": "订单中的总产品数",
  "productsForYourReview": "待您审核的产品",
  "noProductsPendingReview": "没有待审核的产品",
  "allProductsReviewed": "所有产品已被审核或仍在处理中。",
  "saveAll": "全部保存",
  "saveAndRoute": "保存并路由",
  "printAll": "全部打印",
  "routeTo": "路由到",
  "admin": "管理员",
  "manufacturer": "制造商",
  "draftOnly": "仅限草稿",

  "_comment_quickFill": "=== 快速填充工具 ===",
  "quickFill": "快速填充",
  "applyToAll": "应用到所有产品",
  "applyPricingToAll": "一次性将定价和运输应用到所有产品",
  "applyToAllProducts": "应用到所有产品"
}
```

---

## 🔧 STEP 2: Update Create Order Page

### File: `app/dashboard/orders/create/page.tsx`

### 2.1: Add Imports at Top

Add these imports after existing imports:

```typescript
// Translation imports
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import '../../../i18n';
```

### 2.2: Add Translation Hooks in Component

Add these hooks at the beginning of the component function:

```typescript
export default function CreateOrderPage() {
  // Translation hooks
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { translate } = useDynamicTranslation();

  // ... rest of existing code
}
```

### 2.3: Replace Hardcoded Text with t() Calls

**Find & Replace Examples:**

```typescript
// Before:
<h1>Create New Order</h1>

// After:
<h1>{t('createNewOrder')}</h1>
```

```typescript
// Before:
<button>Back to Orders</button>

// After:
<button>{t('backToOrders')}</button>
```

```typescript
// Before:
<span>Step {step} of {totalSteps}</span>

// After:
<span>{t('step')} {step} {t('of')} {totalSteps}</span>
```

```typescript
// Before:
placeholder="Search clients..."

// After:
placeholder={t('searchClient')}
```

### 2.4: Translate Dynamic Content (Client/Manufacturer Names)

For client and manufacturer names from database, use the `translate()` function:

```typescript
// Before:
<div>{client.name}</div>

// After:
<div>{translate(client.name)}</div>
```

---

## 🔧 STEP 3: Update Order Detail Page

### File: `app/dashboard/orders/[id]/page.tsx`

### 3.1: Add Imports

```typescript
// Translation imports (if not already present)
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDynamicTranslation } from '@/hooks/useDynamicTranslation';
import '../../../i18n';
```

### 3.2: Add Translation Hooks

```typescript
export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Translation hooks
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { translate, translateBatch } = useDynamicTranslation();

  // ... rest of code
}
```

### 3.3: Pre-load Dynamic Translations

Add this useEffect to batch-translate dynamic content:

```typescript
// Pre-load translations for order data
useEffect(() => {
  if (!order) return;

  const textsToTranslate: string[] = [];

  // Collect all text that needs translation
  if (order.order_name) textsToTranslate.push(order.order_name);
  if (order.client?.name) textsToTranslate.push(order.client.name);
  if (order.manufacturer?.name) textsToTranslate.push(order.manufacturer.name);

  if (order.order_products) {
    order.order_products.forEach(product => {
      if (product.description) textsToTranslate.push(product.description);
      if (product.product?.title) textsToTranslate.push(product.product.title);
    });
  }

  // Batch translate all at once
  translateBatch(textsToTranslate, 'order-detail');
}, [order, translateBatch]);
```

### 3.4: Replace Hardcoded Text

**Examples:**

```typescript
// Before:
<p>Order Total</p>

// After:
<p>{t('orderTotal')}</p>
```

```typescript
// Before:
<h2>Products for Your Review</h2>

// After:
<h2>{t('productsForYourReview')}</h2>
```

```typescript
// Before:
<button>Save All</button>

// After:
<button>{t('saveAll')}</button>
```

### 3.5: Translate Dynamic Content

```typescript
// Before:
<div>{order.order_name || 'Untitled Order'}</div>

// After:
<div>{order.order_name ? translate(order.order_name) : t('untitledOrder')}</div>
```

```typescript
// Before:
<div>{order.client?.name}</div>

// After:
<div>{order.client?.name ? translate(order.client.name) : '-'}</div>
```

---

## 📦 STEP 4: Update Shared Components

Several shared components used by these pages also need translation:

### 4.1: StepIndicator Component
**File:** `app/dashboard/orders/shared-components/StepIndicator.tsx`

```typescript
// Add imports
import { useTranslation } from 'react-i18next';

// In component
const { t } = useTranslation();

// Replace step text
<span>{t('step')} {step} {t('of')} {totalSteps}</span>
```

### 4.2: OrderSummaryCard Component
**File:** `app/dashboard/orders/shared-components/OrderSummaryCard.tsx`

```typescript
// Add imports and hooks
const { t } = useTranslation();
const { translate } = useDynamicTranslation();

// Replace text
<h3>{t('orderSummary')}</h3>
<p>{t('totalProducts')}: {productCount}</p>
<p>{t('estimatedTotal')}: {total}</p>
```

### 4.3: ProductSelector Component
**File:** `app/dashboard/orders/shared-components/ProductSelector.tsx`

```typescript
// Add hooks
const { t } = useTranslation();
const { translate } = useDynamicTranslation();

// Replace text
<input placeholder={t('searchProducts')} />
<button>{t('addSelectedProducts')}</button>

// Translate product titles
<div>{translate(product.title)}</div>
```

### 4.4: CreateProductCard Component
**File:** `app/dashboard/orders/shared-components/CreateProductCard.tsx`

```typescript
// Add hooks
const { t } = useTranslation();

// Replace all labels
<label>{t('productOrderNumber')}</label>
<label>{t('standardPrice')}</label>
// ... etc
```

---

## 🧪 STEP 5: Testing

### Test Checklist:

1. **Create Order Page:**
   - ✅ Click "New Order" button from Orders page
   - ✅ Verify all step indicators are translated
   - ✅ Verify all form labels are translated
   - ✅ Client/manufacturer names translate when selected
   - ✅ Product names translate in product selector
   - ✅ Switch language - verify page updates

2. **Order Detail Page:**
   - ✅ Open any order
   - ✅ Verify all UI labels are translated
   - ✅ Client/manufacturer names are translated
   - ✅ Product descriptions are translated
   - ✅ All buttons are translated
   - ✅ Switch language - verify page updates immediately

3. **Language Persistence:**
   - ✅ Set language to Chinese on Orders page
   - ✅ Click "Create Order" - should load in Chinese
   - ✅ Navigate to Order Detail - should be in Chinese
   - ✅ Refresh page - should stay in Chinese

4. **Dynamic Content:**
   - ✅ Create order with Chinese client name - should translate
   - ✅ View order with database content - should translate
   - ✅ Check terminal - should see batch translation API calls (not 100+ individual calls)

---

## 🎯 Quick Reference: Common Translations

### Buttons:
- `t('save')` → Save / 保存
- `t('cancel')` → Cancel / 取消
- `t('submit')` → Submit / 提交
- `t('next')` → Next / 下一步
- `t('previous')` → Previous / 上一步

### Form Labels:
- `t('orderName')` → Order Name / 订单名称
- `t('client')` → Client / 客户
- `t('manufacturer')` → Manufacturer / 制造商
- `t('products')` → Products / 产品

### Status:
- `t('pending')` → Pending / 待处理
- `t('inProgress')` → In Progress / 进行中
- `t('completed')` → Completed / 已完成

---

## 🚨 Common Issues & Solutions

### Issue 1: "t is not a function"
**Solution:** Make sure you added `const { t } = useTranslation();` in the component

### Issue 2: Translation keys showing instead of text
**Solution:** Make sure the key exists in both `en.json` and `zh.json` files

### Issue 3: Dynamic content (names) not translating
**Solution:** Use `translate(text)` from `useDynamicTranslation` hook, not `t()` function

### Issue 4: Too many API calls
**Solution:** Use `translateBatch()` in a useEffect to pre-load translations

### Issue 5: Language not persisting
**Solution:** Make sure `LanguageContext` is wrapped in root layout

---

## ✅ Completion Checklist

- [ ] Added all translation keys to en.json
- [ ] Added all translation keys to zh.json
- [ ] Updated Create Order page with translation hooks
- [ ] Replaced all hardcoded text in Create Order page
- [ ] Updated Order Detail page with translation hooks
- [ ] Replaced all hardcoded text in Order Detail page
- [ ] Updated all shared components
- [ ] Tested language toggle on all pages
- [ ] Verified language persists across pages
- [ ] Checked terminal for excessive API calls
- [ ] Tested with real data (client names, product names)

---

## 📞 Need Help?

Reference working examples:
- **Orders List Page:** `app/dashboard/orders/page.tsx` ✅ Working
- **Variants Page:** `app/dashboard/variants/page.tsx` ✅ Working

Both of these pages have full translation implementation you can reference!
