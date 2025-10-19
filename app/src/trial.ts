import { supabase } from './supabase';

export async function getHandsUsed(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data } = await supabase.from('profiles').select('hands_used').eq('id', user.id).single();
  return data?.hands_used ?? 0;
}
export async function incHandsUsed(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data, error } = await supabase.rpc('inc_hands_used', { uid: user.id });
  if (error) throw error;
  return data as number;
}
