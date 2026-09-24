import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { logout } from '../../features/auth/authSlice';

const baseQuery = fetchBaseQuery({
  baseUrl: 'https://jewellary-u8qu.onrender.com/api',
  prepareHeaders: (headers, { getState }) => {
    const state = getState();
    const token = state.auth?.token;
    const branch = state.auth?.branch;

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const branchId = branch?._id || branch?.id || branch;
    if (branchId) {
      headers.set('x-branch-id', branchId.toString());
    }

    return headers;
  },
});

const baseQueryWithReauth = async (args, api, extraOptions) => {
  const result = await baseQuery(args, api, extraOptions);
  if (result.error && result.error.status === 401) {
    api.dispatch(logout());
  }
  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Auth',
    'Dashboard',
    'Billing',
    'Sales',
    'Purchase',
    'Inventory',
    'Customer',
    'Vendor',
    'Payment',
    'Exchange',
    'Order',
    'Expense',
    'Report',
    'GoldRate',
    'Branch',
    'Product',
    'Category',
    'User'
  ],
  endpoints: (builder) => ({
    // AUTH
    login: builder.mutation({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials
      }),
      invalidatesTags: ['Auth']
    }),
    getMe: builder.query({
      query: () => '/auth/me',
      providesTags: ['Auth']
    }),
    logoutUser: builder.mutation({
      query: () => ({
        url: '/auth/logout',
        method: 'POST'
      }),
      invalidatesTags: ['Auth']
    }),

    // DASHBOARD
    getDashboard: builder.query({
      query: (params) => ({
        url: '/dashboard',
        params
      }),
      providesTags: ['Dashboard']
    }),

    // BILLING (KACHA & PAKKA)
    getKachaBills: builder.query({
      query: (params) => ({
        url: '/billing/kacha',
        params
      }),
      providesTags: ['Billing']
    }),
    getKachaBillById: builder.query({
      query: (id) => `/billing/kacha/${id}`,
      providesTags: (result, error, id) => [{ type: 'Billing', id }]
    }),
    createKachaBill: builder.mutation({
      query: (body) => ({
        url: '/billing/kacha',
        method: 'POST',
        body
      }),
      invalidatesTags: ['Billing', 'Dashboard', 'Inventory', 'Customer', 'Payment']
    }),
    convertKachaToPakka: builder.mutation({
      query: (id) => ({
        url: `/billing/kacha/${id}/convert`,
        method: 'POST'
      }),
      invalidatesTags: ['Billing', 'Dashboard', 'Customer']
    }),
    getPakkaBills: builder.query({
      query: (params) => ({
        url: '/billing/pakka',
        params
      }),
      providesTags: ['Billing']
    }),
    getPakkaBillById: builder.query({
      query: (id) => `/billing/pakka/${id}`,
      providesTags: (result, error, id) => [{ type: 'Billing', id }]
    }),
    createPakkaBill: builder.mutation({
      query: (body) => ({
        url: '/billing/pakka',
        method: 'POST',
        body
      }),
      invalidatesTags: ['Billing', 'Dashboard', 'Inventory', 'Customer', 'Payment']
    }),
    cancelInvoice: builder.mutation({
      query: ({ id, reason }) => ({
        url: `/billing/pakka/${id}/cancel`,
        method: 'POST',
        body: { reason }
      }),
      invalidatesTags: ['Billing', 'Dashboard', 'Inventory', 'Customer']
    }),

    // SALES
    getSales: builder.query({
      query: (params) => ({
        url: '/sales',
        params
      }),
      providesTags: ['Sales']
    }),
    getSaleById: builder.query({
      query: (id) => `/sales/${id}`,
      providesTags: (result, error, id) => [{ type: 'Sales', id }]
    }),
    recordSalesReturn: builder.mutation({
      query: ({ id, items, refundAmount, reason }) => ({
        url: `/sales/${id}/return`,
        method: 'POST',
        body: { items, refundAmount, reason }
      }),
      invalidatesTags: ['Sales', 'Billing', 'Dashboard', 'Inventory', 'Customer']
    }),

    // PURCHASES
    getPurchases: builder.query({
      query: (params) => ({
        url: '/purchases',
        params
      }),
      providesTags: ['Purchase']
    }),
    getPurchaseById: builder.query({
      query: (id) => `/purchases/${id}`,
      providesTags: (result, error, id) => [{ type: 'Purchase', id }]
    }),
    createPurchase: builder.mutation({
      query: (body) => ({
        url: '/purchases',
        method: 'POST',
        body
      }),
      invalidatesTags: ['Purchase', 'Dashboard', 'Inventory', 'Vendor']
    }),
    recordPurchaseReturn: builder.mutation({
      query: ({ id, items, refundAmount, reason }) => ({
        url: `/purchases/${id}/return`,
        method: 'POST',
        body: { items, refundAmount, reason }
      }),
      invalidatesTags: ['Purchase', 'Dashboard', 'Inventory', 'Vendor']
    }),

    // INVENTORY & STOCK
    getInventory: builder.query({
      query: (params) => ({
        url: '/inventory',
        params
      }),
      providesTags: ['Inventory']
    }),
    getInventoryById: builder.query({
      query: (id) => `/inventory/${id}`,
      providesTags: (result, error, id) => [{ type: 'Inventory', id }]
    }),
    getStockMovements: builder.query({
      query: (params) => ({
        url: '/inventory/movements',
        params
      }),
      providesTags: ['Inventory']
    }),
    stockAdjustment: builder.mutation({
      query: (body) => ({
        url: '/inventory/adjustment',
        method: 'POST',
        body
      }),
      invalidatesTags: ['Inventory', 'Dashboard']
    }),
    stockTransfer: builder.mutation({
      query: (body) => ({
        url: '/inventory/transfer',
        method: 'POST',
        body
      }),
      invalidatesTags: ['Inventory', 'Dashboard']
    }),

    // CUSTOMERS
    getCustomers: builder.query({
      query: (params) => ({
        url: '/customers',
        params
      }),
      providesTags: ['Customer']
    }),
    getCustomerById: builder.query({
      query: (id) => `/customers/${id}`,
      providesTags: (result, error, id) => [{ type: 'Customer', id }]
    }),
    createCustomer: builder.mutation({
      query: (body) => ({
        url: '/customers',
        method: 'POST',
        body
      }),
      invalidatesTags: ['Customer']
    }),
    updateCustomer: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/customers/${id}`,
        method: 'PUT',
        body
      }),
      invalidatesTags: (result, error, { id }) => ['Customer', { type: 'Customer', id }]
    }),
    deleteCustomer: builder.mutation({
      query: (id) => ({
        url: `/customers/${id}`,
        method: 'DELETE'
      }),
      invalidatesTags: ['Customer']
    }),
    getCustomerLedger: builder.query({
      query: ({ id, ...params }) => ({
        url: `/customers/${id}/ledger`,
        params
      }),
      providesTags: (result, error, { id }) => [{ type: 'Customer', id: `${id}-ledger` }]
    }),
    getCustomerBills: builder.query({
      query: ({ id, ...params }) => ({
        url: `/customers/${id}/bills`,
        params
      }),
      providesTags: (result, error, { id }) => [{ type: 'Customer', id: `${id}-bills` }]
    }),
    getCustomerPayments: builder.query({
      query: ({ id, ...params }) => ({
        url: `/customers/${id}/payments`,
        params
      }),
      providesTags: (result, error, { id }) => [{ type: 'Customer', id: `${id}-payments` }]
    }),

    // VENDORS
    getVendors: builder.query({
      query: (params) => ({
        url: '/vendors',
        params
      }),
      providesTags: ['Vendor']
    }),
    getVendorById: builder.query({
      query: (id) => `/vendors/${id}`,
      providesTags: (result, error, id) => [{ type: 'Vendor', id }]
    }),
    createVendor: builder.mutation({
      query: (body) => ({
        url: '/vendors',
        method: 'POST',
        body
      }),
      invalidatesTags: ['Vendor']
    }),
    updateVendor: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/vendors/${id}`,
        method: 'PUT',
        body
      }),
      invalidatesTags: (result, error, { id }) => ['Vendor', { type: 'Vendor', id }]
    }),
    deleteVendor: builder.mutation({
      query: (id) => ({
        url: `/vendors/${id}`,
        method: 'DELETE'
      }),
      invalidatesTags: ['Vendor']
    }),
    getVendorLedger: builder.query({
      query: ({ id, ...params }) => ({
        url: `/vendors/${id}/ledger`,
        params
      }),
      providesTags: (result, error, { id }) => [{ type: 'Vendor', id: `${id}-ledger` }]
    }),
    getVendorPurchases: builder.query({
      query: ({ id, ...params }) => ({
        url: `/vendors/${id}/purchases`,
        params
      }),
      providesTags: (result, error, { id }) => [{ type: 'Vendor', id: `${id}-purchases` }]
    }),

    // PAYMENTS
    getPayments: builder.query({
      query: (params) => ({
        url: '/payments',
        params
      }),
      providesTags: ['Payment']
    }),
    getPaymentById: builder.query({
      query: (id) => `/payments/${id}`,
      providesTags: (result, error, id) => [{ type: 'Payment', id }]
    }),
    recordPayment: builder.mutation({
      query: (body) => ({
        url: '/payments',
        method: 'POST',
        body
      }),
      invalidatesTags: ['Payment', 'Billing', 'Sales', 'Customer', 'Vendor', 'Dashboard']
    }),
    reversePayment: builder.mutation({
      query: ({ id, reason }) => ({
        url: `/payments/${id}/reverse`,
        method: 'POST',
        body: { reason }
      }),
      invalidatesTags: ['Payment', 'Billing', 'Sales', 'Customer', 'Vendor', 'Dashboard']
    }),

    // EXCHANGE (OLD GOLD)
    getExchanges: builder.query({
      query: (params) => ({
        url: '/exchange',
        params
      }),
      providesTags: ['Exchange']
    }),
    getExchangeById: builder.query({
      query: (id) => `/exchange/${id}`,
      providesTags: (result, error, id) => [{ type: 'Exchange', id }]
    }),
    createExchange: builder.mutation({
      query: (body) => ({
        url: '/exchange',
        method: 'POST',
        body
      }),
      invalidatesTags: ['Exchange', 'Customer', 'Inventory', 'Dashboard']
    }),

    // EXPENSES
    getExpenses: builder.query({
      query: (params) => ({
        url: '/expenses',
        params
      }),
      providesTags: ['Expense']
    }),
    getExpenseById: builder.query({
      query: (id) => `/expenses/${id}`,
      providesTags: (result, error, id) => [{ type: 'Expense', id }]
    }),
    createExpense: builder.mutation({
      query: (body) => ({
        url: '/expenses',
        method: 'POST',
        body
      }),
      invalidatesTags: ['Expense', 'Dashboard']
    }),
    updateExpense: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/expenses/${id}`,
        method: 'PUT',
        body
      }),
      invalidatesTags: ['Expense', 'Dashboard']
    }),
    deleteExpense: builder.mutation({
      query: (id) => ({
        url: `/expenses/${id}`,
        method: 'DELETE'
      }),
      invalidatesTags: ['Expense', 'Dashboard']
    }),

    // ORDERS (CUSTOM MANUFACTURING)
    getOrders: builder.query({
      query: (params) => ({
        url: '/orders',
        params
      }),
      providesTags: ['Order']
    }),
    getOrderById: builder.query({
      query: (id) => `/orders/${id}`,
      providesTags: (result, error, id) => [{ type: 'Order', id }]
    }),
    createOrder: builder.mutation({
      query: (body) => ({
        url: '/orders',
        method: 'POST',
        body
      }),
      invalidatesTags: ['Order', 'Customer', 'Dashboard']
    }),
    updateOrderStatus: builder.mutation({
      query: ({ id, status, remarks }) => ({
        url: `/orders/${id}/status`,
        method: 'PUT',
        body: { status, remarks }
      }),
      invalidatesTags: ['Order', 'Dashboard']
    }),
    assignKarigar: builder.mutation({
      query: ({ id, karigarName, karigarPhone, makingCharges }) => ({
        url: `/orders/${id}/karigar`,
        method: 'PUT',
        body: { karigarName, karigarPhone, makingCharges }
      }),
      invalidatesTags: ['Order']
    }),

    // GOLD RATES
    getCurrentGoldRates: builder.query({
      query: () => '/gold-rates/current',
      providesTags: ['GoldRate']
    }),
    getGoldRateHistory: builder.query({
      query: (params) => ({
        url: '/gold-rates',
        params
      }),
      providesTags: ['GoldRate']
    }),
    setGoldRate: builder.mutation({
      query: (body) => ({
        url: '/gold-rates',
        method: 'POST',
        body
      }),
      invalidatesTags: ['GoldRate']
    }),

    // REPORTS
    getSalesReport: builder.query({
      query: (params) => ({
        url: '/reports/sales',
        params
      }),
      providesTags: ['Report']
    }),
    getStockReport: builder.query({
      query: (params) => ({
        url: '/reports/stock',
        params
      }),
      providesTags: ['Report']
    }),
    getCustomerOutstandingReport: builder.query({
      query: (params) => ({
        url: '/reports/customer-outstanding',
        params
      }),
      providesTags: ['Report']
    }),
    getVendorOutstandingReport: builder.query({
      query: (params) => ({
        url: '/reports/vendor-outstanding',
        params
      }),
      providesTags: ['Report']
    }),

    // BRANCHES, PRODUCTS, CATEGORIES, USERS
    getBranches: builder.query({
      query: () => '/branches',
      providesTags: ['Branch']
    }),
    getProducts: builder.query({
      query: (params) => ({
        url: '/products',
        params
      }),
      providesTags: ['Product']
    }),
    getCategories: builder.query({
      query: () => '/categories',
      providesTags: ['Category']
    }),
    getUsers: builder.query({
      query: () => '/users',
      providesTags: ['User']
    })
  })
});

export const {
  // Auth
  useLoginMutation,
  useGetMeQuery,
  useLogoutUserMutation,

  // Dashboard
  useGetDashboardQuery,

  // Billing
  useGetKachaBillsQuery,
  useGetKachaBillByIdQuery,
  useCreateKachaBillMutation,
  useConvertKachaToPakkaMutation,
  useGetPakkaBillsQuery,
  useGetPakkaBillByIdQuery,
  useCreatePakkaBillMutation,
  useCancelInvoiceMutation,

  // Sales
  useGetSalesQuery,
  useGetSaleByIdQuery,
  useRecordSalesReturnMutation,

  // Purchases
  useGetPurchasesQuery,
  useGetPurchaseByIdQuery,
  useCreatePurchaseMutation,
  useRecordPurchaseReturnMutation,

  // Inventory
  useGetInventoryQuery,
  useGetInventoryByIdQuery,
  useGetStockMovementsQuery,
  useStockAdjustmentMutation,
  useStockTransferMutation,

  // Customers
  useGetCustomersQuery,
  useGetCustomerByIdQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
  useGetCustomerLedgerQuery,
  useGetCustomerBillsQuery,
  useGetCustomerPaymentsQuery,

  // Vendors
  useGetVendorsQuery,
  useGetVendorByIdQuery,
  useCreateVendorMutation,
  useUpdateVendorMutation,
  useDeleteVendorMutation,
  useGetVendorLedgerQuery,
  useGetVendorPurchasesQuery,

  // Payments
  useGetPaymentsQuery,
  useGetPaymentByIdQuery,
  useRecordPaymentMutation,
  useReversePaymentMutation,

  // Exchange
  useGetExchangesQuery,
  useGetExchangeByIdQuery,
  useCreateExchangeMutation,

  // Expenses
  useGetExpensesQuery,
  useGetExpenseByIdQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,

  // Orders
  useGetOrdersQuery,
  useGetOrderByIdQuery,
  useCreateOrderMutation,
  useUpdateOrderStatusMutation,
  useAssignKarigarMutation,

  // Gold Rates
  useGetCurrentGoldRatesQuery,
  useGetGoldRateHistoryQuery,
  useSetGoldRateMutation,

  // Reports
  useGetSalesReportQuery,
  useGetStockReportQuery,
  useGetCustomerOutstandingReportQuery,
  useGetVendorOutstandingReportQuery,

  // Metadata
  useGetBranchesQuery,
  useGetProductsQuery,
  useGetCategoriesQuery,
  useGetUsersQuery
} = baseApi;
