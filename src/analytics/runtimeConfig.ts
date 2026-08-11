import { isAnalyticsRuntimeAllowed } from "./policy";

const query = new URLSearchParams(window.location.search);

export const posthogProjectKey = (import.meta.env.VITE_POSTHOG_KEY ?? "").trim();
export const posthogHost = (
  import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com"
).replace(/\/$/, "");
export const analyticsQaMode = import.meta.env.DEV && query.get("analyticsQa") === "1";
export const analyticsConsentPreviewMode = analyticsQaMode
  && query.get("consentPreview") !== "0";
const posthogIpDiscardConfirmed = import.meta.env.VITE_POSTHOG_IP_DISCARD_CONFIRMED === "true";

export const analyticsRuntimeEnabled = isAnalyticsRuntimeAllowed({
  hostname: window.location.hostname,
  isDevelopment: import.meta.env.DEV,
  qaRequested: analyticsQaMode,
  projectKey: posthogProjectKey,
  ipDiscardConfirmed: posthogIpDiscardConfirmed,
});

export function globalPrivacyControlEnabled() {
  if (import.meta.env.DEV && query.get("gpc") === "1") return true;
  return Boolean(
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl,
  );
}
