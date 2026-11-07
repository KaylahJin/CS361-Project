import { describe, it, expect } from 'vitest';
import { canUsePlanReviewTools } from './roles';

describe('canUsePlanReviewTools', () => {
  it('is off for a student, who sees only their own plans', () => {
    expect(canUsePlanReviewTools('STUDENT')).toBe(false);
  });

  it.each(['ADVISOR', 'STAFF', 'COORDINATOR', 'COMMITTEE'])('is on for %s', (role) => {
    expect(canUsePlanReviewTools(role)).toBe(true);
  });

  it('is off for roles with no plan page, and when nobody is signed in', () => {
    expect(canUsePlanReviewTools('ADMIN')).toBe(false);
    expect(canUsePlanReviewTools(null)).toBe(false);
    expect(canUsePlanReviewTools(undefined)).toBe(false);
  });
});
