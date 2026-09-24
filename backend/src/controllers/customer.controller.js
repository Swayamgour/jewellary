const Customer = require('../models/Customer');
const CustomerLedger = require('../models/CustomerLedger');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/auditLogger');
const { AUDIT_ACTIONS } = require('../config/constants');

class CustomerController {
  static async createCustomer(req, res, next) {
    try {
      const { name, mobile, email, address, gstin, pan, openingBalance = 0, notes } = req.body;
      const branchId = req.branchId || req.body.branchId || req.user.branchId;

      const customer = new Customer({
        name,
        mobile,
        email,
        address,
        gstin,
        pan,
        openingBalance,
        currentBalance: openingBalance,
        branchId,
        notes
      });

      await customer.save();

      // If opening balance exists, record opening ledger entry
      if (openingBalance !== 0) {
        await CustomerLedger.create({
          customerId: customer._id,
          entryType: 'OPENING',
          referenceType: 'Opening',
          description: 'Opening Balance',
          debit: openingBalance > 0 ? openingBalance : 0,
          credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
          runningBalance: openingBalance,
          branchId,
          createdBy: req.user._id
        });
      }

      await logAudit({
        userId: req.user._id,
        action: AUDIT_ACTIONS.CREATE,
        module: 'CUSTOMER',
        recordId: customer._id,
        newValue: customer.toObject(),
        branchId
      });

      return ApiResponse.created(res, 'Customer created successfully', customer);
    } catch (error) {
      next(error);
    }
  }

  static async getCustomers(req, res, next) {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = parseInt(req.query.limit || 20, 10);
      const skip = (page - 1) * limit;

      const query = { isDeleted: false };
      if (req.branchId) query.branchId = req.branchId;
      if (req.query.search) {
        query.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { mobile: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      const [customers, total] = await Promise.all([
        Customer.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
        Customer.countDocuments(query)
      ]);

      return ApiResponse.success(res, 'Customers fetched successfully', customers, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCustomerById(req, res, next) {
    try {
      const customer = await Customer.findById(req.params.id);
      if (!customer || customer.isDeleted) {
        throw ApiError.notFound('Customer not found');
      }
      return ApiResponse.success(res, 'Customer details', customer);
    } catch (error) {
      next(error);
    }
  }

  static async updateCustomer(req, res, next) {
    try {
      const customer = await Customer.findById(req.params.id);
      if (!customer || customer.isDeleted) {
        throw ApiError.notFound('Customer not found');
      }

      Object.assign(customer, req.body);
      await customer.save();

      await logAudit({
        userId: req.user._id,
        action: AUDIT_ACTIONS.UPDATE,
        module: 'CUSTOMER',
        recordId: customer._id,
        newValue: req.body,
        branchId: customer.branchId
      });

      return ApiResponse.success(res, 'Customer updated successfully', customer);
    } catch (error) {
      next(error);
    }
  }

  static async deleteCustomer(req, res, next) {
    try {
      const customer = await Customer.findById(req.params.id);
      if (!customer || customer.isDeleted) {
        throw ApiError.notFound('Customer not found');
      }

      customer.isDeleted = true;
      customer.isActive = false;
      await customer.save();

      return ApiResponse.success(res, 'Customer deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getCustomerLedger(req, res, next) {
    try {
      const customer = await Customer.findById(req.params.id);
      if (!customer) {
        throw ApiError.notFound('Customer not found');
      }

      const ledger = await CustomerLedger.find({ customerId: req.params.id })
        .sort({ transactionDate: -1, createdAt: -1 })
        .populate('createdBy', 'name');

      return ApiResponse.success(res, 'Customer ledger statements', {
        customer: {
          id: customer._id,
          name: customer.name,
          mobile: customer.mobile,
          currentBalance: customer.currentBalance
        },
        transactions: ledger
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCustomerBills(req, res, next) {
    try {
      const bills = await Invoice.find({ customerId: req.params.id })
        .sort({ invoiceDate: -1 })
        .select('invoiceNo billType invoiceDate grandTotal paymentSummary status paymentStatus');

      return ApiResponse.success(res, 'Customer bills fetched', bills);
    } catch (error) {
      next(error);
    }
  }

  static async getCustomerPayments(req, res, next) {
    try {
      const payments = await Payment.find({ entityId: req.params.id, entityType: 'CUSTOMER' })
        .sort({ paymentDate: -1 });

      return ApiResponse.success(res, 'Customer payments fetched', payments);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CustomerController;
