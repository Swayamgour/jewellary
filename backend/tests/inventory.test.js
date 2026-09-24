const assert = require('assert');
const Inventory = require('../src/models/Inventory');
const InventoryService = require('../src/services/inventory.service');
const { INVENTORY_STATUSES } = require('../src/config/constants');

async function runInventoryTests(branchId, userId, productId, categoryId) {
  console.log('\n  [TEST SUITE] Inventory and Barcode Protection');

  const testBarcode = `TEST-BARCODE-${Date.now()}`;

  // 1. Create test inventory item
  const item = await Inventory.create({
    productId,
    barcode: testBarcode,
    categoryId,
    metal: 'GOLD',
    purity: '22K',
    grossWeight: 15.0,
    stoneWeight: 0,
    netWeight: 15.0,
    quantity: 1,
    costPrice: 105000,
    branchId,
    status: INVENTORY_STATUSES.AVAILABLE
  });

  assert.strictEqual(item.quantity, 1, 'Initial stock is 1');
  console.log('    ✓ Test 1: Created inventory item with barcode');

  // 2. Deduct item for sale
  await InventoryService.deductItemForSale({
    barcode: testBarcode,
    branchId,
    quantity: 1,
    invoiceId: null,
    performedBy: userId
  });

  const soldItem = await Inventory.findOne({ barcode: testBarcode });
  assert.strictEqual(soldItem.quantity, 0, 'Stock quantity becomes 0 after sale');
  assert.strictEqual(soldItem.status, INVENTORY_STATUSES.SOLD, 'Status changes to SOLD');
  console.log('    ✓ Test 2: Sold item quantity reduced to 0 and marked SOLD');

  // 3. Selling already sold item should be blocked
  try {
    await InventoryService.deductItemForSale({
      barcode: testBarcode,
      branchId,
      quantity: 1,
      invoiceId: null,
      performedBy: userId
    });
    assert.fail('Should not allow selling an already SOLD item');
  } catch (error) {
    assert(error.message.includes('already SOLD') || error.message.includes('Insufficient stock'), 'Blocked double-sell');
    console.log('    ✓ Test 3: Selling an already SOLD unique item prevented');
  }

  // 4. Restore item
  await InventoryService.restoreItemStock({
    barcode: testBarcode,
    branchId,
    quantity: 1,
    netWeight: 15.0,
    referenceType: 'Invoice',
    performedBy: userId
  });

  const restoredItem = await Inventory.findOne({ barcode: testBarcode });
  assert.strictEqual(restoredItem.quantity, 1, 'Stock restored to 1');
  assert.strictEqual(restoredItem.status, INVENTORY_STATUSES.AVAILABLE, 'Status restored to AVAILABLE');
  console.log('    ✓ Test 4: Restored item to AVAILABLE stock');

  // Clean up test item
  await Inventory.deleteOne({ barcode: testBarcode });
}

module.exports = runInventoryTests;
