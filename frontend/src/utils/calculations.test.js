import { describe, it, expect } from 'vitest';
import { calculateItemPrice, calculateInvoiceTotals } from './calculations';

// Same fixtures the backend unit tests use (tests/unit.test.js), so UI preview == server
describe('POS calculation mirrors the backend', () => {
  it('item: net weight, metal, making, wastage, taxable', () => {
    const r = calculateItemPrice({ grossWeight: 25.5, stoneWeight: 1.5, goldRate: 7000, quantity: 1, makingType: 'PER_GRAM', makingRate: 400, wastagePercent: 3, stoneAmount: 2000, discount: 500 });
    expect(r.netWeight).toBe(24);
    expect(r.goldAmount).toBe(168000);
    expect(r.makingAmount).toBe(10200);
    expect(r.wastageAmount).toBe(5040);
    expect(r.taxableAmount).toBe(184740);
  });
  it('pakka in-state: 1.5% + 1.5%', () => {
    const t = calculateInvoiceTotals({ items: [{ grossWeight: 10, goldRate: 7000, makingType: 'FIXED', makingRate: 1000 }], billType: 'PAKKA' });
    expect(t.taxableAmount).toBe(71000);
    expect(t.tax.totalTax).toBe(2130);
    expect(t.grandTotal).toBe(73130);
  });
  it('pakka inter-state: 3% IGST', () => {
    const t = calculateInvoiceTotals({ items: [{ grossWeight: 10, goldRate: 7000, makingType: 'FIXED', makingRate: 1000 }], billType: 'PAKKA', isInterState: true });
    expect(t.tax.igstAmount).toBe(2130);
    expect(t.tax.cgstAmount).toBe(0);
  });
  it('kacha has no GST', () => {
    const t = calculateInvoiceTotals({ items: [{ grossWeight: 10, goldRate: 7000 }], billType: 'KACHA' });
    expect(t.tax.totalTax).toBe(0);
    expect(t.grandTotal).toBe(70000);
  });
  it('quantity multiplies per-piece weight (2 pcs x 10g)', () => {
    const t = calculateInvoiceTotals({ items: [{ grossWeight: 10, goldRate: 7000, quantity: 2, makingType: 'PER_GRAM', makingRate: 400 }], billType: 'KACHA' });
    expect(t.grandTotal).toBe(148000);
  });
  it('flags a discount larger than the bill', () => {
    const t = calculateInvoiceTotals({ items: [{ grossWeight: 1, goldRate: 100 }], extraDiscount: 500 });
    expect(t.error).toBeTruthy();
  });
});
