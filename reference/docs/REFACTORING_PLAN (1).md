# REFACTORING_PLAN.md
# Factory Orders System - Refactoring Plan
# December 2024

## Current Status
- **Production**: Fully deployed and working
- **Latest Fix**: Orders listing tabs fixed (Admin sees correct data, "Sent to Manufacturer" label, "Approved for Production" tab added)
- **Ready for**: Major refactoring to improve code maintainability

## Phase 0: Fix Product Visibility (DO THIS FIRST)
**Why First**: This fixes an immediate usability issue in production

### The Problem:
- Currently when products are routed, they disappear from the sender's view
- Manufacturer sends to admin â†’ Products vanish from manufacturer's "My Orders"
- Admin sends to manufacturer â†’ Products vanish from admin's "My Orders"
- This is confusing now that we have organized tabs

### The Solution:
- Keep products visible in ALL tabs but with appropriate permissions
- Add read-only state when products are routed to other party
- Visual indicators showing "View Only" status

### Changes Needed:
1. **Update Order Detail Page** (`/app/dashboard/orders/[id]/page.tsx`)
   - Remove filtering that hides products when routed
   - Add read-only state for routed products
   - Add visual indicators (lock icon, "View Only" badge)

2. **Update Product Cards**
   - Add `isReadOnly` prop to both AdminProductCard and ManufacturerProductCard
   - Disable editing when `routed_to` doesn't match current user role
   - Add visual indicator: "Currently with [Admin/Manufacturer] - View Only"

3. **Keep products visible in all tabs** but with appropriate permissions
   - Manufacturer can see products sent to admin (read-only)
   - Admin can see products sent to manufacturer (read-only)

## Phase 1: Extract Shared Components

### Components to Create:

1. **ProductCard Component**
   - Location: `/app/dashboard/orders/components/shared/ProductCard.tsx`
   - Base component for all product displays
   - Props: viewType (create/edit/view), userRole, isReadOnly
   - Used by: Create, Edit, and Detail pages

2. **CollapsedProductView Component**
   - Location: `/app/dashboard/orders/components/shared/CollapsedProductView.tsx`
   - Shared collapsed header view
   - Used by both Admin and Manufacturer cards
   - Reduces code duplication

3. **Use Existing VariantTable Component**
   - Already at: `/app/dashboard/orders/[id]/components/shared/VariantTable.tsx`
   - Update AdminProductCard to use it
   - Update ManufacturerProductCard to use it
   - Remove duplicate variant table code

## Phase 2: Order-Level Sample Request

### Database Changes:
```sql
-- Add to orders table:
ALTER TABLE orders ADD COLUMN sample_required BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN sample_fee DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN sample_notes TEXT;
ALTER TABLE orders ADD COLUMN sample_status TEXT DEFAULT 'pending';
```

### Component Changes:

1. **Create OrderSampleCard Component**
   - Location: `/app/dashboard/orders/components/shared/OrderSampleCard.tsx`
   - Display above products section
   - Single place for all sample requests/tech packs
   - Used in Create, Edit, and Detail pages

2. **Comment Out Product-Level Sample Sections**
   ```typescript
   {/* SAMPLE REQUEST SECTION - Moved to order level 
       Commented out Dec 2024 - Keep for potential per-product use later
   <div className="sample-section">
     ...original code...
   </div>
   */}
   ```
   - Don't delete, just comment with note
   - Keeps flexibility for future
   - Easy to revert if needed

3. **Update Data Flow**
   - Save sample data at order level
   - Also save to first product for backwards compatibility
   - Read from order level for display

## Phase 3: Clean Up Order Detail Page

### Current Issues:
- 2000+ lines in single file
- Hard to maintain and debug
- Duplicate logic
- No clear separation of concerns

### Solution:
- Break into logical components
- Add header comments to all files
- Extract business logic into hooks
- Improve code organization

### Components to Extract:
1. WorkflowSection
2. NotificationSection
3. ProductListSection
4. OrderActionsBar

## Files to Modify

### Primary Files:
1. `/app/dashboard/orders/create/page.tsx`
2. `/app/dashboard/orders/edit/[id]/page.tsx`
3. `/app/dashboard/orders/[id]/page.tsx` (2000+ lines - needs major refactoring)
4. `/app/dashboard/orders/[id]/components/admin/AdminProductCard.tsx`
5. `/app/dashboard/orders/[id]/components/manufacturer/ManufacturerProductCard.tsx`
6. `/app/dashboard/orders/page.tsx` (listing page)

### New Components to Create:
1. `/app/dashboard/orders/components/shared/ProductCard.tsx`
2. `/app/dashboard/orders/components/shared/CollapsedProductView.tsx`
3. `/app/dashboard/orders/components/shared/OrderSampleCard.tsx`
4. `/app/dashboard/orders/components/shared/ProductPricingDisplay.tsx`
5. `/app/dashboard/orders/[id]/hooks/useProductRouting.ts`

## Header Comment Template

Every file should start with:

```typescript
/**
 * [Page/Component Name] - [Route if applicable]
 * [Brief description of what this file does]
 * Roles: [Which user roles use this]
 * Last Modified: December 2024
 */
```

