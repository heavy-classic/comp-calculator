export const dynamic = 'force-dynamic';
import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import DealDetailClient from './DealDetailClient';

async function getDeal(id) {
  const { data, error } = await supabase
    .from('deals')
    .select('*, deal_line_items(*)')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  // Sort line items by invoice_date
  if (data.deal_line_items) {
    data.deal_line_items.sort((a, b) => {
      if (!a.invoice_date && !b.invoice_date) return 0;
      if (!a.invoice_date) return 1;
      if (!b.invoice_date) return -1;
      return new Date(a.invoice_date) - new Date(b.invoice_date);
    });
  }

  return data;
}

export default async function DealDetailPage({ params }) {
  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) notFound();

  return <DealDetailClient deal={deal} />;
}
