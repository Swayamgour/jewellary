import React, { useState, useEffect } from 'react';
import { CreditCard } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useRecordPaymentMutation, useGetCustomersQuery, useGetVendorsQuery, useGetInvoicesQuery, useGetPurchasesQuery } from '../../app/api/baseApi';
import { PAYMENT_MODES } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errors';
import { toast } from 'sonner';

/** A free-standing payment: pick the party, then optionally the open bill it should settle. */
export const RecordPaymentModal = ({ isOpen, onClose }) => {
  const [record, { isLoading }] = useRecordPaymentMutation();
  const [entityType, setEntityType] = useState('CUSTOMER');
  const [partySearch, setPartySearch] = useState('');
  const [party, setParty] = useState(null);
  const [refType, setRefType] = useState('DIRECT');
  const [refId, setRefId] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('CASH');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) { setEntityType('CUSTOMER'); setPartySearch(''); setParty(null); setRefType('DIRECT'); setRefId(''); setAmount(''); setMode('CASH'); setNotes(''); }
  }, [isOpen]);

  const { data: custData } = useGetCustomersQuery({ search: partySearch || undefined, limit: 8 }, { skip: entityType !== 'CUSTOMER' || !isOpen });
  const { data: vendData } = useGetVendorsQuery({ search: partySearch || undefined, limit: 8 }, { skip: entityType !== 'VENDOR' || !isOpen });
  const partyList = entityType === 'CUSTOMER' ? custData?.data || [] : vendData?.data || [];

  const { data: billData } = useGetInvoicesQuery({ customerId: party?._id, status: 'CONFIRMED', dueOnly: 'true', limit: 30 }, { skip: entityType !== 'CUSTOMER' || !party || refType !== 'INVOICE' });
  const { data: purData } = useGetPurchasesQuery({ vendorId: party?._id, status: 'COMPLETED', limit: 30 }, { skip: entityType !== 'VENDOR' || !party || refType !== 'PURCHASE' });
  const openBills = (billData?.data || []).filter((b) => (b.paymentSummary?.due || 0) > 0);
  const openPurchases = (purData?.data || []).filter((p) => (p.dueAmount || 0) > 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!party) return toast.error(`Select a ${entityType === 'CUSTOMER' ? 'customer' : 'vendor'}`);
    const amt = parseFloat(amount);
    if (!(amt > 0)) return toast.error('Enter a valid amount');
    if (refType !== 'DIRECT' && !refId) return toast.error('Select which bill this payment is against');
    try {
      await record({
        referenceType: refType,
        referenceId: refType === 'DIRECT' ? undefined : refId,
        entityType,
        entityId: party._id,
        amount: amt,
        paymentMode: mode,
        notes: notes || undefined
      }).unwrap();
      toast.success('Payment recorded');
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to record payment'));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Payment" subtitle="A receipt from a customer or a payment to a vendor" maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-4 text-xs">
        <div className="flex gap-2">
          {['CUSTOMER', 'VENDOR'].map((t) => (
            <button key={t} type="button" onClick={() => { setEntityType(t); setParty(null); setRefType('DIRECT'); }} className={`flex-1 px-3 py-2 rounded-lg border font-bold ${entityType === t ? 'bg-gold-500 text-white border-gold-500' : 'bg-white border-surface-200 text-surface-600'}`}>{t === 'CUSTOMER' ? 'Customer Receipt' : 'Vendor Payment'}</button>
          ))}
        </div>

        {party ? (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-50 border border-surface-200">
            <span className="font-bold text-surface-900">{party.company || party.name} {party.mobile ? `· ${party.mobile}` : ''}</span>
            <button type="button" onClick={() => setParty(null)} className="text-[11px] font-bold text-gold-700">change</button>
          </div>
        ) : (
          <div>
            <Input placeholder={`Search ${entityType.toLowerCase()}...`} value={partySearch} onChange={(e) => setPartySearch(e.target.value)} />
            {partySearch.length > 1 && (
              <div className="mt-1 max-h-40 overflow-y-auto border border-surface-200 rounded-xl">
                {partyList.map((p) => (
                  <button type="button" key={p._id} onClick={() => { setParty(p); setPartySearch(''); }} className="w-full text-left px-3 py-2 hover:bg-gold-50 border-b border-surface-100 last:border-0">
                    <strong>{p.company || p.name}</strong> {p.mobile ? `· ${p.mobile}` : ''}
                  </button>
                ))}
                {partyList.length === 0 && <p className="px-3 py-2 text-surface-400">No matches</p>}
              </div>
            )}
          </div>
        )}

        {party && (
          <div>
            <label className="text-[11px] font-bold uppercase text-surface-600">Apply against</label>
            <select value={refType} onChange={(e) => { setRefType(e.target.value); setRefId(''); }} className="mt-1 w-full rounded-lg border border-surface-300 p-2 font-semibold bg-white">
              <option value="DIRECT">General account (not tied to a bill)</option>
              {entityType === 'CUSTOMER' && <option value="INVOICE">A specific bill</option>}
              {entityType === 'VENDOR' && <option value="PURCHASE">A specific purchase</option>}
            </select>
            {refType === 'INVOICE' && (
              <select value={refId} onChange={(e) => setRefId(e.target.value)} className="mt-2 w-full rounded-lg border border-surface-300 p-2 font-semibold bg-white">
                <option value="">Select bill…</option>
                {openBills.map((b) => <option key={b._id} value={b._id}>{b.invoiceNo} — due {formatCurrency(b.paymentSummary.due)}</option>)}
              </select>
            )}
            {refType === 'PURCHASE' && (
              <select value={refId} onChange={(e) => setRefId(e.target.value)} className="mt-2 w-full rounded-lg border border-surface-300 p-2 font-semibold bg-white">
                <option value="">Select purchase…</option>
                {openPurchases.map((p) => <option key={p._id} value={p._id}>{p.purchaseNo} — due {formatCurrency(p.dueAmount)}</option>)}
              </select>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Amount (₹) *" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <div>
            <label className="text-[11px] font-bold uppercase text-surface-600">Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-300 p-2 font-semibold bg-white">
              {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <Input label="Note" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
          <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" isLoading={isLoading} icon={CreditCard}>Record</Button>
        </div>
      </form>
    </Modal>
  );
};
