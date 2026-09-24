import React, { useState } from 'react';
import { Coins, CheckCircle, RefreshCw } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useGetCurrentGoldRatesQuery, useSetGoldRateMutation } from '../../app/api/baseApi';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { toast } from 'sonner';

export const GoldRateModal = ({ isOpen, onClose }) => {
  const { data, isLoading } = useGetCurrentGoldRatesQuery();
  const [setGoldRate, { isLoading: isUpdating }] = useSetGoldRateMutation();

  const [metal, setMetal] = useState('GOLD');
  const [purity, setPurity] = useState('22K');
  const [rate, setRate] = useState('');

  const rates = data?.data || [];

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!rate || parseFloat(rate) <= 0) {
      toast.error('Please enter a valid positive rate');
      return;
    }

    try {
      await setGoldRate({
        metal,
        purity,
        rate: parseFloat(rate)
      }).unwrap();
      toast.success(`${purity} ${metal} rate updated to ${formatCurrency(rate)}/g`);
      setRate('');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update gold rate');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Daily Bullion & Metal Rates"
      subtitle="Live daily rate board used automatically across POS billing calculations"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Current Rates Board */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-500 mb-3">
            Active Store Rates (Per Gram)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {rates.map((r) => (
              <div
                key={r._id || `${r.metal}-${r.purity}`}
                className="p-3 rounded-xl border border-gold-200/80 bg-gold-50/40 text-center"
              >
                <span className="text-[10px] font-bold text-gold-800 uppercase tracking-wider">
                  {r.metal} · {r.purity}
                </span>
                <p className="text-lg font-extrabold text-surface-900 mt-1 font-display">
                  {formatCurrency(r.rate)}
                </p>
                <span className="text-[10px] text-surface-400 mt-0.5 block truncate">
                  {formatDateTime(r.effectiveDate || r.createdAt)}
                </span>
              </div>
            ))}
            {rates.length === 0 && !isLoading && (
              <div className="col-span-4 text-center py-4 text-xs text-surface-400">
                No active rates configured. Update below.
              </div>
            )}
          </div>
        </div>

        {/* Update Rate Form */}
        <div className="pt-4 border-t border-surface-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-700 mb-3 flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-gold-600" /> Update / Add Market Rate
          </h4>
          <form onSubmit={handleUpdate} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs font-semibold text-surface-600 uppercase">Metal</label>
              <select
                value={metal}
                onChange={(e) => setMetal(e.target.value)}
                className="mt-1 w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900"
              >
                <option value="GOLD">GOLD</option>
                <option value="SILVER">SILVER</option>
                <option value="PLATINUM">PLATINUM</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-surface-600 uppercase">Purity</label>
              <select
                value={purity}
                onChange={(e) => setPurity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900"
              >
                {metal === 'GOLD' && (
                  <>
                    <option value="24K">24K (999)</option>
                    <option value="22K">22K (916)</option>
                    <option value="20K">20K</option>
                    <option value="18K">18K (750)</option>
                    <option value="14K">14K</option>
                  </>
                )}
                {metal === 'SILVER' && (
                  <>
                    <option value="999">Silver 999</option>
                    <option value="925">Silver 925</option>
                  </>
                )}
                {metal === 'PLATINUM' && <option value="950">Platinum 950</option>}
              </select>
            </div>

            <div>
              <Input
                label="New Rate (₹/g)"
                type="number"
                step="any"
                placeholder="e.g. 7850"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                required
              />
            </div>

            <div>
              <Button type="submit" variant="primary" isLoading={isUpdating} className="w-full">
                Apply Rate
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
};
