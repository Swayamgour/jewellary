import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Receipt, FileCheck, Search, Plus, Trash2, CreditCard, CheckCircle, Save, AlertTriangle } from 'lucide-react';
import {
  useGetCurrentGoldRatesQuery,
  useLazyGetInventoryQuery,
  useCreateInvoiceMutation,
  useUpdateDraftInvoiceMutation,
  useGetInvoiceByIdQuery
} from '../../app/api/baseApi';
import { selectCurrentBranch } from '../auth/authSlice';
import { calculateInvoiceTotals, calculateItemPrice } from '../../utils/calculations';
import { formatCurrency, formatWeight } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errors';
import { MAKING_TYPES } from '../../utils/constants';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CustomerSelectModal } from './CustomerSelectModal';
import { CustomerPicker } from './CustomerPicker';
import { ItemSearchModal } from './ItemSearchModal';
import { toast } from 'sonner';

const EMPTY_PAY = { CASH: '', UPI: '', CARD: '', BANK_TRANSFER: '', CHEQUE: '' };
const PAY_LABELS = { CASH: 'Cash', UPI: 'UPI / QR', CARD: 'Card', BANK_TRANSFER: 'Bank Transfer', CHEQUE: 'Cheque' };
let lineKey = 0;

/** Build a bill line from a stock record. Weights / metal / purity are read-only: they belong to the stock. */
const lineFromStock = (inv, rateFor) => ({
  key: `l${++lineKey}`,
  inventoryId: inv._id,
  productId: inv.productId?._id || inv.productId,
  barcode: inv.barcode,
  productName: inv.productId?.name || 'Jewellery Item',
  metal: inv.metal,
  purity: inv.purity,
  grossWeight: inv.grossWeight,
  stoneWeight: inv.stoneWeight || 0,
  availableQty: inv.quantity,
  quantity: 1,
  goldRate: rateFor(inv.metal, inv.purity) || '',
  makingType: inv.makingType || 'PER_GRAM',
  makingRate: inv.makingRate || 0,
  wastagePercent: inv.wastagePercent || 0,
  stoneAmount: 0,
  discount: 0
});

