const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/category.controller');
const authenticate = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { ROLES } = require('../config/constants');

router.use(authenticate);

router.post('/', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.INVENTORY_MANAGER), CategoryController.createCategory);
router.get('/', CategoryController.getCategories);
router.get('/:id', CategoryController.getCategoryById);
router.put('/:id', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.INVENTORY_MANAGER), CategoryController.updateCategory);
router.delete('/:id', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN), CategoryController.deleteCategory);

module.exports = router;
