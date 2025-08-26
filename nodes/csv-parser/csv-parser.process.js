export default async ({inputs, settings, config}) => {

  const csvString = inputs.csv || '';
  const delimiter = settings.delimiter || ',';
  const hasHeaders = settings.has_headers !== false;
  const trimValues = settings.trim_values !== false;
  const skipEmptyLines = settings.skip_empty_lines !== false;
  
  let data = [];
  let headers = [];
  let error = '';
  let success = false;
  
  try {
    // Split into lines
    let lines = csvString.split(/\r?\n/);
    
    // Skip empty lines if configured
    if (skipEmptyLines) {
      lines = lines.filter(line => line.trim() !== '');
    }
    
    if (lines.length === 0) {
      return { data: [], headers: [], error: '', success: true };
    }
    
    // Parse headers if configured
    if (hasHeaders && lines.length > 0) {
      headers = parseCSVLine(lines[0], delimiter, trimValues);
      lines = lines.slice(1);
    }
    
    // Parse data rows
    if (hasHeaders) {
      // Parse as objects with header keys
      data = lines.map(line => {
        const values = parseCSVLine(line, delimiter, trimValues);
        const row = {};
        
        // Map values to header keys
        headers.forEach((header, index) => {
          if (index < values.length) {
            row[header] = values[index];
          }
        });
        
        return row;
      });
    } else {
      // Parse as arrays of values
      data = lines.map(line => parseCSVLine(line, delimiter, trimValues));
    }
    
    success = true;
  } catch (e) {
    error = e.message || 'Failed to parse CSV';
    data = [];
    headers = [];
  }
  
  return { data, headers, error, success };
};

// Helper function to parse a CSV line respecting quotes
function parseCSVLine(line, delimiter, trim) {
  const values = [];
  let currentValue = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = i < line.length - 1 ? line[i + 1] : '';
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote inside quotes
        currentValue += '"';
        i++; // Skip the next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // End of value
      values.push(trim ? currentValue.trim() : currentValue);
      currentValue = '';
    } else {
      // Add character to current value
      currentValue += char;
    }
  }
  
  // Add the last value
  values.push(trim ? currentValue.trim() : currentValue);
  
  return values;
} 