import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

/**
 * Customer account data: saved addresses, notifications and saved cards
 * (migration 0009).
 *
 * Every `customerId` is a `customers.id`, not an `auth.users.id`.
 */

// ─── Addresses ───────────────────────────────────────────────────────────────

export type Address = Database['public']['Tables']['customer_addresses']['Row'];
export type AddressInput = Omit<
  Database['public']['Tables']['customer_addresses']['Insert'],
  'customer_id' | 'id' | 'created_at' | 'updated_at'
>;

export async function listAddresses(
  db: SupabaseClient<Database>,
  customerId: string,
): Promise<Address[]> {
  const { data, error } = await db
    .from('customer_addresses')
    .select('*')
    .eq('customer_id', customerId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Clear any existing default before setting a new one.
 *
 * `customer_addresses_one_default_idx` is a partial UNIQUE index, so writing a
 * second default without clearing the first is rejected by the database rather
 * than silently producing two.
 */
async function clearDefault(db: SupabaseClient<Database>, customerId: string): Promise<void> {
  const { error } = await db
    .from('customer_addresses')
    .update({ is_default: false })
    .eq('customer_id', customerId)
    .eq('is_default', true);
  if (error) throw error;
}

export async function saveAddress(
  db: SupabaseClient<Database>,
  customerId: string,
  input: AddressInput,
  addressId?: string,
): Promise<void> {
  if (input.is_default) await clearDefault(db, customerId);

  if (addressId) {
    const { error } = await db
      .from('customer_addresses')
      .update(input)
      .eq('id', addressId)
      .eq('customer_id', customerId);
    if (error) throw error;
    return;
  }

  const { error } = await db
    .from('customer_addresses')
    .insert({ ...input, customer_id: customerId });
  if (error) throw error;
}

export async function deleteAddress(
  db: SupabaseClient<Database>,
  customerId: string,
  addressId: string,
): Promise<void> {
  const { error } = await db
    .from('customer_addresses')
    .delete()
    .eq('id', addressId)
    .eq('customer_id', customerId);
  if (error) throw error;
}

export async function setDefaultAddress(
  db: SupabaseClient<Database>,
  customerId: string,
  addressId: string,
): Promise<void> {
  await clearDefault(db, customerId);
  const { error } = await db
    .from('customer_addresses')
    .update({ is_default: true })
    .eq('id', addressId)
    .eq('customer_id', customerId);
  if (error) throw error;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export type Notification = Database['public']['Tables']['notifications']['Row'];

export async function listNotifications(
  db: SupabaseClient<Database>,
  customerId: string,
  limit = 50,
): Promise<Notification[]> {
  const { data, error } = await db
    .from('notifications')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function countUnreadNotifications(
  db: SupabaseClient<Database>,
  customerId: string,
): Promise<number> {
  const { count, error } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .is('read_at', null);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Customers may only UPDATE notifications (RLS grants select + update, never
 * insert or delete) — they are authored by the API with the service-role key.
 */
export async function markNotificationRead(
  db: SupabaseClient<Database>,
  customerId: string,
  notificationId: string,
): Promise<void> {
  const { error } = await db
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('customer_id', customerId)
    .is('read_at', null);
  if (error) throw error;
}

export async function markAllNotificationsRead(
  db: SupabaseClient<Database>,
  customerId: string,
): Promise<void> {
  const { error } = await db
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('customer_id', customerId)
    .is('read_at', null);
  if (error) throw error;
}

// ─── Saved cards ─────────────────────────────────────────────────────────────

export type SavedCard = Database['public']['Tables']['saved_cards']['Row'];

/**
 * Saved cards hold a gateway token plus display fragments only — never a card
 * number or CVV. See the PCI note in migration 0009.
 */
export async function listSavedCards(
  db: SupabaseClient<Database>,
  customerId: string,
): Promise<SavedCard[]> {
  const { data, error } = await db
    .from('saved_cards')
    .select('*')
    .eq('customer_id', customerId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function deleteSavedCard(
  db: SupabaseClient<Database>,
  customerId: string,
  cardId: string,
): Promise<void> {
  const { error } = await db
    .from('saved_cards')
    .delete()
    .eq('id', cardId)
    .eq('customer_id', customerId);
  if (error) throw error;
}

export async function setDefaultCard(
  db: SupabaseClient<Database>,
  customerId: string,
  cardId: string,
): Promise<void> {
  const cleared = await db
    .from('saved_cards')
    .update({ is_default: false })
    .eq('customer_id', customerId)
    .eq('is_default', true);
  if (cleared.error) throw cleared.error;

  const { error } = await db
    .from('saved_cards')
    .update({ is_default: true })
    .eq('id', cardId)
    .eq('customer_id', customerId);
  if (error) throw error;
}

/** True when a card's expiry month/year is in the past. */
export function isCardExpired(card: Pick<SavedCard, 'exp_month' | 'exp_year'>): boolean {
  if (!card.exp_month || !card.exp_year) return false;
  const now = new Date();
  const endOfMonth = new Date(card.exp_year, card.exp_month, 1);
  return endOfMonth <= new Date(now.getFullYear(), now.getMonth(), 1);
}
