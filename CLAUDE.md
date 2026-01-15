# CLAUDE.md - Factory Orders Management System
# Last Updated: January 14, 2025

## Quick Start

```bash
# Development (local database)
npm run dev

# Development with PRODUCTION data (preferred for testing)
npm run dev:prod

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

### Dev Machine Specs (January 2025)
- **RAM:** 64GB DDR5 6000MHz CL38 (TEAMGROUP T-Force Delta RGB)
  - Upgraded from 32GB (2x16GB) to 64GB (2x32GB)
- **Check RAM:** `wmic memorychip get capacity, speed, manufacturer`

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
- Notification system (with product numbers & click-to-navigate)
- Audit logging
- Sample request routing (independent)
- Tabbed order listing
- Client Portal sync (auto-sync clients on creation)
- Eddie AI Assistant (with ElevenLabs voice)
- Special Access permissions (Factory/Admin toggle, AI Assistant)
- Tracking numbers with carrier links (DHL, UPS, FedEx, USPS)
- Arrival Alert Bar (inventory check-in notifications)
- Mobile-optimized UI (44px touch targets, responsive design)
- Sample Fee Invoice System (order-level fees, payment tracking)
- Square Webhook Integration (auto-mark invoices/sample fees as paid)

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
- **Eddie AI Enhancements:**
  - Order creation via conversation
  - More natural dialogue flow
  - Additional voice options/accents
  - Query history/favorites

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
ANTHROPIC_API_KEY=      # Claude AI for Eddie assistant
Birdhaus_Voice=         # ElevenLabs API for Eddie's voice
SQUARE_ACCESS_TOKEN=    # Square API for payments
SQUARE_ENVIRONMENT=     # 'sandbox' or 'production'
SQUARE_WEBHOOK_SIGNATURE_KEY=  # Square webhook signature verification
```

**Vercel:** Add same vars in Dashboard → Settings → Environment Variables

---

## Eddie - AI Assistant

A floating AI chat assistant that helps users with orders, statistics, and navigation.

### Access Control
- **Visible to:** Super Admin, Admin, or users with `can_access_ai_assistant = true`
- **Toggle access:** User Management → Edit User → Special Access → AI Assistant checkbox
- Only Super Admin can see/modify Special Access settings

### Features
- Floating chat bubble (bottom-right corner)
- Voice input (microphone button) - uses Web Speech API
- Voice output (speaker) - uses ElevenLabs TTS
- Natural language queries about orders, clients, products
- Quick action buttons for navigation

### Files
- `app/dashboard/components/AiAssistant.tsx` - Main component
- `app/api/assistant/route.ts` - Claude AI backend
- `app/api/tts/route.ts` - ElevenLabs text-to-speech

### Environment Variables
```
ANTHROPIC_API_KEY=       # Claude API for AI responses
Birdhaus_Voice=          # ElevenLabs API key for TTS
```

### ElevenLabs TTS Configuration
- **Model:** `eleven_turbo_v2_5` (free tier compatible)
- **Default Voice:** Daniel (voice ID: `onwK4e9ZLuTAKqWW03F9`)
- **Fallback Voice:** Adam (voice ID: `pNInz6obpgDQGcFmaJgB`)
- **Fallback:** Web Speech API if ElevenLabs unavailable

