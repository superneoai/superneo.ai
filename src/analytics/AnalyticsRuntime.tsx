import { useEffect, useRef } from "react";
import { LAST_STAGE } from "../morphTimeline";
import { STAGE_CHANGE_EVENT, type StageChangeDetail } from "../stageSignal";
import { TIP_SIGNAL_EVENT } from "../tipSignal";
import type { ConsentStatus } from "../privacy/consent";
import {
  captureAnalyticsEvent,
  clearAnalyticsForWithdrawal,
  setAnalyticsPermission,
  startAnalytics,
} from "./client";
import {
  ANALYTICS_EVENT,
  type AnalyticsEventDetail,
} from "./events";
import {
  deviceClass,
  normalizeCampaignValue,
  safeReferrerHost,
} from "./policy";

const stageNames = ["latent", "emergence", "superneo"];

function pageProperties() {
  const query = new URLSearchParams(window.location.search);
  return {
    path: window.location.pathname,
    referrer_host: safeReferrerHost(document.referrer),
    utm_source: normalizeCampaignValue(query.get("utm_source")),
    utm_medium: normalizeCampaignValue(query.get("utm_medium")),
    utm_campaign: normalizeCampaignValue(query.get("utm_campaign")),
    device_class: deviceClass(
      window.innerWidth,
      window.matchMedia("(pointer: coarse)").matches,
    ),
  };
}

type AnalyticsRuntimeProps = {
  consentStatus: ConsentStatus;
  sceneReady: boolean;
};

export function AnalyticsRuntime({ consentStatus, sceneReady }: AnalyticsRuntimeProps) {
  const lifecycleCapturedRef = useRef(false);
  const completedStagesRef = useRef(new Set<number>());
  const experienceCapturedRef = useRef(false);

  useEffect(() => {
    const accepted = consentStatus === "accepted";
    setAnalyticsPermission(accepted);
    if (!accepted) {
      lifecycleCapturedRef.current = false;
      completedStagesRef.current.clear();
      experienceCapturedRef.current = false;
      clearAnalyticsForWithdrawal();
    }
  }, [consentStatus]);

  useEffect(() => {
    if (consentStatus !== "accepted" || !sceneReady || lifecycleCapturedRef.current) return;
    lifecycleCapturedRef.current = true;
    void startAnalytics().then((client) => {
      if (!client) return;
      captureAnalyticsEvent("page_viewed", pageProperties());
      captureAnalyticsEvent("scene_ready", {
        device_class: deviceClass(
          window.innerWidth,
          window.matchMedia("(pointer: coarse)").matches,
        ),
      });
      void import("web-vitals").then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
        const report = (metric: { name: string; value: number; rating: string }) => {
          captureAnalyticsEvent("web_vital", {
            metric: metric.name,
            value: Math.round(metric.value * 1000) / 1000,
            rating: metric.rating,
          });
        };
        onCLS(report);
        onFCP(report);
        onINP(report);
        onLCP(report);
        onTTFB(report);
      }).catch(() => undefined);
    });
  }, [consentStatus, sceneReady]);

  useEffect(() => {
    if (consentStatus !== "accepted") return;
    let lastSignalAt = 0;
    let signalCount = 0;

    const captureStage = (event: Event) => {
      const { stage, previous } = (event as CustomEvent<StageChangeDetail>).detail;
      if (stage > previous && !completedStagesRef.current.has(previous)) {
        completedStagesRef.current.add(previous);
        captureAnalyticsEvent("stage_completed", {
          stage: stageNames[previous] ?? `stage-${previous + 1}`,
          stage_index: previous + 1,
        });
      }
      if (stage === LAST_STAGE && !experienceCapturedRef.current) {
        experienceCapturedRef.current = true;
        captureAnalyticsEvent("experience_completed", { final_stage: "superneo" });
      }
    };

    const captureSignal = () => {
      const now = performance.now();
      if (signalCount >= 10 || now - lastSignalAt < 1500) return;
      lastSignalAt = now;
      signalCount += 1;
      captureAnalyticsEvent("signal_triggered", { sequence: signalCount });
    };

    const captureDispatchedEvent = (event: Event) => {
      const { name, properties } = (event as CustomEvent<AnalyticsEventDetail>).detail;
      captureAnalyticsEvent(name, properties);
    };

    window.addEventListener(STAGE_CHANGE_EVENT, captureStage);
    window.addEventListener(TIP_SIGNAL_EVENT, captureSignal);
    window.addEventListener(ANALYTICS_EVENT, captureDispatchedEvent);
    return () => {
      window.removeEventListener(STAGE_CHANGE_EVENT, captureStage);
      window.removeEventListener(TIP_SIGNAL_EVENT, captureSignal);
      window.removeEventListener(ANALYTICS_EVENT, captureDispatchedEvent);
    };
  }, [consentStatus]);

  return null;
}
