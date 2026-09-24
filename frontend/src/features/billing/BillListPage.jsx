import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  Plus,
  Search,
  Eye,
  Printer,
  FileCheck,
  XCircle,
  Filter,
  CheckCircle2
} from 'lucide-react';
import {
  useGetKachaBillsQuery,
  useGetPakkaBillsQuery,
  useCancelInvoiceMutation
} from '../../app/api/baseApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Table, TableRow, TableCell } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConvertKachaModal } from './ConvertKachaModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toast } from 'sonner';

export const BillListPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKachaForConvert, setSelectedKachaForConvert] = useState(null);

  const { data: kachaData, isLoading: kachaLoading } = useGetKachaBillsQuery();
  const { data: pakkaData, isLoading: pakkaLoading } = useGetPakkaBillsQuery();
  const [cancelInvoice] = useCancelInvoiceMutation();

  const isLoading = kachaLoading || pakkaLoading;

  const kachaBills = kachaData?.data || [];
  const pakkaBills = pakkaData?.data || [];

  // Combine and sort bills
  const allBills = [...kachaBills, ...pakkaBills].sort(
    (a, b) => new Date(b.invoiceDate || b.createdAt) - new Date(a.invoiceDate || a.createdAt)
  );

  // Filter bills
  const filteredBills = allBills.filter((bill) => {
    // Tab filter
    if (activeTab === 'KACHA' && bill.billType !== 'KACHA') return false;
    if (activeTab === 'PAKKA' && bill.billType !== 'PAKKA') return false;
    if (activeTab === 'PAID' && bill.paymentStatus !== 'PAID') return false;
    if (activeTab === 'DUE' && bill.paymentStatus !== 'DUE') return false;
    if (activeTab === 'PARTIAL' && bill.paymentStatus !== 'PARTIAL') return false;
    if (activeTab === 'CONVERTED' && bill.status !== 'CONVERTED') return false;
    if (activeTab === 'CANCELLED' && bill.status !== 'CANCELLED') return false;

    // Search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const invNo = bill.invoiceNo?.toLowerCase() || '';
      const custName = (bill.customerSnapshot?.name || bill.customerId?.name || '').toLowerCase();
      return invNo.includes(q) || custName.includes(q);
    }
    return true;
  });

  const handleCancel = async (bill) => {
    if (window.confirm(`Are you sure you want to cancel Invoice ${bill.invoiceNo}? This restores inventory.`)) {
      try {
        await cancelInvoice({ id: bill._id, reason: 'Customer requested cancellation at counter' }).unwrap();
        toast.success(`Invoice ${bill.invoiceNo} cancelled and stock restored`);
      } catch (err) {
        toast.error(err?.data?.message || 'Failed to cancel invoice');
      }
    }
  };

  const tabs = [
    { id: 'ALL', label: 'All Bills', count: allBills.length },
    { id: 'KACHA', label: 'Kacha Estimates', count: kachaBills.length },
    { id: 'PAKKA', label: 'Pakka (GST)', count: pakkaBills.length },
    { id: 'PAID', label: 'Fully Paid' },
    { id: 'PARTIAL', label: 'Partially Paid' },
    { id: 'DUE', label: 'Pending Due' },
    { id: 'CONVERTED', label: 'Converted' },
    { id: 'CANCELLED', label: 'Cancelled' }
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-display">Invoices & Bills Register</h1>
          <p className="text-xs text-surface-500 mt-1">
            Complete transaction record of Kacha trade bills and official Pakka GST tax invoices
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={Plus}
          onClick={() => navigate('/billing/new')}
          className="font-bold shadow-sm"
        >
          Create New Bill (F2)
        </Button>
      </div>

      {/* Tabs and Search Bar */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-xs p-4 space-y-4">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search by Bill No (e.g. KACHA/HO01...) or Customer Name..."
              icon={Search}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Invoices Table */}
        {isLoading ? (
          <TableSkeleton rows={6} cols={9} />
        ) : filteredBills.length === 0 ? (
          <EmptyState
            title="No Invoices Found"
            description="No matching invoices found in this view filter."
            actionLabel="Generate New Bill"
            onAction={() => navigate('/billing/new')}
          />
        ) : (
          <Table
            headers={[
              'Bill No',
              'Type',
              'Customer',
              'Date',
              { label: 'Amount', align: 'right' },
              { label: 'Paid', align: 'right' },
              { label: 'Due', align: 'right' },
              { label: 'Status', align: 'center' },
              { label: 'Actions', align: 'right' }
            ]}
          >
            {filteredBills.map((bill) => {
              const customerName = bill.customerSnapshot?.name || bill.customerId?.name || 'Walk-in Customer';
              const paid = bill.paymentSummary?.paid || 0;
              const due = bill.paymentSummary?.due || 0;
              const isKacha = bill.billType === 'KACHA';
              const isConverted = bill.status === 'CONVERTED';
              const isCancelled = bill.status === 'CANCELLED';

              return (
                <TableRow key={bill._id}>
                  <TableCell className="font-mono font-bold text-surface-900">
                    {bill.invoiceNo}
                  </TableCell>
                  <TableCell>
                    <Badge variant={isKacha ? 'kacha' : 'pakka'}>
                      {bill.billType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-surface-800">
                    {customerName}
                  </TableCell>
                  <TableCell className="text-surface-500">
                    {formatDate(bill.invoiceDate || bill.createdAt)}
                  </TableCell>
                  <TableCell align="right" className="font-bold text-surface-900">
                    {formatCurrency(bill.grandTotal)}
                  </TableCell>
                  <TableCell align="right" className="text-emerald-700 font-semibold">
                    {formatCurrency(paid)}
                  </TableCell>
                  <TableCell
                    align="right"
                    className={`font-semibold ${due > 0 ? 'text-amber-600 font-bold' : 'text-surface-400'}`}
                  >
                    {formatCurrency(due)}
                  </TableCell>
                  <TableCell align="center">
                    <Badge
                      variant={
                        isCancelled
                          ? 'danger'
                          : isConverted
                          ? 'purple'
                          : bill.paymentStatus === 'PAID'
                          ? 'success'
                          : bill.paymentStatus === 'PARTIAL'
                          ? 'warning'
                          : 'default'
                      }
                      size="sm"
                    >
                      {bill.paymentStatus || bill.status}
                    </Badge>
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        title="View & Print Bill"
                        onClick={() => navigate(`/billing/${bill._id}`)}
                        className="p-1.5 rounded-lg text-surface-500 hover:text-surface-900 hover:bg-surface-100 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Convert Kacha to Pakka Action */}
                      {isKacha && !isConverted && !isCancelled && (
                        <button
                          type="button"
                          title="Convert to Official Pakka GST Invoice"
                          onClick={() => setSelectedKachaForConvert(bill)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-gold-50 text-gold-800 hover:bg-gold-100 border border-gold-200 transition-colors"
                        >
                          <FileCheck className="w-3.5 h-3.5 text-gold-600" />
                          <span>Convert</span>
                        </button>
                      )}

                      {!isCancelled && !isConverted && (
                        <button
                          type="button"
                          title="Cancel Invoice"
                          onClick={() => handleCancel(bill)}
                          className="p-1.5 rounded-lg text-surface-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </Table>
        )}
      </div>

      {/* Convert Modal */}
      <ConvertKachaModal
        isOpen={Boolean(selectedKachaForConvert)}
        onClose={() => setSelectedKachaForConvert(null)}
        kachaBill={selectedKachaForConvert}
      />
    </div>
  );
};
