/**
 * ErrorManager - Centralized error handling utility for the FlowEngine
 * 
 * This utility handles:
 * - Creating consistent error structures
 * - Invoking onError callbacks
 * - Enriching errors with execution context
 * - Managing error types and severity levels
 */

export default class ErrorManager {
  constructor(options = {}) {
    this.onError = options.onError || null;
    this.executionId = options.executionId;
    this.executionContext = options.executionContext || {};
  }

  /**
   * Main method to throw errors with full context
   * @param {string} errorType - Type of error ('node', 'flow', 'system', etc.)
   * @param {Object} errorDetails - Specific details about the error
   * @param {Error} originalError - Original error object if one exists
   */
  throwError(errorType, errorDetails, originalError = null) {
    const errorEvent = this.createErrorEvent(errorType, errorDetails, originalError);
    
    // Invoke callback if provided
    if (this.onError) {
      try {
        this.onError(errorEvent);
      } catch (callbackError) {
        // Don't let callback errors interfere with main error
        console.warn('Error in onError callback:', callbackError);
      }
    }
    
    // Create and throw the enriched error
    const enrichedError = this.createEnrichedError(errorEvent);
    throw enrichedError;
  }

  /**
   * Create the error event structure for callbacks
   * @param {string} errorType - Type of error
   * @param {Object} errorDetails - Error details
   * @param {Error} originalError - Original error
   * @returns {Object} Formatted error event
   */
  createErrorEvent(errorType, errorDetails, originalError) {
    const baseEvent = {
      event: 'error',
      type: errorType,
      error: originalError || new Error(errorDetails.message || 'Unknown error'),
      errorDetails: {
        ...errorDetails,
        timestamp: Date.now(),
        executionId: this.executionId
      },
      executionId: this.executionId
    };

    baseEvent.context = {
      ...this.executionContext,
      // Will include timeline, nodeEvents, etc. when available
    };

    return baseEvent;
  }

  /**
   * Create the actual Error object to throw
   * @param {Object} errorEvent - The error event structure
   * @returns {Error} Enriched error object
   */
  createEnrichedError(errorEvent) {
    const { error, errorDetails, type } = errorEvent;
    
    // If we have an original error, enhance it
    if (error instanceof Error) {
      // Add custom properties
      error.errorType = type;
      error.errorDetails = errorDetails;
      error.executionId = this.executionId;
      
      // Enhance the message if needed
      if (errorDetails.message && error.message !== errorDetails.message) {
        error.originalMessage = error.message;
        error.message = errorDetails.message;
      }

      error.context = this.executionContext;
      
      return error;
    }
    
    // Create new error if none provided
    const newError = new Error(errorDetails.message || 'Flow execution error');
    newError.errorType = type;
    newError.errorDetails = errorDetails;
    newError.executionId = this.executionId;
    newError.context = this.executionContext;
    
    return newError;
  }

  /**
   * Update execution context (called during flow execution)
   * @param {Object} context - New execution context
   */
  updateExecutionContext(context) {
    this.executionContext = {
      ...this.executionContext,
      ...context
    };
  }

  // Convenience methods for common error types
  /**
   * Throw a node-specific error
   * @param {string} nodeId - ID of the node that failed
   * @param {string} nodeType - Type of the node
   * @param {string} message - Error message
   * @param {Error} originalError - Original error if one exists
   */
  throwNodeError(nodeId, nodeType, message, originalError = null) {
    return this.throwError('node', {
      nodeId,
      nodeType,
      message,
      severity: 'recoverable' // Most node errors are recoverable
    }, originalError);
  }

  /**
   * Throw a flow-level error
   * @param {string} message - Error message
   * @param {Error} originalError - Original error if one exists
   */
  throwFlowError(message, originalError = null) {
    return this.throwError('flow', {
      message,
      severity: 'fatal' // Flow errors are usually fatal
    }, originalError);
  }

  /**
   * Throw a system-level error
   * @param {string} message - Error message
   * @param {Error} originalError - Original error if one exists
   */
  throwSystemError(message, originalError = null) {
    return this.throwError('system', {
      message,
      severity: 'fatal'
    }, originalError);
  }

  /**
   * Throw a validation error
   * @param {string} field - Field that failed validation
   * @param {string} message - Validation error message
   * @param {Error} originalError - Original error if one exists
   */
  throwValidationError(field, message, originalError = null) {
    return this.throwError('validation', {
      field,
      message,
      severity: 'fatal'
    }, originalError);
  }

  /**
   * Throw a timeout error
   * @param {string} message - Timeout error message
   */
  throwTimeoutError(message = 'Flow execution timed out') {
    return this.throwError('timeout', {
      message,
      severity: 'fatal',
      timeout: this.executionContext.timeout
    });
  }

  /**
   * Throw a resource exhaustion error
   * @param {string} resourceType - Type of resource that was exhausted
   * @param {string} message - Error message
   */
  throwResourceError(resourceType, message) {
    return this.throwError('resource', {
      resourceType,
      message,
      severity: 'fatal'
    });
  }

  /**
   * Create an error event without throwing (useful for logging/monitoring)
   * @param {string} errorType - Type of error
   * @param {Object} errorDetails - Error details
   * @param {Error} originalError - Original error if one exists
   * @returns {Object} Error event object
   */
  createErrorEventOnly(errorType, errorDetails, originalError = null) {
    const errorEvent = this.createErrorEvent(errorType, errorDetails, originalError);
    
    // Invoke callback if provided
    if (this.onError) {
      try {
        this.onError(errorEvent);
      } catch (callbackError) {
        console.warn('Error in onError callback:', callbackError);
      }
    }
    
    return errorEvent;
  }

  /**
   * Check if an error is recoverable based on its type
   * @param {string} errorType - Type of error
   * @returns {boolean} True if error is recoverable
   */
  isRecoverableError(errorType) {
    const recoverableTypes = ['node', 'validation'];
    const fatalTypes = ['flow', 'system', 'timeout', 'resource'];
    
    if (recoverableTypes.includes(errorType)) return true;
    if (fatalTypes.includes(errorType)) return false;
    
    // Default to recoverable for unknown types
    return true;
  }
}