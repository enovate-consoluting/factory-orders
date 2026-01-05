# Auth Module

A reusable authentication module for Next.js applications with Supabase.

## Features

- **Secure password hashing** with bcrypt
- **Session management** with localStorage
- **Password reset** with secure tokens
- **Role-based permissions**
- **Supports both hashed and legacy plain text passwords** (for migration)

## Installation

### 1. Copy the auth folder

Copy the entire `lib/auth/` folder to your new project.

### 2. Install dependencies

```bash
npm install bcryptjs @supabase/supabase-js
npm install -D @types/bcryptjs
```

### 3. Configure environment variables

Add these to your `.env.local`:

```env
# Required - Supabase connection
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Required for server-side operations (API routes)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Required for password reset emails
NEXT_PUBLIC_BASE_URL=http://localhost:3000
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

## Usage

### Login

```tsx
import { loginUser } from '@/lib/auth';

const handleLogin = async () => {
  const result = await loginUser({
    email: 'user@example.com',
    password: 'password123',
    rememberMe: true,
  });

  if (result.success) {
    // Redirect to dashboard
    router.push('/dashboard');
  } else {
    // Show error
    setError(result.error);
  }
};
```

### Check Session

```tsx
import { getCurrentUser, isSessionValid } from '@/lib/auth';

// In a component or layout
useEffect(() => {
  const user = getCurrentUser();
  if (!user) {
    router.push('/login');
    return;
  }
  setUser(user);
}, []);
```

### Logout

```tsx
import { clearSession } from '@/lib/auth';

const handleLogout = () => {
  clearSession();
  router.push('/');
};
```

### Password Reset

```tsx
// Request reset (in API route)
import { requestPasswordReset } from '@/lib/auth';

const result = await requestPasswordReset(email);
if (result.success) {
  // Send email with result.token
}

// Reset password (in client)
import { resetPasswordWithToken } from '@/lib/auth';

const result = await resetPasswordWithToken(token, newPassword);
if (result.success) {
  // Password reset successful
}
```

### Hash Passwords (in API routes)

```tsx
import { hashPassword } from '@/lib/auth';

// When creating a user
const hashedPassword = await hashPassword(plainPassword);

// Store hashedPassword in database
```

### Check Permissions

```tsx
import { getUserPermissions } from '@/lib/auth';

const permissions = getUserPermissions(user.role);
if (permissions.canManageUsers) {
  // Show user management UI
}
```

## Database Schema

The auth module expects a `users` table with these columns:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  phone_number VARCHAR(50),
  logo_url TEXT,
  manufacturer_id UUID,
  created_by UUID REFERENCES users(id),
  reset_token TEXT,
  reset_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Migration from Plain Text Passwords

If you have existing users with plain text passwords:

1. Run the migration script:

```bash
npx ts-node scripts/migrate-passwords.ts
```

2. The auth module automatically handles both:
   - New hashed passwords (bcrypt format starting with `$2`)
   - Legacy plain text passwords (for backward compatibility during migration)

## File Structure

```
lib/auth/
├── index.ts          # Main exports
├── types.ts          # TypeScript types
├── password.ts       # Password hashing utilities
├── supabase.ts       # Supabase client setup
├── session.ts        # Client-side session management
├── login.ts          # Login logic
├── reset-password.ts # Password reset logic
└── README.md         # This file
```

## Exports

### Types
- `UserRole` - Union type of all user roles
- `AuthUser` - User object type
- `Session` - Session type
- `LoginCredentials` - Login input type
- `LoginResult` - Login response type
- `Permission` - Permission object type

### Functions
- `loginUser(credentials)` - Authenticate user
- `getCurrentUser()` - Get current user from session
- `getSession()` - Get full session object
- `isSessionValid()` - Check if session is valid
- `setSession(user)` - Store user session
- `clearSession()` - Clear session (logout)
- `hashPassword(plain)` - Hash a password
- `verifyPassword(plain, hashed)` - Verify password
- `requestPasswordReset(email)` - Generate reset token
- `resetPasswordWithToken(token, newPassword)` - Reset password
- `getUserPermissions(role)` - Get role permissions
- `supabase` - Public Supabase client
- `getSupabaseAdmin()` - Admin Supabase client (server only)

## Security Notes

1. **Never expose `SUPABASE_SERVICE_ROLE_KEY`** to the client
2. **Passwords are hashed** with bcrypt (12 salt rounds)
3. **Reset tokens expire** after 30 minutes
4. **Sessions expire** after 7 days
5. **Password is removed** from stored user data

## Portal-Specific Roles

```tsx
import { ADMIN_PORTAL_ROLES, CLIENT_PORTAL_ROLES } from '@/lib/auth';

// Check if user can access admin portal
if (ADMIN_PORTAL_ROLES.includes(user.role)) {
  // Allow access to admin features
}

// Check if user can access client portal
if (CLIENT_PORTAL_ROLES.includes(user.role)) {
  // Allow access to client features
}
```
