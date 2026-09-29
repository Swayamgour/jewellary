/**
 * Integration tests - real services against a real MongoDB.
 *   MONGO_URI_TEST=mongodb://127.0.0.1:27017/jewellery_erp_test npm run test:integration
 * The database is WIPED. It must have "test" in its name.
 */
require('dotenv').config();
const assert = require('assert');
const mongoose = require('mongoose');

const URI = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/jewellery_erp_test';
if (!/test/i.test(URI.split('/').pop().split('?')[0])) {
  console.error('Refusing to run: MONGO_URI_TEST database name must contain "test" (this suite wipes the database).');
  process.exit(1);
}

const M = (n) => require(`../src/models/${n}`);
const S = (n) => require(`../src/services/${n}`);
const Billing = S('billing.service');
const SalesService = S('sales.service');
const PaymentService = S('payment.service');
const PurchaseService = S('purchase.service');
const POService = S('purchaseOrder.service');
const ExchangeService = S('exchange.service');
const Recon = S('reconciliation.service');
const Report = S('report.service');
const Dashboard = S('dashboard.service');

let passed = 0;
let failed = 0;
const failures = [];
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    failures.push(name);
    console.error(`  ✗ ${name}\n      ${e.message}`);
    if (process.env.VERBOSE) console.error(e.stack);
  }
}
const expectError = async (p, includes) => {
  try {
    await p;
  } catch (e) {
    if (includes) assert(e.message.includes(includes), `expected error containing "${includes}", got "${e.message}"`);
    return e;
  }
  throw new Error(`expected an error${includes ? ` containing "${includes}"` : ''}`);
};
const bal = async (Model, id) => (await Model.findById(id)).currentBalance;

let ctx = {};
let seq = 0;
const uniq = (p) => `${p}${Date.now().toString(36)}${++seq}`.toUpperCase();

async function fixtures() {
  await mongoose.connection.dropDatabase();
  const Role = M('Role'), Branch = M('Branch'), User = M('User'), Customer = M('Customer'), Vendor = M('Vendor'), Category = M('Category'), Product = M('Product');
  const role = await Role.create({ name: 'SUPER_ADMIN', permissions: ['*'] });
  const branch = await Branch.create({ name: 'HQ', code: 'HO01', address: { state: 'Maharashtra', stateCode: '27' }, phone: '1', isHeadOffice: true });
  const user = await User.create({ name: 'Admin', email: 'a@test.com', password: 'secret1', roleId: role._id, role: 'SUPER_ADMIN', branchId: branch._id });
  const customer = await Customer.create({ name: 'Rajesh', mobile: '9876543210', address: { state: 'Maharashtra', stateCode: '27' }, branchId: branch._id });
  const vendor = await Vendor.create({ name: 'Mukesh', company: 'Surat Bullion', mobile: '9822114455', branchId: branch._id });
  const category = await Category.create({ name: 'Bangles', code: 'GBAN', metal: 'GOLD' });
  const product = await Product.create({ name: '22K Bangle', code: 'PB1', sku: 'PB1-22', categoryId: category._id, metal: 'GOLD', purity: '22K', standardGrossWeight: 10, standardNetWeight: 10 });
  ctx = { branch, user, customer, vendor, category, product, branchId: branch._id, userId: user._id };
}

// A purchased lot: 10 pcs, 10g each @6000/g + 10,000 making, 3% GST  => taxable 610000, tax 18300, total 628300, unit cost 61000
async function buyLot({ qty = 10, paid = 0, barcode = uniq('LOT') } = {}) {
  const purchase = await PurchaseService.recordPurchase({
    vendorId: ctx.vendor._id, branchId: ctx.branchId, userId: ctx.userId, paidAmount: paid, paymentMode: 'BANK_TRANSFER',
    items: [{ productId: ctx.product._id, categoryId: ctx.category._id, productName: '22K Bangle', barcode, metal: 'GOLD', purity: '22K', grossWeight: 10, stoneWeight: 0, quantity: qty, rate: 6000, makingAmount: 10000 * (qty / 10), otherCharges: 0, gstRate: 3 }]
  });
  const inv = await M('Inventory').findOne({ barcode: barcode.toUpperCase() });
  return { purchase, inv, barcode: barcode.toUpperCase() };
}
const saleItem = (barcode, quantity = 1) => ({ productId: ctx.product._id, barcode, productName: '22K Bangle', grossWeight: 1, quantity, goldRate: 7000, makingType: 'PER_GRAM', makingRate: 400 });
// 1 pc = 10g*7000 + 10g*400 = 74,000 ; pakka +3% => 76,220 per piece

