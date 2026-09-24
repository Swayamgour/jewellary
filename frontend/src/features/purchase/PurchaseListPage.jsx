import React, { useState } from 'react';
import { Truck, Plus, Search, Eye, Filter, CheckCircle2 } from 'lucide-react';
import { useGetPurchasesQuery } from '../../app/api/baseApi';
import { Table, TableRow, TableCell } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PurchaseEntryModal } from './PurchaseEntryModal';
import { formatCurrency, formatDate, formatWeight } from '../../utils/formatters';

export const PurchaseListPage = () => {
  const [search, setSearch] = useState('');
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);

  const { data: purchaseData, isLoading } = useGetPurchasesQuery({ search });
  const purchases = purchaseData?.data || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-display">Wholesale Purchases</h1>
          <p className="text-xs text-surface-500 mt-1">
            Vendor bullion supplies, inventory stock addition, and accounts payable
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={Plus}
          onClick={() => setPurchaseModalOpen(true)}
          className="font-bold shadow-sm"
        >
          New Purchase Entry
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search purchases by vendor or reference number..."
              icon={Search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={8} />
        ) : purchases.length === 0 ? (
          <EmptyState
            title="No Purchases Recorded"
            description="Record wholesale bullion or finished jewellery stock purchases."
            actionLabel="Add Purchase Entry"
            onAction={() => setPurchaseModalOpen(true)}
          />
        ) : (
          <Table
            headers={[
              'Purchase No',
              'Vendor',
              'Date',
              'Items',
              { label: 'Total Amount', align: 'right' },
              { label: 'Paid', align: 'right' },
              { label: 'Due', align: 'right' },
              { label: 'Status', align: 'center' }
            ]}
          >
            {purchases.map((pur) => (
              <TableRow key={pur._id}>
                <TableCell className="font-mono font-bold text-surface-900">
                  {pur.purchaseNo}
                </TableCell>
                <TableCell className="font-semibold text-surface-800">
                  {pur.vendorSnapshot?.name || pur.vendorId?.name || 'Wholesale Supplier'}
                </TableCell>
                <TableCell className="text-surface-500">
                  {formatDate(pur.purchaseDate || pur.createdAt)}
                </TableCell>
                <TableCell className="text-surface-600">
                  {pur.items?.length || 1} lot(s)
                </TableCell>
                <TableCell align="right" className="font-bold text-surface-900">
                  {formatCurrency(pur.grandTotal)}
                </TableCell>
                <TableCell align="right" className="text-emerald-700 font-semibold">
                  {formatCurrency(pur.paidAmount || 0)}
                </TableCell>
                <TableCell
                  align="right"
                  className={`font-semibold ${
                    (pur.dueAmount || 0) > 0 ? 'text-amber-600 font-bold' : 'text-surface-400'
                  }`}
                >
                  {formatCurrency(pur.dueAmount || 0)}
                </TableCell>
                <TableCell align="center">
                  <Badge variant={pur.status === 'COMPLETED' ? 'success' : 'default'} size="sm">
                    {pur.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </div>

      <PurchaseEntryModal
        isOpen={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
      />
    </div>
  );
};
