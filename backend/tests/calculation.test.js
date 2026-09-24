const assert = require('assert');
const CalculationService = require('../src/services/calculation.service');
const DecimalUtil = require('../src/utils/decimal');

function runCalculationTests() {
  console.log('\n  [TEST SUITE] Jewellery Calculation Engine');

  // Test 1: Single item net weight and gold amount calculation
  {
    const item = {
      grossWeight: 25.5,
      stoneWeight: 1.5,
      goldRate: 7000,
      quantity: 1,
      makingType: 'PER_GRAM',
      makingRate: 400,
      wastagePercent: 3,
      stoneAmount: 2000,
      discount: 500
    };

    const result = CalculationService.calculateItemPrice(item);

    // Net Weight = 25.5 - 1.5 = 24.0g
    assert.strictEqual(result.netWeight, 24.0, 'Net weight should be gross minus stone weight');

    // Gold Amount = 24.0 * 7000 = 168000
    assert.strictEqual(result.goldAmount, 168000, 'Gold amount should be net weight * gold rate');

    // Making = 25.5 * 400 = 10200
    assert.strictEqual(result.makingAmount, 10200, 'Making charges per gram should be gross weight * rate');

    // Wastage = 24.0 * (3 / 100) * 7000 = 5040
    assert.strictEqual(result.wastageAmount, 5040, 'Wastage amount should match formula');

    // Taxable = 168000 + 10200 + 5040 + 2000 - 500 = 184740
    assert.strictEqual(result.taxableAmount, 184740, 'Taxable amount should match sum minus discount');

    console.log('    ✓ Test 1: Item net weight, gold value, making, wastage, and taxable calculation passed');
  }

  // Test 2: Pakka Bill GST calculation (Intra-state CGST 1.5% + SGST 1.5%)
  {
    const items = [
      {
        grossWeight: 10.0,
        stoneWeight: 0,
        goldRate: 7000,
        quantity: 1,
        makingType: 'FIXED',
        makingRate: 1000,
        wastagePercent: 0,
        stoneAmount: 0,
        discount: 0
      }
    ];

    // Subtotal: 10 * 7000 + 1000 = 71,000
    const invoiceTotals = CalculationService.calculateInvoiceTotals({
      items,
      billType: 'PAKKA',
      branchStateCode: '27',
      customerStateCode: '27' // Same state -> Intra-state
    });

    assert.strictEqual(invoiceTotals.taxableAmount, 71000, 'Taxable amount is 71,000');
    assert.strictEqual(invoiceTotals.tax.isInterState, false, 'Should be intra-state');
    assert.strictEqual(invoiceTotals.tax.cgstRate, 1.5, 'CGST rate is 1.5%');
    assert.strictEqual(invoiceTotals.tax.sgstRate, 1.5, 'SGST rate is 1.5%');
    assert.strictEqual(invoiceTotals.tax.cgstAmount, 1065, 'CGST amount is 1.5% of 71,000');
    assert.strictEqual(invoiceTotals.tax.sgstAmount, 1065, 'SGST amount is 1.5% of 71,000');
    assert.strictEqual(invoiceTotals.tax.totalTax, 2130, 'Total GST is 2,130');
    assert.strictEqual(invoiceTotals.grandTotal, 73130, 'Grand total is 71000 + 2130 = 73,130');

    console.log('    ✓ Test 2: Intra-state 3% GST (1.5% CGST + 1.5% SGST) verified');
  }

  // Test 3: Inter-state IGST 3%
  {
    const items = [
      {
        grossWeight: 10.0,
        stoneWeight: 0,
        goldRate: 7000,
        quantity: 1,
        makingType: 'FIXED',
        makingRate: 1000,
        wastagePercent: 0,
        stoneAmount: 0,
        discount: 0
      }
    ];

    const invoiceTotals = CalculationService.calculateInvoiceTotals({
      items,
      billType: 'PAKKA',
      branchStateCode: '27',
      customerStateCode: '24' // Different state -> Inter-state
    });

    assert.strictEqual(invoiceTotals.tax.isInterState, true, 'Should be inter-state');
    assert.strictEqual(invoiceTotals.tax.igstRate, 3.0, 'IGST rate is 3%');
    assert.strictEqual(invoiceTotals.tax.igstAmount, 2130, 'IGST amount is 2,130');
    assert.strictEqual(invoiceTotals.grandTotal, 73130, 'Grand total matches');

    console.log('    ✓ Test 3: Inter-state 3% IGST verified');
  }

  // Test 4: Kacha Bill has 0 GST
  {
    const items = [
      {
        grossWeight: 10.0,
        stoneWeight: 0,
        goldRate: 7000,
        quantity: 1,
        makingType: 'FIXED',
        makingRate: 1000,
        wastagePercent: 0,
        stoneAmount: 0,
        discount: 0
      }
    ];

    const invoiceTotals = CalculationService.calculateInvoiceTotals({
      items,
      billType: 'KACHA',
      branchStateCode: '27',
      customerStateCode: '27'
    });

    assert.strictEqual(invoiceTotals.tax.totalTax, 0, 'Kacha bill must have 0 tax');
    assert.strictEqual(invoiceTotals.grandTotal, 71000, 'Grand total equals taxable amount');

    console.log('    ✓ Test 4: Kacha Bill 0% Tax verified');
  }

  // Test 5: Round-off handling to nearest rupee
  {
    const { roundedAmount, roundOffDiff } = DecimalUtil.roundToRupee(12345.67);
    assert.strictEqual(roundedAmount, 12346, 'Rounded to nearest rupee');
    assert.strictEqual(roundOffDiff, 0.33, 'Round-off diff correctly calculated');

    console.log('    ✓ Test 5: Round-off arithmetic verified');
  }
}

module.exports = runCalculationTests;
