/**
 * Bridges the react-snap prerender pass and the browser's first render.
 *
 * react-snap captures the DOM once the page has loaded its data, so the HTML it
 * writes already holds content. The browser then hydrates that HTML, but its own
 * first render starts from empty state because the data only arrives in an
 * effect. React sees two different trees, reports hydration error #418 and
 * throws the prerendered DOM away - which wastes the prerender entirely.
 *
 * So during the prerender pass each page hands its data to `savePrerenderState`.
 * react-snap serialises it into a <script> it inserts before the bundle, and the
 * browser reads it back synchronously through `readPrerenderState` to seed
 * useState. The first render then matches the HTML and hydration succeeds.
 *
 * The data is a build-time snapshot, so pages still refetch in their effect;
 * this only decides what the very first paint shows.
 */
import { isPrerender } from './api';

const STATE_KEY = '__DBILLET_PRERENDER_STATE__';

/** Snapshot react-snap inlined for `page`, or null outside a prerendered page. */
export const readPrerenderState = (page) => {
  if (typeof window === 'undefined') {
    return null;
  }
  const state = window[STATE_KEY];
  return (state && state[page]) || null;
};

/** During the prerender pass only: hand `data` to react-snap for inlining. */
export const savePrerenderState = (page, data) => {
  if (!isPrerender || typeof window === 'undefined' || !data) {
    return;
  }
  if (!window[STATE_KEY]) {
    window[STATE_KEY] = {};
  }
  window[STATE_KEY][page] = data;
  // react-snap calls this when the page goes idle and inlines what it returns.
  window.snapSaveState = () => ({ [STATE_KEY]: window[STATE_KEY] });
};
