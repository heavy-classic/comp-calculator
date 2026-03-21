import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/commission';
import Link from 'next/link';
import DealsClient from './DealsClient';

async function getDeals() {
  const { data, error } = await supabase
    .from('deals')
    .select('*, deal_line_items(*)')
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export default async function DealsPage() {
  const deals = await getDeals();

  return <DealsClient initialDeals={deals} />;
}
