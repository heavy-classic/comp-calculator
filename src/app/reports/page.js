'use client';

import { useState } from 'react';
import { formatCurrency, getCommissionRateLabel } from '@/lib/commission';
import { format, parseISO } from 'date-fns';
import { FileText, Download, Mail, FileBarChart, FileSpreadsheet, FileClock, User, ClipboardList } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(date) {
  try { return format(parseISO(date), 'MMM d, yyyy'); } catch { return '—'; }
}

function pct(rate) {
  return `${((parseFloat(rate) || 0) * 100).toFixed(1)}%`;
}

// ─── PDF Builder helpers ──────────────────────────────────────────────────────
function addPageHeader(doc, title, subtitle, pageWidth) {
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 38, 'F');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 14, 29);
  doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, pageWidth - 14, 29, { align: 'right' });
}

function addPageNumbers(doc) {
  const n = doc.internal.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${i} of ${n}`, w / 2, h - 8, { align: 'center' });
    doc.text('Comp Calculator — Confidential', 14, h - 8);
  }
}

// ─── Report generators ────────────────────────────────────────────────────────
async function generateCommissionStatement(dateRange) {
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;

  const deals = await fetch('/api/deals').then((r) => r.json());
  const allItems = (Array.isArray(deals) ? deals : []).flatMap((deal) =>
    (deal.deal_line_items || []).map((item) => ({ ...item, deals: deal }))
  );
  const rows = allItems.filter((item) => {
    if (item.status !== 'Invoiced' || item.is_excluded) return false;
    if (dateRange.from && item.invoice_date && item.invoice_date < dateRange.from) return false;
    if (dateRange.to && item.invoice_date && item.invoice_date > dateRange.to) return false;
    return true;
  }).sort((a, b) => (a.invoice_date || '').localeCompare(b.invoice_date || ''));

  const totalCommission = rows.reduce((s, i) => s + parseFloat(i.commission_amount || 0), 0);
  const totalRevenue = rows.reduce((s, i) => s + parseFloat(i.amount || 0), 0);

  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const periodLabel = dateRange.from && dateRange.to
    ? `${fmt(dateRange.from)} – ${fmt(dateRange.to)}`
    : 'All Time';

  addPageHeader(doc, 'Commission Statement', `Period: ${periodLabel}`, pw);

  // Summary boxes
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 44, (pw - 28) / 2 - 4, 20, 3, 3, 'FD');
  doc.roundedRect(14 + (pw - 28) / 2, 44, (pw - 28) / 2 - 4, 20, 3, 3, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('TOTAL REVENUE', 20, 51);
  doc.text('TOTAL COMMISSION EARNED', 14 + (pw - 28) / 2 + 6, 51);

  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(totalRevenue), 20, 60);
  doc.text(formatCurrency(totalCommission), 14 + (pw - 28) / 2 + 6, 60);

  // Table
  autoTable(doc, {
    startY: 72,
    head: [['Customer', 'Deal', 'Type', 'Item Type', 'Description', 'Invoice Date', 'Rate', 'Commission']],
    body: rows.map((item) => [
      item.deals?.customer_name || '—',
      item.deals?.deal_name || '—',
      `${item.deals?.service_type || ''} ${item.deals?.deal_type || ''}`.trim(),
      item.item_type || 'Other',
      item.description,
      item.invoice_date ? fmt(item.invoice_date) : '—',
      pct(item.commission_rate),
      formatCurrency(item.commission_amount),
    ]),
    foot: [['', '', '', '', '', '', 'Total:', formatCurrency(totalCommission)]],
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    footStyles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 7: { halign: 'right', fontStyle: 'bold' }, 6: { halign: 'center' } },
  });

  addPageNumbers(doc);
  doc.save(`commission-statement-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  return { totalCommission, period: periodLabel };
}

