export const SITE_NAME = 'D-Billet';
export const SITE_URL = (process.env.REACT_APP_SITE_URL || 'https://d-billet.com').replace(/\/+$/, '');
export const DEFAULT_OG_IMAGE = `${SITE_URL}/images/dbillet-logo.png`;

export const absoluteUrl = (path = '/') => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${normalizedPath}`;
};

export const slugify = (value = '') =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
