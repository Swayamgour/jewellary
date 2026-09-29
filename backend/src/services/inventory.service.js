const Inventory = require('../models/Inventory');
const StockMovement = require('../models/StockMovement');
const ApiError = require('../utils/apiError');
const DecimalUtil = require('../utils/decimal');
const { INVENTORY_STATUSES, STOCK_MOVEMENT_TYPES } = require('../config/constants');

const { AVAILABLE, SOLD } = INVENTORY_STATUSES;

/**
 * Inventory rules
 *  - grossWeight / stoneWeight / netWeight on an Inventory row are PER UNIT.
 *  - Stock weight is always  perUnitWeight x quantity  (movement.weightDelta / balanceWeight follow this).
 *  - Quantity is changed with atomic conditional updates ({quantity: {$gte: n}} + $inc), so two
 *    cashiers can never sell the same piece / oversell a lot at the same moment.
 */
class InventoryService {
  static weight(item, qty) {
    return DecimalUtil.roundWeight((item.netWeight || 0) * qty);
  }

  static async _movement({ item, type, quantityDelta, referenceType, referenceId, performedBy, reason, branchId, targetBranchId, balanceQuantity, session }) {
    const balQty = balanceQuantity !== undefined ? balanceQuantity : item.quantity;
    const movement = new StockMovement({
      inventoryId: item._id,
      barcode: item.barcode,
      productId: item.productId,
      movementType: type,
      quantityDelta,
      weightDelta: this.weight(item, quantityDelta),
      balanceQuantity: balQty,
      balanceWeight: this.weight(item, balQty),
      branchId: branchId || item.branchId,
      targetBranchId,
      referenceType,
      referenceId,
      performedBy,
      reason
    });
    await movement.save({ session });
    return movement;
  }

  /**
   * Find the stock row to sell from. Barcode wins; otherwise FIFO over the product's available rows.
   */
  static async resolveSellable({ barcode, productId, branchId, quantity = 1, session = null, requireStock = true }) {
    const query = { branchId, isDeleted: false };
    let item = null;

    if (barcode) {
      item = await Inventory.findOne({ ...query, barcode: barcode.toUpperCase() }).session(session);
      if (!item) {
        throw ApiError.notFound(`Barcode ${barcode} not found in this branch's inventory`);
      }
    } else if (productId) {
      item = await Inventory.findOne({ ...query, productId, status: AVAILABLE, quantity: { $gte: quantity } })
        .sort({ createdAt: 1 })
        .session(session);
      if (!item) {
        throw ApiError.badRequest(`No available stock (qty ${quantity}) for product ${productId} in this branch`);
      }
    } else {
      throw ApiError.badRequest('Each invoice item needs a barcode or a productId');
    }

    if (requireStock) {
      if (item.status !== AVAILABLE) {
        throw ApiError.badRequest(`Item ${item.barcode} is not available for sale (status: ${item.status})`);
      }
      if (item.quantity < quantity) {
        throw ApiError.badRequest(`Insufficient stock for ${item.barcode}. Available: ${item.quantity}, Requested: ${quantity}`);
      }
    }
    return item;
  }

  /**
   * Deduct stock for a sale (atomic).
   */
  static async deductItemForSale({ barcode, productId, inventoryId, branchId, quantity = 1, invoiceId, performedBy, reason = 'Sold via Invoice', session = null }) {
    let target;
    if (inventoryId) {
      target = await Inventory.findOne({ _id: inventoryId, isDeleted: false }).session(session);
      if (!target) throw ApiError.notFound('Inventory item not found for sale');
    } else {
      target = await this.resolveSellable({ barcode, productId, branchId, quantity, session });
    }

    const updated = await Inventory.findOneAndUpdate(
      { _id: target._id, isDeleted: false, status: AVAILABLE, quantity: { $gte: quantity } },
      { $inc: { quantity: -quantity }, $set: { lastSoldInvoiceId: invoiceId || null } },
      { new: true, session }
    );

    if (!updated) {
      throw ApiError.conflict(
        `Stock for ${target.barcode} changed while billing (already sold or insufficient quantity). Please refresh and try again.`,
        'STOCK_CONFLICT'
      );
    }

    if (updated.quantity === 0) {
      await Inventory.updateOne({ _id: updated._id, quantity: 0 }, { $set: { status: SOLD } }, { session });
      updated.status = SOLD;
    }

    await this._movement({
      item: updated,
      type: STOCK_MOVEMENT_TYPES.SALE,
      quantityDelta: -quantity,
      referenceType: 'Invoice',
      referenceId: invoiceId,
      performedBy,
      reason,
      branchId: updated.branchId,
      session
    });
    return updated;
  }

