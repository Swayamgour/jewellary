const mongoose = require('mongoose');
const env = require('../src/config/env');
const runCalculationTests = require('./calculation.test');
const runInventoryTests = require('./inventory.test');
const runBillingTests = require('./billing.test');

const User = require('../src/models/User');
const Branch = require('../src/models/Branch');
const Customer = require('../src/models/Customer');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');

async function main() {
  console.log('====================================================');
  console.log('  STARTING JEWELLERY ERP AUTOMATED TEST SUITE');
  console.log('====================================================');

  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('[TestRunner] Connected to MongoDB database.');

    // Fetch seed data references
    const admin = await User.findOne({ email: 'admin@jewelleryerp.com' });
    const branch = await Branch.findOne({ isHeadOffice: true });
    const customer = await Customer.findOne({});
    const product = await Product.findOne({});
    const category = await Category.findOne({});

    if (!admin || !branch || !customer || !product) {
      console.error('[TestRunner] Database not seeded. Please run: npm run seed first.');
      process.exit(1);
    }

    // 1. Run Unit Calculation Tests
    runCalculationTests();

    // 2. Run Inventory & Barcode Tests
    await runInventoryTests(branch._id, admin._id, product._id, category._id);

    // 3. Run Billing, Conversion, and Payment Tests
    await runBillingTests(branch._id, admin._id, customer._id, product._id);

    console.log('\n====================================================');
    console.log('  ALL TEST SUITES PASSED SUCCESSFULLY! (100% OK)');
    console.log('====================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('\n[TestRunner] TEST FAILED:', err);
    process.exit(1);
  }
}

main();
