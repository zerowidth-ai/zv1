export default async ({inputs, settings, config, nodeConfig}) => {
  try {
    const baseTime = inputs.base_time || new Date().toISOString();
    const amount = inputs.amount;
    const unit = inputs.unit;
    const outputFormat = inputs.output_format || 'iso';
    
    if (amount === undefined || amount === null) {
      throw new Error("Amount is required");
    }
    
    if (!unit) {
      throw new Error("Unit is required");
    }
    
    // Parse base timestamp
    const baseDate = parseTimestamp(baseTime);
    if (!baseDate) {
      throw new Error("Invalid base timestamp format");
    }
    
    // Create new date with added/subtracted time
    const resultDate = addTime(baseDate, amount, unit);
    
    // Generate outputs in different formats
    const isoString = resultDate.toISOString();
    const unixTimestamp = Math.floor(resultDate.getTime() / 1000);
    const unixTimestampMs = resultDate.getTime();
    
    // Format result based on requested output format
    let resultTime;
    switch (outputFormat) {
      case 'iso':
        resultTime = isoString;
        break;
      case 'unix':
        resultTime = unixTimestamp.toString();
        break;
      case 'unix_ms':
        resultTime = unixTimestampMs.toString();
        break;
      case 'rfc2822':
        resultTime = resultDate.toUTCString();
        break;
      default:
        resultTime = isoString;
    }
    
    return {
      result_time: resultTime,
      iso_string: isoString,
      unix_timestamp: unixTimestamp,
      unix_timestamp_ms: unixTimestampMs
    };
    
  } catch (error) {
    throw new Error(`Time Adder error: ${error.message}`);
  }
};

// Helper function to parse various timestamp formats
function parseTimestamp(timestamp) {
  if (!timestamp) return null;
  
  // Try parsing as Unix timestamp (number)
  if (!isNaN(timestamp) && !isNaN(parseFloat(timestamp))) {
    const num = parseFloat(timestamp);
    // If it's a large number, assume it's milliseconds, otherwise seconds
    const date = num > 1000000000000 ? new Date(num) : new Date(num * 1000);
    if (!isNaN(date.getTime())) return date;
  }
  
  // Try parsing as ISO string or other date format
  const date = new Date(timestamp);
  if (!isNaN(date.getTime())) return date;
  
  return null;
}

// Helper function to add/subtract time
function addTime(date, amount, unit) {
  const result = new Date(date);
  
  switch (unit) {
    case 'seconds':
      result.setSeconds(result.getSeconds() + amount);
      break;
    case 'minutes':
      result.setMinutes(result.getMinutes() + amount);
      break;
    case 'hours':
      result.setHours(result.getHours() + amount);
      break;
    case 'days':
      result.setDate(result.getDate() + amount);
      break;
    case 'weeks':
      result.setDate(result.getDate() + (amount * 7));
      break;
    case 'months':
      result.setMonth(result.getMonth() + amount);
      break;
    case 'years':
      result.setFullYear(result.getFullYear() + amount);
      break;
    default:
      throw new Error(`Unsupported unit: ${unit}`);
  }
  
  return result;
}
