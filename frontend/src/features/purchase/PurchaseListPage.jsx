import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, Search, Eye } from 'lucide-react';
import { useGetPurchasesQuery, useGetPurchaseReturnsQuery, useGetPurchaseOrdersQuery } from '../../app/api/baseApi';
import { selectUserRole } from '../auth/authSlice';
import { Table, TableRow, TableCell } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { EmptyState } from '../../components/ui/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import { PurchaseEntryModal } from './PurchaseEntryModal';
import { PurchaseDetailModal } from './PurchaseDetailModal';
import { PurchaseOrderFormModal, PurchaseOrderDetailModal } from './PurchaseOrderModals';
import { CAN_BUY, paymentStatusVariant, poStatusVariant } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/formatters';

const PO_STATUSES = ['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'REJECTED', 'CANCELLED'];

export const PurchaseListPage = () => {
  const role = useSelector(selectUserRole);
  const canBuy = CAN_BUY.includes(role);
  const [tab, setTab] = useState('PURCHASES');
  const [page, setPage] = useState(1);
  const [poStatus, setPoStatus] = useState('');
  const [purStatus, setPurStatus] = useState('');
  const [entryOpen, setEntryOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [poFormOpen, setPoFormOpen] = useState(false);
  const [editingPo, setEditingPo] = useState(null);
  const [poDetailId, setPoDetailId] = useState(null);

  const { data: pData, isLoading: pLoading } = useGetPurchasesQuery({ page, limit: 20, status: purStatus || undefined }, { skip: tab !== 'PURCHASES' });
  const { data: rData, isLoading: rLoading } = useGetPurchaseReturnsQuery({ page, limit: 20 }, { skip: tab !== 'RETURNS' });
  const { data: oData, isLoading: oLoading } = useGetPurchaseOrdersQuery({ page, limit: 20, status: poStatus || undefined }, { skip: tab !== 'ORDERS' });

  const changeTab = (t) => { setTab(t); setPage(1); };
  const purchases = pData?.data || [];
  const returns = rData?.data || [];
  const orders = oData?.data || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-display">Purchases</h1>
          <p className="text-xs text-surface-500 mt-1">Purchase orders → goods receipt → vendor payments and returns</p>
        </div>
        {canBuy && (
          <div className="flex gap-2">
            <Button variant="outline" icon={Plus} onClick={() => { setEditingPo(null); setPoFormOpen(true); }}>New Purchase Order</Button>
            <Button variant="primary" icon={Plus} className="font-bold" onClick={() => { setEditingPurchase(null); setEntryOpen(true); }}>Record Purchase</Button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-xs space-y-4">
        <Tabs tabs={[{ id: 'PURCHASES', label: 'Purchases' }, { id: 'ORDERS', label: 'Purchase Orders' }, { id: 'RETURNS', label: 'Purchase Returns' }]} activeTab={tab} onChange={changeTab} />

        {tab === 'PURCHASES' && (
          <>
            <div className="flex gap-2 text-xs">
              {['', 'DRAFT', 'COMPLETED', 'CANCELLED'].map((s) => (
                <button key={s} type="button" onClick={() => { setPurStatus(s); setPage(1); }} className={`px-3 py-1 rounded-full border font-semibold ${purStatus === s ? 'bg-gold-500 text-white border-gold-500' : 'bg-white border-surface-200 text-surface-600'}`}>{s || 'All'}</button>
              ))}
            </div>
            {pLoading ? <TableSkeleton rows={6} cols={8} /> : purchases.length === 0 ? (
              <EmptyState title="No Purchases" description="Record a vendor purchase to add stock." />
            ) : (
              <>
                <Table headers={['Purchase No', 'Vendor', 'Date', { label: 'Total', align: 'right' }, { label: 'Returned', align: 'right' }, { label: 'Paid', align: 'right' }, { label: 'Due', align: 'right' }, { label: 'Status', align: 'center' }, { label: '', align: 'right' }]}>
                  {purchases.map((p) => (
                    <TableRow key={p._id} onClick={() => setDetailId(p._id)}>
                      <TableCell className="font-mono font-bold text-surface-900">{p.purchaseNo}</TableCell>
                      <TableCell className="font-semibold">{p.vendorId?.company || p.vendorId?.name}</TableCell>
                      <TableCell className="text-surface-500">{formatDate(p.purchaseDate)}</TableCell>
                      <TableCell align="right" className="font-bold">{formatCurrency(p.grandTotal)}</TableCell>
                      <TableCell align="right" className={p.returnedAmount > 0 ? 'text-sky-700' : 'text-surface-400'}>{formatCurrency(p.returnedAmount || 0)}</TableCell>
                      <TableCell align="right" className="text-emerald-700 font-semibold">{formatCurrency(p.paidAmount)}</TableCell>
                      <TableCell align="right" className={p.dueAmount > 0 ? 'text-amber-600 font-bold' : 'text-surface-400'}>{formatCurrency(p.dueAmount)}</TableCell>
                      <TableCell align="center">
                        {p.status === 'COMPLETED' ? <Badge variant={paymentStatusVariant(p.paymentStatus)} size="sm">{p.paymentStatus}</Badge> : <Badge variant={p.status === 'DRAFT' ? 'default' : 'danger'} size="sm">{p.status}</Badge>}
                      </TableCell>
                      <TableCell align="right"><Eye className="w-4 h-4 text-surface-400 inline" /></TableCell>
                    </TableRow>
                  ))}
                </Table>
                <Pagination pagination={pData?.pagination} onPage={setPage} />
              </>
            )}
          </>
        )}

        {tab === 'ORDERS' && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              {PO_STATUSES.map((s) => (
                <button key={s} type="button" onClick={() => { setPoStatus(s); setPage(1); }} className={`px-3 py-1 rounded-full border font-semibold ${poStatus === s ? 'bg-gold-500 text-white border-gold-500' : 'bg-white border-surface-200 text-surface-600'}`}>{s ? s.replace('_', ' ') : 'All'}</button>
              ))}
            </div>
            {oLoading ? <TableSkeleton rows={6} cols={6} /> : orders.length === 0 ? (
              <EmptyState title="No Purchase Orders" description="Create an order, get it approved, then receive goods against it." />
            ) : (
              <>
                <Table headers={['PO No', 'Vendor', 'Date', 'Expected', { label: 'Estimated', align: 'right' }, { label: 'Status', align: 'center' }]}>
                  {orders.map((o) => (
                    <TableRow key={o._id} onClick={() => setPoDetailId(o._id)}>
                      <TableCell className="font-mono font-bold text-surface-900">{o.poNo}</TableCell>
                      <TableCell className="font-semibold">{o.vendorId?.company || o.vendorId?.name}</TableCell>
                      <TableCell className="text-surface-500">{formatDate(o.poDate)}</TableCell>
                      <TableCell className="text-surface-500">{o.expectedDeliveryDate ? formatDate(o.expectedDeliveryDate) : '-'}</TableCell>
                      <TableCell align="right" className="font-bold">{formatCurrency(o.estimatedTotal)}</TableCell>
                      <TableCell align="center"><Badge variant={poStatusVariant(o.status)} size="sm">{o.status.replace('_', ' ')}</Badge></TableCell>
                    </TableRow>
                  ))}
                </Table>
                <Pagination pagination={oData?.pagination} onPage={setPage} />
              </>
            )}
          </>
        )}

        {tab === 'RETURNS' && (rLoading ? <TableSkeleton rows={5} cols={6} /> : returns.length === 0 ? (
          <EmptyState title="No Purchase Returns" description="Returns to vendors appear here." />
        ) : (
          <>
            <Table headers={['Return No', 'Date', 'Purchase', 'Items', { label: 'Value', align: 'right' }, { label: 'Payable after', align: 'right' }, { label: 'Vendor owes us', align: 'right' }, 'Reason']}>
              {returns.map((r) => (
                <TableRow key={r._id}>
                  <TableCell className="font-mono font-bold">{r.returnNo}</TableCell>
                  <TableCell className="text-surface-500">{formatDate(r.returnDate)}</TableCell>
                  <TableCell className="font-mono">{r.purchaseNo}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.items?.map((i) => `${i.productName} ×${i.quantity}`).join(', ')}</TableCell>
                  <TableCell align="right" className="font-bold">{formatCurrency(r.totalAmount)}</TableCell>
                  <TableCell align="right">{formatCurrency(r.reconciliation?.adjustedDue || 0)}</TableCell>
                  <TableCell align="right" className={r.reconciliation?.refundDue > 0 ? 'text-rose-600 font-bold' : 'text-surface-400'}>{formatCurrency(r.reconciliation?.refundDue || 0)}</TableCell>
                  <TableCell className="text-surface-500 max-w-[160px] truncate">{r.reason}</TableCell>
                </TableRow>
              ))}
            </Table>
            <Pagination pagination={rData?.pagination} onPage={setPage} />
          </>
        ))}
      </div>

      <PurchaseEntryModal isOpen={entryOpen} onClose={() => { setEntryOpen(false); setEditingPurchase(null); }} draft={editingPurchase} />
      <PurchaseDetailModal purchaseId={detailId} role={role} onClose={() => setDetailId(null)} onEditDraft={(p) => { setDetailId(null); setEditingPurchase(p); setEntryOpen(true); }} />
      <PurchaseOrderFormModal isOpen={poFormOpen} onClose={() => { setPoFormOpen(false); setEditingPo(null); }} order={editingPo} />
      <PurchaseOrderDetailModal orderId={poDetailId} role={role} onClose={() => setPoDetailId(null)} onEdit={(po) => { setPoDetailId(null); setEditingPo(po); setPoFormOpen(true); }} />
    </div>
  );
};
