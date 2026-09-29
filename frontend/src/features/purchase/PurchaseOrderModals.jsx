import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Send, CheckCircle, XCircle, PackageCheck, Truck, Lock } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { ProductSelect } from './ProductSelect';
import {
  useGetVendorsQuery, useCreatePurchaseOrderMutation, useUpdatePurchaseOrderMutation,
  useGetPurchaseOrderByIdQuery, usePoActionMutation, useReceivePurchaseOrderMutation
} from '../../app/api/baseApi';
import { METALS, PURITIES, PAYMENT_MODES, CAN_BUY, CAN_APPROVE_PO, poStatusVariant } from '../../utils/constants';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errors';
import { toast } from 'sonner';

const num = (v) => parseFloat(v) || 0;
const blank = () => ({ productId: '', productName: '', metal: 'GOLD', purity: '22K', grossWeight: '', stoneWeight: '0', quantity: '1', rate: '', makingAmount: '0', otherCharges: '0', gstRate: '3' });
const est = (l) => {
  const net = Math.max(0, num(l.grossWeight) - num(l.stoneWeight));
  const t = net * (parseInt(l.quantity, 10) || 1) * num(l.rate) + num(l.makingAmount) + num(l.otherCharges);
  return t + (t * num(l.gstRate)) / 100;
};

