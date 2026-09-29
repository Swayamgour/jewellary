import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, Eye, RotateCcw } from 'lucide-react';
import { useGetSalesQuery, useGetSalesReturnsQuery } from '../../app/api/baseApi';
import { Table, TableRow, TableCell } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { EmptyState } from '../../components/ui/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import { SalesReturnModal } from '../billing/SalesReturnModal';
import { useDebounce } from '../../utils/useDebounce';
import { paymentStatusVariant } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const SalesListPage = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('SALES');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [returnFor, setReturnFor] = useState(null);
  const search = useDebounce(searchTerm, 350);

  const { data: salesData, isLoading } = useGetSalesQuery({ search: search || undefined, page, limit: 20 }, { skip: tab !== 'SALES' });
  const { data: retData, isLoading: retLoading } = useGetSalesReturnsQuery({ page, limit: 20 }, { skip: tab !== 'RETURNS' });
  const sales = salesData?.data || [];
  const returns = retData?.data || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-display">Sales Register</h1>
          <p className="text-xs text-surface-500 mt-1">Live sales (a Kacha bill that was converted is counted once, as the Pakka invoice) and sales returns</p>
        </div>
        <Button variant="primary" icon={ShoppingCart} onClick={() => navigate('/billing/new')} className="font-bold shadow-sm">New Sale / Bill</Button>
      </div>

      <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-xs space-y-4">
        <Tabs tabs={[{ id: 'SALES', label: 'Sales' }, { id: 'RETURNS', label: 'Sales Returns' }]} activeTab={tab} onChange={(t) => { setTab(t); setPage(1); }} />

        {tab === 'SALES' ? (
          <>
            <div className="max-w-md">
              <Input placeholder="Search by invoice number, customer or mobile..." icon={Search} value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} />
            </div>
            {isLoading ? (
              <TableSkeleton rows={6} cols={8} />
            ) : sales.length === 0 ? (
              <EmptyState title="No Sales Found" description="Confirmed bills appear here." actionLabel="Go to Billing" onAction={() => navigate('/billing/new')} />
            ) : (
              <>
                <Table headers={['Invoice No', 'Customer', 'Type', 'Date', { label: 'Total', align: 'right' }, { label: 'Returned', align: 'right' }, { label: 'Paid', align: 'right' }, { label: 'Due', align: 'right' }, { label: 'Payment', align: 'center' }, { label: 'Actions', align: 'right' }]}>
                  {sales.map((sale) => {
                    const canReturn = sale.items?.some((i) => (i.quantity || 0) > (i.returnedQty || 0));
                    return (
                      <TableRow key={sale._id}>
                        <TableCell className="font-mono font-bold text-surface-900">{sale.invoiceNo}</TableCell>
                        <TableCell className="font-semibold text-surface-800">{sale.customerSnapshot?.name || 'Customer'}</TableCell>
                        <TableCell><Badge variant={sale.billType === 'KACHA' ? 'kacha' : 'pakka'}>{sale.billType}</Badge></TableCell>
                        <TableCell className="text-surface-500">{formatDate(sale.invoiceDate || sale.createdAt)}</TableCell>
                        <TableCell align="right" className="font-bold text-surface-900">{formatCurrency(sale.grandTotal)}</TableCell>
                        <TableCell align="right" className={sale.returnedAmount > 0 ? 'text-sky-700 font-semibold' : 'text-surface-400'}>{formatCurrency(sale.returnedAmount || 0)}</TableCell>
                        <TableCell align="right" className="text-emerald-700 font-semibold">{formatCurrency(sale.paymentSummary?.paid || 0)}</TableCell>
                        <TableCell align="right" className={(sale.paymentSummary?.due || 0) > 0 ? 'text-amber-600 font-bold' : 'text-surface-400'}>{formatCurrency(sale.paymentSummary?.due || 0)}</TableCell>
                        <TableCell align="center"><Badge variant={paymentStatusVariant(sale.paymentStatus)} size="sm">{sale.paymentStatus}</Badge></TableCell>
                        <TableCell align="right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button type="button" title="View invoice" onClick={() => navigate(`/billing/${sale._id}`)} className="p-1.5 rounded-lg text-surface-500 hover:text-surface-900 hover:bg-surface-100"><Eye className="w-4 h-4" /></button>
                            {canReturn && (
                              <button type="button" title="Sales return" onClick={() => setReturnFor(sale)} className="p-1.5 rounded-lg text-surface-500 hover:text-amber-600 hover:bg-amber-50"><RotateCcw className="w-4 h-4" /></button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </Table>
                <Pagination pagination={salesData?.pagination} onPage={setPage} />
              </>
            )}
          </>
        ) : retLoading ? (
          <TableSkeleton rows={5} cols={7} />
        ) : returns.length === 0 ? (
          <EmptyState icon={RotateCcw} title="No Sales Returns" description="Returns you record against bills show up here." />
        ) : (
          <>
            <Table headers={['Return No', 'Date', 'Invoice', 'Items', { label: 'Credit note', align: 'right' }, { label: 'Cash refunded', align: 'right' }, { label: 'Kept as credit', align: 'right' }, 'Reason']}>
              {returns.map((r) => (
                <TableRow key={r._id} onClick={() => navigate(`/billing/${r.invoiceId}`)}>
                  <TableCell className="font-mono font-bold text-surface-900">{r.returnNo}</TableCell>
                  <TableCell className="text-surface-500">{formatDate(r.returnDate)}</TableCell>
                  <TableCell className="font-mono">{r.invoiceNo}</TableCell>
                  <TableCell className="text-surface-700 max-w-[220px] truncate">{r.items?.map((i) => `${i.productName} ×${i.quantity}`).join(', ')}</TableCell>
                  <TableCell align="right" className="font-bold">{formatCurrency(r.totalRefundAmount)}</TableCell>
                  <TableCell align="right" className="text-red-600">{formatCurrency(r.settlement?.cashRefunded || 0)}</TableCell>
                  <TableCell align="right" className="text-emerald-700">{formatCurrency(r.settlement?.creditRetained || 0)}</TableCell>
                  <TableCell className="text-surface-500 max-w-[180px] truncate">{r.reason}</TableCell>
                </TableRow>
              ))}
            </Table>
            <Pagination pagination={retData?.pagination} onPage={setPage} />
          </>
        )}
      </div>

      <SalesReturnModal isOpen={Boolean(returnFor)} onClose={() => setReturnFor(null)} invoice={returnFor} />
    </div>
  );
};
