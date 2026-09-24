import React, { useState } from 'react';
import { Truck, Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useGetVendorsQuery, useCreatePurchaseMutation } from '../../app/api/baseApi';
import { formatCurrency, formatWeight } from '../../utils/formatters';
import { toast } from 'sonner';

export const PurchaseEntryModal = ({ isOpen, onClose }) => {
  const { data: vendorData } = useGetVendorsQuery();
  const [createPurchase, { isLoading }] = useCreatePurchaseMutation();

  const vendors = vendorData?.data || [];

  const [vendorId, setVendorId] = useState('');
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('');
  const [paymentMode, setPaymentMode] = useState('BANK_TRANSFER');
  const [paidAmount, setPaidAmount] = useState('0');
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState([
    {
      productName: 'Raw Gold Bullion Bar 24K',
      metal: 'GOLD',
      purity: '24K',
      grossWeight: 50.0,
      stoneWeight: 0,
      quantity: 1,
      rate: 7800,
      makingAmount: 0,
      otherCharges: 0,
      taxAmount: 0
    }
  ]);

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        productName: '22K Gold Jewellery Lot',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: 20.0,
        stoneWeight: 0,
        quantity: 1,
        rate: 7150,
        makingAmount: 3000,
        otherCharges: 0,
        taxAmount: 0
      }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((acc, item) => {
    const netWeight = Math.max(0, (parseFloat(item.grossWeight) || 0) - (parseFloat(item.stoneWeight) || 0));
    const metalVal = netWeight * (parseFloat(item.rate) || 0);
    const making = (parseFloat(item.makingAmount) || 0);
    const other = (parseFloat(item.otherCharges) || 0);
    return acc + (metalVal + making + other) * (parseInt(item.quantity) || 1);
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const selectedVendorId = vendorId || (vendors[0]?._id);
    if (!selectedVendorId) {
      toast.error('Please select a wholesale vendor');
      return;
    }

    try {
      const payload = {
        vendorId: selectedVendorId,
        vendorInvoiceNo: vendorInvoiceNo || undefined,
        purchaseDate: new Date(),
        items: items.map((i) => ({
          productName: i.productName,
          metal: i.metal,
          purity: i.purity,
          grossWeight: parseFloat(i.grossWeight),
          stoneWeight: parseFloat(i.stoneWeight) || 0,
          quantity: parseInt(i.quantity) || 1,
          rate: parseFloat(i.rate),
          makingAmount: parseFloat(i.makingAmount) || 0,
          otherCharges: parseFloat(i.otherCharges) || 0,
          taxAmount: parseFloat(i.taxAmount) || 0
        })),
        taxAmount: 0,
        paidAmount: parseFloat(paidAmount) || 0,
        paymentMode,
        notes
      };

      const res = await createPurchase(payload).unwrap();
      toast.success(`Purchase ${res.data?.purchaseNo} recorded successfully!`);
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to record purchase entry');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Wholesale Bullion / Jewellery Purchase"
      subtitle="Adds physical metal stock to warehouse inventory and credits vendor payable ledger"
      maxWidth="max-w-4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Vendor and Invoice Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-surface-50 rounded-xl border border-surface-200">
          <div>
            <label className="text-[11px] font-bold uppercase text-surface-600">Wholesale Vendor *</label>
            <select
              value={vendorId || (vendors[0]?._id || '')}
              onChange={(e) => setVendorId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-surface-300 bg-white p-2 text-xs font-semibold"
              required
            >
              {vendors.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.name} ({v.company || 'Wholesaler'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Input
              label="Vendor Invoice / Chalan No"
              placeholder="e.g. SURAT-INV-992"
              value={vendorInvoiceNo}
              onChange={(e) => setVendorInvoiceNo(e.target.value)}
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase text-surface-600">Payment Mode</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-surface-300 bg-white p-2 text-xs font-semibold"
            >
              <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
            </select>
          </div>
        </div>

        {/* Purchase Items List */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold uppercase tracking-wider text-surface-600">
              Purchased Items / Stock Lots
            </span>
            <Button size="sm" variant="outline" icon={Plus} onClick={handleAddItem} type="button">
              Add Row
            </Button>
          </div>

          <div className="overflow-x-auto border border-surface-200 rounded-xl">
            <table className="w-full text-left">
              <thead className="bg-surface-50 text-[10px] font-bold uppercase text-surface-600 border-b border-surface-200">
                <tr>
                  <th className="p-2">Item Description</th>
                  <th className="p-2">Metal</th>
                  <th className="p-2">Purity</th>
                  <th className="p-2">Gross Wt (g)</th>
                  <th className="p-2">Rate (₹/g)</th>
                  <th className="p-2">Making (₹)</th>
                  <th className="p-2 text-right">Line Total</th>
                  <th className="p-2 text-center">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 bg-white">
                {items.map((item, idx) => {
                  const netWeight = Math.max(0, (parseFloat(item.grossWeight) || 0) - (parseFloat(item.stoneWeight) || 0));
                  const total = (netWeight * (parseFloat(item.rate) || 0) + (parseFloat(item.makingAmount) || 0)) * (parseInt(item.quantity) || 1);

                  return (
                    <tr key={idx}>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.productName}
                          onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                          className="w-full font-bold border-b border-surface-200 focus:outline-none"
                          required
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={item.metal}
                          onChange={(e) => handleItemChange(idx, 'metal', e.target.value)}
                          className="border border-surface-200 rounded p-1"
                        >
                          <option value="GOLD">GOLD</option>
                          <option value="SILVER">SILVER</option>
                          <option value="PLATINUM">PLATINUM</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          value={item.purity}
                          onChange={(e) => handleItemChange(idx, 'purity', e.target.value)}
                          className="border border-surface-200 rounded p-1"
                        >
                          <option value="24K">24K</option>
                          <option value="22K">22K</option>
                          <option value="18K">18K</option>
                          <option value="999">999</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.001"
                          value={item.grossWeight}
                          onChange={(e) => handleItemChange(idx, 'grossWeight', e.target.value)}
                          className="w-20 border border-surface-200 rounded p-1 text-right font-semibold"
                          required
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                          className="w-20 border border-surface-200 rounded p-1 text-right font-semibold"
                          required
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={item.makingAmount}
                          onChange={(e) => handleItemChange(idx, 'makingAmount', e.target.value)}
                          className="w-16 border border-surface-200 rounded p-1 text-right"
                        />
                      </td>
                      <td className="p-2 text-right font-bold text-surface-900">
                        {formatCurrency(total)}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-surface-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Settlement Breakdown */}
        <div className="flex justify-between items-center p-3 bg-gold-50/70 rounded-xl border border-gold-200">
          <div>
            <span className="text-surface-600">Total Purchase Valuation:</span>
            <span className="text-lg font-black text-surface-900 ml-2 font-display">
              {formatCurrency(subtotal)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-semibold text-surface-700">Initial Paid Amount:</span>
            <input
              type="number"
              placeholder="₹0"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className="w-28 rounded-lg border border-surface-300 p-1.5 text-right font-bold"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
          <Button variant="outline" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isLoading} icon={Truck}>
            Save Purchase & Update Inventory
          </Button>
        </div>
      </form>
    </Modal>
  );
};
