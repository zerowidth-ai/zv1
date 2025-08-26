export default async ({inputs, settings, config}) => {

  const value = inputs.value;
  let json = '';
  let error = '';
  let success = false;
  
  try {
    const pretty = settings.pretty === true;
    const indent = pretty ? Number(settings.indent) || 2 : undefined;
    
    json = JSON.stringify(value, null, indent);
    success = true;
  } catch (e) {
    error = e.message || 'Failed to stringify value';
    json = '{}';
  }
  
  return { json, error, success };
}; 