  /**
   * Put stock back (invoice cancellation / sales return).
   */
  static async restoreItemStock({
    barcode,
    inventoryId,
    quantity = 1,
    referenceType = 'Invoice',
    referenceId,
    performedBy,
    reason = 'Stock Restored',
    session = null
  }) {
    if (quantity <= 0) return null;

    const query = { isDeleted: false };
    if (inventoryId) query._id = inventoryId;
    else if (barcode) query.barcode = barcode.toUpperCase();
    else throw ApiError.badRequest('Barcode or inventoryId is required to restore stock');

    const updated = await Inventory.findOneAndUpdate(
      query,
      { $inc: { quantity }, $set: { status: AVAILABLE, lastSoldInvoiceId: null } },
      { new: true, session }
    );
    if (!updated) {
      throw ApiError.notFound(`Inventory record ${barcode || inventoryId} not found for restoration`);
    }

    await this._movement({
      item: updated,
      type: referenceType === 'SalesReturn' ? STOCK_MOVEMENT_TYPES.SALE_RETURN : STOCK_MOVEMENT_TYPES.ADJUSTMENT_IN,
      quantityDelta: quantity,
      referenceType,
      referenceId,
      performedBy,
      reason,
      branchId: updated.branchId,
      session
    });
    return updated;
  }

  /**
   * Add stock from a purchase receipt.
   * itemData.unitCost = landed cost of ONE unit (metal + making + other charges, excl. GST).
   */
  static async addStockFromPurchase({ itemData, purchaseId, branchId, performedBy, session = null }) {
    const barcode = itemData.barcode.toUpperCase();
    const existing = await Inventory.findOne({ barcode }).session(session);
    if (existing) {
      throw ApiError.conflict(`Barcode '${barcode}' already exists in inventory. Barcodes must be unique.`);
    }

    const inventory = new Inventory({
      productId: itemData.productId,
      barcode,
      categoryId: itemData.categoryId,
      metal: itemData.metal,
      purity: itemData.purity,
      grossWeight: itemData.grossWeight,
      stoneWeight: itemData.stoneWeight || 0,
      netWeight: itemData.netWeight,
      quantity: itemData.quantity || 1,
      costPrice: itemData.unitCost || 0,
      branchId,
      warehouseLocation: itemData.warehouseLocation || 'Main Counter',
      status: AVAILABLE,
      purchaseId
    });
    await inventory.save({ session });

    await this._movement({
      item: inventory,
      type: STOCK_MOVEMENT_TYPES.PURCHASE,
      quantityDelta: inventory.quantity,
      referenceType: 'Purchase',
      referenceId: purchaseId,
      performedBy,
      reason: 'Purchased from Vendor',
      branchId,
      session
    });
    return inventory;
  }

  /**
   * Take stock out because it is going back to the vendor / the purchase was cancelled (atomic).
   */
  static async deductForPurchaseReturn({
    barcode,
    inventoryId,
    quantity,
    returnId,
    performedBy,
    reason,
    referenceType = 'PurchaseReturn',
    movementType = STOCK_MOVEMENT_TYPES.PURCHASE_RETURN,
    finalStatus = INVENTORY_STATUSES.RETURNED,
    session = null
  }) {
    const query = { isDeleted: false };
    if (inventoryId) query._id = inventoryId;
    else query.barcode = barcode.toUpperCase();

    const current = await Inventory.findOne(query).session(session);
    if (!current) {
      throw ApiError.notFound(`Item ${barcode || inventoryId} not found for return`);
    }

    const updated = await Inventory.findOneAndUpdate(
      { _id: current._id, quantity: { $gte: quantity } },
      { $inc: { quantity: -quantity } },
      { new: true, session }
    );
    if (!updated) {
      throw ApiError.badRequest(
        `Cannot take ${quantity} of ${current.barcode} out of stock - only ${current.quantity} left (the rest has already been sold or moved).`
      );
    }
    if (updated.quantity === 0) {
      await Inventory.updateOne({ _id: updated._id, quantity: 0 }, { $set: { status: finalStatus } }, { session });
      updated.status = finalStatus;
    }

    await this._movement({
      item: updated,
      type: movementType,
      quantityDelta: -quantity,
      referenceType,
      referenceId: returnId,
      performedBy,
      reason: reason || 'Returned to Vendor',
      branchId: updated.branchId,
      session
    });
    return updated;
  }

