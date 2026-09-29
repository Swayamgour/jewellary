import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Printer, ArrowLeft, Share2, FileCheck, CheckCircle, Pencil, RotateCcw, CreditCard, Coins, XCircle } from 'lucide-react';
import { useGetInvoiceByIdQuery } from '../../app/api/baseApi';
import { selectUserRole } from '../auth/authSlice';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { ConvertKachaModal } from './ConvertKachaModal';
import { CancelInvoiceModal } from './CancelInvoiceModal';
import { SalesReturnModal } from './SalesReturnModal';
import { CollectPaymentModal, ConfirmDraftModal, AdjustOldGoldModal } from './InvoicePaymentModals';
import { CAN_CANCEL, CAN_CONVERT, invoiceStatusVariant, paymentStatusVariant } from '../../utils/constants';
import { formatCurrency, formatCurrencyPrecise, formatWeight, formatDate, formatDateTime } from '../../utils/formatters';

export const InvoiceDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = useSelector(selectUserRole);

  const [modal, setModal] = useState(null); // convert | cancel | return | pay | confirm | gold
  const [isThermal, setIsThermal] = useState(false);

  const { data, isLoading } = useGetInvoiceByIdQuery(id);
  const invoice = data?.data;

  // arriving from the POS "Confirm draft" button
  const presetPayments = location.state?.payments;
  useEffect(() => {
    if (searchParams.get('confirm') === '1' && invoice?.status === 'DRAFT') {
      setModal('confirm');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, invoice, setSearchParams]);

  useEffect(() => {
    if (searchParams.get('print') === 'true' && invoice) setTimeout(() => window.print(), 300);
  }, [searchParams, invoice]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (!invoice) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-bold text-surface-900">Invoice Not Found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/billing')}>Back to Register</Button>
      </div>
    );
  }

  const isKacha = invoice.billType === 'KACHA';
  const isDraft = invoice.status === 'DRAFT';
  const isLive = invoice.status === 'CONFIRMED';
  const isCancelled = invoice.status === 'CANCELLED';
  const isConverted = invoice.status === 'CONVERTED';
  const customer = invoice.customerSnapshot || {};
  const branch = invoice.branchId || {};
  const ps = invoice.paymentSummary || {};
  const shopName = branch.name || 'Jewellery Shop';
  const returned = invoice.returnedAmount || 0;
  const hasReturnable = invoice.items?.some((i) => (i.quantity || 0) > (i.returnedQty || 0));
  const payments = invoice.payments || [];
  const returns = invoice.salesReturns || [];

  const shareWhatsApp = () => {
    const mobile = (customer.mobile || '').replace(/\D/g, '');
    const text = encodeURIComponent(`Hello ${customer.name || 'Customer'},\nYour bill ${invoice.invoiceNo} for ${formatCurrency(invoice.grandTotal)} from ${shopName} is ready.\nThank you!`);
    window.open(`https://wa.me/${mobile.length === 10 ? '91' : ''}${mobile}?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Action bar */}
      <div className="no-print flex flex-col gap-3 bg-white p-4 rounded-2xl border border-surface-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" icon={ArrowLeft} onClick={() => navigate('/billing')}>Back</Button>
            <div>
              <h1 className="text-lg font-black text-surface-900 font-display flex items-center gap-2 flex-wrap">
                <span className="font-mono">{invoice.invoiceNo}</span>
                <Badge variant={isKacha ? 'kacha' : 'pakka'}>{invoice.billType}</Badge>
                <Badge variant={invoiceStatusVariant(invoice.status)}>{invoice.status}</Badge>
                {isLive && <Badge variant={paymentStatusVariant(invoice.paymentStatus)}>{invoice.paymentStatus}</Badge>}
                {isLive && invoice.returnStatus !== 'NONE' && <Badge variant="info">{invoice.returnStatus} RETURN</Badge>}
              </h1>
              <p className="text-xs text-surface-500">{formatDateTime(invoice.invoiceDate || invoice.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" icon={Share2} onClick={shareWhatsApp}>WhatsApp</Button>
            <Button variant={isThermal ? 'primary' : 'outline'} size="sm" onClick={() => setIsThermal(!isThermal)}>{isThermal ? 'A4 View' : 'POS Slip'}</Button>
            <Button variant="primary" size="sm" icon={Printer} onClick={() => window.print()}>Print</Button>
          </div>
        </div>

        {/* Lifecycle actions */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-surface-100">
          {isDraft && (
            <>
              <Button variant="success" size="sm" icon={CheckCircle} onClick={() => setModal('confirm')}>Confirm Bill</Button>
              <Button variant="outline" size="sm" icon={Pencil} onClick={() => navigate(`/billing/new?draft=${invoice._id}`)}>Edit Draft</Button>
            </>
          )}
          {isLive && (ps.due || 0) > 0 && (
            <>
              <Button variant="primary" size="sm" icon={CreditCard} onClick={() => setModal('pay')}>Collect Payment</Button>
              <Button variant="goldSoft" size="sm" icon={Coins} onClick={() => setModal('gold')}>Adjust Old Gold</Button>
            </>
          )}
          {isKacha && isLive && CAN_CONVERT.includes(role) && (
            <Button variant="goldSoft" size="sm" icon={FileCheck} onClick={() => setModal('convert')}>Convert to Pakka</Button>
          )}
          {isLive && hasReturnable && (
            <Button variant="outline" size="sm" icon={RotateCcw} onClick={() => setModal('return')}>Sales Return</Button>
          )}
          {(isLive || isDraft) && CAN_CANCEL.includes(role) && (
            <Button variant="outline" size="sm" icon={XCircle} onClick={() => setModal('cancel')} className="text-red-600 border-red-200 hover:bg-red-50">Cancel Bill</Button>
          )}
          {isConverted && invoice.convertedToPakkaBillId && (
            <span className="text-xs text-surface-600">
              Converted to Pakka invoice{' '}
              <Link className="font-mono font-bold text-gold-800 underline" to={`/billing/${invoice.convertedToPakkaBillId._id || invoice.convertedToPakkaBillId}`}>
                {invoice.convertedToPakkaBillId.invoiceNo || 'view'}
              </Link>
            </span>
          )}
          {invoice.convertedFromKachaBillId && (
            <span className="text-xs text-surface-600">
              Converted from Kacha{' '}
              <Link className="font-mono font-bold text-gold-800 underline" to={`/billing/${invoice.convertedFromKachaBillId._id || invoice.convertedFromKachaBillId}`}>
                {invoice.convertedFromKachaBillId.invoiceNo || 'view'}
              </Link>
            </span>
          )}
          {isCancelled && <span className="text-xs text-red-600 font-semibold">Cancelled: {invoice.cancellationReason}</span>}
        </div>

        {isCancelled && invoice.cancellationSummary && invoice.cancellationSummary.paymentAction !== 'NONE' && (
          <div className="text-xs p-3 rounded-xl bg-surface-50 border border-surface-200 text-surface-600">
            Payments on cancellation:{' '}
            {invoice.cancellationSummary.cashRefunded > 0 && <strong>{formatCurrency(invoice.cancellationSummary.cashRefunded)} refunded</strong>}
            {invoice.cancellationSummary.creditRetained > 0 && <strong>{formatCurrency(invoice.cancellationSummary.creditRetained)} kept as customer credit</strong>}
          </div>
        )}
      </div>

      {/* Invoice document */}
      <div className={`relative bg-white p-8 sm:p-10 rounded-2xl border border-surface-200 shadow-sm print-page ${isThermal ? 'max-w-sm mx-auto font-mono text-xs' : 'w-full'}`}>
        {(isDraft || isCancelled || isConverted) && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
            <span className={`text-7xl font-black -rotate-12 opacity-10 ${isCancelled ? 'text-red-600' : 'text-surface-500'}`}>{invoice.status}</span>
          </div>
        )}

        <div className="flex justify-between items-start pb-6 border-b border-surface-200">
          <div>
            <h2 className="text-xl font-black text-surface-900 tracking-tight font-display uppercase">{shopName}</h2>
            <p className="text-[11px] uppercase font-bold tracking-widest text-gold-700">Fine Gold, Silver & Diamond Jewellery</p>
            <div className="text-xs text-surface-500 mt-2 space-y-0.5">
              {branch.address?.street && <p>{branch.address.street}</p>}
              <p>{[branch.address?.city, branch.address?.state, branch.address?.pincode].filter(Boolean).join(', ')}</p>
              {branch.phone && <p>Tel: {branch.phone}</p>}
              {branch.gstin && <p className="font-mono font-bold text-surface-800">GSTIN: {branch.gstin}</p>}
            </div>
          </div>
          <div className="text-right">
            <span className={`inline-block px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider ${isKacha ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
              {isKacha ? 'ESTIMATION BILL' : 'TAX INVOICE'}
            </span>
            <div className="text-xs text-surface-600 mt-3 space-y-1">
              <p><span className="text-surface-400">Invoice No:</span> <strong className="font-mono text-surface-900 text-sm">{invoice.invoiceNo}</strong></p>
              <p><span className="text-surface-400">Date:</span> <strong>{formatDate(invoice.invoiceDate || invoice.createdAt)}</strong></p>
              {branch.address?.state && <p><span className="text-surface-400">Place of supply:</span> <strong>{branch.address.state}</strong></p>}
            </div>
          </div>
        </div>

        <div className="py-4 border-b border-surface-200 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block mb-1">Billed To</span>
          <h4 className="font-bold text-surface-900 text-sm">{customer.name || 'Customer'}</h4>
          <p className="text-surface-600 mt-0.5">📞 {customer.mobile || '-'}</p>
          {customer.address && <p className="text-surface-500 mt-0.5">{customer.address}</p>}
          {customer.gstin && <p className="font-mono text-surface-800 font-semibold mt-1">GSTIN: {customer.gstin}</p>}
        </div>

        <div className="py-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-50 text-[10px] uppercase font-bold text-surface-600 border-y border-surface-200">
              <tr>
                <th className="py-2.5 px-2">#</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-2">HSN</th>
                <th className="py-2.5 px-2">Purity</th>
                <th className="py-2.5 px-2 text-center">Qty</th>
                <th className="py-2.5 px-2 text-right">Net Wt</th>
                <th className="py-2.5 px-2 text-right">Rate</th>
                <th className="py-2.5 px-2 text-right">Making</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {invoice.items?.map((item, idx) => (
                <tr key={item._id || idx}>
                  <td className="py-2 px-2 text-surface-400 font-bold">{idx + 1}</td>
                  <td className="py-2 px-3">
                    <p className="font-bold text-surface-900">{item.productName}</p>
                    {item.barcode && <span className="font-mono text-[10px] text-surface-500">{item.barcode}</span>}
                    {item.returnedQty > 0 && <span className="ml-2 text-[10px] font-bold text-sky-700">({item.returnedQty} returned)</span>}
                  </td>
                  <td className="py-2 px-2 font-mono text-surface-500">{item.hsnCode || '7113'}</td>
                  <td className="py-2 px-2 font-bold text-surface-800">{item.purity}</td>
                  <td className="py-2 px-2 text-center">{item.quantity}</td>
                  <td className="py-2 px-2 text-right font-semibold text-surface-800">{formatWeight((item.netWeight || 0) * (item.quantity || 1))}</td>
                  <td className="py-2 px-2 text-right">{formatCurrency(item.goldRate)}</td>
                  <td className="py-2 px-2 text-right">{formatCurrency((item.makingAmount || 0) + (item.wastageAmount || 0))}</td>
                  <td className="py-2 px-3 text-right font-bold text-surface-900">{formatCurrency(item.taxableAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-4 border-t border-surface-200 flex flex-col sm:flex-row justify-between gap-6 text-xs">
          <div className="space-y-3 flex-1">
            {payments.length > 0 && (
              <div className="p-3 rounded-xl bg-surface-50 border border-surface-200">
                <span className="font-bold text-surface-800 block mb-1.5 uppercase text-[10px]">Payment history</span>
                <div className="space-y-1">
                  {payments.map((p) => (
                    <div key={p._id} className={`flex justify-between gap-3 text-surface-600 ${p.status === 'REVERSED' ? 'line-through opacity-50' : ''}`}>
                      <span>{formatDate(p.paymentDate)} · {p.paymentMode === 'EXCHANGE' ? 'Old gold' : p.paymentMode}{p.direction === 'OUT' ? ' (refund)' : ''}</span>
                      <span className={`font-bold ${p.direction === 'OUT' ? 'text-red-600' : 'text-surface-900'}`}>{p.direction === 'OUT' ? '-' : ''}{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {returns.length > 0 && (
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200">
                <span className="font-bold text-sky-900 block mb-1.5 uppercase text-[10px]">Sales returns</span>
                {returns.map((r) => (
                  <div key={r._id} className="flex justify-between text-sky-900">
                    <span>{r.returnNo} · {formatDate(r.returnDate)}</span>
                    <span className="font-bold">{formatCurrency(r.totalRefundAmount)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="text-[11px] text-surface-400 space-y-1">
              <p>• All jewellery is guaranteed for the stated purity and hallmark.</p>
              <p>• Making charges and wastage are non-refundable on return.</p>
              {invoice.notes && <p>• {invoice.notes}</p>}
            </div>
          </div>

          <div className="w-full sm:w-72 space-y-2 text-xs">
            <Line label="Subtotal" value={invoice.subtotal} />
            {invoice.discount > 0 && <Line label="Discount" value={-invoice.discount} className="text-emerald-600" />}
            <Line label="Taxable amount" value={invoice.taxableAmount} bold />
            {!isKacha && invoice.tax && (
              <div className="space-y-1 text-surface-600 pt-1 border-t border-surface-100 text-[11px]">
                {invoice.tax.isInterState ? (
                  <Line label="IGST (3%)" value={invoice.tax.igstAmount} />
                ) : (
                  <>
                    <Line label="CGST (1.5%)" value={invoice.tax.cgstAmount} />
                    <Line label="SGST (1.5%)" value={invoice.tax.sgstAmount} />
                  </>
                )}
              </div>
            )}
            {invoice.roundOff !== 0 && <Line label="Round off" value={invoice.roundOff} precise />}
            <div className="p-3 bg-gold-50/70 border border-gold-300 rounded-xl flex justify-between items-center text-sm font-extrabold text-surface-900">
              <span>Grand Total</span>
              <span className="text-xl font-display font-black text-gold-950">{formatCurrency(invoice.grandTotal)}</span>
            </div>

            {isLive || isCancelled ? (
              <div className="pt-2 space-y-1 font-semibold">
                {returned > 0 && <Line label="Less: sales returns" value={-returned} className="text-sky-700" />}
                {returned > 0 && <Line label="Net payable" value={ps.netPayable} bold />}
                <Line label="Received" value={ps.paid} className="text-emerald-700" />
                {ps.exchangeAdjusted > 0 && <Line label="  of which old gold" value={ps.exchangeAdjusted} className="text-surface-500 font-normal" />}
                {ps.refunded > 0 && <Line label="Refunded" value={-ps.refunded} className="text-red-600" />}
                {!isCancelled && <Line label="Balance due" value={ps.due} className={ps.due > 0 ? 'text-amber-600 font-extrabold' : 'text-emerald-700'} />}
                {ps.excessReceived > 0 && <Line label="Customer credit" value={ps.excessReceived} className="text-emerald-700" />}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-surface-200 flex justify-between items-end text-xs text-surface-500">
          <p>Customer Signature</p>
          <div className="text-right">
            <p className="font-bold text-surface-800">For {shopName.toUpperCase()}</p>
            <p className="mt-8">Authorized Signatory</p>
          </div>
        </div>
      </div>

      <ConvertKachaModal isOpen={modal === 'convert'} onClose={() => setModal(null)} kachaBill={invoice} />
      <CancelInvoiceModal isOpen={modal === 'cancel'} onClose={() => setModal(null)} invoice={invoice} />
      <SalesReturnModal isOpen={modal === 'return'} onClose={() => setModal(null)} invoice={invoice} />
      <CollectPaymentModal isOpen={modal === 'pay'} onClose={() => setModal(null)} invoice={invoice} />
      <AdjustOldGoldModal isOpen={modal === 'gold'} onClose={() => setModal(null)} invoice={invoice} />
      <ConfirmDraftModal isOpen={modal === 'confirm'} onClose={() => setModal(null)} invoice={invoice} presetPayments={presetPayments} />
    </div>
  );
};

const Line = ({ label, value, className = '', bold = false, precise = false }) => (
  <div className={`flex justify-between ${bold ? 'font-bold text-surface-800 pt-1 border-t border-surface-100' : 'text-surface-600'} ${className}`}>
    <span>{label}</span>
    <span className={bold ? '' : 'font-semibold text-surface-900'}>
      {value < 0 ? '-' : ''}
      {precise ? formatCurrencyPrecise(Math.abs(value || 0)) : formatCurrency(Math.abs(value || 0))}
    </span>
  </div>
);
