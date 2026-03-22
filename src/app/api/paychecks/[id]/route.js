import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request, { params }) {
  const { id } = await params;
  const { data, error } = await supabase
    .from('paychecks')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const body = await request.json();

  const num = (k) => { const n = parseFloat(body[k]); return isNaN(n) ? null : n; };

  const { data, error } = await supabase
    .from('paychecks')
    .update({
      pay_date:               body.pay_date || null,
      pay_period_start:       body.pay_period_start || null,
      pay_period_end:         body.pay_period_end || null,
      gross_amount:           num('gross_amount'),
      commission_amount:      num('commission_amount'),
      base_salary:            num('base_salary'),
      other_earnings:         num('other_earnings'),
      hours_worked:           num('hours_worked'),
      federal_income_tax:     num('federal_income_tax'),
      social_security_tax:    num('social_security_tax'),
      medicare_tax:           num('medicare_tax'),
      state_income_tax:       num('state_income_tax'),
      medical_deduction:      num('medical_deduction'),
      retirement_401k:        num('retirement_401k'),
      expense_reimbursement:  num('expense_reimbursement'),
      total_deductions:       num('total_deductions'),
      federal_taxable_wages:  num('federal_taxable_wages'),
      state_taxable_wages:    num('state_taxable_wages'),
      net_amount:             num('net_amount'),
      notes:                  body.notes || null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { error } = await supabase
    .from('paychecks')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
