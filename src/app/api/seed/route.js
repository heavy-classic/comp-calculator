import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateLineItemCommission } from '@/lib/commission';

// POST /api/seed  → insert demo data
// DELETE /api/seed → wipe all data

export async function POST() {
  try {
    // ── 1. Insert demo deals ──────────────────────────────────────────────
    const { data: deals, error: dealErr } = await supabase
      .from('deals')
      .insert([
        {
          customer_name: 'PPPO Corporation',
          deal_name: 'PPPO - IdeaGen EHS Platform',
          service_type: 'IdeaGen',
          deal_type: 'Implementation',
          status: 'Invoiced',
          notes: '[DEMO]',
          close_date: '2025-01-15',
        },
        {
          customer_name: 'ABC Healthcare',
          deal_name: 'ABC - IdeaGen Annual Renewal',
          service_type: 'IdeaGen',
          deal_type: 'Renewal',
          status: 'Invoiced',
          notes: '[DEMO]',
          close_date: '2025-02-01',
        },
        {
          customer_name: 'XYZ Technologies',
          deal_name: 'XYZ - Safety Management System',
          service_type: 'Other',
          deal_type: 'Implementation',
          status: 'Closed',
          notes: '[DEMO]',
          close_date: '2025-03-10',
        },
        {
          customer_name: 'MegaCorp Industries',
          deal_name: 'MegaCorp - Enterprise Software Resale',
          service_type: 'Other',
          deal_type: 'SoftwareResale',
          status: 'Invoiced',
          notes: '[DEMO]',
          close_date: '2025-01-20',
        },
        {
          customer_name: 'Sunrise Energy',
          deal_name: 'Sunrise - IdeaGen Renewal Q2',
          service_type: 'IdeaGen',
          deal_type: 'Renewal',
          status: 'Pending',
          notes: '[DEMO]',
          close_date: '2025-06-30',
        },
      ])
      .select();

    if (dealErr) throw dealErr;

    const [pppo, abc, xyz, mega, sunrise] = deals;

    // ── 2. Build line items ───────────────────────────────────────────────
    const lineItemDefs = [
      // PPPO — IdeaGen Implementation
      ...['2025-02-28','2025-03-31','2025-04-30','2025-05-31','2025-06-30','2025-07-31'].map((dt, i) => ({
        deal_id: pppo.id,
        description: `Monthly Consulting Fee - ${dt.substring(0,7)}`,
        item_type: 'Consulting',
        amount: 12333.33,
        invoice_date: dt,
        status: i < 4 ? 'Invoiced' : 'Pending',
      })),
      {
        deal_id: pppo.id,
        description: 'IdeaGen Platform License - Year 1',
        item_type: 'License',
        amount: 28000,
        invoice_date: '2025-01-31',
        status: 'Invoiced',
      },
      {
        deal_id: pppo.id,
        description: 'User Training & Onboarding',
        item_type: 'Consulting',
        amount: 8500,
        invoice_date: '2025-02-15',
        status: 'Invoiced',
      },
      {
        deal_id: pppo.id,
        description: 'Annual Support Package',
        item_type: 'Support',
        amount: 6000,
        invoice_date: '2025-03-01',
        status: 'Invoiced',
      },
      // ABC — IdeaGen Renewal
      {
        deal_id: abc.id,
        description: 'Annual Platform Renewal Fee',
        item_type: 'Maintenance',
        amount: 45000,
        invoice_date: '2025-02-01',
        status: 'Invoiced',
      },
      {
        deal_id: abc.id,
        description: 'Premium Support Renewal',
        item_type: 'Support',
        amount: 12000,
        invoice_date: '2025-02-01',
        status: 'Invoiced',
      },
      // XYZ — Other Implementation
      {
        deal_id: xyz.id,
        description: 'Implementation & Configuration Services',
        item_type: 'Consulting',
        amount: 85000,
        gross_margin_percent: 68,
        invoice_date: '2025-04-15',
        status: 'Invoiced',
      },
      {
        deal_id: xyz.id,
        description: 'Software License - Safety Module',
        item_type: 'License',
        amount: 25000,
        gross_margin_percent: 78,
        invoice_date: '2025-03-31',
        status: 'Invoiced',
      },
      {
        deal_id: xyz.id,
        description: 'End-User Training Program',
        item_type: 'Consulting',
        amount: 12500,
        gross_margin_percent: 55,
        invoice_date: '2025-05-01',
        status: 'Pending',
      },
      // MegaCorp — SoftwareResale Year 1
      {
        deal_id: mega.id,
        description: 'Enterprise License Resale - Year 1',
        item_type: 'License',
        amount: 65000,
        net_profit: 18000,
        invoice_date: '2025-01-31',
        status: 'Invoiced',
        year_number: 1,
        is_upsell: false,
      },
      {
        deal_id: mega.id,
        description: 'Annual Maintenance Resale',
        item_type: 'Maintenance',
        amount: 14000,
        net_profit: 5200,
        invoice_date: '2025-01-31',
        status: 'Invoiced',
        year_number: 1,
        is_upsell: false,
      },
      // Sunrise — IdeaGen Renewal (Pending)
      {
        deal_id: sunrise.id,
        description: 'Annual IdeaGen Renewal',
        item_type: 'Maintenance',
        amount: 38000,
        invoice_date: '2025-06-30',
        status: 'Pending',
      },
      {
        deal_id: sunrise.id,
        description: 'Support Package Renewal',
        item_type: 'Support',
        amount: 9500,
        invoice_date: '2025-06-30',
        status: 'Pending',
      },
    ];

    // Calculate commission for each
    const dealMap = { [pppo.id]: pppo, [abc.id]: abc, [xyz.id]: xyz, [mega.id]: mega, [sunrise.id]: sunrise };
    const lineItemsToInsert = lineItemDefs.map((li) => {
      const deal = dealMap[li.deal_id];
      const { rate, commissionAmount, isExcluded, exclusionReason } = calculateLineItemCommission({
        dealType: deal.deal_type,
        serviceType: deal.service_type,
        amount: li.amount,
        netProfit: li.net_profit || null,
        grossMarginPercent: li.gross_margin_percent || null,
        yearNumber: li.year_number || 1,
        isUpsell: li.is_upsell || false,
      });
      return {
        ...li,
        year_number: li.year_number || 1,
        is_upsell: li.is_upsell || false,
        commission_rate: rate,
        commission_amount: commissionAmount,
        is_excluded: isExcluded,
        exclusion_reason: exclusionReason,
      };
    });

    const { error: liErr } = await supabase.from('deal_line_items').insert(lineItemsToInsert);
    if (liErr) throw liErr;

    // Recalc deal totals
    for (const deal of deals) {
      const { data: items } = await supabase
        .from('deal_line_items')
        .select('amount')
        .eq('deal_id', deal.id);
      if (items) {
        const total = items.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
        await supabase.from('deals').update({ total_value: total }).eq('id', deal.id);
      }
    }

    // ── 3. Insert demo paychecks ──────────────────────────────────────────
    const { error: pcErr } = await supabase.from('paychecks').insert([
      {
        pay_date: '2025-02-28',
        pay_period_start: '2025-02-01',
        pay_period_end: '2025-02-28',
        base_salary: 5833.33,
        commission_amount: 6140.00,
        other_earnings: 0,
        gross_amount: 11973.33,
        total_deductions: 2850.00,
        net_amount: 9123.33,
        file_name: 'paycheck_feb2025_DEMO.pdf',
        notes: '[DEMO]',
      },
      {
        pay_date: '2025-03-31',
        pay_period_start: '2025-03-01',
        pay_period_end: '2025-03-31',
        base_salary: 5833.33,
        commission_amount: 9815.00,
        other_earnings: 500,
        gross_amount: 16148.33,
        total_deductions: 3650.00,
        net_amount: 12498.33,
        file_name: 'paycheck_mar2025_DEMO.pdf',
        notes: '[DEMO]',
      },
      {
        pay_date: '2025-04-30',
        pay_period_start: '2025-04-01',
        pay_period_end: '2025-04-30',
        base_salary: 5833.33,
        commission_amount: 4875.00,
        other_earnings: 0,
        gross_amount: 10708.33,
        total_deductions: 2550.00,
        net_amount: 8158.33,
        file_name: 'paycheck_apr2025_DEMO.pdf',
        notes: '[DEMO]',
      },
    ]);
    if (pcErr) throw pcErr;

    return NextResponse.json({ success: true, deals: deals.length, lineItems: lineItemsToInsert.length, paychecks: 3 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    // Delete all data (line items cascade delete when deals are deleted)
    const { error: e1 } = await supabase.from('paychecks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e1) throw e1;
    const { error: e2 } = await supabase.from('deals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e2) throw e2;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
