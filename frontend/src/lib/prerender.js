import { PRERENDER_DATA_BASE } from './api';

const readPrerenderJson = async (fileName) => {
  const response = await fetch(`${PRERENDER_DATA_BASE}/${fileName}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Unable to load prerender data: ${fileName}`);
  }

  return response.json();
};

export const loadPrerenderHomeData = () => readPrerenderJson('home.json');

export const loadPrerenderEventData = (eventId) =>
  readPrerenderJson(`events/${eventId}.json`);

export const loadPrerenderFerrySchedule = () =>
  readPrerenderJson('ferry-schedule.json');

export const loadPrerenderTerms = () => readPrerenderJson('terms.json');

export const loadPrerenderLegalPage = (page) =>
  readPrerenderJson(`legal-${page}.json`);