  /**
   * Manual stock adjustment (atomic). Weight follows quantity automatically (perUnitWeight x delta).
   */
  static async adjustStock({ barcode, branchId, adjustmentType, quantityDelta, reason, performedBy, session = null }) {
    if (!quantityDelta) throw ApiError.badRequest('quantityDelta cannot be zero');

    const current = await Inventory.findOne({ barcode: barcode.toUpperCase(), branchId, isDeleted: false }).session(session);
    if (!current) throw ApiError.notFound(`Item with barcode ${barcode} not found`);

    const filter = { _id: current._id };
    if (quantityDelta < 0) filter.quantity = { $gte: -quantityDelta };

    const updated = await Inventory.findOneAndUpdate(filter, { $inc: { quantity: quantityDelta } }, { new: true, session });
    if (!updated) {
      throw ApiError.badRequest(`Adjustment would result in negative stock. Current: ${current.quantity}, Delta: ${quantityDelta}`);
    }

    let status = updated.status;
    if (updated.quantity === 0) {
      status = adjustmentType === 'DAMAGE' ? INVENTORY_STATUSES.DAMAGED : SOLD;
    } else if ([SOLD, INVENTORY_STATUSES.DAMAGED].includes(status)) {
      status = AVAILABLE;
    }
    if (status !== updated.status) {
      await Inventory.updateOne({ _id: updated._id }, { $set: { status } }, { session });
      updated.status = status;
    }

    await this._movement({
      item: updated,
      type: adjustmentType,
      quantityDelta,
      referenceType: 'Manual',
      performedBy,
      reason,
      branchId,
      session
    });
    return updated;
  }

  /**
   * Move an inventory row (all of its quantity) to another branch.
   */
  static async transferToBranch({ barcode, sourceBranchId, targetBranchId, reason, performedBy, session = null }) {
    if (!sourceBranchId) throw ApiError.badRequest('Source branch is required for a transfer');
    if (sourceBranchId.toString() === targetBranchId.toString()) {
      throw ApiError.badRequest('Target branch cannot be the same as source branch');
    }

    const updated = await Inventory.findOneAndUpdate(
      { barcode: barcode.toUpperCase(), branchId: sourceBranchId, isDeleted: false, status: AVAILABLE, quantity: { $gt: 0 } },
      { $set: { branchId: targetBranchId } },
      { new: true, session }
    );
    if (!updated) {
      throw ApiError.badRequest(`Item ${barcode} is not available for transfer from this branch`);
    }

    await this._movement({
      item: updated,
      type: STOCK_MOVEMENT_TYPES.TRANSFER_OUT,
      quantityDelta: -updated.quantity,
      balanceQuantity: 0, // nothing is left at the source branch
      referenceType: 'Transfer',
      performedBy,
      reason: `Transfer to Branch: ${reason || 'Inter-branch transfer'}`,
      branchId: sourceBranchId,
      targetBranchId,
      session
    });

    await this._movement({
      item: updated,
      type: STOCK_MOVEMENT_TYPES.TRANSFER_IN,
      quantityDelta: updated.quantity,
      referenceType: 'Transfer',
      performedBy,
      reason: `Transfer from Branch: ${reason || 'Inter-branch transfer'}`,
      branchId: targetBranchId,
      targetBranchId: sourceBranchId,
      session
    });
    return updated;
  }
}

module.exports = InventoryService;
