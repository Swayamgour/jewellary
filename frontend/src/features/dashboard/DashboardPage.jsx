import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  ShoppingCart,
  Truck,
  Users,
  Briefcase,
  Receipt,
  FileCheck,
  CreditCard,
  ArrowDownCircle,
  AlertTriangle,
  Package,
  Clock,
  Sparkles,
  ArrowRight,
  Filter
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { useGetDashboardQuery } from '../../app/api/baseApi';
import { StatCard } from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatCurrency, formatWeight } from '../../utils/formatters';

const CHART_COLORS = ['#C5A059', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export const DashboardPage = () => {
  const [filter, setFilter] = useState('month');
  const navigate = useNavigate();
  const { data: response, isLoading, refetch } = useGetDashboardQuery({ filter });

  const dashboard = response?.data;

  // Chart data preparation
  const salesPurchasesData = [
    { name: 'Sales (Taxable)', amount: dashboard?.sales?.taxableAmount || 0 },
    { name: 'Kacha Sales', amount: dashboard?.sales?.kachaSales || 0 },
    { name: 'Pakka Sales', amount: dashboard?.sales?.pakkaSales || 0 },
    { name: 'Purchases', amount: dashboard?.purchases?.totalPurchase || 0 },
    { name: 'Collections', amount: dashboard?.collections?.TOTAL || 0 },
  ];

  const paymentDistributionData = [
    { name: 'Cash', value: dashboard?.collections?.CASH || 0 },
    { name: 'UPI', value: dashboard?.collections?.UPI || 0 },
    { name: 'Card', value: dashboard?.collections?.CARD || 0 },
    { name: 'Bank Transfer', value: dashboard?.collections?.BANK_TRANSFER || 0 },
    { name: 'Exchange', value: dashboard?.collections?.EXCHANGE || 0 }
  ].filter((p) => p.value > 0);

  const stockSummary = dashboard?.inventory || {};
  const stockItemsData = [
    { name: 'Gold', value: stockSummary.GOLD?.netWeight || 0, unit: 'g' },
    { name: 'Silver', value: stockSummary.SILVER?.netWeight || 0, unit: 'g' },
    { name: 'Diamond', value: stockSummary.DIAMOND?.netWeight || 0, unit: 'g' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-surface-900 font-display">Executive Dashboard</h1>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-gold-100 text-gold-900 px-2 py-0.5 rounded-full border border-gold-300">
              Live Bullion Analytics
            </span>
          </div>
          <p className="text-xs text-surface-500 mt-1">
            Real-time business performance, billing totals, collections, and stock valuation
          </p>
        </div>

        {/* Filter Controls & POS Quick Action */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-white border border-surface-300 rounded-xl p-1 shadow-xs text-xs">
            <Filter className="w-3.5 h-3.5 text-surface-400 ml-2 mr-1" />
            {['today', 'week', 'month', 'year'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-lg font-semibold uppercase text-[11px] transition-all ${
                  filter === f
                    ? 'bg-gold-500 text-white shadow-xs'
                    : 'text-surface-600 hover:text-surface-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <Button
            variant="primary"
            size="md"
            icon={Receipt}
            onClick={() => navigate('/billing/new')}
            className="font-bold shadow-sm"
          >
            New Bill (F2)
          </Button>
        </div>
      </div>

      {/* Row 1: Primary ERP Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
        ) : (
          <>
            <StatCard
              title="Total Sales"
              value={formatCurrency(dashboard?.sales?.totalSales)}
              subtitle={`${dashboard?.sales?.invoiceCount || 0} Bills Generated`}
              icon={TrendingUp}
              variant="gold"
              trend="+12.5%"
              trendType="up"
            />
            <StatCard
              title="Total Purchases"
              value={formatCurrency(dashboard?.purchases?.totalPurchase)}
              subtitle={`${dashboard?.purchases?.purchaseCount || 0} Purchase Orders`}
              icon={Truck}
              variant="default"
              trend="+8.4%"
              trendType="up"
            />
            <StatCard
              title="Customer Receivable"
              value={formatCurrency(dashboard?.outstanding?.customerReceivable)}
              subtitle="Outstanding Customer Credit"
              icon={Users}
              variant="rose"
            />
            <StatCard
              title="Vendor Payable"
              value={formatCurrency(dashboard?.outstanding?.vendorPayable)}
              subtitle="Supplier Due Balance"
              icon={Briefcase}
              variant="amber"
            />
          </>
        )}
      </div>

      {/* Row 2: Secondary Retail & Counter Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
        ) : (
          <>
            <StatCard
              title="Kacha Sales"
              value={formatCurrency(dashboard?.sales?.kachaSales)}
              subtitle="Trade Estimation Volume"
              icon={Receipt}
              variant="amber"
            />
            <StatCard
              title="Pakka Sales (GST)"
              value={formatCurrency(dashboard?.sales?.pakkaSales)}
              subtitle={`Tax Collected: ${formatCurrency(dashboard?.sales?.taxCollected)}`}
              icon={FileCheck}
              variant="emerald"
            />
            <StatCard
              title="Total Collections"
              value={formatCurrency(dashboard?.collections?.TOTAL)}
              subtitle="Cash, UPI & Bank Intake"
              icon={CreditCard}
              variant="gold"
            />
            <StatCard
              title="Operating Expenses"
              value={formatCurrency(dashboard?.financials?.totalExpenses)}
              subtitle={`Net Profit: ${formatCurrency(dashboard?.financials?.estimatedNetProfit)}`}
              icon={ArrowDownCircle}
              variant="default"
            />
          </>
        )}
      </div>

      {/* Row 3: Actionable Attention Required Alerts */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-gold-500/10 to-amber-500/5 border border-amber-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-surface-900 font-display">Attention Required</h3>
          </div>
          <span className="text-xs text-surface-500">Immediate Store Action Items</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div
            onClick={() => navigate('/reports/customer-outstanding')}
            className="flex items-center justify-between p-3 rounded-xl bg-white border border-surface-200/80 hover:border-gold-300 hover:shadow-xs cursor-pointer transition-all"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <div>
                <p className="font-bold text-surface-900">Customer Overdue</p>
                <p className="text-[11px] text-surface-500">{formatCurrency(dashboard?.outstanding?.customerReceivable)} due</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-surface-400" />
          </div>

          <div
            onClick={() => navigate('/inventory')}
            className="flex items-center justify-between p-3 rounded-xl bg-white border border-surface-200/80 hover:border-gold-300 hover:shadow-xs cursor-pointer transition-all"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <div>
                <p className="font-bold text-surface-900">Physical Stock Count</p>
                <p className="text-[11px] text-surface-500">
                  {formatWeight(stockSummary.GOLD?.netWeight || 0)} Gold on hand
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-surface-400" />
          </div>

          <div
            onClick={() => navigate('/orders')}
            className="flex items-center justify-between p-3 rounded-xl bg-white border border-surface-200/80 hover:border-gold-300 hover:shadow-xs cursor-pointer transition-all"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              <div>
                <p className="font-bold text-surface-900">Manufacturing Orders</p>
                <p className="text-[11px] text-surface-500">{dashboard?.pendingOrdersCount || 0} active custom jobs</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-surface-400" />
          </div>

          <div
            onClick={() => navigate('/exchange')}
            className="flex items-center justify-between p-3 rounded-xl bg-white border border-surface-200/80 hover:border-gold-300 hover:shadow-xs cursor-pointer transition-all"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <div>
                <p className="font-bold text-surface-900">Old Gold Intake</p>
                <p className="text-[11px] text-surface-500">Melting loss calculator</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-surface-400" />
          </div>
        </div>
      </div>

      {/* Row 4: Charts (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales vs Purchases Bar Chart */}
        <Card title="Sales, Purchases & Intake Comparison" subtitle="Financial distribution for current period">
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesPurchasesData}>
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} />
                <YAxis stroke="#9CA3AF" fontSize={11} tickFormatter={(val) => `₹${val / 1000}k`} />
                <Tooltip
                  formatter={(val) => [formatCurrency(val), 'Amount']}
                  contentStyle={{ backgroundColor: '#1F2937', color: '#fff', borderRadius: '8px', border: 'none' }}
                />
                <Bar dataKey="amount" fill="#C5A059" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Payment Collections Breakdown (Donut Chart) */}
        <Card title="Collections by Payment Channel" subtitle="Counter settlement distribution">
          <div className="h-72 w-full pt-4 flex items-center justify-center">
            {paymentDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {paymentDistributionData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => [formatCurrency(val), 'Collected']}
                    contentStyle={{ backgroundColor: '#1F2937', color: '#fff', borderRadius: '8px', border: 'none' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-xs text-surface-400">
                No collections recorded yet for this period.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Row 5: Recent Bills & Metal Inventory Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Metal Stock Vault Summary */}
        <Card title="Physical Bullion Vault" subtitle="Available metal weights in inventory" className="lg:col-span-1">
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl border border-gold-200/80 bg-gold-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gold-500 text-white font-bold text-xs">Au</div>
                <div>
                  <h5 className="font-bold text-surface-900 text-sm">Fine Gold Stock</h5>
                  <p className="text-[11px] text-surface-500">{stockSummary.GOLD?.qty || 0} Items</p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-extrabold text-surface-900 text-base font-display">
                  {formatWeight(stockSummary.GOLD?.netWeight || 0)}
                </span>
                <p className="text-[10px] text-surface-500">Val: {formatCurrency(stockSummary.GOLD?.costValue || 0)}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-surface-200 bg-surface-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-surface-400 text-white font-bold text-xs">Ag</div>
                <div>
                  <h5 className="font-bold text-surface-900 text-sm">Silver Articles</h5>
                  <p className="text-[11px] text-surface-500">{stockSummary.SILVER?.qty || 0} Items</p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-extrabold text-surface-900 text-base font-display">
                  {formatWeight(stockSummary.SILVER?.netWeight || 0)}
                </span>
                <p className="text-[10px] text-surface-500">Val: {formatCurrency(stockSummary.SILVER?.costValue || 0)}</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={Package}
              onClick={() => navigate('/inventory')}
              className="w-full text-xs font-semibold"
            >
              Full Inventory Management
            </Button>
          </div>
        </Card>

        {/* Recent Invoices Table */}
        <Card
          title="Recent Store Invoices"
          subtitle="Latest Kacha & Pakka bills processed"
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate('/billing')}>
              View All Bills
            </Button>
          }
          className="lg:col-span-2"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-50 text-surface-500 font-semibold border-b border-surface-100">
                <tr>
                  <th className="py-2.5 px-3">Invoice No</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {dashboard?.recentInvoices && dashboard.recentInvoices.length > 0 ? (
                  dashboard.recentInvoices.map((inv) => (
                    <tr key={inv._id} className="hover:bg-surface-50/60">
                      <td className="py-2.5 px-3 font-bold text-surface-900 font-mono">{inv.invoiceNo}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            inv.billType === 'KACHA'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {inv.billType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-surface-700 font-medium">
                        {inv.customerSnapshot?.name || 'Walk-in'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-surface-900">
                        {formatCurrency(inv.grandTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-surface-100 text-surface-700 font-semibold text-[10px]">
                          {inv.paymentStatus || inv.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/billing/${inv._id}`)}
                          className="font-bold text-gold-700 hover:text-gold-900 text-[11px]"
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-surface-400">
                      No invoices created yet. Start with "New Bill".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};
