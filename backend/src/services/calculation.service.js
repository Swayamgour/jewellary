const DecimalUtil = require('../utils/decimal');
const { MAKING_CHARGE_TYPES, GST_RATES } = require('../config/constants');

class CalculationService {
  /**
   * Calculate single jewellery item pricing
   * @param {Object} item
   * @returns {Object} Calculated line item with breakdown
   */
  static calculateItemPrice(item) {
    const grossWeight = DecimalUtil.roundWeight(item.grossWeight || 0);
    const stoneWeight = DecimalUtil.roundWeight(item.stoneWeight || 0);

    if (grossWeight < stoneWeight) {
      throw new Error(`Gross weight (${grossWeight}g) cannot be less than stone weight (${stoneWeight}g)`);
    }

    const netWeight = DecimalUtil.subtract(grossWeight, stoneWeight);
    const goldRate = DecimalUtil.roundCurrency(item.goldRate || 0);
    const quantity = parseInt(item.quantity || 1, 10);

    // 1. Pure Gold / Metal Value
    const singleGoldAmount = DecimalUtil.multiply(netWeight, goldRate);
    const goldAmount = DecimalUtil.multiply(singleGoldAmount, quantity);

    // 2. Making Charges
    let singleMakingAmount = 0;
    const makingType = item.makingType || MAKING_CHARGE_TYPES.PER_GRAM;
    const makingRate = DecimalUtil.roundCurrency(item.makingRate || 0);

    if (makingType === MAKING_CHARGE_TYPES.PERCENTAGE) {
      singleMakingAmount = DecimalUtil.percentage(singleGoldAmount, makingRate);
    } else if (makingType === MAKING_CHARGE_TYPES.PER_GRAM) {
      singleMakingAmount = DecimalUtil.multiply(grossWeight, makingRate);
    } else if (makingType === MAKING_CHARGE_TYPES.FIXED) {
      singleMakingAmount = makingRate;
    }
    const makingAmount = DecimalUtil.multiply(singleMakingAmount, quantity);

    // 3. Wastage Charges (Calculated on Net Weight * Wastage % * Gold Rate)
    const wastagePercent = DecimalUtil.round(item.wastagePercent || 0, 2);
    const singleWastageWeight = DecimalUtil.multiply(netWeight, wastagePercent / 100, 3);
    const singleWastageAmount = DecimalUtil.multiply(singleWastageWeight, goldRate);
    const wastageAmount = DecimalUtil.multiply(singleWastageAmount, quantity);

    // 4. Stone Charges
    const stoneAmount = DecimalUtil.roundCurrency((item.stoneAmount || 0) * quantity);

    // 5. Discount
    const discount = DecimalUtil.roundCurrency(item.discount || 0);

    // 6. Taxable Amount for this item
    const itemPreDiscount = DecimalUtil.add(goldAmount, makingAmount, wastageAmount, stoneAmount);
    const taxableAmount = Math.max(0, DecimalUtil.subtract(itemPreDiscount, discount));

    return {
      ...item,
      grossWeight,
      stoneWeight,
      netWeight,
      quantity,
      goldRate,
      goldAmount,
      makingType,
      makingRate,
      makingAmount,
      wastagePercent,
      wastageAmount,
      stoneAmount,
      discount,
      taxableAmount,
      totalAmount: taxableAmount
    };
  }

  /**
   * Calculate entire invoice financials (including taxes & round-off)
   * @param {Object} params
   * @param {Array} params.items - Array of items
   * @param {string} params.billType - 'KACHA' or 'PAKKA'
   * @param {string} params.branchStateCode - Branch state code (e.g. '07')
   * @param {string} params.customerStateCode - Customer state code (e.g. '07')
   * @param {number} [params.extraDiscount] - Invoice level discount
   */
  static calculateInvoiceTotals({
    items = [],
    billType = 'KACHA',
    branchStateCode = '07',
    customerStateCode = '07',
    extraDiscount = 0
  }) {
    if (!items || items.length === 0) {
      throw new Error('Invoice must contain at least one item');
    }

    let subtotal = 0;
    let itemsDiscount = 0;
    let totalTaxable = 0;

    const calculatedItems = items.map((item) => {
      const calculated = this.calculateItemPrice(item);
      subtotal = DecimalUtil.add(subtotal, calculated.goldAmount, calculated.makingAmount, calculated.wastageAmount, calculated.stoneAmount);
      itemsDiscount = DecimalUtil.add(itemsDiscount, calculated.discount);
      totalTaxable = DecimalUtil.add(totalTaxable, calculated.taxableAmount);
      return calculated;
    });

    const totalDiscount = DecimalUtil.add(itemsDiscount, extraDiscount);
    const finalTaxableAmount = Math.max(0, DecimalUtil.subtract(subtotal, totalDiscount));

    let tax = {
      isInterState: false,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 0,
      igstAmount: 0,
      totalTax: 0
    };

    if (billType === 'PAKKA') {
      // Determine if Intra-state or Inter-state GST applies
      const isInterState = branchStateCode && customerStateCode && branchStateCode !== customerStateCode;
      tax.isInterState = Boolean(isInterState);

      if (isInterState) {
        tax.igstRate = GST_RATES.IGST;
        tax.igstAmount = DecimalUtil.percentage(finalTaxableAmount, GST_RATES.IGST);
        tax.totalTax = tax.igstAmount;
      } else {
        tax.cgstRate = GST_RATES.CGST;
        tax.cgstAmount = DecimalUtil.percentage(finalTaxableAmount, GST_RATES.CGST);
        tax.sgstRate = GST_RATES.SGST;
        tax.sgstAmount = DecimalUtil.percentage(finalTaxableAmount, GST_RATES.SGST);
        tax.totalTax = DecimalUtil.add(tax.cgstAmount, tax.sgstAmount);
      }
    }

    const preRoundGrandTotal = DecimalUtil.add(finalTaxableAmount, tax.totalTax);
    const { roundedAmount, roundOffDiff } = DecimalUtil.roundToRupee(preRoundGrandTotal);

    return {
      items: calculatedItems,
      subtotal,
      discount: totalDiscount,
      taxableAmount: finalTaxableAmount,
      tax,
      roundOff: roundOffDiff,
      grandTotal: roundedAmount
    };
  }
}

module.exports = CalculationService;
