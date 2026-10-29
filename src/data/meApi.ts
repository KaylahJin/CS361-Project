const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Me {
  role: string;
  studentId: string | null;
}

/**
 * Asks the API which role the signed-in account has. The role is kept in the
 * database, not in the token, so the page cannot read it any other way.
 * Throws on any non-2xx so the caller can fall back to "no role", which hides
 * the role-only screens instead of showing them to the wrong person.
 */
export async function getMe(idToken: string): Promise<Me> {
  const res = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch current user: ${res.status}`);
  }

  return res.json();
}
