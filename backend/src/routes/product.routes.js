const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/product.controller');
const authenticate = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { productSchema } = require('../validators/product.validator');
const { ROLES } = require('../config/constants');

router.use(authenticate);

router.post(
  '/',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.INVENTORY_MANAGER),
  validate(productSchema),
  ProductController.createProduct
);
router.get('/', ProductController.getProducts);
router.get('/:id', ProductController.getProductById);
router.put(
  '/:id',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.INVENTORY_MANAGER),
  ProductController.updateProduct
);
router.delete(
  '/:id',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  ProductController.deleteProduct
);

module.exports = router;
