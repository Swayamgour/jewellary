# 💎 Jewellery ERP — Production Backend

A complete, production-grade ERP, POS, Jewellery Management, Inventory, Billing, Accounting, and Retail Backend built with **Node.js**, **Express.js**, **MongoDB**, and **Mongoose**.

---

## 🌟 Key Features

1. **Jewellery Calculation Engine**:
   - Safe decimal precision arithmetic (`src/utils/decimal.js`).
   - Net Weight calculation: $\text{Gross Weight} - \text{Stone Weight}$.
   - Gold Metal Value: $\text{Net Weight} \times \text{Gold Rate}$.
   - Making Charges: Supports `PER_GRAM`, `PERCENTAGE`, and `FIXED` charging types.
   - Wastage Charges: $(\text{Net Weight} \times \text{Wastage \%} / 100) \times \text{Gold Rate}$.
   - Stone charges & line-item discounts.
   - GST Engine: 3% Total (1.5% CGST + 1.5% SGST intra-state or 3% IGST inter-state).
   - Standard Indian round-to-nearest rupee round-off.

2. **Billing Engine (Primary Module)**:
   - **Kacha Bill**: Unofficial estimation / trade bill without GST; updates customer ledger and deducts physical inventory upon confirmation.
   - **Pakka Bill (GST Invoice)**: Official tax invoice with HSN (7113), GSTIN, tax breakdown, and state of supply.
   - **Kacha $\rightarrow$ Pakka Conversion**: Atomic conversion preserving the original bill, generating a sequential GST invoice number, applying tax recalculation, carrying forward payment records, adjusting customer ledger for tax difference, and preventing duplicate stock deduction.
   - **Invoice Cancellation & Returns**: Restores item quantities back to `AVAILABLE` stock and credits customer ledger.

3. **Transaction-Based Inventory & Barcode Tracking**:
   - Unique jewellery barcodes (e.g. `JWL-2609-BAN001`).
   - Prevents selling already-sold unique items.
   - Negative stock protection at Mongoose schema level (`min: 0`) and service level.
   - Immutable **StockMovement** audit logs (`PURCHASE`, `SALE`, `SALE_RETURN`, `PURCHASE_RETURN`, `EXCHANGE_IN`, `TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `DAMAGE`, `LOSS`).

4. **Double-Entry Customer & Vendor Ledgers**:
   - Every financial transaction automatically updates running balances.
   - Customer Ledger: Sales (Debit), Payments/Returns/Exchange (Credit).
   - Vendor Ledger: Purchases (Credit), Payments/Returns (Debit).

5. **Old Gold & Exchange Module**:
   - Customer old jewellery intake with testing method (Touchstone, Acid, XRF Spectrometer).
   - Melting loss deduction and net pure gold valuation.
   - Direct integration into invoice settlement as payment mode.

6. **Gold Rate Management**:
   - Daily rate boards for 24K, 22K, 18K Gold, Silver (999), and Platinum.
   - Historical tracking by branch; rates are locked at invoice creation and never drift historical bills.

7. **Multi-Branch Operations & RBAC**:
   - Multi-tenant architecture with branch scoping (`branchId`).
   - Granular RBAC: 9 Roles (`SUPER_ADMIN`, `ADMIN`, `BRANCH_MANAGER`, `SALES_MANAGER`, `SALES_EXECUTIVE`, `PURCHASE_MANAGER`, `INVENTORY_MANAGER`, `ACCOUNTANT`, `CASHIER`) and 8 Permissions (`VIEW`, `CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `CANCEL`, `PRINT`, `EXPORT`).

8. **Executive Analytics & Excel Reporting**:
   - Aggregated dashboard metrics (no mocks) for sales, purchases, collections by mode (Cash, UPI, Card, Bank), receivables, payables, stock valuations, and net profit.
   - ExcelJS export for Sales and Inventory reports.

---

## 🛠️ Technology Stack

- **Runtime**: Node.js (v18+ or v22+)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JSON Web Tokens (JWT) & bcryptjs password hashing
- **Security**: Helmet, CORS, Express-Rate-Limit
- **Validation**: Joi schema validation
- **Reporting**: ExcelJS, PDFKit
- **File Uploads**: Multer

---

## 📁 Project Structure