async function generateDealPipeline() {
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;

  const deals = await fetch('/api/deals').then((r) => r.json());

  const rows = (Array.isArray(deals) ? deals : []).map((d) => {
    const items = d.deal_line_items || [];
    const totalCommission = items
      .filter((i) => !i.is_excluded)
      .reduce((s, i) => s + parseFloat(i.commission_amount || 0), 0);
    const invoicedCommission = items
      .filter((i) => !i.is_excluded && i.status === 'Invoiced')
      .reduce((s, i) => s + parseFloat(i.commission_amount || 0), 0);
    return {
      customer: d.customer_name,
      deal: d.deal_name,
      type: `${d.service_type} ${d.deal_type}`,
      status: d.status,
      closeDate: d.close_date ? fmt(d.close_date) : '—',
      totalValue: formatCurrency(d.total_value || 0),
      totalCommission: formatCurrency(totalCommission),
      invoiced: formatCurrency(invoicedCommission),
      lineItems: items.length,
    };
  });

  const doc = new jsPDF({ orientation: 'landscape' });
  const pw = doc.internal.pageSize.getWidth();

  addPageHeader(doc, 'Deal Pipeline Report', `All Deals — ${format(new Date(), 'MMMM yyyy')}`, pw);

  // Summary row
  const totalDeals = rows.length;
  const closedDeals = (Array.isArray(deals) ? deals : []).filter((d) => d.status !== 'Pending').length;

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text(`${totalDeals} total deals  ·  ${closedDeals} closed/invoiced  ·  ${totalDeals - closedDeals} pending`, 14, 46);

  autoTable(doc, {
    startY: 52,
    head: [['Customer', 'Deal Name', 'Type', 'Status', 'Close Date', 'Deal Value', 'Total Commission', 'Invoiced Comm.', 'Line Items']],
    body: rows.map((r) => [
      r.customer, r.deal, r.type, r.status, r.closeDate,
      r.totalValue, r.totalCommission, r.invoiced, r.lineItems,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.column.index === 3 && data.section === 'body') {
        const status = data.cell.raw;
        if (status === 'Invoiced') data.cell.styles.textColor = [22, 163, 74];
        else if (status === 'Closed') data.cell.styles.textColor = [37, 99, 235];
        else data.cell.styles.textColor = [180, 130, 0];
      }
    },
  });

  addPageNumbers(doc);
  doc.save(`deal-pipeline-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  return { totalDeals };
}

async function generatePaycheckReconciliation(dateRange) {
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;

  const [deals, paychecks] = await Promise.all([
    fetch('/api/deals').then((r) => r.json()),
    fetch('/api/paychecks').then((r) => r.json()),
  ]);
  const allItems = (Array.isArray(deals) ? deals : [])
    .flatMap((deal) => (deal.deal_line_items || []).map((item) => ({ ...item, deals: deal })))
    .filter((item) => {
      if (item.status !== 'Invoiced' || item.is_excluded) return false;
      if (dateRange.from && item.invoice_date && item.invoice_date < dateRange.from) return false;
      if (dateRange.to && item.invoice_date && item.invoice_date > dateRange.to) return false;
      return true;
    });
  const allPaychecks = (Array.isArray(paychecks) ? paychecks : []).filter((p) => {
    if (dateRange.from && p.pay_date && p.pay_date < dateRange.from) return false;
    if (dateRange.to && p.pay_date && p.pay_date > dateRange.to) return false;
    return true;
  });

  const totalEarned = allItems.reduce((s, i) => s + parseFloat(i.commission_amount || 0), 0);
  const totalPaid = allPaychecks.reduce((s, p) => s + parseFloat(p.commission_amount || 0), 0);
  const gap = totalEarned - totalPaid;

  // Build monthly map
  const byMonth = {};
  for (const item of allItems) {
    if (!item.invoice_date) continue;
    const m = item.invoice_date.substring(0, 7);
    if (!byMonth[m]) byMonth[m] = { earned: 0, paid: 0 };
    byMonth[m].earned += parseFloat(item.commission_amount || 0);
  }
  for (const p of allPaychecks) {
    if (!p.pay_date) continue;
    const m = p.pay_date.substring(0, 7);
    if (!byMonth[m]) byMonth[m] = { earned: 0, paid: 0 };
    byMonth[m].paid += parseFloat(p.commission_amount || 0);
  }

  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const periodLabel = dateRange.from && dateRange.to
    ? `${fmt(dateRange.from)} – ${fmt(dateRange.to)}`
    : 'All Time';

  addPageHeader(doc, 'Paycheck Reconciliation', `Period: ${periodLabel}`, pw);

  // Summary boxes (3-column)
  const boxW = (pw - 28) / 3 - 3;
  const labels = ['COMMISSION EARNED', 'COMMISSION PAID', gap >= 0 ? 'OUTSTANDING BALANCE' : 'OVER-PAYMENT'];
  const values = [formatCurrency(totalEarned), formatCurrency(totalPaid), formatCurrency(Math.abs(gap))];
  const colors = [[37, 99, 235], [22, 163, 74], gap > 0.01 ? [217, 119, 6] : [22, 163, 74]];

  labels.forEach((lbl, idx) => {
    const x = 14 + idx * (boxW + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, 44, boxW, 22, 3, 3, 'FD');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(lbl, x + 5, 52);
    doc.setFontSize(13);
    doc.setTextColor(...colors[idx]);
    doc.setFont('helvetica', 'bold');
    doc.text(values[idx], x + 5, 62);
  });

  // Monthly summary table
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text('Monthly Summary', 14, 78);

  autoTable(doc, {
    startY: 82,
    head: [['Month', 'Earned', 'Paid', 'Gap', 'Status']],
    body: Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, v]) => {
        const monthGap = v.earned - v.paid;
        return [
          format(parseISO(`${m}-01`), 'MMMM yyyy'),
          formatCurrency(v.earned),
          formatCurrency(v.paid),
          formatCurrency(Math.abs(monthGap)),
          monthGap > 0.01 ? 'Under-paid' : monthGap < -0.01 ? 'Over-paid' : 'Balanced',
        ];
      }),
    foot: [['Total', formatCurrency(totalEarned), formatCurrency(totalPaid), formatCurrency(Math.abs(gap)), gap > 0.01 ? 'Outstanding' : 'Balanced']],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    footStyles: { fontStyle: 'bold', fillColor: [241, 245, 249] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    didParseCell: (d) => {
      if (d.column.index === 4 && d.section === 'body') {
        const v = d.cell.raw;
        if (v === 'Under-paid') d.cell.styles.textColor = [180, 83, 9];
        else if (v === 'Over-paid') d.cell.styles.textColor = [37, 99, 235];
        else d.cell.styles.textColor = [22, 163, 74];
      }
    },
  });

  // Paycheck detail
  const afterTable = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text('Paycheck Detail', 14, afterTable);

  autoTable(doc, {
    startY: afterTable + 4,
    head: [['Pay Date', 'Pay Period', 'Base Salary', 'Commission', 'Other', 'Gross', 'Net', 'File']],
    body: allPaychecks.map((p) => [
      p.pay_date ? fmt(p.pay_date) : '—',
      p.pay_period_start && p.pay_period_end ? `${fmt(p.pay_period_start)} – ${fmt(p.pay_period_end)}` : '—',
      formatCurrency(p.base_salary),
      formatCurrency(p.commission_amount),
      formatCurrency(p.other_earnings),
      formatCurrency(p.gross_amount),
      formatCurrency(p.net_amount),
      p.file_name || '—',
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [100, 116, 139], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  addPageNumbers(doc);
  doc.save(`paycheck-reconciliation-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  return { totalEarned, totalPaid, gap };
}

async function generateHRSummary(dateRange) {
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;

  const paychecks = await fetch('/api/paychecks').then((r) => r.json());
  const rows = (Array.isArray(paychecks) ? paychecks : []).filter((p) => {
    if (dateRange.from && p.pay_date && p.pay_date < dateRange.from) return false;
    if (dateRange.to && p.pay_date && p.pay_date > dateRange.to) return false;
    return true;
  });

  const totalGross = rows.reduce((s, p) => s + parseFloat(p.gross_amount || 0), 0);
  const totalNet = rows.reduce((s, p) => s + parseFloat(p.net_amount || 0), 0);
  const totalBase = rows.reduce((s, p) => s + parseFloat(p.base_salary || 0), 0);
  const totalCommission = rows.reduce((s, p) => s + parseFloat(p.commission_amount || 0), 0);
  const totalDeductions = rows.reduce((s, p) => s + parseFloat(p.total_deductions || 0), 0);

  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const periodLabel = dateRange.from && dateRange.to
    ? `${fmt(dateRange.from)} – ${fmt(dateRange.to)}`
    : 'All Time';

  addPageHeader(doc, 'HR Compensation Summary', `Period: ${periodLabel}  ·  ${rows.length} paychecks`, pw);

  // 5-column summary
  const items5 = [
    { label: 'TOTAL BASE SALARY', value: formatCurrency(totalBase), color: [30, 41, 59] },
    { label: 'TOTAL COMMISSION', value: formatCurrency(totalCommission), color: [37, 99, 235] },
    { label: 'TOTAL GROSS', value: formatCurrency(totalGross), color: [30, 41, 59] },
    { label: 'TOTAL DEDUCTIONS', value: formatCurrency(totalDeductions), color: [217, 119, 6] },
    { label: 'TOTAL NET PAY', value: formatCurrency(totalNet), color: [22, 163, 74] },
  ];

  const bw = (pw - 28) / 5 - 2;
  items5.forEach(({ label, value, color }, idx) => {
    const x = 14 + idx * (bw + 2.5);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, 44, bw, 22, 2, 2, 'FD');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x + 3, 51);
    doc.setFontSize(10);
    doc.setTextColor(...color);
    doc.setFont('helvetica', 'bold');
    doc.text(value, x + 3, 61);
  });

  // Table
  autoTable(doc, {
    startY: 74,
    head: [['Pay Date', 'Pay Period', 'Base Salary', 'Commission', 'Other Earnings', 'Total Gross', 'Deductions', 'Net Pay']],
    body: rows.map((p) => [
      p.pay_date ? fmt(p.pay_date) : '—',
      p.pay_period_start ? `${fmt(p.pay_period_start)} – ${fmt(p.pay_period_end)}` : '—',
      formatCurrency(p.base_salary),
      formatCurrency(p.commission_amount),
      formatCurrency(p.other_earnings),
      formatCurrency(p.gross_amount),
      formatCurrency(p.total_deductions),
      formatCurrency(p.net_amount),
    ]),
    foot: [['', 'TOTALS', formatCurrency(totalBase), formatCurrency(totalCommission), '—', formatCurrency(totalGross), formatCurrency(totalDeductions), formatCurrency(totalNet)]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    footStyles: { fontStyle: 'bold', fillColor: [241, 245, 249] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right', fontStyle: 'bold' } },
  });

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'italic');
  const note = 'This report is for compensation review purposes. All figures are derived from paycheck records entered into the Comp Calculator system.';
  doc.text(doc.splitTextToSize(note, pw - 28), 14, doc.lastAutoTable.finalY + 8);

  addPageNumbers(doc);
  doc.save(`hr-compensation-summary-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  return { totalGross, totalCommission };
}

async function generateHRCommissionDetail(dateRange) {
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;

  const [deals, invoices] = await Promise.all([
    fetch('/api/deals').then((r) => r.json()),
    fetch('/api/invoices').then((r) => r.json()),
  ]);

  // Build lookup: lineItemId → { lineItem, deal }
  const lineItemMap = {};
  for (const deal of (Array.isArray(deals) ? deals : [])) {
    for (const item of (deal.deal_line_items || [])) {
      lineItemMap[item.id] = { item, deal };
    }
  }

  // Join each invoice to its line item + deal, apply date filter
  const rows = (Array.isArray(invoices) ? invoices : [])
    .filter((inv) => {
      if (dateRange.from && inv.invoice_date < dateRange.from) return false;
      if (dateRange.to && inv.invoice_date > dateRange.to) return false;
      return true;
    })
    .map((inv) => {
      const { item = {}, deal = {} } = lineItemMap[inv.line_item_id] || {};
      return { inv, item, deal };
    })
    .filter(({ item }) => item.id)
    .sort((a, b) => (a.inv.invoice_date || '').localeCompare(b.inv.invoice_date || ''));

  // Totals
  const totalInvoiced = rows.reduce((s, { inv }) => s + parseFloat(inv.commission_amount || 0), 0);
  const totalPaid = rows.filter(({ inv }) => inv.paid).reduce((s, { inv }) => s + parseFloat(inv.commission_amount || 0), 0);
  const totalUnpaid = totalInvoiced - totalPaid;
  const totalInvoiceValue = rows.reduce((s, { inv }) => s + parseFloat(inv.amount || 0), 0);

  const periodLabel = dateRange.from && dateRange.to
    ? `${fmt(dateRange.from)} – ${fmt(dateRange.to)}`
    : 'All Time';

  function rateExplanation(item, deal) {
    if (item.is_excluded) return `Excluded — ${item.exclusion_reason || 'low margin'}`;
    const rateLabel = getCommissionRateLabel(item.deal_type, deal.service_type, item.year_number, item.is_upsell);
    const billing = item.billing_type === 'monthly' ? 'Monthly billing (÷12)' : 'Upfront billing';
    const svc = `${deal.service_type || ''} ${item.deal_type || ''}`.trim();
    if (item.deal_type === 'Software Resale') {
      return `SW Resale · ${rateLabel} · ${billing}`;
    }
    return `${svc} · ${rateLabel} · ${billing}`;
  }

  const doc = new jsPDF({ orientation: 'landscape' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // ── Header
  addPageHeader(doc, 'Commission Payment Detail Report', `Period: ${periodLabel}  ·  ${rows.length} invoice(s)`, pw);

  // ── Summary boxes
  const boxW = (pw - 28) / 4 - 3;
  const summaryItems = [
    { label: 'TOTAL INVOICE VALUE', value: formatCurrency(totalInvoiceValue), color: [30, 41, 59] },
    { label: 'TOTAL COMMISSION EARNED', value: formatCurrency(totalInvoiced), color: [37, 99, 235] },
    { label: 'COMMISSION PAID', value: formatCurrency(totalPaid), color: [22, 163, 74] },
    { label: 'COMMISSION OUTSTANDING', value: formatCurrency(totalUnpaid), color: totalUnpaid > 0.01 ? [180, 83, 9] : [22, 163, 74] },
  ];
  summaryItems.forEach(({ label, value, color }, i) => {
    const x = 14 + i * (boxW + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, 44, boxW, 22, 2, 2, 'FD');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x + 4, 52);
    doc.setFontSize(12);
    doc.setTextColor(...color);
    doc.setFont('helvetica', 'bold');
    doc.text(value, x + 4, 62);
  });

  // ── Commission rate reference
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(14, 72, pw - 28, 22, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 58, 138);
  doc.setFont('helvetica', 'bold');
  doc.text('Commission Rate Schedule:', 18, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const rateText = [
    'IdeaGen Implementation: 10%  |  IdeaGen Renewal: 5%  |  Other Implementation: 4%  |  Other Renewal: 2%',
    'SW Resale Year 1: 35% of Net Profit  |  SW Resale Year 2+: 15% of Net Profit  |  SW Resale Year 2+ Upsell: 35% of Net Profit',
    'Exclusion: Line items with gross margin ≤25% are excluded from commission.',
  ];
  rateText.forEach((line, i) => doc.text(line, 18, 86 + i * 4));

  // ── Main invoice table
  autoTable(doc, {
    startY: 100,
    head: [[
      'Invoice Date', 'Customer', 'Deal Name', 'Line Item', 'Deal Type',
      'Service', 'Billing', 'Invoice Amount', 'Comm. Rate', 'Commission', 'Paid', 'Rate Basis & Explanation',
    ]],
    body: rows.map(({ inv, item, deal }) => [
      inv.invoice_date ? fmt(inv.invoice_date) : '—',
      deal.customer_name || '—',
      deal.deal_name || '—',
      item.description || '—',
      item.deal_type || '—',
      deal.service_type || '—',
      item.billing_type === 'monthly' ? 'Monthly' : 'Upfront',
      formatCurrency(inv.amount),
      item.is_excluded ? 'Excluded' : pct(item.commission_rate),
      item.is_excluded ? '$0.00' : formatCurrency(inv.commission_amount),
      inv.paid ? '✓ Paid' : 'Pending',
      rateExplanation(item, deal),
    ]),
    foot: [['', '', '', '', '', '', '', formatCurrency(totalInvoiceValue), '', formatCurrency(totalInvoiced), `${rows.filter(r => r.inv.paid).length}/${rows.length} paid`, '']],
    styles: { fontSize: 7, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    footStyles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 24 },
      2: { cellWidth: 28 },
      3: { cellWidth: 28 },
      4: { cellWidth: 22 },
      5: { cellWidth: 16 },
      6: { cellWidth: 16 },
      7: { cellWidth: 22, halign: 'right' },
      8: { cellWidth: 16, halign: 'center' },
      9: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
      10: { cellWidth: 16, halign: 'center' },
      11: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      if (data.column.index === 10 && data.section === 'body') {
        data.cell.styles.textColor = data.cell.raw === '✓ Paid' ? [22, 163, 74] : [180, 83, 9];
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.column.index === 8 && data.section === 'body' && data.cell.raw === 'Excluded') {
        data.cell.styles.textColor = [200, 50, 50];
      }
    },
  });

  // ── Disclaimer
  const finalY = Math.min(doc.lastAutoTable.finalY + 6, ph - 16);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'This report is generated from the Comp Calculator system and reflects commission earned on invoiced amounts. ' +
    'Commission is recognized at the time of invoicing, not payment receipt. ' +
    'All figures are subject to review and approval by HR and Finance.',
    14, finalY,
    { maxWidth: pw - 28 }
  );

  addPageNumbers(doc);
  doc.save(`hr-commission-detail-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  return { totalInvoiced, totalPaid, totalUnpaid, count: rows.length, period: periodLabel };
}

// ─── Report config ────────────────────────────────────────────────────────────
const REPORTS = [
  {
    id: 'commission',
    title: 'Commission Statement',
    description: 'All invoiced line items with commission rates and amounts. Ideal for personal records or disputes.',
    icon: FileText,
    color: 'blue',
    usesDates: true,
    generate: generateCommissionStatement,
    emailSubject: 'Commission Statement',
    emailBody: (r) =>
      `Hi,\n\nPlease find attached my Commission Statement for the period ${r?.period || 'requested'}.\n\nTotal commission earned: ${r ? formatCurrency(r.totalCommission) : '(see attached)'}\n\nPlease review and confirm the commission payment at your earliest convenience.\n\nThank you`,
  },
  {
    id: 'pipeline',
    title: 'Deal Pipeline Report',
    description: 'Full deal list with status, values, and commission breakdown. Good for pipeline reviews.',
    icon: FileBarChart,
    color: 'indigo',
    usesDates: false,
    generate: generateDealPipeline,
    emailSubject: 'Deal Pipeline Report',
    emailBody: () =>
      `Hi,\n\nPlease find attached my current Deal Pipeline Report.\n\nThis report shows all deals including their status, total values, and expected commissions.\n\nThank you`,
  },
  {
    id: 'reconciliation',
    title: 'Paycheck Reconciliation',
    description: 'Side-by-side comparison of commission earned vs. paid, with monthly gap analysis.',
    icon: FileClock,
    color: 'amber',
    usesDates: true,
    generate: generatePaycheckReconciliation,
    emailSubject: 'Paycheck Reconciliation Report',
    emailBody: (r) =>
      `Hi,\n\nPlease find attached my Paycheck Reconciliation Report.\n\n` +
      (r
        ? `Commission earned: ${formatCurrency(r.totalEarned)}\nCommission paid: ${formatCurrency(r.totalPaid)}\nOutstanding: ${formatCurrency(r.gap)}\n\n`
        : '') +
      `Please review the attached report and advise on any outstanding balance.\n\nThank you`,
  },
  {
    id: 'hr',
    title: 'HR Compensation Summary',
    description: 'High-level pay summary with base salary, commission, gross, and net totals for HR review.',
    icon: User,
    color: 'green',
    usesDates: true,
    generate: generateHRSummary,
    emailSubject: 'Compensation Summary for HR Review',
    emailBody: (r) =>
      `Hi,\n\nPlease find attached my Compensation Summary for your records.\n\n` +
      (r ? `Total gross compensation: ${formatCurrency(r.totalGross)}\nTotal commission: ${formatCurrency(r.totalCommission)}\n\n` : '') +
      `Please let me know if you need any additional information.\n\nThank you`,
  },
  {
    id: 'hr-commission-detail',
    title: 'Commission Payment Detail',
    description: 'Invoice-by-invoice commission breakdown with rate explanations, billing type, and paid status — designed for HR review and audit.',
    icon: ClipboardList,
    color: 'violet',
    usesDates: true,
    generate: generateHRCommissionDetail,
    emailSubject: 'Commission Payment Detail — HR Review',
    emailBody: (r) =>
      `Hi,\n\nPlease find attached a detailed Commission Payment report for your review.\n\n` +
      (r
        ? `Period: ${r.period}\nInvoices: ${r.count}\nTotal commission earned: ${formatCurrency(r.totalInvoiced)}\nCommission paid: ${formatCurrency(r.totalPaid)}\nOutstanding: ${formatCurrency(r.totalUnpaid)}\n\n`
        : '') +
      `This report includes the commission rate basis and explanation for each invoice line, as well as payment status.\n\nPlease review and confirm at your earliest convenience.\n\nThank you`,
  },
];

// ─── Report card ──────────────────────────────────────────────────────────────
const COLOR_MAP = {
  blue: { icon: 'bg-blue-50 text-blue-600', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  indigo: { icon: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-700' },
  amber: { icon: 'bg-amber-50 text-amber-600', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  green: { icon: 'bg-green-50 text-green-600', border: 'border-green-200', badge: 'bg-green-100 text-green-700' },
  violet: { icon: 'bg-violet-50 text-violet-600', border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700' },
};

function ReportCard({ report, dateRange, hrEmail }) {
  const [status, setStatus] = useState('idle'); // idle | generating | done | error
  const [result, setResult] = useState(null);
  const c = COLOR_MAP[report.color];

  const handleGenerate = async () => {
    setStatus('generating');
    setResult(null);
    try {
      const res = await report.generate(dateRange);
      setResult(res);
      setStatus('done');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  const mailtoHref = () => {
    const subject = encodeURIComponent(`[Comp Calculator] ${report.emailSubject}`);
    const body = encodeURIComponent(report.emailBody(result) + '\n\n— sent via Comp Calculator');
    return `mailto:${hrEmail || ''}?subject=${subject}&body=${body}`;
  };

  return (
    <div className={`card p-6 border ${c.border} flex flex-col gap-4`}>
      <div className="flex items-start gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${c.icon}`}>
          <report.icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900">{report.title}</h3>
          <p className="text-sm text-slate-500 mt-1">{report.description}</p>
          {report.usesDates && (
            <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${c.badge}`}>
              Uses date filter
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleGenerate}
          disabled={status === 'generating'}
          className="btn-primary flex items-center gap-2 flex-1 justify-center text-sm py-2"
        >
          <Download className="w-4 h-4" />
          {status === 'generating' ? 'Generating…' : status === 'done' ? 'Re-generate PDF' : 'Generate PDF'}
        </button>

        {status === 'done' && (
          <a
            href={mailtoHref()}
            className="btn-secondary flex items-center gap-2 text-sm py-2 px-3"
            title="Open email client to send to HR"
          >
            <Mail className="w-4 h-4" />
            Email HR
          </a>
        )}
      </div>

      {status === 'done' && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          ✓ PDF downloaded. Click "Email HR" to compose an email (attach the downloaded file).
        </p>
      )}
      {status === 'error' && (
        <p className="text-xs text-red-500">Failed to generate. Check console for details.</p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [hrEmail, setHrEmail] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('hr_email') || '';
    return '';
  });
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [showEmailSaved, setShowEmailSaved] = useState(false);

  const saveEmail = () => {
    localStorage.setItem('hr_email', hrEmail);
    setShowEmailSaved(true);
    setTimeout(() => setShowEmailSaved(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-500 mt-1">Generate PDF reports and send to your HR manager</p>
      </div>

      {/* Settings row */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Report Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">HR Manager Email</label>
            <div className="flex gap-2">
              <input
                type="email"
                className="input flex-1"
                placeholder="hr@company.com"
                value={hrEmail}
                onChange={(e) => setHrEmail(e.target.value)}
              />
              <button onClick={saveEmail} className="btn-secondary px-3 text-sm">
                {showEmailSaved ? '✓' : 'Save'}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">Pre-fills the "Email HR" mailto link</p>
          </div>
          <div>
            <label className="label">Date From (optional)</label>
            <input
              type="date"
              className="input"
              value={dateRange.from}
              onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Date To (optional)</label>
            <input
              type="date"
              className="input"
              value={dateRange.to}
              onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))}
            />
          </div>
        </div>
        {(dateRange.from || dateRange.to) && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-sm text-slate-600">
              Active filter: {dateRange.from ? fmt(dateRange.from) : 'start'} → {dateRange.to ? fmt(dateRange.to) : 'now'}
            </span>
            <button
              className="text-xs text-slate-400 hover:text-slate-600 underline"
              onClick={() => setDateRange({ from: '', to: '' })}
            >
              Clear filter
            </button>
          </div>
        )}
      </div>

      {/* How it works note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 flex items-start gap-3">
        <FileSpreadsheet className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-500" />
        <div>
          <strong>How it works:</strong> Click "Generate PDF" to download the report to your computer.
          Then click "Email HR" to open your email client with a pre-written message — just attach the downloaded PDF and send.
        </div>
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {REPORTS.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            dateRange={dateRange}
            hrEmail={hrEmail}
          />
        ))}
      </div>
    </div>
  );
}
