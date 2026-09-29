/**
 * Turns an RTK-Query / fetch error into one readable line.
 * Backend errors look like { success:false, message, error:{ code, details:[{field,message}] } }.
 */
export const getErrorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
  if (!err) return fallback;
  if (err.status === 'FETCH_ERROR') return 'Cannot reach the server. Check your internet / API URL.';
  if (err.status === 'PARSING_ERROR') return 'Server sent an unreadable response.';
  const data = err.data;
  if (data) {
    const details = data.error?.details;
    if (Array.isArray(details) && details.length > 0) {
      const first = details[0];
      const text = first.message || first;
      return `${data.message || 'Validation failed'}: ${String(text).replace(/"/g, '')}`;
    }
    if (data.message) return data.message;
  }
  return err.message || fallback;
};
