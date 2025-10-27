/**
 * BIRDHAUS FACTORY ORDER SYSTEM - THEME CONFIGURATION
 * 
 * IMPORTANT: This is the official theme configuration for the entire application.
 * ALL components should use these theme values. 
 * DO NOT use dark theme (slate-800/900) anymore!
 * 
 * Theme: Modern White/Grey/Blue Professional Theme
 * Last Updated: October 2025
 */

export const theme = {
  // ============================================
  // COLORS
  // ============================================
  colors: {
    // Primary Brand Colors
    primary: {
      50: 'bg-blue-50',
      100: 'bg-blue-100',
      500: 'bg-blue-500',
      600: 'bg-blue-600',
      700: 'bg-blue-700',
      text: 'text-blue-600',
      textHover: 'hover:text-blue-700',
      border: 'border-blue-500',
      ring: 'ring-blue-500'
    },

    // Backgrounds
    background: {
      main: 'bg-gray-50',        // Main app background
      card: 'bg-white',           // Card/Panel backgrounds
      hover: 'hover:bg-gray-50',  // Hover states
      selected: 'bg-blue-50',     // Selected items
      modal: 'bg-white',          // Modal backgrounds
      overlay: 'bg-black/20'      // Modal overlay
    },

    // Borders
    border: {
      default: 'border-gray-200',
      light: 'border-gray-100',
      focus: 'focus:border-blue-500',
      error: 'border-red-500'
    },

    // Text Colors
    text: {
      primary: 'text-gray-900',      // Main text
      secondary: 'text-gray-600',    // Secondary text
      muted: 'text-gray-500',        // Muted/placeholder
      white: 'text-white',            // White text on colored backgrounds
      link: 'text-blue-600',          // Links
      linkHover: 'hover:text-blue-700'
    },

    // Status Colors
    status: {
      draft: {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        border: 'border-gray-300'
      },
      submitted: {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        border: 'border-blue-300'
      },
      pending: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        border: 'border-yellow-300'
      },
      in_progress: {
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        border: 'border-purple-300'
      },
      completed: {
        bg: 'bg-green-100',
        text: 'text-green-700',
        border: 'border-green-300'
      },
      rejected: {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-300'
      }
    },

    // Alerts/Notifications
    alerts: {
      success: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-800',
        icon: 'text-green-600'
      },
      error: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        icon: 'text-red-600'
      },
      warning: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-800',
        icon: 'text-yellow-600'
      },
      info: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        icon: 'text-blue-600'
      }
    }
  },

  // ============================================
  // COMPONENTS
  // ============================================
  components: {
    // Buttons
    button: {
      primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md transition-all',
      secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm',
      danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm',
      success: 'bg-green-600 hover:bg-green-700 text-white shadow-sm',
      ghost: 'hover:bg-gray-100 text-gray-700',
      disabled: 'bg-gray-100 text-gray-400 cursor-not-allowed',
      icon: 'p-2 hover:bg-gray-100 rounded-lg transition-colors',
      gradient: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm hover:shadow-md'
    },

    // Inputs
    input: {
      base: 'w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
      error: 'border-red-500 focus:ring-red-500 focus:border-red-500',
      disabled: 'bg-gray-50 text-gray-500 cursor-not-allowed'
    },

    // Cards
    card: {
      base: 'bg-white rounded-lg shadow-sm border border-gray-200',
      hover: 'hover:shadow-md transition-shadow',
      header: 'px-6 py-4 border-b border-gray-200',
      body: 'p-6'
    },

    // Tables
    table: {
      wrapper: 'bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden',
      header: 'bg-gray-50 border-b border-gray-200',
      headerCell: 'px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider',
      row: 'hover:bg-gray-50 transition-colors border-b border-gray-100',
      cell: 'px-6 py-4 text-gray-900'
    },

    // Modal
    modal: {
      overlay: 'fixed inset-0 bg-black/30 backdrop-blur-sm',
      container: 'fixed inset-0 flex items-center justify-center z-50 p-4',
      content: 'bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto',
      header: 'px-6 py-4 border-b border-gray-200',
      body: 'p-6',
      footer: 'px-6 py-4 border-t border-gray-200 flex justify-end gap-3'
    },

    // Badge
    badge: {
      base: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      gray: 'bg-gray-100 text-gray-700',
      blue: 'bg-blue-100 text-blue-700',
      green: 'bg-green-100 text-green-700',
      yellow: 'bg-yellow-100 text-yellow-700',
      red: 'bg-red-100 text-red-700',
      purple: 'bg-purple-100 text-purple-700'
    },

    // Sidebar (for dashboard)
    sidebar: {
      base: 'bg-white border-r border-gray-200',
      logo: 'p-6 border-b border-gray-200',
      nav: 'p-4',
      item: 'flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors',
      itemActive: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
      icon: 'h-5 w-5',
      label: 'font-medium'
    },

    // Top Navigation Bar
    topbar: {
      base: 'bg-white border-b border-gray-200 px-6 py-4',
      title: 'text-2xl font-bold text-gray-900',
      actions: 'flex items-center gap-3'
    }
  },

  // ============================================
  // LAYOUTS
  // ============================================
  layouts: {
    // Page layouts
    page: {
      wrapper: 'min-h-screen bg-gray-50',
      container: 'p-6',
      header: 'mb-6',
      title: 'text-3xl font-bold text-gray-900',
      subtitle: 'text-gray-600 mt-1'
    },

    // Form layouts
    form: {
      section: 'bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6',
      sectionTitle: 'text-xl font-semibold text-gray-900 mb-4',
      fieldGroup: 'grid grid-cols-1 md:grid-cols-2 gap-4',
      field: 'mb-4',
      label: 'block text-sm font-medium text-gray-700 mb-2',
      helper: 'text-sm text-gray-500 mt-1',
      error: 'text-sm text-red-600 mt-1'
    },

    // Grid layouts
    grid: {
      two: 'grid grid-cols-1 md:grid-cols-2 gap-4',
      three: 'grid grid-cols-1 md:grid-cols-3 gap-4',
      four: 'grid grid-cols-1 md:grid-cols-4 gap-4'
    }
  },

  // ============================================
  // ANIMATIONS
  // ============================================
  animations: {
    transition: 'transition-all duration-200',
    fadeIn: 'animate-fadeIn',
    slideUp: 'animate-slideUp',
    spin: 'animate-spin',
    pulse: 'animate-pulse'
  },

  // ============================================
  // SHADOWS
  // ============================================
  shadows: {
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    inner: 'shadow-inner',
    none: 'shadow-none'
  }
}