/** Create / edit a purchase order (DRAFT or REJECTED only) */
export const PurchaseOrderFormModal = ({ isOpen, onClose, order = null }) => {
  const { data: vData } = useGetVendorsQuery({ limit: 200 });
  const [create, { isLoading: creating }] = useCreatePurchaseOrderMutation();
  const [update, { isLoading: updating }] = useUpdatePurchaseOrderMutation();
  const [vendorId, setVendorId] = useState('');
  const [expected, setExpected] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([blank()]);

  useEffect(() => {
    if (!isOpen) return;
    if (order) {
      setVendorId(order.vendorId?._id || order.vendorId || '');
      setExpected(order.expectedDeliveryDate ? order.expectedDeliveryDate.slice(0, 10) : '');
      setNotes(order.notes || '');
      setItems(order.items.map((i) => ({ productId: i.productId || '', productName: i.productName, metal: i.metal, purity: i.purity, grossWeight: String(i.grossWeight), stoneWeight: String(i.stoneWeight || 0), quantity: String(i.quantity), rate: String(i.rate), makingAmount: String(i.makingAmount || 0), otherCharges: String(i.otherCharges || 0), gstRate: String(i.gstRate || 0) })));
    } else {
      setVendorId(''); setExpected(''); setNotes(''); setItems([blank()]);
    }
  }, [isOpen, order]);

  const total = useMemo(() => items.reduce((a, l) => a + est(l), 0), [items]);
  const setLine = (i, f, v) => setItems((p) => p.map((l, idx) => (idx === i ? { ...l, [f]: v } : l)));
  const cell = 'rounded border border-surface-300 p-1 text-xs text-right';

  const submit = async () => {
    if (!vendorId) return toast.error('Select a vendor');
    for (const l of items) {
      if (!l.productId || !l.productName) return toast.error('Every row needs a design and description');
      if (!(num(l.grossWeight) > 0) || !(num(l.rate) > 0) || !(parseInt(l.quantity, 10) > 0)) return toast.error('Every row needs weight, quantity and rate');
    }
    const payload = {
      vendorId,
      expectedDeliveryDate: expected || undefined,
      notes,
      items: items.map((l) => ({ productId: l.productId, productName: l.productName, metal: l.metal, purity: l.purity, grossWeight: num(l.grossWeight), stoneWeight: num(l.stoneWeight), quantity: parseInt(l.quantity, 10), rate: num(l.rate), makingAmount: num(l.makingAmount), otherCharges: num(l.otherCharges), gstRate: num(l.gstRate) }))
    };
    try {
      if (order) await update({ id: order._id, ...payload }).unwrap();
      else await create(payload).unwrap();
      toast.success(order ? 'Purchase order updated' : 'Purchase order created as DRAFT');
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={order ? `Edit ${order.poNo}` : 'New Purchase Order'} subtitle="Nothing is stocked until goods are received against the order" maxWidth="max-w-6xl">
      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-surface-50 rounded-xl border border-surface-200">
          <div>
            <label className="text-[11px] font-bold uppercase text-surface-600">Vendor *</label>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-300 bg-white p-2 text-xs font-semibold">
              <option value="">Select vendor…</option>
              {(vData?.data || []).map((v) => <option key={v._id} value={v._id}>{v.company || v.name}</option>)}
            </select>
          </div>
          <Input label="Expected delivery" type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex justify-between items-center">
          <span className="font-bold uppercase tracking-wider text-surface-600">Ordered items (weights per piece)</span>
          <Button size="sm" variant="outline" icon={Plus} onClick={() => setItems([...items, blank()])}>Add row</Button>
        </div>
        <div className="overflow-x-auto border border-surface-200 rounded-xl">
          <table className="w-full text-left">
            <thead className="bg-surface-50 text-[10px] font-bold uppercase text-surface-600 border-b border-surface-200">
              <tr><th className="p-2">Design *</th><th className="p-2">Metal / Purity</th><th className="p-2 text-right">Gross/pc</th><th className="p-2 text-right">Stone/pc</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Rate ₹/g</th><th className="p-2 text-right">Making ₹</th><th className="p-2 text-right">Other ₹</th><th className="p-2 text-right">GST%</th><th className="p-2 text-right">Est. total</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-surface-100 bg-white">
              {items.map((l, i) => (
                <tr key={i} className="align-top">
                  <td className="p-2">
                    <ProductSelect value={l.productId} className="w-36" onChange={(id, p) => setItems((prev) => prev.map((x, idx) => idx === i ? { ...x, productId: id, productName: p?.name || x.productName, metal: p?.metal || x.metal, purity: p?.purity || x.purity } : x))} />
                    <input value={l.productName} onChange={(e) => setLine(i, 'productName', e.target.value)} placeholder="Description" className="mt-1 w-36 rounded border border-surface-300 p-1 text-xs" />
                  </td>
                  <td className="p-2">
                    <select value={l.metal} onChange={(e) => setLine(i, 'metal', e.target.value)} className="rounded border border-surface-300 p-1">{METALS.map((x) => <option key={x}>{x}</option>)}</select>
                    <select value={l.purity} onChange={(e) => setLine(i, 'purity', e.target.value)} className="mt-1 rounded border border-surface-300 p-1">{PURITIES.map((x) => <option key={x}>{x}</option>)}</select>
                  </td>
                  {['grossWeight', 'stoneWeight', 'quantity', 'rate', 'makingAmount', 'otherCharges', 'gstRate'].map((f) => (
                    <td key={f} className="p-2"><input type="number" step="any" value={l[f]} onChange={(e) => setLine(i, f, e.target.value)} className={`w-20 ${cell}`} /></td>
                  ))}
                  <td className="p-2 text-right font-bold">{formatCurrency(est(l))}</td>
                  <td className="p-2"><button type="button" disabled={items.length === 1} onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="text-surface-400 hover:text-red-600 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center p-3 bg-gold-50/70 rounded-xl border border-gold-200">
          <span className="text-surface-600">Estimated order value (incl. GST)</span>
          <span className="text-lg font-black font-display">{formatCurrency(total)}</span>
        </div>
        <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} isLoading={creating || updating}>{order ? 'Save Changes' : 'Create Order'}</Button>
        </div>
      </div>
    </Modal>
  );
};

/** Receive goods (partial or complete) against an ORDERED / PARTIALLY_RECEIVED order */
const ReceiveForm = ({ order, onDone, onBack }) => {
  const [receive, { isLoading }] = useReceivePurchaseOrderMutation();
  const pendingLines = order.items.filter((i) => i.quantity - i.receivedQty > 0);
  const [rows, setRows] = useState(() => Object.fromEntries(pendingLines.map((i) => [i._id, { qty: '', barcode: '' }])));
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('');
  const [paid, setPaid] = useState('');
  const [mode, setMode] = useState('BANK_TRANSFER');

  const submit = async () => {
    const items = pendingLines
      .filter((l) => (parseInt(rows[l._id]?.qty, 10) || 0) > 0)
      .map((l) => ({ poItemId: l._id, quantity: parseInt(rows[l._id].qty, 10), barcode: rows[l._id].barcode || undefined }));
    if (items.length === 0) return toast.error('Enter the quantity received for at least one item');
    for (const it of items) {
      const l = pendingLines.find((x) => x._id === it.poItemId);
      if (it.quantity > l.quantity - l.receivedQty) return toast.error(`${l.productName}: only ${l.quantity - l.receivedQty} still pending`);
    }
    try {
      const res = await receive({ id: order._id, items, vendorInvoiceNo: vendorInvoiceNo || undefined, paidAmount: parseFloat(paid) || 0, paymentMode: mode }).unwrap();
      toast.success(`Received against ${res.data.purchase.purchaseNo} — order is now ${res.data.purchaseOrder.status}`);
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="p-4 rounded-xl border border-surface-200 bg-surface-50 space-y-3">
      <p className="font-bold text-surface-900">Receive goods — creates a purchase, adds stock and credits the vendor</p>
      {pendingLines.map((l) => (
        <div key={l._id} className="grid grid-cols-12 gap-2 items-center">
          <span className="col-span-6"><strong>{l.productName}</strong> <span className="text-surface-500">{l.metal} {l.purity} · pending {l.quantity - l.receivedQty}</span></span>
          <input type="number" min="0" max={l.quantity - l.receivedQty} placeholder="Qty" value={rows[l._id]?.qty} onChange={(e) => setRows({ ...rows, [l._id]: { ...rows[l._id], qty: e.target.value } })} className="col-span-2 rounded border border-surface-300 p-1 text-center font-bold" />
          <input placeholder="Barcode (auto)" value={rows[l._id]?.barcode} onChange={(e) => setRows({ ...rows, [l._id]: { ...rows[l._id], barcode: e.target.value } })} className="col-span-4 rounded border border-surface-300 p-1 font-mono uppercase text-xs" />
        </div>
      ))}
      <div className="grid grid-cols-3 gap-3">
        <Input label="Vendor bill no" value={vendorInvoiceNo} onChange={(e) => setVendorInvoiceNo(e.target.value)} />
        <Input label="Pay now ₹" type="number" value={paid} onChange={(e) => setPaid(e.target.value)} />
        <div>
          <label className="text-[11px] font-bold uppercase text-surface-600">Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-300 p-2 bg-white text-xs font-semibold">
            {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onBack}>Back</Button>
        <Button size="sm" variant="primary" icon={PackageCheck} isLoading={isLoading} onClick={submit}>Receive Goods</Button>
      </div>
    </div>
  );
};

export const PurchaseOrderDetailModal = ({ orderId, role, onClose, onEdit }) => {
  const { data, isLoading } = useGetPurchaseOrderByIdQuery(orderId, { skip: !orderId });
  const [act, { isLoading: acting }] = usePoActionMutation();
  const [view, setView] = useState('main');
  const [reason, setReason] = useState('');
  const po = data?.data;

  useEffect(() => { setView('main'); setReason(''); }, [orderId]);

  const run = async (action, body, ok) => {
    try {
      await act({ id: po._id, action, ...body }).unwrap();
      toast.success(ok);
      setView('main'); setReason('');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const buyer = CAN_BUY.includes(role);
  const approver = CAN_APPROVE_PO.includes(role);
  const st = po?.status;
  const needReason = (action, label, ok) => (
    <div className="p-4 rounded-xl border border-surface-200 bg-surface-50 space-y-3">
      <Input label={`Reason ${action === 'close' ? '(required only to short-close)' : '*'}`} value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={() => setView('main')}>Back</Button>
        <Button size="sm" variant="danger" isLoading={acting} onClick={() => { if (action !== 'close' && reason.trim().length < 3) return toast.error('Enter a reason'); run(action, { reason: reason.trim() }, ok); }}>{label}</Button>
      </div>
    </div>
  );

  return (
    <Modal isOpen={Boolean(orderId)} onClose={onClose} title={po ? `Purchase Order ${po.poNo}` : 'Purchase Order'} subtitle={po ? `${po.vendorId?.company || po.vendorId?.name || ''} · ${formatDate(po.poDate)}` : ''} maxWidth="max-w-4xl">
      {isLoading || !po ? <Skeleton className="h-64 w-full" /> : (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant={poStatusVariant(st)}>{st.replace('_', ' ')}</Badge>
            {po.expectedDeliveryDate && <span className="text-surface-500">Expected {formatDate(po.expectedDeliveryDate)}</span>}
            <span className="text-surface-500">Estimated value <strong>{formatCurrency(po.estimatedTotal)}</strong></span>
            {st === 'REJECTED' && <span className="text-red-600 font-semibold">Rejected: {po.rejectionReason}</span>}
          </div>

          <div className="overflow-x-auto border border-surface-200 rounded-xl">
            <table className="w-full text-left">
              <thead className="bg-surface-50 text-[10px] uppercase font-bold text-surface-600 border-b border-surface-200">
                <tr><th className="p-2">Item</th><th className="p-2">Purity</th><th className="p-2 text-center">Ordered</th><th className="p-2 text-center">Received</th><th className="p-2 text-center">Pending</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Est. amount</th></tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {po.items.map((i) => (
                  <tr key={i._id}>
                    <td className="p-2 font-bold text-surface-900">{i.productName}</td>
                    <td className="p-2">{i.metal} {i.purity}</td>
                    <td className="p-2 text-center">{i.quantity}</td>
                    <td className="p-2 text-center text-emerald-700 font-bold">{i.receivedQty}</td>
                    <td className="p-2 text-center text-amber-600 font-bold">{i.pendingQty}</td>
                    <td className="p-2 text-right">{formatCurrency(i.rate)}/g</td>
                    <td className="p-2 text-right">{formatCurrency(i.estimatedAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {po.purchases?.length > 0 && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="font-bold text-emerald-900 mb-1">Goods received</p>
              {po.purchases.map((p) => (
                <div key={p._id} className="flex justify-between text-emerald-900"><span className="font-mono">{p.purchaseNo} · {formatDate(p.purchaseDate)}{p.status === 'CANCELLED' ? ' (cancelled)' : ''}</span><span className="font-bold">{formatCurrency(p.grandTotal)}</span></div>
              ))}
            </div>
          )}

          <div>
            <p className="font-bold uppercase tracking-wider text-surface-500 text-[10px] mb-1">Status history</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-surface-600">
              {po.statusHistory?.map((h, i) => <span key={i}>{h.status.replace('_', ' ')} · {formatDateTime(h.at)}{h.note ? ` (${h.note})` : ''}</span>)}
            </div>
          </div>

          {view === 'main' && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-100">
              {buyer && ['DRAFT', 'REJECTED'].includes(st) && <Button size="sm" variant="outline" onClick={() => onEdit(po)}>Edit</Button>}
              {buyer && st === 'DRAFT' && <Button size="sm" variant="primary" icon={Send} isLoading={acting} onClick={() => run('submit', {}, 'Submitted for approval')}>Submit for Approval</Button>}
              {approver && st === 'SUBMITTED' && (
                <>
                  <Button size="sm" variant="success" icon={CheckCircle} isLoading={acting} onClick={() => run('approve', { note: '' }, 'Order approved')}>Approve</Button>
                  <Button size="sm" variant="outline" icon={XCircle} onClick={() => setView('reject')}>Reject</Button>
                </>
              )}
              {buyer && st === 'APPROVED' && <Button size="sm" variant="goldSoft" icon={Truck} isLoading={acting} onClick={() => run('order', {}, 'Marked as ordered from vendor')}>Mark as Ordered</Button>}
              {buyer && ['ORDERED', 'PARTIALLY_RECEIVED'].includes(st) && <Button size="sm" variant="primary" icon={PackageCheck} onClick={() => setView('receive')}>Receive Goods</Button>}
              {buyer && ['RECEIVED', 'PARTIALLY_RECEIVED'].includes(st) && <Button size="sm" variant="outline" icon={Lock} onClick={() => setView('close')}>{st === 'RECEIVED' ? 'Close Order' : 'Short-close'}</Button>}
              {(buyer || approver) && ['DRAFT', 'SUBMITTED', 'REJECTED', 'APPROVED', 'ORDERED'].includes(st) && po.receipts?.length === 0 && (
                <Button size="sm" variant="outline" icon={XCircle} onClick={() => setView('cancel')} className="text-red-600 border-red-200 hover:bg-red-50">Cancel Order</Button>
              )}
            </div>
          )}
          {view === 'reject' && needReason('reject', 'Reject Order', 'Order rejected')}
          {view === 'cancel' && needReason('cancel', 'Cancel Order', 'Order cancelled')}
          {view === 'close' && needReason('close', 'Close Order', 'Order closed')}
          {view === 'receive' && <ReceiveForm order={po} onBack={() => setView('main')} onDone={() => setView('main')} />}
        </div>
      )}
    </Modal>
  );
};
