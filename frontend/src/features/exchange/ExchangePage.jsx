import React, { useState } from 'react';
import { RefreshCw, Coins, Search, CheckCircle, Plus, Trash2, ArrowRight } from 'lucide-react';
import {
  useGetExchangesQuery,
  useCreateExchangeMutation,
  useGetCustomersQuery,
  useGetCurrentGoldRatesQuery
} from '../../app/api/baseApi';
import { Table, TableRow, TableCell } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { formatCurrency, formatWeight, formatDateTime } from '../../utils/formatters';
import { toast } from 'sonner';

export const ExchangePage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: exchangeData, isLoading } = useGetExchangesQuery();
  const { data: custData } = useGetCustomersQuery();
  const { data: goldRatesData } = useGetCurrentGoldRatesQuery();
  const [createExchange, { isLoading: isCreating }] = useCreateExchangeMutation();

  const exchanges = exchangeData?.data || [];
  const customers = custData?.data || [];
  const goldRates = goldRatesData?.data || [];
  const rate24K = goldRates.find((r) => r.metal === 'GOLD' && r.purity === '24K')?.rate || 7850;

  // Form State
  const [customerId, setCustomerId] = useState('');
  const [itemDescription, setItemDescription] = useState('Old Gold Chain & Pendant');
  const [metal, setMetal] = useState('GOLD');
  const [purityDeclared, setPurityDeclared] = useState('22K');
  const [testingMethod, setTestingMethod] = useState('TOUCHSTONE');
  const [purityTestedPercent, setPurityTestedPercent] = useState('91.6');
  const [grossWeight, setGrossWeight] = useState('15.5');
  const [stoneWeight, setStoneWeight] = useState('0.5');
  const [meltingLossPercent, setMeltingLossPercent] = useState('2.0');
  const [goldRateApplied, setGoldRateApplied] = useState(rate24K.toString());
  const [notes, setNotes] = useState('Customer counter exchange for new billing');

  // Real-time pure valuation preview
  const netWeight = Math.max(0, (parseFloat(grossWeight) || 0) - (parseFloat(stoneWeight) || 0));
  const purityFactor = (parseFloat(purityTestedPercent) || 0) / 100;
  const meltingLossFactor = 1 - (parseFloat(meltingLossPercent) || 0) / 100;
  const pureGoldWeight = netWeight * purityFactor * meltingLossFactor;
  const exchangeValuation = pureGoldWeight * (parseFloat(goldRateApplied) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const activeCustomerId = customerId || customers[0]?._id;
    if (!activeCustomerId) {
      toast.error('Please select customer');
      return;
    }

    try {
      const payload = {
        customerId: activeCustomerId,
        items: [
          {
            itemDescription,
            metal,
            purityDeclared,
            testingMethod,
            purityTestedPercent: parseFloat(purityTestedPercent),
            grossWeight: parseFloat(grossWeight),
            stoneWeight: parseFloat(stoneWeight) || 0,
            meltingLossPercent: parseFloat(meltingLossPercent) || 0,
            goldRateApplied: parseFloat(goldRateApplied)
          }
        ],
        notes
      };

      const res = await createExchange(payload).unwrap();
      toast.success(`Old gold intake recorded: ${formatCurrency(exchangeValuation)}!`);
      setModalOpen(false);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to record old gold exchange');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-display">Old Gold & Exchange Counter</h1>
          <p className="text-xs text-surface-500 mt-1">
            Valuation testing, melting loss deductions, and customer exchange settlements
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={RefreshCw}
          onClick={() => setModalOpen(true)}
          className="font-bold shadow-sm"
        >
          New Old Gold Intake
        </Button>
      </div>

      {/* Interactive Flow Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-gold-50 via-amber-50 to-gold-50 border border-gold-200 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-gold-950">
          <span className="flex items-center gap-1.5">1. Customer Old Gold</span>
          <ArrowRight className="w-3.5 h-3.5 text-gold-500" />
          <span className="flex items-center gap-1.5">2. Gross / Stone Weight</span>
          <ArrowRight className="w-3.5 h-3.5 text-gold-500" />
          <span className="flex items-center gap-1.5">3. Touchstone / XRF Purity</span>
          <ArrowRight className="w-3.5 h-3.5 text-gold-500" />
          <span className="flex items-center gap-1.5">4. Melting Loss Deduction</span>
          <ArrowRight className="w-3.5 h-3.5 text-gold-500" />
          <span className="flex items-center gap-1.5">5. Net 24K Valuation Credit</span>
        </div>
      </div>

      {/* Past Exchange Intake Records */}
      <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-surface-900 font-display">Exchange Intake History</h3>

        {isLoading ? (
          <TableSkeleton rows={5} cols={7} />
        ) : exchanges.length === 0 ? (
          <div className="text-center py-12 text-xs text-surface-400">
            No customer old gold exchange vouchers recorded yet.
          </div>
        ) : (
          <Table
            headers={[
              'Exchange Voucher',
              'Customer',
              'Date',
              'Items Intake',
              { label: 'Net Weight', align: 'right' },
              { label: 'Exchange Value', align: 'right' },
              { label: 'Status', align: 'center' }
            ]}
          >
            {exchanges.map((ex) => (
              <TableRow key={ex._id}>
                <TableCell className="font-mono font-bold text-surface-900">
                  {ex.exchangeNo || ex._id.slice(-6).toUpperCase()}
                </TableCell>
                <TableCell className="font-semibold text-surface-800">
                  {ex.customerId?.name || 'Walk-in Customer'}
                </TableCell>
                <TableCell className="text-surface-500">
                  {formatDateTime(ex.exchangeDate || ex.createdAt)}
                </TableCell>
                <TableCell className="text-surface-700">
                  {ex.items?.map((i) => i.itemDescription).join(', ') || 'Gold Jewellery'}
                </TableCell>
                <TableCell align="right" className="font-bold text-surface-800">
                  {formatWeight(
                    ex.items?.reduce((acc, i) => acc + (i.grossWeight - i.stoneWeight), 0) || 0
                  )}
                </TableCell>
                <TableCell align="right" className="font-black text-gold-900 font-display">
                  {formatCurrency(ex.totalExchangeValue || ex.exchangeValue || 0)}
                </TableCell>
                <TableCell align="center">
                  <Badge variant="success" size="sm">
                    {ex.status || 'SETTLED'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </div>

      {/* Old Gold Valuation Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Customer Old Gold Intake & Purity Assay"
        subtitle="Automated pure gold calculation and credit settlement"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-[11px] font-bold uppercase text-surface-600">Select Customer *</label>
            <select
              value={customerId || (customers[0]?._id || '')}
              onChange={(e) => setCustomerId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-surface-300 p-2 font-semibold bg-white"
              required
            >
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} (📞 {c.mobile})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Jewellery Description *"
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              placeholder="e.g. 22K Old Traditional Bangle"
              required
            />

            <div>
              <label className="text-[11px] font-bold uppercase text-surface-600">Testing Method</label>
              <select
                value={testingMethod}
                onChange={(e) => setTestingMethod(e.target.value)}
                className="mt-1 w-full rounded-lg border border-surface-300 p-2 font-semibold bg-white"
              >
                <option value="TOUCHSTONE">Touchstone & Nitric Acid</option>
                <option value="XRF_SPECTROMETER">XRF Gold Spectrometer (99.9% accurate)</option>
                <option value="ACID">Chemical Acid Test</option>
                <option value="DENSITY">Hydrostatic Density Meter</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input
              label="Gross Wt (g) *"
              type="number"
              step="0.001"
              value={grossWeight}
              onChange={(e) => setGrossWeight(e.target.value)}
              required
            />
            <Input
              label="Stone / Wax Wt (g)"
              type="number"
              step="0.001"
              value={stoneWeight}
              onChange={(e) => setStoneWeight(e.target.value)}
            />
            <Input
              label="Tested Purity % *"
              type="number"
              step="0.1"
              value={purityTestedPercent}
              onChange={(e) => setPurityTestedPercent(e.target.value)}
              required
            />
            <Input
              label="Melting Loss %"
              type="number"
              step="0.1"
              value={meltingLossPercent}
              onChange={(e) => setMeltingLossPercent(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Gold Rate Applied (₹/g - 24K Basis)"
              type="number"
              value={goldRateApplied}
              onChange={(e) => setGoldRateApplied(e.target.value)}
              required
            />
            <Input
              label="Remarks / Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Prominent Real-time Valuation Display */}
          <div className="p-4 rounded-xl bg-gold-50/80 border border-gold-300 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-gold-800 uppercase tracking-wider block">
                Calculated Pure Gold Content
              </span>
              <p className="text-sm font-bold text-surface-900 mt-0.5">
                {formatWeight(pureGoldWeight)} pure 24K equivalent
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-gold-800 uppercase tracking-wider block">
                Final Exchange Credit Value
              </span>
              <p className="text-2xl font-black text-surface-900 font-display">
                {formatCurrency(exchangeValuation)}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isCreating} icon={CheckCircle}>
              Accept Intake & Credit Voucher
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
