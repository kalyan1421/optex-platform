/**
 * Maps each top-level admin route to the permission that gates it — the
 * frontend mirror of the `@RequirePermission(...)` decorators on the
 * corresponding NestJS controllers (CR-01 R1). Single source of truth for
 * `PermissionGate` (page-level access), `AdminSidebar` (nav filtering), and
 * `login/page.tsx` (first-permitted-page redirect), so the three can't drift
 * out of sync with each other.
 *
 * A route's permission here is the READ permission for that surface — the
 * one that determines whether the page is reachable at all. Write actions
 * within a page (e.g. editing a product) are gated separately by the
 * relevant `.write` permission at the point of the mutation, same as the API.
 */
export const ROUTE_PERMISSIONS: Record<string, string> = {
  dashboard: 'dashboard.read',
  analytics: 'analytics.read',
  products: 'products.read',
  inventory: 'inventory.read',
  orders: 'orders.read',
  appointments: 'appointments.read',
  customers: 'customers.read',
  prescriptions: 'prescriptions.read',
  cancellations: 'cancellations.decide',
  reviews: 'reviews.moderate',
  promotions: 'promotions.read',
  branches: 'branches.read',
  payments: 'payments.read',
  staff: 'staff.manage',
};

/** The route segment a pathname like `/inventory/foo` starts with, or `null` for `/`. */
export function routeSegment(pathname: string): string | null {
  const segment = pathname.split('/').filter(Boolean)[0];
  return segment ?? null;
}

/** The permission required for a pathname, or `null` if the route isn't in the map (public/unknown). */
export function permissionForRoute(pathname: string): string | null {
  const segment = routeSegment(pathname);
  return segment ? (ROUTE_PERMISSIONS[segment] ?? null) : null;
}

/** The first route (in this object's declared order) a permission set can reach. */
export function firstPermittedRoute(permissions: string[]): string | null {
  const granted = new Set(permissions);
  for (const [route, permission] of Object.entries(ROUTE_PERMISSIONS)) {
    if (granted.has(permission)) return route;
  }
  return null;
}
