import React from 'react';
import { useGetProductsQuery } from '../../app/api/baseApi';

/** Select a product design (every stock row belongs to one). */
export const ProductSelect = ({ value, onChange, className = '' }) => {
  const { data } = useGetProductsQuery({ limit: 200 });
  const products = data?.data || [];
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value, products.find((p) => p._id === e.target.value))}
      className={`rounded border border-surface-300 bg-white p-1 text-xs ${className}`}
      required
    >
      <option value="">Select design…</option>
      {products.map((p) => (
        <option key={p._id} value={p._id}>{p.name} ({p.code})</option>
      ))}
    </select>
  );
};
