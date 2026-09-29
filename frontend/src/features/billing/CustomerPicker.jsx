import React, { useState, useRef, useEffect } from 'react';
import { Search, UserPlus, X, User } from 'lucide-react';
import { useGetCustomersQuery } from '../../app/api/baseApi';
import { Button } from '../../components/ui/Button';
import { absCurrency } from '../../utils/formatters';

/** Searchable customer selector. Nothing is auto-selected - the cashier must choose explicitly. */
export const CustomerPicker = ({ value, onChange, onCreateNew, label = 'Customer' }) => {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const { data, isFetching } = useGetCustomersQuery({ search: term || undefined, limit: 8 }, { skip: !open });
  const list = data?.data || [];

  useEffect(() => {
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (value) {
    const bal = value.currentBalance || 0;
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-surface-300 bg-surface-50 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <User className="w-4 h-4 text-gold-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-surface-900 truncate">{value.name}</p>
            <p className="text-[11px] text-surface-500">
              📞 {value.mobile} ·{' '}
              <span className={bal > 0 ? 'text-amber-600 font-semibold' : bal < 0 ? 'text-emerald-700 font-semibold' : ''}>
                {bal > 0 ? `Owes ${absCurrency(bal)}` : bal < 0 ? `Credit ${absCurrency(bal)}` : 'Account clear'}
              </span>
            </p>
          </div>
        </div>
        <button type="button" onClick={() => onChange(null)} className="p-1 rounded text-surface-400 hover:text-red-600 hover:bg-red-50" title="Change customer">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-surface-400" />
          <input
            type="text"
            value={term}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setTerm(e.target.value);
              setOpen(true);
            }}
            placeholder={`Search ${label.toLowerCase()} by name or mobile...`}
            className="w-full rounded-xl border border-surface-300 bg-white pl-9 pr-3 py-2 text-xs focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
          />
        </div>
        {onCreateNew && (
          <Button size="sm" variant="goldSoft" icon={UserPlus} onClick={onCreateNew}>
            New
          </Button>
        )}
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-surface-200 bg-white shadow-xl">
          {list.map((c) => (
            <button
              key={c._id}
              type="button"
              onClick={() => {
                onChange(c);
                setOpen(false);
                setTerm('');
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-gold-50"
            >
              <span>
                <strong className="text-surface-900">{c.name}</strong>
                <span className="text-surface-500 ml-2">📞 {c.mobile}</span>
              </span>
              {c.currentBalance !== 0 && (
                <span className={c.currentBalance > 0 ? 'text-amber-600 font-semibold' : 'text-emerald-700 font-semibold'}>
                  {c.currentBalance > 0 ? 'Due ' : 'Cr '}
                  {absCurrency(c.currentBalance)}
                </span>
              )}
            </button>
          ))}
          {list.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-surface-400">{isFetching ? 'Searching...' : 'No customer found'}</div>
          )}
        </div>
      )}
    </div>
  );
};
