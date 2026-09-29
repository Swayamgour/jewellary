import React, { useState } from 'react';
import { Coins, Plus, Search, Eye } from 'lucide-react';
import { useGetExchangesQuery } from '../../app/api/baseApi';
import { Table, TableRow, TableCell } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import { NewExchangeModal } from './NewExchangeModal';
import { ExchangeDetailModal } from './ExchangeDetailModal';
import { useDebounce } from '../../utils/useDebounce';
import { formatCurrency, formatWeight, formatDate } from '../../utils/formatters';

const STATUS_VARIANT = { PENDING_ADJUSTMENT: 'warning', PARTIALLY_ADJUSTED: 'info', ADJUSTED_IN_BILL: 'success', PAID_OUT: 'success', CANCELLED: 'danger' };

export const ExchangePage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [newOpen, setNewOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const search = useDebounce(searchTerm, 350);

  const { data, isLoading } = useGetExchangesQuery({ page, limit: 20, status: status || undefined });
  let rows = data?.data || [];
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter((r) => r.exchangeNo?.toLowerCase().includes(s) || r.customerId?.name?.toLowerCase().includes(s));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-display">Old Gold Exchange</h1>
          <p className="text-xs text-surface-500 mt-1">Intake, adjustment against bills, and payouts of unused value</p>
        </div>
        <Button variant="primary" icon={Plus} className="font-bold" onClick={() => setNewOpen(true)}>New Old Gold Intake</Button>
      </div>

      <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 max-w-md"><Input placeholder="Search by exchange no or customer..." icon={Search} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border border-surface-300 p-2 text-xs font-semibold bg-white">
            <option value="">All statuses</option>
            <option value="PENDING_ADJUSTMENT">Pending adjustment</option>
            <option value="PARTIALLY_ADJUSTED">Partially adjusted</option>
            <option value="ADJUSTED_IN_BILL">Fully adjusted</option>
            <option value="PAID_OUT">Paid out</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {isLoading ? <TableSkeleton rows={6} cols={8} /> : rows.length === 0 ? (
          <EmptyState icon={Coins} title="No Exchange Records" description="Record when a customer brings in old gold." actionLabel="New Intake" onAction={() => setNewOpen(true)} />
        ) : (
          <>
            <Table headers={['Exchange No', 'Date', 'Customer', { label: 'Net Wt', align: 'right' }, { label: 'Value', align: 'right' }, { label: 'Adjusted', align: 'right' }, { label: 'Unused', align: 'right' }, { label: 'Status', align: 'center' }, { label: '', align: 'right' }]}>
              {rows.map((ex) => {
                const unused = Math.max(0, (ex.totalExchangeValue || 0) - (ex.adjustedAmount || 0) - (ex.paidOutAmount || 0));
                return (
                  <TableRow key={ex._id} onClick={() => setDetailId(ex._id)}>
                    <TableCell className="font-mono font-bold text-surface-900">{ex.exchangeNo}</TableCell>
                    <TableCell className="text-surface-500">{formatDate(ex.exchangeDate)}</TableCell>
                    <TableCell className="font-semibold">{ex.customerId?.name}</TableCell>
                    <TableCell align="right">{formatWeight(ex.totalNetWeight)}</TableCell>
                    <TableCell align="right" className="font-bold">{formatCurrency(ex.totalExchangeValue)}</TableCell>
                    <TableCell align="right" className="text-emerald-700">{formatCurrency((ex.adjustedAmount || 0) + (ex.paidOutAmount || 0))}</TableCell>
                    <TableCell align="right" className={unused > 0 ? 'text-amber-600 font-bold' : 'text-surface-400'}>{formatCurrency(unused)}</TableCell>
                    <TableCell align="center"><Badge variant={STATUS_VARIANT[ex.status]} size="sm">{ex.status.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell align="right"><Eye className="w-4 h-4 text-surface-400 inline" /></TableCell>
                  </TableRow>
                );
              })}
            </Table>
            <Pagination pagination={data?.pagination} onPage={setPage} />
          </>
        )}
      </div>

      <NewExchangeModal isOpen={newOpen} onClose={() => setNewOpen(false)} />
      <ExchangeDetailModal exchangeId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
};
