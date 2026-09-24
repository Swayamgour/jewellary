# 💎 AuraJewel ERP — Modern React Frontend

A production-grade, modern, and luxury-styled **Jewellery ERP, POS, Bullion Management, Inventory & Accounting System** frontend built with **React**, **Vite**, **Redux Toolkit**, **RTK Query**, **Tailwind CSS**, and **Lucide React**.

Directly integrated with the Node.js / Express / MongoDB backend.

---

## 🌟 Key Modules & Features

1. **POS Billing Engine (Primary Module)**
   - Dual-Mode Billing: Switch seamlessly between **Kacha Bill** (estimation/trade bill) and **Pakka Bill** (official 3% GST tax invoice).
   - Barcode Scanner integration: Instant item lookups from available physical stock.
   - Real-time jewelry calculation engine matching backend:
     - Net Weight = $\text{Gross Weight} - \text{Stone Weight}$
     - Metal Value = $\text{Net Weight} \times \text{Gold Rate}$
     - Making charges (`PER_GRAM`, `PERCENTAGE`, or `FIXED`)
     - Wastage metal calculation
     - Intra-state (1.5% CGST + 1.5% SGST) or Inter-state (3% IGST)
     - Standard Indian rupee round-off
   - Multi-tender Split Payment: Cash, UPI, Card Terminal, Old Gold Exchange credit, Bank Transfer.
   - Atomic **Kacha $\rightarrow$ Pakka Conversion**: Preserves original bill and generates an official tax invoice without duplicate inventory deductions.
   - Print-ready A4 GST Invoices and compact 80mm POS Thermal Slips with WhatsApp sharing.

2. **Executive Bullion Dashboard**
   - 100% Real aggregated metrics via RTK Query (no hardcoded numbers).
   - Sales vs Purchases comparison bar charts.
   - Payment collection channel breakdown (Cash, UPI, Card, Bank) with Recharts.
   - Physical vault stock summary (Gold, Silver, Diamond).
   - Attention Required alerts: Customer overdues, pending manufacturing orders, physical stock alerts.

3. **Inventory & Unique Barcode Tracking**
   - Barcode-level inventory tracking (`JWL-2609-BAN001`).
   - Physical vault status: `AVAILABLE`, `SOLD`, `RESERVED`, `DAMAGED`.
   - Immutable stock movement audit log (`PURCHASE`, `SALE`, `SALE_RETURN`, `TRANSFER`, `ADJUSTMENT`).
   - Physical audit stock adjustments & multi-branch transfer workflows.

4. **Customer & Vendor Double-Entry Ledgers**
   - Complete profiles with live running balance tracking.
   - Tabbed ledger statement with Debit (+ due), Credit (- paid), reference numbers, and running balance.
   - Full invoice and payment history.

5. **Old Gold & Exchange Counter**
   - Interactive valuation calculator with gross/stone weight, touchstone/XRF spectrometer purity %, and melting loss deductions.
   - Generates instant exchange credit vouchers redeemable directly at billing.

6. **Custom Manufacturing Orders (Karigar Workshop)**
   - Kanban workflow tracking: `NEW` $\rightarrow$ `CONFIRMED` $\rightarrow$ `MANUFACTURING` $\rightarrow$ `QC` $\rightarrow$ `READY` $\rightarrow$ `DELIVERED`.
   - Artisan (Karigar) assignment and making charges agreement.

7. **Operating Expenses**
   - Track day-to-day store operations, hallmarking fees, refreshments, and store maintenance.
   - Daily and monthly expenditure summaries.

8. **Financial Reports & Native Excel Export**
   - Detailed Sales reports with Kacha / Pakka filters.
   - Stock valuation reports.
   - Customer and Vendor outstanding aging reports.
   - Native Excel (`.xlsx`) export download.

9. **Live Daily Gold Rate Board**
   - Top navbar ticker displaying 24K, 22K, 18K and Silver rates.
   - Quick rate update modal with historical audit log.

10. **POS Keyboard Shortcuts**
    - `F2` — Start New Bill / Reset
    - `F4` — Search / Add Customer
    - `F6` — Add Inventory / Catalog Item
    - `F8` — Settle Full Amount in Cash
    - `Ctrl + S` — Confirm and Save Bill
    - `Ctrl + K` — Global Spotlight Search

---

## 🛠️ Technology Stack

- **Framework**: React 18
- **Build Tool**: Vite 5
- **State & API**: Redux Toolkit & RTK Query
- **Styling**: Tailwind CSS (Custom bespoke luxury jewelry palette)
- **Icons**: Lucide React
- **Data Visualization**: Recharts
- **Forms**: React Hook Form
- **Toasts**: Sonner
- **Routing**: React Router v6

---

## 🚀 Quick Start Guide

### 1. Prerequisites
Ensure the backend server is running at `http://localhost:5000`:
```bash
# In backend directory
npm run dev
```

### 2. Install & Start Frontend
```bash
# In frontend directory
npm install
npm run dev
```
The application will launch at `http://localhost:3000`.

### 3. Demo Admin Credentials
Pre-configured for 1-click login on the login screen:
- **Email**: `admin@jewelleryerp.com`
- **Password**: `Admin@12345`
- **Role**: `SUPER_ADMIN`
- **Branch**: `HO01` (Flagship Head Office)
