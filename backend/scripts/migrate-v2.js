/**
 * One-off migration for databases created with the previous backend version.
 *   node scripts/migrate-v2.js          -> dry run (reports what would change)
 *   node scripts/migrate-v2.js --apply  -> writes the changes
 *
 * 1. Payment.direction        (CUSTOMER => IN, VENDOR => OUT)
 * 2. Invoice.status           PARTIAL / PAID / DUE  => CONFIRMED (payment progress lives in paymentStatus)
 * 3. Invoice.extraDiscount    = discount - sum(item discounts)
 * 4. Invoice payment summary  re-derived from payments
 * 5. Purchase payment summary re-derived from payments
 * Cost snapshots (item.costAmount) cannot be reconstructed reliably for old invoices - the P&L report
 * lists how many old lines have no cost.
 */
const mongoose = require('mongoose');
const env = require('../src/config/env');
const Payment = require('../src/models/Payment');
const Invoice = require('../src/models/Invoice');
const Purchase = require('../src/models/Purchase');
const InvoiceAccounting = require('../src/services/invoiceAccounting.service');
const PurchaseAccounting = require('../src/services/purchaseAccounting.service');

(async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(env.MONGO_URI);
  console.log(`[migrate-v2] ${apply ? 'APPLYING' : 'DRY RUN'} on ${mongoose.connection.name}`);

  const noDir = await Payment.countDocuments({ direction: { $exists: false } });
  console.log(`payments without direction: ${noDir}`);
  if (apply && noDir) {
    await Payment.updateMany({ direction: { $exists: false }, entityType: 'CUSTOMER' }, { $set: { direction: 'IN' } });
    await Payment.updateMany({ direction: { $exists: false }, entityType: 'VENDOR' }, { $set: { direction: 'OUT' } });
  }

  const invoices = await Invoice.find({});
  let touched = 0;
  for (const inv of invoices) {
    const itemDisc = inv.items.reduce((a, i) => a + (i.discount || 0), 0);
    const extra = Math.max(0, Math.round((inv.discount - itemDisc) * 100) / 100);
    if (inv.extraDiscount !== extra || ['PARTIAL', 'PAID', 'DUE'].includes(inv.status)) {
      touched++;
      if (apply) {
        inv.extraDiscount = extra;
        if (['PARTIAL', 'PAID', 'DUE'].includes(inv.status)) inv.status = 'CONFIRMED';
        await inv.save();
      }
    }
    if (apply && inv.status === 'CONFIRMED') await InvoiceAccounting.recompute(inv);
  }
  console.log(`invoices normalised: ${touched}`);

  if (apply) {
    for (const p of await Purchase.find({ status: 'COMPLETED' })) await PurchaseAccounting.recompute(p);
    console.log('purchases recomputed');
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
