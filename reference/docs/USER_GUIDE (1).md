# User Guide - Factory Order Management System
## Version 1.0 - December 2024

---

## ðŸŽ¯ GETTING STARTED

### System Access
1. Navigate to the system URL
2. Enter your email and password
3. Click "Sign In"
4. You'll be directed to your dashboard based on your role

### First Time Setup
- **Super Admin**: Can create all user types
- **Admin**: Can create clients and manufacturers
- **All Users**: Should update their profile information

---

## ðŸ‘¥ USER ROLES & CAPABILITIES

### Super Admin
**Purpose**: Complete system control with financial visibility

**Can Do**:
- Everything an Admin can do
- View cost prices and profit margins
- Delete any order (not just drafts)
- Show/hide all products including those with manufacturer
- Override any system restriction
- Access all financial data

**Cannot Do**:
- Nothing - full system access

---

### Admin
**Purpose**: Manage orders and coordinate between clients and manufacturers

**Can Do**:
- Create, edit, and submit orders
- Delete draft orders only
- Manage products and variants
- Manage clients and manufacturers
- Route products between parties
- Set client pricing (markup)
- Change order clients
- View client prices (not costs)

**Cannot Do**:
- See manufacturer cost prices
- Delete submitted orders
- View profit margins

---

### Manufacturer
**Purpose**: Handle production and pricing

**Can Do**:
- View orders assigned to them
- Set product pricing (costs)
- Update production status
- Upload samples
- Route products back to admin
- Mark items as shipped

**Cannot Do**:
- Create or delete orders
- See client pricing
- Access orders not assigned to them
- Edit order details

---

### Client
**Purpose**: Review and approve orders

**Can Do**:
- View their own orders
- Approve/reject orders
- View client pricing
- Add comments
- Download order documents

**Cannot Do**:
- Create or edit orders
- See cost prices
- Access other clients' orders
- Change order details

---

## ðŸ“‹ COMMON WORKFLOWS

### Creating a New Order (Admin/Super Admin)

1. **Start New Order**
   - Click "Orders" in sidebar
   - Click "New Order" button
   - Select Client and Manufacturer

2. **Add Products**
   - Click "Add Product"
   - Select or create product
   - Add description
   - Configure variants (Size, Color, etc.)

3. **Set Quantities**
   - For each variant combination
   - Enter required quantity
   - Add any notes

4. **Save or Submit**
   - "Save as Draft" - keeps order editable
   - "Submit to Manufacturer" - sends for pricing

---

### Processing Orders as Manufacturer

1. **View Assigned Orders**
   - Login to see orders routed to you
   - Only see products assigned to you
   - Double-click order to open

2. **Set Pricing**
   - Enter product base price
   - Set shipping costs (air/boat)
   - Add sample fee if required
   - Enter production time

3. **Route Back**
   - Click "Save All & Route"
   - Choose "Send to Admin"
   - Add any notes

---

### Order Approval as Client

1. **Review Order**
   - Check products and quantities
   - Review pricing
   - Check delivery timeline

2. **Approve or Reject**
   - Click "Approve Order" to proceed
   - Click "Request Changes" to send back
   - Add comments as needed

---

## ðŸ”§ FEATURES GUIDE

### Order List Features

#### Double-Click Navigation
- Double-click any order row to open it
- Single-click expand arrow to see products
- Use eye icon for traditional navigation

#### Filtering & Search
- Search by order number, client, or manufacturer
- Filter by status (Draft, In Progress, Completed)
- Results update instantly

#### Product Expansion
- Click arrow to expand/collapse products
- See product routing status
- View which party has each product

---

### Order Detail Features

#### Changing Client (Admin/Super Admin)
1. Click edit icon next to client name
2. Select new client from dropdown
3. Click Save
4. Order number prefix updates automatically

#### Show All Products (Super Admin Only)
1. Click "Show All Products" button
2. View products with manufacturer
3. Edit manufacturer products directly
4. Click "Hide Manufacturer Products" to return

#### Product Routing
1. Individual: Click route icon on product
2. Bulk: Click "Save All & Route"
3. Select destination
4. Add notes (optional)
5. Confirm routing

#### Status Management
- **Draft**: Editable, not sent
- **Submitted**: With manufacturer for pricing
- **Priced**: Pricing complete
- **Approved**: Client approved
- **In Production**: Being manufactured
- **Shipped**: In transit
- **Completed**: Delivered

