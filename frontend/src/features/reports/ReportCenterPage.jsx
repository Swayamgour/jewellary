import React, { useState, useMemo } from 'react';
import { BarChart3, Printer, Download, Calendar, RefreshCcw, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useGetReportQuery, useGetReconciliationQuery, useFixReconciliationMutation } from '../../app/api/baseApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { downloadFile } from '../../utils/download';
import { formatCurrency, formatWeight, formatDate, todayISO, monthStartISO } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errors';
import { toast } from 'sonner';

// key -> label, whether it needs a date range, and which extra filter (if any) it accepts
const REPORTS = [
  { group: 'Sales', items: [
    { key: 'sales', label: 'Sales Register', dated: true },
    { key: 'sales-returns', label: 'Sales Returns', dated: true }
  ]},
  { group: 'Purchase', items: [
    { key: 'purchase', label: 'Purchase Register', dated: true },
    { key: 'purchase-returns', label: 'Purchase Returns', dated: true }
  ]},
  { group: 'Money', items: [
    { key: 'payments', label: 'Payments', dated: true },
    { key: 'collections', label: 'Collections (net cash)', dated: true },
    { key: 'cash-summary', label: 'Cash Summary by Mode', dated: true },
    { key: 'expenses', label: 'Expenses', dated: true },
    { key: 'profit-loss', label: 'Profit & Loss', dated: true }
  ]},
  { group: 'Old Gold', items: [
    { key: 'exchange', label: 'Exchange Register', dated: true },
    { key: 'old-gold', label: 'Old Gold Composition', dated: true }
  ]},
  { group: 'Stock', items: [
    { key: 'stock', label: 'Stock Valuation', dated: false },
    { key: 'gold-stock', label: 'Gold Stock', dated: false },
    { key: 'silver-stock', label: 'Silver Stock', dated: false },
    { key: 'stock-movement', label: 'Stock Movement', dated: true }
  ]},
  { group: 'Outstanding', items: [
    { key: 'customer-outstanding', label: 'Customer Outstanding', dated: false },
    { key: 'vendor-outstanding', label: 'Vendor Outstanding', dated: false }
  ]}
];
const ALL_ITEMS = REPORTS.flatMap((g) => g.items);

const SUMMARY_LABELS = {
  count: 'Records', totalSales: 'Total Sales', netSales: 'Net Sales', totalTaxable: 'Taxable', totalTax: 'GST',
  totalReturned: 'Returned', totalPaid: 'Paid', totalDue: 'Due', totalPurchase: 'Total Purchase', netPurchase: 'Net Purchase',
  totalRefundDue: 'Refund Due', totalIn: 'Total In', totalOut: 'Total Out', net: 'Net', received: 'Received',
  refunded: 'Refunded', netCollection: 'Net Collection', oldGoldAdjusted: 'Old Gold Used', totalExpense: 'Total Expense',
  netProfit: 'Net Profit', grossProfit: 'Gross Profit', netSalesPL: 'Net Sales', costOfGoodsSold: 'COGS',
  operatingExpenses: 'Expenses', totalValue: 'Total Value', totalAdjusted: 'Adjusted', totalPaidOut: 'Paid Out',
  totalUnused: 'Unused', totalPieces: 'Pieces', totalGrossWeight: 'Gross Wt', totalNetWeight: 'Net Wt',
  totalValuation: 'Valuation', totalNetWeightOG: 'Net Wt', totalPureWeight: 'Pure Wt', customerCount: 'Customers',
  totalOutstanding: 'Total Due', customersWithCredit: 'With Credit', totalCustomerCredit: 'Credit', vendorCount: 'Vendors',
  totalPayable: 'Total Payable', vendorsWithAdvance: 'With Advance', totalVendorAdvance: 'Advance'
};

const isMoney = (k) => /total|amount|value|due|paid|received|refund|sales|purchase|expense|profit|net|collection|adjusted|credit|payable|valuation/i.test(k) && !/count|pieces|weight/i.test(k);
const isWeight = (k) => /weight/i.test(k);

