# CLAUDE.md - Factory Orders Management System
# Last Updated: January 2025

## Quick Start

```bash
# Development
npm run dev

# ALWAYS before pushing
npm run build

# Deploy
git add .
git commit -m "type: description"
git push
```

---

## Project Overview

**Factory Order Management System** - Multi-role order tracking system for manufacturing workflow.

| Tech | Version |
|------|---------|
| Framework | Next.js 15.5.6 (App Router) |
| Language | TypeScript |
| Database | Supabase PostgreSQL |
| Styling | Tailwind CSS |
| Deployment | Vercel |
| Auth | localStorage (temporary) |

---

## Developer Environment

- **OS:** Windows 11
- **Terminal:** cmd or PowerShell
- **Use Windows commands:** `del` not `rm`, `type` not `cat`
- **Package Manager:** npm
- **Node:** 18.x+

---

## User Roles & Permissions

| Role | See Costs | See Client Prices | Create Orders | Delete Orders |
|------|-----------|-------------------|---------------|---------------|
| Super Admin | ✅ | ✅ | ✅ | ✅ Any |
| Admin | ❌ | ✅ | ✅ | Drafts only |
| Manufacturer | ✅ Own | ❌ | ❌ | ❌ |
| Client | ❌ | ✅ Own | ❌ | ❌ |

**Test Credentials:**
- Super Admin: admin@test.com / password123
- Manufacturer: manufacturer@test.com / password123

---

## Code Rules (CRITICAL)

### 1. Never Remove Existing Functionality
- Only ADD to existing code unless explicitly asked
- Keep all existing imports until confirmed unused
- Preserve all props and interfaces
- ASK if unsure about removing something

### 2. File Headers Required
Every file must start with:
```typescript
/**
 * [Component/Page Name] - [Route if applicable]
 * [Brief description]
 * Roles: [Which user roles use this]
 * Last Modified: [Month Year]
 */
```

### 3. Build Before Push
```bash
npm run build  # Must pass before git push
```

### 4. Display Rules
- DEBUG displays (margins, prices, internal info) = **Super Admin ONLY**
- Use proper text labels, not database tags (e.g., "Sample Tech" not "sampletech")

### 5. TypeScript
- Use explicit types, avoid `any`
- Use interfaces for props
- Handle null/undefined with optional chaining

### 6. Styling
- Tailwind CSS only
- Use `inputStyles.ts` for form inputs
- Colors: blue-600 (primary), gray-900 (text), gray-500 (muted)

---

## Project Structure

```
factory-orders/
├── app/
│   ├── page.tsx                    # Login
│   ├── globals.css
│   ├── layout.tsx
│   └── dashboard/
│       ├── layout.tsx              # Sidebar layout
│       ├── page.tsx                # Dashboard home
│       └── orders/
│           ├── page.tsx            # Orders list (tabbed)
│           ├── create/page.tsx     # Create order
│           ├── edit/[id]/page.tsx  # Edit draft
│           └── [id]/
│               ├── page.tsx        # Order detail (~1500 lines)
│               ├── components/
│               │   ├── admin/      # AdminProductCard
│               │   ├── manufacturer/
│               │   ├── client/
│               │   └── shared/     # VariantTable, etc.
│               └── hooks/          # useSampleRouting, etc.
├── lib/
│   ├── supabase.ts                 # Database client
│   ├── client-portal/
│   │   └── api.ts                  # Client Portal sync
│   └── utils/
│       ├── inputStyles.ts          # Form styling
│       └── orderUtils.ts           # Order helpers
├── reference/docs/                           # Detailed documentation
└── CLAUDE.md                       # This file
```

---

## Database Tables (Key)

| Table | Purpose |
|-------|---------|
| users | System users with roles |
| clients | Customer accounts |
| manufacturers | Production partners |
| orders | Main order records |
| order_products | Products in orders (routing, pricing) |
| order_items | Variant combinations (sizes, colors) |
| products | Product catalog |
| audit_log | Change history |
| notifications | User notifications |

