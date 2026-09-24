const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const branchRoutes = require('./branch.routes');
const customerRoutes = require('./customer.routes');
const vendorRoutes = require('./vendor.routes');
const categoryRoutes = require('./category.routes');
const productRoutes = require('./product.routes');
const goldRateRoutes = require('./goldRate.routes');
const inventoryRoutes = require('./inventory.routes');
const billingRoutes = require('./billing.routes');
const salesRoutes = require('./sales.routes');
const purchaseRoutes = require('./purchase.routes');
const paymentRoutes = require('./payment.routes');
const exchangeRoutes = require('./exchange.routes');
const expenseRoutes = require('./expense.routes');
const orderRoutes = require('./order.routes');
const dashboardRoutes = require('./dashboard.routes');
const reportRoutes = require('./report.routes');

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'Jewellery ERP Backend'
  });
});

// Mount module routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/branches', branchRoutes);
router.use('/customers', customerRoutes);
router.use('/vendors', vendorRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/gold-rates', goldRateRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/billing', billingRoutes);
router.use('/sales', salesRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/payments', paymentRoutes);
router.use('/exchange', exchangeRoutes);
router.use('/expenses', expenseRoutes);
router.use('/orders', orderRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);

module.exports = router;
