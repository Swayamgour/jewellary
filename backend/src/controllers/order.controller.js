const Order = require('../models/Order');
const PaymentService = require('../services/payment.service');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const BarcodeGenerator = require('../utils/barcodeGenerator');
const DecimalUtil = require('../utils/decimal');
const { ORDER_STATUSES } = require('../config/constants');
const { logAudit } = require('../utils/auditLogger');
const { AUDIT_ACTIONS } = require('../config/constants');

class OrderController {
  static async createOrder(req, res, next) {
    try {
      const { customerId, expectedDeliveryDate, items, totalEstimatedAmount, advancePaid = 0, paymentMode = 'CASH', notes } = req.body;
      const branchId = req.branchId || req.body.branchId || req.user.branchId;

      const orderNo = BarcodeGenerator.generateInvoiceNo('ORD', 'BR', Math.floor(1000 + Math.random() * 9000));
      const balanceDue = Math.max(0, DecimalUtil.subtract(totalEstimatedAmount, advancePaid));

      const order = new Order({
        orderNo,
        customerId,
        orderDate: new Date(),
        expectedDeliveryDate,
        items,
        totalEstimatedAmount,
        advancePaid,
        balanceDue,
        status: ORDER_STATUSES.CONFIRMED,
        branchId,
        createdBy: req.user._id,
        notes
      });

      await order.save();

      // If advance paid, record payment
      if (advancePaid > 0) {
        await PaymentService.recordPayment({
          referenceType: 'ORDER',
          referenceId: order._id,
          entityType: 'CUSTOMER',
          entityId: customerId,
          amount: advancePaid,
          paymentMode,
          branchId,
          recordedBy: req.user._id,
          notes: `Advance for Custom Jewellery Order #${order.orderNo}`
        });
      }

      await logAudit({
        userId: req.user._id,
        action: AUDIT_ACTIONS.CREATE,
        module: 'ORDER',
        recordId: order._id,
        newValue: order.toObject(),
        branchId
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
