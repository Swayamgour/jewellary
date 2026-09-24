import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, Eye, RotateCcw, Filter, CheckCircle2 } from 'lucide-react';
import { useGetSalesQuery, useRecordSalesReturnMutation } from '../../app/api/baseApi';
import { Table, TableRow, TableCell } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toast } from 'sonner';

export const SalesListPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [returnReason, setReturnReason] = useState('Customer exchange / return');

  const { data: salesData, isLoading } = useGetSalesQuery({ search });
  const [recordSalesReturn, { isLoading: isReturning }] = useRecordSalesReturnMutation();

  const sales = salesData?.data || [];

  const handleOpenReturn = (sale) => {
    setSelectedSaleForReturn(sale);
    setRefundAmount(sale.grandTotal);
    setReturnModalOpen(true);
  };

  const handleProcessReturn = async (e) => {
    e.preventDefault();
    if (!selectedSaleForReturn) return;

    try {
      const itemsToReturn = selectedSaleForReturn.items?.map((item) => ({
        itemId: item._id,
        productId: item.productId,
        quantity: item.quantity || 1,
        returnAmount: item.taxableAmount || item.totalAmount
      })) || [];

      await recordSalesReturn({
        id: selectedSaleForReturn._id,
        items: itemsToReturn,
        refundAmount: parseFloat(refundAmount) || 0,
        reason: returnReason
      }).unwrap();

      toast.success(`Sales return recorded for ${selectedSaleForReturn.invoiceNo}. Stock restored!`);
      setReturnModalOpen(false);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to process sales return');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-display">Sales Register</h1>
          <p className="text-xs text-surface-500 mt-1">
            Track confirmed jewellery sales, payments, customer receivables, and returns
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={ShoppingCart}
          onClick={() => navigate('/billing/new')}
          className="font-bold shadow-sm"
        >
          New Sale / Bill
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search by invoice number or customer name..."
              icon={Search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={8} />
        ) : sales.length === 0 ? (
          <EmptyState
            title="No Sales Records Found"
            description="Start processing jewellery sales through the Billing POS screen."
            actionLabel="Go to Billing"
            onAction={() => navigate('/billing/new')}
          />
        ) : (
          <Table
            headers={[
              'Sale / Invoice No',
              'Customer',
              'Bill Type',
              'Date',
              { label: 'Total Amount', align: 'right' },
              { label: 'Paid', align: 'right' },
              { label: 'Due', align: 'right' },
              { label: 'Status', align: 'center' },
              { label: 'Actions', align: 'right' }
            ]}
          >
            {sales.map((sale) => (
              <TableRow key={sale._id}>
                <TableCell className="font-mono font-bold text-surface-900">
                  {sale.invoiceNo}
                </TableCell>
                <TableCell className="font-semibold text-surface-800">
                  {sale.customerSnapshot?.name || sale.customerId?.name || 'Walk-in'}
                </TableCell>
                <TableCell>
                  <Badge variant={sale.billType === 'KACHA' ? 'kacha' : 'pakka'}>
                    {sale.billType}
                  </Badge>
                </TableCell>
                <TableCell className="text-surface-500">
                  {formatDate(sale.invoiceDate || sale.createdAt)}
                </TableCell>
                <TableCell align="right" className="font-bold text-surface-900">
                  {formatCurrency(sale.grandTotal)}
                </TableCell>
                <TableCell align="right" className="text-emerald-700 font-semibold">
                  {formatCurrency(sale.paymentSummary?.paid || 0)}
                </TableCell>
                <TableCell
                  align="right"
                  className={`font-semibold ${
                    (sale.paymentSummary?.due || 0) > 0 ? 'text-amber-600 font-bold' : 'text-surface-400'
                  }`}
                >
                  {formatCurrency(sale.paymentSummary?.due || 0)}
                </TableCell>
                <TableCell align="center">
                  <Badge
                    variant={
                      sale.paymentStatus === 'PAID'
                        ? 'success'
                        : sale.paymentStatus === 'PARTIAL'
                        ? 'warning'
                        : 'danger'
                    }
                    size="sm"
                  >
                    {sale.paymentStatus || sale.status}
                  </Badge>
                </TableCell>
                <TableCell align="right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      title="View Invoice"
                      onClick={() => navigate(`/billing/${sale._id}`)}
                      className="p-1.5 rounded-lg text-surface-500 hover:text-surface-900 hover:bg-surface-100 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {sale.status !== 'CANCELLED' && (
                      <button
                        type="button"
                        title="Sales Return & Stock Restore"
                        onClick={() => handleOpenReturn(sale)}
                        className="p-1.5 rounded-lg text-surface-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </div>

      {/* Sales Return Modal */}
      {selectedSaleForReturn && (
        <Modal
          isOpen={returnModalOpen}
          onClose={() => setReturnModalOpen(false)}
          title={`Record Sales Return — ${selectedSaleForReturn.invoiceNo}`}
          subtitle="Restores item inventory back to AVAILABLE and credits customer account"
        >
          <form onSubmit={handleProcessReturn} className="space-y-4">
            <div className="p-3 bg-surface-50 rounded-xl border border-surface-200 text-xs space-y-1">
              <p>
                <strong>Customer:</strong>{' '}
                {selectedSaleForReturn.customerSnapshot?.name || 'Walk-in'}
              </p>
              <p>
                <strong>Original Bill Total:</strong>{' '}
                {formatCurrency(selectedSaleForReturn.grandTotal)}
              </p>
            </div>

            <Input
              label="Refund / Credit Amount (₹) *"
              type="number"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              required
            />

            <Input
              label="Return Reason"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="e.g. Size mismatch / exchange"
              required
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-surface-200">
              <Button variant="outline" type="button" onClick={() => setReturnModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={isReturning} icon={RotateCcw}>
                Confirm Return & Restore Stock
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