### Changing Eddie's Voice
1. Browse voices at [ElevenLabs Voice Library](https://elevenlabs.io/voice-library)
2. Copy the voice ID
3. Update `DEFAULT_VOICE_ID` in `app/api/tts/route.ts`

### Database Fields (users table)
```sql
can_access_ai_assistant BOOLEAN DEFAULT false  -- Controls Eddie visibility
can_access_factory_admin_toggle BOOLEAN DEFAULT false  -- Controls Factory/Admin toggle
```

---

## Notification Bell

Enhanced notification system for all user roles.

### Features
- **Product Order Number Display**: Shows product number prominently (e.g., "PO-001")
- **Order Reference**: Shows order number in parentheses
- **Click Navigation**: Click any notification to mark as read AND navigate to order
- **External Link Icon**: Visual indicator that notification is clickable
- **Real-time Updates**: Subscribes to database changes

### Database Tables
- `notifications` - For admins/super admins (joins to orders, order_products)
- `manufacturer_notifications` - For manufacturers (joins to orders, order_products)

### How It Works
1. Click notification bell to see dropdown
2. Each notification shows product order number + order number
3. Click notification → marks as read + navigates to order
4. After refresh, read notifications don't appear

---

## Tracking Numbers

Displays shipping tracking numbers with clickable carrier links.

### Supported Carriers
- **DHL**: `https://www.dhl.com/us-en/home/tracking.html?tracking-id={number}`
- **UPS**: `https://www.ups.com/track?tracknum={number}`
- **FedEx**: `https://www.fedex.com/fedextrack/?trknbr={number}`
- **USPS**: `https://tools.usps.com/go/TrackConfirmAction?tLabels={number}`

### Where Displayed
- Orders List page (desktop table + mobile cards)
- Invoices List page
- Expanded product rows

### Database Fields (order_products table)
```sql
tracking_number VARCHAR     -- The tracking number
shipping_carrier VARCHAR    -- 'dhl', 'ups', 'fedex', 'usps'
```

---

## Arrival Alert Bar

Red notification banner for admins when inventory items are checked in.

### Features
- **Per-User Dismissal**: Each admin sees their own notifications
- **Red Banner**: Appears at top of dashboard below header
- **Expandable List**: Double-click or click "View Details" to see all arrivals
- **Quick Actions**: View Inventory (opens in new tab), Dismiss All
- **Confirmation**: "Clear all?" confirmation before dismissing all

### Visibility
- Admin and Super Admin only
- Automatically hidden when no notifications

### Database Table: `arrival_notifications`
```sql
id UUID PRIMARY KEY
user_id UUID             -- Which admin this notification is for
inventory_id UUID        -- Link to inventory item
product_name VARCHAR
order_number VARCHAR
client_name VARCHAR
received_at TIMESTAMP
received_by_name VARCHAR
rack_location VARCHAR
total_quantity INTEGER
dismissed BOOLEAN
dismissed_at TIMESTAMP
```

### File
- `app/dashboard/components/ArrivalAlertBar.tsx`

---

## Sample Fee Invoice System

Order-level sample fees on invoices with payment tracking.

### How It Works
1. **Order has sample fee** → `client_sample_fee` field on `orders` table
2. **Create Invoice** → Sample fee shows at TOP with checkbox
3. **Can send invoice with ONLY sample fee** (no products required)
4. **Mark as Paid** → Click "Mark as Paid Manually" → Confirm → Saves who/when
5. **Already Paid** → Shows green with ✓, "PAID" badge, doesn't add to total

### Invoice Creation UI
- **Unpaid Sample Fee**: Amber/gold row, checkbox to include, "Mark as Paid Manually" link
- **Paid Sample Fee**: Green row, ✓ checkmark, "PAID" badge, strikethrough price, shows date/who paid

### Database Fields (orders table)
```sql
client_sample_fee NUMERIC           -- Amount client pays for sample
sample_fee NUMERIC                   -- Manufacturer cost
sample_notes TEXT                    -- Description/breakdown
sample_fee_paid BOOLEAN DEFAULT false
sample_fee_paid_at TIMESTAMP
sample_fee_paid_by UUID              -- FK to users
sample_fee_paid_by_name TEXT         -- Display name
sample_fee_invoice_id UUID           -- FK to invoices (linked when invoice sent)
```

### Key Files
- `app/dashboard/invoices/create/page.tsx` - Invoice creation with sample fee UI
- `app/api/square/webhook/route.ts` - Square payment webhook (auto-marks paid)

### Flow
```
Order Created → Sample Fee Set → Create Invoice →
Check Sample Fee → Send Invoice → Client Pays via Square →
Webhook Marks Paid → Next Invoice Won't Show Sample Fee
```

---

## Square Webhook Integration

Auto-marks invoices and sample fees as paid when Square payment completes.

### Endpoint
`POST /api/square/webhook`

### Events Handled
- `payment.completed` - Main payment success event
- `payment.updated` - Payment status changes

### How It Works
1. Square sends webhook when payment completes
2. Webhook verifies HMAC SHA256 signature
3. Finds invoice by `square_checkout_id` OR by parsing invoice number from line items
4. Updates invoice: `status='paid'`, `paid_amount`, `paid_at`, `square_transaction_id`
5. If invoice is linked to sample fee (`sample_fee_invoice_id`), marks sample fee as paid

### Signature Verification
```typescript
const hmac = crypto.createHmac('sha256', signatureKey);
hmac.update(rawBody);
const expectedSignature = hmac.digest('base64');
// Compare with x-square-hmacsha256-signature header
```

### Environment Variables
```
SQUARE_ACCESS_TOKEN=           # For API calls to Square
SQUARE_ENVIRONMENT=            # 'sandbox' or 'production'
SQUARE_WEBHOOK_SIGNATURE_KEY=  # From Square webhook setup
```

### File
- `app/api/square/webhook/route.ts`

### Testing
- GET `/api/square/webhook` returns setup instructions and status
- Check Vercel Functions logs for webhook activity

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

## Latest Session (January 14, 2025)

### Completed This Session
1. **Sample Fee on Invoices** - Order-level sample fee (`client_sample_fee`) now shows on invoice creation
   - Shows at TOP of invoice with amber/gold styling
   - Includes `sample_notes` description
   - Has checkbox to include/exclude
2. **Send Invoice with Only Sample Fee** - Fixed validation so you can send invoice with just sample fee (no products required)
3. **Sample Fee Payment Tracking** - Added manual "Mark as Paid" functionality
   - Click "Mark as Paid Manually" → Confirm dialog → Saves to database
   - Shows PAID status with date and who marked it
   - Paid sample fees show green, strikethrough, don't add to total
4. **Database Migration** - Added fields: `sample_fee_paid`, `sample_fee_paid_at`, `sample_fee_paid_by`, `sample_fee_paid_by_name`, `sample_fee_invoice_id`
5. **Invoice Linking** - When invoice with sample fee is sent, links `sample_fee_invoice_id`
6. **Square Webhook** - Added webhook endpoint to auto-mark sample fee as paid when Square payment completes

### Files Modified This Session
- `app/dashboard/invoices/create/page.tsx` - Sample fee UI, payment tracking, validation fixes
- `app/api/square/webhook/route.ts` - NEW: Square payment webhook
- `CLAUDE.md` - Documentation updates

### Database Changes
```sql
-- Added to orders table
sample_fee_paid BOOLEAN DEFAULT false
sample_fee_paid_at TIMESTAMP WITH TIME ZONE
sample_fee_paid_by UUID REFERENCES users(id)
sample_fee_paid_by_name TEXT
sample_fee_invoice_id UUID REFERENCES invoices(id)
```

### Square Webhook Setup ✅ COMPLETED
1. Square Developer Dashboard → Webhooks → "Factory Orders Payments"
2. Endpoint: `https://factory-orders.vercel.app/api/square/webhook`
3. Subscribed to: `payment.completed`
4. Signature key added to Vercel: `SQUARE_WEBHOOK_SIGNATURE_KEY`

### How Square Webhook Works
```
Customer Pays Invoice via Square → Square sends payment.completed event →
Webhook receives & verifies signature → Finds invoice by checkout ID or invoice number →
Marks invoice as paid → If linked to sample fee, marks sample fee as paid
```

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

