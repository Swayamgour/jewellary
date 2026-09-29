const express = require('express');
const router = express.Router();
const C = require('../controllers/purchaseOrder.controller');
const authenticate = require('../middleware/auth.middleware');
const resolveBranch = require('../middleware/branch.middleware');
const validate = require('../middleware/validate.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const V = require('../validators/purchase.validator');
const { ROLES } = require('../config/constants');

router.use(authenticate, resolveBranch);

const buyers = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PURCHASE_MANAGER];
const approvers = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER];

router.get('/', C.list);
router.get('/:id', C.getById);
router.post('/', authorizeRoles(...buyers), validate(V.purchaseOrderSchema), C.create);
router.put('/:id', authorizeRoles(...buyers), validate(V.purchaseOrderUpdateSchema), C.update);
router.post('/:id/submit', authorizeRoles(...buyers), C.submit);
router.post('/:id/approve', authorizeRoles(...approvers), validate(V.poNoteSchema), C.approve);
router.post('/:id/reject', authorizeRoles(...approvers), validate(V.poReasonSchema), C.reject);
router.post('/:id/order', authorizeRoles(...buyers), validate(V.poNoteSchema), C.order);
router.post('/:id/receive', authorizeRoles(...buyers), validate(V.poReceiveSchema), C.receive);
router.post('/:id/close', authorizeRoles(...buyers, ROLES.BRANCH_MANAGER), validate(V.poCloseSchema), C.close);
router.post('/:id/cancel', authorizeRoles(...buyers, ROLES.BRANCH_MANAGER), validate(V.poReasonSchema), C.cancel);

module.exports = router;
