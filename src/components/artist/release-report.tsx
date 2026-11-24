'use client';

import { useCallback, useEffect, useState } from 'react';

interface ReleaseCosts {
  recordingCents: number;
  videoCents: number;
  marketingCents: number;
  otherCents: number;
  fixedShareCents: number;
  totalCents: number;
}

interface ReleaseRow {
  dropId: string;
  artistName: string | null;
  title: string;
  status: string;
  currency: string;
  releaseDate: string;
  windowStart: string;
  windowEnd: string;
  unitsSold: number;
  buyers: number;
  grossSalesCents: number;
  refundsCents: number;
  platformFeeCents: number;
  stripeFeeEstimateCents: number;
  artistNetCents: number;
  newMembers: number;
  costs: ReleaseCosts;
  profitCents: number;
}

interface Totals {
  currency: string;
  releases: number;
  unitsSold: number;
  grossSalesCents: number;
  artistNetCents: number;
  costsCents: number;
  profitCents: number;
}

interface Report {
  rows: ReleaseRow[];
  totals: Totals[];
  assumptions: {
    windowDaysAfterRelease: number;
    stripeFeePercent: number;
    stripeFeeFixedCents: number;
  };
}

type CostForm = { recording: string; video: string; marketing: string; other: string };

const COST_FIELDS: Array<{ key: keyof CostForm; label: string }> = [
  { key: 'recording', label: 'Recording' },
  { key: 'video', label: 'Video' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'other', label: 'Other' },
];

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

interface ReleaseReportProps {
  /** Admin view: every artist's releases, read only. */
  admin?: boolean;
}