```
jewellery-erp-backend/
├── .env.example
├── .env
├── .gitignore
├── package.json
├── README.md
├── server.js
├── postman/
│   └── jewellery-erp.postman_collection.json
├── src/
│   ├── app.js
│   ├── config/
│   │   ├── db.js
│   │   ├── env.js
│   │   └── constants.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Role.js
│   │   ├── Permission.js
│   │   ├── Branch.js
│   │   ├── Customer.js
│   │   ├── Vendor.js
│   │   ├── Category.js
│   │   ├── Product.js
│   │   ├── GoldRate.js
│   │   ├── Inventory.js
│   │   ├── StockMovement.js
│   │   ├── Invoice.js
│   │   ├── Payment.js
│   │   ├── CustomerLedger.js
│   │   ├── VendorLedger.js
│   │   ├── Purchase.js
│   │   ├── PurchaseReturn.js
│   │   ├── SalesReturn.js
│   │   ├── Exchange.js
│   │   ├── Expense.js
│   │   ├── Order.js
│   │   └── AuditLog.js
│   ├── services/
│   │   ├── calculation.service.js
│   │   ├── billing.service.js
│   │   ├── inventory.service.js
│   │   ├── ledger.service.js
│   │   ├── payment.service.js
│   │   ├── exchange.service.js
│   │   ├── purchase.service.js
│   │   ├── dashboard.service.js
│   │   └── report.service.js
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── validators/
│   ├── utils/
│   └── seeders/
│       └── seed.js
└── tests/
    ├── calculation.test.js
    ├── inventory.test.js
    ├── billing.test.js
    └── testRunner.js
```

---

## 🚀 Quick Start Guide

### 1. Installation
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` (pre-configured for local MongoDB):
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/jewellery_erp
JWT_SECRET=super_secret_jwt_key_jewellery_erp_2026_secure
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1000
```

### 3. Seed Database
Seeds default roles, branch, super admin, categories, master designs, gold rates, and initial inventory:
```bash
npm run seed
```

**Default Admin Credentials**:
- **Email**: `admin@jewelleryerp.com`
- **Password**: `Admin@12345`

### 4. Run Automated Test Suite
```bash
npm test
```
All unit and integration tests run against your local database verifying the calculation engine, inventory deductions, Kacha creation, and Pakka conversion.

### 5. Start Development Server
```bash
npm run dev
# or
npm start
```
Server runs at `http://localhost:5000`. Health check endpoint: `GET http://localhost:5000/api/health`.

---

## 📑 Core REST API Endpoints

### 🔐 Authentication
- `POST /api/auth/login` — Authenticate and receive JWT token.
- `GET /api/auth/me` — Get current logged-in user profile.
- `POST /api/auth/logout` — Logout.

### 🧾 Billing & Invoicing (Primary Module)
- `POST /api/billing/kacha` — Create Kacha Bill (deducts stock and debits customer ledger).
- `GET /api/billing/kacha` — List Kacha bills with pagination, date, and customer filters.
- `GET /api/billing/kacha/:id` — Detail view of a Kacha bill.
- `POST /api/billing/kacha/:id/convert` — Atomic conversion of Kacha bill to Pakka GST Invoice.
- `POST /api/billing/pakka` — Create Pakka Bill (GST Tax Invoice).
- `GET /api/billing/pakka` — List Pakka bills.
- `GET /api/billing/pakka/:id` — Detail view of a Pakka invoice.
- `POST /api/billing/pakka/:id/cancel` — Cancel invoice, restore inventory, and adjust ledger.

### 📦 Inventory & Barcodes
- `GET /api/inventory` — List stock items with filters (`barcode`, `metal`, `purity`, `status`, `branchId`).
- `GET /api/inventory/:id` — Single inventory item details.
- `GET /api/inventory/movements` — Complete audit trail of stock movements.
- `POST /api/inventory/adjustment` — Stock adjustments (`ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `DAMAGE`, `LOSS`).
- `POST /api/inventory/transfer` — Transfer inventory items between branches.

### 💳 Payments
- `POST /api/payments` — Record payment (`CASH`, `UPI`, `CARD`, `BANK_TRANSFER`, `CHEQUE`, `EXCHANGE`).
- `GET /api/payments` — Query payment receipts.
- `POST /api/payments/:id/reverse` — Reverse a payment and adjust ledger.

### 🔄 Old Gold & Exchange
- `POST /api/exchange` — Record customer old gold intake with purity testing and valuation.
- `GET /api/exchange` — List exchange records.

### 👥 Customers & Vendors
- `POST /api/customers` / `GET /api/customers` / `PUT /api/customers/:id`
- `GET /api/customers/:id/ledger` — Complete running statement of customer debits, credits, and balance.
- `GET /api/customers/:id/bills` — Invoices history.
- `POST /api/vendors` / `GET /api/vendors` / `GET /api/vendors/:id/ledger`

### 📊 Dashboard & Reports
- `GET /api/dashboard?filter=month` — Real aggregated metrics (sales, purchases, collections, inventory value, net profit).
- `GET /api/reports/sales` — Detailed sales summary.
- `GET /api/reports/stock` — Inventory valuation report.
- `GET /api/reports/customer-outstanding` — All customers with balance due.
- `GET /api/reports/vendor-outstanding` — All vendors with payable balances.
- `GET /api/reports/export/excel?reportType=sales` — Download native Excel (`.xlsx`) report.

---

## 📮 Postman Collection
Import `postman/jewellery-erp.postman_collection.json` into Postman. Set environment variables `baseUrl` (`http://localhost:5000/api`) and `token` (from the Login endpoint).
