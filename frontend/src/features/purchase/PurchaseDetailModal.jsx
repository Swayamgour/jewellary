import React, { useState, useEffect } from 'react';
import { CreditCard, RotateCcw, XCircle, CheckCircle, Pencil, Undo2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  useGetPurchaseByIdQuery, usePayPurchaseMutation, useRefundPurchaseMutation, useRecordPurchaseReturnMutation,
  useCancelPurchaseMutation, useConfirmPurchaseMutation
} from '../../app/api/baseApi';
import { PAYMENT_MODES, CAN_BUY, paymentStatusVariant } from '../../utils/constants';
import { formatCurrency, formatDate, formatWeight } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errors';
import { toast } from 'sonner';

const Stat = ({ label, value, tone = '' }) => (
  <div className="p-3 rounded-xl bg-surface-50 border border-surface-200">
    <p className="text-[10px] uppercase font-bold text-surface-500">{label}</p>
    <p className={`text-sm font-black font-display mt-0.5 ${tone}`}>{formatCurrency(value || 0)}</p>
  </div>
);

const ModeSelect = ({ value, onChange }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-300 p-2 font-semibold bg-white text-xs">
    {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
  </select>
);

export const PurchaseDetailModal = ({ purchaseId, role, onClose, onEditDraft }) => {
  const { data, isLoading } = useGetPurchaseByIdQuery(purchaseId, { skip: !purchaseId });
  const [pay, { isLoading: paying }] = usePayPurchaseMutation();
  const [refund, { isLoading: refunding }] = useRefundPurchaseMutation();
  const [doReturn, { isLoading: returning }] = useRecordPurchaseReturnMutation();
  const [cancel, { isLoading: cancelling }] = useCancelPurchaseMutation();
  const [confirm, { isLoading: confirming }] = useConfirmPurchaseMutation();

  const [view, setView] = useState('main');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('BANK_TRANSFER');
  const [reason, setReason] = useState('');
  const [payAction, setPayAction] = useState('CREDIT');
  const [qtys, setQtys] = useState({});

  const p = data?.data;
  useEffect(() => {
    setView('main'); setAmount(''); setReason(''); setQtys({}); setPayAction('CREDIT');
  }, [purchaseId]);

  const canBuy = CAN_BUY.includes(role) || ['BRANCH_MANAGER', 'ACCOUNTANT'].includes(role);
  const run = async (fn, okMsg) => {
    try {
      await fn();
      toast.success(okMsg);
      setView('main'); setAmount(''); setReason(''); setQtys({});
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const isDraft = p?.status === 'DRAFT';
  const isDone = p?.status === 'COMPLETED';
  const returnLines = (p?.items || []).map((i) => ({ ...i, remaining: i.quantity - (i.returnedQty || 0) }));
  const returnSel = returnLines.filter((l) => (parseInt(qtys[l._id], 10) || 0) > 0);

  return (
    <Modal isOpen={Boolean(purchaseId)} onClose={onClose} title={p ? `Purchase ${p.purchaseNo}` : 'Purchase'} subtitle={p ? `${p.vendorId?.company || p.vendorId?.name || ''} · ${formatDate(p.purchaseDate)}` : ''} maxWidth="max-w-4xl">
      {isLoading || !p ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant={isDone ? 'success' : isDraft ? 'default' : 'danger'}>{p.status}</Badge>
            {isDone && <Badge variant={paymentStatusVariant(p.paymentStatus)}>{p.paymentStatus}</Badge>}
            {isDone && p.returnStatus !== 'NONE' && <Badge variant="info">{p.returnStatus} RETURN</Badge>}
            {p.vendorInvoiceNo && <span className="text-surface-500">Vendor bill: <strong>{p.vendorInvoiceNo}</strong></span>}
            {p.purchaseOrderId && <span className="text-surface-500">Against a purchase order</span>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <Stat label="Bill total" value={p.grandTotal} />
            <Stat label="Returned" value={p.returnedAmount} tone="text-sky-700" />
            <Stat label="Payable after returns" value={p.adjustedTotal ?? p.grandTotal} />
            <Stat label="Paid" value={p.paidAmount} tone="text-emerald-700" />
            <Stat label="Still due" value={p.dueAmount} tone={p.dueAmount > 0 ? 'text-amber-600' : ''} />
            <Stat label="Vendor owes us" value={p.refundDue} tone={p.refundDue > 0 ? 'text-rose-600' : ''} />
          </div>

          <div className="overflow-x-auto border border-surface-200 rounded-xl">
            <table className="w-full text-left">
              <thead className="bg-surface-50 text-[10px] uppercase font-bold text-surface-600 border-b border-surface-200">
                <tr><th className="p-2">Item</th><th className="p-2">Purity</th><th className="p-2 text-center">Qty</th><th className="p-2 text-center">Returned</th><th className="p-2 text-right">Net wt (total)</th><th className="p-2 text-right">Taxable</th><th className="p-2 text-right">GST</th><th className="p-2 text-right">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {p.items.map((i) => (
                  <tr key={i._id}>
                    <td className="p-2"><p className="font-bold text-surface-900">{i.productName}</p><span className="font-mono text-[10px] text-surface-500">{i.barcode}</span></td>
                    <td className="p-2">{i.metal} {i.purity}</td>
                    <td className="p-2 text-center">{i.quantity}</td>
                    <td className="p-2 text-center">{i.returnedQty || 0}</td>
                    <td className="p-2 text-right">{formatWeight(i.netWeight * i.quantity)}</td>
                    <td className="p-2 text-right">{formatCurrency(i.taxableAmount)}</td>
                    <td className="p-2 text-right">{formatCurrency(i.taxAmount)}</td>
                    <td className="p-2 text-right font-bold">{formatCurrency(i.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canBuy && view === 'main' && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-100">
              {isDraft && (
                <>
                  <Button size="sm" variant="success" icon={CheckCircle} onClick={() => { setAmount(''); setView('confirm'); }}>Confirm & Add Stock</Button>
                  <Button size="sm" variant="outline" icon={Pencil} onClick={() => onEditDraft(p)}>Edit Draft</Button>
                </>
              )}
              {isDone && p.dueAmount > 0 && <Button size="sm" variant="primary" icon={CreditCard} onClick={() => { setAmount(String(p.dueAmount)); setView('pay'); }}>Pay Vendor</Button>}
              {isDone && p.refundDue > 0 && <Button size="sm" variant="goldSoft" icon={Undo2} onClick={() => { setAmount(String(p.refundDue)); setView('refund'); }}>Record Vendor Refund</Button>}
              {isDone && returnLines.some((l) => l.remaining > 0) && <Button size="sm" variant="outline" icon={RotateCcw} onClick={() => setView('return')}>Return Goods</Button>}
              {(isDone || isDraft) && <Button size="sm" variant="outline" icon={XCircle} onClick={() => setView('cancel')} className="text-red-600 border-red-200 hover:bg-red-50">Cancel Purchase</Button>}
            </div>
          )}

          {view === 'confirm' && (
            <div className="p-4 rounded-xl border border-surface-200 bg-surface-50 space-y-3">
              <p className="font-bold text-surface-900">Confirm purchase — stock is added and the vendor ledger credited</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Pay now ₹ (optional)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <div><label className="text-[11px] font-bold uppercase text-surface-600">Mode</label><ModeSelect value={mode} onChange={setMode} /></div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setView('main')}>Back</Button>
                <Button size="sm" variant="success" isLoading={confirming} onClick={() => run(() => confirm({ id: p._id, paidAmount: parseFloat(amount) || 0, paymentMode: mode }).unwrap(), 'Purchase confirmed')}>Confirm</Button>
              </div>
            </div>
          )}

          {(view === 'pay' || view === 'refund') && (
            <div className="p-4 rounded-xl border border-surface-200 bg-surface-50 space-y-3">
              <p className="font-bold text-surface-900">{view === 'pay' ? `Pay vendor (due ${formatCurrency(p.dueAmount)})` : `Vendor refund received (owed ${formatCurrency(p.refundDue)})`}</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Amount ₹" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <div><label className="text-[11px] font-bold uppercase text-surface-600">Mode</label><ModeSelect value={mode} onChange={setMode} /></div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setView('main')}>Back</Button>
                <Button size="sm" variant="primary" isLoading={paying || refunding} onClick={() => {
                  const amt = parseFloat(amount);
                  if (!(amt > 0)) return toast.error('Enter a valid amount');
                  const fn = view === 'pay' ? pay : refund;
                  run(() => fn({ id: p._id, amount: amt, paymentMode: mode }).unwrap(), view === 'pay' ? 'Payment recorded' : 'Refund recorded');
                }}>Record</Button>
              </div>
            </div>
          )}

          {view === 'return' && (
            <div className="p-4 rounded-xl border border-surface-200 bg-surface-50 space-y-3">
              <p className="font-bold text-surface-900">Return goods to vendor — value is calculated from the purchase lines</p>
              {returnLines.filter((l) => l.remaining > 0).map((l) => (
                <div key={l._id} className="flex items-center justify-between gap-3">
                  <span><strong>{l.productName}</strong> <span className="font-mono text-[10px] text-surface-500">{l.barcode}</span> · returnable {l.remaining}</span>
                  <input type="number" min="0" max={l.remaining} placeholder="0" value={qtys[l._id] ?? ''} onChange={(e) => setQtys({ ...qtys, [l._id]: e.target.value })} className="w-20 rounded border border-surface-300 p-1 text-center font-bold" />
                </div>
              ))}
              <Input label="Reason *" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Purity mismatch" />
              <p className="text-[11px] text-surface-500">Only pieces still in stock can go back. If some were already sold, the API will refuse.</p>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setView('main')}>Back</Button>
                <Button size="sm" variant="primary" isLoading={returning} onClick={() => {
                  if (returnSel.length === 0) return toast.error('Choose items to return');
                  if (reason.trim().length < 3) return toast.error('Enter a reason');
                  run(() => doReturn({ id: p._id, items: returnSel.map((l) => ({ purchaseItemId: l._id, quantity: parseInt(qtys[l._id], 10) })), reason: reason.trim() }).unwrap(), 'Purchase return recorded');
                }}>Confirm Return</Button>
              </div>
            </div>
          )}

          {view === 'cancel' && (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 space-y-3">
              <p className="font-bold text-red-800">Cancel this purchase{isDone ? ' — allowed only while none of the stock has been sold or moved' : ''}</p>
              <Input label="Reason *" value={reason} onChange={(e) => setReason(e.target.value)} />
              {isDone && p.paidAmount > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold text-surface-800">We already paid {formatCurrency(p.paidAmount - (p.refundReceived || 0))} — what happens to it?</p>
                  <label className="flex gap-2 items-start"><input type="radio" checked={payAction === 'CREDIT'} onChange={() => setPayAction('CREDIT')} className="mt-0.5" /><span><strong>Keep as vendor credit</strong> (advance with the vendor)</span></label>
                  <label className="flex gap-2 items-start"><input type="radio" checked={payAction === 'REFUND'} onChange={() => setPayAction('REFUND')} className="mt-0.5" /><span><strong>Vendor refunds it now</strong></span></label>
                  {payAction === 'REFUND' && <ModeSelect value={mode} onChange={setMode} />}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setView('main')}>Back</Button>
                <Button size="sm" variant="danger" isLoading={cancelling} onClick={() => {
                  if (reason.trim().length < 5) return toast.error('Reason must be at least 5 characters');
                  run(() => cancel({ id: p._id, reason: reason.trim(), paymentAction: payAction, refundMode: mode }).unwrap(), 'Purchase cancelled');
                }}>Cancel Purchase</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
