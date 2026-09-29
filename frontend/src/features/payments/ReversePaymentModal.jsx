import React, { useState, useEffect } from 'react';
import { Undo2, AlertTriangle } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useReversePaymentMutation } from '../../app/api/baseApi';
import { formatCurrency } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errors';
import { toast } from 'sonner';

export const ReversePaymentModal = ({ isOpen, onClose, payment }) => {
  const [reverse, { isLoading }] = useReversePaymentMutation();
  const [reason, setReason] = useState('');
  useEffect(() => { if (isOpen) setReason(''); }, [isOpen]);
  if (!payment) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (reason.trim().length < 3) return toast.error('Enter a reason (e.g. cheque bounced)');
    try {
      await reverse({ id: payment._id, reversalReason: reason.trim() }).unwrap();
      toast.success('Payment reversed');
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to reverse payment'));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Reverse Payment ${payment.paymentNo}`} maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-4 text-xs">
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>Reversing {formatCurrency(payment.amount)} puts the balance back on the ledger. This cannot be undone.</p>
        </div>
        <Input label="Reason *" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Cheque bounced" required />
        <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
          <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="danger" type="submit" isLoading={isLoading} icon={Undo2}>Reverse</Button>
        </div>
      </form>
    </Modal>
  );
};
