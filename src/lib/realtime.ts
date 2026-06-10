import { supabase } from './supabase';

/**
 * Subscribe to all row changes on a table (insert/update/delete) and run
 * `handler` on each. RLS applies to realtime too, so a client only receives
 * changes for rows it's allowed to see. Returns an unsubscribe function.
 */
export function onTableChange(table: string, handler: () => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`rt-${table}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => handler())
    .subscribe();
  return () => { void supabase!.removeChannel(channel); };
}

/** Subscribe to several tables at once; returns a single unsubscribe. */
export function onTablesChange(tables: string[], handler: () => void): () => void {
  const unsubs = tables.map((t) => onTableChange(t, handler));
  return () => unsubs.forEach((u) => u());
}
