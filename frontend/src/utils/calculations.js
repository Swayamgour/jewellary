/**
 * Live-preview calculation for the POS. Mirrors backend calculation.service.js so the cashier sees
 * (almost) exactly what the server will post. The BACKEND IS AUTHORITATIVE - the invoice that comes
 * back from the API is what gets printed / stored.
 *
 *   net weight      = gross - stone                    (weights come from the stock record, per piece)
 *   metal           = net x rate x qty
 *   making          = PER_GRAM: gross x rate x qty | PERCENTAGE: metal% | FIXED: rate x qty
 *   wastage         = net x wastage% x rate x qty
 *   stone           = stoneAmount x qty
 *   taxable (line)  = metal + making + wastage + stone - item discount
 *   GST (PAKKA)     = 3% on (taxable - invoice discount): CGST+SGST 1.5+1.5 in-state, IGST 3 inter-state
 */
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export const GST_TOTAL_RATE = 3;

export const calculateItemPrice = (item) => {
  const grossWeight = num(item.grossWeight);
  const stoneWeight = num(item.stoneWeight);
  const netWeight = Math.max(0, Math.round((grossWeight - stoneWeight) * 1000) / 1000);
  const goldRate = num(item.goldRate);
  const quantity = Math.max(1, parseInt(item.quantity || 1, 10) || 1);

  const goldAmount = r2(netWeight * quantity * goldRate);

  const makingType = item.makingType || 'PER_GRAM';
  const makingRate = num(item.makingRate);
  let makingAmount = 0;
  if (makingType === 'PERCENTAGE') makingAmount = r2((goldAmount * makingRate) / 100);
  else if (makingType === 'PER_GRAM') makingAmount = r2(grossWeight * quantity * makingRate);
  else makingAmount = r2(makingRate * quantity);

  const wastagePercent = num(item.wastagePercent);
  const wastageAmount = r2(netWeight * quantity * (wastagePercent / 100) * goldRate);

  const stoneAmount = r2(num(item.stoneAmount) * quantity);
  const discount = r2(num(item.discount));

  const preDiscount = r2(goldAmount + makingAmount + wastageAmount + stoneAmount);
  const taxableAmount = Math.max(0, r2(preDiscount - discount));

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
    preDiscount,
    taxableAmount,
    totalAmount: taxableAmount
  };
};

export const calculateInvoiceTotals = ({ items = [], billType = 'KACHA', isInterState = false, extraDiscount = 0 }) => {
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
    subtotal += calc.preDiscount;
    return calc;
  });

  subtotal = r2(subtotal);
  itemsDiscount = r2(itemsDiscount);
  const invoiceDiscount = r2(num(extraDiscount));
  const afterItemDiscount = r2(subtotal - itemsDiscount);

  // The API rejects an invoice discount bigger than the bill - flag it here so the cashier sees it first
  const discountError =
    invoiceDiscount < 0
      ? 'Discount cannot be negative'
      : invoiceDiscount > afterItemDiscount
      ? `Discount cannot exceed ${afterItemDiscount}`
      : null;
  const itemDiscountError = calculatedItems.some((i) => i.discount > i.preDiscount)
    ? 'An item discount is bigger than the item value'
    : null;

  const totalDiscount = r2(itemsDiscount + (discountError ? 0 : invoiceDiscount));
  const taxableAmount = Math.max(0, r2(subtotal - totalDiscount));

  const tax = { isInterState: Boolean(isInterState), cgstRate: 0, cgstAmount: 0, sgstRate: 0, sgstAmount: 0, igstRate: 0, igstAmount: 0, totalTax: 0 };

  if (billType === 'PAKKA') {
    if (isInterState) {
      tax.igstRate = 3;
      tax.igstAmount = r2((taxableAmount * 3) / 100);
      tax.totalTax = tax.igstAmount;
    } else {
      tax.cgstRate = 1.5;
      tax.cgstAmount = r2((taxableAmount * 1.5) / 100);
      tax.sgstRate = 1.5;
      tax.sgstAmount = r2((taxableAmount * 1.5) / 100);
      tax.totalTax = r2(tax.cgstAmount + tax.sgstAmount);
    }
  }

  const preRound = r2(taxableAmount + tax.totalTax);
  const grandTotal = Math.round(preRound);
  const roundOff = r2(grandTotal - preRound);

  return {
    items: calculatedItems,
    breakdown: {
      goldAmount: r2(totalGoldAmount),
      makingAmount: r2(totalMakingAmount),
      wastageAmount: r2(totalWastageAmount),
      stoneAmount: r2(totalStoneAmount)
    },
    subtotal,
    itemsDiscount,
    discount: totalDiscount,
    taxableAmount,
    tax,
    roundOff,
    grandTotal,
    error: discountError || itemDiscountError
  };
};
