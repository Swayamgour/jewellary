import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { AppLayout } from './components/layout/AppLayout';

// Module Pages
import { DashboardPage } from './features/dashboard/DashboardPage';
import { BillingPOSPage } from './features/billing/BillingPOSPage';
import { BillListPage } from './features/billing/BillListPage';
import { InvoiceDetailPage } from './features/billing/InvoiceDetailPage';
import { SalesListPage } from './features/sales/SalesListPage';
import { PurchaseListPage } from './features/purchase/PurchaseListPage';
import { InventoryListPage } from './features/inventory/InventoryListPage';
import { CustomerListPage } from './features/customers/CustomerListPage';
import { CustomerDetailPage } from './features/customers/CustomerDetailPage';
import { VendorListPage } from './features/vendors/VendorListPage';
import { PaymentListPage } from './features/payments/PaymentListPage';
import { ExchangePage } from './features/exchange/ExchangePage';
import { OrdersKanbanPage } from './features/orders/OrdersKanbanPage';
import { ExpenseListPage } from './features/expenses/ExpenseListPage';
import { ReportCenterPage } from './features/reports/ReportCenterPage';
import { GoldRatesPage } from './features/goldRates/GoldRatesPage';
import { SettingsPage } from './features/settings/SettingsPage';

export function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected ERP Application Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Billing & Invoicing (Primary Module) */}
          <Route path="/billing" element={<BillListPage />} />
          <Route path="/billing/new" element={<BillingPOSPage />} />
          <Route path="/billing/:id" element={<InvoiceDetailPage />} />

          {/* Sales */}
          <Route path="/sales" element={<SalesListPage />} />

          {/* Purchases */}
          <Route path="/purchases" element={<PurchaseListPage />} />

          {/* Inventory & Barcode Tracking */}
          <Route path="/inventory" element={<InventoryListPage />} />

          {/* Customers */}
          <Route path="/customers" element={<CustomerListPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />

          {/* Vendors */}
          <Route path="/vendors" element={<VendorListPage />} />

          {/* Payments & Collections */}
          <Route path="/payments" element={<PaymentListPage />} />

          {/* Old Gold / Exchange */}
          <Route path="/exchange" element={<ExchangePage />} />

          {/* Custom Orders & Karigar Workshop */}
          <Route path="/orders" element={<OrdersKanbanPage />} />

          {/* Operating Expenses */}
          <Route path="/expenses" element={<ExpenseListPage />} />

          {/* Financial & Stock Reports */}
          <Route path="/reports" element={<ReportCenterPage />} />
          <Route path="/reports/:reportType" element={<ReportCenterPage />} />

          {/* Daily Gold Rates */}
          <Route path="/gold-rates" element={<GoldRatesPage />} />

          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
