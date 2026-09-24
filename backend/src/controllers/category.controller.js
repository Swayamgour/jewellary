const Category = require('../models/Category');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

class CategoryController {
  static async createCategory(req, res, next) {
    try {
      const { name, code, metal, hsnCode, defaultMakingType, defaultMakingRate, defaultWastagePercent, description } = req.body;

      const existing = await Category.findOne({ code: code.toUpperCase() });
      if (existing) {
        throw ApiError.conflict(`Category with code '${code}' already exists`);
      }

      const category = new Category({
        name,
        code: code.toUpperCase(),
        metal,
        hsnCode: hsnCode || '7113',
        defaultMakingType,
        defaultMakingRate,
        defaultWastagePercent,
        description
      });

      await category.save();
      return ApiResponse.created(res, 'Category created successfully', category);
    } catch (error) {
      next(error);
    }
  }

  static async getCategories(req, res, next) {
    try {
      const query = { isDeleted: false };
      if (req.query.metal) query.metal = req.query.metal;

      const categories = await Category.find(query).sort({ name: 1 });
      return ApiResponse.success(res, 'Categories fetched successfully', categories);
    } catch (error) {
      next(error);
    }
  }

  static async getCategoryById(req, res, next) {
    try {
      const category = await Category.findById(req.params.id);
      if (!category || category.isDeleted) {
        throw ApiError.notFound('Category not found');
      }
      return ApiResponse.success(res, 'Category details', category);
    } catch (error) {
      next(error);
    }
  }

  static async updateCategory(req, res, next) {
    try {
      const category = await Category.findById(req.params.id);
      if (!category || category.isDeleted) {
        throw ApiError.notFound('Category not found');
      }

      Object.assign(category, req.body);
      await category.save();

      return ApiResponse.success(res, 'Category updated successfully', category);
    } catch (error) {
      next(error);
    }
  }

  static async deleteCategory(req, res, next) {
    try {
      const category = await Category.findById(req.params.id);
      if (!category || category.isDeleted) {
        throw ApiError.notFound('Category not found');
      }

      category.isDeleted = true;
      category.isActive = false;
      await category.save();

      return ApiResponse.success(res, 'Category deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CategoryController;
