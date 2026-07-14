/**
 * Helper supaya semua response sukses punya format seragam:
 * { success: true, message, data }
 */
class ApiResponse {
  constructor(statusCode, data = null, message = 'Success', meta = null) {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.meta = meta;
  }

  send(res) {
    const response = {
      success: this.success,
      message: this.message,
      data: this.data,
    };

    if (this.meta) {
      response.meta = this.meta;
    }

    return res.status(this.statusCode).json(response);
  }
}

module.exports = ApiResponse;
