import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateLineItemCommission } from '@/lib/commission';

export async function PUT(request, { params }) {
  const body = await request.json();

  // Fetch deal for commission calc
  const { data: item } = await supabase
    .from('deal_line_items')
    .select('deal_id')
    .eq('id', params.id)
    .single();

  let rate = body.commission_rate;
  let commissionAmount = body.commission_amount;
  let isExcluded = body.is_excluded;
  let exclusionReason = body.exclusion_reason;

  if (item) {
    const { data: deal } = await supabase
      .from('deals')
      .select('deal_type, service_type')
      .eq('id', item.deal_id)
      .single();

    if (deal) {
      const calc = calculateLineItemCommission({
        dealType: deal.deal_type,
        serviceType: deal.service_type,
        amount: body.amount,
        netProfit: body.net_profit,
        grossMarginPercent: body.gross_margin_percent,
        yearNumber: body.year_number || 1,
        isUpsell: body.is_upsell || false,
      });

      rate = calc.rate;
      commissionAmount = calc.commissionAmount;
      isExcluded = calc.isExcluded;
      exclusionReason = calc.exclusionReason;
    }
  }

  const { data, error } = await supabase
    .from('deal_line_items')
    .update({
      description: body.description,
      item_type: body.item_type || 'Other',
      amount: body.amount,
      net_profit: body.net_profit || null,
      gross_margin_percent: body.gross_margin_percent || null,
      invoice_date: body.invoice_date || null,
      status: body.status,
      year_number: body.year_number || 1,
      is_upsell: body.is_upsell || false,
      commission_rate: rate,
      commission_amount: commissionAmount,
      is_excluded: isExcluded,
      exclusion_reason: exclusionReason,
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Recalc deal total
  if (item) {
    const { data: items } = await supabase
      .from('deal_line_items')
      .select('amount')
      .eq('deal_id', item.deal_id);

    if (items) {
      const total = items.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
      await supabase
        .from('deals')
        .update({ total_value: total })
        .eq('id', item.deal_id);
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(request, { params }) {
  // Get deal_id before delete
  const { data: item } = await supabase
    .from('deal_line_items')
    .select('deal_id')
    .eq('id', params.id)
    .single();

  const { error } = await supabase
    .from('deal_line_items')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Recalc deal total
  if (item) {
    const { data: items } = await supabase
      .from('deal_line_items')
      .select('amount')
      .eq('deal_id', item.deal_id);

    if (items) {
      const total = items.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
      await supabase
        .from('deals')
        .update({ total_value: total })
        .eq('id', item.deal_id);
    }
  }

  return NextResponse.json({ success: true });
}
