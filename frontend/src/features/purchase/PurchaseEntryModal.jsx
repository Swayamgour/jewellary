import React, { useState, useEffect, useMemo } from 'react';
import { Truck, Plus, Trash2, Save } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ProductSelect } from './ProductSelect';
import { useGetVendorsQuery, useCreatePurchaseMutation, useUpdatePurchaseMutation } from '../../app/api/baseApi';
import { METALS, PURITIES, PAYMENT_MODES } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errors';
import { toast } from 'sonner';

const blankLine = () => ({
  productId: '', productName: '', barcode: '', metal: 'GOLD', purity: '22K',
  grossWeight: '', stoneWeight: '0', quantity: '1', rate: '', makingAmount: '0', otherCharges: '0', gstRate: '3'
});

const num = (v) => parseFloat(v) || 0;
const lineMath = (l) => {
  const net = Math.max(0, num(l.grossWeight) - num(l.stoneWeight));
  const qty = parseInt(l.quantity, 10) || 1;
  const taxable = net * qty * num(l.rate) + num(l.makingAmount) + num(l.otherCharges);
  const tax = (taxable * num(l.gstRate)) / 100;
  return { net, qty, taxable, tax, total: taxable + tax };
};

/**
 * Record a vendor purchase (creates stock) or edit a DRAFT purchase.
 * Weights are PER PIECE; making / other charges are for the whole line; rate is ₹ per gram.
 */
