export const METALS = ['GOLD', 'SILVER', 'PLATINUM', 'DIAMOND', 'OTHER'];
export const PURITIES = ['24K', '22K', '20K', '18K', '14K', '9K', '999', '925', '950'];
export const MAKING_TYPES = [
  { value: 'PER_GRAM', label: '₹ / gram' },
  { value: 'PERCENTAGE', label: '% of metal' },
  { value: 'FIXED', label: 'Fixed ₹' }
];

// Modes a normal receipt / payment can use. (EXCHANGE = old gold, only through the Exchange module)
export const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI / QR' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer (NEFT/RTGS)' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'OTHER', label: 'Other' }
];

export const roleOf = (user) => user?.roleId?.name || user?.role || 'GUEST';

// Which backend roles may see which part of the app (mirrors the route guards in the API)
const ALL = null; // everyone logged in
const ADMINS = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER'];
export const ACCESS = {
  dashboard: ALL,
  billing: ALL,
  sales: ALL,
  purchases: [...ADMINS, 'PURCHASE_MANAGER', 'ACCOUNTANT', 'INVENTORY_MANAGER'],
  inventory: ALL,
  customers: ALL,
  vendors: [...ADMINS, 'PURCHASE_MANAGER', 'ACCOUNTANT'],
  payments: [...ADMINS, 'ACCOUNTANT', 'CASHIER', 'SALES_MANAGER'],
  exchange: ALL,
  orders: ALL,
  expenses: [...ADMINS, 'ACCOUNTANT'],
  reports: [...ADMINS, 'ACCOUNTANT', 'PURCHASE_MANAGER', 'INVENTORY_MANAGER'],
  goldRates: ALL,
  settings: ALL
};
export const canAccess = (role, key) => {
  const allowed = ACCESS[key];
  if (!allowed) return true;
  return role === 'SUPER_ADMIN' || allowed.includes(role);
};
export const CAN_CANCEL = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER'];
export const CAN_CONVERT = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'SALES_MANAGER'];
export const CAN_BUY = ['SUPER_ADMIN', 'ADMIN', 'PURCHASE_MANAGER'];
export const CAN_APPROVE_PO = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER'];

// Badge variants
export const invoiceStatusVariant = (status) =>
  ({ DRAFT: 'default', CONFIRMED: 'info', CONVERTED: 'purple', CANCELLED: 'danger' }[status] || 'default');
export const paymentStatusVariant = (status) =>
  ({ PAID: 'success', PARTIAL: 'warning', PENDING: 'danger' }[status] || 'default');
export const poStatusVariant = (status) =>
  ({
    DRAFT: 'default', SUBMITTED: 'info', APPROVED: 'success', ORDERED: 'gold',
    PARTIALLY_RECEIVED: 'warning', RECEIVED: 'success', CLOSED: 'purple', REJECTED: 'danger', CANCELLED: 'danger'
  }[status] || 'default');
