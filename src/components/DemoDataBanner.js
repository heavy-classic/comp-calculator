'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, Trash2, Loader2 } from 'lucide-react';

export default function DemoDataBanner({ hasData }) {
  const router = useRouter();
  const [status, setStatus] = useState('idle'); // idle | seeding | clearing | done

  const seed = async () => {
    if (!confirm('This will add sample deals, line items, and paychecks so you can explore the app. Continue?')) return;
    setStatus('seeding');
    const res = await fetch('/api/seed', { method: 'POST' });
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json();
      alert('Seed failed: ' + d.error);
    }
    setStatus('idle');
  };

  const clearAll = async () => {
    if (!confirm('⚠️ This will permanently delete ALL deals, line items, and paychecks from the database. Are you sure?')) return;
    setStatus('clearing');
    const res = await fetch('/api/seed', { method: 'DELETE' });
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json();
      alert('Clear failed: ' + d.error);
    }
    setStatus('idle');
  };

  const busy = status !== 'idle';

  if (hasData) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Trash2 className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Ready to enter production data?</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Clear all data to start fresh with your real deals and paychecks.
            </p>
          </div>
        </div>
        <button
          onClick={clearAll}
          disabled={busy}
          className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 border border-red-300 hover:border-red-400 bg-white rounded-lg px-4 py-2 flex-shrink-0 transition-colors"
        >
          {busy && status === 'clearing' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          Clear All Data
        </button>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <FlaskConical className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">No data yet — load demo data to explore</p>
          <p className="text-xs text-blue-600 mt-1">
            Loads 5 sample deals, 14 line items, and 3 paychecks so you can see the dashboard, analytics, and reports in action.
            Delete it all with one click when you're ready to enter real data.
          </p>
        </div>
      </div>
      <button
        onClick={seed}
        disabled={busy}
        className="btn-primary flex items-center gap-2 flex-shrink-0 text-sm"
      >
        {busy && status === 'seeding' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FlaskConical className="w-4 h-4" />
        )}
        {status === 'seeding' ? 'Loading…' : 'Load Demo Data'}
      </button>
    </div>
  );
}
