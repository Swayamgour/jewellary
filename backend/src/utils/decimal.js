/**
 * Decimal Precision Arithmetic Helper
 * Handles financial and weight rounding safely to avoid floating-point drift.
 */
class DecimalUtil {
  /**
   * Round a number to fixed decimal places safely
   * @param {number|string} value
   * @param {number} decimals
   * @returns {number}
   */
  static round(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(Number(value))) {
      return 0;
    }
    const factor = Math.pow(10, decimals);
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }

  /**
   * Round weight (typically 3 decimal places in jewellery e.g. 10.450 grams)
   * @param {number|string} weight
   * @returns {number}
   */
  static roundWeight(weight) {
    return this.round(weight, 3);
  }

  /**
   * Round currency/amount (2 decimal places)
   * @param {number|string} amount
   * @returns {number}
   */
  static roundCurrency(amount) {
    return this.round(amount, 2);
  }

  /**
   * Safe addition
   */
  static add(...numbers) {
    return numbers.reduce((acc, curr) => this.roundCurrency(acc + (Number(curr) || 0)), 0);
  }

  /**
   * Safe subtraction
   */
  static subtract(a, b) {
    return this.roundCurrency((Number(a) || 0) - (Number(b) || 0));
  }

  /**
   * Safe multiplication
   */
  static multiply(a, b, decimals = 2) {
    return this.round((Number(a) || 0) * (Number(b) || 0), decimals);
  }

  /**
   * Safe division
   */
  static divide(a, b, decimals = 2) {
    if (!b || Number(b) === 0) return 0;
    return this.round((Number(a) || 0) / Number(b), decimals);
  }

  /**
   * Calculate percentage
   */
  static percentage(value, percent) {
    return this.roundCurrency(((Number(value) || 0) * (Number(percent) || 0)) / 100);
  }

  /**
   * Round to nearest integer (Standard Indian GST / Invoice Round-off)
   * Returns { roundedAmount, roundOffDiff }
   */
  static roundToRupee(amount) {
    const original = this.roundCurrency(amount);
    const rounded = Math.round(original);
    const diff = this.roundCurrency(rounded - original);
    return {
      roundedAmount: rounded,
      roundOffDiff: diff
    };
  }
}

module.exports = DecimalUtil;
