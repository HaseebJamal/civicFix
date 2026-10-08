class apiErrorHandler extends Error {
  constructor(
    statusCode,
    message = "unable to connect with server",
    errors = [],
    stack = "",
  ) {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.message = message;
    this.errors = errors;
    this.stack = stack || this.stack;
  }
}
export default apiErrorHandler;
