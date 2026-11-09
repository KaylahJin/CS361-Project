import { describe, it, expect } from 'vitest';
import { TAB_IDS, formatHash, parseHash, sameRoute } from './tabHash';

describe('parseHash', () => {
  it('reads each known tab', () => {
    for (const tab of TAB_IDS) {
      expect(parseHash(`#${tab}`)).toEqual({ tab, planId: null });
    }
  });

  it('falls back to home for an empty or unknown hash', () => {
    expect(parseHash('')).toEqual({ tab: 'home', planId: null });
    expect(parseHash('#')).toEqual({ tab: 'home', planId: null });
    expect(parseHash('#no-such-page')).toEqual({ tab: 'home', planId: null });
  });

  it('reads the open plan on the coop-plans tab', () => {
    expect(parseHash('#coop-plans/12')).toEqual({ tab: 'coop-plans', planId: 12 });
  });

  it('ignores a plan id that is not a positive whole number', () => {
    expect(parseHash('#coop-plans/abc')).toEqual({ tab: 'coop-plans', planId: null });
    expect(parseHash('#coop-plans/0')).toEqual({ tab: 'coop-plans', planId: null });
    expect(parseHash('#coop-plans/-3')).toEqual({ tab: 'coop-plans', planId: null });
    expect(parseHash('#coop-plans/1.5')).toEqual({ tab: 'coop-plans', planId: null });
  });

  it('ignores a plan id on any other tab', () => {
    expect(parseHash('#employers/12')).toEqual({ tab: 'employers', planId: null });
  });
});

describe('formatHash', () => {
  it('writes the tab, and the plan only for coop-plans', () => {
    expect(formatHash({ tab: 'employers', planId: null })).toBe('#employers');
    expect(formatHash({ tab: 'coop-plans', planId: null })).toBe('#coop-plans');
    expect(formatHash({ tab: 'coop-plans', planId: 7 })).toBe('#coop-plans/7');
    expect(formatHash({ tab: 'employers', planId: 7 })).toBe('#employers');
  });

  it('round-trips through parseHash', () => {
    const route = { tab: 'coop-plans', planId: 42 } as const;
    expect(parseHash(formatHash(route))).toEqual(route);
  });
});

describe('sameRoute', () => {
  it('compares tab and plan', () => {
    expect(sameRoute({ tab: 'home', planId: null }, { tab: 'home', planId: null })).toBe(true);
    expect(sameRoute({ tab: 'coop-plans', planId: 1 }, { tab: 'coop-plans', planId: 2 })).toBe(false);
    expect(sameRoute({ tab: 'home', planId: null }, { tab: 'periods', planId: null })).toBe(false);
  });
});
