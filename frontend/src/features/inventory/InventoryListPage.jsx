import React, { useState } from 'react';
import { Package, Search, ArrowRightLeft, SlidersHorizontal, History, Tag } from 'lucide-react';
import { useGetInventoryQuery, useGetStockMovementsQuery } from '../../app/api/baseApi';
import { Table, TableRow, TableCell } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import { StockAdjustModal, StockTransferModal } from './StockAdjustModal';
import { useDebounce } from '../../utils/useDebounce';
import { formatCurrency, formatWeight, formatDateTime } from '../../utils/formatters';

const STATUS_VARIANT = { AVAILABLE: 'success', SOLD: 'default', RESERVED: 'info', DAMAGED: 'danger', RETURNED: 'warning', CANCELLED: 'danger' };

export const InventoryListPage = () => {
  const [activeTab, setActiveTab] = useState('STOCK');
  const [searchTerm, setSearchTerm] = useState('');
  const [metalFilter, setMetalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('AVAILABLE');
  const [page, setPage] = useState(1);
  const [movePage, setMovePage] = useState(1);
  const [adjustItem, setAdjustItem] = useState(null);
  const [transferItem, setTransferItem] = useState(null);
  const search = useDebounce(searchTerm, 350);

  const { data: invData, isLoading: invLoading } = useGetInventoryQuery(
    { search: search || undefined, metal: metalFilter || undefined, status: statusFilter || undefined, page, limit: 20 },
    { skip: activeTab !== 'STOCK' }
  );
  const { data: moveData, isLoading: moveLoading } = useGetStockMovementsQuery({ page: movePage, limit: 25 }, { skip: activeTab !== 'MOVEMENTS' });
  const { data: summaryData } = useGetInventoryQuery({ status: 'AVAILABLE', limit: 500 });

  const inventory = invData?.data || [];
  const movements = moveData?.data || [];
  const allAvailable = summaryData?.data || [];

  const totalGoldWeight = allAvailable.filter((i) => i.metal === 'GOLD').reduce((a, i) => a + (i.netWeight || 0) * (i.quantity || 1), 0);
  const totalSilverWeight = allAvailable.filter((i) => i.metal === 'SILVER').reduce((a, i) => a + (i.netWeight || 0) * (i.quantity || 1), 0);
  const totalValuation = allAvailable.reduce((a, i) => a + (i.costPrice || 0) * (i.quantity || 1), 0);
  const totalPieces = allAvailable.reduce((a, i) => a + (i.quantity || 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-surface-900 font-display">Inventory & Bullion Vault</h1>
        <p className="text-xs text-surface-500 mt-1">Barcode tracking, per-piece weights, movement audit, and inter-branch transfers</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Gold Stock on Hand" value={formatWeight(totalGoldWeight)} subtitle="Available, all purities" variant="gold" icon={Package} />
        <StatCard title="Silver Stock" value={formatWeight(totalSilverWeight)} subtitle="Available" variant="default" icon={Package} />
        <StatCard title="Vault Cost Valuation" value={formatCurrency(totalValuation)} subtitle="At purchase cost" variant="emerald" icon={Tag} />
        <StatCard title="Pieces in Stock" value={totalPieces} subtitle="Across all available lots" variant="amber" icon={Package} />
      </div>

      <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-xs space-y-4">
        <Tabs tabs={[{ id: 'STOCK', label: 'Physical Stock & Barcodes' }, { id: 'MOVEMENTS', label: 'Stock Movement Audit' }]} activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'STOCK' ? (
          <>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 w-full max-w-md">
                <Input placeholder="Search by barcode or location..." icon={Search} value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select value={metalFilter} onChange={(e) => { setMetalFilter(e.target.value); setPage(1); }} className="rounded-lg border border-surface-300 p-2 text-xs font-semibold bg-white">
                  <option value="">All Metals</option>
                  <option value="GOLD">Gold</option><option value="SILVER">Silver</option><option value="PLATINUM">Platinum</option><option value="DIAMOND">Diamond</option>
                </select>
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="rounded-lg border border-surface-300 p-2 text-xs font-semibold bg-white">
                  <option value="">All Statuses</option>
                  <option value="AVAILABLE">Available</option><option value="SOLD">Sold</option><option value="DAMAGED">Damaged</option><option value="RETURNED">Returned</option><option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>

            {invLoading ? <TableSkeleton rows={6} cols={9} /> : inventory.length === 0 ? (
              <EmptyState icon={Package} title="No Stock Items Found" description="No items match your active search or filters." />
            ) : (
              <>
                <Table headers={['Barcode', 'Product', 'Metal/Purity', { label: 'Qty', align: 'center' }, { label: 'Net Wt (per pc)', align: 'right' }, { label: 'Net Wt (total)', align: 'right' }, { label: 'Cost (total)', align: 'right' }, { label: 'Status', align: 'center' }, { label: 'Actions', align: 'right' }]}>
                  {inventory.map((item) => (
                    <TableRow key={item._id}>
                      <TableCell className="font-mono font-bold text-surface-900">{item.barcode}</TableCell>
                      <TableCell>
                        <p className="font-semibold text-surface-800">{item.productId?.name || 'Item'}</p>
                        <span className="text-[10px] text-surface-400">{item.warehouseLocation}</span>
                      </TableCell>
                      <TableCell><Badge variant="gold" size="sm">{item.metal} {item.purity}</Badge></TableCell>
                      <TableCell align="center" className="font-bold">{item.quantity}</TableCell>
                      <TableCell align="right" className="text-surface-600">{formatWeight(item.netWeight)}</TableCell>
                      <TableCell align="right" className="font-bold text-surface-900">{formatWeight((item.netWeight || 0) * (item.quantity || 1))}</TableCell>
                      <TableCell align="right" className="font-semibold">{formatCurrency((item.costPrice || 0) * (item.quantity || 1))}</TableCell>
                      <TableCell align="center"><Badge variant={STATUS_VARIANT[item.status] || 'default'} size="sm">{item.status}</Badge></TableCell>
                      <TableCell align="right">
                        <div className="flex justify-end gap-1.5">
                          <button type="button" title="Adjust stock" disabled={item.status !== 'AVAILABLE'} onClick={() => setAdjustItem(item)} className="p-1.5 rounded-lg text-surface-500 hover:text-gold-700 hover:bg-gold-50 disabled:opacity-30"><SlidersHorizontal className="w-4 h-4" /></button>
                          <button type="button" title="Transfer branch" disabled={item.status !== 'AVAILABLE'} onClick={() => setTransferItem(item)} className="p-1.5 rounded-lg text-surface-500 hover:text-sky-700 hover:bg-sky-50 disabled:opacity-30"><ArrowRightLeft className="w-4 h-4" /></button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </Table>
                <Pagination pagination={invData?.pagination} onPage={setPage} />
              </>
            )}
          </>
        ) : moveLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : movements.length === 0 ? (
          <EmptyState icon={History} title="No Movements" description="Every stock in/out is logged here." />
        ) : (
          <>
            <Table headers={['Date', 'Barcode', 'Type', { label: 'Qty Δ', align: 'center' }, { label: 'Weight Δ', align: 'right' }, { label: 'Balance', align: 'right' }, 'Reason']}>
              {movements.map((m) => (
                <TableRow key={m._id}>
                  <TableCell className="text-surface-500 whitespace-nowrap">{formatDateTime(m.createdAt)}</TableCell>
                  <TableCell className="font-mono font-bold">{m.barcode}</TableCell>
                  <TableCell><Badge variant={m.quantityDelta >= 0 ? 'success' : 'danger'} size="sm">{m.movementType.replace('_', ' ')}</Badge></TableCell>
                  <TableCell align="center" className={`font-bold ${m.quantityDelta >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{m.quantityDelta > 0 ? '+' : ''}{m.quantityDelta}</TableCell>
                  <TableCell align="right" className={m.weightDelta >= 0 ? 'text-emerald-700' : 'text-red-600'}>{m.weightDelta > 0 ? '+' : ''}{formatWeight(m.weightDelta)}</TableCell>
                  <TableCell align="right" className="font-semibold">{m.balanceQuantity} pc · {formatWeight(m.balanceWeight)}</TableCell>
                  <TableCell className="text-surface-500 max-w-[200px] truncate">{m.reason}</TableCell>
                </TableRow>
              ))}
            </Table>
            <Pagination pagination={moveData?.pagination} onPage={setMovePage} />
          </>
        )}
      </div>

      <StockAdjustModal isOpen={Boolean(adjustItem)} onClose={() => setAdjustItem(null)} item={adjustItem} />
      <StockTransferModal isOpen={Boolean(transferItem)} onClose={() => setTransferItem(null)} item={transferItem} />
    </div>
  );
};
