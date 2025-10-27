# IMPORTANT: THEME REQUIREMENTS FOR BIRDHAUS FACTORY ORDER SYSTEM

## DO NOT USE DARK THEME - USE WHITE/GREY/BLUE THEME

This application uses a **modern, professional white/grey/blue theme**, NOT a dark theme.

### ❌ NEVER USE THESE DARK THEME CLASSES:
- `bg-slate-900`, `bg-slate-800`, `bg-slate-700`
- Dark backgrounds of any kind
- Dark themed components

### ✅ ALWAYS USE THESE THEME COLORS:

#### Backgrounds:
- **Main Background**: `bg-gray-50` (light gray)
- **Cards/Panels**: `bg-white` with `border border-gray-200` and `shadow-sm`
- **Hover States**: `hover:bg-gray-50` or `hover:bg-gray-100`
- **Selected Items**: `bg-blue-50`

#### Text Colors:
- **Primary Text**: `text-gray-900` (dark gray, not black)
- **Secondary Text**: `text-gray-600`
- **Muted Text**: `text-gray-500`
- **Links**: `text-blue-600 hover:text-blue-700`

#### Buttons:
- **Primary**: `bg-blue-600 hover:bg-blue-700 text-white`
- **Secondary**: `bg-white hover:bg-gray-50 text-gray-700 border border-gray-300`
- **Danger**: `bg-red-600 hover:bg-red-700 text-white`

#### Status Badges:
- **Draft**: `bg-gray-100 text-gray-700`
- **Submitted**: `bg-blue-100 text-blue-700`
- **In Progress**: `bg-purple-100 text-purple-700`
- **Completed**: `bg-green-100 text-green-700`
- **Rejected**: `bg-red-100 text-red-700`

#### Inputs:
```jsx
className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
```

#### Cards:
```jsx
className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
```

#### Tables:
- **Table Wrapper**: `bg-white rounded-lg shadow-sm border border-gray-200`
- **Table Header**: `bg-gray-50`
- **Table Rows**: `hover:bg-gray-50 border-b border-gray-100`

### REFERENCE THE THEME CONFIG FILE:
Always check `/lib/theme.ts` for the complete theme configuration before creating or modifying any component.

### EXAMPLE PAGE STRUCTURE:
```jsx
<div className="min-h-screen bg-gray-50">
  <div className="p-6">
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h1 className="text-3xl font-bold text-gray-900">Page Title</h1>
      <p className="text-gray-600 mt-1">Description</p>
    </div>
  </div>
</div>
```

## IMPORTANT NOTES FOR AI/CLAUDE:
1. **ALWAYS** use the white/grey/blue theme
2. **NEVER** revert to dark theme (slate-800/900)
3. **CHECK** the theme config before writing any UI code
4. **MAINTAIN** consistency across all components
5. This is a **professional business application** - keep it clean and modern

---

When in doubt, refer to the theme configuration at `/lib/theme.ts`
