const error = new Error("This is a test error message");
console.log("Original Error:", error);
console.log("JSON stringified:", JSON.stringify(error));
console.log("typeof error:", typeof error);
console.log("'message' in error:", "message" in error);
console.log("error.message:", error.message);

const result = { error };
console.log("Result:", result);
console.log("Result JSON stringified:", JSON.stringify(result));
