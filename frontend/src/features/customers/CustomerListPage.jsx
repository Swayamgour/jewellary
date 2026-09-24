import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, Search, Phone, Eye, ArrowUpRight } from 'lucide-react';
import { useGetCustomersQuery } from '../../app/api/baseApi';
import { Table, TableRow, TableCell } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { CustomerSelectModal } from '../billing/CustomerSelectModal';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const CustomerListPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [customerModalOpen, setCustomerModalOpen] = useState(false);

  const { data: customerData, isLoading } = useGetCustomersQuery({ search });
  const customers = customerData?.data || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-display">Customer Management</h1>
          <p className="text-xs text-surface-500 mt-1">
            Maintain customer retail profiles, credit limits, invoice histories, and double-entry ledgers
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={UserPlus}
          onClick={() => setCustomerModalOpen(true)}
          className="font-bold shadow-sm"
        >
          Add Customer Profile
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search customers by name, phone or GSTIN..."
              icon={Search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Customers Found"
            description="Create customer profiles to enable retail billing and credit tracking."
            actionLabel="Add Customer"
            onAction={() => setCustomerModalOpen(true)}
          />
        ) : (
          <Table
            headers={[
              'Customer Name',
              'Mobile Contact',
              'City / State',
              'GSTIN',
              { label: 'Current Balance (Due)', align: 'right' },
              { label: 'Status', align: 'center' },
              { label: 'Action', align: 'right' }
            ]}
          >
            {customers.map((c) => (
              <TableRow key={c._id}>
                <TableCell className="font-bold text-surface-900">
                  {c.name}
                </TableCell>
                <TableCell className="text-surface-700 font-medium">
                  📞 {c.mobile}
                </TableCell>
                <TableCell className="text-surface-500">
                  {c.address?.city || 'Mumbai'}, {c.address?.state || 'MH'}
                </TableCell>
                <TableCell className="font-mono text-surface-600">
                  {c.gstin || '-'}
                </TableCell>
                <TableCell
                  align="right"
                  className={`font-bold ${
                    c.currentBalance > 0 ? 'text-amber-600' : 'text-emerald-700'
                  }`}
                >
                  {formatCurrency(c.currentBalance)}
                </TableCell>
                <TableCell align="center">
                  <Badge variant={c.isActive !== false ? 'success' : 'default'} size="sm">
                    {c.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>
                </TableCell>
                <TableCell align="right">
                  <button
                    type="button"
                    title="View Profile & Ledger"
                    onClick={() => navigate(`/customers/${c._id}`)}
                    className="p-1.5 rounded-lg text-surface-500 hover:text-gold-700 hover:bg-gold-50 transition-colors"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </div>

      <CustomerSelectModal
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
      />
    </div>
  );
};
