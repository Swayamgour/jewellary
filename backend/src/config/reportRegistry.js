const { ROLES } = require('./constants');

const c = (header, key, width = 16) => ({ header, key, width });
const FIN = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.ACCOUNTANT];
const STOCK = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.INVENTORY_MANAGER];
const BUY = [...FIN, ROLES.PURCHASE_MANAGER];

/**
 * One entry per report. Drives:  GET /reports/<path>   and   GET /reports/export/excel?reportType=<key>
 * `params` = query-string filters passed to the service (branchId always comes from the branch middleware).
 */
module.exports = {
  sales: {
    path: 'sales', method: 'getSalesReport', roles: FIN, params: ['startDate', 'endDate', 'billType', 'customerId'],
    columns: [c('Invoice No', 'invoiceNo', 24), c('Type', 'billType', 10), c('Date', 'invoiceDate', 14), c('Customer', 'customerName', 22), c('Taxable', 'taxableAmount'), c('Tax', 'taxAmount', 12), c('Grand Total', 'grandTotal'), c('Returned', 'returned'), c('Paid', 'paid'), c('Due', 'due'), c('Status', 'status', 12), c('Payment', 'paymentStatus', 12)]
  },
  'sales-returns': {
    path: 'sales-returns', method: 'getSalesReturnReport', roles: FIN, params: ['startDate', 'endDate', 'customerId'],
    columns: [c('Return No', 'returnNo', 24), c('Date', 'returnDate', 14), c('Invoice', 'invoiceNo', 22), c('Customer', 'customerName', 22), c('Items', 'items', 32), c('Taxable', 'taxable'), c('Tax', 'tax', 12), c('Value', 'totalValue'), c('Cash Refunded', 'cashRefunded'), c('Credit Kept', 'creditRetained'), c('Reason', 'reason', 28)]
  },
  purchase: {
    path: 'purchase', method: 'getPurchaseReport', roles: BUY, params: ['startDate', 'endDate', 'vendorId'],
    columns: [c('Purchase No', 'purchaseNo', 24), c('Date', 'purchaseDate', 14), c('Vendor', 'vendor', 24), c('Vendor Bill', 'vendorInvoiceNo', 16), c('Taxable', 'taxable'), c('Tax', 'tax', 12), c('Total', 'grandTotal'), c('Returned', 'returned'), c('Adjusted Total', 'adjustedTotal'), c('Paid', 'paid'), c('Due', 'due'), c('Refund Due', 'refundDue'), c('Status', 'paymentStatus', 12)]
  },
  'purchase-returns': {
    path: 'purchase-returns', method: 'getPurchaseReturnReport', roles: BUY, params: ['startDate', 'endDate', 'vendorId'],
    columns: [c('Return No', 'returnNo', 24), c('Date', 'returnDate', 14), c('Purchase', 'purchaseNo', 24), c('Vendor', 'vendor', 24), c('Items', 'items', 32), c('Taxable', 'taxable'), c('Tax', 'tax', 12), c('Amount', 'totalAmount'), c('Adjusted Due', 'adjustedDue'), c('Refund Due', 'refundDue'), c('Reason', 'reason', 28)]
  },
  payments: {
    path: 'payments', method: 'getPaymentReport', roles: FIN, params: ['startDate', 'endDate', 'paymentMode', 'entityType', 'direction', 'status'],
    columns: [c('Payment No', 'paymentNo', 24), c('Date', 'paymentDate', 14), c('Direction', 'direction', 10), c('Party', 'entityType', 10), c('Reference', 'referenceType', 12), c('Mode', 'paymentMode', 14), c('Amount', 'amount'), c('Status', 'status', 10), c('Linked To', 'linkedDocType', 20), c('By', 'recordedBy', 16)]
  },
  collections: {
    path: 'collections', method: 'getCollectionReport', roles: FIN, params: ['startDate', 'endDate'],
    columns: [c('Date', 'date', 14), c('Net Collection', 'amount')]
  },
  expenses: {
    path: 'expenses', method: 'getExpenseReport', roles: FIN, params: ['startDate', 'endDate', 'category'],
    columns: [c('Expense No', 'expenseNo', 24), c('Date', 'expenseDate', 14), c('Title', 'title', 26), c('Category', 'category', 16), c('Mode', 'paymentMode', 14), c('Amount', 'amount'), c('By', 'recordedBy', 16)]
  },
  'profit-loss': {
    path: 'profit-loss', method: 'getProfitLoss', roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT], params: ['startDate', 'endDate'],
    columns: [c('Gross Sales', 'grossSales'), c('Sales Returns', 'salesReturns'), c('Net Sales', 'netSales'), c('COGS', 'costOfGoodsSold'), c('Gross Profit', 'grossProfit'), c('Expenses', 'operatingExpenses'), c('Net Profit', 'netProfit')]
  },
  'cash-summary': {
    path: 'cash-summary', method: 'getCashSummary', roles: FIN, params: ['startDate', 'endDate'],
    columns: [c('Mode', 'paymentMode', 16), c('Customer Receipts', 'customerReceipts'), c('Vendor Refunds', 'vendorRefunds'), c('Total In', 'totalIn'), c('Vendor Payments', 'vendorPayments'), c('Customer Refunds', 'customerRefunds'), c('Expenses', 'expenses'), c('Total Out', 'totalOut'), c('Net', 'net')]
  },
  exchange: {
    path: 'exchange', method: 'getExchangeReport', roles: FIN, params: ['startDate', 'endDate', 'customerId', 'status'],
    columns: [c('Exchange No', 'exchangeNo', 24), c('Date', 'exchangeDate', 14), c('Customer', 'customer', 22), c('Gross Wt', 'grossWeight', 12), c('Net Wt', 'netWeight', 12), c('Pure Wt', 'pureWeight', 12), c('Value', 'exchangeValue'), c('Adjusted', 'adjusted'), c('Paid Out', 'paidOut'), c('Unused', 'unused'), c('Status', 'status', 20)]
  },
  'old-gold': {
    path: 'old-gold', method: 'getOldGoldReport', roles: FIN, params: ['startDate', 'endDate'],
    columns: [c('Metal', 'metal', 10), c('Purity', 'purity', 10), c('Pieces', 'pieces', 10), c('Gross Wt', 'grossWeight', 12), c('Net Wt', 'netWeight', 12), c('Melting Loss', 'meltingLossWeight', 14), c('Pure Wt', 'pureWeight', 12), c('Value', 'value')]
  },
  stock: {
    path: 'stock', method: 'getInventoryReport', roles: STOCK, params: ['metal', 'categoryId', 'purity'],
    columns: [c('Barcode', 'barcode', 20), c('Product', 'productName', 26), c('Category', 'category', 16), c('Metal', 'metal', 10), c('Purity', 'purity', 10), c('Qty', 'quantity', 8), c('Unit Net Wt', 'unitNetWeight', 12), c('Net Wt (total)', 'netWeight', 14), c('Gross Wt (total)', 'grossWeight', 14), c('Unit Cost', 'unitCost'), c('Total Cost', 'totalCost'), c('Location', 'location', 16)]
  },
  'gold-stock': {
    path: 'gold-stock', method: 'getMetalStockReport', roles: STOCK, params: [], fixed: { metal: 'GOLD' },
    columns: [c('Purity', 'purity', 10), c('Pieces', 'pieces', 10), c('Gross Wt', 'grossWeight', 14), c('Net Wt', 'netWeight', 14), c('Cost Value', 'totalCost')]
  },
  'silver-stock': {
    path: 'silver-stock', method: 'getMetalStockReport', roles: STOCK, params: [], fixed: { metal: 'SILVER' },
    columns: [c('Purity', 'purity', 10), c('Pieces', 'pieces', 10), c('Gross Wt', 'grossWeight', 14), c('Net Wt', 'netWeight', 14), c('Cost Value', 'totalCost')]
  },
  'stock-movement': {
    path: 'stock-movement', method: 'getStockMovementReport', roles: STOCK, params: ['startDate', 'endDate', 'movementType', 'barcode'],
    columns: [c('Date', 'date', 20), c('Barcode', 'barcode', 20), c('Type', 'movementType', 18), c('Qty Δ', 'quantityDelta', 10), c('Weight Δ', 'weightDelta', 12), c('Balance Qty', 'balanceQuantity', 12), c('Balance Wt', 'balanceWeight', 12), c('Ref', 'referenceType', 14), c('Reason', 'reason', 30), c('By', 'by', 16)]
  },
  'customer-outstanding': {
    path: 'customer-outstanding', method: 'getCustomerOutstandingReport', roles: FIN, params: [],
    columns: [c('Customer', 'name', 24), c('Mobile', 'mobile', 14), c('City', 'city', 14), c('Balance', 'balance'), c('Type', 'type', 12)]
  },
  'vendor-outstanding': {
    path: 'vendor-outstanding', method: 'getVendorOutstandingReport', roles: BUY, params: [],
    columns: [c('Vendor', 'name', 22), c('Company', 'company', 26), c('Mobile', 'mobile', 14), c('Balance', 'balance'), c('Type', 'type', 12)]
  }
};
