import zv1 from '../../src/index.js';

async function runBasicFlow() {
  try {
    console.log('🚀 Running Error Handling Example');
    console.log('================================');
    
    // Create engine instance by passing the flow file path
    const engine = await zv1.create('./flow.json', {
      onError: (error) => {
        console.log('🚨 Error:', error);
      }
    });
    
    // Input data to transform
    const inputData = {
      message: "This is my error message!"
    };
    
    console.log('📥 Input:', inputData);
    
    // Run the flow
    const result = await engine.run(inputData);
    
    console.log('📤 Output:', result.outputs);
    console.log('⏱️  Execution time:', result.timeline.reduce((total, entry) => total + entry.durationMs, 0), 'ms');
    console.log('✅ Status:', result.message);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the example
runBasicFlow();