const escapeRegex = require('../utils/escapeRegex');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const SalesReturn = require('../models/SalesReturn');
const BillingService = require('../services/billing.service');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { assertBranchAccess, guardBranch } = require('../utils/branchScope');
const { BILL_TYPES, INVOICE_STATUSES } = require('../config/constants');

class BillingController {
  // --- UNIFIED REGISTER (Kacha + Pakka, every status) ---
  static async listInvoices(req, res, next) {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = Math.min(parseInt(req.query.limit || 20, 10), 200);
      const skip = (page - 1) * limit;

      const query = {};
      if (req.branchId) query.branchId = req.branchId;
      if (req.query.billType) query.billType = req.query.billType;
      if (req.query.status) query.status = req.query.status;
      if (req.query.paymentStatus) query.paymentStatus = req.query.paymentStatus;
      if (req.query.customerId) query.customerId = req.query.customerId;
      if (req.query.dueOnly === 'true') {
        query.status = query.status || 'CONFIRMED';
        query['paymentSummary.due'] = { $gt: 0 };
      }
      if (req.query.search) {
        const rx = { $regex: escapeRegex(req.query.search), $options: 'i' };
        query.$or = [{ invoiceNo: rx }, { 'customerSnapshot.name': rx }, { 'customerSnapshot.mobile': rx }];
      }

      const [bills, total] = await Promise.all([
        Invoice.find(query).sort({ invoiceDate: -1, createdAt: -1 }).skip(skip).limit(limit),
        Invoice.countDocuments(query)
      ]);

      return ApiResponse.success(res, 'Invoices fetched', bills, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      next(error);
    }
  }

  // --- ONE INVOICE (any type / status) with its payments and sales returns ---
  static async getInvoiceById(req, res, next) {
    try {
      const invoice = await Invoice.findById(req.params.id)
        .populate('customerId')
        .populate('branchId')
        .populate('createdBy', 'name')
        .populate('convertedFromKachaBillId', 'invoiceNo invoiceDate grandTotal')
        .populate('convertedToPakkaBillId', 'invoiceNo invoiceDate grandTotal');
      if (!invoice) throw ApiError.notFound('Invoice not found');
      assertBranchAccess(req, invoice);

      const [payments, salesReturns] = await Promise.all([
        Payment.find({ referenceType: 'INVOICE', referenceId: invoice._id }).sort({ paymentDate: 1 }).populate('recordedBy', 'name'),
        SalesReturn.find({ invoiceId: invoice._id }).sort({ returnDate: -1 })
      ]);

      const data = invoice.toObject();
      data.payments = payments;
      data.salesReturns = salesReturns;
      return ApiResponse.success(res, 'Invoice details', data);
    } catch (error) {
      next(error);
    }
  }

  // --- KACHA BILLS ---
  static async createKachaBill(req, res, next) {
    try {
      const { customerId, items, discount = 0, payments = [], notes, status = INVOICE_STATUSES.CONFIRMED } = req.body;
      const branchId = req.branchId || req.body.branchId || req.user.branchId;

      const invoice = await BillingService.createKachaBill({
        customerId,
        branchId,
        items,
        discount,
        payments,
        notes,
        userId: req.user._id,
        status
      });

      return ApiResponse.created(res, status === INVOICE_STATUSES.DRAFT ? 'Kacha bill saved as draft' : 'Kacha bill generated successfully', invoice);
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
      assertBranchAccess(req, bill);
      return ApiResponse.success(res, 'Kacha bill details', bill);
    } catch (error) {
      next(error);
    }
  }

  static async convertKachaToPakka(req, res, next) {
    try {
      await guardBranch(req, Invoice, req.params.id, 'Kacha bill');
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
      const { customerId, items, discount = 0, payments = [], notes, status = INVOICE_STATUSES.CONFIRMED } = req.body;
      const branchId = req.branchId || req.body.branchId || req.user.branchId;

      const invoice = await BillingService.createPakkaBill({
        customerId,
        branchId,
        items,
        discount,
        payments,
        notes,
        userId: req.user._id,
        status
      });

      return ApiResponse.created(res, status === INVOICE_STATUSES.DRAFT ? 'Pakka bill saved as draft' : 'Pakka GST invoice created successfully', invoice);
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
      assertBranchAccess(req, bill);
      return ApiResponse.success(res, 'Pakka invoice details', bill);
    } catch (error) {
      next(error);
    }
  }

  static async cancelInvoice(req, res, next) {
    try {
      const { reason, paymentAction, refundMode, refundModeDetails } = req.body;
      await guardBranch(req, Invoice, req.params.id, 'Invoice');
      const cancelledInvoice = await BillingService.cancelInvoice({
        invoiceId: req.params.id,
        reason,
        paymentAction,
        refundMode,
        refundModeDetails,
        userId: req.user._id
      });

      return ApiResponse.success(res, 'Invoice cancelled: stock restored, receivable reversed and payments settled', cancelledInvoice);
    } catch (error) {
      next(error);
    }
  }

  static async updateDraft(req, res, next) {
    try {
      await guardBranch(req, Invoice, req.params.id, 'Bill');
      const { customerId, items, discount, notes } = req.body;
      const invoice = await BillingService.updateDraft({ invoiceId: req.params.id, customerId, items, discount, notes, userId: req.user._id });
      return ApiResponse.success(res, 'Draft updated', invoice);
    } catch (error) {
      next(error);
    }
  }

  static async confirmDraft(req, res, next) {
    try {
      await guardBranch(req, Invoice, req.params.id, 'Bill');
      const invoice = await BillingService.confirmDraft({ invoiceId: req.params.id, payments: req.body.payments || [], userId: req.user._id });
      return ApiResponse.success(res, 'Bill confirmed: stock deducted and ledger posted', invoice);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = BillingController;
