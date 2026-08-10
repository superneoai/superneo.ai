import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import {
  getConsentSnapshot,
  initializeConsent,
  setAnalyticsConsent,
  subscribeToConsent,
  type ConsentSnapshot,
} from "./consent";

export function useAnalyticsConsent() {
  const consent = useSyncExternalStore(
    subscribeToConsent,
    getConsentSnapshot,
    getConsentSnapshot,
  );
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    void initializeConsent();
  }, []);

  const chooseAnalytics = useCallback(async (allowed: boolean) => {
    const next = await setAnalyticsConsent(allowed);
    setAnnouncement(next.status === "accepted"
      ? "Analytics accepted."
      : "Analytics rejected. No usage events will be sent.");
  }, []);

  return { consent, chooseAnalytics, announcement };
}

type ConsentDockProps = {
  visible: boolean;
  onChoice: (allowed: boolean) => Promise<void>;
  onDetails: () => void;
  onHeightChange: (height: number) => void;
};

export function ConsentDock({
  visible,
  onChoice,
  onDetails,
  onHeightChange,
}: ConsentDockProps) {
  const dockRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dock = dockRef.current;
    if (!visible || !dock) {
      onHeightChange(0);
      return;
    }

    const reportHeight = () => onHeightChange(Math.ceil(dock.getBoundingClientRect().height) + 16);
    reportHeight();
    const observer = new ResizeObserver(reportHeight);
    observer.observe(dock);
    return () => {
      observer.disconnect();
      onHeightChange(0);
    };
  }, [onHeightChange, visible]);

  if (!visible) return null;

  const choose = async (allowed: boolean) => {
    setSaving(true);
    try {
      await onChoice(allowed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="analytics-consent-dock"
      ref={dockRef}
      role="region"
      aria-label="Analytics choices"
    >
      <div className="analytics-consent-copy">
        <p className="analytics-consent-eyebrow"><i aria-hidden="true" /> SYSTEM // OPTIONAL ANALYTICS</p>
        <p>
          SUPERNEO uses optional PostHog US analytics to understand site usage and
          performance. Nothing is sent unless you allow it. No ads. No session replay.
        </p>
        <button className="analytics-details-button" type="button" onClick={onDetails}>
          PRIVACY DETAILS
        </button>
      </div>
      <div className="analytics-consent-actions">
        <button type="button" disabled={saving} onClick={() => { void choose(true); }}>
          ALLOW ANALYTICS
        </button>
        <button type="button" disabled={saving} onClick={() => { void choose(false); }}>
          DECLINE ANALYTICS
        </button>
      </div>
    </section>
  );
}

type PrivacyPreferencesProps = {
  open: boolean;
  consent: ConsentSnapshot;
  onClose: () => void;
  onSave: (allowed: boolean) => Promise<void>;
  fallbackFocusRef: RefObject<HTMLButtonElement | null>;
};

export function PrivacyPreferences({
  open,
  consent,
  onClose,
  onSave,
  fallbackFocusRef,
}: PrivacyPreferencesProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusElementRef = useRef<HTMLElement | null>(null);
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAnalyticsAllowed(consent.status === "accepted");
  }, [consent.status, open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const activeElement = document.activeElement;
      returnFocusElementRef.current = activeElement instanceof HTMLElement
        ? activeElement
        : null;
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => {
    onClose();
    window.requestAnimationFrame(() => {
      const returnTarget = returnFocusElementRef.current;
      if (returnTarget?.isConnected) returnTarget.focus();
      else fallbackFocusRef.current?.focus();
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(analyticsAllowed);
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog
      className="privacy-preferences"
      ref={dialogRef}
      aria-labelledby="privacy-preferences-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={() => {
        if (open) onClose();
      }}
    >
      <header>
        <div>
          <p>PRIVACY // CONTROL</p>
          <h2 id="privacy-preferences-title">Analytics preferences</h2>
        </div>
        <button className="privacy-close" type="button" onClick={close} aria-label="Close privacy preferences">
          ×
        </button>
      </header>

      <div className="privacy-preference-list">
        <section>
          <div>
            <h3>Necessary</h3>
            <p>Remembers your privacy choice and local interface settings.</p>
          </div>
          <span className="privacy-state" aria-label="Necessary storage is always on">LOCKED / ON</span>
        </section>
        <section>
          <div>
            <h3>Analytics</h3>
            <p>
              Optional page, stage, interaction, audio and performance signals. Random browser ID;
              no ads, personal profile or replay.
            </p>
            {consent.gpc && <p className="privacy-gpc">Global Privacy Control detected. Analytics remains off.</p>}
          </div>
          <label className="privacy-toggle">
            <input
              type="checkbox"
              checked={analyticsAllowed && !consent.gpc}
              disabled={consent.gpc}
              onChange={(event) => setAnalyticsAllowed(event.currentTarget.checked)}
            />
            <span aria-hidden="true" />
            <b>{analyticsAllowed && !consent.gpc ? "ON" : "OFF"}</b>
          </label>
        </section>
      </div>

      <footer>
        <a href="./privacy/">FULL PRIVACY NOTICE ↗</a>
        <button type="button" disabled={saving} onClick={() => { void save(); }}>
          SAVE PREFERENCES
        </button>
      </footer>
    </dialog>
  );
}
