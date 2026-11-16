// Production uses the same origin; override only for a separately hosted API.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
