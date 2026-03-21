import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateLineItemCommission } from '@/lib/commission';

export async function POST(request, { params }) {
  const body = await request.json();

  // Fetch deal to get type/service for commission calc
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('deal_type, service_type')
    .eq('id', params.id)
    .single();

  if (dealError) {
    return NextResponse.json({ error: dealError.message }, { status: 404 });
  }

  const { rate, commissionAmount, isExcluded, exclusionReason } = calculateLineItemCommission({
    dealType: deal.deal_type,
    serviceType: deal.service_type,
    amount: body.amount,
    netProfit: body.net_profit,
    grossMarginPercent: body.gross_margin_percent,
    yearNumber: body.year_number || 1,
    isUpsell: body.is_upsell || false,
  });

  const { data, error } = await supabase
    .from('deal_line_items')
    .insert([{
      deal_id: params.id,
      description: body.description,
      amount: body.amount,
      net_profit: body.net_profit || null,
      gross_margin_percent: body.gross_margin_percent || null,
      invoice_date: body.invoice_date || null,
      status: body.status || 'Pending',
      year_number: body.year_number || 1,
      is_upsell: body.is_upsell || false,
      commission_rate: rate,
      commission_amount: commissionAmount,
      is_excluded: isExcluded,
      exclusion_reason: exclusionReason,
    }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update deal total_value
  await recalcDealTotal(params.id);

  return NextResponse.json(data, { status: 201 });
}

async function recalcDealTotal(dealId) {
  const { data: items } = await supabase
    .from('deal_line_items')
    .select('amount')
    .eq('deal_id', dealId);

  if (items) {
    const total = items.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    await supabase
      .from('deals')
      .update({ total_value: total })
      .eq('id', dealId);
  }
}
