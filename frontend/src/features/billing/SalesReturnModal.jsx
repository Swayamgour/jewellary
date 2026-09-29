import React, { useState, useEffect, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useRecordSalesReturnMutation } from '../../app/api/baseApi';
import { formatCurrency } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errors';
import { toast } from 'sonner';

const REFUND_TYPES = [
  { value: 'LEDGER_CREDIT', label: 'Credit note (adjust against due / keep as customer credit)' },
  { value: 'CASH', label: 'Refund in cash' },
  { value: 'UPI', label: 'Refund by UPI' },
  { value: 'BANK_TRANSFER', label: 'Refund by bank transfer' }
];

/** Line value the customer gets back for `qty` units (estimate - the server computes the real value). */
const estimate = (item, qty) => {
  const perUnit = (item.totalAmount || item.taxableAmount || 0) / (item.quantity || 1);
  return perUnit * qty;
};

export const SalesReturnModal = ({ isOpen, onClose, invoice }) => {
  const [recordReturn, { isLoading }] = useRecordSalesReturnMutation();
  const [qtys, setQtys] = useState({});
  const [refundType, setRefundType] = useState('LEDGER_CREDIT');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setQtys({});
      setRefundType('LEDGER_CREDIT');
      setReason('');
    }
  }, [isOpen]);

  const lines = useMemo(
    () => (invoice?.items || []).map((i) => ({ ...i, remaining: (i.quantity || 0) - (i.returnedQty || 0) })),
    [invoice]
  );
  const selected = lines.filter((l) => (parseInt(qtys[l._id], 10) || 0) > 0);
  const est = selected.reduce((a, l) => a + estimate(l, parseInt(qtys[l._id], 10)), 0);

  if (!invoice) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (selected.length === 0) return toast.error('Choose at least one item to return');
    if (reason.trim().length < 3) return toast.error('Please enter a return reason');
    for (const l of selected) {
      const q = parseInt(qtys[l._id], 10);
      if (q > l.remaining) return toast.error(`${l.barcode}: only ${l.remaining} can still be returned`);
    }
    try {
      const res = await recordReturn({
        id: invoice._id,
        items: selected.map((l) => ({ invoiceItemId: l._id, quantity: parseInt(qtys[l._id], 10) })),
        refundType,
        reason: reason.trim()
      }).unwrap();
      const r = res.data;
      toast.success(
        `Return ${r.returnNo}: ${formatCurrency(r.totalRefundAmount)} — ${
          r.settlement?.cashRefunded > 0 ? `${formatCurrency(r.settlement.cashRefunded)} refunded` : r.settlement?.creditRetained > 0 ? `${formatCurrency(r.settlement.creditRetained)} kept as customer credit` : 'adjusted against due'
        }`
      );
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to record the return'));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Sales Return — ${invoice.invoiceNo}`} subtitle="Stock comes back, the customer is credited and the bill is updated" maxWidth="max-w-2xl">
      <form onSubmit={submit} className="space-y-4 text-xs">
        <div className="border border-surface-200 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-surface-50 text-[10px] uppercase font-bold text-surface-600 border-b border-surface-200">
              <tr><th className="p-2">Item</th><th className="p-2 text-center">Sold</th><th className="p-2 text-center">Returned</th><th className="p-2 text-center">Return qty</th><th className="p-2 text-right">≈ Value</th></tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {lines.map((l) => {
                const q = parseInt(qtys[l._id], 10) || 0;
                return (
                  <tr key={l._id} className={l.remaining <= 0 ? 'opacity-50' : ''}>
                    <td className="p-2"><p className="font-bold text-surface-900">{l.productName}</p><span className="font-mono text-[10px] text-surface-500">{l.barcode}</span></td>
                    <td className="p-2 text-center">{l.quantity}</td>
                    <td className="p-2 text-center">{l.returnedQty || 0}</td>
                    <td className="p-2 text-center">
                      <input type="number" min="0" max={l.remaining} disabled={l.remaining <= 0} value={qtys[l._id] ?? ''} placeholder="0"
                        onChange={(e) => setQtys({ ...qtys, [l._id]: e.target.value })} className="w-16 rounded border border-surface-300 px-1.5 py-1 text-center font-bold disabled:bg-surface-100" />
                    </td>
                    <td className="p-2 text-right font-semibold">{q > 0 ? formatCurrency(estimate(l, q)) : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase text-surface-600">How should the customer be settled?</label>
          <select value={refundType} onChange={(e) => setRefundType(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-300 p-2 font-semibold bg-white">
            {REFUND_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <p className="text-[11px] text-surface-500 mt-1">
            The return value first reduces what the customer still owes on this bill. Only money already paid beyond that is refunded (or kept as credit).
          </p>
        </div>

        <Input label="Return reason *" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Size mismatch / defective clasp" required />

        <div className="flex items-center justify-between p-3 rounded-xl bg-gold-50/70 border border-gold-200">
          <span className="font-semibold text-surface-700">Estimated credit note value</span>
          <span className="text-lg font-black font-display text-surface-900">{formatCurrency(est)}</span>
        </div>
        <p className="text-[10px] text-surface-400">Exact value (discount + GST share) is calculated by the server.</p>

        <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
          <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" isLoading={isLoading} icon={RotateCcw}>Confirm Return</Button>
        </div>
      </form>
    </Modal>
  );
};
