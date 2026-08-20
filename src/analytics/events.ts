export const ANALYTICS_EVENT = "superneo:analytics";

export const APPROVED_ANALYTICS_EVENTS = [
  "page_viewed",
  "scene_ready",
  "stage_completed",
  "experience_completed",
  "signal_triggered",
  "audio_toggled",
  "volume_changed",
  "outbound_clicked",
  "web_vital",
] as const;

export const OUTBOUND_DESTINATION_CATEGORIES = [
  "email",
  "legal",
  "privacy",
  "x",
] as const;

export type AnalyticsEventName = typeof APPROVED_ANALYTICS_EVENTS[number];
export type OutboundDestinationCategory = typeof OUTBOUND_DESTINATION_CATEGORIES[number];

export type AnalyticsEventProperties = Record<
  string,
  string | number | boolean | undefined
>;

export type AnalyticsEventDetail = {
  name: AnalyticsEventName;
  properties?: AnalyticsEventProperties;
};

const approvedEvents = new Set<string>(APPROVED_ANALYTICS_EVENTS);
const outboundDestinationCategories = new Set<string>(OUTBOUND_DESTINATION_CATEGORIES);

export function isApprovedAnalyticsEvent(name: string): name is AnalyticsEventName {
  return approvedEvents.has(name);
}

export function outboundAnalyticsProperties(destination: string) {
  if (!outboundDestinationCategories.has(destination)) return undefined;
  return { destination: destination as OutboundDestinationCategory };
}

export function sanitizeAnalyticsEventDetail(detail: AnalyticsEventDetail) {
  if (detail.name !== "outbound_clicked") return detail;
  const destination = detail.properties?.destination;
  if (typeof destination !== "string") return undefined;
  const properties = outboundAnalyticsProperties(destination);
  if (!properties) return undefined;
  return { name: detail.name, properties };
}

export function dispatchAnalyticsEvent(
  name: AnalyticsEventName,
  properties?: AnalyticsEventProperties,
) {
  window.dispatchEvent(new CustomEvent<AnalyticsEventDetail>(ANALYTICS_EVENT, {
    detail: { name, properties },
  }));
}

export function dispatchOutboundClick(destination: OutboundDestinationCategory) {
  dispatchAnalyticsEvent("outbound_clicked", { destination });
}
