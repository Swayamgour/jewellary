import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users,
  ArrowLeft,
  Receipt,
  CreditCard,
  BookOpen,
  Phone,
  Mail,
  MapPin,
  FileText
} from 'lucide-react';
import {
  useGetCustomerByIdQuery,
  useGetCustomerLedgerQuery,
  useGetCustomerBillsQuery,
  useGetCustomerPaymentsQuery
} from '../../app/api/baseApi';
import { Table, TableRow, TableCell } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { StatCard } from '../../components/ui/StatCard';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';

export const CustomerDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('LEDGER');

  const { data: custData, isLoading: custLoading } = useGetCustomerByIdQuery(id);
  const { data: ledgerData, isLoading: ledgerLoading } = useGetCustomerLedgerQuery({ id });
  const { data: billsData, isLoading: billsLoading } = useGetCustomerBillsQuery({ id });
  const { data: paymentsData, isLoading: payLoading } = useGetCustomerPaymentsQuery({ id });

  const customer = custData?.data;
  const ledgerEntries = ledgerData?.data?.entries || ledgerData?.data || [];
  const bills = billsData?.data || [];
  const payments = paymentsData?.data || [];

  if (custLoading) {
    return (
      <div className="space-y-4">
        <TableSkeleton rows={4} cols={4} />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-bold text-surface-900">Customer Profile Not Found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/customers')}>
          Back to Directory
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-surface-200 shadow-xs">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" icon={ArrowLeft} onClick={() => navigate('/customers')}>
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-surface-900 font-display">{customer.name}</h1>
              <Badge variant={customer.currentBalance > 0 ? 'warning' : 'success'}>
                {customer.currentBalance > 0 ? 'Balance Due' : 'Account Clear'}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-surface-500 mt-1">
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> {customer.mobile}
              </span>
              {customer.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> {customer.email}
                </span>
              )}
              {customer.address?.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {customer.address.city}, {customer.address.state}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">
            Outstanding Receivable
          </span>
          <p
            className={`text-2xl font-black font-display mt-0.5 ${customer.currentBalance > 0 ? 'text-amber-600' : 'text-emerald-700'
              }`}
          >
            {formatCurrency(customer.currentBalance)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-xs space-y-4">
        <Tabs
          tabs={[
            { id: 'LEDGER', label: 'Financial Ledger Account', icon: BookOpen, count: ledgerEntries.length },
            { id: 'BILLS', label: 'Invoices History', icon: Receipt, count: bills.length },
            { id: 'PAYMENTS', label: 'Receipts & Tender', icon: CreditCard, count: payments.length }
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {/* Tab 1: Ledger Statement */}
        {activeTab === 'LEDGER' && (
          <div>
            {ledgerLoading ? (
              <TableSkeleton rows={5} cols={6} />
            ) : ledgerEntries.length === 0 ? (
              <div className="text-center py-12 text-xs text-surface-400">
                No ledger transactions recorded yet for this customer.
              </div>
            ) : (
              <Table
                headers={[
                  'Date',
                  'Transaction Type',
                  'Reference No',
                  { label: 'Debit (+ Due)', align: 'right' },
                  { label: 'Credit (- Paid)', align: 'right' },
                  { label: 'Running Balance', align: 'right' },
                  'Description'
                ]}
              >
                {console.log('Ledger Entries:', ledgerEntries)}
                {ledgerEntries?.transactions?.map((entry, idx) => (
                  <TableRow key={entry._id || idx}>
                    <TableCell className="text-surface-500">
                      {formatDate(entry.transactionDate || entry.createdAt)}
                    </TableCell>
                    <TableCell className="font-bold text-surface-800 text-xs">
                      {entry.transactionType}
                    </TableCell>
                    <TableCell className="font-mono text-surface-900 font-semibold">
                      {entry.referenceNo || '-'}
                    </TableCell>
                    <TableCell align="right" className="font-bold text-surface-900">
                      {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                    </TableCell>
                    <TableCell align="right" className="font-bold text-emerald-700">
                      {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                    </TableCell>
                    <TableCell align="right" className="font-extrabold text-surface-900 font-mono">
                      {formatCurrency(entry.runningBalance || entry.balance)}
                    </TableCell>
                    <TableCell className="text-surface-500 text-xs truncate max-w-xs">
                      {entry.description || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            )}
          </div>
        )}

        {/* Tab 2: Customer Bills */}
        {activeTab === 'BILLS' && (
          <div>
            {billsLoading ? (
              <TableSkeleton rows={5} cols={6} />
            ) : bills.length === 0 ? (
              <div className="text-center py-12 text-xs text-surface-400">
                No purchase invoices found for this customer.
              </div>
            ) : (
              <Table
                headers={[
                  'Invoice No',
                  'Bill Type',
                  'Date',
                  { label: 'Grand Total', align: 'right' },
                  { label: 'Paid', align: 'right' },
                  { label: 'Balance Due', align: 'right' },
                  { label: 'Status', align: 'center' }
                ]}
              >
                {bills.map((b) => (
                  <TableRow
                    key={b._id}
                    onClick={() => navigate(`/billing/${b._id}`)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-mono font-bold text-gold-700">
                      {b.invoiceNo}
                    </TableCell>
                    <TableCell>
                      <Badge variant={b.billType === 'KACHA' ? 'kacha' : 'pakka'} size="sm">
                        {b.billType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-surface-500">
                      {formatDate(b.invoiceDate || b.createdAt)}
                    </TableCell>
                    <TableCell align="right" className="font-bold text-surface-900">
                      {formatCurrency(b.grandTotal)}
                    </TableCell>
                    <TableCell align="right" className="text-emerald-700 font-semibold">
                      {formatCurrency(b.paymentSummary?.paid || 0)}
                    </TableCell>
                    <TableCell align="right" className="font-bold text-amber-600">
                      {formatCurrency(b.paymentSummary?.due || 0)}
                    </TableCell>
                    <TableCell align="center">
                      <Badge variant={b.paymentStatus === 'PAID' ? 'success' : 'warning'} size="sm">
                        {b.paymentStatus || b.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            )}
          </div>
        )}

        {/* Tab 3: Customer Payments */}
        {activeTab === 'PAYMENTS' && (
          <div>
            {payLoading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : payments.length === 0 ? (
              <div className="text-center py-12 text-xs text-surface-400">
                No payment receipts on record.
              </div>
            ) : (
              <Table
                headers={[
                  'Payment ID',
                  'Date',
                  'Mode',
                  { label: 'Amount Collected', align: 'right' },
                  { label: 'Status', align: 'center' }
                ]}
              >
                {payments.map((p) => (
                  <TableRow key={p._id}>
                    <TableCell className="font-mono font-bold text-surface-900">
                      {p.paymentNo || p._id}
                    </TableCell>
                    <TableCell className="text-surface-500">
                      {formatDateTime(p.paymentDate || p.createdAt)}
                    </TableCell>
                    <TableCell className="font-bold text-surface-800">{p.paymentMode}</TableCell>
                    <TableCell align="right" className="font-bold text-emerald-700">
                      {formatCurrency(p.amount)}
                    </TableCell>
                    <TableCell align="center">
                      <Badge variant="success" size="sm">
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
