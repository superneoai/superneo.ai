import type { PostHog } from "posthog-js";
import {
  APPROVED_ANALYTICS_EVENTS,
  isApprovedAnalyticsEvent,
  type AnalyticsEventName,
  type AnalyticsEventProperties,
} from "./events";
import {
  analyticsQaMode,
  analyticsRuntimeEnabled,
  posthogHost,
  posthogProjectKey,
} from "./runtimeConfig";
import { analyticsContext } from "./policy";

const MAX_PENDING_EVENTS = 20;
const POSTHOG_STORAGE = /^(?:ph_|__ph)/;
const approvedEventNames = new Set<string>(APPROVED_ANALYTICS_EVENTS);
const sharedEventProperties = analyticsContext(import.meta.env.PROD);
const scrubbedProperties = [
  "$current_url",
  "$pathname",
  "$referrer",
  "$referring_domain",
  "$initial_current_url",
  "$initial_pathname",
  "$initial_referrer",
  "$initial_referring_domain",
  "$session_entry_url",
  "$session_entry_host",
  "$session_entry_pathname",
  "$session_entry_referrer",
  "$session_entry_referring_domain",
  "$raw_user_agent",
];

type PendingEvent = {
  name: AnalyticsEventName;
  properties?: AnalyticsEventProperties;
};

let posthog: PostHog | null = null;
let starting: Promise<PostHog | null> | null = null;
let permitted = false;
const pending: PendingEvent[] = [];

function removePostHogStorage() {
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key && POSTHOG_STORAGE.test(key)) window.localStorage.removeItem(key);
    }
  } catch {
    // Consent withdrawal still succeeds when browser storage is unavailable.
  }

  document.cookie.split(";").forEach((value) => {
    const name = value.split("=")[0]?.trim();
    if (!name || !POSTHOG_STORAGE.test(name)) return;
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
  });
}

function flushPendingEvents() {
  if (!posthog || !permitted) return;
  pending.splice(0).forEach(({ name, properties }) => {
    posthog?.capture(name, properties);
  });
}

export function setAnalyticsPermission(allowed: boolean) {
  permitted = analyticsRuntimeEnabled && allowed;
  if (permitted) {
    if (posthog) {
      posthog.opt_in_capturing({ captureEventName: false });
      flushPendingEvents();
    }
    return;
  }

  pending.length = 0;
  posthog?.opt_out_capturing();
  removePostHogStorage();
}

export async function startAnalytics() {
  if (!permitted || !analyticsRuntimeEnabled) return null;
  if (posthog) return posthog;
  if (starting) return starting;

  starting = import("posthog-js").then(({ default: posthogClient }) => {
    if (!permitted) return null;
    posthogClient.init(posthogProjectKey, {
      api_host: posthogHost,
      ui_host: "https://us.posthog.com",
      defaults: "2026-05-30",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_performance: false,
      ip: false,
      debug: false,
      request_batching: !analyticsQaMode,
      opt_out_useragent_filter: analyticsQaMode,
      disable_session_recording: true,
      disable_surveys: true,
      disable_surveys_automatic_display: true,
      disable_product_tours: true,
      disable_conversations: true,
      disable_web_experiments: true,
      disable_external_dependency_loading: true,
      advanced_disable_flags: true,
      advanced_disable_feature_flags: true,
      advanced_disable_feature_flags_on_first_load: true,
      internal_or_test_user_hostname: null,
      person_profiles: "never",
      cross_subdomain_cookie: false,
      cookie_expiration: 180,
      secure_cookie: true,
      respect_dnt: true,
      opt_out_capturing_by_default: true,
      opt_out_persistence_by_default: true,
      before_send: (event) => {
        if (!event || !approvedEventNames.has(event.event)) return null;
        const properties = { ...event.properties };
        scrubbedProperties.forEach((key) => delete properties[key]);
        return { ...event, properties };
      },
    });
    posthog = posthogClient;
    if (!permitted) {
      posthog.opt_out_capturing();
      removePostHogStorage();
      return null;
    }
    posthog.opt_in_capturing({ captureEventName: false });
    flushPendingEvents();
    return posthog;
  }).catch(() => null).finally(() => {
    starting = null;
  });

  return starting;
}

export function captureAnalyticsEvent(
  name: AnalyticsEventName,
  properties?: AnalyticsEventProperties,
) {
  if (!permitted || !isApprovedAnalyticsEvent(name)) return;
  const contextualProperties = { ...properties, ...sharedEventProperties };
  if (posthog) {
    posthog.capture(name, contextualProperties);
    return;
  }
  if (pending.length < MAX_PENDING_EVENTS) {
    pending.push({ name, properties: contextualProperties });
  }
  void startAnalytics();
}

export function clearAnalyticsForWithdrawal() {
  setAnalyticsPermission(false);
}
