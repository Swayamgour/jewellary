const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboard.controller');
const authenticate = require('../middleware/auth.middleware');
const resolveBranch = require('../middleware/branch.middleware');

router.use(authenticate, resolveBranch);

router.get('/', DashboardController.getDashboard);

module.exports = router;
