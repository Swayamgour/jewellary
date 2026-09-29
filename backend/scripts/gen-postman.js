/** Regenerates postman/jewellery-erp.postman_collection.json  ->  npm run postman */
const fs = require('fs');
const path = require('path');

const id = (n) => `{{${n}}}`;
const J = (o) => JSON.stringify(o, null, 2);
const item = { productId: id('productId'), barcode: id('barcode'), productName: '22K Gold Bangle', grossWeight: 10, quantity: 1, goldRate: 7195, makingType: 'PER_GRAM', makingRate: 450, wastagePercent: 0 };
const poItem = { productName: '22K Bangle', grossWeight: 10, stoneWeight: 0, quantity: 10, rate: 6000, makingAmount: 10000, gstRate: 3 };

const F = {
  Authentication: [
    ['Login', 'POST', '/auth/login', { email: 'admin@jewelleryerp.com', password: 'Admin@12345' }, "pm.collectionVariables.set('token', pm.response.json().data.token);"],
    ['Me', 'GET', '/auth/me']
  ],
  'Billing (Kacha / Pakka)': [
    ['Create Kacha bill (CONFIRMED)', 'POST', '/billing/kacha', { customerId: id('customerId'), items: [item], discount: 0, payments: [{ amount: 5000, paymentMode: 'CASH' }] }],
    ['Create Kacha bill as DRAFT', 'POST', '/billing/kacha', { customerId: id('customerId'), status: 'DRAFT', items: [item] }],
    ['Update DRAFT', 'PUT', '/billing/kacha/{{invoiceId}}', { items: [item], discount: 500 }],
    ['Confirm DRAFT (+ optional payment)', 'POST', '/billing/kacha/{{invoiceId}}/confirm', { payments: [{ amount: 1000, paymentMode: 'UPI' }] }],
    ['Convert Kacha → Pakka', 'POST', '/billing/kacha/{{invoiceId}}/convert'],
    ['Cancel Kacha (keep money as credit)', 'POST', '/billing/kacha/{{invoiceId}}/cancel', { reason: 'Customer changed mind', paymentAction: 'CREDIT' }],
    ['Create Pakka (GST) invoice', 'POST', '/billing/pakka', { customerId: id('customerId'), items: [item], payments: [] }],
    ['Cancel Pakka (refund cash)', 'POST', '/billing/pakka/{{invoiceId}}/cancel', { reason: 'Wrong customer billed', paymentAction: 'REFUND', refundMode: 'CASH' }],
    ['List Kacha', 'GET', '/billing/kacha'],
    ['List Pakka', 'GET', '/billing/pakka']
  ],
  'Sales & Returns': [
    ['Sales list', 'GET', '/sales'],
    ['Sales return (cash refund of paid part)', 'POST', '/sales/{{invoiceId}}/return', { items: [{ barcode: id('barcode'), quantity: 1 }], refundType: 'CASH', reason: 'Defective clasp' }],
    ['Sales returns list', 'GET', '/sales/returns']
  ],
  Payments: [
    ['Record customer payment', 'POST', '/payments', { referenceType: 'INVOICE', referenceId: id('invoiceId'), entityType: 'CUSTOMER', entityId: id('customerId'), amount: 1000, paymentMode: 'CASH' }],
    ['Record vendor payment', 'POST', '/payments', { referenceType: 'PURCHASE', referenceId: id('purchaseId'), entityType: 'VENDOR', entityId: id('vendorId'), amount: 1000, paymentMode: 'BANK_TRANSFER' }],
    ['List payments', 'GET', '/payments?direction=IN'],
    ['Reverse payment', 'POST', '/payments/{{paymentId}}/reverse', { reversalReason: 'Cheque bounced' }]
  ],
  Purchases: [
    ['Create purchase', 'POST', '/purchases', { vendorId: id('vendorId'), vendorInvoiceNo: 'V-001', items: [{ productId: id('productId'), productName: '22K Bangle', barcode: 'PUR-LOT-1', grossWeight: 10, quantity: 10, rate: 6000, makingAmount: 10000, gstRate: 3 }], paidAmount: 100000, paymentMode: 'BANK_TRANSFER' }],
    ['Create purchase as DRAFT', 'POST', '/purchases', { vendorId: id('vendorId'), status: 'DRAFT', items: [{ productName: 'Chain', grossWeight: 5, quantity: 1, rate: 6000 }] }],
    ['Update DRAFT purchase', 'PUT', '/purchases/{{purchaseId}}', { notes: 'edited' }],
    ['Confirm DRAFT purchase', 'POST', '/purchases/{{purchaseId}}/confirm', { paidAmount: 0 }],
    ['Pay purchase', 'POST', '/purchases/{{purchaseId}}/payments', { amount: 5000, paymentMode: 'UPI' }],
    ['Purchase return (value computed by server)', 'POST', '/purchases/{{purchaseId}}/return', { items: [{ barcode: 'PUR-LOT-1', quantity: 2 }], reason: 'Purity mismatch' }],
    ['Vendor refund received', 'POST', '/purchases/{{purchaseId}}/refund', { amount: 5000, paymentMode: 'BANK_TRANSFER' }],
    ['Cancel purchase', 'POST', '/purchases/{{purchaseId}}/cancel', { reason: 'Duplicate entry', paymentAction: 'REFUND' }],
    ['List purchases', 'GET', '/purchases'],
    ['List purchase returns', 'GET', '/purchases/returns']
  ],
  'Purchase Orders': [
    ['Create PO (DRAFT)', 'POST', '/purchase-orders', { vendorId: id('vendorId'), items: [poItem], expectedDeliveryDate: '2026-12-31' }],
    ['Update PO', 'PUT', '/purchase-orders/{{poId}}', { notes: 'rev 2' }],
    ['Submit', 'POST', '/purchase-orders/{{poId}}/submit'],
    ['Approve', 'POST', '/purchase-orders/{{poId}}/approve', { note: 'ok' }],
    ['Reject', 'POST', '/purchase-orders/{{poId}}/reject', { reason: 'Rate too high' }],
    ['Mark ORDERED', 'POST', '/purchase-orders/{{poId}}/order', {}],
    ['Receive (partial or full)', 'POST', '/purchase-orders/{{poId}}/receive', { items: [{ poItemId: id('poItemId'), quantity: 4 }], vendorInvoiceNo: 'V-77', paidAmount: 0 }],
    ['Close / short-close', 'POST', '/purchase-orders/{{poId}}/close', { reason: 'Vendor cannot supply the rest' }],
    ['Cancel', 'POST', '/purchase-orders/{{poId}}/cancel', { reason: 'No longer needed' }],
    ['List', 'GET', '/purchase-orders'],
    ['Get (with pending qty)', 'GET', '/purchase-orders/{{poId}}']
  ],
  Inventory: [
    ['List', 'GET', '/inventory'],
    ['Movements', 'GET', '/inventory/movements'],
    ['Adjustment', 'POST', '/inventory/adjustment', { barcode: id('barcode'), adjustmentType: 'DAMAGE', quantityDelta: -1, reason: 'Broken in display' }],
    ['Transfer', 'POST', '/inventory/transfer', { barcode: id('barcode'), targetBranchId: id('branchId2') }]
  ],
  'Old Gold Exchange': [
    ['Create (optionally adjust on invoice)', 'POST', '/exchange', { customerId: id('customerId'), invoiceId: id('invoiceId'), items: [{ itemDescription: 'Old chain', purityTestedPercent: 91.6, grossWeight: 10, goldRateApplied: 7195 }] }],
    ['Adjust on another invoice', 'POST', '/exchange/{{exchangeId}}/adjust', { invoiceId: id('invoiceId') }],
    ['Pay out unused value', 'POST', '/exchange/{{exchangeId}}/payout', { paymentMode: 'CASH' }],
    ['List', 'GET', '/exchange']
  ],
  Reports: [
    ...['sales', 'sales-returns', 'purchase', 'purchase-returns', 'payments', 'collections', 'expenses', 'profit-loss', 'cash-summary', 'exchange', 'old-gold', 'stock', 'gold-stock', 'silver-stock', 'stock-movement', 'customer-outstanding', 'vendor-outstanding'].map((r) => [r, 'GET', `/reports/${r}?startDate=2026-01-01&endDate=2026-12-31`]),
    ['Excel export (any report key)', 'GET', '/reports/export/excel?reportType=purchase'],
    ['Books reconciliation (?fix=true to re-derive)', 'GET', '/reports/reconciliation']
  ],
  'Dashboard, Orders, Expenses, Masters': [
    ['Dashboard', 'GET', '/dashboard?filter=month'],
    ['Create expense', 'POST', '/expenses', { title: 'Shop rent', category: 'RENT', amount: 25000, paymentMode: 'BANK_TRANSFER' }],
    ['Customer ledger', 'GET', '/customers/{{customerId}}/ledger'],
    ['Vendor ledger', 'GET', '/vendors/{{vendorId}}/ledger'],
    ['Orders', 'GET', '/orders']
  ]
};

