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
 * Parse ADP-style paycheck PDF text.
 *
 * ADP encodes amounts with spaces instead of commas/decimal points,
 * e.g. "12 500 00" = $12,500.00 and "2 386 92" = $2,386.92.
 * The last two digits are always cents.
 */
function parsePdfText(text) {
  // Normalize line endings
  const t = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const result = {};

  // ── Dates ──────────────────────────────────────────────────────────────────
  const datePatterns = {
    pay_date: [
      /Pay\s*Date[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
      /Check\s*Date[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    ],
    pay_period_start: [
      /Period\s*Beginning[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
      /Period\s*(?:Start|Begin|From)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
      /Pay\s*Period[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    ],
    pay_period_end: [
      /Period\s*Ending[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
      /Period\s*(?:End|Through|To)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    ],
  };

  for (const [field, patterns] of Object.entries(datePatterns)) {
    for (const pat of patterns) {
      const m = t.match(pat);
      if (m) {
        // Normalise MM/DD/YYYY → YYYY-MM-DD
        const parts = m[1].split(/[/-]/);
        if (parts.length === 3) {
          const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          result[field] = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        } else {
          result[field] = m[1];
        }
        break;
      }
    }
  }

  // ── ADP space-encoded amounts ─────────────────────────────────────────────
  // "12 500 00" → 12500.00   "2 386 92" → 2386.92
  function parseAdpAmount(raw) {
    const digits = raw.replace(/\s+/g, '');
    if (!digits || digits.length < 3) return null;
    const cents = digits.slice(-2);
    const dollars = digits.slice(0, -2) || '0';
    const n = parseFloat(`${dollars}.${cents}`);
    return isNaN(n) ? null : n;
  }

  // Helper: match a label and capture the ADP amount that follows on the same line
  // Also handles negative amounts prefixed with "-" or "$"
  function extractAmount(pattern) {
    const m = t.match(pattern);
    if (!m) return null;
    return parseAdpAmount(m[1].replace(/[$-]/g, '').trim());
  }

  // ── Earnings ───────────────────────────────────────────────────────────────
  // "Gross Pay $12 500 00 12 500 00" — first amount is this-period
  result.gross_amount = extractAmount(/Gross\s*Pay\s+\$?([\d\s]{4,})/i);

  // "Regular 8333 34 86 67 12 500 00 12 500 00" — 4 columns: rate, hours, this-period, YTD
  const regularMatch = t.match(/Regular\s+([\d\s]+)/i);
  if (regularMatch) {
    // Split into groups of space-separated tokens; last two groups of 2 are YTD + this-period
    const tokens = regularMatch[1].trim().split(/\s+/);
    // ADP layout: rate(2 tokens) hours(2 tokens) this-period(3 tokens) ytd(3 tokens)
    // Easier: grab gross from "Gross Pay" line above; hours separately
  }

  // Hours: "Totl Hrs Worked 86 67"
  const hoursMatch = t.match(/Tot(?:l|al)\s+Hrs?\s+Worked\s+([\d\s]{2,})/i);
  if (hoursMatch) {
    result.hours_worked = parseAdpAmount(hoursMatch[1].trim());
  }

  // Commission (explicit line item)
  result.commission_amount = extractAmount(/Commission[:\s]+[-$]?([\d\s]{3,})/i);

  // Base salary from "Regular" line — this-period column
  const regLine = t.match(/^Regular\s+([\d\s]+)$/im);
  if (regLine) {
    // Try to pick the third money value (this-period gross)
    const nums = regLine[1].trim().match(/(?:\d+\s+)+\d+/g);
    if (nums && nums.length >= 3) {
      result.base_salary = parseAdpAmount(nums[2]);
    }
  }

  // Net Pay: "Net Pay $8 822 86"
  result.net_amount = extractAmount(/Net\s*Pay\s+\$?([\d\s]{4,})/i);

  // ── Statutory deductions ───────────────────────────────────────────────────
  result.federal_income_tax  = extractAmount(/Federal\s+Income\s+Tax\s+[-$]?([\d\s]{4,})/i);
  result.social_security_tax = extractAmount(/Social\s+Security\s+Tax\s+[-$]?([\d\s]{3,})/i);
  result.medicare_tax        = extractAmount(/Medicare\s+Tax\s+[-$]?([\d\s]{3,})/i);
  result.state_income_tax    = extractAmount(/(?:[A-Z]{2}\s+)?State\s+Income\s+Tax\s+[-$]?([\d\s]{3,})/i);

  // ── Pre-tax / other deductions ─────────────────────────────────────────────
  result.medical_deduction   = extractAmount(/Medical\s+[-$]?([\d\s]{3,})\*/i);
  result.retirement_401k     = extractAmount(/401[Kk][^-\n]*[-$]?([\d\s]{3,})\*/i);

  // Expense reimbursement — take the negative (deduction) line, not the credit
  const expDeduct = t.match(/Expense\s+Reimbur[^\n]*-([\d\s]{3,})/i);
  if (expDeduct) result.expense_reimbursement = parseAdpAmount(expDeduct[1].trim());

  // ── Taxable wages ──────────────────────────────────────────────────────────
  result.federal_taxable_wages = extractAmount(/federal\s+taxable\s+wages.*?\$?([\d\s]{4,})/i);
  result.state_taxable_wages   = extractAmount(/[A-Z]{2}\s+taxable\s+wages.*?\$?([\d\s]{4,})/i);

  // ── Compute total_deductions if not explicit ───────────────────────────────
  const deductionFields = [
    'federal_income_tax', 'social_security_tax', 'medicare_tax',
    'state_income_tax', 'medical_deduction', 'retirement_401k',
  ];
  const deductionSum = deductionFields.reduce((s, k) => s + (result[k] || 0), 0);
  if (deductionSum > 0) result.total_deductions = +deductionSum.toFixed(2);

  // Strip out nulls to keep the object clean
  return Object.fromEntries(Object.entries(result).filter(([, v]) => v !== null && v !== undefined));
}
