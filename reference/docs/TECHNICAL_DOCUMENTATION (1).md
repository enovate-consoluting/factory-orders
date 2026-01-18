# Technical Documentation - Factory Order Management System
## Version 1.0 - December 2024

---

## ðŸ— SYSTEM ARCHITECTURE

### Technology Stack
```
Frontend:       Next.js 15.5.6 (App Router)
Language:       TypeScript 5.x
Styling:        Tailwind CSS 3.x
Database:       PostgreSQL (via Supabase)
Storage:        Supabase Storage
Deployment:     Vercel
Auth:           localStorage (temporary)
State Mgmt:     React Hooks
```

### System Requirements
- Node.js 18.x or higher
- npm 9.x or higher
- Git
- Modern browser (Chrome, Firefox, Safari, Edge)

---

## ðŸ“‚ PROJECT STRUCTURE

```
factory-orders/
â”œâ”€â”€ app/                          # Next.js App Router
â”‚   â”œâ”€â”€ page.tsx                 # Login page
â”‚   â”œâ”€â”€ globals.css              # Global styles
â”‚   â”œâ”€â”€ layout.tsx               # Root layout
â”‚   â””â”€â”€ dashboard/               # Protected area
â”‚       â”œâ”€â”€ layout.tsx           # Dashboard layout with sidebar
â”‚       â”œâ”€â”€ page.tsx            # Dashboard home
â”‚       â””â”€â”€ orders/             # Orders module
â”‚           â”œâ”€â”€ page.tsx        # Orders list
â”‚           â”œâ”€â”€ create/         # Create order
â”‚           â”œâ”€â”€ edit/[id]/      # Edit draft
â”‚           â””â”€â”€ [id]/           # Order detail
â”‚               â”œâ”€â”€ page.tsx    # Main view
â”‚               â”œâ”€â”€ components/ # Modular components
â”‚               â”œâ”€â”€ hooks/      # Custom hooks
â”‚               â””â”€â”€ types/      # TypeScript types
â”œâ”€â”€ lib/                        # Utilities & Config
â”‚   â”œâ”€â”€ supabase.ts            # Database client
â”‚   â””â”€â”€ utils/                 # Utility functions
â”‚       â”œâ”€â”€ orderUtils.ts      # Order helpers
â”‚       â””â”€â”€ inputStyles.ts     # UI standards
â”œâ”€â”€ public/                     # Static assets
â”œâ”€â”€ .env.local                 # Environment variables
â”œâ”€â”€ package.json               # Dependencies
â”œâ”€â”€ tsconfig.json             # TypeScript config
â””â”€â”€ tailwind.config.js        # Tailwind config
```

---

## ðŸ’¾ DATABASE SCHEMA

