import { isAnalyticsRuntimeAllowed } from "./policy";

const query = new URLSearchParams(window.location.search);

export const posthogProjectKey = (import.meta.env.VITE_POSTHOG_KEY ?? "").trim();
export const posthogHost = (
  import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com"
).replace(/\/$/, "");
export const analyticsQaMode = import.meta.env.DEV && query.get("analyticsQa") === "1";

export const analyticsRuntimeEnabled = isAnalyticsRuntimeAllowed({
  hostname: window.location.hostname,
  isDevelopment: import.meta.env.DEV,
  qaRequested: analyticsQaMode,
  projectKey: posthogProjectKey,
});

export function globalPrivacyControlEnabled() {
  if (import.meta.env.DEV && query.get("gpc") === "1") return true;
  return Boolean(
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl,
  );
}
