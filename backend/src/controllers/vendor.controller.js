const Vendor = require('../models/Vendor');
const VendorLedger = require('../models/VendorLedger');
const Purchase = require('../models/Purchase');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/auditLogger');
const { AUDIT_ACTIONS } = require('../config/constants');

class VendorController {
  static async createVendor(req, res, next) {
    try {
      const { name, company, mobile, email, gstin, pan, address, bankDetails, openingBalance = 0, notes } = req.body;
      const branchId = req.branchId || req.body.branchId || req.user.branchId;

      const vendor = new Vendor({
        name,
        company,
        mobile,
        email,
        gstin,
        pan,
        address,
        bankDetails,
        openingBalance,
        currentBalance: openingBalance,
        branchId,
        notes
      });

      await vendor.save();

      if (openingBalance !== 0) {
        await VendorLedger.create({
          vendorId: vendor._id,
          entryType: 'OPENING',
          referenceType: 'Opening',
          description: 'Opening Balance',
          debit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
          credit: openingBalance > 0 ? openingBalance : 0,
          runningBalance: openingBalance,
          branchId,
          createdBy: req.user._id
        });
      }

      await logAudit({
        userId: req.user._id,
        action: AUDIT_ACTIONS.CREATE,
        module: 'VENDOR',
        recordId: vendor._id,
        newValue: vendor.toObject(),
        branchId
      });

      return ApiResponse.created(res, 'Vendor registered successfully', vendor);
    } catch (error) {
      next(error);
    }
  }

  static async getVendors(req, res, next) {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = parseInt(req.query.limit || 20, 10);
      const skip = (page - 1) * limit;

      const query = { isDeleted: false };
      if (req.branchId) query.branchId = req.branchId;
      if (req.query.search) {
        query.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { company: { $regex: req.query.search, $options: 'i' } },
          { mobile: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      const [vendors, total] = await Promise.all([
        Vendor.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
        Vendor.countDocuments(query)
      ]);

      return ApiResponse.success(res, 'Vendors fetched successfully', vendors, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  }

  static async getVendorById(req, res, next) {
    try {
      const vendor = await Vendor.findById(req.params.id);
      if (!vendor || vendor.isDeleted) {
        throw ApiError.notFound('Vendor not found');
      }
      return ApiResponse.success(res, 'Vendor details', vendor);
    } catch (error) {
      next(error);
    }
  }

  static async updateVendor(req, res, next) {
    try {
      const vendor = await Vendor.findById(req.params.id);
      if (!vendor || vendor.isDeleted) {
        throw ApiError.notFound('Vendor not found');
      }

      Object.assign(vendor, req.body);
      await vendor.save();

      await logAudit({
        userId: req.user._id,
        action: AUDIT_ACTIONS.UPDATE,
        module: 'VENDOR',
        recordId: vendor._id,
        newValue: req.body,
        branchId: vendor.branchId
      });

      return ApiResponse.success(res, 'Vendor updated successfully', vendor);
    } catch (error) {
      next(error);
    }
  }

  static async deleteVendor(req, res, next) {
    try {
      const vendor = await Vendor.findById(req.params.id);
      if (!vendor || vendor.isDeleted) {
        throw ApiError.notFound('Vendor not found');
      }

      vendor.isDeleted = true;
      vendor.isActive = false;
      await vendor.save();

      return ApiResponse.success(res, 'Vendor deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getVendorLedger(req, res, next) {
    try {
      const vendor = await Vendor.findById(req.params.id);
      if (!vendor) {
        throw ApiError.notFound('Vendor not found');
      }

      const ledger = await VendorLedger.find({ vendorId: req.params.id })
        .sort({ transactionDate: -1, createdAt: -1 })
        .populate('createdBy', 'name');

      return ApiResponse.success(res, 'Vendor ledger statements', {
        vendor: {
          id: vendor._id,
          name: vendor.name,
          company: vendor.company,
          currentBalance: vendor.currentBalance
        },
        transactions: ledger
      });
    } catch (error) {
      next(error);
    }
  }

  static async getVendorPurchases(req, res, next) {
    try {
      const purchases = await Purchase.find({ vendorId: req.params.id })
        .sort({ purchaseDate: -1 })
        .select('purchaseNo vendorInvoiceNo purchaseDate grandTotal paidAmount dueAmount paymentStatus status');

      return ApiResponse.success(res, 'Vendor purchases fetched', purchases);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = VendorController;
