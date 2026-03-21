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
    // Handle PDF upload
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
        // Dynamically import pdf-parse to avoid issues
        const pdfParse = (await import('pdf-parse')).default;
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text || '';
        extractedData = parsePdfText(extractedText);
      } catch (err) {
        console.error('PDF parse error:', err);
        extractedText = 'PDF parsing failed. Please enter details manually.';
      }
    }

    const insertData = {
      pay_date: meta.pay_date || extractedData.pay_date || null,
      pay_period_start: meta.pay_period_start || extractedData.pay_period_start || null,
      pay_period_end: meta.pay_period_end || extractedData.pay_period_end || null,
      gross_amount: meta.gross_amount || extractedData.gross_amount || null,
      commission_amount: meta.commission_amount || extractedData.commission_amount || null,
      base_salary: meta.base_salary || extractedData.base_salary || null,
      other_earnings: meta.other_earnings || extractedData.other_earnings || null,
      total_deductions: meta.total_deductions || extractedData.total_deductions || null,
      net_amount: meta.net_amount || extractedData.net_amount || null,
      file_name: file ? file.name : null,
      extracted_text: extractedText,
      extracted_data: extractedData,
      notes: meta.notes || null,
    };

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

  // Handle JSON (manual entry or update after extraction)
  const body = await request.json();

  const { data, error } = await supabase
    .from('paychecks')
    .insert([{
      pay_date: body.pay_date || null,
      pay_period_start: body.pay_period_start || null,
      pay_period_end: body.pay_period_end || null,
      gross_amount: body.gross_amount || null,
      commission_amount: body.commission_amount || null,
      base_salary: body.base_salary || null,
      other_earnings: body.other_earnings || null,
      total_deductions: body.total_deductions || null,
      net_amount: body.net_amount || null,
      file_name: body.file_name || null,
      extracted_text: body.extracted_text || null,
      extracted_data: body.extracted_data || null,
      notes: body.notes || null,
    }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

/**
 * Try to extract common paycheck fields from PDF text using regex patterns.
 * This is a best-effort extraction — users can always edit manually.
 */
function parsePdfText(text) {
  const result = {};

  // Common patterns for paychecks
  const patterns = {
    pay_date: [
      /pay\s*date[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
      /check\s*date[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
      /payment\s*date[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    ],
    pay_period_start: [
      /period\s*(?:start|begin|from)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
      /pay\s*period[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    ],
    pay_period_end: [
      /period\s*(?:end|through|to)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    ],
    gross_amount: [
      /gross\s*(?:pay|earnings|wages?)[:\s]+\$?([\d,]+\.?\d*)/i,
      /total\s*gross[:\s]+\$?([\d,]+\.?\d*)/i,
    ],
    commission_amount: [
      /commission[:\s]+\$?([\d,]+\.?\d*)/i,
      /sales\s*commission[:\s]+\$?([\d,]+\.?\d*)/i,
    ],
    base_salary: [
      /(?:base\s*salary|regular\s*pay|salary)[:\s]+\$?([\d,]+\.?\d*)/i,
    ],
    net_amount: [
      /net\s*(?:pay|amount)[:\s]+\$?([\d,]+\.?\d*)/i,
      /total\s*net[:\s]+\$?([\d,]+\.?\d*)/i,
    ],
    total_deductions: [
      /total\s*deductions?[:\s]+\$?([\d,]+\.?\d*)/i,
    ],
  };

  for (const [field, fieldPatterns] of Object.entries(patterns)) {
    for (const pattern of fieldPatterns) {
      const match = text.match(pattern);
      if (match) {
        let value = match[1].replace(/,/g, '');
        if (['gross_amount', 'commission_amount', 'base_salary', 'net_amount', 'total_deductions'].includes(field)) {
          value = parseFloat(value);
          if (!isNaN(value)) {
            result[field] = value;
            break;
          }
        } else {
          result[field] = value;
          break;
        }
      }
    }
  }

  return result;
}
