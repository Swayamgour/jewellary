import React, { useState, useEffect } from 'react';
import { Search, Receipt, Users, Package, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGetInventoryQuery, useGetCustomersQuery, useGetPakkaBillsQuery } from '../../app/api/baseApi';
import { formatCurrency } from '../../utils/formatters';

export const GlobalSearchModal = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const { data: invData } = useGetInventoryQuery({ search: searchTerm }, { skip: !searchTerm || searchTerm.length < 2 });
  const { data: custData } = useGetCustomersQuery({ search: searchTerm }, { skip: !searchTerm || searchTerm.length < 2 });
  const { data: billData } = useGetPakkaBillsQuery({ search: searchTerm }, { skip: !searchTerm || searchTerm.length < 2 });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const handleSelect = (path) => {
    navigate(path);
    onClose();
    setSearchTerm('');
  };

  const inventoryItems = invData?.data || [];
  const customers = custData?.data || [];
  const bills = billData?.data || [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-surface-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-surface-200 overflow-hidden z-10">
        <div className="flex items-center px-4 py-3 border-b border-surface-200 bg-surface-50/50">
          <Search className="w-5 h-5 text-gold-600 mr-3 shrink-0" />
          <input
            autoFocus
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search bills, customers, barcodes, or products... (Ctrl+K)"
            className="w-full bg-transparent text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none"
          />
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-200 text-surface-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-4 space-y-4">
          {!searchTerm || searchTerm.length < 2 ? (
            <div className="text-center py-8 text-surface-400 text-xs">
              Type at least 2 characters to search across Bills, Barcodes, and Customers
            </div>
          ) : (
            <>
              {/* Bills */}
              {bills.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-2 px-2 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-gold-500" /> Invoices
                  </p>
                  <div className="space-y-1">
                    {bills.slice(0, 3).map((b) => (
                      <div
                        key={b._id}
                        onClick={() => handleSelect(`/billing/${b._id}`)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gold-50/60 cursor-pointer transition-colors border border-transparent hover:border-gold-200 text-xs"
                      >
                        <div>
                          <span className="font-bold text-surface-900">{b.invoiceNo}</span>
                          <span className="text-surface-500 ml-2">({b.customerSnapshot?.name || 'Walk-in'})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gold-700">{formatCurrency(b.grandTotal)}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-surface-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customers */}
              {customers.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-2 px-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-gold-500" /> Customers
                  </p>
                  <div className="space-y-1">
                    {customers.slice(0, 3).map((c) => (
                      <div
                        key={c._id}
                        onClick={() => handleSelect(`/customers/${c._id}`)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gold-50/60 cursor-pointer transition-colors border border-transparent hover:border-gold-200 text-xs"
                      >
                        <div>
                          <span className="font-bold text-surface-900">{c.name}</span>
                          <span className="text-surface-500 ml-2">📞 {c.mobile}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-surface-500">Balance: {formatCurrency(c.currentBalance)}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-surface-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inventory Barcodes */}
              {inventoryItems.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-2 px-2 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-gold-500" /> Inventory / Barcodes
                  </p>
                  <div className="space-y-1">
                    {inventoryItems.slice(0, 3).map((item) => (
                      <div
                        key={item._id}
                        onClick={() => handleSelect(`/inventory/${item._id}`)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gold-50/60 cursor-pointer transition-colors border border-transparent hover:border-gold-200 text-xs"
                      >
                        <div>
                          <span className="font-bold text-surface-900 font-mono">{item.barcode}</span>
                          <span className="text-surface-600 ml-2">{item.productId?.name || item.metal}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-surface-700">{item.grossWeight}g · {item.purity}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-surface-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bills.length === 0 && customers.length === 0 && inventoryItems.length === 0 && (
                <div className="text-center py-6 text-surface-400 text-xs">
                  No matches found for "{searchTerm}"
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
