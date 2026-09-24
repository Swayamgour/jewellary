import React, { useState } from 'react';
import { Search, Plus, Package } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useGetInventoryQuery, useGetProductsQuery } from '../../app/api/baseApi';
import { formatCurrency, formatWeight } from '../../utils/formatters';

export const ItemSearchModal = ({ isOpen, onClose, onSelectItem, activeGoldRate = 7195 }) => {
  const [search, setSearch] = useState('');
  const { data: invData, isLoading: invLoading } = useGetInventoryQuery({ search, status: 'AVAILABLE' });
  const { data: prodData } = useGetProductsQuery({ search });

  const inventoryItems = invData?.data || [];
  const masterProducts = prodData?.data || [];

  const handlePickInventory = (inv) => {
    const item = {
      productId: inv.productId?._id || inv.productId,
      barcode: inv.barcode || '',
      productName: inv.productId?.name || 'Jewellery Item',
      category: inv.categoryId?.name || inv.metal,
      hsnCode: '7113',
      metal: inv.metal || 'GOLD',
      purity: inv.purity || '22K',
      grossWeight: inv.grossWeight || 0,
      stoneWeight: inv.stoneWeight || 0,
      quantity: 1,
      goldRate: activeGoldRate,
      makingType: inv.makingType || 'PER_GRAM',
      makingRate: inv.makingRate || 450,
      wastagePercent: inv.wastagePercent || 3.0,
      stoneAmount: inv.stoneAmount || 0,
      discount: 0
    };
    onSelectItem(item);
    onClose();
  };

  const handlePickProduct = (prod) => {
    const item = {
      productId: prod._id,
      barcode: '',
      productName: prod.name,
      category: prod.categoryId?.name || 'Gold',
      hsnCode: '7113',
      metal: prod.metal || 'GOLD',
      purity: prod.purity || '22K',
      grossWeight: prod.standardGrossWeight || 5.0,
      stoneWeight: prod.standardStoneWeight || 0,
      quantity: 1,
      goldRate: activeGoldRate,
      makingType: prod.makingType || 'PER_GRAM',
      makingRate: prod.makingRate || 450,
      wastagePercent: prod.wastagePercent || 3.0,
      stoneAmount: 0,
      discount: 0
    };
    onSelectItem(item);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Item from Inventory / Catalog"
      subtitle="Select a tagged inventory piece with barcode or create a standard catalogue item"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4">
        <Input
          placeholder="Filter by barcode (e.g. JWL-2609-BAN001) or product name..."
          icon={Search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        {/* Section 1: Ready Tagged Inventory (Unique Barcodes) */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-500 mb-2 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-gold-600" /> Available Physical Stock Items
          </h4>
          <div className="max-h-56 overflow-y-auto divide-y divide-surface-100 border border-surface-200 rounded-xl bg-white">
            {inventoryItems.map((inv) => (
              <div
                key={inv._id}
                className="flex items-center justify-between p-3 hover:bg-gold-50/50 transition-colors text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-surface-900 bg-surface-100 px-1.5 py-0.5 rounded">
                      {inv.barcode}
                    </span>
                    <span className="font-semibold text-surface-800">{inv.productId?.name}</span>
                    <span className="text-[10px] bg-gold-50 text-gold-800 font-bold px-1.5 py-0.2 rounded border border-gold-200">
                      {inv.purity}
                    </span>
                  </div>
                  <div className="text-[11px] text-surface-500 mt-1 flex gap-3">
                    <span>Gross: {formatWeight(inv.grossWeight)}</span>
                    <span>Net: {formatWeight(inv.netWeight)}</span>
                    <span>Location: {inv.warehouseLocation || 'Display'}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="goldSoft"
                  icon={Plus}
                  onClick={() => handlePickInventory(inv)}
                >
                  Add to Bill
                </Button>
              </div>
            ))}
            {inventoryItems.length === 0 && (
              <div className="text-center py-4 text-xs text-surface-400">
                {invLoading ? 'Loading items...' : 'No available stock matching query'}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Master Design Templates */}
        <div className="pt-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-500 mb-2">
            Master Jewellery Designs / Custom Specs
          </h4>
          <div className="max-h-44 overflow-y-auto divide-y divide-surface-100 border border-surface-200 rounded-xl bg-white">
            {masterProducts.map((prod) => (
              <div
                key={prod._id}
                className="flex items-center justify-between p-3 hover:bg-surface-50 transition-colors text-xs"
              >
                <div>
                  <span className="font-bold text-surface-900">{prod.name}</span>
                  <span className="text-surface-500 ml-2 font-mono text-[11px]">({prod.code})</span>
                  <p className="text-[11px] text-surface-500 mt-0.5">
                    Std Wt: {formatWeight(prod.standardNetWeight)} · {prod.purity}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  icon={Plus}
                  onClick={() => handlePickProduct(prod)}
                >
                  Select Spec
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