const toReq = ([name, method, url, body, test]) => ({
  name,
  event: test ? [{ listen: 'test', script: { type: 'text/javascript', exec: [test] } }] : undefined,
  request: {
    method,
    header: [{ key: 'Content-Type', value: 'application/json' }, { key: 'Authorization', value: 'Bearer {{token}}' }],
    body: body ? { mode: 'raw', raw: J(body) } : undefined,
    url: { raw: `{{baseUrl}}${url}`, host: ['{{baseUrl}}'], path: url.split('?')[0].split('/').filter(Boolean), query: url.includes('?') ? url.split('?')[1].split('&').map((p) => ({ key: p.split('=')[0], value: p.split('=')[1] })) : undefined }
  }
});

const collection = {
  info: { name: 'Jewellery ERP API v2', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json', description: 'Generated by scripts/gen-postman.js. Run "Login" first - it stores the token.' },
  variable: ['baseUrl|http://localhost:5001/api', 'token|', 'customerId|', 'vendorId|', 'productId|', 'barcode|', 'invoiceId|', 'purchaseId|', 'paymentId|', 'poId|', 'poItemId|', 'exchangeId|', 'branchId2|'].map((v) => ({ key: v.split('|')[0], value: v.split('|')[1], type: 'string' })),
  item: Object.entries(F).map(([name, reqs]) => ({ name, item: reqs.map(toReq) }))
};
fs.mkdirSync(path.join(__dirname, '../postman'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../postman/jewellery-erp.postman_collection.json'), J(collection));
console.log('Postman collection written:', Object.values(F).reduce((a, r) => a + r.length, 0), 'requests');
