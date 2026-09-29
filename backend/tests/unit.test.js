/* Pure-logic tests: no database needed.  node tests/unit.test.js */
const assert = require('assert');
const CalculationService = require('../src/services/calculation.service');
const A = require('../src/utils/accounting');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    process.exitCode = 1;
  }
}

console.log('\n[UNIT] Calculation engine');
test('item: net weight, gold, making, wastage, taxable', () => {
  const r = CalculationService.calculateItemPrice({ grossWeight: 25.5, stoneWeight: 1.5, goldRate: 7000, quantity: 1, makingType: 'PER_GRAM', makingRate: 400, wastagePercent: 3, stoneAmount: 2000, discount: 500 });
  assert.strictEqual(r.netWeight, 24);
  assert.strictEqual(r.goldAmount, 168000);
  assert.strictEqual(r.makingAmount, 10200);
  assert.strictEqual(r.wastageAmount, 5040);
  assert.strictEqual(r.taxableAmount, 184740);
});
test('pakka intra-state: 1.5% + 1.5% GST', () => {
  const t = CalculationService.calculateInvoiceTotals({ items: [{ grossWeight: 10, goldRate: 7000, makingType: 'FIXED', makingRate: 1000 }], billType: 'PAKKA', branchStateCode: '27', customerStateCode: '27' });
  assert.strictEqual(t.taxableAmount, 71000);
  assert.strictEqual(t.tax.totalTax, 2130);
  assert.strictEqual(t.grandTotal, 73130);
});
test('pakka inter-state: 3% IGST', () => {
  const t = CalculationService.calculateInvoiceTotals({ items: [{ grossWeight: 10, goldRate: 7000, makingType: 'FIXED', makingRate: 1000 }], billType: 'PAKKA', branchStateCode: '27', customerStateCode: '07' });
  assert.strictEqual(t.tax.igstAmount, 2130);
  assert.strictEqual(t.tax.cgstAmount, 0);
});
test('kacha has no GST', () => {
  const t = CalculationService.calculateInvoiceTotals({ items: [{ grossWeight: 10, goldRate: 7000 }], billType: 'KACHA' });
  assert.strictEqual(t.tax.totalTax, 0);
  assert.strictEqual(t.grandTotal, 70000);
});
test('invoice discount is allocated to lines and lines add up to the invoice', () => {
  const t = CalculationService.calculateInvoiceTotals({
    items: [{ grossWeight: 10, goldRate: 7000 }, { grossWeight: 5, goldRate: 7000, discount: 100 }],
    billType: 'PAKKA', branchStateCode: '27', customerStateCode: '27', extraDiscount: 1000
  });
  const eff = t.items.reduce((a, i) => a + i.effectiveTaxableAmount, 0);
  const tax = t.items.reduce((a, i) => a + i.taxAmount, 0);
  assert.strictEqual(Math.round(eff * 100), Math.round(t.taxableAmount * 100));
  assert.strictEqual(Math.round(tax * 100), Math.round(t.tax.totalTax * 100));
  assert.strictEqual(t.extraDiscount, 1000);
  assert.strictEqual(t.discount, 1100);
});
test('discount larger than the bill is rejected (400, not 500)', () => {
  assert.throws(() => CalculationService.calculateInvoiceTotals({ items: [{ grossWeight: 1, goldRate: 100 }], extraDiscount: 500 }), (e) => e.statusCode === 400);
});
test('stone heavier than gross is rejected (400)', () => {
  assert.throws(() => CalculationService.calculateItemPrice({ grossWeight: 1, stoneWeight: 2, goldRate: 100 }), (e) => e.statusCode === 400);
});

console.log('\n[UNIT] Payment position');
test('invoice: paid in full then part returned => customer credit', () => {
  const r = A.computeInvoicePayment({ grandTotal: 100000, returnedAmount: 30000, paidIn: 100000, refunded: 0 });
  assert.deepStrictEqual([r.netPayable, r.due, r.excessReceived, r.paymentStatus], [70000, 0, 30000, 'PAID']);
});
test('invoice: partial payment', () => {
  const r = A.computeInvoicePayment({ grandTotal: 100000, paidIn: 40000 });
  assert.deepStrictEqual([r.due, r.paymentStatus], [60000, 'PARTIAL']);
});
test('invoice: refund of the excess clears the credit', () => {
  const r = A.computeInvoicePayment({ grandTotal: 100000, returnedAmount: 30000, paidIn: 100000, refunded: 30000 });
  assert.strictEqual(r.excessReceived, 0);
});
test('purchase example from the audit: 1,00,000 paid 60,000 return 20,000', () => {
  const r = A.computePurchasePayment({ grandTotal: 100000, returnedAmount: 20000, paid: 60000 });
  assert.deepStrictEqual([r.netPayable, r.due, r.refundDue], [80000, 20000, 0]);
});
test('purchase: return bigger than the unpaid part => vendor owes us', () => {
  const r = A.computePurchasePayment({ grandTotal: 100000, returnedAmount: 50000, paid: 60000 });
  assert.deepStrictEqual([r.due, r.refundDue], [0, 10000]);
});

console.log('\n[UNIT] Return valuation');
test('sales return: proportional value incl. GST, last unit takes the remainder', () => {
  const inv = { taxableAmount: 1000, discount: 0, tax: { totalTax: 30 }, items: [] };
  const item = { quantity: 3, effectiveTaxableAmount: 1000, taxAmount: 30, returnedQty: 0, returnedTaxable: 0, returnedTax: 0 };
  const a = A.computeInvoiceReturnLine(inv, item, 1);
  assert.strictEqual(a.amount, 343.33);
  item.returnedQty = 2; item.returnedTaxable = 666.66; item.returnedTax = 20;
  const last = A.computeInvoiceReturnLine(inv, item, 1);
  assert.strictEqual(last.taxable, 333.34);
  assert.strictEqual(last.tax, 10);
});
test('sales return: cannot exceed remaining quantity', () => {
  const item = { quantity: 2, effectiveTaxableAmount: 100, taxAmount: 3, returnedQty: 2 };
  assert.throws(() => A.computeInvoiceReturnLine({ taxableAmount: 100, tax: { totalTax: 3 }, items: [] }, item, 1));
});
test('purchase return: valued from the purchase line', () => {
  const line = { quantity: 10, taxableAmount: 610000, taxAmount: 18300, returnedQty: 0 };
  assert.strictEqual(A.computePurchaseReturnLine(line, 2).amount, 125660);
});
test('allocateByShare always sums to the total', () => {
  const parts = A.allocateByShare(100, [1, 1, 1]);
  assert.strictEqual(parts.reduce((a, b) => a + b, 0), 100);
});

console.log(`\n${passed} unit tests passed${process.exitCode ? ' (with failures)' : ''}\n`);
