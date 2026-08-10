export const LIVE_ANALYTICS_HOSTS = new Set(["superneo.ai", "www.superneo.ai"]);

const SAFE_CAMPAIGN_VALUE = /[^a-zA-Z0-9._~-]+/g;

export type AnalyticsRuntimePolicy = {
  hostname: string;
  isDevelopment: boolean;
  qaRequested: boolean;
  projectKey: string;
};

export function isAnalyticsRuntimeAllowed(policy: AnalyticsRuntimePolicy) {
  if (!policy.projectKey.trim()) return false;
  if (LIVE_ANALYTICS_HOSTS.has(policy.hostname)) return true;
  return policy.isDevelopment && policy.qaRequested;
}

export function normalizeCampaignValue(value: string | null) {
  if (!value) return undefined;
  const normalized = value.replace(SAFE_CAMPAIGN_VALUE, "-").slice(0, 64);
  return normalized || undefined;
}

export function safeReferrerHost(referrer: string) {
  if (!referrer) return undefined;
  try {
    return new URL(referrer).hostname.slice(0, 96) || undefined;
  } catch {
    return undefined;
  }
}

export function volumeBucket(value: number) {
  const safeValue = Math.min(100, Math.max(0, value));
  return Math.round(safeValue / 25) * 25;
}

export function deviceClass(width: number, coarsePointer: boolean) {
  if (width <= 720 || coarsePointer) return "mobile";
  if (width <= 1024) return "tablet";
  return "desktop";
}
