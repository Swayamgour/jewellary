import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { logout } from '../../features/auth/authSlice';

// Set VITE_API_URL in .env (see .env.example). Must include the /api suffix.
export const API_URL = 'http://localhost:5001/api'

const baseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: (headers, { getState }) => {
    const state = getState();
    const token = state.auth?.token;
    const branch = state.auth?.branch;

    if (token) headers.set('Authorization', `Bearer ${token}`);

    const branchId = branch?._id || branch?.id || (typeof branch === 'string' ? branch : null);
    if (branchId) headers.set('x-branch-id', branchId.toString());

    return headers;
  }
});

const baseQueryWithReauth = async (args, api, extraOptions) => {
  const result = await baseQuery(args, api, extraOptions);
  const url = typeof args === 'string' ? args : args?.url;
  // 401 on the login call itself just means "wrong password" - do not log anybody out for that
  if (result.error && result.error.status === 401 && url !== '/auth/login') {
    api.dispatch(logout());
  }
  return result;
};

// Everything that can change money / stock / balances refreshes all of these views.
const MONEY_TAGS = [
  'Billing', 'Sales', 'Payment', 'Customer', 'Vendor', 'Dashboard', 'Report',
  'Inventory', 'Exchange', 'Purchase', 'PurchaseOrder', 'Order'
];

