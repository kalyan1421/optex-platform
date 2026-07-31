/**
 * @optex/api-client — typed client for the OPTEX NestJS API.
 *
 * Consumed by `apps/web` and `apps/admin`; doubles as the API contract.
 *
 * @example
 *   import { createApiClient } from '@optex/api-client';
 *
 *   const api = createApiClient({
 *     baseUrl: process.env.NEXT_PUBLIC_API_URL!,
 *     getAccessToken: () => supabase.auth.getSession().then((s) => s.data.session?.access_token ?? null),
 *   });
 *
 *   const { items } = await api.catalog.listProducts({ category: 'sunglasses' });
 */
export * from './client';
export * from './types';
