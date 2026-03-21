import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('deals')
    .select(`
      *,
      deal_line_items (*)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request) {
  const body = await request.json();

  const { data, error } = await supabase
    .from('deals')
    .insert([{
      customer_name: body.customer_name,
      deal_name: body.deal_name,
      service_type: body.service_type,
      deal_type: body.deal_type,
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
