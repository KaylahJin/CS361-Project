// Hides pages from signed-out visitors. This is a UI convenience, not a
// security boundary — hiding a page does not protect its data, so the Lambda
// checks identity and role again on every request.

import type React from 'react';
import { useAuth } from '../auth/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Shown to signed-out visitors — normally the Login page. */
  fallback: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, fallback }) => {
  const { status } = useAuth();

  // Nothing, not the fallback: restoring a stored session takes a moment, and
  // showing the login form in that window would flash it at a signed-in user
  // on every page load.
  if (status === 'loading') return null;

  if (status === 'anonymous') return <>{fallback}</>;

  return <>{children}</>;
};
export default ProtectedRoute;
