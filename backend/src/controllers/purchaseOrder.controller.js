const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseOrderService = require('../services/purchaseOrder.service');
const ApiResponse = require('../utils/apiResponse');
const { guardBranch } = require('../utils/branchScope');
const { assertBranchAccess } = require('../utils/branchScope');

const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    next(e);
  }
};
const guard = (req) => guardBranch(req, PurchaseOrder, req.params.id, 'Purchase order');

module.exports = {
  create: wrap(async (req, res) => {
    const branchId = req.branchId || req.body.branchId || req.user.branchId;
    const po = await PurchaseOrderService.create({ ...req.body, branchId, userId: req.user._id });
    ApiResponse.created(res, 'Purchase order created', po);
  }),

  list: wrap(async (req, res) => {
    const page = parseInt(req.query.page || 1, 10);
    const limit = parseInt(req.query.limit || 20, 10);
    const query = {};
    if (req.branchId) query.branchId = req.branchId;
    if (req.query.status) query.status = req.query.status;
    if (req.query.vendorId) query.vendorId = req.query.vendorId;
    const [rows, total] = await Promise.all([
      PurchaseOrder.find(query).populate('vendorId', 'name company').sort({ poDate: -1 }).skip((page - 1) * limit).limit(limit),
      PurchaseOrder.countDocuments(query)
    ]);
    ApiResponse.success(res, 'Purchase orders fetched', rows, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
  }),

  getById: wrap(async (req, res) => {
    const data = await PurchaseOrderService.getWithProgress(req.params.id);
    assertBranchAccess(req, { branchId: data.branchId?._id || data.branchId });
    ApiResponse.success(res, 'Purchase order details', data);
  }),

  update: wrap(async (req, res) => {
    await guard(req);
    ApiResponse.success(res, 'Purchase order updated', await PurchaseOrderService.update({ id: req.params.id, ...req.body, userId: req.user._id }));
  }),
  submit: wrap(async (req, res) => {
    await guard(req);
    ApiResponse.success(res, 'Purchase order submitted for approval', await PurchaseOrderService.submit({ id: req.params.id, userId: req.user._id }));
  }),
  approve: wrap(async (req, res) => {
    await guard(req);
    ApiResponse.success(res, 'Purchase order approved', await PurchaseOrderService.approve({ id: req.params.id, note: req.body.note, userId: req.user._id }));
  }),
  reject: wrap(async (req, res) => {
    await guard(req);
    ApiResponse.success(res, 'Purchase order rejected', await PurchaseOrderService.reject({ id: req.params.id, reason: req.body.reason, userId: req.user._id }));
  }),
  order: wrap(async (req, res) => {
    await guard(req);
    ApiResponse.success(res, 'Purchase order marked as ordered', await PurchaseOrderService.markOrdered({ id: req.params.id, note: req.body.note, userId: req.user._id }));
  }),
  receive: wrap(async (req, res) => {
    await guard(req);
    const result = await PurchaseOrderService.receive({ id: req.params.id, ...req.body, userId: req.user._id });
    ApiResponse.created(res, `Goods received (${result.purchaseOrder.status})`, result);
  }),
  close: wrap(async (req, res) => {
    await guard(req);
    ApiResponse.success(res, 'Purchase order closed', await PurchaseOrderService.close({ id: req.params.id, reason: req.body.reason, userId: req.user._id }));
  }),
  cancel: wrap(async (req, res) => {
    await guard(req);
    ApiResponse.success(res, 'Purchase order cancelled', await PurchaseOrderService.cancel({ id: req.params.id, reason: req.body.reason, userId: req.user._id }));
  })
};
