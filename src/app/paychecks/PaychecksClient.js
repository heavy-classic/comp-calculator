'use client';

import { useState, useRef } from 'react';
import {
  Upload,
  Receipt,
  Trash2,
  Edit2,
  FileText,
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatCurrency } from '@/lib/commission';
import { format, parseISO } from 'date-fns';

function PaycheckForm({ paycheck, onSuccess, onCancel }) {
  const isEdit = !!paycheck;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    pay_date: paycheck?.pay_date || '',
    pay_period_start: paycheck?.pay_period_start || '',
    pay_period_end: paycheck?.pay_period_end || '',
    gross_amount: paycheck?.gross_amount || '',
    commission_amount: paycheck?.commission_amount || '',
    base_salary: paycheck?.base_salary || '',
    other_earnings: paycheck?.other_earnings || '',
    total_deductions: paycheck?.total_deductions || '',
    net_amount: paycheck?.net_amount || '',
    notes: paycheck?.notes || '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const url = isEdit ? `/api/paychecks/${paycheck.id}` : '/api/paychecks';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      const data = await res.json();
      onSuccess(data);
    }
    setLoading(false);
  };

  const field = (label, key, type = 'text', placeholder = '') => (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        step={type === 'number' ? '0.01' : undefined}
        className="input"
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {field('Pay Date', 'pay_date', 'date')}
        {field('Period Start', 'pay_period_start', 'date')}
        {field('Period End', 'pay_period_end', 'date')}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {field('Gross Amount ($)', 'gross_amount', 'number', '0.00')}
        {field('Commission Amount ($)', 'commission_amount', 'number', '0.00')}
        {field('Base Salary ($)', 'base_salary', 'number', '0.00')}
        {field('Other Earnings ($)', 'other_earnings', 'number', '0.00')}
        {field('Total Deductions ($)', 'total_deductions', 'number', '0.00')}
        {field('Net Pay ($)', 'net_amount', 'number', '0.00')}
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea
          className="input resize-none"
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Optional notes..."
        />
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="btn-primary flex-1">
          {loading ? 'Saving...' : isEdit ? 'Update Paycheck' : 'Save Paycheck'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </form>
  );
}

function PaycheckCard({ paycheck, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false);

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
                  {paycheck.pay_date
                    ? format(parseISO(paycheck.pay_date), 'MMMM d, yyyy')
                    : 'Pay Date Unknown'}
                </h3>
                {paycheck.file_name && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    <FileText className="w-3 h-3" />
                    {paycheck.file_name}
                  </span>
                )}
              </div>
              {(paycheck.pay_period_start || paycheck.pay_period_end) && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Period:{' '}
                  {paycheck.pay_period_start
                    ? format(parseISO(paycheck.pay_period_start), 'MMM d')
                    : '?'}{' '}
                  –{' '}
                  {paycheck.pay_period_end
                    ? format(parseISO(paycheck.pay_period_end), 'MMM d, yyyy')
                    : '?'}
                </p>
              )}
              {paycheck.notes && (
                <p className="text-xs text-slate-500 mt-1">{paycheck.notes}</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-6">
            <div className="text-right">
              <p className="text-xs text-slate-400">Commission</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(paycheck.commission_amount)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Gross Pay</p>
              <p className="text-lg font-semibold text-slate-900">
                {formatCurrency(paycheck.gross_amount)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Net Pay</p>
              <p className="text-lg font-semibold text-slate-700">
                {formatCurrency(paycheck.net_amount)}
              </p>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => onEdit(paycheck)}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(paycheck.id)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              { label: 'Base Salary', value: paycheck.base_salary },
              { label: 'Commission', value: paycheck.commission_amount },
              { label: 'Other Earnings', value: paycheck.other_earnings },
              { label: 'Total Deductions', value: paycheck.total_deductions },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-slate-400 mb-1">{label}</p>
                <p className="font-semibold text-slate-900">{formatCurrency(value)}</p>
              </div>
            ))}
          </div>
          {paycheck.extracted_text && (
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-500 mb-2">Extracted PDF Text (preview)</p>
              <pre className="text-xs text-slate-600 bg-white border border-slate-200 rounded p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">
                {paycheck.extracted_text.substring(0, 800)}
                {paycheck.extracted_text.length > 800 ? '...' : ''}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  const totalGross = paychecks.reduce((s, p) => s + parseFloat(p.gross_amount || 0), 0);
  const totalNet = paychecks.reduce((s, p) => s + parseFloat(p.net_amount || 0), 0);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify({}));

    const res = await fetch('/api/paychecks', {
      method: 'POST',
      body: formData,
    });

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
    if (res.ok) {
      setPaychecks((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleEdit = (paycheck) => {
    setEditingPaycheck(paycheck);
    setShowEditForm(true);
  };

  const handleEditSuccess = (updated) => {
    setPaychecks((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setShowEditForm(false);
    setEditingPaycheck(null);
  };

  const handleManualSuccess = (newPaycheck) => {
    setPaychecks((prev) => [newPaycheck, ...prev]);
    setShowManual(false);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Paychecks</h1>
          <p className="text-slate-500 mt-1">{paychecks.length} paycheck{paychecks.length !== 1 ? 's' : ''} recorded</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowManual(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            Manual Entry
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload PDF
          </button>
        </div>
      </div>

      {/* Summary */}
      {paychecks.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Commission Received', value: totalCommission, color: 'text-green-600' },
            { label: 'Total Gross Pay', value: totalGross, color: 'text-blue-600' },
            { label: 'Total Net Pay', value: totalNet, color: 'text-slate-900' },
          ].map((m) => (
            <div key={m.label} className="card p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">{m.label}</p>
              <p className={`text-xl font-bold ${m.color}`}>{formatCurrency(m.value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* PDF Upload Panel */}
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
            <p className="font-medium text-slate-700">Click to select or drag & drop a PDF</p>
            <p className="text-sm text-slate-400 mt-1">
              The system will try to auto-extract paycheck details from the PDF.
              You can always edit the extracted data manually.
            </p>
            <input
              type="file"
              accept=".pdf"
              ref={fileRef}
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {uploading && (
            <div className="mt-4 flex items-center gap-3 text-sm text-blue-600">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Uploading and extracting data from PDF...
            </div>
          )}

          {uploadError && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {uploadError}
            </div>
          )}

          {uploadResult && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                <CheckCircle className="w-4 h-4" />
                PDF uploaded successfully!
              </div>
              <p className="text-sm text-green-600 mb-3">
                The paycheck has been added. Please review and edit the extracted details if needed
                — click the edit button on the card below.
              </p>
              {uploadResult.commission_amount == null && (
                <p className="text-xs text-amber-600">
                  ⚠️ Commission amount could not be auto-extracted. Please edit the record to add it manually.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Manual Entry Panel */}
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

      {/* Edit Paycheck Panel */}
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

      {/* Paychecks List */}
      {paychecks.length === 0 ? (
        <div className="card p-12 text-center">
          <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No paychecks yet</p>
          <p className="text-sm text-slate-400 mt-1">Upload a PDF or enter your paycheck details manually</p>
          <button
            onClick={() => setShowUpload(true)}
            className="btn-primary mt-4 inline-flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Your First Paycheck
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {paychecks.map((p) => (
            <PaycheckCard
              key={p.id}
              paycheck={p}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
