const crypto = require('crypto');

/**
 * Generates unique jewellery item barcodes
 * Format: [PREFIX]-[YEAR/MONTH]-[RANDOM_ALPHANUMERIC]
 * e.g., JWL-2609-A7K92X
 */
class BarcodeGenerator {
  /**
   * Generate a unique barcode string
   * @param {string} prefix - e.g., 'JWL', 'GLD', 'SLV', 'DIA'
   * @returns {string}
   */
  static generate(prefix = 'JWL') {
    const date = new Date();
    const yearMonth = `${date.getFullYear().toString().slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${yearMonth}-${randomHex}`;
  }

  /**
   * Generate sequential invoice number
   * Format: [TYPE]-[BRANCH_CODE]-[YEAR]-[SEQUENCE]
   * e.g. KACHA-BR01-2026-0001 or INV-BR01-2026-0001
   */
  static generateInvoiceNo(type = 'INV', branchCode = 'HO', sequence = 1) {
    const year = new Date().getFullYear();
    const paddedSeq = String(sequence).padStart(5, '0');
    return `${type}/${branchCode}/${year}/${paddedSeq}`;
  }
}

module.exports = BarcodeGenerator;
