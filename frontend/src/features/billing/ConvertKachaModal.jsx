import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, FileCheck, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useConvertKachaToPakkaMutation } from '../../app/api/baseApi';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'sonner';

export const ConvertKachaModal = ({ isOpen, onClose, kachaBill }) => {
  const [convertKachaToPakka, { isLoading }] = useConvertKachaToPakkaMutation();
  const [convertedInvoice, setConvertedInvoice] = useState(null);
  const navigate = useNavigate();

  if (!kachaBill) return null;

  const handleConvert = async () => {
    try {
      const res = await convertKachaToPakka(kachaBill._id).unwrap();
      toast.success('Successfully converted to Pakka GST Invoice!');
      setConvertedInvoice(res.data);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to convert bill to Pakka');
    }
  };

  const handleClose = () => {
    setConvertedInvoice(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={convertedInvoice ? 'Pakka Invoice Generated' : 'Convert Kacha Bill to GST Invoice'}
      subtitle={
        convertedInvoice
          ? 'Official Tax invoice created and customer ledger adjusted'
          : 'Atomic conversion generates an official GST Invoice with tax recalculation'
      }
      maxWidth="max-w-md"
    >
      {convertedInvoice ? (
        <div className="text-center py-4 space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mb-2">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <span className="text-xs font-bold text-surface-500 uppercase tracking-wider">
              GST Invoice Number
            </span>
            <h3 className="text-2xl font-black text-surface-900 font-mono mt-1">
              {convertedInvoice.invoiceNo}
            </h3>
            <p className="text-sm font-bold text-gold-700 mt-1">
              Grand Total: {formatCurrency(convertedInvoice.grandTotal)}
            </p>
          </div>

          <div className="p-3 bg-surface-50 rounded-xl text-xs text-surface-600 border border-surface-200 text-left">
            <p className="font-semibold text-surface-800">Original Kacha: {kachaBill.invoiceNo}</p>
            <p className="mt-1">
              Applied 3% GST. Inventory remains securely locked without duplicate deduction.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                handleClose();
                navigate(`/billing/${convertedInvoice._id}`);
              }}
            >
              View Invoice
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => {
                handleClose();
                navigate(`/billing/${convertedInvoice._id}?print=true`);
              }}
            >
              Print Tax Bill
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-gold-50/70 border border-gold-200/80 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-surface-500">Kacha Bill No:</span>
              <span className="font-mono font-bold text-surface-900">{kachaBill.invoiceNo}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-surface-500">Customer:</span>
              <span className="font-bold text-surface-900">
                {kachaBill.customerSnapshot?.name || 'Walk-in'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-surface-500">Original Amount:</span>
              <span className="font-extrabold text-gold-900 text-sm">
                {formatCurrency(kachaBill.grandTotal)}
              </span>
            </div>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              This action will mark the Kacha bill as CONVERTED and create an authoritative Pakka GST
              Invoice with 3% jewellery tax and HSN 7113.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-surface-200">
            <Button variant="outline" type="button" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={handleConvert}
              isLoading={isLoading}
              icon={FileCheck}
            >
              Convert to Pakka Bill
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
