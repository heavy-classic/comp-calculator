import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data: deals, error } = await supabase
    .from('deals')
    .select('*, deal_line_items(*)')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch invoices separately (avoids PostgREST schema cache issues)
  const lineItemIds = (deals || []).flatMap((d) => (d.deal_line_items || []).map((i) => i.id));
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

  const result = (deals || []).map((deal) => ({
    ...deal,
    deal_line_items: (deal.deal_line_items || []).map((item) => ({
      ...item,
      line_item_invoices: invoicesByItem[item.id] || [],
    })),
  }));

  return NextResponse.json(result);
}

export async function POST(request) {
  const body = await request.json();

  const { data, error } = await supabase
    .from('deals')
    .insert([{
      customer_name: body.customer_name,
      deal_name: body.deal_name,
      service_type: body.service_type,
      status: body.status || 'Pending',
      total_value: body.total_value || 0,
      notes: body.notes || null,
      close_date: body.close_date || null,
    }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
