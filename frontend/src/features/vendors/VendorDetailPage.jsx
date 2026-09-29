import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Receipt, CreditCard, BookOpen, Phone, Mail, MapPin } from 'lucide-react';
import { useGetVendorByIdQuery, useGetVendorLedgerQuery, useGetVendorPurchasesQuery, useGetPaymentsQuery } from '../../app/api/baseApi';
import { Table, TableRow, TableCell } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';

export const VendorDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('LEDGER');

  const { data: vData, isLoading: vLoading } = useGetVendorByIdQuery(id);
  const { data: ledgerData, isLoading: ledgerLoading } = useGetVendorLedgerQuery({ id });
  const { data: purData, isLoading: purLoading } = useGetVendorPurchasesQuery({ id });
  const { data: payData, isLoading: payLoading } = useGetPaymentsQuery({ referenceType: undefined, limit: 100 });

  const vendor = vData?.data;
  const ledger = ledgerData?.data?.transactions || [];
  const purchases = purData?.data || [];
  const payments = (payData?.data || []).filter((p) => p.entityType === 'VENDOR' && String(p.entityId) === String(id));

  if (vLoading) return <TableSkeleton rows={4} cols={4} />;
  if (!vendor) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-bold text-surface-900">Vendor Not Found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/vendors')}>Back to Directory</Button>
      </div>
    );
  }

  const bal = vendor.currentBalance || 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-surface-200 shadow-xs">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" icon={ArrowLeft} onClick={() => navigate('/vendors')}>Back</Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-surface-900 font-display">{vendor.company || vendor.name}</h1>
              <Badge variant={bal > 0 ? 'warning' : bal < 0 ? 'info' : 'success'}>{bal > 0 ? 'Payable' : bal < 0 ? 'Advance' : 'Settled'}</Badge>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-surface-500 mt-1">
              <span>{vendor.name}</span>
              {vendor.mobile && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {vendor.mobile}</span>}
              {vendor.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {vendor.email}</span>}
              {vendor.address?.city && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {vendor.address.city}, {vendor.address.state}</span>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">{bal >= 0 ? 'Amount We Owe' : 'Vendor Advance'}</span>
          <p className={`text-2xl font-black font-display mt-0.5 ${bal > 0 ? 'text-amber-600' : bal < 0 ? 'text-emerald-700' : 'text-surface-500'}`}>{formatCurrency(Math.abs(bal))}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-xs space-y-4">
        <Tabs tabs={[{ id: 'LEDGER', label: 'Ledger', icon: BookOpen }, { id: 'PURCHASES', label: 'Purchases', icon: Receipt }, { id: 'PAYMENTS', label: 'Payments', icon: CreditCard }]} activeTab={tab} onChange={setTab} />

        {tab === 'LEDGER' && (ledgerLoading ? <TableSkeleton rows={5} cols={5} /> : ledger.length === 0 ? (
          <p className="text-center py-12 text-xs text-surface-400">No ledger transactions yet.</p>
        ) : (
          <Table headers={['Date', 'Type', { label: 'Debit (paid)', align: 'right' }, { label: 'Credit (owed)', align: 'right' }, { label: 'Balance', align: 'right' }, 'Description']}>
            {ledger.map((e) => (
              <TableRow key={e._id}>
                <TableCell className="text-surface-500">{formatDate(e.transactionDate)}</TableCell>
                <TableCell className="font-bold text-surface-800">{e.entryType}</TableCell>
                <TableCell align="right" className="font-bold">{e.debit > 0 ? formatCurrency(e.debit) : '-'}</TableCell>
                <TableCell align="right" className="text-amber-600 font-bold">{e.credit > 0 ? formatCurrency(e.credit) : '-'}</TableCell>
                <TableCell align="right" className={`font-extrabold font-mono ${e.runningBalance > 0 ? 'text-amber-600' : e.runningBalance < 0 ? 'text-emerald-700' : ''}`}>{formatCurrency(e.runningBalance)}</TableCell>
                <TableCell className="text-surface-500 max-w-xs truncate">{e.description}</TableCell>
              </TableRow>
            ))}
          </Table>
        ))}

        {tab === 'PURCHASES' && (purLoading ? <TableSkeleton rows={5} cols={6} /> : purchases.length === 0 ? (
          <p className="text-center py-12 text-xs text-surface-400">No purchases recorded yet.</p>
        ) : (
          <Table headers={['Purchase No', 'Date', { label: 'Total', align: 'right' }, { label: 'Paid', align: 'right' }, { label: 'Due', align: 'right' }, { label: 'Status', align: 'center' }]}>
            {purchases.map((p) => (
              <TableRow key={p._id}>
                <TableCell className="font-mono font-bold text-gold-700">{p.purchaseNo}</TableCell>
                <TableCell className="text-surface-500">{formatDate(p.purchaseDate)}</TableCell>
                <TableCell align="right" className="font-bold">{formatCurrency(p.grandTotal)}</TableCell>
                <TableCell align="right" className="text-emerald-700 font-semibold">{formatCurrency(p.paidAmount)}</TableCell>
                <TableCell align="right" className="text-amber-600 font-bold">{formatCurrency(p.dueAmount)}</TableCell>
                <TableCell align="center"><Badge variant={p.status !== 'COMPLETED' ? 'default' : p.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm">{p.status === 'COMPLETED' ? p.paymentStatus : p.status}</Badge></TableCell>
              </TableRow>
            ))}
          </Table>
        ))}

        {tab === 'PAYMENTS' && (payLoading ? <TableSkeleton rows={5} cols={5} /> : payments.length === 0 ? (
          <p className="text-center py-12 text-xs text-surface-400">No payments on record.</p>
        ) : (
          <Table headers={['Payment No', 'Date', 'Mode', { label: 'Direction', align: 'center' }, { label: 'Amount', align: 'right' }]}>
            {payments.map((p) => (
              <TableRow key={p._id}>
                <TableCell className="font-mono font-bold">{p.paymentNo}</TableCell>
                <TableCell className="text-surface-500">{formatDateTime(p.paymentDate)}</TableCell>
                <TableCell className="font-bold">{p.paymentMode}</TableCell>
                <TableCell align="center"><Badge variant={p.direction === 'OUT' ? 'warning' : 'success'} size="sm">{p.direction}</Badge></TableCell>
                <TableCell align="right" className="font-bold">{formatCurrency(p.amount)}</TableCell>
              </TableRow>
            ))}
          </Table>
        ))}
      </div>
    </div>
  );
};
