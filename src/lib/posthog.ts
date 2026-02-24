import posthog from 'posthog-js';

const POSTHOG_KEY = 'phc_BU5KxwcaBKjaTez7uPYsJPyDXV5sw9gIvmYFZOTNmoo';
const POSTHOG_HOST = 'https://us.i.posthog.com';

let initialized = false;

export function initPostHog() {
  if (initialized) return;
  
  // Don't initialize on admin routes
  if (window.location.pathname.startsWith('/admin')) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: false,
    session_recording: {
      recordCrossOriginIframes: false,
    },
    autocapture: true,
    persistence: 'localStorage',
  });

  initialized = true;
}

export function identifyUser(userId: string, properties?: Record<string, any>) {
  if (!initialized) return;
  posthog.identify(userId, properties);
}

export function resetPostHog() {
  if (!initialized) return;
  posthog.reset();
}

export { posthog };
