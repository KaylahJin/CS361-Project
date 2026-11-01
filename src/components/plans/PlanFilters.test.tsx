import { describe, it, expect } from 'vitest';

import { buildStatusTabs } from './PlanFilters';
import type { PlanCounts } from '../../types/planReview';

const EMPTY: PlanCounts = {
  ALL: 0,
  SUBMITTED: 0,
  RETURNED: 0,
  APPROVED: 0,
  REJECTED: 0,
  PREPARING: 0,
};

const byId = (counts: PlanCounts, total: number) =>
  Object.fromEntries(buildStatusTabs(counts, total).map((tab) => [tab.id, tab]));

describe('buildStatusTabs', () => {
  it('always offers the four review statuses, even at zero', () => {
    const tabs = byId(EMPTY, 0);

    for (const id of ['SUBMITTED', 'RETURNED', 'APPROVED', 'REJECTED']) {
      expect(tabs[id]).toBeDefined();
      expect(tabs[id].count).toBe(0);
    }
  });

  it('hides ฉบับร่าง until a plan is in it, then adds DRAFT to the same tab', () => {
    expect(byId(EMPTY, 0).PREPARING).toBeUndefined();

    const tabs = byId({ ...EMPTY, ALL: 3, PREPARING: 2, DRAFT: 1 }, 3);

    expect(tabs.PREPARING.label).toBe('ฉบับร่าง');
    expect(tabs.PREPARING.count).toBe(3);
  });

  // The acceptance criterion on #142: the tabs must count every status, so a
  // status added by the new review workflow cannot go missing from the page.
  it('counts the statuses of the new review workflow', () => {
    const counts: PlanCounts = {
      ...EMPTY,
      ALL: 4,
      ENDORSED: 1,
      ELIGIBLE: 2,
      SELECTED: 1,
    };

    const tabs = byId(counts, 4);

    expect(tabs.ENDORSED.count).toBe(1);
    expect(tabs.ELIGIBLE.count).toBe(2);
    expect(tabs.SELECTED.count).toBe(1);
    expect(tabs.ENDORSED.label).toBe('อาจารย์รับรองแล้ว');
  });

  it('still shows a status it has no label for, under its own code', () => {
    const tabs = byId({ ...EMPTY, ALL: 1, WITHDRAWN: 1 }, 1);

    expect(tabs.WITHDRAWN.count).toBe(1);
    expect(tabs.WITHDRAWN.label).toBe('WITHDRAWN');
  });

  it('leaves out a status nobody is in, so the row stays short', () => {
    const tabs = byId({ ...EMPTY, ALL: 1, SUBMITTED: 1 }, 1);

    expect(tabs.ENDORSED).toBeUndefined();
    expect(tabs.WITHDRAWN).toBeUndefined();
  });

  it('adds up to the total across every tab but ทั้งหมด', () => {
    const counts: PlanCounts = {
      ...EMPTY,
      ALL: 7,
      SUBMITTED: 2,
      APPROVED: 1,
      PREPARING: 1,
      DRAFT: 1,
      ENDORSED: 1,
      WITHDRAWN: 1,
    };

    const sum = buildStatusTabs(counts, 7)
      .filter((tab) => tab.id !== 'ALL')
      .reduce((acc, tab) => acc + tab.count, 0);

    expect(sum).toBe(7);
  });
});
