/**
 * Generates a unique ID using crypto.randomUUID() if available,
 * otherwise falls back to a timestamp + random string combination.
 */
export const generateId = (prefix: string = ''): string => {
  let id: string;
  
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    id = crypto.randomUUID();
  } else {
    // Fallback for environments without randomUUID
    id = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
  
  return prefix ? `${prefix}_${id}` : id;
};