export const ReportCenterPage = () => {
  const [reportKey, setReportKey] = useState('sales');
  const [startDate, setStartDate] = useState(monthStartISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [showRecon, setShowRecon] = useState(false);

  const meta = ALL_ITEMS.find((i) => i.key === reportKey);
  const params = meta?.dated ? { key: reportKey, startDate, endDate } : { key: reportKey };
  const { data, isLoading, isFetching } = useGetReportQuery(params);
  const { data: reconData } = useGetReconciliationQuery(undefined, { skip: !showRecon });
  const [fixRecon, { isLoading: fixing }] = useFixReconciliationMutation();

  const report = data?.data;
  const summary = report?.summary || {};
  const rows = report?.data || [];

  const columns = useMemo(() => (rows.length ? Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== 'object') : []), [rows]);

  const exportExcel = async () => {
    try {
      await downloadFile('/reports/export/excel', { reportType: reportKey, ...(meta?.dated ? { startDate, endDate } : {}) }, `${reportKey}_${Date.now()}.xlsx`);
      toast.success('Excel downloaded');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Export failed'));
    }
  };

  const runFix = async () => {
    try {
      const res = await fixRecon().unwrap();
      toast.success(`Fixed ${res.data.fixedDocuments} document(s)`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Fix failed'));
    }
  };

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-display">Reports</h1>
          <p className="text-xs text-surface-500 mt-1">Sales, purchase, money, old-gold, stock and outstanding — every figure is derived live from the books</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={ShieldCheck} onClick={() => setShowRecon(true)}>Books Check</Button>
          <Button variant="outline" size="sm" icon={Printer} onClick={() => window.print()}>Print</Button>
          <Button variant="primary" size="sm" icon={Download} onClick={exportExcel} className="font-bold">Export Excel</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 bg-white rounded-2xl border border-surface-200 p-3 shadow-xs space-y-4 no-print">
          {REPORTS.map((g) => (
            <div key={g.group}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-surface-400 px-2 mb-1">{g.group}</p>
              <div className="space-y-0.5">
                {g.items.map((it) => (
                  <button key={it.key} type="button" onClick={() => setReportKey(it.key)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold ${reportKey === it.key ? 'bg-gold-500 text-white' : 'text-surface-600 hover:bg-surface-50'}`}>
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-9 space-y-4">
          {meta?.dated && (
            <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-surface-200 shadow-xs no-print">
              <Calendar className="w-4 h-4 text-gold-600" />
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="!w-auto" />
              <span className="text-surface-400 text-xs">to</span>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="!w-auto" />
              {isFetching && <span className="text-[11px] text-surface-400">Refreshing…</span>}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(summary).filter(([k, v]) => typeof v === 'number' || typeof v === 'string').slice(0, 8).map(([k, v]) => (
              <div key={k} className="p-3 rounded-xl bg-white border border-surface-200 shadow-xs">
                <p className="text-[10px] uppercase font-bold text-surface-500 truncate">{SUMMARY_LABELS[k] || k}</p>
                <p className="text-sm font-black font-display text-surface-900 mt-0.5">
                  {typeof v === 'number' ? (isWeight(k) ? formatWeight(v) : isMoney(k) ? formatCurrency(v) : v) : v}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-surface-200 shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="p-4"><TableSkeleton rows={8} cols={6} /></div>
            ) : rows.length === 0 ? (
              <div className="text-center py-16 text-xs text-surface-400 flex flex-col items-center gap-2">
                <BarChart3 className="w-8 h-8 text-surface-300" />
                No data for this period
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-50 text-[10px] uppercase font-bold text-surface-600 border-b border-surface-200 sticky top-0">
                    <tr>{columns.map((c) => <th key={c} className={`py-2.5 px-3 whitespace-nowrap ${isMoney(c) || isWeight(c) || typeof rows[0][c] === 'number' ? 'text-right' : ''}`}>{SUMMARY_LABELS[c] || c.replace(/([A-Z])/g, ' $1')}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {rows.map((row, idx) => (
                      <tr key={row._id || idx} className="hover:bg-surface-50/50">
                        {columns.map((c) => {
                          const v = row[c];
                          const numeric = typeof v === 'number';
                          let display = v;
                          if (v instanceof Date || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v))) display = formatDate(v);
                          else if (numeric && isWeight(c)) display = formatWeight(v);
                          else if (numeric && isMoney(c)) display = formatCurrency(v);
                          else if (numeric) display = v;
                          else if (v === null || v === undefined) display = '-';
                          return <td key={c} className={`py-2 px-3 whitespace-nowrap ${numeric ? 'text-right font-semibold text-surface-800' : 'text-surface-700'}`}>{String(display)}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showRecon && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowRecon(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-5 space-y-4 text-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-surface-900 text-sm">Books Consistency Check</h3>
              <button onClick={() => setShowRecon(false)} className="text-surface-400 hover:text-surface-700">✕</button>
            </div>
            {!reconData ? <TableSkeleton rows={3} cols={2} /> : reconData.data.ok ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> All checked customer/vendor balances and invoice/purchase payment positions match the ledger.</div>
            ) : (
              <>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {reconData.data.issueCount} inconsistency(ies) found</div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {reconData.data.issues.map((iss, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg border border-surface-200 bg-surface-50">
                      <p className="font-bold text-surface-800">{iss.type.replace(/_/g, ' ')} — {iss.name || iss.invoiceNo || iss.purchaseNo}</p>
                      <p className="text-surface-500">Stored: {JSON.stringify(iss.stored ?? iss.ledger ?? iss)} </p>
                      {iss.expected && <p className="text-surface-500">Expected: {JSON.stringify(iss.expected)}</p>}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="primary" icon={RefreshCcw} isLoading={fixing} onClick={runFix}>Re-derive invoice/purchase totals</Button>
                </div>
                <p className="text-[10px] text-surface-400">This only re-derives invoice and purchase payment positions from their payments — it never changes a customer/vendor ledger balance automatically.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
