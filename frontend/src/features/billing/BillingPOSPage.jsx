import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  FileCheck,
  Search,
  Plus,
  Trash2,
  UserPlus,
  CreditCard,
  Coins,
  CheckCircle,
  Printer,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Percent,
  RefreshCw
} from 'lucide-react';
import {
  useGetCustomersQuery,
  useGetCurrentGoldRatesQuery,
  useGetInventoryQuery,
  useCreateKachaBillMutation,
  useCreatePakkaBillMutation
} from '../../app/api/baseApi';
import { calculateInvoiceTotals, calculateItemPrice } from '../../utils/calculations';
import { formatCurrency, formatWeight } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { CustomerSelectModal } from './CustomerSelectModal';
import { ItemSearchModal } from './ItemSearchModal';
import { toast } from 'sonner';

export const BillingPOSPage = () => {
  const navigate = useNavigate();

  // Mode: KACHA or PAKKA
  const [billType, setBillType] = useState('KACHA');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [extraDiscount, setExtraDiscount] = useState(0);
  const [notes, setNotes] = useState('');

  // Modals
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [itemSearchModalOpen, setItemSearchModalOpen] = useState(false);

  // Barcode quick scan state
  const [barcodeInput, setBarcodeInput] = useState('');

  // API Queries & Mutations
  const { data: customersData } = useGetCustomersQuery({ search: customerSearch });
  const { data: goldRatesData } = useGetCurrentGoldRatesQuery();
  const { data: inventoryData } = useGetInventoryQuery({ barcode: barcodeInput, status: 'AVAILABLE' }, { skip: !barcodeInput || barcodeInput.length < 3 });
  const [createKachaBill, { isLoading: isCreatingKacha }] = useCreateKachaBillMutation();
  const [createPakkaBill, { isLoading: isCreatingPakka }] = useCreatePakkaBillMutation();

  const isSaving = isCreatingKacha || isCreatingPakka;

  // Active Gold Rates
  const goldRates = goldRatesData?.data || [];
  const rate22K = goldRates.find((r) => r.metal === 'GOLD' && r.purity === '22K')?.rate || 7195;
  const rate24K = goldRates.find((r) => r.metal === 'GOLD' && r.purity === '24K')?.rate || 7850;

  // Billing Line Items
  const [items, setItems] = useState([
    {
      id: 'default-1',
      productId: '66f123456789abcdef012345', // standard default
      barcode: '',
      productName: '22K Gold Jewellery Item',
      category: 'Gold',
      hsnCode: '7113',
      metal: 'GOLD',
      purity: '22K',
      grossWeight: 5.25,
      stoneWeight: 0.2,
      quantity: 1,
      goldRate: rate22K,
      makingType: 'PER_GRAM',
      makingRate: 450,
      wastagePercent: 3.5,
      stoneAmount: 1200,
      discount: 0
    }
  ]);

  // Split Payments
  const [payments, setPayments] = useState({
    CASH: 0,
    UPI: 0,
    CARD: 0,
    EXCHANGE: 0,
    BANK_TRANSFER: 0
  });

  // Automatically select first customer if available & none selected
  useEffect(() => {
    if (!selectedCustomer && customersData?.data && customersData.data.length > 0) {
      setSelectedCustomer(customersData.data[0]);
    }
  }, [customersData, selectedCustomer]);

  // Set default gold rate on initial load if rate updates
  useEffect(() => {
    if (items.length === 1 && items[0].goldRate === 7195 && rate22K !== 7195) {
      setItems((prev) => prev.map((item) => ({ ...item, goldRate: rate22K })));
    }
  }, [rate22K]);

  // Real-time calculation
  const calculations = useMemo(() => {
    return calculateInvoiceTotals({
      items,
      billType,
      isInterState: false,
      extraDiscount
    });
  }, [items, billType, extraDiscount]);

  // Sum of payments
  const totalPaid = useMemo(() => {
    return Object.values(payments).reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);
  }, [payments]);

  const balanceDue = Math.max(0, calculations.grandTotal - totalPaid);

  // POS Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F2: New Bill Reset
      if (e.key === 'F2') {
        e.preventDefault();
        handleResetBill();
      }
      // F4: Add Customer
      if (e.key === 'F4') {
        e.preventDefault();
        setCustomerModalOpen(true);
      }
      // F6: Add Line Item
      if (e.key === 'F6') {
        e.preventDefault();
        setItemSearchModalOpen(true);
      }
      // F8: Auto-fill remaining due in Cash
      if (e.key === 'F8') {
        e.preventDefault();
        setPayments((prev) => ({ ...prev, CASH: calculations.grandTotal }));
        toast.info('Settled full amount in Cash');
      }
      // Ctrl + S: Save / Confirm
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleConfirmBill();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [calculations.grandTotal, items, selectedCustomer, billType]);

  // Handle line item change
  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) {
      toast.error('Bill must contain at least one item');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const handleAddItemFromModal = (newItem) => {
    // If first item is empty placeholder, replace it
    if (items.length === 1 && !items[0].barcode && items[0].grossWeight === 5.25) {
      setItems([newItem]);
    } else {
      setItems([...items, newItem]);
    }
    toast.success(`Added ${newItem.productName}`);
  };

  // Barcode scanner trigger
  const handleBarcodeScan = (e) => {
    if (e.key === 'Enter' && barcodeInput) {
      e.preventDefault();
      const matched = inventoryData?.data?.find(
        (i) => i.barcode.toLowerCase() === barcodeInput.trim().toLowerCase()
      );
      if (matched) {
        handleAddItemFromModal({
          productId: matched.productId?._id || matched.productId,
          barcode: matched.barcode,
          productName: matched.productId?.name || 'Jewellery Item',
          category: matched.categoryId?.name || matched.metal,
          hsnCode: '7113',
          metal: matched.metal || 'GOLD',
          purity: matched.purity || '22K',
          grossWeight: matched.grossWeight || 0,
          stoneWeight: matched.stoneWeight || 0,
          quantity: 1,
          goldRate: rate22K,
          makingType: matched.makingType || 'PER_GRAM',
          makingRate: matched.makingRate || 450,
          wastagePercent: matched.wastagePercent || 3.0,
          stoneAmount: matched.stoneAmount || 0,
          discount: 0
        });
        setBarcodeInput('');
      } else {
        toast.error(`Barcode "${barcodeInput}" not found in available inventory`);
      }
    }
  };

  const handleResetBill = () => {
    setItems([
      {
        id: Date.now().toString(),
        productId: '66f123456789abcdef012345',
        barcode: '',
        productName: 'Gold Ring',
        category: 'Rings',
        hsnCode: '7113',
        metal: 'GOLD',
        purity: '22K',
        grossWeight: 4.5,
        stoneWeight: 0,
        quantity: 1,
        goldRate: rate22K,
        makingType: 'PER_GRAM',
        makingRate: 450,
        wastagePercent: 3.0,
        stoneAmount: 0,
        discount: 0
      }
    ]);
    setPayments({ CASH: 0, UPI: 0, CARD: 0, EXCHANGE: 0, BANK_TRANSFER: 0 });
    setExtraDiscount(0);
    toast.info('New Bill started');
  };

  // Settle full payment in a specific mode
  const handleQuickPay = (mode) => {
    setPayments({
      CASH: 0,
      UPI: 0,
      CARD: 0,
      EXCHANGE: 0,
      BANK_TRANSFER: 0,
      [mode]: calculations.grandTotal
    });
    toast.success(`Full payment allocated to ${mode}`);
  };

  // Confirm and Submit Bill to Backend API
  const handleConfirmBill = async () => {
    if (!selectedCustomer) {
      toast.error('Please select a customer for this bill');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    // Format payload for backend createInvoiceSchema
    const formattedPayments = Object.entries(payments)
      .filter(([_, amt]) => parseFloat(amt) > 0)
      .map(([mode, amt]) => ({
        paymentMode: mode,
        amount: parseFloat(amt)
      }));

    const formattedItems = items.map((i) => ({
      productId: i.productId && i.productId.length === 24 ? i.productId : '66f123456789abcdef012345',
      barcode: i.barcode || undefined,
      productName: i.productName || 'Jewellery Item',
      category: i.category || 'Gold',
      hsnCode: i.hsnCode || '7113',
      metal: i.metal || 'GOLD',
      purity: i.purity || '22K',
      grossWeight: parseFloat(i.grossWeight) || 0.1,
      stoneWeight: parseFloat(i.stoneWeight) || 0,
      quantity: parseInt(i.quantity) || 1,
      goldRate: parseFloat(i.goldRate) || rate22K,
      makingType: i.makingType || 'PER_GRAM',
      makingRate: parseFloat(i.makingRate) || 0,
      wastagePercent: parseFloat(i.wastagePercent) || 0,
      stoneAmount: parseFloat(i.stoneAmount) || 0,
      discount: parseFloat(i.discount) || 0
    }));

    const payload = {
      customerId: selectedCustomer._id,
      items: formattedItems,
      discount: parseFloat(extraDiscount) || 0,
      payments: formattedPayments,
      notes: notes || undefined
    };

    try {
      let res;
      if (billType === 'KACHA') {
        res = await createKachaBill(payload).unwrap();
        toast.success(`Kacha Bill ${res.data?.invoiceNo} confirmed successfully!`);
      } else {
        res = await createPakkaBill(payload).unwrap();
        toast.success(`Pakka GST Invoice ${res.data?.invoiceNo} generated!`);
      }

      if (res?.data?._id) {
        navigate(`/billing/${res.data._id}`);
      }
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to generate bill. Please check item details.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top POS Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-surface-200 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center p-1 rounded-xl bg-surface-100 border border-surface-200">
            <button
              type="button"
              onClick={() => setBillType('KACHA')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                billType === 'KACHA'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-surface-600 hover:text-surface-900'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              KACHA BILL (Estimate)
            </button>
            <button
              type="button"
              onClick={() => setBillType('PAKKA')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                billType === 'PAKKA'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-surface-600 hover:text-surface-900'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              PAKKA (GST Invoice)
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-surface-500 font-mono">
            <span className="font-semibold text-surface-800">
              {billType === 'KACHA' ? 'EST-POS' : 'INV-GST'}
            </span>
            <span>·</span>
            <span>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleResetBill}>
            Reset (F2)
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={CheckCircle}
            isLoading={isSaving}
            onClick={handleConfirmBill}
            className="font-bold tracking-wide"
          >
            Confirm & Save (Ctrl+S)
          </Button>
        </div>
      </div>

      {/* Main Billing Grid: 8 cols for Items & Customer, 4 cols for Financials & Payment */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Customer & Item Lines */}
        <div className="lg:col-span-8 space-y-4">
          {/* Customer Selection Banner */}
          <div className="bg-white p-4 rounded-2xl border border-surface-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-surface-500 block mb-1">
                Selected Customer (F4)
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedCustomer?._id || ''}
                  onChange={(e) => {
                    const cust = customersData?.data?.find((c) => c._id === e.target.value);
                    if (cust) setSelectedCustomer(cust);
                  }}
                  className="w-full max-w-sm rounded-xl border border-surface-300 bg-surface-50 px-3 py-1.5 text-xs font-semibold text-surface-900 focus:outline-none focus:border-gold-500"
                >
                  {customersData?.data?.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} — 📞 {c.mobile} (Due: {formatCurrency(c.currentBalance)})
                    </option>
                  ))}
                </select>

                <Button
                  size="sm"
                  variant="goldSoft"
                  icon={UserPlus}
                  onClick={() => setCustomerModalOpen(true)}
                >
                  + Customer
                </Button>
              </div>
            </div>

            {selectedCustomer && (
              <div className="flex items-center gap-4 text-xs pt-2 sm:pt-0 sm:border-l border-surface-100 sm:pl-4">
                <div>
                  <span className="text-[10px] text-surface-400 block uppercase font-bold">State & Code</span>
                  <span className="font-semibold text-surface-800">
                    {selectedCustomer.address?.state || 'Maharashtra'} ({selectedCustomer.address?.stateCode || '27'})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-surface-400 block uppercase font-bold">Ledger Balance</span>
                  <span
                    className={`font-bold ${
                      selectedCustomer.currentBalance > 0 ? 'text-amber-600' : 'text-emerald-600'
                    }`}
                  >
                    {formatCurrency(selectedCustomer.currentBalance)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Barcode Quick Scan Bar */}
          <div className="bg-white p-3 rounded-2xl border border-surface-200 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-gold-600 shrink-0" />
              <input
                type="text"
                placeholder="Scan / Type Barcode & hit Enter (e.g. JWL-2609-BAN001)..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeScan}
                className="w-full text-xs text-surface-900 bg-transparent placeholder:text-surface-400 focus:outline-none font-mono"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              icon={Plus}
              onClick={() => setItemSearchModalOpen(true)}
            >
              Add Item (F6)
            </Button>
          </div>

          {/* Items POS Table */}
          <div className="bg-white rounded-2xl border border-surface-200 shadow-xs overflow-hidden">
            <div className="p-3 bg-surface-50 border-b border-surface-200 flex items-center justify-between text-xs">
              <span className="font-bold text-surface-800 font-display">
                Cart Items ({items.length})
              </span>
              <span className="text-[11px] text-surface-500">
                Gold Base Rate: <strong>{formatCurrency(rate22K)}/g</strong> (22K)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-50/80 text-[10px] uppercase font-bold text-surface-600 border-b border-surface-200">
                  <tr>
                    <th className="py-2.5 px-2">#</th>
                    <th className="py-2.5 px-3">Product / Barcode</th>
                    <th className="py-2.5 px-2">Purity</th>
                    <th className="py-2.5 px-2">Gross (g)</th>
                    <th className="py-2.5 px-2">Net (g)</th>
                    <th className="py-2.5 px-2">Rate (₹)</th>
                    <th className="py-2.5 px-2">Making (₹)</th>
                    <th className="py-2.5 px-2">Wast%</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-2 text-center">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {items.map((item, idx) => {
                    const calculated = calculateItemPrice(item);
                    return (
                      <tr key={item.id || idx} className="hover:bg-surface-50/50">
                        <td className="py-2 px-2 text-surface-400 font-bold">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.productName}
                            onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                            className="w-full font-bold text-surface-900 bg-transparent border-b border-dashed border-surface-300 focus:border-gold-500 focus:outline-none"
                          />
                          {item.barcode && (
                            <span className="font-mono text-[10px] text-gold-700 block">
                              🏷️ {item.barcode}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <select
                            value={item.purity}
                            onChange={(e) => handleItemChange(idx, 'purity', e.target.value)}
                            className="bg-surface-100 border border-surface-300 rounded px-1 py-0.5 text-[11px] font-bold"
                          >
                            <option value="24K">24K</option>
                            <option value="22K">22K</option>
                            <option value="18K">18K</option>
                            <option value="999">Silver</option>
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.001"
                            value={item.grossWeight}
                            onChange={(e) => handleItemChange(idx, 'grossWeight', e.target.value)}
                            className="w-16 rounded border border-surface-300 px-1.5 py-0.5 text-xs text-right font-semibold"
                          />
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-surface-700">
                          {formatWeight(calculated.netWeight)}
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            value={item.goldRate}
                            onChange={(e) => handleItemChange(idx, 'goldRate', e.target.value)}
                            className="w-20 rounded border border-surface-300 px-1.5 py-0.5 text-xs text-right font-semibold"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            value={item.makingRate}
                            onChange={(e) => handleItemChange(idx, 'makingRate', e.target.value)}
                            className="w-16 rounded border border-surface-300 px-1.5 py-0.5 text-xs text-right"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.1"
                            value={item.wastagePercent}
                            onChange={(e) => handleItemChange(idx, 'wastagePercent', e.target.value)}
                            className="w-12 rounded border border-surface-300 px-1 py-0.5 text-xs text-right"
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-surface-900">
                          {formatCurrency(calculated.taxableAmount)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 rounded text-surface-400 hover:text-red-600 hover:bg-red-50"
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

            <div className="p-3 bg-surface-50/50 border-t border-surface-200 flex justify-between items-center text-xs">
              <Button
                size="sm"
                variant="outline"
                icon={Plus}
                onClick={() => setItemSearchModalOpen(true)}
              >
                + Add Another Item
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-surface-500">Invoice Discount:</span>
                <input
                  type="number"
                  placeholder="₹0"
                  value={extraDiscount}
                  onChange={(e) => setExtraDiscount(e.target.value)}
                  className="w-24 rounded-lg border border-surface-300 px-2 py-1 text-right text-xs font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Calculations & Payment Settlement */}
        <div className="lg:col-span-4 space-y-4">
          {/* Financial Calculation Breakdown Card */}
          <div className="bg-white rounded-2xl border border-surface-200 p-5 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-surface-100">
              <span className="font-bold uppercase tracking-wider text-surface-700">Financial Summary</span>
              <Badge variant={billType === 'KACHA' ? 'kacha' : 'pakka'}>
                {billType === 'KACHA' ? 'Kacha Bill' : '3% GST Tax Bill'}
              </Badge>
            </div>

            <div className="space-y-1.5 text-surface-600">
              <div className="flex justify-between">
                <span>Pure Gold Value</span>
                <span className="font-semibold text-surface-900">
                  {formatCurrency(calculations.breakdown?.goldAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Making Charges</span>
                <span className="font-semibold text-surface-900">
                  {formatCurrency(calculations.breakdown?.makingAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Wastage Metal Value</span>
                <span className="font-semibold text-surface-900">
                  {formatCurrency(calculations.breakdown?.wastageAmount)}
                </span>
              </div>
              {calculations.breakdown?.stoneAmount > 0 && (
                <div className="flex justify-between">
                  <span>Stone / Diamond Value</span>
                  <span className="font-semibold text-surface-900">
                    {formatCurrency(calculations.breakdown?.stoneAmount)}
                  </span>
                </div>
              )}
              {calculations.discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount</span>
                  <span>-{formatCurrency(calculations.discount)}</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-surface-100 flex justify-between font-bold text-surface-900">
              <span>Taxable Amount</span>
              <span>{formatCurrency(calculations.taxableAmount)}</span>
            </div>

            {/* GST Tax Breakdown (if Pakka) */}
            {billType === 'PAKKA' && (
              <div className="p-2.5 rounded-xl bg-surface-50 border border-surface-200/80 space-y-1 text-[11px] text-surface-600">
                <div className="flex justify-between">
                  <span>CGST (1.5%)</span>
                  <span>{formatCurrency(calculations.tax?.cgstAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST (1.5%)</span>
                  <span>{formatCurrency(calculations.tax?.sgstAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700 pt-1 border-t border-surface-200">
                  <span>Total Tax (3%)</span>
                  <span>{formatCurrency(calculations.tax?.totalTax)}</span>
                </div>
              </div>
            )}

            <div className="p-3 rounded-xl bg-gold-50/70 border border-gold-200 flex justify-between items-center text-gold-950">
              <span className="text-xs uppercase font-extrabold tracking-wider">Grand Total</span>
              <span className="text-2xl font-black font-display tracking-tight text-surface-900">
                {formatCurrency(calculations.grandTotal)}
              </span>
            </div>
          </div>

          {/* Payment & Split Tender Panel */}
          <div className="bg-white rounded-2xl border border-surface-200 p-5 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-surface-100">
              <span className="font-bold uppercase tracking-wider text-surface-700 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-gold-600" /> Payment Settlement
              </span>
              <span className="text-[10px] text-surface-400">Multi-tender POS</span>
            </div>

            {/* Quick Settle Shortcut Buttons */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickPay('CASH')}
                className="px-2 py-1.5 rounded-lg border border-surface-200 bg-surface-50 hover:bg-gold-50 hover:border-gold-300 font-bold text-[11px] transition-colors"
              >
                💵 Full Cash
              </button>
              <button
                type="button"
                onClick={() => handleQuickPay('UPI')}
                className="px-2 py-1.5 rounded-lg border border-surface-200 bg-surface-50 hover:bg-gold-50 hover:border-gold-300 font-bold text-[11px] transition-colors"
              >
                📱 Full UPI
              </button>
              <button
                type="button"
                onClick={() => handleQuickPay('CARD')}
                className="px-2 py-1.5 rounded-lg border border-surface-200 bg-surface-50 hover:bg-gold-50 hover:border-gold-300 font-bold text-[11px] transition-colors"
              >
                💳 Full Card
              </button>
            </div>

            {/* Tender Fields */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-surface-700">Cash Received</span>
                <input
                  type="number"
                  placeholder="₹0"
                  value={payments.CASH || ''}
                  onChange={(e) => setPayments({ ...payments, CASH: e.target.value })}
                  className="w-28 rounded-lg border border-surface-300 px-2 py-1 text-right text-xs font-bold"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-surface-700">UPI / QR Code</span>
                <input
                  type="number"
                  placeholder="₹0"
                  value={payments.UPI || ''}
                  onChange={(e) => setPayments({ ...payments, UPI: e.target.value })}
                  className="w-28 rounded-lg border border-surface-300 px-2 py-1 text-right text-xs font-bold"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-surface-700">Credit / Debit Card</span>
                <input
                  type="number"
                  placeholder="₹0"
                  value={payments.CARD || ''}
                  onChange={(e) => setPayments({ ...payments, CARD: e.target.value })}
                  className="w-28 rounded-lg border border-surface-300 px-2 py-1 text-right text-xs font-bold"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-surface-700">Old Gold Exchange</span>
                <input
                  type="number"
                  placeholder="₹0"
                  value={payments.EXCHANGE || ''}
                  onChange={(e) => setPayments({ ...payments, EXCHANGE: e.target.value })}
                  className="w-28 rounded-lg border border-surface-300 px-2 py-1 text-right text-xs font-bold"
                />
              </div>
            </div>

            {/* Settle Summary */}
            <div className="pt-3 border-t border-surface-100 space-y-1">
              <div className="flex justify-between font-bold text-surface-900">
                <span>Total Paid</span>
                <span className="text-emerald-700">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex justify-between font-bold text-surface-900">
                <span>Balance Due</span>
                <span className={balanceDue > 0 ? 'text-amber-600 font-extrabold' : 'text-surface-500'}>
                  {formatCurrency(balanceDue)}
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              icon={CheckCircle}
              isLoading={isSaving}
              onClick={handleConfirmBill}
              className="w-full font-bold shadow-md mt-2"
            >
              Generate {billType === 'KACHA' ? 'Kacha Bill' : 'GST Invoice'}
            </Button>
          </div>
        </div>
      </div>

      {/* Sub-modals */}
      <CustomerSelectModal
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onCustomerCreated={(c) => setSelectedCustomer(c)}
      />

      <ItemSearchModal
        isOpen={itemSearchModalOpen}
        onClose={() => setItemSearchModalOpen(false)}
        onSelectItem={handleAddItemFromModal}
        activeGoldRate={rate22K}
      />
    </div>
  );
};
