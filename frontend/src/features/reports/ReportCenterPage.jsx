import React, { useState } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  Download,
  Calendar,
  DollarSign
} from 'lucide-react';
import {
  useGetSalesReportQuery,
  useGetStockReportQuery,
  useGetCustomerOutstandingReportQuery,
  useGetVendorOutstandingReportQuery
} from '../../app/api/baseApi';
import { Table, TableRow, TableCell } from '../../components/ui/Table';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tabs } from '../../components/ui/Tabs';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency, formatWeight, formatDate } from '../../utils/formatters';
import { toast } from 'sonner';

export const ReportCenterPage = () => {
  const [reportType, setReportType] = useState('SALES');
  const [billTypeFilter, setBillTypeFilter] = useState('');

  // Queries
  const { data: salesData, isLoading: salesLoading } = useGetSalesReportQuery(
    { billType: billTypeFilter || undefined },
    { skip: reportType !== 'SALES' }
  );
  const { data: stockData, isLoading: stockLoading } = useGetStockReportQuery(
    {},
    { skip: reportType !== 'STOCK' }
  );
  const { data: custData, isLoading: custLoading } = useGetCustomerOutstandingReportQuery(
    {},
    { skip: reportType !== 'CUSTOMER_DUE' }
  );
  const { data: vendorData, isLoading: vendorLoading } = useGetVendorOutstandingReportQuery(
    {},
    { skip: reportType !== 'VENDOR_DUE' }
  );

  const handleExportExcel = () => {
    const token = localStorage.getItem('token');
    const typeParam = reportType === 'SALES' ? 'sales' : 'stock';
    const url = `/api/reports/export/excel?reportType=${typeParam}`;

    // Trigger download via window
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${typeParam}_report_${Date.now()}.xlsx`);
    document.body.appendChild(link);
    // Since fetch with auth header is better for JWT protected endpoints:
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Excel export failed');
        return res.blob();
      })
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `Jewellery_ERP_${reportType}_Report.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success('Excel report downloaded successfully!');
      })
      .catch((err) => {
        toast.error('Failed to export Excel report. Please ensure permissions.');
      });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 font-display">Financial & Stock Reports</h1>
          <p className="text-xs text-surface-500 mt-1">
            Official sales audit, stock valuation, customer receivables, and supplier payables
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={Printer} onClick={handlePrint}>
            Print Report
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={FileSpreadsheet}
            onClick={handleExportExcel}
            className="font-bold shadow-sm"
          >
            Export to Excel (.xlsx)
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-surface-200 p-4 shadow-xs space-y-4">
        <div className="no-print">
          <Tabs
            tabs={[
              { id: 'SALES', label: 'Sales & Revenue Summary', icon: BarChart3 },
              { id: 'STOCK', label: 'Inventory & Vault Valuation', icon: DollarSign },
              { id: 'CUSTOMER_DUE', label: 'Customer Receivables Due' },
              { id: 'VENDOR_DUE', label: 'Vendor Payables' }
            ]}
            activeTab={reportType}
            onChange={setReportType}
          />
        </div>

        {/* Report 1: Sales Report */}
        {reportType === 'SALES' && (
          <div className="space-y-4">
            <div className="no-print flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-surface-600">Filter Bill Type:</span>
                <select
                  value={billTypeFilter}
                  onChange={(e) => setBillTypeFilter(e.target.value)}
                  className="rounded-lg border border-surface-300 p-1.5 font-bold"
                >
                  <option value="">All (Kacha + Pakka)</option>
                  <option value="PAKKA">Pakka GST Invoices Only</option>
                  <option value="KACHA">Kacha Estimates Only</option>
                </select>
              </div>

              {salesData?.data?.summary && (
                <div className="flex gap-4 text-xs font-bold">
                  <span>Total Sales: {formatCurrency(salesData.data.summary.totalSales)}</span>
                  <span className="text-emerald-700">Paid: {formatCurrency(salesData.data.summary.totalPaid)}</span>
                  <span className="text-amber-600">Due: {formatCurrency(salesData.data.summary.totalDue)}</span>
                </div>
              )}
            </div>

            {salesLoading ? (
              <TableSkeleton rows={6} cols={8} />
            ) : (
              <Table
                headers={[
                  'Invoice No',
                  'Type',
                  'Customer',
                  'Date',
                  { label: 'Taxable Amount', align: 'right' },
                  { label: 'Tax (GST)', align: 'right' },
                  { label: 'Grand Total', align: 'right' },
                  { label: 'Balance Due', align: 'right' }
                ]}
              >
                {salesData?.data?.data?.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono font-bold text-surface-900">{row.invoiceNo}</TableCell>
                    <TableCell>
                      <Badge variant={row.billType === 'KACHA' ? 'kacha' : 'pakka'} size="sm">
                        {row.billType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">{row.customerName || 'Walk-in'}</TableCell>
                    <TableCell className="text-surface-500">{formatDate(row.invoiceDate)}</TableCell>
                    <TableCell align="right">{formatCurrency(row.taxableAmount)}</TableCell>
                    <TableCell align="right">{formatCurrency(row.taxAmount)}</TableCell>
                    <TableCell align="right" className="font-bold text-surface-900">
                      {formatCurrency(row.grandTotal)}
                    </TableCell>
                    <TableCell
                      align="right"
                      className={`font-semibold ${row.due > 0 ? 'text-amber-600 font-bold' : 'text-surface-400'}`}
                    >
                      {formatCurrency(row.due)}
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            )}
          </div>
        )}

        {/* Report 2: Stock Report */}
        {reportType === 'STOCK' && (
          <div className="space-y-4">
            {stockData?.data?.summary && (
              <div className="p-3 bg-gold-50/60 rounded-xl border border-gold-200 flex justify-between text-xs font-bold text-surface-900">
                <span>Total Vault Pieces: {stockData.data.summary.totalPieces}</span>
                <span>Total Net Weight: {formatWeight(stockData.data.summary.totalNetWeight)}</span>
                <span>Total Valuation Cost: {formatCurrency(stockData.data.summary.totalValuation)}</span>
              </div>
            )}

            {stockLoading ? (
              <TableSkeleton rows={6} cols={8} />
            ) : (
              <Table
                headers={[
                  'Barcode',
                  'Product Name',
                  'Metal',
                  'Purity',
                  { label: 'Gross Wt', align: 'right' },
                  { label: 'Net Wt', align: 'right' },
                  { label: 'Qty', align: 'center' },
                  { label: 'Cost Valuation', align: 'right' }
                ]}
              >
                {stockData?.data?.data?.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono font-bold text-surface-900">{row.barcode}</TableCell>
                    <TableCell className="font-semibold">{row.productName}</TableCell>
                    <TableCell>{row.metal}</TableCell>
                    <TableCell className="font-bold text-gold-800">{row.purity}</TableCell>
                    <TableCell align="right">{formatWeight(row.grossWeight)}</TableCell>
                    <TableCell align="right" className="font-bold">{formatWeight(row.netWeight)}</TableCell>
                    <TableCell align="center">{row.quantity}</TableCell>
                    <TableCell align="right" className="font-extrabold text-surface-900">
                      {formatCurrency((row.costPrice || 0) * (row.quantity || 1))}
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            )}
          </div>
        )}

        {/* Report 3: Customer Outstanding */}
        {reportType === 'CUSTOMER_DUE' && (
          <div className="space-y-4">
            {custData?.data?.summary && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex justify-between text-xs font-bold text-amber-900">
                <span>Customers with Due Balance: {custData.data.summary.customerCount}</span>
                <span>Total Outstanding Credit: {formatCurrency(custData.data.summary.totalOutstanding)}</span>
              </div>
            )}

            {custLoading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : (
              <Table
                headers={[
                  'Customer Name',
                  'Mobile Contact',
                  'Location',
                  { label: 'Outstanding Balance Due', align: 'right' }
                ]}
              >
                {custData?.data?.data?.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-bold text-surface-900">{c.name}</TableCell>
                    <TableCell className="text-surface-700">📞 {c.mobile}</TableCell>
                    <TableCell className="text-surface-500">{c.city || '-'}, {c.state || '-'}</TableCell>
                    <TableCell align="right" className="font-black text-amber-600 font-display text-sm">
                      {formatCurrency(c.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            )}
          </div>
        )}

        {/* Report 4: Vendor Outstanding */}
        {reportType === 'VENDOR_DUE' && (
          <div className="space-y-4">
            {vendorData?.data?.summary && (
              <div className="p-3 bg-surface-100 rounded-xl border border-surface-200 flex justify-between text-xs font-bold text-surface-900">
                <span>Vendors with Payable Balances: {vendorData.data.summary.vendorCount}</span>
                <span>Total Payables Due: {formatCurrency(vendorData.data.summary.totalPayable)}</span>
              </div>
            )}

            {vendorLoading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : (
              <Table
                headers={[
                  'Firm / Company',
                  'Contact Person',
                  'Mobile',
                  { label: 'Payable Amount', align: 'right' }
                ]}
              >
                {vendorData?.data?.data?.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-bold text-surface-900">{v.company || v.name}</TableCell>
                    <TableCell className="text-surface-700">{v.name}</TableCell>
                    <TableCell className="text-surface-500">📞 {v.mobile || '-'}</TableCell>
                    <TableCell align="right" className="font-black text-rose-600 font-display text-sm">
                      {formatCurrency(v.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
