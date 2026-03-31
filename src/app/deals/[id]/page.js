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

  // Fetch invoices separately to avoid PostgREST schema cache issues
  const lineItemIds = (data.deal_line_items || []).map((i) => i.id);
  let invoicesByItem = {};

  if (lineItemIds.length > 0) {
    const { data: invoices } = await supabase
      .from('line_item_invoices')
      .select('*')
      .in('line_item_id', lineItemIds)
      .order('invoice_date', { ascending: true });

    (invoices || []).forEach((inv) => {
      if (!invoicesByItem[inv.line_item_id]) invoicesByItem[inv.line_item_id] = [];
      invoicesByItem[inv.line_item_id].push(inv);
    });
  }

  data.deal_line_items = (data.deal_line_items || [])
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((item) => ({ ...item, line_item_invoices: invoicesByItem[item.id] || [] }));

  return data;
}

export default async function DealDetailPage({ params }) {
  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) notFound();

  return <DealDetailClient deal={deal} />;
}
