export function extractApiKey(req) {
  const header = req.headers?.['x-api-key'];
  if (Array.isArray(header)) return header[0] || '';
  if (typeof header === 'string') return header;

  const authHeader = req.headers?.authorization;
  if (Array.isArray(authHeader)) return authHeader[0]?.replace(/^Bearer\s+/i, '') || '';
  if (typeof authHeader === 'string') return authHeader.replace(/^Bearer\s+/i, '');

  return '';
}

export function isAuthorized(req, expectedKey) {
  if (!expectedKey) return true;
  const provided = extractApiKey(req);
  return Boolean(provided) && provided === expectedKey;
}
