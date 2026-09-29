import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Plus, Search, Eye, FileCheck, XCircle, Pencil } from 'lucide-react';
import { useGetInvoicesQuery } from '../../app/api/baseApi';
import { selectUserRole } from '../auth/authSlice';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Table, TableRow, TableCell } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConvertKachaModal } from './ConvertKachaModal';
import { CancelInvoiceModal } from './CancelInvoiceModal';
import { Pagination } from '../../components/ui/Pagination';
import { useDebounce } from '../../utils/useDebounce';
import { CAN_CANCEL, CAN_CONVERT, invoiceStatusVariant, paymentStatusVariant } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/formatters';

// Every tab maps to server-side filters - the list is paged and searched by the API
const TABS = [
  { id: 'ALL', label: 'All Bills', params: {} },
  { id: 'KACHA', label: 'Kacha', params: { billType: 'KACHA' } },
  { id: 'PAKKA', label: 'Pakka (GST)', params: { billType: 'PAKKA' } },
  { id: 'DRAFT', label: 'Drafts', params: { status: 'DRAFT' } },
  { id: 'DUE', label: 'Pending Due', params: { dueOnly: 'true' } },
  { id: 'PAID', label: 'Fully Paid', params: { status: 'CONFIRMED', paymentStatus: 'PAID' } },
  { id: 'CONVERTED', label: 'Converted', params: { status: 'CONVERTED' } },
  { id: 'CANCELLED', label: 'Cancelled', params: { status: 'CANCELLED' } }
];

export const BillListPage = () => {
  const navigate = useNavigate();
  const role = useSelector(selectUserRole);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [convertBill, setConvertBill] = useState(null);
  const [cancelBill, setCancelBill] = useState(null);
  const search = useDebounce(searchTerm, 350);

  const tab = TABS.find((t) => t.id === activeTab);
  const { data, isLoading, isFetching } = useGetInvoicesQuery({ ...tab.params, search: search || undefined, page, limit: 20 });
  const bills = data?.data || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-display">Invoices & Bills Register</h1>
          <p className="text-xs text-surface-500 mt-1">Kacha estimates, GST tax invoices, drafts, conversions and cancellations</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => navigate('/billing/new')} className="font-bold shadow-sm">
          Create New Bill
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-surface-200 shadow-xs p-4 space-y-4">
        <Tabs tabs={TABS.map((t) => ({ id: t.id, label: t.label }))} activeTab={activeTab} onChange={(id) => { setActiveTab(id); setPage(1); }} />

        <div className="max-w-md">
          <Input placeholder="Search by bill no, customer name or mobile..." icon={Search} value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} />
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={9} />
        ) : bills.length === 0 ? (
          <EmptyState title="No Invoices Found" description="No bills match this view." actionLabel="Generate New Bill" onAction={() => navigate('/billing/new')} />
        ) : (
          <>
            <div className={isFetching ? 'opacity-60 transition-opacity' : ''}>
              <Table
                headers={['Bill No', 'Type', 'Customer', 'Date', { label: 'Amount', align: 'right' }, { label: 'Paid', align: 'right' }, { label: 'Due', align: 'right' }, { label: 'Status', align: 'center' }, { label: 'Actions', align: 'right' }]}
              >
                {bills.map((bill) => {
                  const isKacha = bill.billType === 'KACHA';
                  const live = bill.status === 'CONFIRMED';
                  const draft = bill.status === 'DRAFT';
                  const due = live ? bill.paymentSummary?.due || 0 : 0;
                  return (
                    <TableRow key={bill._id}>
                      <TableCell className="font-mono font-bold text-surface-900">{bill.invoiceNo}</TableCell>
                      <TableCell><Badge variant={isKacha ? 'kacha' : 'pakka'}>{bill.billType}</Badge></TableCell>
                      <TableCell className="font-semibold text-surface-800">{bill.customerSnapshot?.name || 'Customer'}</TableCell>
                      <TableCell className="text-surface-500">{formatDate(bill.invoiceDate || bill.createdAt)}</TableCell>
                      <TableCell align="right" className="font-bold text-surface-900">{formatCurrency(bill.grandTotal)}</TableCell>
                      <TableCell align="right" className="text-emerald-700 font-semibold">{formatCurrency(bill.paymentSummary?.paid || 0)}</TableCell>
                      <TableCell align="right" className={due > 0 ? 'text-amber-600 font-bold' : 'text-surface-400'}>{formatCurrency(due)}</TableCell>
                      <TableCell align="center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant={invoiceStatusVariant(bill.status)} size="sm">{bill.status}</Badge>
                          {live && <Badge variant={paymentStatusVariant(bill.paymentStatus)} size="sm">{bill.paymentStatus}</Badge>}
                          {live && bill.returnStatus && bill.returnStatus !== 'NONE' && <Badge variant="info" size="sm">{bill.returnStatus} RETURN</Badge>}
                        </div>
                      </TableCell>
                      <TableCell align="right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button type="button" title="View" onClick={() => navigate(`/billing/${bill._id}`)} className="p-1.5 rounded-lg text-surface-500 hover:text-surface-900 hover:bg-surface-100"><Eye className="w-4 h-4" /></button>
                          {draft && (
                            <button type="button" title="Edit draft" onClick={() => navigate(`/billing/new?draft=${bill._id}`)} className="p-1.5 rounded-lg text-surface-500 hover:text-gold-700 hover:bg-gold-50"><Pencil className="w-4 h-4" /></button>
                          )}
                          {isKacha && live && CAN_CONVERT.includes(role) && (
                            <button type="button" title="Convert to Pakka GST invoice" onClick={() => setConvertBill(bill)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-gold-50 text-gold-800 hover:bg-gold-100 border border-gold-200">
                              <FileCheck className="w-3.5 h-3.5 text-gold-600" /> Convert
                            </button>
                          )}
                          {(live || draft) && CAN_CANCEL.includes(role) && (
                            <button type="button" title="Cancel" onClick={() => setCancelBill(bill)} className="p-1.5 rounded-lg text-surface-400 hover:text-red-600 hover:bg-red-50"><XCircle className="w-4 h-4" /></button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Table>
            </div>
            <Pagination pagination={data?.pagination} onPage={setPage} />
          </>
        )}
      </div>

      <ConvertKachaModal isOpen={Boolean(convertBill)} onClose={() => setConvertBill(null)} kachaBill={convertBill} />
      <CancelInvoiceModal isOpen={Boolean(cancelBill)} onClose={() => setCancelBill(null)} invoice={cancelBill} />
    </div>
  );
};
