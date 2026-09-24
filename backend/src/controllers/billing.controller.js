const Invoice = require('../models/Invoice');
const BillingService = require('../services/billing.service');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { BILL_TYPES, INVOICE_STATUSES } = require('../config/constants');

class BillingController {
  // --- KACHA BILLS ---
  static async createKachaBill(req, res, next) {
    try {
      const { customerId, items, discount = 0, payments = [], notes } = req.body;
      const branchId = req.branchId || req.body.branchId || req.user.branchId;

      const invoice = await BillingService.createKachaBill({
        customerId,
        branchId,
        items,
        discount,
        payments,
        notes,
        userId: req.user._id,
        status: INVOICE_STATUSES.CONFIRMED
      });

      return ApiResponse.created(res, 'Kacha bill generated successfully', invoice);
    } catch (error) {
      next(error);
    }
  }

  static async getKachaBills(req, res, next) {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = parseInt(req.query.limit || 20, 10);
      const skip = (page - 1) * limit;

      const query = { billType: BILL_TYPES.KACHA };
      if (req.branchId) query.branchId = req.branchId;
      if (req.query.status) query.status = req.query.status;
      if (req.query.paymentStatus) query.paymentStatus = req.query.paymentStatus;
      if (req.query.customerId) query.customerId = req.query.customerId;
      if (req.query.search) {
        query.$or = [
          { invoiceNo: { $regex: req.query.search, $options: 'i' } },
          { 'customerSnapshot.name': { $regex: req.query.search, $options: 'i' } },
          { 'customerSnapshot.mobile': { $regex: req.query.search, $options: 'i' } }
        ];
      }

      const [bills, total] = await Promise.all([
        Invoice.find(query).skip(skip).limit(limit).sort({ invoiceDate: -1 }),
        Invoice.countDocuments(query)
      ]);

      return ApiResponse.success(res, 'Kacha bills fetched', bills, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  }

  static async getKachaBillById(req, res, next) {
    try {
      const bill = await Invoice.findOne({ _id: req.params.id, billType: BILL_TYPES.KACHA })
        .populate('customerId')
        .populate('branchId')
        .populate('createdBy', 'name');

      if (!bill) {
        throw ApiError.notFound('Kacha bill not found');
      }
      return ApiResponse.success(res, 'Kacha bill details', bill);
    } catch (error) {
      next(error);
    }
  }

  static async convertKachaToPakka(req, res, next) {
    try {
      const pakkaInvoice = await BillingService.convertKachaToPakka({
        kachaBillId: req.params.id,
        userId: req.user._id
      });

      return ApiResponse.success(res, 'Kacha bill converted to Pakka GST invoice successfully', pakkaInvoice);
    } catch (error) {
      next(error);
    }
  }

  // --- PAKKA / GST BILLS ---
  static async createPakkaBill(req, res, next) {
    try {
      const { customerId, items, discount = 0, payments = [], notes } = req.body;
      const branchId = req.branchId || req.body.branchId || req.user.branchId;

      const invoice = await BillingService.createPakkaBill({
        customerId,
        branchId,
        items,
        discount,
        payments,
        notes,
        userId: req.user._id,
        status: INVOICE_STATUSES.CONFIRMED
      });

      return ApiResponse.created(res, 'Pakka GST invoice created successfully', invoice);
    } catch (error) {
      next(error);
    }
  }

  static async getPakkaBills(req, res, next) {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = parseInt(req.query.limit || 20, 10);
      const skip = (page - 1) * limit;

      const query = { billType: BILL_TYPES.PAKKA };
      if (req.branchId) query.branchId = req.branchId;
      if (req.query.status) query.status = req.query.status;
      if (req.query.paymentStatus) query.paymentStatus = req.query.paymentStatus;
      if (req.query.customerId) query.customerId = req.query.customerId;
      if (req.query.search) {
        query.$or = [
          { invoiceNo: { $regex: req.query.search, $options: 'i' } },
          { 'customerSnapshot.name': { $regex: req.query.search, $options: 'i' } },
          { 'customerSnapshot.mobile': { $regex: req.query.search, $options: 'i' } },
          { 'customerSnapshot.gstin': { $regex: req.query.search, $options: 'i' } }
        ];
      }

      const [bills, total] = await Promise.all([
        Invoice.find(query).skip(skip).limit(limit).sort({ invoiceDate: -1 }),
        Invoice.countDocuments(query)
      ]);

      return ApiResponse.success(res, 'Pakka bills fetched', bills, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPakkaBillById(req, res, next) {
    try {
      const bill = await Invoice.findOne({ _id: req.params.id, billType: BILL_TYPES.PAKKA })
        .populate('customerId')
        .populate('branchId')
        .populate('createdBy', 'name')
        .populate('convertedFromKachaBillId', 'invoiceNo invoiceDate grandTotal');

      if (!bill) {
        throw ApiError.notFound('Pakka invoice not found');
      }
      return ApiResponse.success(res, 'Pakka invoice details', bill);
    } catch (error) {
      next(error);
    }
  }

  static async cancelInvoice(req, res, next) {
    try {
      const { reason } = req.body;
      const cancelledInvoice = await BillingService.cancelInvoice({
        invoiceId: req.params.id,
        reason,
        userId: req.user._id
      });

      return ApiResponse.success(res, 'Invoice cancelled successfully and stock restored', cancelledInvoice);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = BillingController;
