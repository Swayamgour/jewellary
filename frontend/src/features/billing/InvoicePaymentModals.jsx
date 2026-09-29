import React, { useState, useEffect } from 'react';
import { CreditCard, Coins, CheckCircle } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  useRecordPaymentMutation,
  useConfirmDraftInvoiceMutation,
  useGetExchangesQuery,
  useAdjustExchangeMutation
} from '../../app/api/baseApi';
import { PAYMENT_MODES } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errors';
import { toast } from 'sonner';

const customerIdOf = (inv) => inv?.customerId?._id || inv?.customerId;

/** Collect a payment against a confirmed bill */
export const CollectPaymentModal = ({ isOpen, onClose, invoice }) => {
  const [recordPayment, { isLoading }] = useRecordPaymentMutation();
  const due = invoice?.paymentSummary?.due || 0;
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('CASH');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAmount(String(due));
      setMode('CASH');
      setNotes('');
    }
  }, [isOpen, due]);

  if (!invoice) return null;

  const submit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!(amt > 0)) return toast.error('Enter a valid amount');
    if (amt > due + 0.005) return toast.error(`Amount cannot exceed the due ${formatCurrency(due)}`);
    try {
      await recordPayment({
        referenceType: 'INVOICE',
        referenceId: invoice._id,
        entityType: 'CUSTOMER',
        entityId: customerIdOf(invoice),
        amount: amt,
        paymentMode: mode,
        notes: notes || `Payment for ${invoice.invoiceNo}`
      }).unwrap();
      toast.success(`${formatCurrency(amt)} received`);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to record payment'));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Collect Payment — ${invoice.invoiceNo}`} subtitle={`Remaining due: ${formatCurrency(due)}`} maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-4 text-xs">
        <Input label="Amount (₹) *" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <div>
          <label className="text-[11px] font-bold uppercase text-surface-600">Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-300 p-2 font-semibold bg-white">
            {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <Input label="Note" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
          <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" isLoading={isLoading} icon={CreditCard}>Record Payment</Button>
        </div>
      </form>
    </Modal>
  );
};

/** Confirm a DRAFT bill: posts stock + ledger, gives it its real number, optionally takes payment */
export const ConfirmDraftModal = ({ isOpen, onClose, invoice, presetPayments = null }) => {
  const [confirmDraft, { isLoading }] = useConfirmDraftInvoiceMutation();
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('CASH');

  useEffect(() => {
    if (!isOpen) return;
    if (presetPayments?.length) {
      setAmount(String(presetPayments[0].amount));
      setMode(presetPayments[0].paymentMode);
    } else {
      setAmount('');
      setMode('CASH');
    }
  }, [isOpen, presetPayments]);

  if (!invoice) return null;

  const submit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount) || 0;
    if (amt > invoice.grandTotal + 0.005) return toast.error('Payment cannot exceed the bill total');
    try {
      const res = await confirmDraft({
        id: invoice._id,
        billType: invoice.billType,
        payments: amt > 0 ? [{ amount: amt, paymentMode: mode }] : []
      }).unwrap();
      toast.success(`Confirmed as ${res.data?.invoiceNo}`);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to confirm the draft'));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirm Draft Bill" subtitle="Stock is deducted and the customer ledger is debited only now" maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-4 text-xs">
        <div className="p-3 rounded-xl bg-gold-50/70 border border-gold-200 flex justify-between">
          <span>Bill total (re-priced at confirmation)</span>
          <strong>{formatCurrency(invoice.grandTotal)}</strong>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Payment now (₹, optional)" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          <div>
            <label className="text-[11px] font-bold uppercase text-surface-600">Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-300 p-2 font-semibold bg-white">
              {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
          <Button variant="outline" type="button" onClick={onClose}>Not yet</Button>
          <Button variant="primary" type="submit" isLoading={isLoading} icon={CheckCircle}>Confirm Bill</Button>
        </div>
      </form>
    </Modal>
  );
};

/** Use old-gold credit as payment on this bill */
export const AdjustOldGoldModal = ({ isOpen, onClose, invoice }) => {
  const cid = customerIdOf(invoice);
  const { data, isFetching } = useGetExchangesQuery({ customerId: cid, limit: 50 }, { skip: !isOpen || !cid });
  const [adjust, { isLoading }] = useAdjustExchangeMutation();
  const due = invoice?.paymentSummary?.due || 0;

  const usable = (data?.data || [])
    .map((e) => ({ ...e, remaining: (e.totalExchangeValue || 0) - (e.adjustedAmount || 0) - (e.paidOutAmount || 0) }))
    .filter((e) => e.remaining > 0.005 && e.status !== 'CANCELLED');

  const use = async (ex) => {
    try {
      const res = await adjust({ id: ex._id, invoiceId: invoice._id }).unwrap();
      toast.success(`Old gold ${ex.exchangeNo} adjusted on ${invoice.invoiceNo}`);
      onClose();
      return res;
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to adjust old gold'));
    }
  };

  if (!invoice) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Adjust Old Gold on this Bill" subtitle={`Bill due: ${formatCurrency(due)} — the exchange value is used up to the due amount`} maxWidth="max-w-lg">
      <div className="space-y-3 text-xs">
        {isFetching ? (
          <p className="text-surface-400">Loading...</p>
        ) : usable.length === 0 ? (
          <p className="text-surface-500 py-6 text-center">This customer has no unused old-gold credit. Record an old-gold intake in the Old Gold module first.</p>
        ) : (
          usable.map((ex) => (
            <div key={ex._id} className="flex items-center justify-between p-3 rounded-xl border border-surface-200">
              <div>
                <p className="font-mono font-bold text-surface-900">{ex.exchangeNo}</p>
                <p className="text-surface-500">{formatDate(ex.exchangeDate)} · unused <strong className="text-gold-800">{formatCurrency(ex.remaining)}</strong></p>
              </div>
              <Button size="sm" variant="goldSoft" icon={Coins} isLoading={isLoading} onClick={() => use(ex)}>
                Use {formatCurrency(Math.min(ex.remaining, due))}
              </Button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};