// Detects engines whose conditional findOneAndUpdate is not atomic (e.g. FerretDB/SQLite). Real MongoDB is.
async function engineIsAtomic() {
  const Probe = mongoose.model('AtomicProbe', new mongoose.Schema({ q: Number }));
  const d = await Probe.create({ q: 1 });
  const res = await Promise.all([1, 2, 3, 4].map(() => Probe.findOneAndUpdate({ _id: d._id, q: { $gte: 1 } }, { $inc: { q: -1 } }, { new: true })));
  await Probe.deleteMany({});
  return res.filter(Boolean).length === 1;
}

async function main() {
  await mongoose.connect(URI);
  console.log(`\n[INTEGRATION] ${mongoose.connection.name}\n`);
  for (const m of Object.values(mongoose.models)) await m.init().catch(() => {});
  await fixtures();
  const atomic = await engineIsAtomic();
  if (!atomic) console.log('  (!) This MongoDB-compatible engine does not execute conditional updates atomically - concurrency tests are skipped. Run against real MongoDB / Atlas to exercise them.\n');
  const testConcurrent = (name, fn) => (atomic ? test(name, fn) : (console.log(`  - SKIPPED ${name}`), Promise.resolve()));

  // -------------------------------------------------------------- inventory weight
  console.log('Inventory: weight follows quantity');
  await test('purchase of 10 pcs x 10g => 100g in stock, unit cost recorded', async () => {
    const { purchase, inv } = await buyLot({});
    assert.strictEqual(purchase.grandTotal, 628300);
    assert.strictEqual(inv.quantity, 10);
    assert.strictEqual(inv.totalNetWeight, 100);
    assert.strictEqual(inv.costPrice, 61000);
    const mv = await M('StockMovement').findOne({ inventoryId: inv._id });
    assert.strictEqual(mv.weightDelta, 100);
    assert.strictEqual(mv.balanceWeight, 100);
    const v = await M('Vendor').findById(ctx.vendor._id);
    assert(v.currentBalance >= 628300);
  });
  await test('selling 2 of 10 leaves 8 pcs = 80g and movement shows -20g / balance 80g', async () => {
    const { inv, barcode } = await buyLot({});
    const before = await bal(M('Customer'), ctx.customer._id);
    const bill = await Billing.createKachaBill({ customerId: ctx.customer._id, branchId: ctx.branchId, userId: ctx.userId, items: [saleItem(barcode, 2)] });
    assert.strictEqual(bill.grandTotal, 148000);
    const after = await M('Inventory').findById(inv._id);
    assert.strictEqual(after.quantity, 8);
    assert.strictEqual(after.totalNetWeight, 80);
    const mv = await M('StockMovement').findOne({ inventoryId: inv._id, movementType: 'SALE' });
    assert.strictEqual(mv.weightDelta, -20);
    assert.strictEqual(mv.balanceWeight, 80);
    assert.strictEqual(bill.items[0].unitCost, 61000);
    assert.strictEqual(bill.items[0].costAmount, 122000);
    assert.strictEqual(await bal(M('Customer'), ctx.customer._id), before + 148000);
  });
  await test('overselling is refused', async () => {
    const { barcode } = await buyLot({ qty: 2 });
    await expectError(Billing.createKachaBill({ customerId: ctx.customer._id, branchId: ctx.branchId, userId: ctx.userId, items: [saleItem(barcode, 3)] }), 'Insufficient stock');
  });
  await test('weights on the bill come from stock, not from the request', async () => {
    const { barcode } = await buyLot({ qty: 1 });
    const bill = await Billing.createKachaBill({ customerId: ctx.customer._id, branchId: ctx.branchId, userId: ctx.userId, items: [{ ...saleItem(barcode, 1), grossWeight: 999 }] });
    assert.strictEqual(bill.items[0].grossWeight, 10);
  });

  // -------------------------------------------------------------- kacha -> pakka
  console.log('\nKacha -> Pakka');
  await test('DRAFT posts nothing; confirm posts stock + ledger and assigns the real number', async () => {
    const { inv, barcode } = await buyLot({ qty: 3 });
    const cBefore = await bal(M('Customer'), ctx.customer._id);
    const draft = await Billing.createKachaBill({ customerId: ctx.customer._id, branchId: ctx.branchId, userId: ctx.userId, status: 'DRAFT', items: [saleItem(barcode, 1)] });
    assert.strictEqual(draft.status, 'DRAFT');
    assert(draft.invoiceNo.startsWith('DRF/'));
    assert.strictEqual((await M('Inventory').findById(inv._id)).quantity, 3);
    assert.strictEqual(await bal(M('Customer'), ctx.customer._id), cBefore);
    await expectError(Billing.convertKachaToPakka({ kachaBillId: draft._id, userId: ctx.userId }), 'DRAFT');
    await expectError(PaymentService.recordPayment({ referenceType: 'INVOICE', referenceId: draft._id, entityType: 'CUSTOMER', entityId: ctx.customer._id, amount: 100, paymentMode: 'CASH', branchId: ctx.branchId, recordedBy: ctx.userId }), 'DRAFT');
    const confirmed = await Billing.confirmDraft({ invoiceId: draft._id, userId: ctx.userId, payments: [{ amount: 10000, paymentMode: 'CASH' }] });
    assert.strictEqual(confirmed.status, 'CONFIRMED');
    assert(confirmed.invoiceNo.startsWith('KACHA/'));
    assert.strictEqual((await M('Inventory').findById(inv._id)).quantity, 2);
    assert.strictEqual(await bal(M('Customer'), ctx.customer._id), cBefore + 74000 - 10000);
    assert.strictEqual(confirmed.paymentSummary.due, 64000);
  });
  await test('convert a part-paid Kacha bill: GST difference posted, payment follows, stock untouched, no double count', async () => {
    const { inv, barcode } = await buyLot({ qty: 3 });
    const kacha = await Billing.createKachaBill({ customerId: ctx.customer._id, branchId: ctx.branchId, userId: ctx.userId, discount: 1000, items: [{ ...saleItem(barcode, 1), discount: 500 }], payments: [{ amount: 20000, paymentMode: 'UPI' }] });
    const cBefore = await bal(M('Customer'), ctx.customer._id);
    const stockBefore = (await M('Inventory').findById(inv._id)).quantity;
    const pakka = await Billing.convertKachaToPakka({ kachaBillId: kacha._id, userId: ctx.userId });

    // kacha 74000-500-1000 = 72500 ; pakka taxable identical (item + invoice discount NOT double counted), +3%
    assert.strictEqual(kacha.grandTotal, 72500);
    assert.strictEqual(pakka.taxableAmount, 72500);
    assert.strictEqual(pakka.tax.totalTax, 2175);
    assert.strictEqual(pakka.grandTotal, 74675);
    assert.strictEqual(pakka.paymentSummary.paid, 20000);
    assert.strictEqual(pakka.paymentSummary.due, 54675);
    assert.strictEqual(await bal(M('Customer'), ctx.customer._id), cBefore + 2175);
    assert.strictEqual((await M('Inventory').findById(inv._id)).quantity, stockBefore);
    const k = await M('Invoice').findById(kacha._id);
    assert.strictEqual(k.status, 'CONVERTED');
    const pays = await M('Payment').find({ referenceId: pakka._id });
    assert.strictEqual(pays.length, 1);
    assert.strictEqual(await M('Payment').countDocuments({ referenceId: kacha._id }), 0);
    await expectError(Billing.convertKachaToPakka({ kachaBillId: kacha._id, userId: ctx.userId }), 'already been converted');
    await expectError(Billing.cancelInvoice({ invoiceId: kacha._id, reason: 'testing', userId: ctx.userId }), 'Cancel the Pakka');
    // sales report counts the sale once
    const rep = await Report.getSalesReport({ branchId: ctx.branchId });
    assert(!rep.data.find((r) => r.invoiceNo === kacha.invoiceNo), 'converted kacha must not appear in sales');
    assert(rep.data.find((r) => r.invoiceNo === pakka.invoiceNo));
    // paying the rest on the pakka invoice works and the kacha bill refuses payments
    await PaymentService.recordPayment({ referenceType: 'INVOICE', referenceId: pakka._id, entityType: 'CUSTOMER', entityId: ctx.customer._id, amount: 54675, paymentMode: 'CASH', branchId: ctx.branchId, recordedBy: ctx.userId });
    assert.strictEqual((await M('Invoice').findById(pakka._id)).paymentStatus, 'PAID');
    await expectError(PaymentService.recordPayment({ referenceType: 'INVOICE', referenceId: kacha._id, entityType: 'CUSTOMER', entityId: ctx.customer._id, amount: 1, paymentMode: 'CASH', branchId: ctx.branchId, recordedBy: ctx.userId }), 'converted');
  });

  // -------------------------------------------------------------- cancellation
  console.log('\nInvoice cancellation + payment reconciliation');
  await test('cancel a fully paid invoice, default CREDIT: stock back, receivable reversed, paid money kept as credit', async () => {
    const { inv, barcode } = await buyLot({ qty: 2 });
    const c0 = await bal(M('Customer'), ctx.customer._id);
    const bill = await Billing.createPakkaBill({ customerId: ctx.customer._id, branchId: ctx.branchId, userId: ctx.userId, items: [saleItem(barcode, 1)], payments: [{ amount: 76220, paymentMode: 'UPI' }] });
    assert.strictEqual(bill.paymentStatus, 'PAID');
    const out = await Billing.cancelInvoice({ invoiceId: bill._id, reason: 'customer changed mind', userId: ctx.userId });
    assert.strictEqual(out.status, 'CANCELLED');
    assert.strictEqual((await M('Inventory').findById(inv._id)).quantity, 2);
    assert.strictEqual(await bal(M('Customer'), ctx.customer._id), c0 - 76220); // customer credit
    assert.strictEqual(out.paymentSummary.excessReceived, 76220);
    assert.strictEqual(out.paymentSummary.due, 0);
    assert.strictEqual(out.cancellationSummary.creditRetained, 76220);
    assert.strictEqual(await M('Payment').countDocuments({ referenceId: bill._id, status: 'SUCCESS' }), 1);
  });
  await test('cancel with REFUND: cash goes out, ledger back to zero effect, OUT payment recorded', async () => {
    const { inv, barcode } = await buyLot({ qty: 2 });
    const c0 = await bal(M('Customer'), ctx.customer._id);
    const bill = await Billing.createPakkaBill({ customerId: ctx.customer._id, branchId: ctx.branchId, userId: ctx.userId, items: [saleItem(barcode, 1)], payments: [{ amount: 50000, paymentMode: 'CASH' }] });
    const out = await Billing.cancelInvoice({ invoiceId: bill._id, reason: 'wrong customer billed', userId: ctx.userId, paymentAction: 'REFUND', refundMode: 'CASH' });
    assert.strictEqual(await bal(M('Customer'), ctx.customer._id), c0);
    assert.strictEqual(out.cancellationSummary.cashRefunded, 50000);
    const refund = await M('Payment').findOne({ referenceId: bill._id, direction: 'OUT' });
    assert.strictEqual(refund.amount, 50000);
    assert.strictEqual(refund.linkedDocType, 'INVOICE_CANCELLATION');
    assert.strictEqual((await M('Inventory').findById(inv._id)).quantity, 2);
    await expectError(Billing.cancelInvoice({ invoiceId: bill._id, reason: 'again please', userId: ctx.userId }), 'already cancelled');
  });
  await test('cancelling a DRAFT posts nothing', async () => {
    const { barcode } = await buyLot({ qty: 1 });
    const c0 = await bal(M('Customer'), ctx.customer._id);
    const d = await Billing.createPakkaBill({ customerId: ctx.customer._id, branchId: ctx.branchId, userId: ctx.userId, status: 'DRAFT', items: [saleItem(barcode, 1)] });
    const out = await Billing.cancelInvoice({ invoiceId: d._id, reason: 'not needed', userId: ctx.userId });
    assert.strictEqual(out.status, 'CANCELLED');
    assert.strictEqual(await bal(M('Customer'), ctx.customer._id), c0);
  });

  // -------------------------------------------------------------- sales return
  console.log('\nSales return');
  await test('partial returns: valued by server, no duplicate/excess return, cash refund of the paid part', async () => {
    const { inv, barcode } = await buyLot({ qty: 5 });
    const c0 = await bal(M('Customer'), ctx.customer._id);
    const bill = await Billing.createPakkaBill({ customerId: ctx.customer._id, branchId: ctx.branchId, userId: ctx.userId, items: [saleItem(barcode, 3)], payments: [{ amount: 100000, paymentMode: 'CASH' }] });
    assert.strictEqual(bill.grandTotal, 228660);
    const line = bill.items[0];

    const r1 = await SalesService.createReturn({ invoiceId: bill._id, items: [{ invoiceItemId: line._id, quantity: 1 }], refundType: 'LEDGER_CREDIT', reason: 'defective clasp', userId: ctx.userId });
    assert.strictEqual(r1.totalRefundAmount, 76220);
    assert.strictEqual((await M('Inventory').findById(inv._id)).quantity, 3);
    let inv1 = await M('Invoice').findById(bill._id);
    assert.strictEqual(inv1.returnedAmount, 76220);
    assert.strictEqual(inv1.returnStatus, 'PARTIAL');
    assert.strictEqual(inv1.paymentSummary.due, 228660 - 76220 - 100000);
    assert.strictEqual(r1.settlement.adjustedAgainstDue, 76220);

    // return the other two: paid 100000, net payable 0 => excess 100000, refunded in cash
    const r2 = await SalesService.createReturn({ invoiceId: bill._id, items: [{ barcode, quantity: 2 }], refundType: 'CASH', reason: 'customer returned rest', userId: ctx.userId });
    assert.strictEqual(r2.totalRefundAmount, 152440);
    assert.strictEqual(r2.settlement.cashRefunded, 100000);
    assert.strictEqual(r2.settlement.adjustedAgainstDue, 52440);
    inv1 = await M('Invoice').findById(bill._id);
    assert.strictEqual(inv1.returnStatus, 'FULL');
    assert.strictEqual(inv1.returnedAmount, 228660);
    assert.strictEqual(inv1.paymentSummary.excessReceived, 0);
    assert.strictEqual(inv1.paymentSummary.due, 0);
    assert.strictEqual((await M('Inventory').findById(inv._id)).quantity, 5);
    assert.strictEqual(await bal(M('Customer'), ctx.customer._id), c0); // everything undone

    await expectError(SalesService.createReturn({ invoiceId: bill._id, items: [{ barcode, quantity: 1 }], reason: 'again', userId: ctx.userId }), 'exceeds remaining');
    await expectError(Billing.convertKachaToPakka({ kachaBillId: bill._id, userId: ctx.userId }), 'KACHA');
  });
  await test('return of an item that was not on the invoice is refused; cancelled invoices cannot be returned', async () => {
    const a = await buyLot({ qty: 1 });
    const b = await buyLot({ qty: 1 });
    const bill = await Billing.createPakkaBill({ customerId: ctx.customer._id, branchId: ctx.branchId, userId: ctx.userId, items: [saleItem(a.barcode, 1)] });
    await expectError(SalesService.createReturn({ invoiceId: bill._id, items: [{ barcode: b.barcode, quantity: 1 }], reason: 'x y z', userId: ctx.userId }), 'was not sold');
    await Billing.cancelInvoice({ invoiceId: bill._id, reason: 'cancelled bill', userId: ctx.userId });
    await expectError(SalesService.createReturn({ invoiceId: bill._id, items: [{ barcode: a.barcode, quantity: 1 }], reason: 'x y z', userId: ctx.userId }), 'CANCELLED');
  });
  await test('cancel after a partial return restores only the remaining stock', async () => {
    const { inv, barcode } = await buyLot({ qty: 4 });
    const c0 = await bal(M('Customer'), ctx.customer._id);
    const bill = await Billing.createPakkaBill({ customerId: ctx.customer._id, branchId: ctx.branchId, userId: ctx.userId, items: [saleItem(barcode, 2)] });
    await SalesService.createReturn({ invoiceId: bill._id, items: [{ barcode, quantity: 1 }], reason: 'one back', userId: ctx.userId });
    await Billing.cancelInvoice({ invoiceId: bill._id, reason: 'cancel the rest', userId: ctx.userId });
    assert.strictEqual((await M('Inventory').findById(inv._id)).quantity, 4);
    assert.strictEqual(await bal(M('Customer'), ctx.customer._id), c0);
  });

  // -------------------------------------------------------------- old gold
  console.log('\nOld gold exchange');
  await test('exchange adjusts on a bill; cancelling the bill returns the value as credit', async () => {
    const { barcode } = await buyLot({ qty: 1 });
    const c0 = await bal(M('Customer'), ctx.customer._id);
    const bill = await Billing.createPakkaBill({ customerId: ctx.customer._id, branchId: ctx.branchId, userId: ctx.userId, items: [saleItem(barcode, 1)] });
    const ex = await ExchangeService.processOldGoldExchange({ customerId: ctx.customer._id, branchId: ctx.branchId, userId: ctx.userId, invoiceId: bill._id, items: [{ itemDescription: 'old chain', purityTestedPercent: 91.6, grossWeight: 10, goldRateApplied: 7000, meltingLossPercent: 0 }] });
    assert.strictEqual(ex.totalExchangeValue, 64120); // 10g * 91.6% * 7000
    assert.strictEqual(ex.status, 'PARTIALLY_ADJUSTED'.replace('PARTIALLY_ADJUSTED', 'ADJUSTED_IN_BILL'));
    const b1 = await M('Invoice').findById(bill._id);
    assert.strictEqual(b1.paymentSummary.exchangeAdjusted, 64120);
    assert.strictEqual(b1.paymentSummary.due, 76220 - 64120);
    await Billing.cancelInvoice({ invoiceId: bill._id, reason: 'deal off', userId: ctx.userId });
    const ex2 = await M('Exchange').findById(ex._id);
    assert.strictEqual(ex2.status, 'PENDING_ADJUSTMENT');
    assert.strictEqual(ex2.adjustedAmount, 0);
    assert.strictEqual(await bal(M('Customer'), ctx.customer._id), c0 - 64120);
    const paid = await ExchangeService.payout({ exchangeId: ex._id, paymentMode: 'CASH', userId: ctx.userId });
    assert.strictEqual(paid.status, 'PAID_OUT');
    assert.strictEqual(await bal(M('Customer'), ctx.customer._id), c0);
  });

  // -------------------------------------------------------------- purchase
  console.log('\nPurchase return reconciliation & lifecycle');
  await test('return reconciles paid / due / refund and vendor ledger (the ₹1,00,000 example, scaled)', async () => {
    const v0 = await bal(M('Vendor'), ctx.vendor._id);
    const { purchase, inv, barcode } = await buyLot({ qty: 10, paid: 400000 });
    assert.strictEqual(purchase.dueAmount, 228300);
    const ret = await PurchaseService.recordPurchaseReturn({ purchaseId: purchase._id, items: [{ barcode, quantity: 2 }], reason: 'purity mismatch', userId: ctx.userId });
    assert.strictEqual(ret.totalAmount, 125660);
    assert.strictEqual(ret.reconciliation.adjustedTotal, 628300 - 125660);
    assert.strictEqual(ret.reconciliation.adjustedDue, 628300 - 125660 - 400000);
    assert.strictEqual(ret.reconciliation.refundDue, 0);
    assert.strictEqual((await M('Inventory').findById(inv._id)).quantity, 8);
    assert.strictEqual(await bal(M('Vendor'), ctx.vendor._id), v0 + 628300 - 400000 - 125660);

    // big return: we have paid more than we now owe => vendor owes us
    const ret2 = await PurchaseService.recordPurchaseReturn({ purchaseId: purchase._id, items: [{ barcode, quantity: 6 }], reason: 'rest is wrong', userId: ctx.userId });
    assert.strictEqual(ret2.reconciliation.adjustedDue, 0);
    assert.strictEqual(ret2.reconciliation.refundDue, 400000 - (628300 - 125660 - 376980));
    await expectError(PurchaseService.recordPurchaseReturn({ purchaseId: purchase._id, items: [{ barcode, quantity: 3 }], reason: 'too many', userId: ctx.userId }), 'exceeds remaining');
    const p = await M('Purchase').findById(purchase._id);
    await PurchaseService.recordVendorRefund({ purchaseId: p._id, amount: p.refundDue, paymentMode: 'BANK_TRANSFER', userId: ctx.userId });
    const p2 = await M('Purchase').findById(purchase._id);
    assert.strictEqual(p2.refundDue, 0);
    assert.strictEqual(await bal(M('Vendor'), ctx.vendor._id), v0 + 628300 - 400000 - 125660 - 376980 + p.refundDue);
  });
  await test('cannot return goods that were already sold', async () => {
    const { purchase, barcode } = await buyLot({ qty: 2 });
    await Billing.createKachaBill({ customerId: ctx.customer._id, branchId: ctx.branchId, userId: ctx.userId, items: [saleItem(barcode, 2)] });
    await expectError(PurchaseService.recordPurchaseReturn({ purchaseId: purchase._id, items: [{ barcode, quantity: 1 }], reason: 'x y z', userId: ctx.userId }), 'Cannot take');
  });
  await test('purchase cancel: allowed only while stock is untouched; vendor payable reversed; REFUND records money in', async () => {
    const v0 = await bal(M('Vendor'), ctx.vendor._id);
    const { purchase, inv } = await buyLot({ qty: 2, paid: 50000 });
    const out = await PurchaseService.cancelPurchase({ purchaseId: purchase._id, reason: 'duplicate entry', userId: ctx.userId, paymentAction: 'REFUND' });
    assert.strictEqual(out.status, 'CANCELLED');
    assert.strictEqual((await M('Inventory').findById(inv._id)).isDeleted, true);
    assert.strictEqual(await bal(M('Vendor'), ctx.vendor._id), v0);
    const p2 = await buyLot({ qty: 2 });
    await Billing.createKachaBill({ customerId: ctx.customer._id, branchId: ctx.branchId, userId: ctx.userId, items: [saleItem(p2.barcode, 1)] });
    await expectError(PurchaseService.cancelPurchase({ purchaseId: p2.purchase._id, reason: 'too late now', userId: ctx.userId }), 'already been sold');
  });
  await test('direct payment endpoint updates the purchase (used to be ignored)', async () => {
    const { purchase } = await buyLot({ qty: 1 });
    await PaymentService.recordPayment({ referenceType: 'PURCHASE', referenceId: purchase._id, entityType: 'VENDOR', entityId: ctx.vendor._id, amount: 30000, paymentMode: 'CASH', branchId: ctx.branchId, recordedBy: ctx.userId });
    const p = await M('Purchase').findById(purchase._id);
    assert.strictEqual(p.paidAmount, 30000);
    assert.strictEqual(p.dueAmount, purchase.grandTotal - 30000);
    assert.strictEqual(p.paymentStatus, 'PARTIAL');
    await expectError(PaymentService.recordPayment({ referenceType: 'PURCHASE', referenceId: purchase._id, entityType: 'VENDOR', entityId: ctx.vendor._id, amount: purchase.grandTotal, paymentMode: 'CASH', branchId: ctx.branchId, recordedBy: ctx.userId }), 'exceeds');
  });
  await test('draft purchase: nothing posted until confirmed', async () => {
    const barcode = uniq('DRAFTP');
    const d = await PurchaseService.recordPurchase({ vendorId: ctx.vendor._id, branchId: ctx.branchId, userId: ctx.userId, status: 'DRAFT', items: [{ productId: ctx.product._id, categoryId: ctx.category._id, productName: 'X', barcode, metal: 'GOLD', purity: '22K', grossWeight: 5, quantity: 1, rate: 6000 }] });
    assert.strictEqual(await M('Inventory').countDocuments({ barcode }), 0);
    const c = await PurchaseService.confirmDraft({ purchaseId: d._id, userId: ctx.userId });
    assert.strictEqual(c.status, 'COMPLETED');
    assert(c.purchaseNo.startsWith('PUR/'));
    assert.strictEqual(await M('Inventory').countDocuments({ barcode }), 1);
  });

  // -------------------------------------------------------------- purchase order
  console.log('\nPurchase Order');
  await test('DRAFT → SUBMITTED → APPROVED → ORDERED → PARTIALLY_RECEIVED → RECEIVED → CLOSED', async () => {
    const v0 = await bal(M('Vendor'), ctx.vendor._id);
    const po = await POService.create({ vendorId: ctx.vendor._id, branchId: ctx.branchId, userId: ctx.userId, items: [{ productId: ctx.product._id, categoryId: ctx.category._id, productName: '22K Bangle', grossWeight: 10, quantity: 10, rate: 6000, makingAmount: 10000, gstRate: 3 }] });
    assert.strictEqual(po.status, 'DRAFT');
    assert.strictEqual(po.estimatedTotal, 628300);
    await expectError(POService.approve({ id: po._id, userId: ctx.userId }), 'Cannot approve');
    await POService.submit({ id: po._id, userId: ctx.userId });
    await expectError(POService.update({ id: po._id, notes: 'x', userId: ctx.userId }), 'Cannot edit');
    await POService.approve({ id: po._id, userId: ctx.userId });
    await expectError(POService.receive({ id: po._id, items: [{ poItemId: po.items[0]._id, quantity: 1 }], userId: ctx.userId }), 'Cannot receive');
    await POService.markOrdered({ id: po._id, userId: ctx.userId });

    const r1 = await POService.receive({ id: po._id, items: [{ poItemId: po.items[0]._id, quantity: 4 }], vendorInvoiceNo: 'V-1', paidAmount: 100000, userId: ctx.userId });
    assert.strictEqual(r1.purchaseOrder.status, 'PARTIALLY_RECEIVED');
    assert.strictEqual(r1.purchaseOrder.items[0].receivedQty, 4);
    assert.strictEqual(r1.purchase.grandTotal, 251320); // 4/10 of 628300
    assert.strictEqual(r1.purchase.paidAmount, 100000);
    await expectError(POService.close({ id: po._id, userId: ctx.userId }), 'short-close');
    await expectError(POService.receive({ id: po._id, items: [{ poItemId: po.items[0]._id, quantity: 7 }], userId: ctx.userId }), 'pending');
    await expectError(POService.cancel({ id: po._id, reason: 'no longer needed', userId: ctx.userId }), 'Cannot cancel');

    const r2 = await POService.receive({ id: po._id, items: [{ poItemId: po.items[0]._id, quantity: 6 }], userId: ctx.userId });
    assert.strictEqual(r2.purchaseOrder.status, 'RECEIVED');
    assert.strictEqual(r1.purchase.grandTotal + r2.purchase.grandTotal, 628300);
    const closed = await POService.close({ id: po._id, userId: ctx.userId });
    assert.strictEqual(closed.status, 'CLOSED');
    assert.deepStrictEqual(closed.statusHistory.map((h) => h.status), ['DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED']);
    assert.strictEqual(await bal(M('Vendor'), ctx.vendor._id), v0 + 628300 - 100000);
  });
  await test('reject → edit → resubmit; cancel before receipt', async () => {
    const po = await POService.create({ vendorId: ctx.vendor._id, branchId: ctx.branchId, userId: ctx.userId, items: [{ productName: 'Chain', grossWeight: 5, quantity: 2, rate: 6000 }] });
    await POService.submit({ id: po._id, userId: ctx.userId });
    const rej = await POService.reject({ id: po._id, reason: 'rate too high', userId: ctx.userId });
    assert.strictEqual(rej.status, 'REJECTED');
    const edited = await POService.update({ id: po._id, items: [{ productName: 'Chain', grossWeight: 5, quantity: 2, rate: 5900 }], userId: ctx.userId });
    assert.strictEqual(edited.status, 'DRAFT');
    const c = await POService.cancel({ id: po._id, reason: 'not required', userId: ctx.userId });
    assert.strictEqual(c.status, 'CANCELLED');
  });

  // -------------------------------------------------------------- reports & books
  console.log('\nReports & consistency');
  await test('reconciliation finds no inconsistencies after all the flows above', async () => {
    const r = await Recon.run({});
    assert.strictEqual(r.issueCount, 0, JSON.stringify(r.issues.slice(0, 3)));
  });
  await testConcurrent('document numbers are unique and sequential under concurrency', async () => {
    const { barcode } = await buyLot({ qty: 10 });
    const results = await Promise.all(Array.from({ length: 5 }, () => Billing.createKachaBill({ customerId: ctx.customer._id, branchId: ctx.branchId, userId: ctx.userId, items: [saleItem(barcode, 1)] })));
    const nos = results.map((r) => r.invoiceNo);
    assert.strictEqual(new Set(nos).size, 5);
    assert.strictEqual((await M('Inventory').findOne({ barcode })).quantity, 5);
  });
  await testConcurrent('two people selling the LAST piece at once: exactly one wins', async () => {
    const { barcode } = await buyLot({ qty: 1 });
    const settled = await Promise.allSettled([1, 2].map(() => Billing.createKachaBill({ customerId: ctx.customer._id, branchId: ctx.branchId, userId: ctx.userId, items: [saleItem(barcode, 1)] })));
    assert.strictEqual(settled.filter((s) => s.status === 'fulfilled').length, 1);
    assert.strictEqual((await M('Inventory').findOne({ barcode })).quantity, 0);
  });
  await test('all new reports run', async () => {
    const q = { branchId: ctx.branchId };
    for (const fn of ['getSalesReport', 'getSalesReturnReport', 'getPurchaseReport', 'getPurchaseReturnReport', 'getPaymentReport', 'getCollectionReport', 'getExpenseReport', 'getCashSummary', 'getProfitLoss', 'getExchangeReport', 'getOldGoldReport', 'getInventoryReport', 'getStockMovementReport', 'getCustomerOutstandingReport', 'getVendorOutstandingReport']) {
      const r = await Report[fn](q);
      assert(r.summary && r.data, fn);
    }
    const gold = await Report.getMetalStockReport({ ...q, metal: 'GOLD' });
    assert(gold.summary.totalNetWeight > 0);
    const pl = await Report.getProfitLoss(q);
    assert(pl.summary.costOfGoodsSold > 0 && pl.summary.grossProfit > 0, JSON.stringify(pl.summary));
    const dash = await Dashboard.getDashboardMetrics({ branchId: String(ctx.branchId), filter: 'year' });
    assert(dash.financials.costOfGoodsSold >= 0 && dash.inventory.GOLD.netWeight > 0);
  });
  await test('stock report weight = unit weight x quantity', async () => {
    const { inv, barcode } = await buyLot({ qty: 6 });
    const rep = await Report.getInventoryReport({ branchId: ctx.branchId });
    const row = rep.data.find((r) => r.barcode === barcode);
    assert.strictEqual(row.netWeight, 60);
    assert.strictEqual(row.totalCost, 366000);
  });

  console.log(`\n${passed} passed, ${failed} failed${failed ? `: ${failures.join(' | ')}` : ''}\n`);
  await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
