import React, { useState } from 'react';
import { CreditCard, Plus, Search, RotateCcw, CheckCircle2, ArrowDownLeft } from 'lucide-react';
import {
  useGetPaymentsQuery,
  useRecordPaymentMutation,
  useReversePaymentMutation,
  useGetCustomersQuery,
  useGetVendorsQuery,
  useGetDashboardQuery
} from '../../app/api/baseApi';
import { Table, TableRow, TableCell } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { toast } from 'sonner';

export const PaymentListPage = () => {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const { data: payData, isLoading } = useGetPaymentsQuery({ search });
  const { data: dashData } = useGetDashboardQuery({ filter: 'today' });
  const { data: custData } = useGetCustomersQuery();
  const { data: vendorData } = useGetVendorsQuery();

  const [recordPayment, { isLoading: isRecording }] = useRecordPaymentMutation();
  const [reversePayment, { isLoading: isReversing }] = useReversePaymentMutation();

  const payments = payData?.data || [];
  const collections = dashData?.data?.collections || {};
  const customers = custData?.data || [];
  const vendors = vendorData?.data || [];

  // Form State
  const [entityType, setEntityType] = useState('CUSTOMER');
  const [entityId, setEntityId] = useState('');
  const [referenceType, setReferenceType] = useState('DIRECT');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [notes, setNotes] = useState('Receipt at billing counter');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const activeEntityId = entityId || (entityType === 'CUSTOMER' ? customers[0]?._id : vendors[0]?._id);
    if (!activeEntityId || !amount || parseFloat(amount) <= 0) {
      toast.error('Please specify valid recipient and amount');
      return;
    }

    try {
      await recordPayment({
        referenceType,
        entityType,
        entityId: activeEntityId,
        amount: parseFloat(amount),
        paymentMode,
        notes
      }).unwrap();

      toast.success('Payment receipt processed and ledger updated!');
      setModalOpen(false);
      setAmount('');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to record payment');
    }
  };

  const handleReverse = async (payment) => {
    const reason = window.prompt(`Enter reason for reversing payment #${payment.paymentNo || payment._id}:`);
    if (!reason || reason.length < 5) {
      toast.error('Valid reversal reason (min 5 characters) is required');
      return;
    }

    try {
      await reversePayment({ id: payment._id, reason }).unwrap();
      toast.success(`Payment reversed and ledger credited`);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to reverse payment');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-display">Payments & Cash Desk</h1>
          <p className="text-xs text-surface-500 mt-1">
            Track daily counter collections, multi-tender receipts, and vendor ledger disbursements
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={Plus}
          onClick={() => setModalOpen(true)}
          className="font-bold shadow-sm"
        >
          Record Direct Payment
        </Button>
      </div>

      {/* Collection Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Today's Collections"
          value={formatCurrency(collections.TOTAL || 0)}
          subtitle="All Counter Receipts"
          variant="gold"
          icon={CreditCard}
        />
        <StatCard
          title="Cash in Drawer"
          value={formatCurrency(collections.CASH || 0)}
          subtitle="Physical Cash Intake"
          variant="default"
        />
        <StatCard
          title="UPI / QR Payments"
          value={formatCurrency(collections.UPI || 0)}
          subtitle="Instant Digital Settle"
          variant="emerald"
        />
        <StatCard
          title="Card Terminal (POS)"
          value={formatCurrency(collections.CARD || 0)}
          subtitle="Debit / Credit Swipes"
          variant="default"
        />
        <StatCard
          title="Bank / NEFT / RTGS"
          value={formatCurrency(collections.BANK_TRANSFER || 0)}
          subtitle="Direct Account Intake"
          variant="amber"
        />
      </div>

      {/* Payment Table */}
      <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search payments by reference, customer or payment mode..."
              icon={Search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={8} />
        ) : payments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No Payment Receipts Found"
            description="Collect customer dues or pay vendors from this desk."
            actionLabel="Record Payment"
            onAction={() => setModalOpen(true)}
          />
        ) : (
          <Table
            headers={[
              'Payment Ref',
              'Date & Time',
              'Party / Entity',
              'Channel / Mode',
              'Type',
              { label: 'Amount', align: 'right' },
              { label: 'Status', align: 'center' },
              { label: 'Action', align: 'right' }
            ]}
          >
            {payments.map((p) => (
              <TableRow key={p._id}>
                <TableCell className="font-mono font-bold text-surface-900">
                  {p.paymentNo || p._id.slice(-6).toUpperCase()}
                </TableCell>
                <TableCell className="text-surface-500">
                  {formatDateTime(p.paymentDate || p.createdAt)}
                </TableCell>
                <TableCell className="font-semibold text-surface-800">
                  {p.entityId?.name || p.entityId?.company || p.entityType}
                </TableCell>
                <TableCell className="font-bold text-surface-700">
                  {p.paymentMode}
                </TableCell>
                <TableCell className="text-surface-500 text-xs">
                  {p.referenceType}
                </TableCell>
                <TableCell align="right" className="font-extrabold text-emerald-700 font-display">
                  {formatCurrency(p.amount)}
                </TableCell>
                <TableCell align="center">
                  <Badge variant={p.status === 'SUCCESS' ? 'success' : 'danger'} size="sm">
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell align="right">
                  {p.status === 'SUCCESS' && (
                    <button
                      type="button"
                      title="Reverse Payment"
                      onClick={() => handleReverse(p)}
                      className="p-1.5 rounded-lg text-surface-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </div>

      {/* Record Payment Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Payment Receipt / Disbursement"
        subtitle="Credits or debits customer/vendor account and logs cashier register receipt"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase text-surface-600">Entity Type</label>
              <select
                value={entityType}
                onChange={(e) => {
                  setEntityType(e.target.value);
                  setEntityId('');
                }}
                className="mt-1 w-full rounded-lg border border-surface-300 p-2 font-semibold"
              >
                <option value="CUSTOMER">Customer (Receivable)</option>
                <option value="VENDOR">Wholesale Vendor (Payable)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-surface-600">
                Select {entityType === 'CUSTOMER' ? 'Customer' : 'Vendor'}
              </label>
              <select
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-surface-300 p-2 font-semibold"
                required
              >
                <option value="">Choose...</option>
                {entityType === 'CUSTOMER'
                  ? customers.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} (Due: {formatCurrency(c.currentBalance)})
                      </option>
                    ))
                  : vendors.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.company || v.name} (Due: {formatCurrency(v.currentBalance)})
                      </option>
                    ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Amount (₹) *"
                type="number"
                placeholder="e.g. 25000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-surface-600">Payment Channel</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-surface-300 p-2 font-semibold"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI / QR Code</option>
                <option value="CARD">Credit / Debit Card</option>
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                <option value="CHEQUE">Cheque</option>
                <option value="EXCHANGE">Old Gold Exchange</option>
              </select>
            </div>
          </div>

          <Input
            label="Remarks / Reference Note"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isRecording} icon={CreditCard}>
              Record Payment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
