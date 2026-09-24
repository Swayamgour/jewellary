import React, { useState } from 'react';
import { Coins, Plus, History, ArrowUpRight } from 'lucide-react';
import {
  useGetCurrentGoldRatesQuery,
  useGetGoldRateHistoryQuery
} from '../../app/api/baseApi';
import { Table, TableRow, TableCell } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { GoldRateModal } from './GoldRateModal';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

export const GoldRatesPage = () => {
  const [modalOpen, setModalOpen] = useState(false);

  const { data: currentRatesData, isLoading: currentLoading } = useGetCurrentGoldRatesQuery();
  const { data: historyData, isLoading: historyLoading } = useGetGoldRateHistoryQuery();

  const currentRates = currentRatesData?.data || [];
  const historyRates = historyData?.data || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-display">Daily Bullion & Metal Rates</h1>
          <p className="text-xs text-surface-500 mt-1">
            Store market rates for 24K, 22K, 18K, 14K Gold, Silver 999 and Platinum per gram
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={Plus}
          onClick={() => setModalOpen(true)}
          className="font-bold shadow-sm"
        >
          Update Today's Rates
        </Button>
      </div>

      {/* Current Active Rate Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {currentRates.map((r) => (
          <div
            key={r._id || `${r.metal}-${r.purity}`}
            className="p-5 rounded-2xl bg-white border border-gold-200 shadow-sm relative overflow-hidden group"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-gold-800">
                  {r.metal} · {r.purity}
                </span>
                <h3 className="text-3xl font-black text-surface-900 mt-2 font-display">
                  {formatCurrency(r.rate)}
                  <span className="text-xs font-normal text-surface-500 ml-1">/ gram</span>
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-gold-50 text-gold-600 border border-gold-200">
                <Coins className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-surface-100 flex justify-between items-center text-[11px] text-surface-500">
              <span>Effective: {formatDateTime(r.effectiveDate || r.createdAt)}</span>
              <Badge variant="success" size="sm">ACTIVE</Badge>
            </div>
          </div>
        ))}
      </div>

      {/* Historical Audit Trail */}
      <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-surface-900 font-display flex items-center gap-1.5">
            <History className="w-4 h-4 text-surface-500" /> Historical Bullion Rate Log
          </h3>
          <span className="text-xs text-surface-400">Locked historical rates preserve past invoice values</span>
        </div>

        {historyLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : historyRates.length === 0 ? (
          <div className="text-center py-12 text-xs text-surface-400">
            No historical rate logs recorded.
          </div>
        ) : (
          <Table
            headers={[
              'Metal',
              'Purity',
              { label: 'Rate (Per Gram)', align: 'right' },
              'Effective Date',
              'Branch Scoped',
              { label: 'Status', align: 'center' }
            ]}
          >
            {historyRates.map((h) => (
              <TableRow key={h._id}>
                <TableCell className="font-bold text-surface-900">{h.metal}</TableCell>
                <TableCell className="font-bold text-gold-800">{h.purity}</TableCell>
                <TableCell align="right" className="font-extrabold text-surface-900 font-display">
                  {formatCurrency(h.rate)}
                </TableCell>
                <TableCell className="text-surface-500">
                  {formatDateTime(h.effectiveDate || h.createdAt)}
                </TableCell>
                <TableCell className="text-surface-600">
                  {h.branchId?.name || 'All Branches'}
                </TableCell>
                <TableCell align="center">
                  <Badge variant={h.isCurrent ? 'success' : 'default'} size="sm">
                    {h.isCurrent ? 'CURRENT' : 'HISTORICAL'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </div>

      <GoldRateModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
};
