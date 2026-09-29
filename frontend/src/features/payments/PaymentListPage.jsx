import React, { useState } from 'react';
import { Plus, Search, Undo2 } from 'lucide-react';
import { useGetPaymentsQuery } from '../../app/api/baseApi';
import { Table, TableRow, TableCell } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import { RecordPaymentModal } from './RecordPaymentModal';
import { ReversePaymentModal } from './ReversePaymentModal';
import { useDebounce } from '../../utils/useDebounce';
import { formatCurrency, formatDate } from '../../utils/formatters';

const DIR_LABEL = { IN: 'Received', OUT: 'Paid out' };
const REF_LABEL = { INVOICE: 'Sale', PURCHASE: 'Purchase', ORDER: 'Order', EXCHANGE: 'Old gold', ADVANCE: 'Advance', DIRECT: 'Direct' };

export const PaymentListPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [direction, setDirection] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const [recordOpen, setRecordOpen] = useState(false);
  const [reverseTarget, setReverseTarget] = useState(null);
  const search = useDebounce(searchTerm, 350);

  const { data, isLoading } = useGetPaymentsQuery({ search: search || undefined, direction: direction || undefined, entityType: entityType || undefined, page, limit: 25 });
  const payments = data?.data || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-display">Payments Ledger</h1>
          <p className="text-xs text-surface-500 mt-1">Every receipt, vendor payment and refund — old-gold adjustments are tracked separately</p>
        </div>
        <Button variant="primary" icon={Plus} className="font-bold" onClick={() => setRecordOpen(true)}>Record Payment</Button>
      </div>

      <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 max-w-md"><Input placeholder="Search by payment no..." icon={Search} value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} /></div>
          <select value={direction} onChange={(e) => { setDirection(e.target.value); setPage(1); }} className="rounded-lg border border-surface-300 p-2 text-xs font-semibold bg-white">
            <option value="">All directions</option><option value="IN">Received (IN)</option><option value="OUT">Paid out (OUT)</option>
          </select>
          <select value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} className="rounded-lg border border-surface-300 p-2 text-xs font-semibold bg-white">
            <option value="">Customer + Vendor</option><option value="CUSTOMER">Customer</option><option value="VENDOR">Vendor</option>
          </select>
        </div>

        {isLoading ? <TableSkeleton rows={6} cols={8} /> : payments.length === 0 ? (
          <EmptyState title="No Payments" description="Record a payment to get started." actionLabel="Record Payment" onAction={() => setRecordOpen(true)} />
        ) : (
          <>
            <Table headers={['Payment No', 'Date', 'Party', 'Against', { label: 'Direction', align: 'center' }, 'Mode', { label: 'Amount', align: 'right' }, { label: 'Status', align: 'center' }, { label: '', align: 'right' }]}>
              {payments.map((p) => (
                <TableRow key={p._id} className={p.status === 'REVERSED' ? 'opacity-50' : ''}>
                  <TableCell className="font-mono font-bold text-surface-900">{p.paymentNo}</TableCell>
                  <TableCell className="text-surface-500">{formatDate(p.paymentDate)}</TableCell>
                  <TableCell><span className="font-semibold">{p.partyName || '-'}</span><span className="block text-[10px] text-surface-400">{p.entityType}</span></TableCell>
                  <TableCell className="text-surface-500">{REF_LABEL[p.referenceType] || p.referenceType}{p.linkedDocType ? ` · ${p.linkedDocType.replace(/_/g, ' ')}` : ''}</TableCell>
                  <TableCell align="center"><Badge variant={p.direction === 'IN' ? 'success' : 'warning'} size="sm">{DIR_LABEL[p.direction]}</Badge></TableCell>
                  <TableCell className="font-semibold">{p.paymentMode === 'EXCHANGE' ? 'Old gold' : p.paymentMode}</TableCell>
                  <TableCell align="right" className="font-bold text-surface-900">{formatCurrency(p.amount)}</TableCell>
                  <TableCell align="center"><Badge variant={p.status === 'SUCCESS' ? 'success' : p.status === 'REVERSED' ? 'danger' : 'default'} size="sm">{p.status}</Badge></TableCell>
                  <TableCell align="right">
                    {p.status === 'SUCCESS' && p.paymentMode !== 'EXCHANGE' && (
                      <button type="button" title="Reverse this payment" onClick={() => setReverseTarget(p)} className="p-1.5 rounded-lg text-surface-400 hover:text-red-600 hover:bg-red-50"><Undo2 className="w-4 h-4" /></button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </Table>
            <Pagination pagination={data?.pagination} onPage={setPage} />
          </>
        )}
      </div>

      <RecordPaymentModal isOpen={recordOpen} onClose={() => setRecordOpen(false)} />
      <ReversePaymentModal isOpen={Boolean(reverseTarget)} onClose={() => setReverseTarget(null)} payment={reverseTarget} />
    </div>
  );
};
