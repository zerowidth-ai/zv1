/**
 * Simple test file for ErrorManager
 * Run with: node test-error-manager.js
 */

import ErrorManager from '../src/classes/ErrorManager';

// Test basic functionality
console.log('Testing ErrorManager...\n');

// Test 1: Basic error manager without callbacks
console.log('Test 1: Basic error manager');
const basicManager = new ErrorManager({
  executionId: 'test-123',
  verbose: false
});

try {
  basicManager.throwNodeError('node-1', 'test-node', 'Test node error');
} catch (error) {
  console.log('✅ Caught error:', error.message);
  console.log('   Error type:', error.errorType);
  console.log('   Execution ID:', error.executionId);
  console.log('   Details:', error.errorDetails);
}

// Test 2: Error manager with callback
console.log('\nTest 2: Error manager with callback');
const callbackManager = new ErrorManager({
  executionId: 'test-456',
  verbose: true,
  onError: (errorEvent) => {
    console.log('📞 Callback received:');
    console.log('   Type:', errorEvent.type);
    console.log('   Message:', errorEvent.errorDetails.message);
    console.log('   Node ID:', errorEvent.errorDetails.nodeId);
    console.log('   Severity:', errorEvent.errorDetails.severity);
  }
});

try {
  callbackManager.throwNodeError('node-2', 'callback-test', 'Test callback error');
} catch (error) {
  console.log('✅ Caught error after callback:', error.message);
}

// Test 3: Different error types
console.log('\nTest 3: Different error types');
const typeManager = new ErrorManager({
  executionId: 'test-789',
  verbose: false
});

const errorTypes = [
  () => typeManager.throwFlowError('Flow validation failed'),
  () => typeManager.throwSystemError('System resource exhausted'),
  () => typeManager.throwValidationError('input', 'Invalid input format'),
  () => typeManager.throwTimeoutError('Custom timeout message'),
  () => typeManager.throwResourceError('memory', 'Out of memory')
];

errorTypes.forEach((errorFn, index) => {
  try {
    errorFn();
  } catch (error) {
    console.log(`✅ Error ${index + 1}: ${error.errorType} - ${error.message}`);
    console.log(`   Severity: ${error.errorDetails.severity}`);
  }
});

// Test 4: Error event without throwing
console.log('\nTest 4: Error event without throwing');
const eventManager = new ErrorManager({
  executionId: 'test-event',
  verbose: true,
  onError: (errorEvent) => {
    console.log('📞 Event callback (no throw):', errorEvent.type);
  }
});

const errorEvent = eventManager.createErrorEventOnly('node', {
  nodeId: 'node-3',
  nodeType: 'event-test',
  message: 'This error event was created without throwing'
});

console.log('✅ Created error event:', errorEvent.type);
console.log('   No error was thrown');

// Test 5: Recoverable vs fatal errors
console.log('\nTest 5: Error recoverability');
const recoverableManager = new ErrorManager({
  executionId: 'test-recover'
});

const testTypes = ['node', 'flow', 'system', 'validation', 'timeout'];
testTypes.forEach(type => {
  const isRecoverable = recoverableManager.isRecoverableError(type);
  console.log(`   ${type}: ${isRecoverable ? '🔄 Recoverable' : '💀 Fatal'}`);
});

console.log('\n✅ All tests completed!'); 