Examples:
```typescript
/**
 * Orders List Page - /dashboard/orders
 * Displays all orders with tabbed interface for different order states
 * Roles: Admin, Super Admin, Manufacturer
 * Last Modified: December 2024
 */

/**
 * ProductCard Component
 * Shared product display component for create/edit/view modes
 * Roles: All
 * Last Modified: December 2024
 */
```

## Instructions for Starting the Refactor

### For Claude (Copy this when starting new chat):
```
I need to refactor the Factory Orders system. Please review these project files:
- PROJECT_STATUS_CURRENT.md
- TECHNICAL_DOCUMENTATION.md
- USER_GUIDE.md
- REFACTORING_PLAN.md (this document)

CRITICAL: Let's start with Phase 0 - fixing product visibility in tabs. Currently products disappear when routed, but with our new tab system they should remain visible as read-only. This is affecting usability right now.

Current behavior: When manufacturer sends products to admin, they disappear from manufacturer's view. Same for admin sending to manufacturer.

Desired behavior: Products stay visible but become read-only when routed to the other party.

After we fix visibility, we'll move to Phase 1: extracting shared components.

The system is currently working in production, so we need to be careful not to break existing functionality.
```

## Implementation Strategy

### Day 1 (First Session):
1. Download fresh code from production
2. Implement Phase 0 (Visibility Fix)
3. Test thoroughly
4. Deploy if stable

### Day 2:
1. Phase 1 - Extract shared components
2. Test each component
3. Update all references

### Day 3:
1. Phase 2 - Order-level sample request
2. Database migration
3. Update all forms

### Day 4:
1. Phase 3 - Clean up order detail page
2. Final testing
3. Production deployment

## Time Estimates
- **Phase 0** (Visibility Fix): 1-2 hours
- **Phase 1** (Extract Components): 2-3 hours  
- **Phase 2** (Sample Request): 2-3 hours
- **Phase 3** (Clean Up): 1-2 hours
- **Testing & Deployment**: 1 hour
- **Total**: ~8-10 hours

## Testing Checklist

### Phase 0 Testing:
- [ ] Products remain visible when routed to other party
- [ ] Read-only state works correctly
- [ ] Visual indicators show correctly
- [ ] Can still edit products routed to me
- [ ] Cannot edit products routed away

### Phase 1 Testing:
- [ ] All components render correctly
- [ ] No functionality lost
- [ ] Create order works
- [ ] Edit order works
- [ ] View order works

### Phase 2 Testing:
- [ ] Sample request at order level works
- [ ] Tech pack uploads work
- [ ] Backwards compatibility maintained
- [ ] Old orders still display correctly

### Phase 3 Testing:
- [ ] All sections load correctly
- [ ] Performance is same or better
- [ ] All user roles work
- [ ] No missing functionality

## Backwards Compatibility Notes

### Important:
1. **Keep all database fields** - Don't delete product-level sample fields
2. **Read both locations** - Check order-level first, fall back to product-level
3. **Save to both** - For transition period, save sample data in both places
4. **Test old orders** - Make sure existing orders still display correctly

### Migration Strategy:
```javascript
// Read sample data - backwards compatible
const getSampleData = (order, products) => {
  // First check order-level (new way)
  if (order.sample_required) {
    return {
      source: 'order',
      sample_fee: order.sample_fee,
      sample_notes: order.sample_notes,
      sample_status: order.sample_status
    };
  }
  
  // Fallback to product-level (old way)
  const productWithSample = products.find(p => p.sample_required);
  if (productWithSample) {
    return {
      source: 'product',
      sample_fee: productWithSample.sample_fee,
      sample_notes: productWithSample.sample_notes,
      sample_status: productWithSample.sample_status
    };
  }
  
  return null;
};
```

## Risk Mitigation

### Before Starting:
1. **Backup database** - Export current data
2. **Document current behavior** - Screenshot key workflows
3. **Note active orders** - List orders in progress
4. **Inform team** - Let users know about updates

### During Development:
1. **Test after each phase** - Don't wait until end
2. **Keep old code commented** - Don't delete immediately
3. **Use feature flags if needed** - Can toggle new/old behavior
4. **Test with real data** - Use copies of production orders

### Rollback Plan:
1. Keep previous deployment ready
2. Document all database changes
3. Have rollback scripts prepared
4. Test rollback procedure

## Success Criteria

### Phase 0 Success:
- Users can see all their products regardless of routing
- Clear visual distinction between editable/read-only
- No confusion about product location

### Phase 1 Success:
- Code is more maintainable
- Less duplication
- Easier to add new features

### Phase 2 Success:
- Sample requests are simpler to manage
- One place for all tech packs
- Better user experience

### Phase 3 Success:
- Faster page loads
- Easier to debug
- Clear code organization

## Notes for Developers

### Key Principles:
1. **Don't break what works** - Test everything
2. **Keep it backwards compatible** - Support old data
3. **Document changes** - Add comments
4. **Think about users** - Make it intuitive

### Communication:
- Update team on progress
- Ask questions if unclear
- Test with multiple user roles
- Get feedback early

### Final Checklist Before Deploy:
- [ ] All tests passing
- [ ] Checked all user roles
- [ ] Backwards compatibility verified
- [ ] Documentation updated
- [ ] Team informed
- [ ] Backup created

---

**Document Version**: 1.0
**Created**: December 2024
**For**: Factory Orders System Refactoring
**Team**: Development Team
