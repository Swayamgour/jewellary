/**
 * Frontend calculation helper mirroring backend calculation.service.js
 * Ensures instant UI feedback in POS while backend remains authoritative.
 */

export const calculateItemPrice = (item) => {
  const grossWeight = parseFloat(item.grossWeight || 0);
  const stoneWeight = parseFloat(item.stoneWeight || 0);
  const netWeight = Math.max(0, grossWeight - stoneWeight);
  const goldRate = parseFloat(item.goldRate || 0);
  const quantity = parseInt(item.quantity || 1, 10);

  // 1. Metal Value
  const singleGoldAmount = netWeight * goldRate;
  const goldAmount = singleGoldAmount * quantity;

  // 2. Making Charges
  let singleMakingAmount = 0;
  const makingType = item.makingType || 'PER_GRAM';
  const makingRate = parseFloat(item.makingRate || 0);

  if (makingType === 'PERCENTAGE') {
    singleMakingAmount = (singleGoldAmount * makingRate) / 100;
  } else if (makingType === 'PER_GRAM') {
    singleMakingAmount = grossWeight * makingRate;
  } else if (makingType === 'FIXED') {
    singleMakingAmount = makingRate;
  }
  const makingAmount = singleMakingAmount * quantity;

  // 3. Wastage Charges (Net Weight * Wastage% * Gold Rate)
  const wastagePercent = parseFloat(item.wastagePercent || 0);
  const singleWastageWeight = netWeight * (wastagePercent / 100);
  const singleWastageAmount = singleWastageWeight * goldRate;
  const wastageAmount = singleWastageAmount * quantity;

  // 4. Stone charges & discount
  const stoneAmount = (parseFloat(item.stoneAmount || 0)) * quantity;
  const discount = parseFloat(item.discount || 0);

  // 5. Taxable Amount
  const itemPreDiscount = goldAmount + makingAmount + wastageAmount + stoneAmount;
  const taxableAmount = Math.max(0, itemPreDiscount - discount);

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
};

export const calculateInvoiceTotals = ({
  items = [],
  billType = 'KACHA',
  isInterState = false,
  extraDiscount = 0
}) => {
  let subtotal = 0;
  let itemsDiscount = 0;
  let totalGoldAmount = 0;
  let totalMakingAmount = 0;
  let totalWastageAmount = 0;
  let totalStoneAmount = 0;

  const calculatedItems = items.map((item) => {
    const calc = calculateItemPrice(item);
    totalGoldAmount += calc.goldAmount;
    totalMakingAmount += calc.makingAmount;
    totalWastageAmount += calc.wastageAmount;
    totalStoneAmount += calc.stoneAmount;
    itemsDiscount += calc.discount;
    subtotal += calc.goldAmount + calc.makingAmount + calc.wastageAmount + calc.stoneAmount;
    return calc;
  });

  const totalDiscount = itemsDiscount + parseFloat(extraDiscount || 0);
  const taxableAmount = Math.max(0, subtotal - totalDiscount);

  let tax = {
    isInterState: Boolean(isInterState),
    cgstRate: 0,
    cgstAmount: 0,
    sgstRate: 0,
    sgstAmount: 0,
    igstRate: 0,
    igstAmount: 0,
    totalTax: 0
  };

  if (billType === 'PAKKA') {
    if (isInterState) {
      tax.igstRate = 3.0;
      tax.igstAmount = (taxableAmount * 3.0) / 100;
      tax.totalTax = tax.igstAmount;
    } else {
      tax.cgstRate = 1.5;
      tax.cgstAmount = (taxableAmount * 1.5) / 100;
      tax.sgstRate = 1.5;
      tax.sgstAmount = (taxableAmount * 1.5) / 100;
      tax.totalTax = tax.cgstAmount + tax.sgstAmount;
    }
  }

  const preRound = taxableAmount + tax.totalTax;
  const grandTotal = Math.round(preRound);
  const roundOff = Number((grandTotal - preRound).toFixed(2));

  return {
    items: calculatedItems,
    breakdown: {
      goldAmount: totalGoldAmount,
      makingAmount: totalMakingAmount,
      wastageAmount: totalWastageAmount,
      stoneAmount: totalStoneAmount
    },
    subtotal,
    discount: totalDiscount,
    taxableAmount,
    tax,
    roundOff,
    grandTotal
  };
};
