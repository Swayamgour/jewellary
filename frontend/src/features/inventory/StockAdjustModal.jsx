import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useStockAdjustmentMutation, useStockTransferMutation, useGetBranchesQuery } from '../../app/api/baseApi';
import { useSelector } from 'react-redux';
import { selectCurrentBranch } from '../auth/authSlice';
import { getErrorMessage } from '../../utils/errors';
import { toast } from 'sonner';

const ADJ_TYPES = [
  { value: 'ADJUSTMENT_IN', label: 'Adjustment IN (found extra / correction)' },
  { value: 'ADJUSTMENT_OUT', label: 'Adjustment OUT (missing / correction)' },
  { value: 'DAMAGE', label: 'Damaged (write off)' },
  { value: 'LOSS', label: 'Lost / theft' }
];

export const StockAdjustModal = ({ isOpen, onClose, item }) => {
  const [adjust, { isLoading }] = useStockAdjustmentMutation();
  const [type, setType] = useState('ADJUSTMENT_IN');
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState('');

  useEffect(() => { if (isOpen) { setType('ADJUSTMENT_IN'); setQty('1'); setReason(''); } }, [isOpen]);
  if (!item) return null;

  const submit = async (e) => {
    e.preventDefault();
    const n = parseInt(qty, 10);
    if (!(n > 0)) return toast.error('Enter a valid quantity');
    if (reason.trim().length < 3) return toast.error('Enter a reason');
    if (['ADJUSTMENT_OUT', 'DAMAGE', 'LOSS'].includes(type) && n > item.quantity) return toast.error(`Only ${item.quantity} in stock`);
    const signed = ['ADJUSTMENT_OUT', 'DAMAGE', 'LOSS'].includes(type) ? -n : n;
    try {
      await adjust({ barcode: item.barcode, adjustmentType: type, quantityDelta: signed, reason: reason.trim() }).unwrap();
      toast.success('Stock adjusted');
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Adjust Stock — ${item.barcode}`} subtitle={`Current quantity: ${item.quantity}`} maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-4 text-xs">
        <div>
          <label className="text-[11px] font-bold uppercase text-surface-600">Adjustment type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-300 p-2 font-semibold bg-white">
            {ADJ_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <Input label="Quantity" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        <Input label="Reason *" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Physical audit recount" required />
        <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
          <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" isLoading={isLoading}>Apply Adjustment</Button>
        </div>
      </form>
    </Modal>
  );
};

export const StockTransferModal = ({ isOpen, onClose, item }) => {
  const [transfer, { isLoading }] = useStockTransferMutation();
  const { data } = useGetBranchesQuery();
  const currentBranch = useSelector(selectCurrentBranch);
  const branches = (data?.data || []).filter((b) => b._id !== (currentBranch?._id || currentBranch?.id));
  const [targetBranchId, setTargetBranchId] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => { if (isOpen) { setTargetBranchId(''); setReason(''); } }, [isOpen]);
  if (!item) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!targetBranchId) return toast.error('Choose the destination branch');
    try {
      await transfer({ barcode: item.barcode, targetBranchId, reason: reason || 'Inter-branch transfer' }).unwrap();
      toast.success(`${item.barcode} transferred`);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Transfer Stock — ${item.barcode}`} subtitle="Moves the whole piece to another branch's stock" maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-4 text-xs">
        <div>
          <label className="text-[11px] font-bold uppercase text-surface-600">Destination branch *</label>
          <select value={targetBranchId} onChange={(e) => setTargetBranchId(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-300 p-2 font-semibold bg-white">
            <option value="">Select branch…</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name} ({b.code})</option>)}
          </select>
        </div>
        <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Display transfer" />
        <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
          <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" isLoading={isLoading}>Transfer</Button>
        </div>
      </form>
    </Modal>
  );
};
