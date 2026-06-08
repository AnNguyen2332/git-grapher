var trackedRouteEvents = {};

export function trackEvent(name, props) {
  var payload = props || {};

  if (typeof window === "undefined") return;

  try {
    window.dispatchEvent(new CustomEvent("git-grapher:event", {
      detail: { name: name, props: payload },
    }));
  } catch (error) {
    // Analytics should never block the simulator.
  }

  try {
    if (window.umami && typeof window.umami.track === "function") {
      window.umami.track(name, payload);
    }
    if (typeof window.plausible === "function") {
      window.plausible(name, { props: payload });
    }
    if (window.posthog && typeof window.posthog.capture === "function") {
      window.posthog.capture(name, payload);
    }
    if (typeof window.gtag === "function") {
      window.gtag("event", name, payload);
    }
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(Object.assign({ event: name }, payload));
    }
  } catch (error) {
    // Third-party scripts may be blocked; keep the app fully usable.
  }
}

export function trackRouteOnce(name) {
  if (trackedRouteEvents[name]) return;
  trackedRouteEvents[name] = true;
  trackEvent(name);
}
