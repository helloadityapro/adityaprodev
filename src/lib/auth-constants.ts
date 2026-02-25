
/**
 * Centralized list of Super Admin emails for the Aditya Pro application.
 * These users bypass standard role checks and have full system access.
 */
export const SUPER_ADMIN_EMAILS = [
  'abhijeetsb22@gmail.com',
  'khalil@adityagreenenergy.com',
  'prafulrana143@gmail.com'
];

/**
 * Checks if a given email belongs to a Super Admin.
 */
export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}
