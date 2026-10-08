class apiResponseHandler {
  constructor(statusCode, message = "success", data) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode;
  }
}
export default apiResponseHandler;
