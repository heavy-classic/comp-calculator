export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request, { params }) {
  const { id } = await params;

  const { data, error } = await supabase
    .from('line_item_invoices')
    .select('*')
    .eq('line_item_id', id)
    .order('invoice_date', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json();

  if (!body.amount || !body.invoice_date) {
    return NextResponse.json({ error: 'Amount and invoice date are required.' }, { status: 400 });
  }

  // Fetch line item for proportional commission calculation
  const { data: lineItem, error: lineItemError } = await supabase
    .from('deal_line_items')
    .select('amount, commission_amount, is_excluded')
    .eq('id', id)
    .single();

  if (lineItemError || !lineItem) {
    return NextResponse.json({ error: 'Line item not found.' }, { status: 404 });
  }

  // Commission is proportional: (invoiceAmount / lineItemAmount) * lineItemCommission
  let commissionAmount = 0;
  if (!lineItem.is_excluded && parseFloat(lineItem.amount) > 0) {
    const proportion = parseFloat(body.amount) / parseFloat(lineItem.amount);
    commissionAmount = +(proportion * parseFloat(lineItem.commission_amount || 0)).toFixed(2);
  }

  const { data, error } = await supabase
    .from('line_item_invoices')
    .insert([{
      line_item_id: id,
      amount: parseFloat(body.amount),
      invoice_date: body.invoice_date,
      notes: body.notes || null,
      commission_amount: commissionAmount,
    }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
