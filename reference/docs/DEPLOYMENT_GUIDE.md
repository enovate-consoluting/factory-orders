# Deployment Guide - Factory Orders System

## Environment Setup

### Files Structure
```
.env.local        <- Active environment (created by scripts)
.env.local.dev    <- Development database credentials
.env.local.prod   <- Production database credentials
```

### Switching Environments
```bash
# Use development database
npm run dev

# Use production database  
npm run dev:prod
```

## Pre-Deployment Checklist

### 1. ALWAYS Test Build Locally First
Before pushing any code to GitHub/Vercel, run:
```bash
npm run build
```

This catches TypeScript errors, missing imports, and other issues BEFORE they hit Vercel.

### 2. Common Build Errors to Watch For

#### TypeScript Errors
- **Interface mismatches**: Ensure all interfaces properly extend base types
- **Missing type arguments**: Arrays need type (e.g., `Array<any>` not just `Array`)
- **Property conflicts**: Check that extended interfaces don't conflict with base

#### Environment Variables
- **Missing API keys**: Handle gracefully with conditional checks:
```typescript
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
```

## Deployment Process

### Manual Deployment Steps
1. **Test build locally**
   ```bash
   npm run build
   ```
   
2. **If build succeeds, stage changes**
   ```bash
   git add .
   ```
   
3. **Commit with descriptive message**
   ```bash
   git commit -m "feat: add manufacturer pricing feature"
   ```
   
4. **Push to trigger deployment**
   ```bash
   git push origin main
   ```
   
5. **Monitor deployment**
   - Check Vercel dashboard
   - Wait for "Ready" status
   - Test production site

### Using the Automated Scripts (Windows)

#### test-build.bat
```batch
@echo off
echo Testing production build...
npm run build
if %errorlevel% neq 0 (
    echo BUILD FAILED! Fix errors before pushing.
    pause
    exit /b 1
)
echo BUILD SUCCESSFUL! Safe to deploy.
pause
```

#### deploy.bat
```batch
@echo off
echo Step 1: Testing build locally...
call test-build.bat
if %errorlevel% neq 0 (
    echo Build failed! Fix errors before deploying.
    exit /b 1
)

echo Step 2: Adding changes to git...
git add .

echo Step 3: Committing changes...
set /p message="Enter commit message: "
git commit -m "%message%"

echo Step 4: Pushing to GitHub (this will trigger Vercel deployment)...
git push origin main

echo Deployment initiated! Check Vercel dashboard for status.
pause
```

## Troubleshooting Deployment Errors

### If Vercel Build Fails

1. **Check Vercel logs** for the specific error
2. **Reproduce locally** with `npm run build`
3. **Common fixes**:
   - TypeScript errors: Fix type definitions
   - Missing dependencies: Check package.json
   - Environment variables: Add to Vercel dashboard

### Quick Fixes for Common Issues

```typescript
// Interface conflicts - use composition instead of extension
interface OrderWithDetails {
  id: string;
  // ... define all properties explicitly
}

// Missing type arguments
attachments?: Array<any>;  // Add <any> or specific type

// Handle missing env variables
if (!process.env.SOME_KEY) {
  console.warn('SOME_KEY not configured');
  // Handle gracefully
}
```

## Best Practices

1. **Always test build locally before pushing**
2. **Use descriptive commit messages**
3. **Keep dev and prod databases separate**
4. **Test in dev environment first**
5. **Monitor Vercel dashboard during deployment**
6. **Check production site after deployment**

## Emergency Rollback

If something breaks in production:

```bash
# Find the last working commit
git log --oneline

# Revert to that commit
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard <commit-hash>
git push origin main --force
```

## Environment Variables in Vercel

Add these in Vercel Dashboard → Settings → Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `RESEND_API_KEY` (if using email)
- `RESEND_FROM_EMAIL` (if using email)

---

Remember: The golden rule is **ALWAYS run `npm run build` locally before pushing**. This catches 99% of deployment issues before they reach Vercel.