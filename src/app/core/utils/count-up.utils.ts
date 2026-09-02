// ============================================================
// TPMS — Count-Up Animation Utility
// ============================================================

import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CountUpService {
  private animationFrameId: number | null = null;
  private currentValue = 0;
  private targetValue = 0;
  private duration = 1000;
  private startTime: number | null = null;
  private callback: ((value: number) => void) | null = null;

  /**
   * Animates a number from start to end over specified duration
   */
  animateCount(
    start: number,
    end: number,
    duration: number = 1000,
    callback: (value: number) => void
  ): void {
    this.currentValue = start;
    this.targetValue = end;
    this.duration = duration;
    this.callback = callback;
    this.startTime = null;

    // Cancel any existing animation
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Start animation
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
  }

  private animate(timestamp: number): void {
    if (this.startTime === null) {
      this.startTime = timestamp;
    }

    const elapsed = timestamp - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1);

    // Easing function (ease-out cubic)
    const easeProgress = 1 - Math.pow(1 - progress, 3);

    this.currentValue = this.currentValue + (this.targetValue - this.currentValue) * easeProgress;

    if (this.callback) {
      this.callback(this.currentValue);
    }

    if (progress < 1) {
      this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
    } else {
      // Ensure we hit the exact target value
      if (this.callback) {
        this.callback(this.targetValue);
      }
      this.animationFrameId = null;
    }
  }

  /**
   * Formats a number for display with appropriate decimal places
   */
  formatNumber(value: number, decimals: number = 0): string {
    return value.toFixed(decimals);
  }

  /**
   * Formats a percentage for display
   */
  formatPercentage(value: number, decimals: number = 1): string {
    return value.toFixed(decimals) + '%';
  }

  /**
   * Cancels any ongoing animation
   */
  cancel(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}
