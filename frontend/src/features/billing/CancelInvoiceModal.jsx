import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useCancelInvoiceMutation } from '../../app/api/baseApi';
import { PAYMENT_MODES } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errors';
import { toast } from 'sonner';

/**
 * Cancelling a bill: stock goes back, the receivable is reversed, and money the customer already paid
 * is either kept as customer credit or refunded - the cashier must choose explicitly.
 */
export const CancelInvoiceModal = ({ isOpen, onClose, invoice, goToBill = false }) => {
  const navigate = useNavigate();
  const [cancelInvoice, { isLoading }] = useCancelInvoiceMutation();
  const [reason, setReason] = useState('');
  const [paymentAction, setPaymentAction] = useState('CREDIT');
  const [refundMode, setRefundMode] = useState('CASH');

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setPaymentAction('CREDIT');
      setRefundMode('CASH');
    }
  }, [isOpen]);

  if (!invoice) return null;
  const isDraft = invoice.status === 'DRAFT';
  const paid = invoice.paymentSummary?.paid || 0;
  const exchange = invoice.paymentSummary?.exchangeAdjusted || 0;
  const refunded = invoice.paymentSummary?.refunded || 0;
  const cashPaid = Math.max(0, paid - exchange - refunded);

  const submit = async (e) => {
    e.preventDefault();
    if (reason.trim().length < 5) {
      toast.error('Please give a cancellation reason (min 5 characters)');
      return;
    }
    try {
      await cancelInvoice({ id: invoice._id, billType: invoice.billType, reason: reason.trim(), paymentAction, refundMode }).unwrap();
      toast.success(`${invoice.invoiceNo} cancelled`);
      onClose();
      if (goToBill) navigate(`/billing/${invoice._id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to cancel'));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Cancel ${invoice.invoiceNo}`} subtitle={isDraft ? 'Draft - nothing was posted' : 'Stock is restored and the customer ledger is reversed'} maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-4 text-xs">
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>This cannot be undone. {isDraft ? 'The draft will be marked cancelled.' : 'The bill total is taken off the customer\'s account and the pieces go back to stock.'}</p>
        </div>

        <Input label="Reason *" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer changed mind / wrong customer billed" required />

        {!isDraft && cashPaid > 0 && (
          <div className="space-y-2 p-3 rounded-xl border border-surface-200 bg-surface-50">
            <p className="font-bold text-surface-800">Customer already paid {formatCurrency(cashPaid)} — what happens to it?</p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="pa" checked={paymentAction === 'CREDIT'} onChange={() => setPaymentAction('CREDIT')} className="mt-0.5" />
              <span><strong>Keep as customer credit</strong><br /><span className="text-surface-500">No money leaves the shop. Credit shows on the customer's ledger and can be used on the next bill.</span></span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="pa" checked={paymentAction === 'REFUND'} onChange={() => setPaymentAction('REFUND')} className="mt-0.5" />
              <span><strong>Refund {formatCurrency(cashPaid)} now</strong><br /><span className="text-surface-500">Records a refund payment going out.</span></span>
            </label>
            {paymentAction === 'REFUND' && (
              <div>
                <label className="text-[11px] font-bold uppercase text-surface-600">Refund through</label>
                <select value={refundMode} onChange={(e) => setRefundMode(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-300 p-2 font-semibold bg-white">
                  {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            )}
          </div>
        )}
        {!isDraft && exchange > 0 && (
          <p className="text-surface-600">Old gold worth <strong>{formatCurrency(exchange)}</strong> used on this bill returns to the customer as credit on the Old Gold module.</p>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
          <Button variant="outline" type="button" onClick={onClose}>Keep Bill</Button>
          <Button variant="danger" type="submit" isLoading={isLoading}>Cancel Bill</Button>
        </div>
      </form>
    </Modal>
  );
};
