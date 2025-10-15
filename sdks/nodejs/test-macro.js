import zv1 from './src/index.js';

// Test the new macro architecture
const testFlow = {
  "nodes": [
    {
      "id": "input1",
      "type": "input-data",
      "settings": {
        "key": "text"
      }
    },
    {
      "id": "extract1",
      "type": "extract-emails",
      "settings": {}
    },
    {
      "id": "output1",
      "type": "output-data",
      "settings": {
        "key": "emails"
      }
    }
  ],
  "links": [
    {
      "from": { "node_id": "input1", "port_name": "value" },
      "to": { "node_id": "extract1", "port_name": "text" }
    },
    {
      "from": { "node_id": "extract1", "port_name": "emails" },
      "to": { "node_id": "output1", "port_name": "value" }
    }
  ]
};

async function testMacro() {
  try {
    console.log('Testing macro architecture...');
    
    const engine = new zv1(testFlow, {
      debug: true
    });
    
    await engine.initialize();
    
    const result = await engine.run({
      text: "Contact us at support@example.com or sales@company.com for more information."
    });
    
    console.log('Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testMacro();
