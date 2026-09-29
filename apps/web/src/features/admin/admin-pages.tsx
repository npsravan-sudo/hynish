/**
 * Admin pages barrel (Phase 10). Re-exports the real implementations built this phase.
 * The router lazy-loads this module so the admin code only loads when the user navigates
 * to an admin route.
 */
export { SettingsPage } from './settings-page';
export { UsersPage } from './users-page';
export { ActivityPage } from './activity-page';
