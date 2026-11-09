// The app picks its page from a tab held in React state, not from the URL, so
// a refresh (F5) used to reset it to the home page (#200). The page is kept in
// the URL hash instead of the path: the site is a static S3 website, and a path
// such as /coop-plans would answer 404 on refresh.
//
//   #coop-plans        the coop plan list
//   #coop-plans/12     the detail page of plan 12
//
// Anything unknown falls back to the home page rather than a blank screen.

import type { TabType } from '../components/Navbar';

export const TAB_IDS: readonly TabType[] = [
  'home',
  'requirements',
  'employers',
  'positions',
  'students',
  'coop-plans',
  'periods',
  'login',
  'account',
];

export interface HashRoute {
  tab: TabType;
  /** Only used by the coop-plans tab: the plan detail page that is open. */
  planId: number | null;
}

export const HOME_ROUTE: HashRoute = { tab: 'home', planId: null };

function isTab(value: string): value is TabType {
  return (TAB_IDS as readonly string[]).includes(value);
}

export function parseHash(hash: string): HashRoute {
  const [tabPart = '', planPart] = hash.replace(/^#\/?/, '').split('/');

  if (!isTab(tabPart)) return HOME_ROUTE;

  if (tabPart === 'coop-plans' && planPart !== undefined && /^[1-9]\d*$/.test(planPart)) {
    return { tab: tabPart, planId: Number(planPart) };
  }

  return { tab: tabPart, planId: null };
}

export function formatHash(route: HashRoute): string {
  if (route.tab === 'coop-plans' && route.planId != null) {
    return `#coop-plans/${route.planId}`;
  }

  return `#${route.tab}`;
}

export function sameRoute(a: HashRoute, b: HashRoute): boolean {
  return a.tab === b.tab && a.planId === b.planId;
}
