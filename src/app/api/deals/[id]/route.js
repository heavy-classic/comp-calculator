import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request, { params }) {
  const { data, error } = await supabase
    .from('deals')
    .select(`
      *,
      deal_line_items (*)
    `)
    .eq('id', params.id)
    .order('invoice_date', { ascending: true, foreignTable: 'deal_line_items' })
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(request, { params }) {
  const body = await request.json();

  const { data, error } = await supabase
    .from('deals')
    .update({
      customer_name: body.customer_name,
      deal_name: body.deal_name,
      service_type: body.service_type,
      deal_type: body.deal_type,
      status: body.status,
      total_value: body.total_value,
      notes: body.notes,
      close_date: body.close_date || null,
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
