import React, { useState, useEffect, useMemo } from 'react';
import { Coins, Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { CustomerPicker } from '../billing/CustomerPicker';
import { CustomerSelectModal } from '../billing/CustomerSelectModal';
import { useCreateExchangeMutation } from '../../app/api/baseApi';
import { METALS } from '../../utils/constants';
import { formatCurrency, formatWeight } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errors';
import { toast } from 'sonner';

const blank = () => ({ itemDescription: '', metal: 'GOLD', purityDeclared: '22K', testingMethod: 'TOUCHSTONE', purityTestedPercent: '91.6', grossWeight: '', stoneWeight: '0', meltingLossPercent: '0', goldRateApplied: '' });
const num = (v) => parseFloat(v) || 0;
const lineCalc = (l) => {
  const net = Math.max(0, num(l.grossWeight) - num(l.stoneWeight));
  const afterMelt = net * (1 - num(l.meltingLossPercent) / 100);
  const pure = afterMelt * (num(l.purityTestedPercent) / 100);
  return { net, pure, value: pure * num(l.goldRateApplied) };
};

export const NewExchangeModal = ({ isOpen, onClose }) => {
  const [create, { isLoading }] = useCreateExchangeMutation();
  const [customer, setCustomer] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [items, setItems] = useState([blank()]);
  const [notes, setNotes] = useState('');

  useEffect(() => { if (isOpen) { setCustomer(null); setItems([blank()]); setNotes(''); } }, [isOpen]);

  const total = useMemo(() => items.reduce((a, l) => a + lineCalc(l).value, 0), [items]);
  const setLine = (i, f, v) => setItems((p) => p.map((l, idx) => (idx === i ? { ...l, [f]: v } : l)));

  const submit = async () => {
    if (!customer) return toast.error('Select a customer');
    for (const l of items) {
      if (!l.itemDescription) return toast.error('Describe every item (e.g. old chain, broken ring)');
      if (!(num(l.grossWeight) > 0)) return toast.error('Enter gross weight for every item');
      if (num(l.stoneWeight) > num(l.grossWeight)) return toast.error('Stone weight cannot exceed gross weight');
      if (!(num(l.purityTestedPercent) > 0) || num(l.purityTestedPercent) > 100) return toast.error('Enter a valid tested purity %');
      if (!(num(l.goldRateApplied) > 0)) return toast.error('Enter the rate applied for every item');
    }
    try {
      const res = await create({
        customerId: customer._id,
        items: items.map((l) => ({
          itemDescription: l.itemDescription, metal: l.metal, purityDeclared: l.purityDeclared, testingMethod: l.testingMethod,
          purityTestedPercent: num(l.purityTestedPercent), grossWeight: num(l.grossWeight), stoneWeight: num(l.stoneWeight),
          meltingLossPercent: num(l.meltingLossPercent), goldRateApplied: num(l.goldRateApplied)
        })),
        notes: notes || undefined
      }).unwrap();
      toast.success(`${res.data.exchangeNo}: ${formatCurrency(res.data.totalExchangeValue)} credited to ${customer.name}'s account`);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to record exchange'));
    }
  };

  const cell = 'rounded border border-surface-300 p-1 text-xs text-right';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Old Gold Intake" subtitle="Value is credited to the customer's ledger and can be adjusted against a bill later" maxWidth="max-w-5xl">
      <div className="space-y-4 text-xs">
        <div>
          <label className="text-[11px] font-bold uppercase text-surface-600 block mb-1">Customer *</label>
          <CustomerPicker value={customer} onChange={setCustomer} onCreateNew={() => setCustomerModalOpen(true)} />
        </div>

        <div className="flex justify-between items-center">
          <span className="font-bold uppercase tracking-wider text-surface-600">Old gold items</span>
          <Button size="sm" variant="outline" icon={Plus} onClick={() => setItems([...items, blank()])}>Add item</Button>
        </div>
        <div className="overflow-x-auto border border-surface-200 rounded-xl">
          <table className="w-full text-left">
            <thead className="bg-surface-50 text-[10px] font-bold uppercase text-surface-600 border-b border-surface-200">
              <tr><th className="p-2">Description *</th><th className="p-2">Metal</th><th className="p-2 text-right">Gross g</th><th className="p-2 text-right">Stone g</th><th className="p-2 text-right">Tested %</th><th className="p-2 text-right">Melt loss %</th><th className="p-2 text-right">Rate ₹/g</th><th className="p-2 text-right">Pure wt</th><th className="p-2 text-right">Value</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-surface-100 bg-white">
              {items.map((l, i) => {
                const c = lineCalc(l);
                return (
                  <tr key={i}>
                    <td className="p-2"><input value={l.itemDescription} onChange={(e) => setLine(i, 'itemDescription', e.target.value)} placeholder="Old chain / broken ring" className="w-32 rounded border border-surface-300 p-1" /></td>
                    <td className="p-2"><select value={l.metal} onChange={(e) => setLine(i, 'metal', e.target.value)} className="rounded border border-surface-300 p-1">{METALS.map((m) => <option key={m}>{m}</option>)}</select></td>
                    <td className="p-2"><input type="number" step="0.001" value={l.grossWeight} onChange={(e) => setLine(i, 'grossWeight', e.target.value)} className={`w-16 ${cell}`} /></td>
                    <td className="p-2"><input type="number" step="0.001" value={l.stoneWeight} onChange={(e) => setLine(i, 'stoneWeight', e.target.value)} className={`w-14 ${cell}`} /></td>
                    <td className="p-2"><input type="number" step="0.1" value={l.purityTestedPercent} onChange={(e) => setLine(i, 'purityTestedPercent', e.target.value)} className={`w-16 ${cell}`} /></td>
                    <td className="p-2"><input type="number" step="0.1" value={l.meltingLossPercent} onChange={(e) => setLine(i, 'meltingLossPercent', e.target.value)} className={`w-16 ${cell}`} /></td>
                    <td className="p-2"><input type="number" value={l.goldRateApplied} onChange={(e) => setLine(i, 'goldRateApplied', e.target.value)} className={`w-20 ${cell}`} /></td>
                    <td className="p-2 text-right font-semibold">{formatWeight(c.pure)}</td>
                    <td className="p-2 text-right font-bold">{formatCurrency(c.value)}</td>
                    <td className="p-2"><button type="button" disabled={items.length === 1} onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="text-surface-400 hover:text-red-600 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="flex justify-between items-center p-3 bg-gold-50/70 rounded-xl border border-gold-200">
          <span className="text-surface-600">Total credit to customer</span>
          <span className="text-lg font-black font-display">{formatCurrency(total)}</span>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={Coins} isLoading={isLoading} onClick={submit}>Record Intake</Button>
        </div>
      </div>
      <CustomerSelectModal isOpen={customerModalOpen} onClose={() => setCustomerModalOpen(false)} onCustomerCreated={setCustomer} />
    </Modal>
  );
};
