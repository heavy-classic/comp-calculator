'use client';

import { useState, useRef } from 'react';
import {
  Upload, Receipt, Trash2, Edit2, FileText, CheckCircle,
  X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { formatCurrency } from '@/lib/commission';
import { format, parseISO } from 'date-fns';

// ─── Form ──────────────────────────────────────────────────────────────────────

function PaycheckForm({ paycheck, onSuccess, onCancel }) {
  const isEdit = !!paycheck;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    pay_date:               paycheck?.pay_date || '',
    pay_period_start:       paycheck?.pay_period_start || '',
    pay_period_end:         paycheck?.pay_period_end || '',
    gross_amount:           paycheck?.gross_amount ?? '',
    base_salary:            paycheck?.base_salary ?? '',
    commission_amount:      paycheck?.commission_amount ?? '',
    other_earnings:         paycheck?.other_earnings ?? '',
    hours_worked:           paycheck?.hours_worked ?? '',
    federal_income_tax:     paycheck?.federal_income_tax ?? '',
    social_security_tax:    paycheck?.social_security_tax ?? '',
    medicare_tax:           paycheck?.medicare_tax ?? '',
    state_income_tax:       paycheck?.state_income_tax ?? '',
    federal_taxable_wages:  paycheck?.federal_taxable_wages ?? '',
    state_taxable_wages:    paycheck?.state_taxable_wages ?? '',
    medical_deduction:      paycheck?.medical_deduction ?? '',
    retirement_401k:        paycheck?.retirement_401k ?? '',
    expense_reimbursement:  paycheck?.expense_reimbursement ?? '',
    total_deductions:       paycheck?.total_deductions ?? '',
    net_amount:             paycheck?.net_amount ?? '',
    notes:                  paycheck?.notes || '',
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const url = isEdit ? `/api/paychecks/${paycheck.id}` : '/api/paychecks';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      onSuccess(await res.json());
    } else {
      const d = await res.json();
      setError(d.error || 'Failed to save.');
    }
    setLoading(false);
  };

  const numField = (label, key, placeholder = '0.00') => (
    <div>
      <label className="label">{label}</label>
      <input
        type="number" step="0.01" className="input"
        value={form[key]}
        onChange={set(key)}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Pay Period</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Pay Date</label>
            <input type="date" className="input" value={form.pay_date} onChange={set('pay_date')} />
          </div>
          <div>
            <label className="label">Period Start</label>
            <input type="date" className="input" value={form.pay_period_start} onChange={set('pay_period_start')} />
          </div>
          <div>
            <label className="label">Period End</label>
            <input type="date" className="input" value={form.pay_period_end} onChange={set('pay_period_end')} />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Earnings</h3>
        <div className="grid grid-cols-2 gap-4">
          {numField('Gross Pay ($)', 'gross_amount')}
          {numField('Hours Worked', 'hours_worked', '0.00')}
          {numField('Base Salary ($)', 'base_salary')}
          {numField('Commission ($)', 'commission_amount')}
          {numField('Other Earnings ($)', 'other_earnings')}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Tax Deductions</h3>
        <div className="grid grid-cols-2 gap-4">
          {numField('Federal Income Tax ($)', 'federal_income_tax')}
          {numField('Social Security Tax ($)', 'social_security_tax')}
          {numField('Medicare Tax ($)', 'medicare_tax')}
          {numField('State Income Tax ($)', 'state_income_tax')}
          {numField('Federal Taxable Wages ($)', 'federal_taxable_wages')}
          {numField('State Taxable Wages ($)', 'state_taxable_wages')}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Other Deductions</h3>
        <div className="grid grid-cols-2 gap-4">
          {numField('Medical / Health ($)', 'medical_deduction')}
          {numField('401(k) / Retirement ($)', 'retirement_401k')}
          {numField('Expense Reimbursement ($)', 'expense_reimbursement')}
          {numField('Total Deductions ($)', 'total_deductions')}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Summary</h3>
        <div className="grid grid-cols-2 gap-4">
          {numField('Net Pay ($)', 'net_amount')}
          <div>
            <label className="label">Notes</label>
            <input type="text" className="input" value={form.notes} onChange={set('notes')} placeholder="Optional notes" />
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary flex-1">
          {loading ? 'Saving…' : isEdit ? 'Update Paycheck' : 'Save Paycheck'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </form>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────────

function DetailRow({ label, value, accent, isCount }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs font-semibold ${accent || 'text-slate-800'}`}>
        {isCount ? parseFloat(value).toFixed(2) : formatCurrency(value)}
      </span>
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  );
}

function PaycheckCard({ paycheck: p, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false);

  const totalTaxes = [p.federal_income_tax, p.social_security_tax, p.medicare_tax, p.state_income_tax]
    .reduce((s, v) => s + parseFloat(v || 0), 0);

  return (
    <div className="card overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Receipt className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900">
                  {p.pay_date ? format(parseISO(p.pay_date), 'MMMM d, yyyy') : 'Pay Date Unknown'}
                </h3>
                {p.file_name && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    <FileText className="w-3 h-3" />{p.file_name}
                  </span>
                )}
              </div>
              {(p.pay_period_start || p.pay_period_end) && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Period:{' '}
                  {p.pay_period_start ? format(parseISO(p.pay_period_start), 'MMM d') : '?'}
                  {' \u2013 '}
                  {p.pay_period_end ? format(parseISO(p.pay_period_end), 'MMM d, yyyy') : '?'}
                </p>
              )}
              {p.notes && <p className="text-xs text-slate-500 mt-1">{p.notes}</p>}
            </div>
          </div>

          <div className="flex items-start gap-6">
            <div className="text-right">
              <p className="text-xs text-slate-400">Commission</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(p.commission_amount)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Gross Pay</p>
              <p className="text-lg font-semibold text-slate-900">{formatCurrency(p.gross_amount)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Net Pay</p>
              <p className="text-lg font-semibold text-slate-700">{formatCurrency(p.net_amount)}</p>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <button onClick={() => onEdit(p)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => onDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DetailSection title="Earnings">
              <DetailRow label="Gross Pay" value={p.gross_amount} accent="text-slate-900" />
              <DetailRow label="Base Salary" value={p.base_salary} />
              <DetailRow label="Commission" value={p.commission_amount} accent="text-green-700" />
              <DetailRow label="Other Earnings" value={p.other_earnings} />
              <DetailRow label="Hours Worked" value={p.hours_worked} isCount />
            </DetailSection>

            <DetailSection title="Tax Deductions">
              <DetailRow label="Federal Income Tax" value={p.federal_income_tax} accent="text-red-600" />
              <DetailRow label="Social Security" value={p.social_security_tax} accent="text-red-600" />
              <DetailRow label="Medicare" value={p.medicare_tax} accent="text-red-600" />
              <DetailRow label="State Income Tax" value={p.state_income_tax} accent="text-red-600" />
              {totalTaxes > 0 && (
                <div className="flex justify-between py-1.5 mt-1 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-500">Total Taxes</span>
                  <span className="text-xs font-bold text-red-700">{formatCurrency(totalTaxes)}</span>
                </div>
              )}
            </DetailSection>

            <DetailSection title="Other Deductions &amp; Net">
              <DetailRow label="Medical / Health" value={p.medical_deduction} accent="text-orange-600" />
              <DetailRow label="401(k) / Retirement" value={p.retirement_401k} accent="text-orange-600" />
              <DetailRow label="Expense Reimbursement" value={p.expense_reimbursement} />
              <DetailRow label="Total Deductions" value={p.total_deductions} accent="text-red-700" />
              <div className="mt-3 pt-2 border-t border-slate-200">
                <DetailRow label="Net Pay" value={p.net_amount} accent="text-green-700" />
              </div>
            </DetailSection>
          </div>

          {(p.federal_taxable_wages || p.state_taxable_wages) && (
            <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Federal Taxable Wages</p>
                <p className="text-sm font-semibold text-slate-700">{formatCurrency(p.federal_taxable_wages)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">State Taxable Wages</p>
                <p className="text-sm font-semibold text-slate-700">{formatCurrency(p.state_taxable_wages)}</p>
              </div>
            </div>
          )}

          {p.extracted_text && (
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-500 mb-2">Extracted PDF Text</p>
              <pre className="text-xs text-slate-600 bg-white border border-slate-200 rounded p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">
                {p.extracted_text.substring(0, 800)}{p.extracted_text.length > 800 ? '\u2026' : ''}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PaychecksClient({ initialPaychecks }) {
  const [paychecks, setPaychecks] = useState(initialPaychecks);
  const [showUpload, setShowUpload] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [editingPaycheck, setEditingPaycheck] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [showEditForm, setShowEditForm] = useState(false);
  const fileRef = useRef(null);

  const totalCommission = paychecks.reduce((s, p) => s + parseFloat(p.commission_amount || 0), 0);
  const totalGross      = paychecks.reduce((s, p) => s + parseFloat(p.gross_amount || 0), 0);
  const totalNet        = paychecks.reduce((s, p) => s + parseFloat(p.net_amount || 0), 0);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    setUploadResult(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('metadata', JSON.stringify({}));

    const res = await fetch('/api/paychecks', { method: 'POST', body: fd });

    if (res.ok) {
      const data = await res.json();
      setUploadResult(data);
      setPaychecks((prev) => [data, ...prev]);
    } else {
      const err = await res.json();
      setUploadError(err.error || 'Upload failed');
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this paycheck record?')) return;
    const res = await fetch(`/api/paychecks/${id}`, { method: 'DELETE' });
    if (res.ok) setPaychecks((prev) => prev.filter((p) => p.id !== id));
  };

  const handleEdit = (p) => { setEditingPaycheck(p); setShowEditForm(true); };
  const handleEditSuccess = (updated) => {
    setPaychecks((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setShowEditForm(false);
    setEditingPaycheck(null);
  };
  const handleManualSuccess = (p) => { setPaychecks((prev) => [p, ...prev]); setShowManual(false); };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Paychecks</h1>
          <p className="text-slate-500 mt-1">{paychecks.length} paycheck{paychecks.length !== 1 ? 's' : ''} recorded</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowManual(true)} className="btn-secondary flex items-center gap-2">
            <Edit2 className="w-4 h-4" />Manual Entry
          </button>
          <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2">
            <Upload className="w-4 h-4" />Upload PDF
          </button>
        </div>
      </div>

      {paychecks.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Commission Received', value: totalCommission, color: 'text-green-600' },
            { label: 'Total Gross Pay',            value: totalGross,      color: 'text-blue-600' },
            { label: 'Total Net Pay',              value: totalNet,        color: 'text-slate-900' },
          ].map((m) => (
            <div key={m.label} className="card p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">{m.label}</p>
              <p className={`text-xl font-bold ${m.color}`}>{formatCurrency(m.value)}</p>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Upload Paycheck PDF</h2>
            <button onClick={() => { setShowUpload(false); setUploadResult(null); setUploadError(''); }}>
              <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
            </button>
          </div>
          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="font-medium text-slate-700">Click to select or drag &amp; drop a PDF</p>
            <p className="text-sm text-slate-400 mt-1">
              Auto-extracts earnings, taxes, and deductions from ADP and standard pay stubs.
            </p>
            <input type="file" accept=".pdf" ref={fileRef} onChange={handleFileUpload} className="hidden" />
          </div>

          {uploading && (
            <div className="mt-4 flex items-center gap-3 text-sm text-blue-600">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Extracting paycheck data from PDF&hellip;
            </div>
          )}
          {uploadError && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{uploadError}</div>
          )}
          {uploadResult && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-700 font-medium mb-3">
                <CheckCircle className="w-4 h-4" />PDF uploaded &mdash; data extracted!
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Gross Pay',   uploadResult.gross_amount],
                  ['Net Pay',     uploadResult.net_amount],
                  ['Commission',  uploadResult.commission_amount],
                  ['Federal Tax', uploadResult.federal_income_tax],
                  ['SS Tax',      uploadResult.social_security_tax],
                  ['Medicare',    uploadResult.medicare_tax],
                  ['State Tax',   uploadResult.state_income_tax],
                  ['Medical',     uploadResult.medical_deduction],
                  ['401(k)',      uploadResult.retirement_401k],
                ].map(([label, val]) => val != null ? (
                  <div key={label} className="bg-white rounded p-2 border border-green-100">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="text-sm font-semibold text-slate-800">{formatCurrency(val)}</p>
                  </div>
                ) : null)}
              </div>
              <p className="text-xs text-slate-500 mt-3">Click the edit button on the card below to correct any values.</p>
            </div>
          )}
        </div>
      )}

      {showManual && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Manual Paycheck Entry</h2>
            <button onClick={() => setShowManual(false)}>
              <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
            </button>
          </div>
          <PaycheckForm onSuccess={handleManualSuccess} onCancel={() => setShowManual(false)} />
        </div>
      )}

      {showEditForm && editingPaycheck && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold">Edit Paycheck</h2>
            </div>
            <div className="p-6">
              <PaycheckForm
                paycheck={editingPaycheck}
                onSuccess={handleEditSuccess}
                onCancel={() => { setShowEditForm(false); setEditingPaycheck(null); }}
              />
            </div>
          </div>
        </div>
      )}

      {paychecks.length === 0 ? (
        <div className="card p-12 text-center">
          <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No paychecks yet</p>
          <p className="text-sm text-slate-400 mt-1">Upload a PDF or enter paycheck details manually</p>
          <button onClick={() => setShowUpload(true)} className="btn-primary mt-4 inline-flex items-center gap-2">
            <Upload className="w-4 h-4" />Upload Your First Paycheck
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {paychecks.map((p) => (
            <PaycheckCard key={p.id} paycheck={p} onDelete={handleDelete} onEdit={handleEdit} />
          ))}
        </div>
      )}
    </div>
  );
}