### Order Product Key Fields
```sql
routed_to           -- 'admin' or 'manufacturer'
product_status      -- 'pending', 'priced', 'approved'
sample_required     -- boolean
sample_routed_to    -- independent sample routing
product_price       -- manufacturer cost
client_product_price -- client price (with markup)
```

---

## Order Workflow

```
DRAFT → SUBMITTED_TO_MANUFACTURER → PRICED_BY_MANUFACTURER → 
SUBMITTED_TO_CLIENT → CLIENT_APPROVED → READY_FOR_PRODUCTION → 
IN_PRODUCTION → COMPLETED
```

### Product Routing Flow
```
Admin Creates → Routes to Manufacturer → Manufacturer Prices → 
Routes to Admin → Admin Reviews → Production → Ships → Complete
```

---

## Current Status (January 2025)

### ✅ Working in Production
- Multi-role authentication
- Complete order CRUD
- Product routing system
- Dual pricing (cost vs client)
- Notification system
- Audit logging
- Sample request routing (independent)
- Tabbed order listing
- Client Portal sync (auto-sync clients on creation)

### 🔄 In Progress (Phase 2)
- Extract shared components to reduce duplication
- ManufacturerProductCard: ~1,100 lines
- AdminProductCard: ~900 lines
- Goal: Create SharedVariantTable, SharedShippingSection, etc.

### ⏳ Planned
- Phase 3: Base ProductCard component
- Phase 4: Simplify Order Detail page
- Real authentication (Supabase Auth)
- Export to Excel/PDF

---

## Environment Variables

**Local:** `.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
RESEND_API_KEY=         # Email (optional)
TEXTBELT_API_KEY=       # SMS (optional)
CLIENT_PORTAL_API_URL=  # Client Portal sync (production only)
FACTORY_SYNC_API_KEY=   # API key for Portal sync
```

**Vercel:** Add same vars in Dashboard → Settings → Environment Variables

---

## Client Portal Integration

When clients are created in Factory Orders, they sync to the Client Portal database.

**File:** `lib/client-portal/api.ts`

**Endpoint:** `POST {CLIENT_PORTAL_API_URL}/api/sync-client`

**Payload sent:**
```json
{
  "name": "Company Name",
  "contact_name": "Company Name",
  "email": "contact@company.com",
  "phone_number": "+1-555-0123",
  "logo_url": "https://...",
  "source": "factory_orders"
}
```

**Auth:** `X-API-Key` header with `FACTORY_SYNC_API_KEY`

**Notes:**
- Sync is non-blocking (client created locally even if sync fails)
- Only works in production (env vars not set for local dev)
- Replaces old Scanacart integration (removed January 2025)

---

## Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Test production build
npm start               # Run production locally

# Git
git status
git add .
git commit -m "feat: description"
git push origin main    # Triggers Vercel deploy

# Database (if needed)
# Access via Supabase Dashboard
```

---

## Troubleshooting

### Build Fails
```bash
npm run build  # Check error output
# Common fixes:
# - Add type annotations
# - Fix interface conflicts
# - Add optional chaining for nullable
```

### Vercel Deploy Fails
1. Check Vercel logs for specific error
2. Reproduce locally with `npm run build`
3. Verify env vars in Vercel dashboard

### Data Not Showing
- Check role permissions
- Verify `routed_to` field for products
- Check browser console for errors

---

## Session Handoff Template

When starting new chat:
```
Continue Factory Orders project.

LAST COMPLETED: [what was done]
CURRENT ISSUE: [any errors or problems]
NEXT TASK: [what to work on]

Key files:
- CLAUDE.md (project rules)
- reference/docs/REFACTORING_PLAN.md (current phases)
```

---

## Detailed Documentation

See `/reference/docs/` folder for:
- `TECHNICAL_DOCUMENTATION.md` - Full technical specs
- `USER_GUIDE.md` - End user instructions
- `DEPLOYMENT_GUIDE.md` - Deployment procedures
- `REFACTORING_PLAN.md` - Current refactoring phases
- `PROJECT_STATUS.md` - Feature completion status

---

## Key Contacts

**Maintainer:** Edward Ojeda

---

*This file is the single source of truth for Claude Code. Keep it updated.*

