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

export type AnalyticsEventName = typeof APPROVED_ANALYTICS_EVENTS[number];

export type AnalyticsEventProperties = Record<
  string,
  string | number | boolean | undefined
>;

export type AnalyticsEventDetail = {
  name: AnalyticsEventName;
  properties?: AnalyticsEventProperties;
};

const approvedEvents = new Set<string>(APPROVED_ANALYTICS_EVENTS);

export function isApprovedAnalyticsEvent(name: string): name is AnalyticsEventName {
  return approvedEvents.has(name);
}

export function dispatchAnalyticsEvent(
  name: AnalyticsEventName,
  properties?: AnalyticsEventProperties,
) {
  window.dispatchEvent(new CustomEvent<AnalyticsEventDetail>(ANALYTICS_EVENT, {
    detail: { name, properties },
  }));
}