export default function ReleaseReport({ admin = false }: ReleaseReportProps) {
  const endpoint = admin ? '/api/admin/reports/releases' : '/api/artist/reports/releases';
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fixedMonthly, setFixedMonthly] = useState('');
  const [appliedFixed, setAppliedFixed] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<CostForm>({
    recording: '',
    video: '',
    marketing: '',
    other: '',
  });
  const [saving, setSaving] = useState(false);

  const query = appliedFixed ? `?fixedMonthly=${encodeURIComponent(appliedFixed)}` : '';

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${endpoint}${query}`);
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error || 'Failed to load the report');
      setReport(body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the report');
    } finally {
      setLoading(false);
    }
  }, [endpoint, query]);

  useEffect(() => {
    load();
  }, [load]);

  const startEditing = (row: ReleaseRow) => {
    setEditing(row.dropId);
    setForm({
      recording: (row.costs.recordingCents / 100).toFixed(2),
      video: (row.costs.videoCents / 100).toFixed(2),
      marketing: (row.costs.marketingCents / 100).toFixed(2),
      other: (row.costs.otherCents / 100).toFixed(2),
    });
  };

  const saveCosts = async (dropId: string) => {
    const payload: Record<string, number> = {};
    for (const { key, label } of COST_FIELDS) {
      const value = form[key].trim() === '' ? 0 : Number(form[key]);
      if (!Number.isFinite(value) || value < 0) {
        setError(`${label} cost must be a dollar amount from 0 up`);
        return;
      }
      payload[key] = value;
    }
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`/api/artist/drops/${dropId}/costs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error || 'Failed to save costs');
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save costs');
    } finally {
      setSaving(false);
    }
  };

  const csvHref = `${endpoint}?format=csv${appliedFixed ? `&fixedMonthly=${encodeURIComponent(appliedFixed)}` : ''}`;

  return (
    <section className='space-y-6'>
      <div className='flex flex-wrap items-end justify-between gap-4'>
        <div>
          <h1 className='text-3xl font-bold text-white'>Release report</h1>
          <p className='mt-1 text-sm text-gray-400'>
            Sales, fees, new members, costs and profit for each drop.
          </p>
        </div>
        <div className='flex flex-wrap items-end gap-3'>
          <label className='text-sm text-gray-300'>
            Monthly fixed costs ($)
            <input
              type='number'
              min='0'
              step='0.01'
              inputMode='decimal'
              value={fixedMonthly}
              onChange={e => setFixedMonthly(e.target.value)}
              placeholder='e.g. 73'
              className='mt-1 block w-32 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white'
            />
          </label>
          <button
            type='button'
            onClick={() => setAppliedFixed(fixedMonthly.trim())}
            className='rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500'
          >
            Apply
          </button>
          <a
            href={csvHref}
            className='rounded-md border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-100 hover:border-gray-400'
          >
            Download CSV
          </a>
        </div>
      </div>

      {error && (
        <p
          role='alert'
          className='rounded-md border border-red-700 bg-red-950 px-4 py-3 text-sm text-red-200'
        >
          {error}
        </p>
      )}

      {loading && !report && <p className='text-gray-400'>Loading the report...</p>}

      {report && report.totals.length > 0 && (
        <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
          {report.totals.map(t => (
            <div key={t.currency} className='contents'>
              <Stat label='Gross sales' value={formatMoney(t.grossSalesCents, t.currency)} />
              <Stat label='Artist net' value={formatMoney(t.artistNetCents, t.currency)} />
              <Stat label='Costs' value={formatMoney(t.costsCents, t.currency)} />
              <Stat
                label='Profit'
                value={formatMoney(t.profitCents, t.currency)}
                tone={t.profitCents < 0 ? 'loss' : 'gain'}
              />
            </div>
          ))}
        </div>
      )}

      {report && report.rows.length === 0 && (
        <p className='rounded-[10px] border border-gray-800 bg-gray-950 p-6 text-gray-300'>
          No releases yet. Create a drop and its numbers show up here.
        </p>
      )}

      {report && report.rows.length > 0 && (
        <div className='overflow-x-auto rounded-[10px] border border-gray-800 bg-gray-950'>
          <table className='min-w-full text-left text-sm text-gray-200'>
            <thead className='bg-gray-900 text-xs uppercase tracking-wide text-gray-400'>
              <tr>
                <th className='px-4 py-3'>Release</th>
                <th className='px-4 py-3 text-right'>Sold</th>
                <th className='px-4 py-3 text-right'>Buyers</th>
                <th className='px-4 py-3 text-right'>Gross</th>
                <th className='px-4 py-3 text-right'>Refunds</th>
                <th className='px-4 py-3 text-right'>Platform fee</th>
                <th className='px-4 py-3 text-right'>Stripe fee (est.)</th>
                <th className='px-4 py-3 text-right'>Artist net</th>
                <th className='px-4 py-3 text-right'>New members</th>
                <th className='px-4 py-3 text-right'>Costs</th>
                <th className='px-4 py-3 text-right'>Profit</th>
                {!admin && (
                  <th className='px-4 py-3'>
                    <span className='sr-only'>Edit</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-800'>
              {report.rows.map(row => (
                <ReportRow
                  key={row.dropId}
                  row={row}
                  admin={admin}
                  editing={editing === row.dropId}
                  form={form}
                  saving={saving}
                  onEdit={() => startEditing(row)}
                  onCancel={() => setEditing(null)}
                  onChange={(key, value) => setForm(f => ({ ...f, [key]: value }))}
                  onSave={() => saveCosts(row.dropId)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {report && (
        <p className='text-xs text-gray-500'>
          New members are fans who started a membership from presale open (or release day) to{' '}
          {report.assumptions.windowDaysAfterRelease} days after release; a fan can count for two
          releases whose windows overlap. Stripe&apos;s fee is estimated at{' '}
          {report.assumptions.stripeFeePercent}% + {report.assumptions.stripeFeeFixedCents}¢ per
          sale and still counts on a refund. Monthly fixed costs are shared across the releases
          whose windows are open at the same time.
        </p>
      )}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'gain' | 'loss' }) {
  const color =
    tone === 'loss' ? 'text-red-400' : tone === 'gain' ? 'text-emerald-400' : 'text-white';
  return (
    <div className='rounded-[10px] border border-gray-800 bg-gray-950 p-4'>
      <p className='text-xs uppercase tracking-wide text-gray-400'>{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

interface ReportRowProps {
  row: ReleaseRow;
  admin: boolean;
  editing: boolean;
  form: CostForm;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onChange: (key: keyof CostForm, value: string) => void;
  onSave: () => void;
}

function ReportRow({
  row,
  admin,
  editing,
  form,
  saving,
  onEdit,
  onCancel,
  onChange,
  onSave,
}: ReportRowProps) {
  const money = (cents: number) => formatMoney(cents, row.currency);
  return (
    <>
      <tr>
        <td className='px-4 py-3'>
          <div className='font-semibold text-white'>{row.title}</div>
          <div className='text-xs text-gray-400'>
            {admin && row.artistName ? `${row.artistName} · ` : ''}
            {formatDate(row.releaseDate)} · {row.status.toLowerCase()}
          </div>
        </td>
        <td className='px-4 py-3 text-right'>{row.unitsSold}</td>
        <td className='px-4 py-3 text-right'>{row.buyers}</td>
        <td className='px-4 py-3 text-right'>{money(row.grossSalesCents)}</td>
        <td className='px-4 py-3 text-right'>{money(row.refundsCents)}</td>
        <td className='px-4 py-3 text-right'>{money(row.platformFeeCents)}</td>
        <td className='px-4 py-3 text-right'>{money(row.stripeFeeEstimateCents)}</td>
        <td className='px-4 py-3 text-right'>{money(row.artistNetCents)}</td>
        <td className='px-4 py-3 text-right'>{row.newMembers}</td>
        <td className='px-4 py-3 text-right'>{money(row.costs.totalCents)}</td>
        <td
          className={`px-4 py-3 text-right font-semibold ${row.profitCents < 0 ? 'text-red-400' : 'text-emerald-400'}`}
        >
          {money(row.profitCents)}
        </td>
        {!admin && (
          <td className='px-4 py-3 text-right'>
            {!editing && (
              <button
                type='button'
                onClick={onEdit}
                className='text-sm font-semibold text-fuchsia-400 hover:text-fuchsia-300'
                aria-label={`Edit costs for ${row.title}`}
              >
                Edit costs
              </button>
            )}
          </td>
        )}
      </tr>
      {editing && (
        <tr className='bg-gray-900'>
          <td colSpan={12} className='px-4 py-4'>
            <div className='flex flex-wrap items-end gap-3'>
              {COST_FIELDS.map(({ key, label }) => (
                <label key={key} className='text-sm text-gray-300'>
                  {label} ($)
                  <input
                    type='number'
                    min='0'
                    step='0.01'
                    inputMode='decimal'
                    value={form[key]}
                    onChange={e => onChange(key, e.target.value)}
                    className='mt-1 block w-28 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-white'
                  />
                </label>
              ))}
              <button
                type='button'
                onClick={onSave}
                disabled={saving}
                className='rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-50'
              >
                {saving ? 'Saving...' : 'Save costs'}
              </button>
              <button
                type='button'
                onClick={onCancel}
                className='rounded-md px-4 py-2 text-sm text-gray-300 hover:text-white'
              >
                Cancel
              </button>
              {row.costs.fixedShareCents > 0 && (
                <span className='text-xs text-gray-400'>
                  Plus {money(row.costs.fixedShareCents)} share of monthly fixed costs
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
