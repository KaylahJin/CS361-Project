// ============================================================
// CS361 V3-02.1 — gate for pages that require a signed-in user
// ============================================================
// Issue: #99 — ผู้ที่ไม่ได้ Login เข้าหน้าที่ป้องกันไว้ไม่ได้
//
// This is a UI convenience, NOT a security boundary. Per
// docs/overview/V3-01-workflow-permissions.md §1, "การซ่อนปุ่มใน Frontend
// ไม่ถือเป็นการตรวจสิทธิ์ที่เพียงพอ" — the Lambda re-checks identity and
// role on every request (see infra/lambda/companies/authorize.mjs).
// Wrapping a page here hides it; it does not protect its data.
//
// Public pages (ประกาศ / เกณฑ์ / ตำแหน่งงาน) are deliberately NOT wrapped.
// ============================================================

import type React from 'react';
import { useAuth } from '../auth/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Shown to signed-out visitors — normally the Login page. */
  fallback: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, fallback }) => {
  const { status } = useAuth();

  // Render nothing, not the fallback: restoring a stored session is async,
  // and showing the login form during that window would flash it at an
  // already-signed-in user on every page load.
  if (status === 'loading') return null;

  if (status === 'anonymous') return <>{fallback}</>;

  return <>{children}</>;
};
export default ProtectedRoute;
