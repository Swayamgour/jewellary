const Order = require('../models/Order');
const PaymentService = require('../services/payment.service');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const Branch = require('../models/Branch');
const { nextDocNo } = require('../utils/sequence');
const { withTransaction } = require('../utils/transaction');
const { assertBranchAccess } = require('../utils/branchScope');
const DecimalUtil = require('../utils/decimal');
const { ORDER_STATUSES } = require('../config/constants');
const { logAudit } = require('../utils/auditLogger');
const { AUDIT_ACTIONS } = require('../config/constants');

const ORDER_FLOW = {
  NEW: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['MANUFACTURING', 'CANCELLED'],
  MANUFACTURING: ['QC', 'CANCELLED'],
  QC: ['MANUFACTURING', 'READY'],
  READY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: []
};

class OrderController {
  static async createOrder(req, res, next) {
    try {
      const { customerId, expectedDeliveryDate, items, totalEstimatedAmount, advancePaid = 0, paymentMode = 'CASH', notes } = req.body;
      const branchId = req.branchId || req.body.branchId || req.user.branchId;
      if (advancePaid > totalEstimatedAmount) {
        throw ApiError.badRequest('Advance cannot exceed the estimated order amount');
      }

      const order = await withTransaction(async (session) => {
        const branch = await Branch.findById(branchId).select('code').session(session);
        const orderNo = await nextDocNo('ORD', branch?.code || 'BR', session, { model: Order, field: 'orderNo' });

        const doc = new Order({
          orderNo,
          customerId,
          orderDate: new Date(),
          expectedDeliveryDate,
          items,
          totalEstimatedAmount,
          advancePaid: 0,
          balanceDue: totalEstimatedAmount,
          status: ORDER_STATUSES.CONFIRMED,
          branchId,
          createdBy: req.user._id,
          notes
        });
        await doc.save({ session });

        // the advance goes through the payment engine, which keeps order + customer ledger in step
        if (advancePaid > 0) {
          await PaymentService.recordPayment({
            referenceType: 'ORDER',
            referenceId: doc._id,
            entityType: 'CUSTOMER',
            entityId: customerId,
            amount: advancePaid,
            paymentMode,
            branchId,
            recordedBy: req.user._id,
            notes: `Advance for Custom Jewellery Order #${doc.orderNo}`,
            session
          });
        }

        await logAudit(
          { userId: req.user._id, action: AUDIT_ACTIONS.CREATE, module: 'ORDER', recordId: doc._id, newValue: doc.toObject(), branchId },
          session
        );
        return Order.findById(doc._id).session(session);
      });

      return ApiResponse.created(res, 'Custom jewellery order placed successfully', order);
    } catch (error) {
      next(error);
    }
  }

  static async getOrders(req, res, next) {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = parseInt(req.query.limit || 20, 10);
      const skip = (page - 1) * limit;

      const query = {};
      if (req.branchId) query.branchId = req.branchId;
      if (req.query.customerId) query.customerId = req.query.customerId;
      if (req.query.status) query.status = req.query.status;

      const [orders, total] = await Promise.all([
        Order.find(query)
          .populate('customerId', 'name mobile')
          .populate('createdBy', 'name')
          .skip(skip)
          .limit(limit)
          .sort({ orderDate: -1 }),
        Order.countDocuments(query)
      ]);

      return ApiResponse.success(res, 'Orders fetched successfully', orders, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  }

  static async getOrderById(req, res, next) {
    try {
      const order = await Order.findById(req.params.id)
        .populate('customerId')
        .populate('branchId')
        .populate('createdBy', 'name');

      if (!order) {
        throw ApiError.notFound('Order not found');
      }
      assertBranchAccess(req, order);
      return ApiResponse.success(res, 'Order details', order);
    } catch (error) {
      next(error);
    }
  }

  static async updateOrderStatus(req, res, next) {
    try {
      const { status } = req.body;
      if (!Object.values(ORDER_STATUSES).includes(status)) {
        throw ApiError.badRequest(`Invalid order status. Allowed: ${Object.values(ORDER_STATUSES).join(', ')}`);
      }

      const order = await Order.findById(req.params.id);
      if (!order) {
        throw ApiError.notFound('Order not found');
      }

      assertBranchAccess(req, order);
      const allowed = ORDER_FLOW[order.status] || [];
      if (!allowed.includes(status)) {
        throw ApiError.badRequest(`Order cannot move from ${order.status} to ${status}. Allowed: ${allowed.join(', ') || 'none'}`);
      }
      const oldStatus = order.status;
      order.status = status;
      if (status === ORDER_STATUSES.DELIVERED) {
        order.actualDeliveryDate = new Date();
      }
      await order.save();

      await logAudit({
        userId: req.user._id,
        action: AUDIT_ACTIONS.UPDATE,
        module: 'ORDER',
        recordId: order._id,
        oldValue: { status: oldStatus },
        newValue: { status },
        branchId: order.branchId
      });

      return ApiResponse.success(res, `Order status updated to ${status}`, order);
    } catch (error) {
      next(error);
    }
  }

  static async assignKarigar(req, res, next) {
    try {
      const { artisanName, phone, expectedCompletionDate } = req.body;
      const order = await Order.findById(req.params.id);
      if (!order) {
        throw ApiError.notFound('Order not found');
      }

      order.karigarDetails = {
        artisanName,
        phone,
        assignedDate: new Date(),
        expectedCompletionDate: expectedCompletionDate || order.expectedDeliveryDate
      };

      if (order.status === ORDER_STATUSES.CONFIRMED || order.status === ORDER_STATUSES.NEW) {
        order.status = ORDER_STATUSES.MANUFACTURING;
      }

      await order.save();

      return ApiResponse.success(res, 'Karigar/Artisan assigned successfully', order);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = OrderController;
