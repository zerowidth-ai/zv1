export default async ({inputs, settings, config}) => {

  const data = inputs.data || [];
  const providedHeaders = inputs.headers || [];
  const delimiter = settings.delimiter || ',';
  const includeHeaders = settings.include_headers !== false;
  const quoteStrings = settings.quote_strings !== false;
  const newline = settings.newline || '\n';
  
  let csv = '';
  let error = '';
  let success = false;
  
  try {
    if (!Array.isArray(data)) {
      throw new Error('Input data must be an array');
    }
    
    if (data.length === 0) {
      return { csv: '', error: '', success: true };
    }
    
    // Determine if data is an array of objects or an array of arrays
    const isArrayOfObjects = data[0] !== null && typeof data[0] === 'object' && !Array.isArray(data[0]);
    
    // Extract or use provided headers
    let headers = [];
    if (isArrayOfObjects) {
      if (providedHeaders.length > 0) {
        headers = providedHeaders;
      } else {
        // Extract headers from all objects to ensure we capture all possible keys
        const keySet = new Set();
        data.forEach(obj => {
          Object.keys(obj).forEach(key => keySet.add(key));
        });
        headers = Array.from(keySet);
      }
    } else if (providedHeaders.length > 0) {
      headers = providedHeaders;
    }
    
    // Generate CSV rows
    const rows = [];
    
    // Add headers row if needed
    if (includeHeaders && headers.length > 0) {
      rows.push(headers.map(header => formatValue(header, quoteStrings)).join(delimiter));
    }
    
    // Add data rows
    if (isArrayOfObjects) {
      // Convert objects to arrays based on headers
      data.forEach(obj => {
        const row = headers.map(header => formatValue(obj[header], quoteStrings));
        rows.push(row.join(delimiter));
      });
    } else {
      // Data is already in array format
      data.forEach(row => {
        if (Array.isArray(row)) {
          rows.push(row.map(value => formatValue(value, quoteStrings)).join(delimiter));
        } else {
          rows.push(formatValue(row, quoteStrings));
        }
      });
    }
    
    // Join rows with newline character
    csv = rows.join(newline);
    success = true;
  } catch (e) {
    error = e.message || 'Failed to convert to CSV';
    csv = '';
  }
  
  return { csv, error, success };
};

// Helper function to format a value for CSV
function formatValue(value, quoteStrings) {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // Check if the value needs quoting
  const needsQuoting = quoteStrings && 
    (typeof value === 'string' || 
     stringValue.includes(',') || 
     stringValue.includes('"') || 
     stringValue.includes('\n'));
  
  if (needsQuoting) {
    // Escape quotes by doubling them
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
} 