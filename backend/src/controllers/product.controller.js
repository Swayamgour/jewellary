const Product = require('../models/Product');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const BarcodeGenerator = require('../utils/barcodeGenerator');

class ProductController {
  static async createProduct(req, res, next) {
    try {
      const {
        name,
        code,
        sku,
        categoryId,
        metal,
        purity,
        hsnCode,
        description,
        standardGrossWeight,
        standardStoneWeight,
        standardNetWeight,
        makingType,
        makingRate,
        wastagePercent
      } = req.body;

      const productSku = sku || `${code.toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      const existingSku = await Product.findOne({ sku: productSku });
      if (existingSku) {
        throw ApiError.conflict(`Product with SKU '${productSku}' already exists`);
      }

      const product = new Product({
        name,
        code: code.toUpperCase(),
        sku: productSku,
        categoryId,
        metal,
        purity,
        hsnCode: hsnCode || '7113',
        description,
        standardGrossWeight,
        standardStoneWeight,
        standardNetWeight: standardNetWeight || standardGrossWeight - standardStoneWeight,
        makingType,
        makingRate,
        wastagePercent
      });

      await product.save();

      const populated = await Product.findById(product._id).populate('categoryId');
      return ApiResponse.created(res, 'Product design created successfully', populated);
    } catch (error) {
      next(error);
    }
  }

  static async getProducts(req, res, next) {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = parseInt(req.query.limit || 20, 10);
      const skip = (page - 1) * limit;

      const query = { isDeleted: false };
      if (req.query.categoryId) query.categoryId = req.query.categoryId;
      if (req.query.metal) query.metal = req.query.metal;
      if (req.query.purity) query.purity = req.query.purity;
      if (req.query.search) {
        query.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { code: { $regex: req.query.search, $options: 'i' } },
          { sku: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      const [products, total] = await Promise.all([
        Product.find(query).populate('categoryId').skip(skip).limit(limit).sort({ createdAt: -1 }),
        Product.countDocuments(query)
      ]);

      return ApiResponse.success(res, 'Products fetched successfully', products, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProductById(req, res, next) {
    try {
      const product = await Product.findById(req.params.id).populate('categoryId');
      if (!product || product.isDeleted) {
        throw ApiError.notFound('Product not found');
      }
      return ApiResponse.success(res, 'Product details', product);
    } catch (error) {
      next(error);
    }
  }

  static async updateProduct(req, res, next) {
    try {
      const product = await Product.findById(req.params.id);
      if (!product || product.isDeleted) {
        throw ApiError.notFound('Product not found');
      }

      Object.assign(product, req.body);
      await product.save();

      const updated = await Product.findById(product._id).populate('categoryId');
      return ApiResponse.success(res, 'Product updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async deleteProduct(req, res, next) {
    try {
      const product = await Product.findById(req.params.id);
      if (!product || product.isDeleted) {
        throw ApiError.notFound('Product not found');
      }

      product.isDeleted = true;
      product.isActive = false;
      await product.save();

      return ApiResponse.success(res, 'Product deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ProductController;
