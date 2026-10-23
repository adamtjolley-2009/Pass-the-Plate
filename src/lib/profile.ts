export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

export interface ProfileNames {
  firstName: string;
  lastName: string;
  username: string;
}

// Usernames are lowercase letters, numbers and underscores
export function normalizeUsername(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, USERNAME_MAX);
}

// Returns an error message, or null when the fields are valid
export function validateProfileNames({ firstName, lastName, username }: ProfileNames): string | null {
  if (!firstName.trim()) return "Please enter your first name.";
  if (!lastName.trim()) return "Please enter your last name.";
  if (username.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters.`;
  if (username !== normalizeUsername(username)) return "Username can only use letters, numbers and underscores.";
  return null;
}

export function isProfileComplete(
  profile: { first_name: string | null; last_name: string | null; username: string | null } | null | undefined
): boolean {
  return !!(profile?.first_name?.trim() && profile?.last_name?.trim() && profile?.username?.trim());
}
