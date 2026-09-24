const assert = require('assert');
const BillingService = require('../src/services/billing.service');
const PaymentService = require('../src/services/payment.service');
const Invoice = require('../src/models/Invoice');
const Customer = require('../src/models/Customer');
const Inventory = require('../src/models/Inventory');
const CustomerLedger = require('../src/models/CustomerLedger');
const { BILL_TYPES, INVOICE_STATUSES } = require('../src/config/constants');

async function runBillingTests(branchId, userId, customerId, productId) {
  console.log('\n  [TEST SUITE] Billing Lifecycle (Kacha, Pakka, Conversion & Ledgers)');

  const testBarcode = `BILL-TEST-${Date.now()}`;

  // 1. Prepare an inventory item to sell
  await Inventory.create({
    productId,
    barcode: testBarcode,
    categoryId: (await Inventory.findOne({}))?.categoryId,
    metal: 'GOLD',
    purity: '22K',
    grossWeight: 20.0,
    stoneWeight: 0,
    netWeight: 20.0,
    quantity: 1,
    costPrice: 140000,
    branchId,
    status: 'AVAILABLE'
  });

  // 2. Create Kacha Bill
  const kachaBill = await BillingService.createKachaBill({
    customerId,
    branchId,
    items: [
      {
        productId,
        barcode: testBarcode,
        productName: '22K Gold Test Bangle',
        grossWeight: 20.0,
        stoneWeight: 0,
        netWeight: 20.0,
        quantity: 1,
        goldRate: 7000,
        makingType: 'PER_GRAM',
        makingRate: 400,
        wastagePercent: 3
      }
    ],
    userId,
    status: INVOICE_STATUSES.CONFIRMED
  });

  assert.strictEqual(kachaBill.billType, BILL_TYPES.KACHA);
  assert.strictEqual(kachaBill.status, INVOICE_STATUSES.CONFIRMED);
  assert(kachaBill.grandTotal > 0, 'Grand total computed');

  // Verify stock was deducted
  const soldItem = await Inventory.findOne({ barcode: testBarcode });
  assert.strictEqual(soldItem.quantity, 0, 'Stock deducted on Kacha confirmation');

  // Verify Customer Ledger has debit
  const ledgerEntries = await CustomerLedger.find({ customerId, referenceId: kachaBill._id });
  assert.strictEqual(ledgerEntries.length, 1, 'Customer ledger entry posted');
  assert.strictEqual(ledgerEntries[0].debit, kachaBill.grandTotal, 'Ledger debited with grand total');

  console.log(`    ✓ Test 1: Created Kacha Bill #${kachaBill.invoiceNo} (₹${kachaBill.grandTotal}) and stock deducted`);

  // 3. Convert Kacha Bill -> Pakka Bill (GST Invoice)
  const pakkaInvoice = await BillingService.convertKachaToPakka({
    kachaBillId: kachaBill._id,
    userId
  });

  assert.strictEqual(pakkaInvoice.billType, BILL_TYPES.PAKKA);
  assert(pakkaInvoice.tax.totalTax > 0, 'GST tax is added in Pakka invoice');
  assert(pakkaInvoice.grandTotal > kachaBill.grandTotal, 'Pakka total includes GST differential');
  assert.strictEqual(pakkaInvoice.convertedFromKachaBillId.toString(), kachaBill._id.toString());

  // Verify original Kacha bill is now marked CONVERTED
  const updatedKacha = await Invoice.findById(kachaBill._id);
  assert.strictEqual(updatedKacha.status, INVOICE_STATUSES.CONVERTED);
  assert.strictEqual(updatedKacha.convertedToPakkaBillId.toString(), pakkaInvoice._id.toString());

  console.log(`    ✓ Test 2: Converted Kacha #${kachaBill.invoiceNo} -> Pakka GST Invoice #${pakkaInvoice.invoiceNo}`);

  // 4. Try converting the same Kacha bill again -> Must fail!
  try {
    await BillingService.convertKachaToPakka({
      kachaBillId: kachaBill._id,
      userId
    });
    assert.fail('Should not allow duplicate conversion');
  } catch (error) {
    assert(error.message.includes('already been converted'), 'Blocked duplicate conversion');
    console.log('    ✓ Test 3: Duplicate Kacha -> Pakka conversion strictly blocked');
  }

  // 5. Payment on Pakka Invoice
  const payment = await PaymentService.recordPayment({
    referenceType: 'INVOICE',
    referenceId: pakkaInvoice._id,
    entityType: 'CUSTOMER',
    entityId: customerId,
    amount: 10000,
    paymentMode: 'UPI',
    branchId,
    recordedBy: userId
  });

  const invoiceAfterPayment = await Invoice.findById(pakkaInvoice._id);
  assert.strictEqual(invoiceAfterPayment.paymentSummary.paid, 10000);
  assert.strictEqual(invoiceAfterPayment.paymentStatus, 'PARTIAL');

  console.log(`    ✓ Test 4: Recorded ₹10,000 UPI payment on #${pakkaInvoice.invoiceNo}`);

  // Clean up
  await Inventory.deleteOne({ barcode: testBarcode });
}

module.exports = runBillingTests;
