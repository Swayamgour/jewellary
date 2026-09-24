const express = require('express');
const router = express.Router();
const ExpenseController = require('../controllers/expense.controller');
const authenticate = require('../middleware/auth.middleware');
const resolveBranch = require('../middleware/branch.middleware');
const validate = require('../middleware/validate.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { expenseSchema } = require('../validators/inventory.validator');
const { ROLES } = require('../config/constants');

router.use(authenticate, resolveBranch);

router.post('/', validate(expenseSchema), ExpenseController.createExpense);
router.get('/', ExpenseController.getExpenses);
router.get('/:id', ExpenseController.getExpenseById);
router.put('/:id', ExpenseController.updateExpense);
router.delete('/:id', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN), ExpenseController.deleteExpense);

module.exports = router;
