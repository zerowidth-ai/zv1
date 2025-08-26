import axios from 'axios';

export default async ({inputs, settings, config}) => {

  const url = inputs.url;
  const method = (inputs.method || 'GET').toUpperCase();
  const headers = inputs.headers || {};
  const query = inputs.query || {};
  const body = inputs.body;
  const timeout = settings.timeout || 10000;
  const followRedirects = settings.follow_redirects !== false;

  let fullUrl = url;
  // Append query params if provided
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams(query).toString();
    fullUrl += (url.includes('?') ? '&' : '?') + params;
  }

  try {
    const response = await axios({
      url: fullUrl,
      method,
      headers,
      data: body,
      timeout,
      maxRedirects: followRedirects ? 5 : 0,
      validateStatus: () => true // Always resolve, never throw for HTTP errors
    });

    let parsedBody = response.data;
    const contentType = response.headers['content-type'] || '';
    // If content-type is JSON and data is a string, try to parse
    if (contentType.includes('application/json') && typeof parsedBody === 'string') {
      try {
        parsedBody = JSON.parse(parsedBody);
      } catch (e) {
        // Not valid JSON, keep as string
      }
    }

    let error = undefined;
    if (response.status >= 400) {
      error = `HTTP error: ${response.status}`;
    }

    return {
      status: response.status,
      headers: response.headers,
      body: parsedBody,
      ...(error ? { error } : {})
    };
  } catch (err) {
    return {
      status: err.response ? err.response.status : null,
      headers: err.response ? err.response.headers : {},
      body: err.response ? err.response.data : null,
      error: err.message
    };
  }
}; 