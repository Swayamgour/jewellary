const express = require('express');
const router = express.Router();
const UserController = require('../controllers/user.controller');
const authenticate = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const validate = require('../middleware/validate.middleware');
const { registerUserSchema } = require('../validators/auth.validator');
const { ROLES } = require('../config/constants');

router.use(authenticate);

router.post(
  '/',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  validate(registerUserSchema),
  UserController.createUser
);

router.get(
  '/',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER),
  UserController.getUsers
);

router.get('/:id', UserController.getUserById);

router.put(
  '/:id',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  UserController.updateUser
);

router.delete(
  '/:id',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  UserController.deleteUser
);

module.exports = router;
