const express = require('express');
const router = express.Router();
const BranchController = require('../controllers/branch.controller');
const authenticate = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { ROLES } = require('../config/constants');

router.use(authenticate);

router.post('/', authorizeRoles(ROLES.SUPER_ADMIN), BranchController.createBranch);
router.get('/', BranchController.getBranches);
router.get('/:id', BranchController.getBranchById);
router.put('/:id', authorizeRoles(ROLES.SUPER_ADMIN), BranchController.updateBranch);
router.delete('/:id', authorizeRoles(ROLES.SUPER_ADMIN), BranchController.deleteBranch);

module.exports = router;
