const escapeRegex = require('../utils/escapeRegex');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const Vendor = require('../models/Vendor');
const PaymentService = require('../services/payment.service');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { withTransaction } = require('../utils/transaction');
const { logAudit } = require('../utils/auditLogger');
const { assertBranchAccess } = require('../utils/branchScope');
const { AUDIT_ACTIONS } = require('../config/constants');

class PaymentController {
  static async recordPayment(req, res, next) {
    try {
      const { referenceType, referenceId, entityType, entityId, amount, paymentMode, modeDetails, notes } = req.body;
      if (referenceType === 'INVOICE' && entityType !== 'CUSTOMER') {
        throw ApiError.badRequest('Invoice payments must be for a CUSTOMER');
      }
      const branchId = req.branchId || req.body.branchId || req.user.branchId;

      const payment = await withTransaction(async (session) => {
        return await PaymentService.recordPayment({
          referenceType,
          referenceId,
          entityType,
          entityId,
          amount,
          paymentMode,
          modeDetails,
          branchId,
          recordedBy: req.user._id,
          notes,
          session
        });
      });

      return ApiResponse.created(res, 'Payment recorded successfully', payment);
    } catch (error) {
      next(error);
    }
  }

  static async getPayments(req, res, next) {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = parseInt(req.query.limit || 20, 10);
      const skip = (page - 1) * limit;

      const query = {};
      if (req.branchId) query.branchId = req.branchId;
      if (req.query.paymentMode) query.paymentMode = req.query.paymentMode;
      if (req.query.entityType) query.entityType = req.query.entityType;
      if (req.query.entityId) query.entityId = req.query.entityId;
      if (req.query.referenceType) query.referenceType = req.query.referenceType;
      if (req.query.status) query.status = req.query.status;
      if (req.query.direction) query.direction = req.query.direction;
      if (req.query.referenceId) query.referenceId = req.query.referenceId;

      if (req.query.startDate || req.query.endDate) {
        query.paymentDate = {};
        if (req.query.startDate) query.paymentDate.$gte = new Date(req.query.startDate);
        if (req.query.endDate) {
          const e = new Date(req.query.endDate);
          e.setHours(23, 59, 59, 999);
          query.paymentDate.$lte = e;
        }
      }
      if (req.query.search) {
        query.paymentNo = { $regex: escapeRegex(req.query.search), $options: 'i' };
      }

      const [rows, total] = await Promise.all([
        Payment.find(query).populate('recordedBy', 'name').skip(skip).limit(limit).sort({ paymentDate: -1 }).lean(),
        Payment.countDocuments(query)
      ]);

      // entityId is polymorphic (customer / vendor) - attach a display name for the register
      const custIds = rows.filter((p) => p.entityType === 'CUSTOMER').map((p) => p.entityId);
      const vendIds = rows.filter((p) => p.entityType === 'VENDOR').map((p) => p.entityId);
      const [custs, vends] = await Promise.all([
        custIds.length ? Customer.find({ _id: { $in: custIds } }).select('name mobile').lean() : [],
        vendIds.length ? Vendor.find({ _id: { $in: vendIds } }).select('name company mobile').lean() : []
      ]);
      const nameMap = new Map();
      custs.forEach((c) => nameMap.set(String(c._id), c.name));
      vends.forEach((v) => nameMap.set(String(v._id), v.company || v.name));
      const payments = rows.map((p) => ({ ...p, partyName: nameMap.get(String(p.entityId)) || '' }));

      return ApiResponse.success(res, 'Payments fetched successfully', payments, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentById(req, res, next) {
    try {
      const payment = await Payment.findById(req.params.id)
        .populate('recordedBy', 'name email')
        .populate('branchId', 'name code');

      if (!payment) {
        throw ApiError.notFound('Payment record not found');
      }
      assertBranchAccess(req, payment);
      return ApiResponse.success(res, 'Payment details', payment);
    } catch (error) {
      next(error);
    }
  }

  static async reversePayment(req, res, next) {
    try {
      const { reversalReason } = req.body;
      const existing = await Payment.findById(req.params.id).select('branchId');
      if (!existing) throw ApiError.notFound('Payment record not found');
      assertBranchAccess(req, existing);
      const reversedPayment = await withTransaction(async (session) => {
        return await PaymentService.reversePayment({
          paymentId: req.params.id,
          reversalReason,
          reversedBy: req.user._id,
          session
        });
      });

      await logAudit({
        userId: req.user._id,
        action: AUDIT_ACTIONS.CANCEL,
        module: 'PAYMENT',
        recordId: reversedPayment._id,
        newValue: { status: 'REVERSED', reversalReason },
        branchId: reversedPayment.branchId
      });

      return ApiResponse.success(res, 'Payment reversed successfully', reversedPayment);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PaymentController;
