import React, { useState } from 'react';
import {
  Package,
  Search,
  Plus,
  RefreshCw,
  ArrowRightLeft,
  SlidersHorizontal,
  History,
  Tag
} from 'lucide-react';
import {
  useGetInventoryQuery,
  useGetStockMovementsQuery,
  useStockAdjustmentMutation,
  useStockTransferMutation,
  useGetBranchesQuery
} from '../../app/api/baseApi';
import { Table, TableRow, TableCell } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency, formatWeight, formatDateTime } from '../../utils/formatters';
import { toast } from 'sonner';

export const InventoryListPage = () => {
  const [activeTab, setActiveTab] = useState('STOCK');
  const [search, setSearch] = useState('');
  const [metalFilter, setMetalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedItemForAction, setSelectedItemForAction] = useState(null);

  // Queries
  const { data: invData, isLoading: invLoading } = useGetInventoryQuery({
    search,
    metal: metalFilter || undefined,
    status: statusFilter || undefined
  });
  const { data: moveData, isLoading: moveLoading } = useGetStockMovementsQuery();
  const { data: branchData } = useGetBranchesQuery();

  const [stockAdjustment, { isLoading: isAdjusting }] = useStockAdjustmentMutation();
  const [stockTransfer, { isLoading: isTransferring }] = useStockTransferMutation();

  const inventory = invData?.data || [];
  const movements = moveData?.data || [];
  const branches = branchData?.data || [];

  // Metrics summary
  const totalGoldWeight = inventory
    .filter((i) => i.metal === 'GOLD' && i.status === 'AVAILABLE')
    .reduce((acc, i) => acc + (i.netWeight || 0), 0);

  const totalSilverWeight = inventory
    .filter((i) => i.metal === 'SILVER' && i.status === 'AVAILABLE')
    .reduce((acc, i) => acc + (i.netWeight || 0), 0);

  const totalValuation = inventory
    .filter((i) => i.status === 'AVAILABLE')
    .reduce((acc, i) => acc + (i.costPrice || 0) * (i.quantity || 1), 0);

  const availableItemsCount = inventory.filter((i) => i.status === 'AVAILABLE').length;

  // Adjustment Form State
  const [adjType, setAdjType] = useState('ADJUSTMENT_IN');
  const [adjQty, setAdjQty] = useState(1);
  const [adjReason, setAdjReason] = useState('Physical audit recount');

  const handleAdjustmentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItemForAction) return;
    try {
      await stockAdjustment({
        inventoryId: selectedItemForAction._id,
        movementType: adjType,
        quantity: parseInt(adjQty),
        reason: adjReason
      }).unwrap();
      toast.success('Stock adjustment processed successfully');
      setAdjustmentModalOpen(false);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to process adjustment');
    }
  };

  // Transfer Form State
  const [targetBranchId, setTargetBranchId] = useState('');
  const [transferNotes, setTransferNotes] = useState('Display transfer to branch');

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItemForAction || !targetBranchId) {
      toast.error('Please select destination branch');
      return;
    }
    try {
      await stockTransfer({
        inventoryId: selectedItemForAction._id,
        toBranchId: targetBranchId,
        notes: transferNotes
      }).unwrap();
      toast.success('Stock transfer recorded successfully');
      setTransferModalOpen(false);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to transfer item');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-display">Inventory & Bullion Vault</h1>
          <p className="text-xs text-surface-500 mt-1">
            Barcode tracking, metal weight accounting, movements log, and multi-branch transfers
          </p>
        </div>
      </div>

      {/* Vault Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Gold Stock on Hand"
          value={formatWeight(totalGoldWeight)}
          subtitle="Available 24K, 22K & 18K"
          variant="gold"
          icon={Package}
        />
        <StatCard
          title="Silver Stock"
          value={formatWeight(totalSilverWeight)}
          subtitle="Articles, Utensils & Coins"
          variant="default"
          icon={Package}
        />
        <StatCard
          title="Vault Cost Valuation"
          value={formatCurrency(totalValuation)}
          subtitle="Purchase Cost Price Basis"
          variant="emerald"
          icon={Tag}
        />
        <StatCard
          title="Ready Jewellery Items"
          value={availableItemsCount}
          subtitle="Tagged with Barcodes"
          variant="amber"
          icon={Package}
        />
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-xs space-y-4">
        <Tabs
          tabs={[
            { id: 'STOCK', label: 'Physical Stock & Barcodes', count: inventory.length },
            { id: 'MOVEMENTS', label: 'Stock Movements Audit', count: movements.length }
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === 'STOCK' ? (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 w-full max-w-md">
                <Input
                  placeholder="Scan / Search by Barcode (e.g. JWL-2609-BAN001)..."
                  icon={Search}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={metalFilter}
                  onChange={(e) => setMetalFilter(e.target.value)}
                  className="rounded-lg border border-surface-300 p-2 text-xs font-semibold bg-white"
                >
                  <option value="">All Metals</option>
                  <option value="GOLD">Gold</option>
                  <option value="SILVER">Silver</option>
                  <option value="PLATINUM">Platinum</option>
                  <option value="DIAMOND">Diamond</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-surface-300 p-2 text-xs font-semibold bg-white"
                >
                  <option value="">All Statuses</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="SOLD">Sold</option>
                  <option value="RESERVED">Reserved</option>
                  <option value="DAMAGED">Damaged</option>
                </select>
              </div>
            </div>

            {/* Inventory Table */}
            {invLoading ? (
              <TableSkeleton rows={6} cols={10} />
            ) : inventory.length === 0 ? (
              <EmptyState
                title="No Stock Items Found"
                description="No items match your active search or filters."
              />
            ) : (
              <Table
                headers={[
                  'Barcode',
                  'Product Description',
                  'Metal',
                  'Purity',
                  { label: 'Gross Wt', align: 'right' },
                  { label: 'Net Wt', align: 'right' },
                  { label: 'Qty', align: 'center' },
                  'Location',
                  { label: 'Status', align: 'center' },
                  { label: 'Action', align: 'right' }
                ]}
              >
                {inventory.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell className="font-mono font-bold text-surface-900">
                      🏷️ {item.barcode}
                    </TableCell>
                    <TableCell className="font-semibold text-surface-800">
                      {item.productId?.name || 'Jewellery Item'}
                    </TableCell>
                    <TableCell>{item.metal}</TableCell>
                    <TableCell className="font-bold text-gold-800">{item.purity}</TableCell>
                    <TableCell align="right">{formatWeight(item.grossWeight)}</TableCell>
                    <TableCell align="right" className="font-bold text-surface-800">
                      {formatWeight(item.netWeight)}
                    </TableCell>
                    <TableCell align="center" className="font-semibold">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-surface-500">
                      {item.warehouseLocation || 'Display Counter'}
                    </TableCell>
                    <TableCell align="center">
                      <Badge
                        variant={
                          item.status === 'AVAILABLE'
                            ? 'success'
                            : item.status === 'SOLD'
                            ? 'default'
                            : 'warning'
                        }
                        size="sm"
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell align="right">
                      {item.status === 'AVAILABLE' && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Adjust Stock"
                            onClick={() => {
                              setSelectedItemForAction(item);
                              setAdjustmentModalOpen(true);
                            }}
                            className="p-1 rounded text-surface-400 hover:text-surface-700 hover:bg-surface-100"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Branch Transfer"
                            onClick={() => {
                              setSelectedItemForAction(item);
                              setTransferModalOpen(true);
                            }}
                            className="p-1 rounded text-surface-400 hover:text-gold-700 hover:bg-gold-50"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            )}
          </>
        ) : (
          /* Stock Movements Audit Tab */
          <div>
            {moveLoading ? (
              <TableSkeleton rows={6} cols={6} />
            ) : movements.length === 0 ? (
              <EmptyState
                icon={History}
                title="No Stock Movements Logged"
                description="Movements will automatically record as items are sold, purchased, or transferred."
              />
            ) : (
              <Table
                headers={[
                  'Movement Type',
                  'Barcode / Item',
                  { label: 'Weight Impact', align: 'right' },
                  'Source / Destination',
                  'Timestamp',
                  'Reason / Remarks'
                ]}
              >
                {movements.map((move) => {
                  const isPlus = ['PURCHASE', 'SALE_RETURN', 'EXCHANGE_IN', 'ADJUSTMENT_IN'].includes(
                    move.movementType
                  );
                  return (
                    <TableRow key={move._id}>
                      <TableCell>
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            isPlus
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {move.movementType}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-surface-900">
                        {move.barcode || 'Bulk Lot'}
                      </TableCell>
                      <TableCell
                        align="right"
                        className={`font-bold ${isPlus ? 'text-emerald-700' : 'text-rose-600'}`}
                      >
                        {isPlus ? '+' : '-'}
                        {formatWeight(move.weight || 0)}
                      </TableCell>
                      <TableCell className="text-surface-600">
                        {move.branchId?.name || 'Main Branch'}
                      </TableCell>
                      <TableCell className="text-surface-500">
                        {formatDateTime(move.createdAt)}
                      </TableCell>
                      <TableCell className="text-surface-500">
                        {move.reason || move.remarks || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Table>
            )}
          </div>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      {selectedItemForAction && (
        <Modal
          isOpen={adjustmentModalOpen}
          onClose={() => setAdjustmentModalOpen(false)}
          title={`Adjust Stock — ${selectedItemForAction.barcode}`}
          subtitle="Audit adjustment for physical variance or damaged piece"
        >
          <form onSubmit={handleAdjustmentSubmit} className="space-y-4 text-xs">
            <div className="p-3 bg-surface-50 rounded-xl border border-surface-200">
              <p className="font-bold text-surface-900">{selectedItemForAction.productId?.name}</p>
              <p className="text-surface-500">
                Current Stock: {selectedItemForAction.quantity} | Net Wt: {formatWeight(selectedItemForAction.netWeight)}
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-surface-600">Adjustment Type</label>
              <select
                value={adjType}
                onChange={(e) => setAdjType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-surface-300 p-2 font-semibold"
              >
                <option value="ADJUSTMENT_IN">ADJUSTMENT IN (+ Stock)</option>
                <option value="ADJUSTMENT_OUT">ADJUSTMENT OUT (- Stock)</option>
                <option value="DAMAGE">DAMAGE (- Stock)</option>
                <option value="LOSS">LOSS (- Stock)</option>
              </select>
            </div>

            <Input
              label="Quantity"
              type="number"
              value={adjQty}
              onChange={(e) => setAdjQty(e.target.value)}
              min="1"
              required
            />

            <Input
              label="Reason for Audit Adjustment"
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
              required
            />

            <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
              <Button variant="outline" type="button" onClick={() => setAdjustmentModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={isAdjusting}>
                Commit Adjustment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Branch Transfer Modal */}
      {selectedItemForAction && (
        <Modal
          isOpen={transferModalOpen}
          onClose={() => setTransferModalOpen(false)}
          title={`Transfer Stock — ${selectedItemForAction.barcode}`}
          subtitle="Move inventory item to another branch location"
        >
          <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-[11px] font-bold uppercase text-surface-600">Destination Branch *</label>
              <select
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-surface-300 p-2 font-semibold"
                required
              >
                <option value="">Select Target Branch...</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Transfer Notes"
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
            />

            <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
              <Button variant="outline" type="button" onClick={() => setTransferModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={isTransferring} icon={ArrowRightLeft}>
                Execute Branch Transfer
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