export const PurchaseEntryModal = ({ isOpen, onClose, draft = null }) => {
  const { data: vendorData } = useGetVendorsQuery({ limit: 200 });
  const [createPurchase, { isLoading: creating }] = useCreatePurchaseMutation();
  const [updatePurchase, { isLoading: updating }] = useUpdatePurchaseMutation();
  const vendors = vendorData?.data || [];

  const [vendorId, setVendorId] = useState('');
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('');
  const [paymentMode, setPaymentMode] = useState('BANK_TRANSFER');
  const [paidAmount, setPaidAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([blankLine()]);

  useEffect(() => {
    if (!isOpen) return;
    if (draft) {
      setVendorId(draft.vendorId?._id || draft.vendorId || '');
      setVendorInvoiceNo(draft.vendorInvoiceNo || '');
      setNotes(draft.notes || '');
      setItems(draft.items.map((i) => ({
        productId: i.productId || '', productName: i.productName, barcode: i.barcode || '', metal: i.metal, purity: i.purity,
        grossWeight: String(i.grossWeight), stoneWeight: String(i.stoneWeight || 0), quantity: String(i.quantity), rate: String(i.rate),
        makingAmount: String(i.makingAmount || 0), otherCharges: String(i.otherCharges || 0), gstRate: String(i.gstRate || 0)
      })));
    } else {
      setVendorId(''); setVendorInvoiceNo(''); setNotes(''); setPaidAmount(''); setItems([blankLine()]);
    }
  }, [isOpen, draft]);

  const totals = useMemo(() => {
    const t = items.reduce((a, l) => {
      const m = lineMath(l);
      return { taxable: a.taxable + m.taxable, tax: a.tax + m.tax };
    }, { taxable: 0, tax: 0 });
    const grand = Math.round(t.taxable + t.tax);
    return { ...t, grand };
  }, [items]);

  const setLine = (i, field, value) => setItems((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));

  const buildItems = () =>
    items.map((l) => ({
      productId: l.productId,
      productName: l.productName,
      barcode: l.barcode || undefined,
      metal: l.metal,
      purity: l.purity,
      grossWeight: num(l.grossWeight),
      stoneWeight: num(l.stoneWeight),
      quantity: parseInt(l.quantity, 10) || 1,
      rate: num(l.rate),
      makingAmount: num(l.makingAmount),
      otherCharges: num(l.otherCharges),
      gstRate: num(l.gstRate)
    }));

  const submit = async (asDraft) => {
    if (!vendorId) return toast.error('Please select a vendor');
    for (const l of items) {
      if (!l.productId) return toast.error('Choose a product design for every row');
      if (!(num(l.grossWeight) > 0) || !(num(l.rate) > 0)) return toast.error('Every row needs a gross weight and a rate');
      if (num(l.stoneWeight) > num(l.grossWeight)) return toast.error('Stone weight cannot exceed gross weight');
    }
    const paid = num(paidAmount);
    if (!asDraft && paid > totals.grand + 0.005) return toast.error(`Paid amount cannot exceed the purchase total ${formatCurrency(totals.grand)}`);

    try {
      if (draft) {
        await updatePurchase({ id: draft._id, vendorId, vendorInvoiceNo: vendorInvoiceNo || undefined, items: buildItems(), notes }).unwrap();
        toast.success('Draft updated');
      } else {
        const res = await createPurchase({
          vendorId, vendorInvoiceNo: vendorInvoiceNo || undefined, purchaseDate: new Date(), items: buildItems(),
          status: asDraft ? 'DRAFT' : 'COMPLETED',
          ...(asDraft ? {} : { paidAmount: paid, paymentMode }),
          notes
        }).unwrap();
        toast.success(asDraft ? `Draft ${res.data?.purchaseNo} saved` : `Purchase ${res.data?.purchaseNo} recorded - stock added`);
      }
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save purchase'));
    }
  };

  const busy = creating || updating;
  const cell = 'rounded border border-surface-300 p-1 text-xs text-right focus:border-gold-500 focus:outline-none';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={draft ? `Edit Draft ${draft.purchaseNo}` : 'Record Vendor Purchase'} subtitle="Adds stock (weights per piece) and credits the vendor payable ledger" maxWidth="max-w-6xl">
      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-surface-50 rounded-xl border border-surface-200">
          <div>
            <label className="text-[11px] font-bold uppercase text-surface-600">Vendor *</label>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-300 bg-white p-2 text-xs font-semibold">
              <option value="">Select vendor…</option>
              {vendors.map((v) => <option key={v._id} value={v._id}>{v.company || v.name} — {v.name}</option>)}
            </select>
          </div>
          <Input label="Vendor bill / challan no" value={vendorInvoiceNo} onChange={(e) => setVendorInvoiceNo(e.target.value)} placeholder="e.g. SURAT-INV-992" />
          {!draft && (
            <div>
              <label className="text-[11px] font-bold uppercase text-surface-600">Payment mode (if paying now)</label>
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-300 bg-white p-2 text-xs font-semibold">
                {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold uppercase tracking-wider text-surface-600">Items received</span>
            <Button size="sm" variant="outline" icon={Plus} onClick={() => setItems([...items, blankLine()])}>Add row</Button>
          </div>
          <div className="overflow-x-auto border border-surface-200 rounded-xl">
            <table className="w-full text-left">
              <thead className="bg-surface-50 text-[10px] font-bold uppercase text-surface-600 border-b border-surface-200">
                <tr>
                  <th className="p-2">Design *</th><th className="p-2">Barcode</th><th className="p-2">Metal / Purity</th>
                  <th className="p-2 text-right">Gross/pc g</th><th className="p-2 text-right">Stone/pc g</th><th className="p-2 text-right">Qty</th>
                  <th className="p-2 text-right">Rate ₹/g</th><th className="p-2 text-right">Making ₹</th><th className="p-2 text-right">Other ₹</th>
                  <th className="p-2 text-right">GST %</th><th className="p-2 text-right">Line total</th><th className="p-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 bg-white">
                {items.map((l, i) => {
                  const m = lineMath(l);
                  return (
                    <tr key={i} className="align-top">
                      <td className="p-2">
                        <ProductSelect value={l.productId} onChange={(id, p) => setItems((prev) => prev.map((x, idx) => idx === i ? { ...x, productId: id, productName: p?.name || x.productName, metal: p?.metal || x.metal, purity: p?.purity || x.purity } : x))} className="w-36" />
                        <input value={l.productName} onChange={(e) => setLine(i, 'productName', e.target.value)} placeholder="Description" className="mt-1 w-36 rounded border border-surface-300 p-1 text-xs" required />
                      </td>
                      <td className="p-2"><input value={l.barcode} onChange={(e) => setLine(i, 'barcode', e.target.value)} placeholder="auto" className="w-28 rounded border border-surface-300 p-1 text-xs font-mono uppercase" /></td>
                      <td className="p-2">
                        <select value={l.metal} onChange={(e) => setLine(i, 'metal', e.target.value)} className="rounded border border-surface-300 p-1 text-xs">{METALS.map((x) => <option key={x}>{x}</option>)}</select>
                        <select value={l.purity} onChange={(e) => setLine(i, 'purity', e.target.value)} className="mt-1 rounded border border-surface-300 p-1 text-xs">{PURITIES.map((x) => <option key={x}>{x}</option>)}</select>
                      </td>
                      <td className="p-2"><input type="number" step="0.001" value={l.grossWeight} onChange={(e) => setLine(i, 'grossWeight', e.target.value)} className={`w-20 ${cell}`} /></td>
                      <td className="p-2"><input type="number" step="0.001" value={l.stoneWeight} onChange={(e) => setLine(i, 'stoneWeight', e.target.value)} className={`w-16 ${cell}`} /></td>
                      <td className="p-2"><input type="number" min="1" value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} className={`w-14 ${cell}`} /></td>
                      <td className="p-2"><input type="number" value={l.rate} onChange={(e) => setLine(i, 'rate', e.target.value)} className={`w-20 ${cell}`} /></td>
                      <td className="p-2"><input type="number" value={l.makingAmount} onChange={(e) => setLine(i, 'makingAmount', e.target.value)} className={`w-20 ${cell}`} /></td>
                      <td className="p-2"><input type="number" value={l.otherCharges} onChange={(e) => setLine(i, 'otherCharges', e.target.value)} className={`w-16 ${cell}`} /></td>
                      <td className="p-2"><input type="number" step="0.1" value={l.gstRate} onChange={(e) => setLine(i, 'gstRate', e.target.value)} className={`w-14 ${cell}`} /></td>
                      <td className="p-2 text-right font-bold text-surface-900">{formatCurrency(m.total)}<span className="block text-[10px] font-normal text-surface-400">{(m.net * m.qty).toFixed(3)} g net</span></td>
                      <td className="p-2"><button type="button" disabled={items.length === 1} onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="text-surface-400 hover:text-red-600 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-3 p-3 bg-gold-50/70 rounded-xl border border-gold-200">
          <div className="space-y-0.5">
            <p className="text-surface-600">Taxable {formatCurrency(totals.taxable)} + GST {formatCurrency(totals.tax)}</p>
            <p><span className="text-surface-600">Purchase total: </span><span className="text-lg font-black text-surface-900 font-display">{formatCurrency(totals.grand)}</span></p>
          </div>
          {!draft && (
            <div className="flex items-center gap-3">
              <span className="font-semibold text-surface-700">Paid now ₹</span>
              <input type="number" min="0" placeholder="0" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="w-32 rounded-lg border border-surface-300 p-1.5 text-right font-bold" />
            </div>
          )}
        </div>

        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="outline" icon={Save} onClick={() => submit(true)} isLoading={busy}>{draft ? 'Save Draft' : 'Save as Draft'}</Button>
          {!draft && <Button variant="primary" icon={Truck} onClick={() => submit(false)} isLoading={busy}>Save Purchase & Add Stock</Button>}
        </div>
      </div>
    </Modal>
  );
};
