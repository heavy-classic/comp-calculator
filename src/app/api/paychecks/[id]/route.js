import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request, { params }) {
  const { data, error } = await supabase
    .from('paychecks')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(request, { params }) {
  const body = await request.json();

  const { data, error } = await supabase
    .from('paychecks')
    .update({
      pay_date: body.pay_date || null,
      pay_period_start: body.pay_period_start || null,
      pay_period_end: body.pay_period_end || null,
      gross_amount: body.gross_amount || null,
      commission_amount: body.commission_amount || null,
      base_salary: body.base_salary || null,
      other_earnings: body.other_earnings || null,
      total_deductions: body.total_deductions || null,
      net_amount: body.net_amount || null,
      notes: body.notes || null,
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
    .from('paychecks')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
