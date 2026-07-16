import { useEffect } from 'react';
import { DEFAULT_OG_IMAGE, SITE_NAME, absoluteUrl } from '../lib/seo';

const upsertMeta = (selector, attributes) => {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
};

const upsertLink = (selector, attributes) => {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
};

const Seo = ({
  title,
  description,
  keywords,
  path = '/',
  canonical,
  image = DEFAULT_OG_IMAGE,
  type = 'website',
  robots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  structuredData,
}) => {
  useEffect(() => {
    const pageTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | Billetterie Djibouti`;
    const canonicalUrl = canonical || absoluteUrl(path);
    const imageUrl = absoluteUrl(image);

    document.title = pageTitle;

    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    if (keywords) {
      upsertMeta('meta[name="keywords"]', { name: 'keywords', content: keywords });
    }
    upsertMeta('meta[name="robots"]', { name: 'robots', content: robots });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: pageTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: imageUrl });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'fr_DJ' });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: pageTitle });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: imageUrl });
    // Local / geo signals (Djibouti) — helps local & generative search
    upsertMeta('meta[name="geo.region"]', { name: 'geo.region', content: 'DJ' });
    upsertMeta('meta[name="geo.placename"]', { name: 'geo.placename', content: 'Djibouti' });
    upsertMeta('meta[name="geo.position"]', { name: 'geo.position', content: '11.588;43.145' });
    upsertMeta('meta[name="ICBM"]', { name: 'ICBM', content: '11.588, 43.145' });
    upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonicalUrl });
    upsertLink('link[rel="alternate"][hreflang="fr-DJ"]', { rel: 'alternate', hreflang: 'fr-DJ', href: canonicalUrl });
    upsertLink('link[rel="alternate"][hreflang="x-default"]', { rel: 'alternate', hreflang: 'x-default', href: canonicalUrl });

    const scriptId = 'seo-structured-data';
    const previousScript = document.getElementById(scriptId);
    if (previousScript) {
      previousScript.remove();
    }

    if (structuredData) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
  }, [canonical, description, keywords, image, path, robots, structuredData, title, type]);

  return null;
};

export default Seo;
