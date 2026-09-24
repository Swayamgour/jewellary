import React, { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Printer,
  ArrowLeft,
  Share2,
  FileCheck,
  Coins,
  Receipt,
  Download,
  CheckCircle,
  Building
} from 'lucide-react';
import {
  useGetKachaBillByIdQuery,
  useGetPakkaBillByIdQuery
} from '../../app/api/baseApi';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { ConvertKachaModal } from './ConvertKachaModal';
import { formatCurrency, formatWeight, formatDate, formatDateTime } from '../../utils/formatters';
import { toast } from 'sonner';

export const InvoiceDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [isThermal, setIsThermal] = useState(false);

  // Attempt to fetch from Pakka first, fallback to Kacha
  const { data: pakkaData, isLoading: pakkaLoading } = useGetPakkaBillByIdQuery(id);
  const { data: kachaData, isLoading: kachaLoading } = useGetKachaBillByIdQuery(id, {
    skip: Boolean(pakkaData?.data)
  });

  const invoice = pakkaData?.data || kachaData?.data;
  const isLoading = pakkaLoading && kachaLoading;

  useEffect(() => {
    if (searchParams.get('print') === 'true' && invoice) {
      window.print();
    }
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
        <Button variant="outline" className="mt-4" onClick={() => navigate('/billing')}>
          Back to Register
        </Button>
      </div>
    );
  }

  const isKacha = invoice.billType === 'KACHA';
  const customer = invoice.customerSnapshot || invoice.customerId;
  const branch = invoice.branchId;

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const mobile = customer?.mobile ? customer.mobile.replace(/\D/g, '') : '';
    const text = encodeURIComponent(
      `Hello ${customer?.name || 'Customer'},\nYour jewellery bill ${invoice.invoiceNo} for ${formatCurrency(
        invoice.grandTotal
      )} from Aura Jewel is ready.\nThank you for choosing us!`
    );
    window.open(`https://wa.me/91${mobile}?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Top Action Bar (Hidden during print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-surface-200 shadow-xs">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" icon={ArrowLeft} onClick={() => navigate('/billing')}>
            Back
          </Button>
          <div>
            <h1 className="text-lg font-black text-surface-900 font-display flex items-center gap-2">
              <span>{invoice.invoiceNo}</span>
              <Badge variant={isKacha ? 'kacha' : 'pakka'}>{invoice.billType}</Badge>
            </h1>
            <p className="text-xs text-surface-500">
              Generated on {formatDateTime(invoice.invoiceDate || invoice.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Convert to Pakka action if Kacha */}
          {isKacha && invoice.status !== 'CONVERTED' && (
            <Button
              variant="goldSoft"
              size="sm"
              icon={FileCheck}
              onClick={() => setConvertModalOpen(true)}
              className="font-bold"
            >
              Convert to Pakka
            </Button>
          )}

          <Button variant="outline" size="sm" icon={Share2} onClick={handleShareWhatsApp}>
            WhatsApp
          </Button>

          <Button
            variant={isThermal ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setIsThermal(!isThermal)}
          >
            {isThermal ? 'A4 View' : 'POS Slip'}
          </Button>

          <Button variant="primary" size="sm" icon={Printer} onClick={handlePrint}>
            Print Invoice
          </Button>
        </div>
      </div>

      {/* Invoice Document Layout (Designed for A4 and Thermal Slip printing) */}
      <div
        className={`bg-white p-8 sm:p-10 rounded-2xl border border-surface-200 shadow-sm print-page ${
          isThermal ? 'max-w-sm mx-auto font-mono text-xs' : 'w-full'
        }`}
      >
        {/* Company Header */}
        <div className="flex justify-between items-start pb-6 border-b border-surface-200">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-500 text-white font-black text-sm">
                AJ
              </div>
              <div>
                <h2 className="text-xl font-black text-surface-900 tracking-tight font-display">
                  AURA JEWEL EMPORIUM
                </h2>
                <p className="text-[11px] uppercase font-bold tracking-widest text-gold-700">
                  Fine Gold, Silver & Diamond Jewellery
                </p>
              </div>
            </div>

            <div className="text-xs text-surface-500 mt-2 space-y-0.5">
              <p>{branch?.address?.street || '101, Zaveri Bazaar, Kalbadevi'}</p>
              <p>
                {branch?.address?.city || 'Mumbai'}, {branch?.address?.state || 'Maharashtra'} -{' '}
                {branch?.address?.pincode || '400002'}
              </p>
              <p>Tel: {branch?.phone || '+91 22 2244 5566'} · Email: ho@jewelleryemporium.com</p>
              {branch?.gstin && <p className="font-mono font-bold text-surface-800">GSTIN: {branch.gstin}</p>}
            </div>
          </div>

          <div className="text-right">
            <span
              className={`inline-block px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider ${
                isKacha ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
              }`}
            >
              {isKacha ? 'ESTIMATION BILL' : 'TAX INVOICE'}
            </span>
            <div className="text-xs text-surface-600 mt-3 space-y-1">
              <p>
                <span className="text-surface-400">Invoice No:</span>{' '}
                <strong className="font-mono text-surface-900 text-sm">{invoice.invoiceNo}</strong>
              </p>
              <p>
                <span className="text-surface-400">Date:</span>{' '}
                <strong>{formatDate(invoice.invoiceDate || invoice.createdAt)}</strong>
              </p>
              <p>
                <span className="text-surface-400">Place of Supply:</span>{' '}
                <strong>{branch?.address?.state || 'Maharashtra (27)'}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Customer Snapshot */}
        <div className="py-4 border-b border-surface-200 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block mb-1">
              Billed To Customer
            </span>
            <h4 className="font-bold text-surface-900 text-sm">{customer?.name || 'Walk-in Customer'}</h4>
            <p className="text-surface-600 mt-0.5">📞 {customer?.mobile || '-'}</p>
            {customer?.address?.street && (
              <p className="text-surface-500 mt-0.5">
                {customer.address.street}, {customer.address.city}
              </p>
            )}
            {customer?.gstin && (
              <p className="font-mono text-surface-800 font-semibold mt-1">GSTIN: {customer.gstin}</p>
            )}
          </div>

          <div className="text-right text-surface-500 space-y-1">
            <p>
              Status:{' '}
              <strong className="text-surface-800 uppercase">{invoice.status}</strong>
            </p>
            <p>
              Payment Mode:{' '}
              <strong className="text-surface-800">{invoice.paymentStatus}</strong>
            </p>
          </div>
        </div>

        {/* Items Table */}
        <div className="py-4">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-50 text-[10px] uppercase font-bold text-surface-600 border-y border-surface-200">
              <tr>
                <th className="py-2.5 px-2">#</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-2">HSN</th>
                <th className="py-2.5 px-2">Purity</th>
                <th className="py-2.5 px-2 text-right">Gross Wt</th>
                <th className="py-2.5 px-2 text-right">Net Wt</th>
                <th className="py-2.5 px-2 text-right">Rate</th>
                <th className="py-2.5 px-2 text-right">Making</th>
                <th className="py-2.5 px-2 text-right">Wast%</th>
                <th className="py-2.5 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {invoice.items?.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-2 px-2 text-surface-400 font-bold">{idx + 1}</td>
                  <td className="py-2 px-3">
                    <p className="font-bold text-surface-900">{item.productName}</p>
                    {item.barcode && (
                      <span className="font-mono text-[10px] text-surface-500">{item.barcode}</span>
                    )}
                  </td>
                  <td className="py-2 px-2 font-mono text-surface-500">{item.hsnCode || '7113'}</td>
                  <td className="py-2 px-2 font-bold text-surface-800">{item.purity}</td>
                  <td className="py-2 px-2 text-right">{formatWeight(item.grossWeight)}</td>
                  <td className="py-2 px-2 text-right font-semibold text-surface-800">
                    {formatWeight(item.netWeight)}
                  </td>
                  <td className="py-2 px-2 text-right">{formatCurrency(item.goldRate)}</td>
                  <td className="py-2 px-2 text-right">{formatCurrency(item.makingAmount)}</td>
                  <td className="py-2 px-2 text-right">{item.wastagePercent || 0}%</td>
                  <td className="py-2 px-3 text-right font-bold text-surface-900">
                    {formatCurrency(item.taxableAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Calculation & Tax Summary */}
        <div className="pt-4 border-t border-surface-200 flex flex-col sm:flex-row justify-between gap-6 text-xs">
          <div className="space-y-3 flex-1">
            {invoice.paymentSummary?.payments?.length > 0 && (
              <div className="p-3 rounded-xl bg-surface-50 border border-surface-200">
                <span className="font-bold text-surface-800 block mb-1.5 uppercase text-[10px]">
                  Payment Receipts
                </span>
                <div className="space-y-1">
                  {invoice.paymentSummary.payments.map((p, i) => (
                    <div key={i} className="flex justify-between text-surface-600">
                      <span>{p.paymentMode}:</span>
                      <span className="font-bold text-surface-900">{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-[11px] text-surface-400 space-y-1">
              <p>• All gold jewellery is guaranteed for specified purity and hallmark.</p>
              <p>• Making charges and wastage are non-refundable on return.</p>
              <p>• Subject to Mumbai Jurisdiction.</p>
            </div>
          </div>

          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between text-surface-600">
              <span>Subtotal:</span>
              <span className="font-semibold text-surface-900">{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount:</span>
                <span>-{formatCurrency(invoice.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-surface-800 pt-1 border-t border-surface-100">
              <span>Taxable Amount:</span>
              <span>{formatCurrency(invoice.taxableAmount)}</span>
            </div>

            {/* GST Details */}
            {invoice.billType === 'PAKKA' && invoice.tax && (
              <div className="space-y-1 text-surface-600 pt-1 border-t border-surface-100 text-[11px]">
                {invoice.tax.isInterState ? (
                  <div className="flex justify-between">
                    <span>IGST (3.0%):</span>
                    <span>{formatCurrency(invoice.tax.igstAmount)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>CGST (1.5%):</span>
                      <span>{formatCurrency(invoice.tax.cgstAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST (1.5%):</span>
                      <span>{formatCurrency(invoice.tax.sgstAmount)}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="p-3 bg-gold-50/70 border border-gold-300 rounded-xl flex justify-between items-center text-sm font-extrabold text-surface-900">
              <span>Grand Total:</span>
              <span className="text-xl font-display font-black text-gold-950">
                {formatCurrency(invoice.grandTotal)}
              </span>
            </div>

            <div className="pt-2 flex justify-between text-xs font-bold">
              <span>Paid: {formatCurrency(invoice.paymentSummary?.paid || 0)}</span>
              <span
                className={
                  (invoice.paymentSummary?.due || 0) > 0 ? 'text-amber-600' : 'text-emerald-700'
                }
              >
                Due: {formatCurrency(invoice.paymentSummary?.due || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Signature Box */}
        <div className="mt-12 pt-6 border-t border-surface-200 flex justify-between items-end text-xs text-surface-500">
          <div>
            <p>Customer Signature</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-surface-800">For AURA JEWEL EMPORIUM</p>
            <p className="mt-8">Authorized Signatory</p>
          </div>
        </div>
      </div>

      {/* Convert Modal */}
      {isKacha && (
        <ConvertKachaModal
          isOpen={convertModalOpen}
          onClose={() => setConvertModalOpen(false)}
          kachaBill={invoice}
        />
      )}
    </div>
  );
};
