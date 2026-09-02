import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { MatTabsModule } from '@angular/material/tabs';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, PageHeaderComponent, MatTabsModule],
  template: `
    <div class="settings-container">
      <app-page-header
        title="Settings"
        subtitle="Manage master data and configuration"
        icon="settings"
      ></app-page-header>

      <nav mat-tab-nav-bar class="settings-tabs" [tabPanel]="tabPanel">
        <a mat-tab-link
           *ngFor="let link of links"
           [routerLink]="link.path"
           routerLinkActive #rla="routerLinkActive"
           [active]="rla.isActive">
          {{link.label}}
        </a>
      </nav>

      <mat-tab-nav-panel #tabPanel></mat-tab-nav-panel>

      <div class="settings-content">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      animation: fadeSlideUp 0.4s cubic-bezier(0.215, 0.61, 0.355, 1) both;
    }

    .settings-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: var(--space-6);
      max-width: 1200px;
      margin: 0 auto;
    }

    .settings-tabs {
      background: var(--surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: var(--space-1);
      margin-bottom: var(--space-6);
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-wrap: wrap;
      gap: 4px;

      // Override Material tab link styles
      ::ng-deep a.mat-mdc-tab-link {
        min-width: unset;
        padding: 0 var(--space-4);
        height: 36px;
        border-radius: var(--radius-md);
        font-size: var(--text-sm);
        font-weight: var(--weight-medium);
        color: var(--text-secondary);
        text-decoration: none;
        transition: all var(--transition-fast);
        opacity: 1;
        letter-spacing: 0;

        &:hover {
          color: var(--text-primary);
          background: var(--surface-alt);
        }

        &.mdc-tab--active, &.mat-mdc-tab-link-active {
          color: var(--primary);
          background: var(--primary-50);

          .mdc-tab__text-label { color: var(--primary); }
        }

        .mdc-tab-indicator { display: none; }
        .mdc-tab__ripple { display: none; }
        .mdc-tab__text-label { color: inherit; }
      }

      ::ng-deep .mat-mdc-tab-header-pagination { display: none; }
    }

    .settings-content {
      flex: 1;
      overflow-y: auto;
    }

    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class SettingsComponent {
  links = [
    { path: 'products', label: 'Products' },
    { path: 'materials', label: 'Materials' },
    { path: 'lines', label: 'Lines' },
    { path: 'shifts', label: 'Shifts' },
    { path: 'machines', label: 'Machines' },
    { path: 'production-config', label: 'Production Config' },
    { path: 'recipes', label: 'Recipes' },
    { path: 'unit-costs', label: 'Unit Costs' }
  ];
}
