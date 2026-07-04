export default async ({inputs, settings, config}) => {

  const jsonString = inputs.json || '';
  let value;
  let error = '';
  let success = false;
  
  try {
    value = JSON.parse(jsonString);
    success = true;
  } catch (e) {
    error = e.message || 'Invalid JSON';
    
    // Try to parse the default value
    try {
      value = JSON.parse(settings.default_value || '{}');
    } catch (defaultError) {
      value = {};
    }
  }
  
  return { value, error, success };
}; 