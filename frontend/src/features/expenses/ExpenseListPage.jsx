import React, { useState } from 'react';
import { ArrowDownCircle, Plus, Search, Trash2 } from 'lucide-react';
import {
  useGetExpensesQuery,
  useCreateExpenseMutation,
  useDeleteExpenseMutation,
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
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toast } from 'sonner';

export const ExpenseListPage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: expenseData, isLoading } = useGetExpensesQuery();
  const { data: dashToday } = useGetDashboardQuery({ filter: 'today' });
  const { data: dashMonth } = useGetDashboardQuery({ filter: 'month' });

  const [createExpense, { isLoading: isCreating }] = useCreateExpenseMutation();
  const [deleteExpense] = useDeleteExpenseMutation();

  const expenses = expenseData?.data || [];
  const todayExpense = dashToday?.data?.financials?.totalExpenses || 0;
  const monthExpense = dashMonth?.data?.financials?.totalExpenses || 0;

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('UTILITIES');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !amount || parseFloat(amount) <= 0) {
      toast.error('Title and positive amount are required');
      return;
    }

    try {
      await createExpense({
        title,
        category,
        amount: parseFloat(amount),
        paymentMode,
        notes
      }).unwrap();
      toast.success('Expense recorded successfully');
      setModalOpen(false);
      setTitle('');
      setAmount('');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to record expense');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this expense record?')) {
      try {
        await deleteExpense(id).unwrap();
        toast.success('Expense deleted');
      } catch (err) {
        toast.error(err?.data?.message || 'Failed to delete expense');
      }
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-display">Store Operating Expenses</h1>
          <p className="text-xs text-surface-500 mt-1">
            Track day-to-day store operations, electricity, tea/refreshments, hallmarking fees, and overheads
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={Plus}
          onClick={() => setModalOpen(true)}
          className="font-bold shadow-sm"
        >
          Add Store Expense
        </Button>
      </div>

      {/* Expense Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Today's Operational Outflow"
          value={formatCurrency(todayExpense)}
          subtitle="Cash & Petty Register"
          variant="rose"
          icon={ArrowDownCircle}
        />
        <StatCard
          title="Monthly Cumulative Expenses"
          value={formatCurrency(monthExpense)}
          subtitle="Current Month Total"
          variant="default"
          icon={ArrowDownCircle}
        />
        <StatCard
          title="Expense Voucher Count"
          value={expenses.length}
          subtitle="Total recorded vouchers"
          variant="amber"
          icon={ArrowDownCircle}
        />
      </div>

      {/* Expense List Table */}
      <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-xs space-y-4">
        {isLoading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : expenses.length === 0 ? (
          <EmptyState
            icon={ArrowDownCircle}
            title="No Expenses Recorded"
            description="Log petty cash, staff refreshments, or store utility expenses."
            actionLabel="Add Expense"
            onAction={() => setModalOpen(true)}
          />
        ) : (
          <Table
            headers={[
              'Expense Item',
              'Category',
              'Date',
              'Payment Mode',
              { label: 'Amount', align: 'right' },
              { label: 'Action', align: 'right' }
            ]}
          >
            {expenses.map((exp) => (
              <TableRow key={exp._id}>
                <TableCell className="font-bold text-surface-900">
                  {exp.title}
                </TableCell>
                <TableCell>
                  <Badge variant="default" size="sm">
                    {exp.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-surface-500">
                  {formatDate(exp.expenseDate || exp.createdAt)}
                </TableCell>
                <TableCell className="font-semibold text-surface-700">
                  {exp.paymentMode || 'CASH'}
                </TableCell>
                <TableCell align="right" className="font-black text-rose-600 font-display">
                  {formatCurrency(exp.amount)}
                </TableCell>
                <TableCell align="right">
                  <button
                    type="button"
                    onClick={() => handleDelete(exp._id)}
                    className="p-1.5 rounded-lg text-surface-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </div>

      {/* Add Expense Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Operating Expense Voucher"
        subtitle="Deducts from cashier register and adds to monthly profit/loss accounting"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <Input
            label="Expense Description *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. BIS Hallmarking Bureau Testing Charges"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase text-surface-600">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-surface-300 p-2 font-semibold bg-white"
              >
                <option value="UTILITIES">Electricity & Store Utilities</option>
                <option value="HALLMARKING">BIS Hallmarking & Assay Fees</option>
                <option value="REFRESHMENTS">Client Hospitality & Tea</option>
                <option value="MAINTENANCE">Store Cleaning & Security</option>
                <option value="SALARY_ADVANCE">Staff Salary Advance</option>
                <option value="OTHER">Other Operational Expense</option>
              </select>
            </div>

            <Input
              label="Amount (₹) *"
              type="number"
              placeholder="e.g. 1500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase text-surface-600">Paid Through</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-surface-300 p-2 font-semibold bg-white"
              >
                <option value="CASH">Counter Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Account</option>
              </select>
            </div>

            <Input
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Voucher reference / paid to"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isCreating}>
              Save Expense Voucher
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
