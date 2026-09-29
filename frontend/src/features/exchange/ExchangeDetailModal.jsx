import React, { useState } from 'react';
import { Coins } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { useGetExchangeByIdQuery, usePayoutExchangeMutation } from '../../app/api/baseApi';
import { PAYMENT_MODES } from '../../utils/constants';
import { formatCurrency, formatWeight, formatDate } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errors';
import { toast } from 'sonner';

export const ExchangeDetailModal = ({ exchangeId, onClose }) => {
  const { data, isLoading } = useGetExchangeByIdQuery(exchangeId, { skip: !exchangeId });
  const [payout, { isLoading: paying }] = usePayoutExchangeMutation();
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('CASH');
  const [showPayout, setShowPayout] = useState(false);

  const ex = data?.data;
  const unused = ex ? Math.max(0, (ex.totalExchangeValue || 0) - (ex.adjustedAmount || 0) - (ex.paidOutAmount || 0)) : 0;

  const submitPayout = async () => {
    const amt = parseFloat(amount) || unused;
    if (!(amt > 0) || amt > unused + 0.005) return toast.error(`Enter an amount up to ${formatCurrency(unused)}`);
    try {
      await payout({ id: ex._id, amount: amt, paymentMode: mode }).unwrap();
      toast.success('Payout recorded');
      setShowPayout(false);
      setAmount('');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal isOpen={Boolean(exchangeId)} onClose={onClose} title={ex ? ex.exchangeNo : 'Old Gold Exchange'} subtitle={ex ? `${ex.customerId?.name} · ${formatDate(ex.exchangeDate)}` : ''} maxWidth="max-w-3xl">
      {isLoading || !ex ? <Skeleton className="h-56 w-full" /> : (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['Net weight', formatWeight(ex.totalNetWeight)],
              ['Total value', formatCurrency(ex.totalExchangeValue)],
              ['Adjusted on bills', formatCurrency(ex.adjustedAmount || 0)],
              ['Paid out', formatCurrency(ex.paidOutAmount || 0)]
            ].map(([l, v]) => (
              <div key={l} className="p-2.5 rounded-xl bg-surface-50 border border-surface-200">
                <p className="text-[10px] uppercase font-bold text-surface-500">{l}</p>
                <p className="font-black font-display text-sm mt-0.5">{v}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto border border-surface-200 rounded-xl">
            <table className="w-full text-left">
              <thead className="bg-surface-50 text-[10px] uppercase font-bold text-surface-600 border-b border-surface-200">
                <tr><th className="p-2">Item</th><th className="p-2">Purity tested</th><th className="p-2 text-right">Gross</th><th className="p-2 text-right">Net</th><th className="p-2 text-right">Pure wt</th><th className="p-2 text-right">Value</th></tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {ex.items.map((i, idx) => (
                  <tr key={idx}>
                    <td className="p-2 font-semibold">{i.itemDescription}</td>
                    <td className="p-2">{i.purityTestedPercent}% ({i.testingMethod})</td>
                    <td className="p-2 text-right">{formatWeight(i.grossWeight)}</td>
                    <td className="p-2 text-right">{formatWeight(i.netWeight)}</td>
                    <td className="p-2 text-right font-semibold">{formatWeight(i.pureWeight)}</td>
                    <td className="p-2 text-right font-bold">{formatCurrency(i.exchangeValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ex.adjustments?.length > 0 && (
            <div className="p-3 rounded-xl bg-surface-50 border border-surface-200">
              <p className="font-bold text-surface-800 mb-1">Used against bills</p>
              {ex.adjustments.map((a, idx) => (
                <div key={idx} className="flex justify-between text-surface-600"><span>{formatDate(a.at)}</span><span className="font-bold">{formatCurrency(a.amount)}</span></div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-surface-100">
            <Badge variant={ex.status === 'CANCELLED' ? 'danger' : unused > 0 ? 'warning' : 'success'}>{ex.status.replace(/_/g, ' ')}</Badge>
            {unused > 0 && ex.status !== 'CANCELLED' && !showPayout && (
              <Button size="sm" variant="goldSoft" icon={Coins} onClick={() => { setAmount(String(unused)); setShowPayout(true); }}>Pay out unused {formatCurrency(unused)}</Button>
            )}
          </div>

          {showPayout && (
            <div className="p-3 rounded-xl bg-gold-50/70 border border-gold-200 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Amount ₹" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <div><label className="text-[11px] font-bold uppercase text-surface-600">Mode</label>
                  <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-300 p-2 bg-white font-semibold">{PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowPayout(false)}>Cancel</Button>
                <Button size="sm" variant="primary" isLoading={paying} onClick={submitPayout}>Confirm Payout</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
