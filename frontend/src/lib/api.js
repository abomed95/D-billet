const trimTrailingSlash = (value = '') => value.replace(/\/+$/, '');

export const isPrerender =
  typeof navigator !== 'undefined' && navigator.userAgent === 'ReactSnap';

const configuredBackendUrl = trimTrailingSlash(process.env.REACT_APP_BACKEND_URL || '');
const configuredSiteUrl = trimTrailingSlash(
  process.env.REACT_APP_SITE_URL || 'https://d-billet.com'
);

export const PRERENDER_DATA_BASE = '/prerender-data';

export const API_BASE = configuredBackendUrl
  ? `${configuredBackendUrl}/api`
  : isPrerender
    ? `${configuredSiteUrl}/api`
    : '/api';
