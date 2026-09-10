// ============================================================
// TPMS — Shell Component
// ------------------------------------------------------------
// Content direction policy (mixed-language safety pass):
// The shell chrome (sidebar / header) follows the active UI
// language via <html dir>. Each routed page decides its OWN
// content direction:
//   - pages marked `data: { rtl: true }` (translated, e.g. Users)
//     become RTL when Arabic is active,
//   - every other page stays LTR (English content keeps its
//     natural layout during the phased translation rollout).
// The CDK `Dir` directive is used instead of a plain dir
// attribute so Angular Material components inside the wrapper
// receive the correct Directionality. The wrapper also carries
// the `.tpms-dir` marker class; directional CSS (forms, tables)
// is scoped to `.tpms-dir[dir="rtl"]`, so it only activates on
// translated RTL pages and never leaks into untranslated ones.
// ============================================================
import { Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { Dir } from '@angular/cdk/bidi';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, MatSidenavModule, Dir, SidebarComponent, HeaderComponent],
  template: `
    <div class="app-container" [class.is-mobile]="isMobile">
      
      <!-- Desktop Layout -->
      <ng-container *ngIf="!isMobile">
        <app-sidebar
          [(collapsed)]="sidebarCollapsed"
        ></app-sidebar>
        
        <main class="main-content">
          <app-header
            [isMobile]="isMobile"
            (toggleSidebar)="sidebarCollapsed = !sidebarCollapsed"
          ></app-header>
          
          <div class="page-container page-content page-transition tpms-dir" [dir]="contentDir()">
            <router-outlet></router-outlet>
          </div>
        </main>
      </ng-container>

      <!-- Mobile/Tablet Layout (Sidenav) -->
      <ng-container *ngIf="isMobile">
        <mat-sidenav-container class="mobile-container">
          <mat-sidenav
            #sidenav
            mode="over"
            [opened]="mobileMenuOpen"
            (openedChange)="mobileMenuOpen = $event"
          >
            <app-sidebar
              [collapsed]="false"
              (navItemClicked)="sidenav.close()"
            ></app-sidebar>
          </mat-sidenav>

          <mat-sidenav-content>
            <app-header
              [isMobile]="isMobile"
              (toggleSidebar)="sidenav.toggle()"
            ></app-header>
            
            <div class="page-container page-content page-transition tpms-dir" [dir]="contentDir()">
              <router-outlet></router-outlet>
            </div>
          </mat-sidenav-content>
        </mat-sidenav-container>
      </ng-container>

    </div>
  `,
  styles: [`
    .app-container {
      display: flex;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      background: transparent;
    }

    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0; // Prevent flex item from overflowing
      height: 100vh;
    }

    .page-container {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: var(--space-6) var(--space-8);
      
      @media (max-width: 768px) {
        padding: var(--space-4);
      }
    }

    .page-transition {
      animation: pageFadeIn 0.4s cubic-bezier(0.215, 0.61, 0.355, 1) both;
    }

    @keyframes pageFadeIn {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .mobile-container {
      width: 100%;
      height: 100%;
      background: transparent;
    }

    mat-sidenav {
      width: var(--sidebar-width);
      border-right: none;
    }
  `],
})
export class ShellComponent implements OnInit, OnDestroy {
  isMobile = false;
  sidebarCollapsed = false;
  mobileMenuOpen = false;

  private pagePrefersRtl = false;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translation = inject(TranslationService);
  private navEvents?: Subscription;

  ngOnInit() {
    this.checkScreenSize();
    this.navEvents = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.syncPageDirection());
    this.syncPageDirection();
  }

  ngOnDestroy() {
    this.navEvents?.unsubscribe();
  }

  /** Direction for the routed page content (independent of the Arabic chrome). */
  contentDir(): 'ltr' | 'rtl' {
    return this.pagePrefersRtl && this.translation.isArabic() ? 'rtl' : 'ltr';
  }

  private syncPageDirection(): void {
    let snapshot = this.route.snapshot;
    while (snapshot.firstChild) {
      snapshot = snapshot.firstChild;
    }
    this.pagePrefersRtl = snapshot.data['rtl'] === true;
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    this.isMobile = window.innerWidth < 1024;
    if (!this.isMobile) {
      this.mobileMenuOpen = false;
    }
  }
}