---

## ðŸ’° PRICING SYSTEM

### For Manufacturers
- Enter your cost prices
- These are your actual costs
- Admin adds markup for client

### For Admins
- See client prices (with markup)
- Cannot see manufacturer costs
- Can adjust client pricing

### For Super Admins
- See both cost and client prices
- View profit margins
- Full financial visibility

### For Clients
- See final prices only
- No visibility of costs or margins
- Clear total amounts

---

## ðŸ”” NOTIFICATIONS

### Bell Icon
- Shows unread count
- Click to view notifications
- Click notification to mark as read

### Notification Types
- Order status changes
- Products routed to you
- Pricing updates
- Approval requests

---

## ðŸ“Š PRODUCT STATUS INDICATORS

### Status Badges
- ðŸ”µ **Pending**: Awaiting action
- ðŸŸ¡ **In Review**: Being processed
- ðŸŸ¢ **Approved**: Ready to proceed
- ðŸ”´ **Rejected**: Needs revision
- âš« **Completed**: Finished

### Routing Indicators
- ðŸ‘¥ **With Admin**: Admin has product
- ðŸ­ **With Manufacturer**: Manufacturer has product
- âœ… **In Production**: Being made
- ðŸ“¦ **Shipped**: In transit

---

## âŒ¨ï¸ KEYBOARD SHORTCUTS

- **Double-click**: Open order
- **Escape**: Close modals
- **Enter**: Submit forms
- **Tab**: Navigate fields

---

## ðŸ“± MOBILE USAGE

### Responsive Design
- All features work on mobile
- Cards stack vertically
- Touch-friendly buttons
- Swipe to see more

### Best Practices
- Use landscape for tables
- Portrait for forms
- Pinch to zoom if needed

---

## ðŸ” SEARCH TIPS

### Order Search
- Use partial order numbers: "001" finds "HAL-001234"
- Search by client name
- Search by manufacturer
- Case-insensitive

### Quick Filters
- Status dropdown for quick filtering
- Combine search and filters
- Clear filters to reset

---

## ðŸ’¾ DATA MANAGEMENT

### Saving Work
- Changes save automatically in most cases
- Look for "Save" buttons on forms
- Draft orders can be edited multiple times

### File Uploads
- Click "Upload" or drag files
- Supported: Images, PDFs, Documents
- Max size: 10MB per file

---

## âš ï¸ TROUBLESHOOTING

### Can't See Orders
- Check your role permissions
- Manufacturers only see assigned orders
- Clients only see their orders
- Check filters aren't hiding results

### Can't Edit Order
- Only drafts are editable
- Check your permissions
- Submitted orders are locked
- Contact admin for changes

### Missing Products
- Check product routing status
- Products with manufacturer are hidden from admin
- Super admin can show all products
- Check expansion arrows

### Login Issues
- Clear browser cache
- Check credentials
- Contact admin for password reset

---

## ðŸ“ž GETTING HELP

### In-System Help
- Hover over icons for tooltips
- Look for help icons
- Check status messages

### Common Questions

**Q: Why can't I see all products?**
A: Products are routed between admin and manufacturer. You only see products currently with you.

**Q: How do I change an order after submission?**
A: Contact admin for changes to submitted orders.

**Q: Why did the order number change?**
A: Order numbers update when client changes (prefix updates to match client).

**Q: Can I bulk update products?**
A: Yes, use "Save All & Route" for bulk operations.

---

## ðŸŽ¯ BEST PRACTICES

### For Admins
1. Keep orders organized with clear names
2. Double-check client/manufacturer selection
3. Review pricing before sending to client
4. Use notes to communicate clearly

### For Manufacturers  
1. Set pricing promptly
2. Update production status regularly
3. Communicate issues early
4. Use routing to move workflow forward

### For Clients
1. Review orders thoroughly
2. Approve or request changes quickly
3. Use comments for clarification
4. Check notifications regularly

---

## ðŸ“… REGULAR TASKS

### Daily
- Check notifications
- Review pending orders
- Update production status
- Respond to requests

### Weekly
- Review all active orders
- Clear completed notifications
- Update product catalog
- Check for system updates

### Monthly
- Archive completed orders
- Review user access
- Update pricing lists
- Generate reports

---

**Need More Help?**
Contact your system administrator or super admin for additional assistance.

**Version**: 1.0
**Updated**: December 2024