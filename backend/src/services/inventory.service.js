const Inventory = require('../models/Inventory');
const StockMovement = require('../models/StockMovement');
const ApiError = require('../utils/apiError');
const DecimalUtil = require('../utils/decimal');
const { INVENTORY_STATUSES, STOCK_MOVEMENT_TYPES } = require('../config/constants');

class InventoryService {
  /**
   * Deduct inventory item for Sale
   */
  static async deductItemForSale({
    barcode,
    productId,
    branchId,
    quantity = 1,
    invoiceId,
    performedBy,
    session = null
  }) {
    let query = { branchId, isDeleted: false };
    if (barcode) {
      query.barcode = barcode.toUpperCase();
    } else if (productId) {
      query.productId = productId;
    }

    const item = await Inventory.findOne(query).session(session);

    if (!item) {
      throw ApiError.notFound(`Inventory item not found for sale (barcode: ${barcode || productId})`);
    }

    if (item.status === INVENTORY_STATUSES.SOLD) {
      throw ApiError.badRequest(`Item with barcode ${item.barcode} is already SOLD and cannot be sold again.`);
    }

    if (item.quantity < quantity) {
      throw ApiError.badRequest(`Insufficient stock for ${item.barcode}. Available: ${item.quantity}, Requested: ${quantity}`);
    }

    const prevQty = item.quantity;
    const prevWeight = item.netWeight;

    item.quantity = Math.max(0, item.quantity - quantity);
    if (item.quantity === 0) {
      item.status = INVENTORY_STATUSES.SOLD;
    }
    item.lastSoldInvoiceId = invoiceId;
    await item.save({ session });

    // Record Stock Movement
    const movement = new StockMovement({
      inventoryId: item._id,
      barcode: item.barcode,
      productId: item.productId,
      movementType: STOCK_MOVEMENT_TYPES.SALE,
      quantityDelta: -quantity,
      weightDelta: -DecimalUtil.roundWeight(prevWeight * (quantity / (prevQty || 1))),
      balanceQuantity: item.quantity,
      balanceWeight: DecimalUtil.roundWeight(item.netWeight * (item.quantity / (prevQty || 1))),
      branchId,
      referenceType: 'Invoice',
      referenceId: invoiceId,
      performedBy,
      reason: 'Sold via Invoice'
    });

    await movement.save({ session });
    return item;
  }

  /**
   * Restore stock on Invoice Cancellation or Sale Return
   */
  static async restoreItemStock({
    barcode,
    productId,
    branchId,
    quantity = 1,
    netWeight = 0,
    referenceType = 'Invoice',
    referenceId,
    performedBy,
    reason = 'Stock Restored',
    session = null
  }) {
    let query = { branchId, isDeleted: false };
    if (barcode) {
      query.barcode = barcode.toUpperCase();
    } else if (productId) {
      query.productId = productId;
    }

    let item = await Inventory.findOne(query).session(session);

    if (item) {
      item.quantity += quantity;
      item.status = INVENTORY_STATUSES.AVAILABLE;
      item.lastSoldInvoiceId = null;
      await item.save({ session });
    } else {
      // If item was removed or newly returned
      throw ApiError.notFound(`Original inventory record for ${barcode} not found for restoration`);
    }

    const movement = new StockMovement({
      inventoryId: item._id,
      barcode: item.barcode,
      productId: item.productId,
      movementType: referenceType === 'SalesReturn' ? STOCK_MOVEMENT_TYPES.SALE_RETURN : STOCK_MOVEMENT_TYPES.ADJUSTMENT_IN,
      quantityDelta: quantity,
      weightDelta: netWeight || item.netWeight,
      balanceQuantity: item.quantity,
      balanceWeight: item.netWeight,
      branchId,
      referenceType,
      referenceId,
      performedBy,
      reason
    });

    await movement.save({ session });
    return item;
  }

  /**
   * Add stock from Purchase
   */
  static async addStockFromPurchase({
    itemData,
    purchaseId,
    branchId,
    performedBy,
    session = null
  }) {
    const existing = await Inventory.findOne({ barcode: itemData.barcode.toUpperCase() }).session(session);
    if (existing) {
      throw ApiError.conflict(`Barcode '${itemData.barcode}' already exists in inventory. Barcodes must be unique.`);
    }

    const inventory = new Inventory({
      productId: itemData.productId,
      barcode: itemData.barcode.toUpperCase(),
      categoryId: itemData.categoryId,
      metal: itemData.metal,
      purity: itemData.purity,
      grossWeight: itemData.grossWeight,
      stoneWeight: itemData.stoneWeight || 0,
      netWeight: itemData.netWeight,
      quantity: itemData.quantity || 1,
      costPrice: itemData.rate,
      makingRate: itemData.makingAmount || 0,
      stoneAmount: itemData.otherCharges || 0,
      branchId,
      warehouseLocation: itemData.warehouseLocation || 'Main Counter',
      status: INVENTORY_STATUSES.AVAILABLE,
      purchaseId
    });

    await inventory.save({ session });

    // Stock Movement
    const movement = new StockMovement({
      inventoryId: inventory._id,
      barcode: inventory.barcode,
      productId: inventory.productId,
      movementType: STOCK_MOVEMENT_TYPES.PURCHASE,
      quantityDelta: inventory.quantity,
      weightDelta: inventory.netWeight,
      balanceQuantity: inventory.quantity,
      balanceWeight: inventory.netWeight,
      branchId,
      referenceType: 'Purchase',
      referenceId: purchaseId,
      performedBy,
      reason: 'Purchased from Vendor'
    });

    await movement.save({ session });
    return inventory;
  }

  /**
   * Deduct stock for Purchase Return
   */
  static async deductForPurchaseReturn({
    barcode,
    quantity,
    returnId,
    branchId,
    performedBy,
    reason,
    session = null
  }) {
    const item = await Inventory.findOne({ barcode: barcode.toUpperCase(), branchId }).session(session);
    if (!item) {
      throw ApiError.notFound(`Item with barcode ${barcode} not found for return`);
    }

    if (item.quantity < quantity) {
      throw ApiError.badRequest(`Insufficient stock for return. Available: ${item.quantity}`);
    }

    item.quantity -= quantity;
    if (item.quantity === 0) {
      item.status = INVENTORY_STATUSES.SOLD; // Or RETURNED
    }
    await item.save({ session });

    const movement = new StockMovement({
      inventoryId: item._id,
      barcode: item.barcode,
      productId: item.productId,
      movementType: STOCK_MOVEMENT_TYPES.PURCHASE_RETURN,
      quantityDelta: -quantity,
      weightDelta: -item.netWeight,
      balanceQuantity: item.quantity,
      balanceWeight: DecimalUtil.roundWeight(item.netWeight * (item.quantity / (item.quantity + quantity))),
      branchId,
      referenceType: 'PurchaseReturn',
      referenceId: returnId,
      performedBy,
      reason: reason || 'Returned to Vendor'
    });

    await movement.save({ session });
    return item;
  }
}

module.exports = InventoryService;
