import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { AppCardComponent } from '../../shared/components/app-card/app-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { UserManagementService } from '../../core/services/user-management.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, PageHeaderComponent, AppCardComponent, EmptyStateComponent],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss'],
})
export class UserManagementComponent implements OnInit {
  private fb = inject(FormBuilder);
  private userSvc = inject(UserManagementService);

  users: User[] = [];
  loading = true;
  creating = false;

  message: { success: boolean; text: string } | null = null;

  createForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    username: ['', [Validators.required]],
    displayName: ['']
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    this.loading = true;
    this.message = null;
    try {
      this.users = await this.userSvc.listUsers();
    } catch (err: any) {
      this.message = { success: false, text: err?.message ?? 'Failed to load users.' };
    } finally {
      this.loading = false;
    }
  }

  async createUser(): Promise<void> {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.message = null;

    try {
      const result = await this.userSvc.createUser(this.createForm.value);
      if (result.success) {
        this.message = { success: true, text: 'User created successfully. They can now log in.' };
        this.createForm.reset();
        await this.loadUsers();
      } else {
        this.message = { success: false, text: result.error || 'Failed to create user.' };
      }
    } catch (err) {
      this.message = { success: false, text: 'An unexpected error occurred.' };
    } finally {
      this.creating = false;
      if (this.message?.success) {
        setTimeout(() => this.message = null, 3000);
      }
    }
  }
}