// ============================================================
// TPMS — Shell Component
// ============================================================
import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, MatSidenavModule, SidebarComponent, HeaderComponent],
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
          
          <div class="page-container page-content page-transition">
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
            
            <div class="page-container page-content page-transition">
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
export class ShellComponent implements OnInit {
  isMobile = false;
  sidebarCollapsed = false;
  mobileMenuOpen = false;

  ngOnInit() {
    this.checkScreenSize();
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
