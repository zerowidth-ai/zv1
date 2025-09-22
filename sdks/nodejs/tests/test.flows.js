import fs from "fs";
import path from "path";
import assert from "assert";
import Ajv from "ajv";

// utils/paths.js
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export function getFilename(metaUrl) {
  return fileURLToPath(metaUrl);
}

export function getDirname(metaUrl) {
  return dirname(getFilename(metaUrl));
}

// import the zv1 engine locally
import zv1 from "../src/index.js";

async function runFlowTest(testFile) {
  const testPath = path.join(getDirname(import.meta.url), "./flows", testFile);
  const testData = JSON.parse(fs.readFileSync(testPath, "utf-8"));

  const { flow, inputs, expected, expectedSchema, expectedError } = testData;

  console.log(`[INFO] Testing flow: ${testFile} with inputs: ${JSON.stringify(inputs)}`);
  const engine = await zv1.create(flow, { debug: true }); // Enable debug mode
  
  try {
    const result = await engine.run(inputs);
    console.log(`  [RESULT] ${JSON.stringify(result)}`);
    
    // If we expected an error but got success, that's a failure
    if (expectedError) {
      console.error(`  [FAIL] Expected error but flow succeeded for ${testFile}`);
      throw new Error(`Expected error but flow succeeded`);
    }
    
    if(expected){
      assert.deepStrictEqual(result, expected, `  [FAIL] Output mismatch for ${testFile}`);
    } else if(expectedSchema){
      // compare the result with the expected schema to see if it matches the overall shape but not the values
      const ajv = new Ajv();
      const validate = ajv.compile(expectedSchema);
      const valid = validate(result);
      if (!valid) {
        console.error(`  [FAIL] Output mismatch for ${testFile}`);
        console.error(`    Error: ${JSON.stringify(validate.errors, null, 2)}`);
        throw new Error(`  [FAIL] Output mismatch for ${testFile}`);
      }
    }
    console.log(`  [PASS] ${testFile}`);
  } catch (err) {
    // If we expected an error, check if it matches our expectations
    if (expectedError) {
      console.log(`  [EXPECTED ERROR] ${testFile}`);
      console.log(`    Error Type: ${err.errorType || 'Unknown'}`);
      console.log(`    Error Message: ${err.message}`);
      
      // Validate error details if specified
      if (expectedError.type && err.errorType !== expectedError.type) {
        console.error(`    [FAIL] Expected error type '${expectedError.type}' but got '${err.errorType}'`);
        throw new Error(`Error type mismatch: expected '${expectedError.type}' but got '${err.errorType}'`);
      }
      
      if (expectedError.message && !err.message.includes(expectedError.message)) {
        console.error(`    [FAIL] Expected error message to contain '${expectedError.message}' but got '${err.message}'`);
        throw new Error(`Error message mismatch: expected '${expectedError.message}' but got '${err.message}'`);
      }
      
      if (expectedError.nodeId && err.errorDetails?.nodeId !== expectedError.nodeId) {
        console.error(`    [FAIL] Expected error node ID '${expectedError.nodeId}' but got '${err.errorDetails?.nodeId}'`);
        throw new Error(`Error node ID mismatch: expected '${expectedError.nodeId}' but got '${err.errorDetails?.nodeId}'`);
      }
      
      if (expectedError.nodeType && err.errorDetails?.nodeType !== expectedError.nodeType) {
        console.error(`    [FAIL] Expected error node type '${expectedError.nodeType}' but got '${err.errorDetails?.nodeType}'`);
        throw new Error(`Error node type mismatch: expected '${expectedError.nodeType}' but got '${err.errorDetails?.nodeType}'`);
      }
      
      console.log(`    [PASS] Error matches expectations`);
      return; // Success for expected errors
    }
    
    // If we didn't expect an error, this is a failure
    console.log(err);
    console.error(`  [FAIL] ${testFile}`);
    console.error(`    Error: ${err.message}`);
    console.error(`    Stack Trace: ${err.stack}`);
    console.error(`    Flow: ${JSON.stringify(flow, null, 2)}`);
    console.error(`    Expected Output: ${JSON.stringify(expected, null, 2)}`);
    console.error(`    Actual Output: ${JSON.stringify(err.actual, null, 2)}`);
    throw err;
  }
}

async function runAllTests() {
  const testDir = path.join(getDirname(import.meta.url), "./flows");
  const testFiles = fs.readdirSync(testDir).filter((file) => file.endsWith(".json"));

  let passed = 0;
  let failed = 0;

  for (const testFile of testFiles) {
    try {
      await runFlowTest(testFile);
      passed++;
    } catch (error) {
      console.error(`  [FAIL] ${error}`);
      throw error;
      failed++;
    }
  }

  console.log(`\n[INFO] Flow Test Suite Completed: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("[ERROR] Flow test suite encountered an unexpected error.");
  console.error(err.stack);
  process.exit(1);
});
