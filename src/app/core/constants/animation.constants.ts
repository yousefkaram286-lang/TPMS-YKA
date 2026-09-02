// ============================================================
// TPMS — Animation Constants
// ============================================================

export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 220,
  SLOW: 350,
  VERY_SLOW: 500
} as const;

export const ANIMATION_EASING = {
  SMOOTH: 'cubic-bezier(0.2, 0, 0, 1)',
  BOUNCE: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  EASE_OUT: 'cubic-bezier(0, 0, 0.2, 1)',
  EASE_IN_OUT: 'cubic-bezier(0.4, 0, 0.2, 1)'
} as const;

export const ANIMATION_STAGGER = {
  CARD: 50,
  LIST_ITEM: 30,
  TEXT: 20
} as const;

export const ANIMATION_SCALE = {
  BUTTON_HOVER: 1.02,
  BUTTON_ACTIVE: 0.98,
  DIALOG_ENTER: 0.96,
  ICON_HOVER: 1.1
} as const;

export const ANIMATION_TRANSLATE = {
  PAGE_ENTER: '12px',
  CARD_ENTER: '15px',
  DIALOG_ENTER: '8px',
  ICON_HOVER: '2px'
} as const;
