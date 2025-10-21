export default async ({inputs, settings, config, nodeConfig}) => {
  try {
    const format = inputs.format || 'iso';
    
    const now = new Date();
    const unixTimestamp = Math.floor(now.getTime() / 1000);
    const unixTimestampMs = now.getTime();
    const isoString = now.toISOString();
    
    let timestamp;
    
    // Check for preset format keywords first
    switch (format) {
      case 'iso':
        timestamp = isoString;
        break;
        
      case 'unix':
        timestamp = unixTimestamp.toString();
        break;
        
      case 'unix_ms':
        timestamp = unixTimestampMs.toString();
        break;
        
      case 'rfc2822':
        timestamp = now.toUTCString();
        break;
        
      default:
        // If not a preset keyword, treat as custom format string
        timestamp = formatCustomTimestamp(now, format);
    }
    
    return {
      timestamp: timestamp,
      unix_timestamp: unixTimestamp,
      unix_timestamp_ms: unixTimestampMs,
      iso_string: isoString
    };
    
  } catch (error) {
    throw new Error(`Timestamp error: ${error.message}`);
  }
};

// Helper function for custom format formatting
function formatCustomTimestamp(date, format) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  
  return format
    .replace(/YYYY/g, year)
    .replace(/MM/g, month)
    .replace(/DD/g, day)
    .replace(/HH/g, hours)
    .replace(/mm/g, minutes)
    .replace(/ss/g, seconds)
    .replace(/SSS/g, milliseconds)
    .replace(/YY/g, String(year).slice(-2))
    .replace(/M/g, String(date.getMonth() + 1))
    .replace(/D/g, String(date.getDate()))
    .replace(/H/g, String(date.getHours()))
    .replace(/m/g, String(date.getMinutes()))
    .replace(/s/g, String(date.getSeconds()));
}
