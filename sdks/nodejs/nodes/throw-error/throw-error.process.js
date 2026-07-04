export default async ({inputs, settings, config}) => {

  const message = inputs.message || "No error message provided";
  const context = inputs.context || "";
  const errorType = inputs.errorType || "CustomError";

  // Construct the full error message
  let fullMessage = message;
  if (context) {
    fullMessage += `\n\nContext: ${context}`;
  }

  // Create a custom error with the specified type
  const error = new Error(fullMessage);
  error.name = errorType;
  
  // Add context as a property for debugging
  if (context) {
    error.context = context;
  }

  // Throw the error - this will be caught by the engine
  throw error;
}; 