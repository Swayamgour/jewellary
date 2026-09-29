import React, { useState } from 'react';
import { Search, Plus, Package } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useGetInventoryQuery } from '../../app/api/baseApi';
import { formatWeight } from '../../utils/formatters';

/**
 * Pick a piece from physical stock. The bill is always built from a stock record: the backend takes
 * weights, metal, purity and cost from it (never from what the browser sends).
 */
export const ItemSearchModal = ({ isOpen, onClose, onSelectItem, cartBarcodes = [] }) => {
  const [search, setSearch] = useState('');
  const { data, isFetching } = useGetInventoryQuery(
    { search: search || undefined, status: 'AVAILABLE', limit: 40 },
    { skip: !isOpen }
  );
  const items = (data?.data || []).filter((i) => i.quantity > 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Item from Stock"
      subtitle="Only pieces that are physically available in this branch can be billed"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4">
        <Input
          placeholder="Filter by barcode or location..."
          icon={Search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        <h4 className="text-xs font-bold uppercase tracking-wider text-surface-500 flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-gold-600" /> Available stock ({items.length})
        </h4>

        <div className="max-h-96 overflow-y-auto divide-y divide-surface-100 border border-surface-200 rounded-xl bg-white">
          {items.map((inv) => {
            const inCart = cartBarcodes.includes(inv.barcode);
            return (
              <div key={inv._id} className="flex items-center justify-between p-3 hover:bg-gold-50/50 transition-colors text-xs">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-surface-900 bg-surface-100 px-1.5 py-0.5 rounded">{inv.barcode}</span>
                    <span className="font-semibold text-surface-800">{inv.productId?.name || 'Jewellery item'}</span>
                    <span className="text-[10px] bg-gold-50 text-gold-800 font-bold px-1.5 rounded border border-gold-200">
                      {inv.metal} {inv.purity}
                    </span>
                    {inCart && <span className="text-[10px] font-bold text-emerald-700">in bill</span>}
                  </div>
                  <div className="text-[11px] text-surface-500 mt-1 flex flex-wrap gap-x-3">
                    <span>Qty: <strong className="text-surface-800">{inv.quantity}</strong></span>
                    <span>Gross/pc: {formatWeight(inv.grossWeight)}</span>
                    <span>Net/pc: {formatWeight(inv.netWeight)}</span>
                    <span>Total net: {formatWeight(inv.netWeight * inv.quantity)}</span>
                    <span>{inv.warehouseLocation || 'Display'}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="goldSoft"
                  icon={Plus}
                  onClick={() => {
                    onSelectItem(inv);
                    onClose();
                  }}
                >
                  Add
                </Button>
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="text-center py-8 text-xs text-surface-400">
              {isFetching ? 'Loading stock...' : 'No available stock matches. Record a purchase to add stock.'}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
