export default async ({inputs, settings, config, nodeConfig}) => {
  try {
    const startTime = inputs.start_time;
    const endTime = inputs.end_time || new Date().toISOString();
    const outputUnit = inputs.output_unit || 'seconds';
    
    // Parse timestamps
    const startDate = parseTimestamp(startTime);
    const endDate = parseTimestamp(endTime);
    
    if (!startDate || !endDate) {
      throw new Error("Invalid timestamp format. Use ISO strings, Unix timestamps, or parseable date formats");
    }
    
    // Calculate duration in milliseconds
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationSeconds = durationMs / 1000;
    const durationMinutes = durationSeconds / 60;
    const durationHours = durationMinutes / 60;
    const durationDays = durationHours / 24;
    
    // Get duration in requested unit
    let duration;
    switch (outputUnit) {
      case 'seconds':
        duration = Math.round(durationSeconds * 100) / 100; // Round to 2 decimal places
        break;
      case 'minutes':
        duration = Math.round(durationMinutes * 100) / 100;
        break;
      case 'hours':
        duration = Math.round(durationHours * 100) / 100;
        break;
      case 'days':
        duration = Math.round(durationDays * 100) / 100;
        break;
      default:
        duration = Math.round(durationSeconds * 100) / 100;
    }
    
    // Generate human readable format
    const humanReadable = formatHumanReadable(durationMs);
    
    return {
      duration: duration,
      duration_seconds: Math.round(durationSeconds * 100) / 100,
      duration_minutes: Math.round(durationMinutes * 100) / 100,
      duration_hours: Math.round(durationHours * 100) / 100,
      duration_days: Math.round(durationDays * 100) / 100,
      human_readable: humanReadable
    };
    
  } catch (error) {
    throw new Error(`Duration Calculator error: ${error.message}`);
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

// Helper function to format duration in human readable format
function formatHumanReadable(durationMs) {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;
  
  const parts = [];
  
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (remainingHours > 0) parts.push(`${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`);
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`);
  
  return parts.join(' ');
}
