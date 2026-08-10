import * as CookieConsent from "vanilla-cookieconsent";
import {
  analyticsQaMode,
  analyticsRuntimeEnabled,
  globalPrivacyControlEnabled,
} from "../analytics/runtimeConfig";

export const CONSENT_REVISION = 1;
export const CONSENT_COOKIE_NAME = "sn_consent";

export type ConsentStatus =
  | "unavailable"
  | "loading"
  | "pending"
  | "accepted"
  | "declined";

export type ConsentSnapshot = {
  available: boolean;
  gpc: boolean;
  status: ConsentStatus;
};

const unavailableSnapshot: ConsentSnapshot = {
  available: false,
  gpc: false,
  status: "unavailable",
};

let snapshot: ConsentSnapshot = analyticsRuntimeEnabled
  ? {
      available: true,
      gpc: globalPrivacyControlEnabled(),
      status: "loading",
    }
  : unavailableSnapshot;
let initialization: Promise<ConsentSnapshot> | null = null;
const listeners = new Set<(next: ConsentSnapshot) => void>();

function readSnapshot(): ConsentSnapshot {
  if (!analyticsRuntimeEnabled) return unavailableSnapshot;
  const gpc = globalPrivacyControlEnabled();
  const valid = CookieConsent.validConsent();
  return {
    available: true,
    gpc,
    status: !valid
      ? "pending"
      : !gpc && CookieConsent.acceptedCategory("analytics")
        ? "accepted"
        : "declined",
  };
}

function publish() {
  snapshot = readSnapshot();
  listeners.forEach((listener) => listener(snapshot));
}

export function getConsentSnapshot() {
  return snapshot;
}

export function subscribeToConsent(listener: (next: ConsentSnapshot) => void) {
  listeners.add(listener);
  listener(snapshot);
  return () => {
    listeners.delete(listener);
  };
}

export function initializeConsent() {
  if (!analyticsRuntimeEnabled) return Promise.resolve(unavailableSnapshot);
  if (initialization) return initialization;

  initialization = CookieConsent.run({
    mode: "opt-in",
    autoShow: false,
    disablePageInteraction: false,
    hideFromBots: !analyticsQaMode,
    manageScriptTags: false,
    autoClearCookies: true,
    revision: CONSENT_REVISION,
    cookie: {
      name: CONSENT_COOKIE_NAME,
      expiresAfterDays: 180,
      path: "/",
      sameSite: "Lax",
      secure: true,
    },
    categories: {
      necessary: {
        enabled: true,
        readOnly: true,
      },
      analytics: {
        autoClear: {
          cookies: [
            { name: /^ph_/ },
            { name: /^__ph/ },
          ],
        },
      },
    },
    language: {
      default: "en",
      translations: {
        en: {
          consentModal: {
            title: "Optional analytics",
            description: "Usage and performance analytics require permission.",
            acceptAllBtn: "Allow analytics",
            acceptNecessaryBtn: "Decline",
            showPreferencesBtn: "Privacy details",
          },
          preferencesModal: {
            title: "Privacy preferences",
            acceptAllBtn: "Allow analytics",
            acceptNecessaryBtn: "Decline",
            savePreferencesBtn: "Save preferences",
            closeIconLabel: "Close privacy preferences",
            sections: [
              {
                title: "Necessary",
                description: "Remembers your privacy and local interface choices.",
                linkedCategory: "necessary",
              },
              {
                title: "Analytics",
                description: "Optional usage and performance signals sent to PostHog US.",
                linkedCategory: "analytics",
              },
            ],
          },
        },
      },
    },
    onConsent: publish,
    onFirstConsent: publish,
    onChange: publish,
  }).then(() => {
    if (globalPrivacyControlEnabled()) {
      if (!CookieConsent.validConsent() || CookieConsent.acceptedCategory("analytics")) {
        CookieConsent.acceptCategory([]);
        CookieConsent.setCookieData({
          value: { source: "gpc" },
          mode: "update",
        });
      }
    }
    publish();
    return snapshot;
  });

  return initialization;
}

export async function setAnalyticsConsent(allowed: boolean) {
  await initializeConsent();
  const gpc = globalPrivacyControlEnabled();
  CookieConsent.acceptCategory(allowed && !gpc ? "all" : []);
  CookieConsent.setCookieData({
    value: { source: gpc ? "gpc" : "choice" },
    mode: "update",
  });
  publish();
  return snapshot;
}