### Core Tables

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT CHECK (role IN ('super_admin','admin','order_creator','order_approver','manufacturer','client')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table (main)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL, -- Format: XXX-XXXXXX
  order_name TEXT,
  status TEXT DEFAULT 'draft',
  workflow_status TEXT DEFAULT 'draft',
  is_paid BOOLEAN DEFAULT FALSE,
  client_id UUID REFERENCES clients(id),
  manufacturer_id UUID REFERENCES manufacturers(id),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  client_approved BOOLEAN DEFAULT FALSE,
  manufacturer_accepted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Products (items in order)
CREATE TABLE order_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_order_number TEXT, -- Format: PRD-XXXX
  description TEXT,
  product_status TEXT DEFAULT 'pending',
  is_locked BOOLEAN DEFAULT FALSE,
  
  -- Routing fields
  routed_to TEXT DEFAULT 'admin', -- 'admin' or 'manufacturer'
  routed_by UUID REFERENCES users(id),
  routed_at TIMESTAMPTZ,
  
  -- Sample fields
  sample_required BOOLEAN DEFAULT FALSE,
  sample_fee DECIMAL(10,2),
  sample_eta DATE,
  sample_status TEXT DEFAULT 'pending',
  sample_notes TEXT,
  
  -- Pricing fields (Manufacturer costs)
  shipping_air_price DECIMAL(10,2),
  shipping_boat_price DECIMAL(10,2),
  selected_shipping_method TEXT,
  production_time TEXT,
  product_price DECIMAL(10,2),
  
  -- Client pricing (with markup)
  client_shipping_air_price DECIMAL(10,2),
  client_shipping_boat_price DECIMAL(10,2),
  client_product_price DECIMAL(10,2),
  
  -- Payment & Production
  payment_status TEXT DEFAULT 'unpaid',
  paid_amount DECIMAL(10,2),
  production_start_date DATE,
  production_end_date DATE,
  estimated_completion DATE,
  shipped_date TIMESTAMPTZ,
  
  -- Notes
  manufacturer_notes TEXT,
  internal_notes TEXT,
  client_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items (variants)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_product_id UUID REFERENCES order_products(id) ON DELETE CASCADE,
  variant_combo TEXT NOT NULL,
  quantity INTEGER DEFAULT 0,
  notes TEXT,
  
  -- Status fields
  admin_status TEXT DEFAULT 'pending',
  manufacturer_status TEXT DEFAULT 'pending',
  
  -- Pricing tiers
  manufacturer_standard_price DECIMAL(10,2),
  manufacturer_bulk_price DECIMAL(10,2),
  cost_price DECIMAL(10,2), -- What we pay
  client_price DECIMAL(10,2), -- What client pays
  margin_percentage DECIMAL(5,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Additional tables (simplified list)
- clients
- manufacturers  
- products
- product_variants
- variant_types
- variant_options
- order_media
- audit_log
- notifications
- invoices
- workflow_log
```

---

## ðŸ” AUTHENTICATION & AUTHORIZATION

### Current Implementation (localStorage)
```typescript
// Login
const user = { id, email, name, role };
localStorage.setItem('user', JSON.stringify(user));

// Check auth
const userData = localStorage.getItem('user');
if (!userData) router.push('/');

// Logout
localStorage.removeItem('user');
```

### Role Permissions Matrix
| Feature | Super Admin | Admin | Manufacturer | Client |
|---------|------------|-------|--------------|--------|
| View all orders | âœ… | âœ… | âŒ | âŒ |
| Create orders | âœ… | âœ… | âŒ | âŒ |
| Edit orders | âœ… | âœ… | âŒ | âŒ |
| Delete orders | âœ… | Draft only | âŒ | âŒ |
| View costs | âœ… | âŒ | âœ… (own) | âŒ |
| View client prices | âœ… | âœ… | âŒ | âœ… |
| Set manufacturer prices | âŒ | âŒ | âœ… | âŒ |
| Set client prices | âœ… | âœ… | âŒ | âŒ |
| Change order client | âœ… | âœ… | âŒ | âŒ |
| Show all products | âœ… | âŒ | âŒ | âŒ |
| Route products | âœ… | âœ… | âœ… | âŒ |

---

## ðŸš€ DEPLOYMENT

### Environment Variables
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
# Optional for email
RESEND_API_KEY=[key]
RESEND_FROM_EMAIL=[email]
```

### Local Development
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Test production build
npm start
```

### Production Deployment (Vercel)

#### Automatic Deployment
```bash
# Every push to main branch triggers deployment
git add .
git commit -m "feat: your feature"
git push origin main
```

#### Pre-Deployment Checklist
1. âœ… Run `npm run build` locally
2. âœ… Test all critical paths
3. âœ… Check TypeScript errors
4. âœ… Verify environment variables
5. âœ… Review console for warnings

#### Build Error Solutions
```typescript
// Common TypeScript fixes

// 1. Interface conflicts
interface OrderWithDetails {
  id: string;
  // Define all properties explicitly
}

// 2. Missing type arguments
attachments?: Array<any>; // Add type

// 3. Optional chaining for safety
const name = order?.client?.name || 'Unknown';

// 4. Environment variable checks
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('Supabase URL not configured');
}
```

### Emergency Rollback
```bash
# View commit history
git log --oneline

# Revert last commit
git revert HEAD
git push origin main

# OR reset to specific commit
git reset --hard [commit-hash]
git push origin main --force
```

---

## ðŸ”„ API & DATA FLOW

### Data Operations

#### Fetching Orders
```typescript
const { data, error } = await supabase
  .from('orders')
  .select(`
    *,
    client:clients(*),
    manufacturer:manufacturers(*),
    order_products(
      *,
      product:products(*),
      order_items(*),
      order_media(*)
    )
  `)
  .order('created_at', { ascending: false });
```

#### Creating Order
```typescript
// 1. Create order
const { data: order } = await supabase
  .from('orders')
  .insert({
    order_number: generateOrderNumber(),
    client_id,
    manufacturer_id,
    status: 'draft'
  })
  .select()
  .single();

// 2. Add products
const { data: products } = await supabase
  .from('order_products')
  .insert(productData);

// 3. Add items (variants)
const { data: items } = await supabase
  .from('order_items')
  .insert(itemData);
```

#### Product Routing
```typescript
// Route to manufacturer
await supabase
  .from('order_products')
  .update({
    routed_to: 'manufacturer',
    routed_by: userId,
    routed_at: new Date().toISOString(),
    product_status: 'pending_manufacturer'
  })
  .eq('id', productId);
```

---

## ðŸŽ¨ UI/UX STANDARDS

### Input Styles (from inputStyles.ts)
```typescript
import { inputClassName, selectClassName } from '@/lib/utils/inputStyles';

// Standard input
<input className={inputClassName} />

// Standard select  
<select className={selectClassName} />

// Key rules:
// - text-gray-900 for input text
// - placeholder-gray-500 for placeholders
// - Never use gray-400 or lighter for text
```

### Color Scheme
- **Primary**: Blue-600 (#2563eb)
- **Success**: Green-600 (#16a34a)
- **Warning**: Yellow-600 (#ca8a04)
- **Danger**: Red-600 (#dc2626)
- **Text**: Gray-900 (#111827)
- **Muted**: Gray-500 (#6b7280)
- **Border**: Gray-300 (#d1d5db)
- **Background**: White (#ffffff)

### Component Patterns
```typescript
// Status Badge
<StatusBadge status="draft" />

// Product Card
<AdminProductCard product={} items={} media={} />
<ManufacturerProductCard product={} items={} media={} />

// Modals
<RouteModal isOpen={} onClose={} product={} />
<HistoryModal isOpen={} onClose={} productId={} />
```

---

## ðŸ› TROUBLESHOOTING

### Common Issues & Solutions

#### 1. Build Fails on Vercel
```bash
# Local test
npm run build

# Common fixes:
- Check for unused imports
- Fix TypeScript errors
- Ensure all env variables are set in Vercel
```

#### 2. Supabase Connection Issues
```typescript
// Check connection
const { data, error } = await supabase
  .from('users')
  .select('count');
  
if (error) console.error('DB connection failed:', error);
```

#### 3. Authentication Problems
```javascript
// Clear and re-login
localStorage.clear();
window.location.href = '/';
```

#### 4. Missing Data in UI
- Check role permissions
- Verify product routing (routed_to field)
- Check filter conditions
- Review console for errors

---

## ðŸ§ª TESTING

### Test Accounts
```
super_admin@test.com / password123
admin@test.com / password123
manufacturer@test.com / password123
client@test.com / password123
```

### Critical Test Paths
1. **Order Creation Flow**
   - Login as admin
   - Create new order
   - Add products and variants
   - Save as draft
   - Submit to manufacturer

2. **Manufacturer Flow**
   - Login as manufacturer
   - View assigned orders
   - Set pricing
   - Route back to admin

3. **Client Approval Flow**
   - Login as client
   - View orders
   - Approve order

### Browser Testing
- âœ… Chrome (latest)
- âœ… Firefox (latest)
- âœ… Safari (latest)
- âœ… Edge (latest)
- âš ï¸ Mobile (responsive, not optimized)

---

## ðŸ“ˆ PERFORMANCE

### Current Metrics
- **Build time**: ~45 seconds
- **Page load**: <2 seconds
- **Database queries**: Optimized with relations
- **Bundle size**: Standard Next.js

### Optimization Tips
1. Use dynamic imports for large components
2. Implement pagination for large lists
3. Cache frequently accessed data
4. Use Supabase real-time for updates

---

## ðŸ”§ MAINTENANCE

### Regular Tasks
- **Daily**: Monitor Vercel dashboard
- **Weekly**: Check error logs
- **Monthly**: Database backup
- **Quarterly**: Dependency updates

### Update Dependencies
```bash
# Check outdated
npm outdated

# Update all
npm update

# Update specific
npm install package@latest
```

---

## ðŸ“ž SUPPORT

### Known Issues
1. Media upload - needs testing
2. Email notifications - not configured
3. Mobile optimization - needs work

### Future Enhancements
1. Supabase Auth integration
2. Excel/PDF export
3. Dashboard analytics
4. Bulk operations
5. Advanced search

---

**Document Version**: 1.0
**Last Updated**: December 2024
**Next Review**: January 2025