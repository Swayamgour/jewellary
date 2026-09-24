class ApiResponse {
  static success(res, message = 'Success', data = {}, statusCode = 200, pagination = null) {
    const response = {
      success: true,
      message,
      data
    };

    if (pagination) {
      response.pagination = pagination;
    }

    return res.status(statusCode).json(response);
  }

  static created(res, message = 'Resource created successfully', data = {}) {
    return this.success(res, message, data, 201);
  }

  static error(res, message = 'An error occurred', statusCode = 500, code = 'INTERNAL_ERROR', details = []) {
    return res.status(statusCode).json({
      success: false,
      message,
      error: {
        code,
        details
      }
    });
  }
}

module.exports = ApiResponse;
