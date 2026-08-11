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

const transportProperties = [
  "token",
  "distinct_id",
  "$device_id",
  "$lib",
  "$lib_version",
  "$insert_id",
  "$process_person_profile",
] as const;

const sharedProperties = ["surface", "environment"] as const;

const eventProperties: Record<AnalyticsEventName, readonly string[]> = {
  page_viewed: [
    "path",
    "referrer_host",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "device_class",
  ],
  scene_ready: ["device_class"],
  stage_completed: ["stage", "stage_index"],
  experience_completed: ["final_stage"],
  signal_triggered: ["sequence"],
  audio_toggled: ["state"],
  volume_changed: ["bucket"],
  outbound_clicked: ["destination"],
  web_vital: ["metric", "value", "rating"],
};

export type AnalyticsEventDetail = {
  name: AnalyticsEventName;
  properties?: AnalyticsEventProperties;
};

const approvedEvents = new Set<string>(APPROVED_ANALYTICS_EVENTS);

export function isApprovedAnalyticsEvent(name: string): name is AnalyticsEventName {
  return approvedEvents.has(name);
}

export function sanitizeAnalyticsEventProperties(
  name: AnalyticsEventName,
  properties: Record<string, unknown> | undefined,
) {
  const source = properties ?? {};
  const approved = new Set<string>([
    ...transportProperties,
    ...sharedProperties,
    ...eventProperties[name],
  ]);
  const sanitized: Record<string, unknown> = {};

  approved.forEach((property) => {
    const value = source[property];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      sanitized[property] = value;
    }
  });

  sanitized.$process_person_profile = false;
  sanitized.$geoip_disable = true;
  return sanitized;
}

export function dispatchAnalyticsEvent(
  name: AnalyticsEventName,
  properties?: AnalyticsEventProperties,
) {
  window.dispatchEvent(new CustomEvent<AnalyticsEventDetail>(ANALYTICS_EVENT, {
    detail: { name, properties },
  }));
}
