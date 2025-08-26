export default async ({inputs, settings, config}) => {

  const dateInput = inputs.date;
  const format = settings.format || 'YYYY-MM-DD';
  const timezone = settings.timezone || 'UTC';
  
  let dateObj;
  let formatted = '';
  let timestamp = 0;
  let iso = '';
  let error = '';
  let success = false;
  
  try {
    // Parse the input date
    if (dateInput instanceof Date) {
      dateObj = dateInput;
    } else if (typeof dateInput === 'number') {
      dateObj = new Date(dateInput);
    } else if (typeof dateInput === 'string') {
      dateObj = new Date(dateInput);
    } else {
      dateObj = new Date();
    }
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      throw new Error('Invalid date');
    }
    
    // Get timestamp and ISO string
    timestamp = dateObj.getTime();
    iso = dateObj.toISOString();
    
    // Format the date according to the specified format
    formatted = formatDate(dateObj, format, timezone);
    
    success = true;
  } catch (e) {
    error = e.message || 'Failed to format date';
    formatted = '';
    timestamp = 0;
    iso = '';
  }
  
  return { formatted, timestamp, iso, error, success };
};

// Helper function to format a date according to a format string
function formatDate(date, format, timezone) {
  // Adjust for timezone if needed
  let adjustedDate = new Date(date);
  
  if (timezone && timezone.toLowerCase() === 'utc') {
    // For UTC, use the UTC methods directly
    return format
      .replace(/YYYY/g, adjustedDate.getUTCFullYear())
      .replace(/MM/g, padZero(adjustedDate.getUTCMonth() + 1))
      .replace(/DD/g, padZero(adjustedDate.getUTCDate()))
      .replace(/HH/g, padZero(adjustedDate.getUTCHours()))
      .replace(/mm/g, padZero(adjustedDate.getUTCMinutes()))
      .replace(/ss/g, padZero(adjustedDate.getUTCSeconds()))
      .replace(/SSS/g, padZero(adjustedDate.getUTCMilliseconds(), 3));
  }
  
  // For other timezones, use the Intl.DateTimeFormat approach
  if (timezone && timezone.toLowerCase() !== 'utc') {
    try {
      // This is a simplified approach - in a real implementation,
      // you would use a library like moment-timezone or date-fns-tz
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const parts = formatter.formatToParts(date);
      const partValues = {};
      
      parts.forEach(part => {
        partValues[part.type] = part.value;
      });
      
      adjustedDate = new Date(
        `${partValues.year}-${partValues.month}-${partValues.day}T` +
        `${partValues.hour}:${partValues.minute}:${partValues.second}`
      );
    } catch (e) {
      // If timezone adjustment fails, use the original date
      console.error('Timezone adjustment failed:', e);
    }
  }
  
  // Replace format tokens with date values
  return format
    .replace(/YYYY/g, adjustedDate.getFullYear())
    .replace(/MM/g, padZero(adjustedDate.getMonth() + 1))
    .replace(/DD/g, padZero(adjustedDate.getDate()))
    .replace(/HH/g, padZero(adjustedDate.getHours()))
    .replace(/mm/g, padZero(adjustedDate.getMinutes()))
    .replace(/ss/g, padZero(adjustedDate.getSeconds()))
    .replace(/SSS/g, padZero(adjustedDate.getMilliseconds(), 3));
}

// Helper function to pad a number with leading zeros
function padZero(num, length = 2) {
  return String(num).padStart(length, '0');
} 