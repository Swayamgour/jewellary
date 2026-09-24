const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/order.controller');
const authenticate = require('../middleware/auth.middleware');
const resolveBranch = require('../middleware/branch.middleware');
const validate = require('../middleware/validate.middleware');
const { orderSchema } = require('../validators/inventory.validator');

router.use(authenticate, resolveBranch);

router.post('/', validate(orderSchema), OrderController.createOrder);
router.get('/', OrderController.getOrders);
router.get('/:id', OrderController.getOrderById);
router.put('/:id/status', OrderController.updateOrderStatus);
router.put('/:id/karigar', OrderController.assignKarigar);

module.exports = router;
