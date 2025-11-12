/**
 * Standard Input Styles for Factory Orders System
 * 
 * This file contains all standard input, select, textarea, and form element styles
 * to ensure consistency across the application and prevent light/unreadable text issues.
 * 
 * ALWAYS use these classes instead of creating new ones inline.
 * Add new styles here as patterns emerge.
 */

// ============================================
// BASE INPUT STYLES
// ============================================

/**
 * Standard text input field
 * Use for: text, email, password, number, date inputs
 */
export const inputClassName = 
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 disabled:bg-gray-50 disabled:text-gray-500";

/**
 * Standard select dropdown
 * Use for: all select dropdowns
 */
export const selectClassName = 
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white disabled:bg-gray-50 disabled:text-gray-500";

/**
 * Standard textarea
 * Use for: multi-line text inputs
 */
export const textareaClassName = 
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 resize-none disabled:bg-gray-50 disabled:text-gray-500";

/**
 * Search input with icon padding
 * Use for: search fields with magnifying glass icon
 */
export const searchInputClassName = 
  "w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500";

// ============================================
// BUTTON STYLES
// ============================================

/**
 * Primary button (blue)
 * Use for: main actions like Save, Submit, Create
 */
export const primaryButtonClassName = 
  "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors";

/**
 * Secondary button (white/gray border)
 * Use for: cancel, back, secondary actions
 */
export const secondaryButtonClassName = 
  "px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors";

/**
 * Danger button (red)
 * Use for: delete, remove, destructive actions
 */
export const dangerButtonClassName = 
  "px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors";

/**
 * Success button (green)
 * Use for: approve, confirm, positive actions
 */
export const successButtonClassName = 
  "px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors";

// ============================================
// FORM GROUP STYLES
// ============================================

/**
 * Form group container
 * Use to wrap label + input combinations
 */
export const formGroupClassName = "space-y-1.5";

/**
 * Form label
 * Use for: all form labels above inputs
 */
export const labelClassName = "block text-sm font-medium text-gray-700";

/**
 * Required field indicator
 * Use after label text for required fields
 */
export const requiredClassName = "text-red-500 ml-1";

/**
 * Helper text below inputs
 * Use for: instructions or validation hints
 */
export const helperTextClassName = "text-xs text-gray-500 mt-1";

/**
 * Error text below inputs
 * Use for: validation error messages
 */
export const errorTextClassName = "text-xs text-red-600 mt-1";

// ============================================
// SPECIALIZED INPUTS
// ============================================

/**
 * Small input (compact version)
 * Use for: inline forms, table cells
 */
export const smallInputClassName = 
  "px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500";

/**
 * Borderless input (for inline editing)
 * Use for: edit-in-place fields
 */
export const borderlessInputClassName = 
  "px-2 py-1 bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none text-gray-900 placeholder-gray-500";

/**
 * Checkbox
 * Use for: all checkboxes
 */
export const checkboxClassName = 
  "h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500";

/**
 * Radio button
 * Use for: all radio buttons
 */
export const radioClassName = 
  "h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500";

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Combine class names conditionally
 * Usage: getInputClassName(true) for error state
 */
export const getInputClassName = (hasError: boolean = false): string => {
  const baseClass = inputClassName;
  return hasError 
    ? `${baseClass} border-red-500 focus:border-red-500 focus:ring-red-500`
    : baseClass;
};

/**
 * Combine select class names conditionally
 */
export const getSelectClassName = (hasError: boolean = false): string => {
  const baseClass = selectClassName;
  return hasError 
    ? `${baseClass} border-red-500 focus:border-red-500 focus:ring-red-500`
    : baseClass;
};

// ============================================
// COMPOSITE STYLES
// ============================================

/**
 * Modal overlay
 * Use for: backdrop of modals
 */
export const modalOverlayClassName = 
  "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4";

/**
 * Modal content container
 * Use for: the white box containing modal content
 */
export const modalContentClassName = 
  "bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto";

/**
 * Card container
 * Use for: content cards/boxes
 */
export const cardClassName = 
  "bg-white rounded-lg shadow-lg border border-gray-300 p-4 hover:shadow-xl transition-shadow";

// ============================================
// USAGE EXAMPLES
// ============================================

/**
 * Example usage in a component:
 * 
 * import { inputClassName, selectClassName, primaryButtonClassName } from '@/lib/utils/inputStyles';
 * 
 * <input type="text" className={inputClassName} />
 * <select className={selectClassName}>...</select>
 * <button className={primaryButtonClassName}>Save</button>
 * 
 * For conditional styling:
 * import { getInputClassName } from '@/lib/utils/inputStyles';
 * <input className={getInputClassName(hasError)} />
 */

// ============================================
// STYLE GUIDELINES
// ============================================

/**
 * IMPORTANT RULES FOR ALL INPUTS:
 * 
 * 1. ALWAYS include text-gray-900 for dark text
 * 2. ALWAYS include placeholder-gray-500 for visible placeholders
 * 3. NEVER use text-gray-400 or lighter for input text
 * 4. ALWAYS include bg-white for selects
 * 5. ALWAYS include disabled states
 * 6. ALWAYS use focus:ring-2 for accessibility
 * 
 * COLOR STANDARDS:
 * - Input text: text-gray-900 (dark, readable)
 * - Placeholder: placeholder-gray-500 (visible but lighter)
 * - Labels: text-gray-700 (slightly lighter than input text)
 * - Helper text: text-gray-500 (subdued)
 * - Borders: border-gray-300 (visible but not heavy)
 * - Focus: ring-blue-500 border-blue-500
 * - Error: ring-red-500 border-red-500 text-red-600
 * - Disabled: bg-gray-50 text-gray-500
 */