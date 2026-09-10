// ============================================================
// TPMS — English translation catalog
// ------------------------------------------------------------
// Flat, semantic dot-keyed records. Keys are used by the
// TranslationService; values are the English (LTR) strings.
// This is a presentation-only layer — never alter business data.
// ============================================================

export interface TranslationCatalog {
  [key: string]: string;
}

export const EN: TranslationCatalog = {
  // ── Common ─────────────────────────────────────────────
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.active': 'Active',
  'common.inactive': 'Inactive',
  'common.loading': 'Loading...',

  // ── App / Shell ────────────────────────────────────────
  'app.name': 'TPMS',
  'app.fullName': 'Production Management System',

  // ── Navigation ─────────────────────────────────────────
  'nav.dashboard': 'Dashboard',
  'nav.production': 'Production',
  'nav.output-release': 'Output Release',
  'nav.outputRelease': 'Output Release',
  'nav.materials': 'Materials',
  'nav.quality': 'Quality',
  'nav.users': 'Users',
  'nav.settings': 'Settings',
  'nav.reports': 'Reports',
  'nav.profile': 'Profile',
  'nav.expandSidebar': 'Expand sidebar',
  'nav.collapseSidebar': 'Collapse sidebar',
  'nav.toggleSidebar': 'Toggle sidebar',
  'nav.logout': 'Logout',
  'nav.role.admin': 'Administrator',
  'nav.role.user': 'User',

  // ── Header / Topbar ────────────────────────────────────
  'header.search': 'Search...',
  'header.searchShortcut': 'Ctrl+K',
  'header.openMenu': 'Open menu',
  'header.notifications': 'Notifications',
  'header.lightMode': 'Switch to Light Mode',
  'header.darkMode': 'Switch to Dark Mode',
  'header.myProfile': 'My Profile',
  'header.preferences': 'Preferences',
  'header.hidePassword': 'Hide password',
  'header.showPassword': 'Show password',

  // ── Language ───────────────────────────────────────────
  'language.en': 'English',
  'language.ar': 'العربية',
  'language.switch': 'Language',

  // ── Auth / Login ───────────────────────────────────────
  'auth.login.welcome': 'Welcome back',
  'auth.login.subtitle': 'Please enter your details to sign in.',
  'auth.login.email': 'Email',
  'auth.login.password': 'Password',
  'auth.login.rememberMe': 'Remember me',
  'auth.login.forgotPassword': 'Forgot password?',
  'auth.login.signIn': 'Sign In',
  'auth.login.feature.tracking': 'Real-time tracking',
  'auth.login.feature.quality': 'Quality control',
  'auth.login.feature.resource': 'Resource optimization',
  'auth.login.error.emailRequired': 'Email is required',
  'auth.login.error.passwordRequired': 'Password is required',
  'auth.login.failed': 'Login failed.',

  // ── Users ──────────────────────────────────────────────
  'users.title': 'Users',
  'users.subtitle': 'Create and manage TPMS user accounts',
  'users.create.title': 'Create New User',
  'users.create.subtitle': 'Create a new account with Dashboard-only access.',
  'users.create.roleNote': 'New accounts are automatically assigned',
  'users.create.roleDefault': 'Role: User',
  'users.existing.title': 'Existing Users',
  'users.existing.subtitle': 'All registered TPMS accounts.',
  'users.count.accounts': 'accounts',
  'users.loading': 'Loading users...',
  'users.empty.title': 'No users yet',
  'users.empty.description': 'User accounts you create will appear here.',
  'users.col.user': 'User',
  'users.col.username': 'Username',
  'users.col.role': 'Role',
  'users.col.status': 'Status',
  'users.col.created': 'Created',
  'users.col.actions': 'Actions',
  'users.status.active': 'Active',
  'users.status.disabled': 'Disabled',
  'users.role.admin': 'Administrator',
  'users.role.user': 'User',
  'users.action.edit': 'Edit',
  'users.action.activate': 'Activate',
  'users.action.deactivate': 'Deactivate',
  'users.action.editFor': 'Edit {name}',
  'users.action.activateFor': 'Activate {name}',
  'users.action.deactivateFor': 'Deactivate {name}',
  'users.self.deactivateBlocked': 'You cannot deactivate your own account',
  'users.create.email': 'Email',
  'users.create.emailPlaceholder': 'name@company.com',
  'users.create.password': 'Temporary Password',
  'users.create.passwordPlaceholder': 'Min. 6 characters',
  'users.create.username': 'Username',
  'users.create.usernamePlaceholder': 'e.g. ahmed',
  'users.create.displayName': 'Display Name',
  'users.create.displayNamePlaceholder': 'e.g. Ahmed Hassan',
  'users.create.submit': 'Create User',
  'users.create.creating': 'Creating...',
  'users.error.emailRequired': 'Email is required.',
  'users.error.emailInvalid': 'Enter a valid email address.',
  'users.error.passwordRequired': 'Password is required.',
  'users.error.passwordMin': 'At least 6 characters.',
  'users.error.usernameRequired': 'Username is required.',
  'users.error.displayNameRequired': 'Display name is required.',
  'users.success.created': 'User created successfully. They can now log in.',
  'users.success.updated': 'User updated successfully.',
  'users.success.deactivated': '{name} has been deactivated.',
  'users.success.activated': '{name} has been activated.',
  'users.error.selfChange': 'You cannot change the role of or deactivate your own account.',
  'users.error.selfDeactivate': 'You cannot deactivate your own account.',
  'users.error.unexpected': 'An unexpected error occurred.',
  'users.error.loadFailed': 'Failed to load users.',

  // ── Edit dialog ────────────────────────────────────────
  'users.edit.title': 'Edit User',
  'users.edit.displayName': 'Display Name',
  'users.edit.username': 'Username',
  'users.edit.role': 'Role',
  'users.edit.status': 'Status',
  'users.edit.active': 'Active account (disabled accounts cannot log in)',
  'users.edit.roleReadOnly': 'You cannot change your own role.',
  'users.edit.activeReadOnly': 'You cannot deactivate your own account.',
  'users.edit.save': 'Save Changes',
  'users.edit.saving': 'Saving...',
  'users.edit.close': 'Close edit dialog',
};