export const BillingPOSPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const draftId = params.get('draft');
  const branch = useSelector(selectCurrentBranch);

  const [billType, setBillType] = useState(params.get('type') === 'PAKKA' ? 'PAKKA' : 'KACHA');
  const [customer, setCustomer] = useState(null);
  const [items, setItems] = useState([]);
  const [extraDiscount, setExtraDiscount] = useState('');
  const [notes, setNotes] = useState('');
  const [payments, setPayments] = useState(EMPTY_PAY);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const barcodeRef = useRef(null);
  const draftLoaded = useRef(false);

  const { data: ratesData } = useGetCurrentGoldRatesQuery();
  const rates = ratesData?.data || [];
  const rateFor = useCallback(
    (metal, purity) => rates.find((r) => r.metal === metal && r.purity === purity)?.rate,
    [rates]
  );
  const [fetchInventory] = useLazyGetInventoryQuery();
  const [createInvoice, { isLoading: creating }] = useCreateInvoiceMutation();
  const [updateDraft, { isLoading: updating }] = useUpdateDraftInvoiceMutation();
  const { data: draftData } = useGetInvoiceByIdQuery(draftId, { skip: !draftId });
  const isSaving = creating || updating;

  // ---- editing an existing DRAFT: load it into the cart once
  useEffect(() => {
    const d = draftData?.data;
    if (!d || draftLoaded.current) return;
    if (d.status !== 'DRAFT') {
      toast.error('Only DRAFT bills can be edited');
      navigate(`/billing/${d._id}`);
      return;
    }
    draftLoaded.current = true;
    setBillType(d.billType);
    setCustomer(d.customerId && typeof d.customerId === 'object' ? d.customerId : null);
    setExtraDiscount(d.extraDiscount ? String(d.extraDiscount) : '');
    setNotes(d.notes || '');
    setItems(
      d.items.map((i) => ({
        key: `l${++lineKey}`,
        inventoryId: i.inventoryId,
        productId: i.productId,
        barcode: i.barcode,
        productName: i.productName,
        metal: i.metal,
        purity: i.purity,
        grossWeight: i.grossWeight,
        stoneWeight: i.stoneWeight || 0,
        availableQty: null,
        quantity: i.quantity,
        goldRate: i.goldRate,
        makingType: i.makingType,
        makingRate: i.makingRate,
        wastagePercent: i.wastagePercent || 0,
        stoneAmount: i.quantity ? (i.stoneAmount || 0) / i.quantity : 0,
        discount: i.discount || 0
      }))
    );
  }, [draftData, navigate]);

  // ---- money
  const isInterState = useMemo(() => {
    const branchState = branch?.address?.stateCode || '07';
    const custState = customer?.address?.stateCode || '07';
    return branchState !== custState;
  }, [branch, customer]);

  const calc = useMemo(
    () => calculateInvoiceTotals({ items, billType, isInterState, extraDiscount }),
    [items, billType, isInterState, extraDiscount]
  );
  const totalPaid = useMemo(() => Object.values(payments).reduce((a, v) => a + (parseFloat(v) || 0), 0), [payments]);
  const overPaid = totalPaid > calc.grandTotal + 0.005;
  const balanceDue = Math.max(0, calc.grandTotal - totalPaid);

  // ---- cart actions
  const addStockItem = (inv) => {
    setItems((prev) => {
      const existing = prev.find((l) => l.barcode === inv.barcode);
      if (existing) {
        const max = inv.quantity;
        if (existing.quantity >= max) {
          toast.error(`Only ${max} available for ${inv.barcode}`);
          return prev;
        }
        return prev.map((l) => (l.key === existing.key ? { ...l, quantity: l.quantity + 1, availableQty: max } : l));
      }
      const line = lineFromStock(inv, rateFor);
      if (!line.goldRate) toast.warning(`No ${inv.metal} ${inv.purity} rate set - enter the rate manually`);
      return [...prev, line];
    });
  };

  const updateLine = (key, field, value) => setItems((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  const removeLine = (key) => setItems((prev) => prev.filter((l) => l.key !== key));

  const scanBarcode = async (e) => {
    if (e.key !== 'Enter' || !barcodeInput.trim()) return;
    e.preventDefault();
    const code = barcodeInput.trim();
    try {
      const res = await fetchInventory({ barcode: code, status: 'AVAILABLE' }).unwrap();
      const found = (res?.data || []).find((i) => i.barcode.toLowerCase() === code.toLowerCase() && i.quantity > 0);
      if (!found) {
        toast.error(`Barcode "${code}" is not available in this branch`);
      } else {
        addStockItem(found);
        toast.success(`Added ${found.productId?.name || found.barcode}`);
      }
      setBarcodeInput('');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Barcode lookup failed'));
    }
  };

  const resetBill = () => {
    setItems([]);
    setPayments(EMPTY_PAY);
    setExtraDiscount('');
    setNotes('');
    setCustomer(null);
    toast.info('New bill started');
  };

  const setFullPayment = (mode) => setPayments({ ...EMPTY_PAY, [mode]: String(calc.grandTotal) });

  // ---- validation + save
  const validate = (asDraft) => {
    if (!customer) return 'Please select a customer';
    if (items.length === 0) return 'Add at least one item';
    if (calc.error) return calc.error;
    for (const l of items) {
      if (!(parseFloat(l.goldRate) > 0)) return `Enter a rate for ${l.productName}`;
      if (l.availableQty && l.quantity > l.availableQty) return `${l.barcode}: only ${l.availableQty} in stock`;
    }
    if (!asDraft && overPaid) return 'Payments are more than the bill total';
    return null;
  };

  const buildPayload = (asDraft) => ({
    customerId: customer._id,
    items: items.map((l) => ({
      productId: l.productId,
      barcode: l.barcode,
      productName: l.productName,
      metal: l.metal,
      purity: l.purity,
      grossWeight: parseFloat(l.grossWeight),
      stoneWeight: parseFloat(l.stoneWeight) || 0,
      quantity: parseInt(l.quantity, 10) || 1,
      goldRate: parseFloat(l.goldRate),
      makingType: l.makingType,
      makingRate: parseFloat(l.makingRate) || 0,
      wastagePercent: parseFloat(l.wastagePercent) || 0,
      stoneAmount: parseFloat(l.stoneAmount) || 0,
      discount: parseFloat(l.discount) || 0
    })),
    discount: parseFloat(extraDiscount) || 0,
    notes: notes || undefined,
    ...(asDraft
      ? {}
      : {
          payments: Object.entries(payments)
            .filter(([, v]) => parseFloat(v) > 0)
            .map(([paymentMode, v]) => ({ paymentMode, amount: parseFloat(v) }))
        })
  });

  const save = async (asDraft) => {
    const problem = validate(asDraft);
    if (problem) {
      toast.error(problem);
      return;
    }
    try {
      let res;
      if (draftId) {
        // update the draft first, then confirm it if the cashier chose "Confirm"
        const body = buildPayload(true);
        await updateDraft({ id: draftId, billType, ...body }).unwrap();
        if (asDraft) {
          toast.success('Draft updated');
          navigate(`/billing/${draftId}`);
          return;
        }
        navigate(`/billing/${draftId}?confirm=1`, { state: { payments: buildPayload(false).payments } });
        return;
      }
      res = await createInvoice({ billType, ...buildPayload(asDraft), status: asDraft ? 'DRAFT' : 'CONFIRMED' }).unwrap();
      toast.success(
        asDraft
          ? `Draft ${res.data?.invoiceNo} saved - nothing is posted until you confirm it`
          : `${billType === 'KACHA' ? 'Kacha bill' : 'GST invoice'} ${res.data?.invoiceNo} confirmed`
      );
      if (res?.data?._id) navigate(`/billing/${res.data._id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save bill'));
    }
  };

  // hotkeys (use a ref so the handler always sees the latest state)
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F2') { e.preventDefault(); resetBill(); }
      if (e.key === 'F4') { e.preventDefault(); setCustomerModalOpen(true); }
      if (e.key === 'F6') { e.preventDefault(); setItemModalOpen(true); }
      if (e.key === 'F8') { e.preventDefault(); barcodeRef.current?.focus(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveRef.current(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const cartBarcodes = items.map((i) => i.barcode);

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-surface-200 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center p-1 rounded-xl bg-surface-100 border border-surface-200">
            {['KACHA', 'PAKKA'].map((t) => (
              <button
                key={t}
                type="button"
                disabled={Boolean(draftId)}
                onClick={() => setBillType(t)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-60 ${
                  billType === t ? (t === 'KACHA' ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white') : 'text-surface-600 hover:text-surface-900'
                }`}
              >
                {t === 'KACHA' ? <Receipt className="w-3.5 h-3.5" /> : <FileCheck className="w-3.5 h-3.5" />}
                {t === 'KACHA' ? 'KACHA BILL (Estimate)' : 'PAKKA (GST Invoice)'}
              </button>
            ))}
          </div>
          {draftId && <Badge variant="warning">Editing draft</Badge>}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetBill}>Reset (F2)</Button>
          <Button variant="outline" size="sm" icon={Save} isLoading={isSaving} onClick={() => save(true)}>Save Draft</Button>
          <Button variant="primary" icon={CheckCircle} isLoading={isSaving} onClick={() => save(false)} className="font-bold">
            {draftId ? 'Confirm Draft (Ctrl+S)' : 'Confirm & Save (Ctrl+S)'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: customer + items */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-surface-200 shadow-xs space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-surface-500 block">Customer (F4)</label>
            <CustomerPicker value={customer} onChange={setCustomer} onCreateNew={() => setCustomerModalOpen(true)} />
            {customer && (
              <p className="text-[11px] text-surface-500">
                Place of supply: {branch?.address?.state || 'Branch state'} → {customer.address?.state || 'Customer state'} ·{' '}
                <strong>{isInterState ? 'Inter-state (IGST 3%)' : 'In-state (CGST 1.5% + SGST 1.5%)'}</strong>
                {billType === 'KACHA' && ' — no GST on Kacha bills'}
              </p>
            )}
          </div>

          <div className="bg-white p-3 rounded-2xl border border-surface-200 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-gold-600 shrink-0" />
              <input
                ref={barcodeRef}
                type="text"
                placeholder="Scan / type barcode and press Enter (F8)..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={scanBarcode}
                className="w-full text-xs text-surface-900 bg-transparent placeholder:text-surface-400 focus:outline-none font-mono"
              />
            </div>
            <Button size="sm" variant="outline" icon={Plus} onClick={() => setItemModalOpen(true)}>Add Item (F6)</Button>
          </div>

          <div className="bg-white rounded-2xl border border-surface-200 shadow-xs overflow-hidden">
            <div className="p-3 bg-surface-50 border-b border-surface-200 flex items-center justify-between text-xs">
              <span className="font-bold text-surface-800 font-display">Cart Items ({items.length})</span>
              <span className="text-[11px] text-surface-500">
                {rates.length > 0
                  ? rates.filter((r) => r.metal === 'GOLD').slice(0, 3).map((r) => `${r.purity}: ${formatCurrency(r.rate)}/g`).join(' · ')
                  : 'No rates set — update the rate board'}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="py-14 text-center text-xs text-surface-400">
                Cart is empty. Scan a barcode or use <strong>Add Item (F6)</strong> to bill a piece from stock.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-50/80 text-[10px] uppercase font-bold text-surface-600 border-b border-surface-200">
                    <tr>
                      <th className="py-2.5 px-3">Item / Barcode</th>
                      <th className="py-2.5 px-2">Qty</th>
                      <th className="py-2.5 px-2 text-right">Gross/pc</th>
                      <th className="py-2.5 px-2 text-right">Net wt</th>
                      <th className="py-2.5 px-2">Rate ₹/g</th>
                      <th className="py-2.5 px-2">Making</th>
                      <th className="py-2.5 px-2">Wast %</th>
                      <th className="py-2.5 px-2">Stone ₹</th>
                      <th className="py-2.5 px-2">Disc ₹</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {items.map((l) => {
                      const c = calculateItemPrice(l);
                      const numInput = 'rounded border border-surface-300 px-1.5 py-0.5 text-xs text-right focus:border-gold-500 focus:outline-none';
                      return (
                        <tr key={l.key} className="hover:bg-surface-50/50 align-top">
                          <td className="py-2 px-3">
                            <p className="font-bold text-surface-900">{l.productName}</p>
                            <span className="font-mono text-[10px] text-gold-700 block">🏷️ {l.barcode}</span>
                            <span className="text-[10px] text-surface-500">{l.metal} {l.purity}</span>
                          </td>
                          <td className="py-2 px-2">
                            <input type="number" min="1" max={l.availableQty || undefined} value={l.quantity} onChange={(e) => updateLine(l.key, 'quantity', e.target.value)} className={`w-14 ${numInput}`} />
                            {l.availableQty ? <span className="block text-[10px] text-surface-400">of {l.availableQty}</span> : null}
                          </td>
                          <td className="py-2 px-2 text-right text-surface-700">{formatWeight(l.grossWeight)}</td>
                          <td className="py-2 px-2 text-right font-bold text-surface-800">{formatWeight(c.netWeight * c.quantity)}</td>
                          <td className="py-2 px-2"><input type="number" value={l.goldRate} onChange={(e) => updateLine(l.key, 'goldRate', e.target.value)} className={`w-20 font-semibold ${numInput}`} /></td>
                          <td className="py-2 px-2">
                            <div className="flex gap-1">
                              <input type="number" value={l.makingRate} onChange={(e) => updateLine(l.key, 'makingRate', e.target.value)} className={`w-16 ${numInput}`} />
                              <select value={l.makingType} onChange={(e) => updateLine(l.key, 'makingType', e.target.value)} className="rounded border border-surface-300 text-[10px] px-0.5">
                                {MAKING_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                              </select>
                            </div>
                          </td>
                          <td className="py-2 px-2"><input type="number" step="0.1" value={l.wastagePercent} onChange={(e) => updateLine(l.key, 'wastagePercent', e.target.value)} className={`w-14 ${numInput}`} /></td>
                          <td className="py-2 px-2"><input type="number" value={l.stoneAmount} onChange={(e) => updateLine(l.key, 'stoneAmount', e.target.value)} className={`w-16 ${numInput}`} /></td>
                          <td className="py-2 px-2"><input type="number" value={l.discount} onChange={(e) => updateLine(l.key, 'discount', e.target.value)} className={`w-16 ${numInput}`} /></td>
                          <td className="py-2 px-3 text-right font-bold text-surface-900">{formatCurrency(c.taxableAmount)}</td>
                          <td className="py-2 px-2 text-center">
                            <button type="button" onClick={() => removeLine(l.key)} className="p-1 rounded text-surface-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="p-3 bg-surface-50/50 border-t border-surface-200 flex flex-wrap justify-between items-center gap-3 text-xs">
              <input
                type="text"
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex-1 min-w-[160px] rounded-lg border border-surface-300 px-2 py-1 text-xs"
              />
              <div className="flex items-center gap-2">
                <span className="text-surface-500">Bill discount ₹</span>
                <input type="number" min="0" placeholder="0" value={extraDiscount} onChange={(e) => setExtraDiscount(e.target.value)} className="w-24 rounded-lg border border-surface-300 px-2 py-1 text-right text-xs font-bold" />
              </div>
            </div>
          </div>
        </div>

        {/* Right: totals + payment */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-surface-200 p-5 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-surface-100">
              <span className="font-bold uppercase tracking-wider text-surface-700">Financial Summary</span>
              <Badge variant={billType === 'KACHA' ? 'kacha' : 'pakka'}>{billType === 'KACHA' ? 'Kacha Bill' : '3% GST Invoice'}</Badge>
            </div>
            <div className="space-y-1.5 text-surface-600">
              <Row label="Metal value" value={calc.breakdown.goldAmount} />
              <Row label="Making charges" value={calc.breakdown.makingAmount} />
              <Row label="Wastage" value={calc.breakdown.wastageAmount} />
              {calc.breakdown.stoneAmount > 0 && <Row label="Stone / diamond" value={calc.breakdown.stoneAmount} />}
              {calc.discount > 0 && <Row label="Discount" value={-calc.discount} className="text-emerald-600 font-semibold" />}
            </div>
            <div className="pt-2 border-t border-surface-100 flex justify-between font-bold text-surface-900">
              <span>Taxable amount</span><span>{formatCurrency(calc.taxableAmount)}</span>
            </div>
            {billType === 'PAKKA' && (
              <div className="p-2.5 rounded-xl bg-surface-50 border border-surface-200/80 space-y-1 text-[11px] text-surface-600">
                {isInterState ? (
                  <Row label="IGST (3%)" value={calc.tax.igstAmount} />
                ) : (
                  <>
                    <Row label="CGST (1.5%)" value={calc.tax.cgstAmount} />
                    <Row label="SGST (1.5%)" value={calc.tax.sgstAmount} />
                  </>
                )}
                <div className="flex justify-between font-bold text-emerald-700 pt-1 border-t border-surface-200">
                  <span>Total GST</span><span>{formatCurrency(calc.tax.totalTax)}</span>
                </div>
              </div>
            )}
            {calc.roundOff !== 0 && <Row label="Round off" value={calc.roundOff} />}
            <div className="p-3 rounded-xl bg-gold-50/70 border border-gold-200 flex justify-between items-center">
              <span className="text-xs uppercase font-extrabold tracking-wider">Grand Total</span>
              <span className="text-2xl font-black font-display tracking-tight text-surface-900">{formatCurrency(calc.grandTotal)}</span>
            </div>
            {calc.error && (
              <p className="flex items-start gap-1.5 text-[11px] text-red-600 font-semibold"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{calc.error}</p>
            )}
            <p className="text-[10px] text-surface-400">Preview only — the server recalculates and prints the final figures.</p>
          </div>

          <div className="bg-white rounded-2xl border border-surface-200 p-5 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-surface-100">
              <span className="font-bold uppercase tracking-wider text-surface-700 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-gold-600" /> Payment
              </span>
              <span className="text-[10px] text-surface-400">Optional · rest stays as customer due</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {['CASH', 'UPI', 'CARD'].map((m) => (
                <button key={m} type="button" onClick={() => setFullPayment(m)} disabled={calc.grandTotal <= 0}
                  className="px-2 py-1.5 rounded-lg border border-surface-200 bg-surface-50 hover:bg-gold-50 hover:border-gold-300 font-bold text-[11px] disabled:opacity-40">
                  Full {PAY_LABELS[m]}
                </button>
              ))}
            </div>

            <div className="space-y-2 pt-1">
              {Object.keys(EMPTY_PAY).map((m) => (
                <div key={m} className="flex items-center justify-between">
                  <span className="font-semibold text-surface-700">{PAY_LABELS[m]}</span>
                  <input type="number" min="0" placeholder="₹0" value={payments[m]} onChange={(e) => setPayments({ ...payments, [m]: e.target.value })}
                    className="w-28 rounded-lg border border-surface-300 px-2 py-1 text-right text-xs font-bold" />
                </div>
              ))}
            </div>

            <p className="text-[10px] text-surface-400">Old gold? Complete the bill, then adjust it from the bill page or the Old Gold module.</p>

            <div className="pt-3 border-t border-surface-100 space-y-1">
              <div className="flex justify-between font-bold"><span>Total paid</span><span className="text-emerald-700">{formatCurrency(totalPaid)}</span></div>
              <div className="flex justify-between font-bold">
                <span>Balance due</span>
                <span className={balanceDue > 0 ? 'text-amber-600' : 'text-surface-500'}>{formatCurrency(balanceDue)}</span>
              </div>
              {overPaid && <p className="text-[11px] text-red-600 font-semibold">Payments exceed the bill total by {formatCurrency(totalPaid - calc.grandTotal)}</p>}
            </div>

            <Button variant="primary" size="lg" icon={CheckCircle} isLoading={isSaving} onClick={() => save(false)} className="w-full font-bold mt-2">
              {draftId ? 'Confirm Draft' : `Generate ${billType === 'KACHA' ? 'Kacha Bill' : 'GST Invoice'}`}
            </Button>
          </div>
        </div>
      </div>

      <CustomerSelectModal isOpen={customerModalOpen} onClose={() => setCustomerModalOpen(false)} onCustomerCreated={(c) => setCustomer(c)} />
      <ItemSearchModal isOpen={itemModalOpen} onClose={() => setItemModalOpen(false)} onSelectItem={addStockItem} cartBarcodes={cartBarcodes} />
    </div>
  );
};

const Row = ({ label, value, className = '' }) => (
  <div className={`flex justify-between ${className}`}>
    <span>{label}</span>
    <span className="font-semibold text-surface-900">{value < 0 ? '-' : ''}{formatCurrency(Math.abs(value))}</span>
  </div>
);