// ============================================
// USAGE EXAMPLES
// ============================================

/**
 * EXAMPLE 1: Page Layout
 * 
 * <div className={theme.layouts.page.wrapper}>
 *   <div className={theme.layouts.page.container}>
 *     <h1 className={theme.layouts.page.title}>Orders</h1>
 *   </div>
 * </div>
 */

/**
 * EXAMPLE 2: Card Component
 * 
 * <div className={theme.components.card.base}>
 *   <div className={theme.components.card.header}>
 *     <h2 className="text-lg font-semibold text-gray-900">Card Title</h2>
 *   </div>
 *   <div className={theme.components.card.body}>
 *     Content here
 *   </div>
 * </div>
 */

/**
 * EXAMPLE 3: Button
 * 
 * <button className={theme.components.button.primary}>
 *   Create Order
 * </button>
 */

/**
 * EXAMPLE 4: Status Badge
 * 
 * <span className={`${theme.components.badge.base} ${theme.colors.status.submitted.bg} ${theme.colors.status.submitted.text}`}>
 *   Submitted
 * </span>
 */

/**
 * EXAMPLE 5: Form Input
 * 
 * <input 
 *   type="text"
 *   className={theme.components.input.base}
 *   placeholder="Enter value"
 * />
 */

// ============================================
// TAILWIND CONFIG EXTENSION
// ============================================

/**
 * Add this to your tailwind.config.js if needed:
 * 
 * theme: {
 *   extend: {
 *     colors: {
 *       gray: {
 *         50: '#f9fafb',
 *         100: '#f3f4f6',
 *         200: '#e5e7eb',
 *         300: '#d1d5db',
 *         400: '#9ca3af',
 *         500: '#6b7280',
 *         600: '#4b5563',
 *         700: '#374151',
 *         800: '#1f2937',
 *         900: '#111827',
 *       }
 *     }
 *   }
 * }
 */

export default theme