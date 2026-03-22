import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('paychecks')
    .select('*')
    .order('pay_date', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');
    const metadata = formData.get('metadata');
    const meta = metadata ? JSON.parse(metadata) : {};

    let extractedText = '';
    let extractedData = {};

    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      try {
        const pdfParse = (await import('pdf-parse')).default;
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text || '';
        extractedData = parsePdfText(extractedText);
      } catch (err) {
        console.error('PDF parse error:', err);
        extractedText = 'PDF parsing failed. Please enter details manually.';
      }
    }

    const insertData = buildInsert(meta, extractedData, file ? file.name : null, extractedText);

    const { data, error } = await supabase
      .from('paychecks')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  }

  // Handle JSON (manual entry)
  const body = await request.json();

  const { data, error } = await supabase
    .from('paychecks')
    .insert([buildInsert(body, {}, null, null)])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

/** Merge override fields on top of extracted data */
function buildInsert(override, extracted, fileName, extractedText) {
  const pick = (key) => {
    const v = override[key] ?? extracted[key];
    return v !== '' && v !== undefined ? v : null;
  };
  const pickNum = (key) => {
    const v = override[key] ?? extracted[key];
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  return {
    pay_date:               pick('pay_date'),
    pay_period_start:       pick('pay_period_start'),
    pay_period_end:         pick('pay_period_end'),
    gross_amount:           pickNum('gross_amount'),
    commission_amount:      pickNum('commission_amount'),
    base_salary:            pickNum('base_salary'),
    other_earnings:         pickNum('other_earnings'),
    hours_worked:           pickNum('hours_worked'),
    federal_income_tax:     pickNum('federal_income_tax'),
    social_security_tax:    pickNum('social_security_tax'),
    medicare_tax:           pickNum('medicare_tax'),
    state_income_tax:       pickNum('state_income_tax'),
    medical_deduction:      pickNum('medical_deduction'),
    retirement_401k:        pickNum('retirement_401k'),
    expense_reimbursement:  pickNum('expense_reimbursement'),
    total_deductions:       pickNum('total_deductions'),
    federal_taxable_wages:  pickNum('federal_taxable_wages'),
    state_taxable_wages:    pickNum('state_taxable_wages'),
    net_amount:             pickNum('net_amount'),
    file_name:              fileName ?? pick('file_name'),
    extracted_text:         extractedText ?? pick('extracted_text'),
    extracted_data:         Object.keys(extracted).length ? extracted : (override.extracted_data ?? null),
    notes:                  pick('notes'),
  };
}

/**
 * Parse ADP paycheck PDF text as produced by pdf-parse.
 *
 * pdf-parse strips spaces and merges columns, producing compact integers
 * where the last 2 digits are always cents:
 *   "$1250000"  → $12,500.00
 *   "$882286"   → $8,822.86
 *   "-238692238692" → Fed Tax -$2,386.92 (period) + $2,386.92 (YTD) concatenated
 *   "-4752*4752"    → Medical -$47.52* (pre-tax, * separates period/YTD)
 */
function parsePdfText(text) {
  const t = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const result = {};

  // Parse a compact ADP integer (last 2 digits = cents)
  function fromCompact(s) {
    const d = String(s).replace(/[^0-9]/g, '');
    if (!d || d.length < 3) return null;
    const n = parseFloat(d.slice(0, -2) + '.' + d.slice(-2));
    return isNaN(n) ? null : n;
  }

  // ── Dates ───────────────────────────────────────────────────────────────────
  [
    ['pay_date',         /PayDate:(\d{2}\/\d{2}\/\d{4})/i],
    ['pay_period_start', /PeriodBeginning:(\d{2}\/\d{2}\/\d{4})/i],
    ['pay_period_end',   /PeriodEnding:(\d{2}\/\d{2}\/\d{4})/i],
    // Fallback spaced variants
    ['pay_date',         /Pay\s*Date:\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i],
    ['pay_period_start', /Period\s*Beginning:\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i],
    ['pay_period_end',   /Period\s*Ending:\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i],
  ].forEach(([field, pat]) => {
    if (result[field]) return; // already found
    const m = t.match(pat);
    if (!m) return;
    const parts = m[1].split(/[/-]/);
    if (parts.length === 3) {
      const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      result[field] = `${yr}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
  });

  // ── Gross & Net Pay ─────────────────────────────────────────────────────────
  // All $NNNN amounts in document order; largest = gross, next = net
  const dollarRe = /\$(\d{4,8})\b/g;
  const dollarHits = [];
  let dm;
  while ((dm = dollarRe.exec(t)) !== null) {
    const v = fromCompact(dm[1]);
    if (v !== null) dollarHits.push(v);
  }
  // Filter out taxable wages (they appear after "taxablewages" keyword) — take only first 3
  const earningAmounts = dollarHits.slice(0, 3).sort((a, b) => b - a);
  if (earningAmounts.length >= 1) result.gross_amount = earningAmounts[0];
  if (earningAmounts.length >= 2) result.net_amount   = earningAmounts[1];

  // Taxable wages appear after their label
  const fedTaxWages = t.match(/federaltaxablewages[^$]*\$(\d{6,8})/i);
  if (fedTaxWages) result.federal_taxable_wages = fromCompact(fedTaxWages[1]);
  const stateTaxWages = t.match(/(?:NC|[A-Z]{2})taxablewages[^$]*\$(\d{6,8})/i);
  if (stateTaxWages) result.state_taxable_wages = fromCompact(stateTaxWages[1]);

  // ── Hours ───────────────────────────────────────────────────────────────────
  const hm = t.match(/TotlHrsWorked(\d{4})/i) || t.match(/TotalHrsWorked(\d{4})/i);
  if (hm) result.hours_worked = fromCompact(hm[1]);

  // ── Commission ──────────────────────────────────────────────────────────────
  const commMatch = t.match(/Commission[:\s-]*(\d{4,})/i);
  if (commMatch) result.commission_amount = fromCompact(commMatch[1]);

  // ── Deductions ──────────────────────────────────────────────────────────────
  // Only look in the section before "NetPay" to avoid picking up check amounts
  const beforeNet = t.split(/NetPay|NetCheck/i)[0] || t;

  // Pre-tax deductions (marked with *): -NNNN*NNNN  → take digits before *
  const preTaxRe = /-(\d{3,6})\*\d+/g;
  const preTax = [];
  let pm;
  while ((pm = preTaxRe.exec(beforeNet)) !== null) {
    const v = fromCompact(pm[1]);
    if (v !== null) preTax.push(v);
  }

  // Regular deductions: long negative numbers (period+YTD concatenated, ≥8 digits)
  const regDeductRe = /-(\d{8,14})(?!\*)/g;
  const regDeduct = [];
  let rm;
  while ((rm = regDeductRe.exec(beforeNet)) !== null) {
    const full = rm[1];
    // Take first half (period amount); both halves equal for first paycheck
    const half = full.slice(0, Math.ceil(full.length / 2));
    const v = fromCompact(half);
    if (v !== null) regDeduct.push(v);
  }

  // ADP standard order: Federal IT, SS, Medicare, State IT
  if (regDeduct[0] != null) result.federal_income_tax  = regDeduct[0];
  if (regDeduct[1] != null) result.social_security_tax = regDeduct[1];
  if (regDeduct[2] != null) result.medicare_tax        = regDeduct[2];
  if (regDeduct[3] != null) result.state_income_tax    = regDeduct[3];

  // ADP standard order for pre-tax: Medical, 401K
  if (preTax[0] != null) result.medical_deduction = preTax[0];
  if (preTax[1] != null) result.retirement_401k   = preTax[1];

  // Expense reimbursement: look for ExpenseReimbur followed by a standalone negative amount
  const expMatch = beforeNet.match(/ExpenseReimbur[^-\d]*-(\d{4,6})\b/i);
  if (expMatch) result.expense_reimbursement = fromCompact(expMatch[1]);

  // ── Total deductions ────────────────────────────────────────────────────────
  const deductFields = [
    'federal_income_tax', 'social_security_tax', 'medicare_tax',
    'state_income_tax', 'medical_deduction', 'retirement_401k',
  ];
  const deductSum = deductFields.reduce((s, k) => s + (result[k] || 0), 0);
  if (deductSum > 0) result.total_deductions = +deductSum.toFixed(2);

  return Object.fromEntries(Object.entries(result).filter(([, v]) => v != null));
}
