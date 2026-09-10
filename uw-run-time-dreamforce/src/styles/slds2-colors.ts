/**
 * SLDS 2 Color Styling Hooks Reference
 * Based on: https://www.lightningdesignsystem.com/2e1ef8501/p/655b28-color/
 *
 * This file contains all SLDS 2 color tokens, CSS custom properties, and utility classes
 */

export const SLDS2Colors = {
  // Status Colors - Badge Themes
  status: {
    success: 'slds-theme_success',      // Green - for positive states
    warning: 'slds-theme_warning',      // Yellow/Orange - for caution states
    error: 'slds-theme_error',          // Red - for error/critical states
    info: 'slds-theme_info',            // Blue - for informational states
    offline: 'slds-theme_offline',      // Gray - for offline/inactive states
  },

  // Background Colors
  background: {
    // Neutral backgrounds
    'alt-inverse': 'slds-theme_alt-inverse',
    default: 'slds-theme_default',
    shade: 'slds-theme_shade',
    inverse: 'slds-theme_inverse',

    // Success backgrounds
    success: 'slds-theme_success',
    'success-light': 'slds-theme_success slds-theme_light',

    // Warning backgrounds
    warning: 'slds-theme_warning',
    'warning-light': 'slds-theme_warning slds-theme_light',

    // Error backgrounds
    error: 'slds-theme_error',
    'error-light': 'slds-theme_error slds-theme_light',

    // Info backgrounds
    info: 'slds-theme_info',
    'info-light': 'slds-theme_info slds-theme_light',

    // Offline backgrounds
    offline: 'slds-theme_offline',
    'offline-light': 'slds-theme_offline slds-theme_light',
  },

  // Text Colors
  text: {
    default: 'slds-text-color_default',
    weak: 'slds-text-color_weak',
    'weaker': 'slds-text-color_weaker',
    inverse: 'slds-text-color_inverse',
    'inverse-weak': 'slds-text-color_inverse-weak',
    success: 'slds-text-color_success',
    warning: 'slds-text-color_warning',
    error: 'slds-text-color_error',
    destructive: 'slds-text-color_destructive',
  },

  // Border Colors
  border: {
    default: 'slds-border_top slds-border_right slds-border_bottom slds-border_left',
    success: 'slds-border-color_success',
    warning: 'slds-border-color_warning',
    error: 'slds-border-color_error',
    inverse: 'slds-border-color_inverse',
  },

  // Brand Colors (for buttons and key UI elements)
  brand: {
    primary: 'slds-button_brand',
    dark: 'slds-theme_brand-dark',
    light: 'slds-theme_brand-light',
  },

  // Utility classes for background colors
  utilities: {
    'bg-white': 'slds-color__background_white',
    'bg-gray-1': 'slds-color__background_gray-1',
    'bg-gray-2': 'slds-color__background_gray-2',
    'bg-gray-3': 'slds-color__background_gray-3',
    'bg-gray-4': 'slds-color__background_gray-4',
    'bg-gray-5': 'slds-color__background_gray-5',
    'bg-gray-6': 'slds-color__background_gray-6',
    'bg-gray-7': 'slds-color__background_gray-7',
    'bg-gray-8': 'slds-color__background_gray-8',
    'bg-gray-9': 'slds-color__background_gray-9',
    'bg-gray-10': 'slds-color__background_gray-10',
  },
};

/**
 * Helper function to get badge theme class
 */
export const getBadgeTheme = (type: 'success' | 'warning' | 'error' | 'info' | 'offline' | 'default'): string => {
  if (type === 'default') return 'slds-theme_default';
  return SLDS2Colors.status[type as keyof typeof SLDS2Colors.status] || 'slds-theme_default';
};

/**
 * Badge component class builder
 * Usage: getBadgeClasses('success') => 'slds-badge slds-theme_success'
 */
export const getBadgeClasses = (theme: keyof typeof SLDS2Colors.status): string => {
  return `slds-badge ${SLDS2Colors.status[theme] || ''}`;
};

/**
 * Button variant classes from SLDS 2
 */
export const SLDS2Buttons = {
  // Base buttons
  base: 'slds-button',
  neutral: 'slds-button slds-button_neutral',
  brand: 'slds-button slds-button_brand',
  outline: 'slds-button slds-button_outline-brand',
  destructive: 'slds-button slds-button_destructive',
  success: 'slds-button slds-button_success',

  // Icon buttons
  icon: 'slds-button slds-button_icon',
  'icon-border': 'slds-button slds-button_icon slds-button_icon-border',
  'icon-border-filled': 'slds-button slds-button_icon slds-button_icon-border-filled',
  'icon-bare': 'slds-button slds-button_icon slds-button_icon-bare',
  'icon-container': 'slds-button slds-button_icon slds-button_icon-container',
  'icon-brand': 'slds-button slds-button_icon slds-button_icon-brand',
  'icon-error': 'slds-button slds-button_icon slds-button_icon-error',

  // Icon sizes
  'icon-xx-small': 'slds-button slds-button_icon slds-button_icon-xx-small',
  'icon-x-small': 'slds-button slds-button_icon slds-button_icon-x-small',
  'icon-small': 'slds-button slds-button_icon slds-button_icon-small',
  'icon-large': 'slds-button slds-button_icon slds-button_icon-large',
};

/**
 * Example usage:
 *
 * // Badge with success theme
 * <span className={getBadgeClasses('success')}>Approved</span>
 *
 * // Badge with warning theme
 * <span className={getBadgeClasses('warning')}>Pending</span>
 *
 * // Brand button
 * <button className={SLDS2Buttons.brand}>Save</button>
 *
 * // Icon button with border
 * <button className={SLDS2Buttons['icon-border']}>
 *   <svg className="slds-button__icon">...</svg>
 * </button>
 */
