// ============================================================
// TPMS — Animation Utilities
// ============================================================

import { AnimationTriggerMetadata, animate, style, transition, trigger, group, query, animateChild, stagger } from '@angular/animations';
import { ANIMATION_DURATION, ANIMATION_EASING, ANIMATION_TRANSLATE, ANIMATION_SCALE, ANIMATION_STAGGER } from '../constants/animation.constants';

export const fadeInUp: AnimationTriggerMetadata = trigger('fadeInUp', [
  transition(':enter', [
    style({
      opacity: 0,
      transform: `translateY(${ANIMATION_TRANSLATE.PAGE_ENTER})`
    }),
    group([
      animate(
        `${ANIMATION_DURATION.NORMAL}ms ${ANIMATION_EASING.SMOOTH}`,
        style({
          opacity: 1,
          transform: 'translateY(0)'
        })
      ),
      animateChild()
    ])
  ])
]);

export const fadeIn: AnimationTriggerMetadata = trigger('fadeIn', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate(
      `${ANIMATION_DURATION.NORMAL}ms ${ANIMATION_EASING.SMOOTH}`,
      style({ opacity: 1 })
    )
  ])
]);

export const slideInUp: AnimationTriggerMetadata = trigger('slideInUp', [
  transition(':enter', [
    style({
      opacity: 0,
      transform: `translateY(${ANIMATION_TRANSLATE.CARD_ENTER})`
    }),
    animate(
      `${ANIMATION_DURATION.NORMAL}ms ${ANIMATION_EASING.SMOOTH}`,
      style({
        opacity: 1,
      transform: 'translateY(0)'
      })
    )
  ])
]);

export const scaleIn: AnimationTriggerMetadata = trigger('scaleIn', [
  transition(':enter', [
    style({
      opacity: 0,
      transform: `scale(${ANIMATION_SCALE.DIALOG_ENTER})`
    }),
    animate(
      `${ANIMATION_DURATION.NORMAL}ms ${ANIMATION_EASING.SMOOTH}`,
      style({
        opacity: 1,
        transform: 'scale(1)'
      })
    )
  ])
]);

export const expandCollapse: AnimationTriggerMetadata = trigger('expandCollapse', [
  transition(':enter', [
    style({ height: 0, opacity: 0 }),
    animate(
      `${ANIMATION_DURATION.NORMAL}ms ${ANIMATION_EASING.SMOOTH}`,
      style({ height: '*', opacity: 1 })
    )
  ]),
  transition(':leave', [
    style({ height: '*', opacity: 1 }),
    animate(
      `${ANIMATION_DURATION.FAST}ms ${ANIMATION_EASING.EASE_OUT}`,
      style({ height: 0, opacity: 0 })
    )
  ])
]);

export const staggerList: AnimationTriggerMetadata = trigger('staggerList', [
  transition(':enter', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(10px)' }),
      stagger(ANIMATION_STAGGER.LIST_ITEM, [
        animate(
          `${ANIMATION_DURATION.FAST}ms ${ANIMATION_EASING.SMOOTH}`,
          style({ opacity: 1, transform: 'translateY(0)' })
        )
      ])
    ], { optional: true })
  ])
]);

export const tableRowAnimation: AnimationTriggerMetadata = trigger('tableRowAnimation', [
  transition(':enter', [
    style({
      opacity: 0,
      transform: 'translateY(8px)'
    }),
    animate(
      `${ANIMATION_DURATION.FAST}ms ${ANIMATION_EASING.SMOOTH}`,
      style({
        opacity: 1,
        transform: 'translateY(0)'
      })
    )
  ]),
  transition(':leave', [
    animate(
      `${ANIMATION_DURATION.FAST}ms ${ANIMATION_EASING.EASE_OUT}`,
      style({
        opacity: 0,
        transform: 'translateY(-8px)'
      })
    )
  ])
]);

export const dialogAnimation: AnimationTriggerMetadata = trigger('dialogAnimation', [
  transition(':enter', [
    style({
      opacity: 0,
      transform: `scale(${ANIMATION_SCALE.DIALOG_ENTER}) translateY(${ANIMATION_TRANSLATE.DIALOG_ENTER})`
    }),
    animate(
      `${ANIMATION_DURATION.NORMAL}ms ${ANIMATION_EASING.SMOOTH}`,
      style({
        opacity: 1,
        transform: 'scale(1) translateY(0)'
      })
    )
  ]),
  transition(':leave', [
    animate(
      `${ANIMATION_DURATION.FAST}ms ${ANIMATION_EASING.EASE_OUT}`,
      style({
        opacity: 0,
        transform: `scale(${ANIMATION_SCALE.DIALOG_ENTER}) translateY(${ANIMATION_TRANSLATE.DIALOG_ENTER})`
      })
    )
  ])
]);
