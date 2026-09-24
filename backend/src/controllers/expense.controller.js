const Expense = require('../models/Expense');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const BarcodeGenerator = require('../utils/barcodeGenerator');
const { logAudit } = require('../utils/auditLogger');
const { AUDIT_ACTIONS } = require('../config/constants');

class ExpenseController {
  static async createExpense(req, res, next) {
    try {
      const { title, category, amount, paymentMode, paymentReference, expenseDate, notes } = req.body;
      const branchId = req.branchId || req.body.branchId || req.user.branchId;

      const expenseNo = BarcodeGenerator.generateInvoiceNo('EXP', 'BR', Math.floor(1000 + Math.random() * 9000));

      const expense = new Expense({
        expenseNo,
        title,
        category: category.toUpperCase(),
        amount,
        paymentMode,
        paymentReference,
        expenseDate: expenseDate || new Date(),
        branchId,
        recordedBy: req.user._id,
        notes
      });

      await expense.save();

      await logAudit({
        userId: req.user._id,
        action: AUDIT_ACTIONS.CREATE,
        module: 'EXPENSE',
        recordId: expense._id,
        newValue: expense.toObject(),
        branchId
      });

      return ApiResponse.created(res, 'Expense recorded successfully', expense);
    } catch (error) {
      next(error);
    }
  }

  static async getExpenses(req, res, next) {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = parseInt(req.query.limit || 20, 10);
      const skip = (page - 1) * limit;

      const query = {};
      if (req.branchId) query.branchId = req.branchId;
      if (req.query.category) query.category = req.query.category.toUpperCase();
      if (req.query.paymentMode) query.paymentMode = req.query.paymentMode;

      const [expenses, total] = await Promise.all([
        Expense.find(query).populate('recordedBy', 'name').skip(skip).limit(limit).sort({ expenseDate: -1 }),
        Expense.countDocuments(query)
      ]);

      return ApiResponse.success(res, 'Expenses fetched successfully', expenses, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  }

  static async getExpenseById(req, res, next) {
    try {
      const expense = await Expense.findById(req.params.id)
        .populate('recordedBy', 'name email')
        .populate('branchId', 'name code');

      if (!expense) {
        throw ApiError.notFound('Expense record not found');
      }
      return ApiResponse.success(res, 'Expense details', expense);
    } catch (error) {
      next(error);
    }
  }

  static async updateExpense(req, res, next) {
    try {
      const expense = await Expense.findById(req.params.id);
      if (!expense) {
        throw ApiError.notFound('Expense record not found');
      }

      Object.assign(expense, req.body);
      await expense.save();

      return ApiResponse.success(res, 'Expense updated successfully', expense);
    } catch (error) {
      next(error);
    }
  }

  static async deleteExpense(req, res, next) {
    try {
      const expense = await Expense.findById(req.params.id);
      if (!expense) {
        throw ApiError.notFound('Expense record not found');
      }

      await expense.deleteOne();

      await logAudit({
        userId: req.user._id,
        action: AUDIT_ACTIONS.DELETE,
        module: 'EXPENSE',
        recordId: req.params.id,
        branchId: expense.branchId
      });

      return ApiResponse.success(res, 'Expense record deleted');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ExpenseController;