const post = (url, body) => ({ url, method: 'POST', body });

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Auth', 'Dashboard', 'Billing', 'Sales', 'Purchase', 'PurchaseOrder', 'Inventory', 'Customer',
    'Vendor', 'Payment', 'Exchange', 'Order', 'Expense', 'Report', 'GoldRate', 'Branch', 'Product',
    'Category', 'User'
  ],
  endpoints: (builder) => ({
    // ------------------------------------------------------------------ AUTH
    login: builder.mutation({
      query: (credentials) => post('/auth/login', credentials)
    }),
    getMe: builder.query({ query: () => '/auth/me', providesTags: ['Auth'] }),
    logoutUser: builder.mutation({ query: () => post('/auth/logout') }),

    // ------------------------------------------------------------------ DASHBOARD
    getDashboard: builder.query({
      query: (params) => ({ url: '/dashboard', params }),
      providesTags: ['Dashboard']
    }),

    // ------------------------------------------------------------------ BILLING
    // Unified register: every bill (Kacha + Pakka) in every status, server-side search & paging
    getInvoices: builder.query({
      query: (params) => ({ url: '/billing', params }),
      providesTags: ['Billing']
    }),
    // One bill of any type / status, together with its payments and sales returns
    getInvoiceById: builder.query({
      query: (id) => `/billing/${id}`,
      providesTags: (r, e, id) => [{ type: 'Billing', id }, 'Billing']
    }),
    createInvoice: builder.mutation({
      // body: { billType: 'KACHA' | 'PAKKA', customerId, items, discount, payments, status, notes }
      query: ({ billType, ...body }) => post(billType === 'PAKKA' ? '/billing/pakka' : '/billing/kacha', body),
      invalidatesTags: MONEY_TAGS
    }),
    updateDraftInvoice: builder.mutation({
      query: ({ id, billType, ...body }) => ({
        url: `/billing/${billType === 'PAKKA' ? 'pakka' : 'kacha'}/${id}`,
        method: 'PUT',
        body
      }),
      invalidatesTags: MONEY_TAGS
    }),
    confirmDraftInvoice: builder.mutation({
      query: ({ id, billType, payments }) =>
        post(`/billing/${billType === 'PAKKA' ? 'pakka' : 'kacha'}/${id}/confirm`, { payments: payments || [] }),
      invalidatesTags: MONEY_TAGS
    }),
    convertKachaToPakka: builder.mutation({
      query: (id) => post(`/billing/kacha/${id}/convert`),
      invalidatesTags: MONEY_TAGS
    }),
    cancelInvoice: builder.mutation({
      // paymentAction: 'CREDIT' (keep paid money as customer credit) | 'REFUND' (pay it back)
      query: ({ id, billType, reason, paymentAction, refundMode }) =>
        post(`/billing/${billType === 'PAKKA' ? 'pakka' : 'kacha'}/${id}/cancel`, {
          reason,
          paymentAction: paymentAction || 'CREDIT',
          refundMode: refundMode || 'CASH'
        }),
      invalidatesTags: MONEY_TAGS
    }),

    // ------------------------------------------------------------------ SALES
    getSales: builder.query({
      query: (params) => ({ url: '/sales', params }),
      providesTags: ['Sales']
    }),
    getSaleById: builder.query({
      query: (id) => `/sales/${id}`,
      providesTags: (r, e, id) => [{ type: 'Sales', id }, 'Sales']
    }),
    getSalesReturns: builder.query({
      query: (params) => ({ url: '/sales/returns', params }),
      providesTags: ['Sales']
    }),
    recordSalesReturn: builder.mutation({
      // items: [{ invoiceItemId, quantity }]  refundType: LEDGER_CREDIT | CASH | UPI | BANK_TRANSFER
      // The backend values the return itself - never send amounts.
      query: ({ id, items, refundType, reason }) => post(`/sales/${id}/return`, { items, refundType, reason }),
      invalidatesTags: MONEY_TAGS
    }),

    // ------------------------------------------------------------------ PURCHASES
    getPurchases: builder.query({
      query: (params) => ({ url: '/purchases', params }),
      providesTags: ['Purchase']
    }),
    getPurchaseById: builder.query({
      query: (id) => `/purchases/${id}`,
      providesTags: (r, e, id) => [{ type: 'Purchase', id }, 'Purchase']
    }),
    getPurchaseReturns: builder.query({
      query: (params) => ({ url: '/purchases/returns', params }),
      providesTags: ['Purchase']
    }),
    createPurchase: builder.mutation({
      query: (body) => post('/purchases', body),
      invalidatesTags: MONEY_TAGS
    }),
    updatePurchase: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/purchases/${id}`, method: 'PUT', body }),
      invalidatesTags: MONEY_TAGS
    }),
    confirmPurchase: builder.mutation({
      query: ({ id, ...body }) => post(`/purchases/${id}/confirm`, body),
      invalidatesTags: MONEY_TAGS
    }),
    cancelPurchase: builder.mutation({
      query: ({ id, ...body }) => post(`/purchases/${id}/cancel`, body),
      invalidatesTags: MONEY_TAGS
    }),
    payPurchase: builder.mutation({
      query: ({ id, ...body }) => post(`/purchases/${id}/payments`, body),
      invalidatesTags: MONEY_TAGS
    }),
    refundPurchase: builder.mutation({
      query: ({ id, ...body }) => post(`/purchases/${id}/refund`, body),
      invalidatesTags: MONEY_TAGS
    }),
    recordPurchaseReturn: builder.mutation({
      // items: [{ purchaseItemId, quantity }] - value is computed by the backend
      query: ({ id, items, reason }) => post(`/purchases/${id}/return`, { items, reason }),
      invalidatesTags: MONEY_TAGS
    }),

    // ------------------------------------------------------------------ PURCHASE ORDERS
    getPurchaseOrders: builder.query({
      query: (params) => ({ url: '/purchase-orders', params }),
      providesTags: ['PurchaseOrder']
    }),
    getPurchaseOrderById: builder.query({
      query: (id) => `/purchase-orders/${id}`,
      providesTags: (r, e, id) => [{ type: 'PurchaseOrder', id }, 'PurchaseOrder']
    }),
    createPurchaseOrder: builder.mutation({
      query: (body) => post('/purchase-orders', body),
      invalidatesTags: ['PurchaseOrder']
    }),
    updatePurchaseOrder: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/purchase-orders/${id}`, method: 'PUT', body }),
      invalidatesTags: ['PurchaseOrder']
    }),
    poAction: builder.mutation({
      // action: submit | approve | reject | order | close | cancel     body: { note } | { reason }
      query: ({ id, action, ...body }) => post(`/purchase-orders/${id}/${action}`, body),
      invalidatesTags: ['PurchaseOrder']
    }),
    receivePurchaseOrder: builder.mutation({
      query: ({ id, ...body }) => post(`/purchase-orders/${id}/receive`, body),
      invalidatesTags: MONEY_TAGS
    }),

    // ------------------------------------------------------------------ INVENTORY
    getInventory: builder.query({
      query: (params) => ({ url: '/inventory', params }),
      providesTags: ['Inventory']
    }),
    getInventoryById: builder.query({
      query: (id) => `/inventory/${id}`,
      providesTags: (r, e, id) => [{ type: 'Inventory', id }, 'Inventory']
    }),
    getStockMovements: builder.query({
      query: (params) => ({ url: '/inventory/movements', params }),
      providesTags: ['Inventory']
    }),
    stockAdjustment: builder.mutation({
      // { barcode, adjustmentType: ADJUSTMENT_IN|ADJUSTMENT_OUT|DAMAGE|LOSS, quantityDelta (+/-), reason }
      query: (body) => post('/inventory/adjustment', body),
      invalidatesTags: ['Inventory', 'Dashboard', 'Report']
    }),
    stockTransfer: builder.mutation({
      // { barcode, targetBranchId, reason }
      query: (body) => post('/inventory/transfer', body),
      invalidatesTags: ['Inventory', 'Dashboard', 'Report']
    }),

    // ------------------------------------------------------------------ CUSTOMERS
    getCustomers: builder.query({
      query: (params) => ({ url: '/customers', params }),
      providesTags: ['Customer']
    }),
    getCustomerById: builder.query({
      query: (id) => `/customers/${id}`,
      providesTags: (r, e, id) => [{ type: 'Customer', id }, 'Customer']
    }),
    createCustomer: builder.mutation({
      query: (body) => post('/customers', body),
      invalidatesTags: ['Customer']
    }),
    updateCustomer: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/customers/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Customer']
    }),
    deleteCustomer: builder.mutation({
      query: (id) => ({ url: `/customers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Customer']
    }),
    // -> { customer, transactions: [...] }
    getCustomerLedger: builder.query({
      query: ({ id, ...params }) => ({ url: `/customers/${id}/ledger`, params }),
      providesTags: ['Customer', 'Billing', 'Payment']
    }),
    getCustomerBills: builder.query({
      query: ({ id, ...params }) => ({ url: `/customers/${id}/bills`, params }),
      providesTags: ['Customer', 'Billing']
    }),
    getCustomerPayments: builder.query({
      query: ({ id, ...params }) => ({ url: `/customers/${id}/payments`, params }),
      providesTags: ['Customer', 'Payment']
    }),

    // ------------------------------------------------------------------ VENDORS
    getVendors: builder.query({
      query: (params) => ({ url: '/vendors', params }),
      providesTags: ['Vendor']
    }),
    getVendorById: builder.query({
      query: (id) => `/vendors/${id}`,
      providesTags: (r, e, id) => [{ type: 'Vendor', id }, 'Vendor']
    }),
    createVendor: builder.mutation({
      query: (body) => post('/vendors', body),
      invalidatesTags: ['Vendor']
    }),
    updateVendor: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/vendors/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Vendor']
    }),
    deleteVendor: builder.mutation({
      query: (id) => ({ url: `/vendors/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Vendor']
    }),
    getVendorLedger: builder.query({
      query: ({ id, ...params }) => ({ url: `/vendors/${id}/ledger`, params }),
      providesTags: ['Vendor', 'Purchase', 'Payment']
    }),
    getVendorPurchases: builder.query({
      query: ({ id, ...params }) => ({ url: `/vendors/${id}/purchases`, params }),
      providesTags: ['Vendor', 'Purchase']
    }),

    // ------------------------------------------------------------------ PAYMENTS
    getPayments: builder.query({
      query: (params) => ({ url: '/payments', params }),
      providesTags: ['Payment']
    }),
    getPaymentById: builder.query({
      query: (id) => `/payments/${id}`,
      providesTags: (r, e, id) => [{ type: 'Payment', id }]
    }),
    recordPayment: builder.mutation({
      query: (body) => post('/payments', body),
      invalidatesTags: MONEY_TAGS
    }),
    reversePayment: builder.mutation({
      query: ({ id, reversalReason }) => post(`/payments/${id}/reverse`, { reversalReason }),
      invalidatesTags: MONEY_TAGS
    }),

    // ------------------------------------------------------------------ EXCHANGE (OLD GOLD)
    getExchanges: builder.query({
      query: (params) => ({ url: '/exchange', params }),
      providesTags: ['Exchange']
    }),
    getExchangeById: builder.query({
      query: (id) => `/exchange/${id}`,
      providesTags: (r, e, id) => [{ type: 'Exchange', id }, 'Exchange']
    }),
    createExchange: builder.mutation({
      query: (body) => post('/exchange', body),
      invalidatesTags: MONEY_TAGS
    }),
    adjustExchange: builder.mutation({
      query: ({ id, invoiceId, amount }) => post(`/exchange/${id}/adjust`, { invoiceId, ...(amount ? { amount } : {}) }),
      invalidatesTags: MONEY_TAGS
    }),
    payoutExchange: builder.mutation({
      query: ({ id, ...body }) => post(`/exchange/${id}/payout`, body),
      invalidatesTags: MONEY_TAGS
    }),

    // ------------------------------------------------------------------ EXPENSES
    getExpenses: builder.query({
      query: (params) => ({ url: '/expenses', params }),
      providesTags: ['Expense']
    }),
    getExpenseById: builder.query({
      query: (id) => `/expenses/${id}`,
      providesTags: (r, e, id) => [{ type: 'Expense', id }]
    }),
    createExpense: builder.mutation({
      query: (body) => post('/expenses', body),
      invalidatesTags: ['Expense', 'Dashboard', 'Report']
    }),
    updateExpense: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/expenses/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Expense', 'Dashboard', 'Report']
    }),
    deleteExpense: builder.mutation({
      query: (id) => ({ url: `/expenses/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Expense', 'Dashboard', 'Report']
    }),

    // ------------------------------------------------------------------ CUSTOM ORDERS
    getOrders: builder.query({
      query: (params) => ({ url: '/orders', params }),
      providesTags: ['Order']
    }),
    getOrderById: builder.query({
      query: (id) => `/orders/${id}`,
      providesTags: (r, e, id) => [{ type: 'Order', id }]
    }),
    createOrder: builder.mutation({
      query: (body) => post('/orders', body),
      invalidatesTags: ['Order', 'Customer', 'Dashboard', 'Payment']
    }),
    updateOrderStatus: builder.mutation({
      query: ({ id, status }) => ({ url: `/orders/${id}/status`, method: 'PUT', body: { status } }),
      invalidatesTags: ['Order', 'Dashboard']
    }),
    assignKarigar: builder.mutation({
      // { artisanName, phone, expectedCompletionDate }
      query: ({ id, ...body }) => ({ url: `/orders/${id}/karigar`, method: 'PUT', body }),
      invalidatesTags: ['Order']
    }),

    // ------------------------------------------------------------------ GOLD RATES
    getCurrentGoldRates: builder.query({ query: () => '/gold-rates/current', providesTags: ['GoldRate'] }),
    getGoldRateHistory: builder.query({
      query: (params) => ({ url: '/gold-rates', params }),
      providesTags: ['GoldRate']
    }),
    setGoldRate: builder.mutation({
      query: (body) => post('/gold-rates', body),
      invalidatesTags: ['GoldRate']
    }),

    // ------------------------------------------------------------------ REPORTS
    // key: sales | sales-returns | purchase | purchase-returns | payments | collections | expenses |
    //      profit-loss | cash-summary | exchange | old-gold | stock | gold-stock | silver-stock |
    //      stock-movement | customer-outstanding | vendor-outstanding
    getReport: builder.query({
      query: ({ key, ...params }) => ({ url: `/reports/${key}`, params }),
      providesTags: ['Report']
    }),
    getReconciliation: builder.query({
      query: (params) => ({ url: '/reports/reconciliation', params }),
      providesTags: ['Report']
    }),
    fixReconciliation: builder.mutation({
      query: () => ({ url: '/reports/reconciliation', params: { fix: 'true' } }),
      invalidatesTags: MONEY_TAGS
    }),

    // ------------------------------------------------------------------ MASTER DATA
    getBranches: builder.query({ query: () => '/branches', providesTags: ['Branch'] }),
    getProducts: builder.query({
      query: (params) => ({ url: '/products', params }),
      providesTags: ['Product']
    }),
    getCategories: builder.query({ query: () => '/categories', providesTags: ['Category'] }),
    getUsers: builder.query({ query: () => '/users', providesTags: ['User'] })
  })
});

export const {
  useLoginMutation, useGetMeQuery, useLogoutUserMutation,
  useGetDashboardQuery,
  useGetInvoicesQuery, useGetInvoiceByIdQuery, useCreateInvoiceMutation, useUpdateDraftInvoiceMutation,
  useConfirmDraftInvoiceMutation, useConvertKachaToPakkaMutation, useCancelInvoiceMutation,
  useGetSalesQuery, useGetSaleByIdQuery, useGetSalesReturnsQuery, useRecordSalesReturnMutation,
  useGetPurchasesQuery, useGetPurchaseByIdQuery, useGetPurchaseReturnsQuery, useCreatePurchaseMutation,
  useUpdatePurchaseMutation, useConfirmPurchaseMutation, useCancelPurchaseMutation, usePayPurchaseMutation,
  useRefundPurchaseMutation, useRecordPurchaseReturnMutation,
  useGetPurchaseOrdersQuery, useGetPurchaseOrderByIdQuery, useCreatePurchaseOrderMutation,
  useUpdatePurchaseOrderMutation, usePoActionMutation, useReceivePurchaseOrderMutation,
  useGetInventoryQuery, useLazyGetInventoryQuery, useGetInventoryByIdQuery, useGetStockMovementsQuery, useStockAdjustmentMutation,
  useStockTransferMutation,
  useGetCustomersQuery, useGetCustomerByIdQuery, useCreateCustomerMutation, useUpdateCustomerMutation,
  useDeleteCustomerMutation, useGetCustomerLedgerQuery, useGetCustomerBillsQuery, useGetCustomerPaymentsQuery,
  useGetVendorsQuery, useGetVendorByIdQuery, useCreateVendorMutation, useUpdateVendorMutation,
  useDeleteVendorMutation, useGetVendorLedgerQuery, useGetVendorPurchasesQuery,
  useGetPaymentsQuery, useGetPaymentByIdQuery, useRecordPaymentMutation, useReversePaymentMutation,
  useGetExchangesQuery, useGetExchangeByIdQuery, useCreateExchangeMutation, useAdjustExchangeMutation,
  usePayoutExchangeMutation,
  useGetExpensesQuery, useGetExpenseByIdQuery, useCreateExpenseMutation, useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useGetOrdersQuery, useGetOrderByIdQuery, useCreateOrderMutation, useUpdateOrderStatusMutation,
  useAssignKarigarMutation,
  useGetCurrentGoldRatesQuery, useGetGoldRateHistoryQuery, useSetGoldRateMutation,
  useGetReportQuery, useGetReconciliationQuery, useFixReconciliationMutation,
  useGetBranchesQuery, useGetProductsQuery, useGetCategoriesQuery, useGetUsersQuery
} = baseApi;
