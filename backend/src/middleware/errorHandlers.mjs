export function notFoundHandler(_request, response) {
  response.status(404).json({ success: false, itinerary: null, error: { message: "Route not found." } });
}

export function errorHandler(error, _request, response, _next) {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  if (error instanceof SyntaxError && "body" in error) {
    return response.status(400).json({ success: false, itinerary: null, error: { message: "The request body must be valid JSON.", requestId } });
  }
  if (error?.name === "MongoServerSelectionError" || /buffering timed out|ECONNREFUSED.*27017/i.test(error?.message || "")) {
    console.error(`[${requestId}] Database unavailable`, error.message);
    return response.status(503).json({ success: false, error: { code: "DATABASE_UNAVAILABLE", message: "Account services are temporarily unavailable. Please ensure MongoDB is running and try again.", requestId } });
  }
  if (error?.code === 11000) {
    return response.status(409).json({ success: false, error: { code: "DUPLICATE_EMAIL", message: "An account with this email already exists.", requestId } });
  }
  console.error(`[${requestId}] Unhandled API error`, error);
  return response.status(500).json({ success: false, itinerary: null, error: { message: "The server encountered an unexpected error. Check the server log using the request reference.", requestId } });
}
