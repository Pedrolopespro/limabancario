(function initializeTracking() {
  "use strict";

  const baseConfig = window.LF_TRACKING_CONFIG || {};
  const previewEnabled = new URLSearchParams(window.location.search).get("lf_tracking_preview") === "1";
  let previewConfig = {};

  if (previewEnabled) {
    try {
      previewConfig = JSON.parse(localStorage.getItem("lf_tracking_preview_config") || "{}");
    } catch {
      previewConfig = {};
    }
  }

  const config = {
    ...baseConfig,
    ...previewConfig,
    consent: { ...baseConfig.consent, ...previewConfig.consent },
    form: { ...baseConfig.form, ...previewConfig.form },
    debug: Boolean(baseConfig.debug || previewEnabled || previewConfig.debug),
  };

  const consentKey = `lf_tracking_consent_${config.consent?.policyVersion || "v1"}`;
  const sessionKey = "lf_tracking_session";
  const eventLogKey = "lf_tracking_event_log";
  const eventLogLimit = 100;
  const sensitiveKeys = new Set([
    "name",
    "email",
    "phone",
    "telephone",
    "cnpj",
    "company",
    "case_note",
    "message",
  ]);
  const sectionIds = ["inicio", "conversa", "situacoes", "atuacao", "metodo", "especialista", "faq", "analise"];
  const scrollMarks = [25, 50, 75, 90];
  const reachedScrollMarks = new Set();
  const viewedSections = new Set();
  let providersLoaded = false;
  let formStarted = false;
  let leadGenerated = false;
  let videoStarted = false;
  let videoCompleted = false;

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };
  window.__LF_EVENT_LOG__ = window.__LF_EVENT_LOG__ || [];

  const createId = () =>
    window.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

  const getSessionId = () => {
    let sessionId = sessionStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = createId();
      sessionStorage.setItem(sessionKey, sessionId);
    }
    return sessionId;
  };

  const cleanValue = (value) => {
    if (typeof value === "string") return value.trim().slice(0, 180);
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.slice(0, 20).map(cleanValue);
    return undefined;
  };

  const sanitizeParameters = (parameters = {}) =>
    Object.entries(parameters).reduce((clean, [key, value]) => {
      if (sensitiveKeys.has(key.toLowerCase())) return clean;
      const sanitized = cleanValue(value);
      if (sanitized !== undefined && sanitized !== "") clean[key] = sanitized;
      return clean;
    }, {});

  const readConsent = () => {
    try {
      return JSON.parse(localStorage.getItem(consentKey) || "null");
    } catch {
      return null;
    }
  };

  const hasAnalyticsConsent = () => {
    if (!config.consent?.required) return true;
    return readConsent()?.analytics === "granted";
  };

  const logEvent = (entry) => {
    window.__LF_EVENT_LOG__.push(entry);
    if (window.__LF_EVENT_LOG__.length > eventLogLimit) window.__LF_EVENT_LOG__.shift();

    if (!config.debug) return;

    try {
      const persisted = JSON.parse(localStorage.getItem(eventLogKey) || "[]");
      persisted.push(entry);
      localStorage.setItem(eventLogKey, JSON.stringify(persisted.slice(-eventLogLimit)));
    } catch {
      // A medição continua funcionando quando o armazenamento está indisponível.
    }

    console.info("[LF Tracking]", entry.event, entry);
  };

  const getPageContext = () => ({
    page_title: document.title,
    page_location: window.location.href.split("#")[0],
    page_path: window.location.pathname,
    page_referrer: document.referrer || undefined,
  });

  const getCampaignContext = () => {
    const search = new URLSearchParams(window.location.search);
    return ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"].reduce(
      (campaign, key) => {
        const value = search.get(key);
        if (value) campaign[key] = value.slice(0, 180);
        return campaign;
      },
      {},
    );
  };

  const persistCampaignContext = () => {
    const current = getCampaignContext();
    if (!Object.keys(current).length) return;
    try {
      sessionStorage.setItem("lf_tracking_campaign", JSON.stringify(current));
    } catch {
      // Os parâmetros ainda seguem disponíveis no endereço atual.
    }
  };

  const getStoredCampaignContext = () => {
    try {
      return {
        ...JSON.parse(sessionStorage.getItem("lf_tracking_campaign") || "{}"),
        ...getCampaignContext(),
      };
    } catch {
      return getCampaignContext();
    }
  };

  const sendToMeta = (eventName, parameters, eventId) => {
    if (!window.fbq || !hasAnalyticsConsent()) return;

    if (eventName === "generate_lead") {
      window.fbq("track", "Lead", parameters, { eventID: eventId });
      return;
    }

    const metaCustomEvents = new Set([
      "lf_cta_click",
      "lf_form_start",
      "lf_form_step_complete",
      "lf_video_start",
      "lf_contact_click",
    ]);

    if (metaCustomEvents.has(eventName)) {
      window.fbq("trackCustom", eventName, parameters, { eventID: eventId });
    }
  };

  const sendGoogleAdsLead = (parameters) => {
    if (!window.gtag || !config.googleAdsId || !config.googleAdsLeadLabel) return;
    window.gtag("event", "conversion", {
      send_to: `${config.googleAdsId}/${config.googleAdsLeadLabel}`,
      value: parameters.value || 1,
      currency: parameters.currency || "BRL",
    });
  };

  const track = (eventName, parameters = {}) => {
    if (eventName === "generate_lead") leadGenerated = true;
    const providedEventId =
      typeof parameters.event_id === "string" && /^[a-z0-9_.:-]{8,128}$/i.test(parameters.event_id)
        ? parameters.event_id
        : "";
    const eventId = providedEventId || createId();
    const eventParameters = {
      ...sanitizeParameters(parameters),
      ...getStoredCampaignContext(),
      event_id: eventId,
      session_id: getSessionId(),
      event_time: new Date().toISOString(),
      tracking_environment: config.environment || "production",
      consent_state: hasAnalyticsConsent() ? "granted" : "denied",
    };
    const entry = { event: eventName, ...eventParameters };

    logEvent(entry);

    if (hasAnalyticsConsent()) {
      window.dataLayer.push(entry);
      if (config.ga4MeasurementId || config.googleAdsId) {
        window.gtag("event", eventName, eventParameters);
      }
      sendToMeta(eventName, eventParameters, eventId);
      if (eventName === "generate_lead") sendGoogleAdsLead(eventParameters);
    }

    window.dispatchEvent(new CustomEvent("lf:tracking-event", { detail: entry }));
    return eventId;
  };

  const injectScript = (src, id) => {
    if (id && document.getElementById(id)) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    if (id) script.id = id;
    document.head.appendChild(script);
  };

  const loadGoogleTagManager = () => {
    if (!/^GTM-[A-Z0-9]+$/i.test(config.gtmId || "")) return;
    window.dataLayer.push({
      "gtm.start": Date.now(),
      event: "gtm.js",
    });
    injectScript(
      `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(config.gtmId)}`,
      "lf-gtm-script",
    );
  };

  const loadGoogleTag = () => {
    const googleIds = [config.ga4MeasurementId, config.googleAdsId].filter(Boolean);
    if (!googleIds.length) return;

    window.gtag("js", new Date());

    googleIds.forEach((id) => {
      window.gtag("config", id, {
        send_page_view: false,
        allow_google_signals: hasAnalyticsConsent(),
      });
    });

    injectScript(
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleIds[0])}`,
      "lf-google-tag-script",
    );
  };

  const loadMetaPixel = () => {
    if (!config.loadMetaDirectly || !/^\d{5,25}$/.test(config.metaPixelId || "")) return;

    if (!window.fbq) {
      const fbq = function fbq() {
        fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
      };
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.queue = [];
      window.fbq = fbq;
      window._fbq = fbq;
    }

    window.fbq("init", config.metaPixelId);
    injectScript("https://connect.facebook.net/en_US/fbevents.js", "lf-meta-pixel-script");
  };

  const loadProviders = () => {
    if (providersLoaded || !hasAnalyticsConsent()) return;
    providersLoaded = true;
    loadGoogleTagManager();
    loadGoogleTag();
    loadMetaPixel();

    window.setTimeout(() => {
      track("page_view", getPageContext());
      if (window.fbq) window.fbq("track", "PageView");
    }, 0);
  };

  const removeConsentBanner = () => {
    document.querySelector("[data-tracking-consent]")?.remove();
  };

  const setConsent = (analytics) => {
    const consent = {
      analytics,
      updated_at: new Date().toISOString(),
      policy_version: config.consent?.policyVersion || "v1",
    };
    localStorage.setItem(consentKey, JSON.stringify(consent));
    removeConsentBanner();
    window.gtag("consent", "update", {
      analytics_storage: analytics,
      ad_storage: analytics,
      ad_user_data: analytics,
      ad_personalization: analytics,
    });
    if (analytics === "granted") loadProviders();
    track("lf_consent_update", { analytics_storage: analytics });
  };

  const renderConsentBanner = () => {
    if (!config.consent?.required || readConsent() || document.querySelector("[data-tracking-consent]")) {
      return;
    }

    const banner = document.createElement("section");
    banner.className = "tracking-consent";
    banner.dataset.trackingConsent = "";
    banner.setAttribute("aria-label", "Preferências de privacidade");
    banner.innerHTML = `
      <div class="tracking-consent__copy">
        <strong>Privacidade e mensuração</strong>
        <p>Usamos dados anônimos de navegação para medir campanhas e melhorar esta página. Os dados digitados no formulário não são enviados aos pixels.</p>
      </div>
      <div class="tracking-consent__actions">
        <button type="button" class="tracking-consent__secondary" data-consent-deny>Somente necessárias</button>
        <button type="button" class="tracking-consent__primary" data-consent-accept>Aceitar métricas</button>
      </div>
    `;
    document.body.appendChild(banner);
    banner.querySelector("[data-consent-accept]")?.addEventListener("click", () => setConsent("granted"));
    banner.querySelector("[data-consent-deny]")?.addEventListener("click", () => setConsent("denied"));
  };

  const reopenConsent = () => {
    localStorage.removeItem(consentKey);
    renderConsentBanner();
  };

  const getElementTrackingData = (element) => {
    const anchor = element.closest("a, button");
    if (
      !anchor ||
      anchor.closest("[data-tracking-consent]") ||
      anchor.closest("#analysis-form") ||
      anchor.matches("[data-video-play], [data-privacy-settings], [data-analysis-close]")
    ) {
      return null;
    }

    const label =
      anchor.dataset.trackLabel ||
      anchor.getAttribute("aria-label") ||
      anchor.textContent?.replace(/\s+/g, " ").trim().slice(0, 120) ||
      "sem_rótulo";
    const href = anchor instanceof HTMLAnchorElement ? anchor.getAttribute("href") || "" : "";
    const section = anchor.closest("section")?.id || anchor.closest("header, footer")?.tagName.toLowerCase() || "page";
    const isContact = /wa\.me|whatsapp|tel:|mailto:/i.test(href);
    const isNavigation = Boolean(anchor.closest("nav"));
    const isExternal =
      anchor instanceof HTMLAnchorElement &&
      anchor.origin !== window.location.origin &&
      /^https?:/i.test(anchor.href);

    return {
      eventName: isContact
        ? "lf_contact_click"
        : isExternal
          ? "lf_outbound_click"
          : isNavigation
            ? "lf_navigation_click"
            : "lf_cta_click",
      parameters: {
        link_text: label,
        link_url: href,
        placement: section,
        element_type: anchor.tagName.toLowerCase(),
      },
    };
  };

  const initializeClickTracking = () => {
    document.addEventListener("click", (event) => {
      const trackingData = getElementTrackingData(event.target);
      if (trackingData) track(trackingData.eventName, trackingData.parameters);
    });
  };

  const initializeScrollTracking = () => {
    const evaluateScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const percentage = Math.round((window.scrollY / scrollable) * 100);

      scrollMarks.forEach((mark) => {
        if (percentage >= mark && !reachedScrollMarks.has(mark)) {
          reachedScrollMarks.add(mark);
          track("lf_scroll_depth", { percent_scrolled: mark });
        }
      });
    };

    window.addEventListener("scroll", evaluateScroll, { passive: true });
  };

  const initializeSectionTracking = () => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || viewedSections.has(entry.target.id)) return;
          viewedSections.add(entry.target.id);
          track("lf_section_view", {
            section_id: entry.target.id,
            section_title: entry.target.querySelector("h1, h2")?.textContent?.trim(),
          });
          if (entry.target.id === "analise") track("lf_form_view");
        });
      },
      { threshold: 0.35 },
    );

    sectionIds.forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  };

  const initializeFormStartTracking = () => {
    const form = document.getElementById("analysis-form");
    if (!form) return;
    form.addEventListener(
      "input",
      () => {
        if (formStarted) return;
        formStarted = true;
        track("lf_form_start", { form_id: form.id });
      },
      { once: true },
    );
  };

  const initializeVideoTracking = () => {
    const video = document.querySelector("[data-video-preview]");
    const playButton = document.querySelector("[data-video-play]");
    if (!video) return;

    track("lf_video_preview", { video_title: "Dra. Luana Lima" });
    playButton?.addEventListener("click", () => {
      if (videoStarted) return;
      videoStarted = true;
      track("lf_video_start", { video_title: "Dra. Luana Lima", playback_mode: "audio" });
    });
    video.addEventListener("timeupdate", () => {
      if (videoCompleted || video.loop || !video.duration) return;
      if (video.currentTime / video.duration >= 0.9) {
        videoCompleted = true;
        track("lf_video_complete", { video_title: "Dra. Luana Lima", percent_played: 90 });
      }
    });
  };

  const initializeFaqTracking = () => {
    document.querySelectorAll("details").forEach((item) => {
      item.addEventListener("toggle", () => {
        if (!item.open) return;
        track("lf_faq_open", {
          question: item.querySelector("summary")?.textContent?.trim(),
          placement: item.closest("section")?.id || "faq",
        });
      });
    });
  };

  const initializeEngagementTracking = () => {
    [30, 60, 120].forEach((seconds) => {
      window.setTimeout(() => {
        if (document.visibilityState !== "visible") return;
        track("lf_engaged_time", { engaged_seconds: seconds });
      }, seconds * 1000);
    });

    window.addEventListener("pagehide", () => {
      if (formStarted && !leadGenerated) {
        track("lf_form_abandon", { form_id: "analysis-form" });
      }
    });
  };

  persistCampaignContext();
  initializeClickTracking();
  initializeScrollTracking();
  initializeSectionTracking();
  initializeFormStartTracking();
  initializeVideoTracking();
  initializeFaqTracking();
  initializeEngagementTracking();

  window.gtag("consent", "default", {
    analytics_storage: hasAnalyticsConsent() ? "granted" : "denied",
    ad_storage: hasAnalyticsConsent() ? "granted" : "denied",
    ad_user_data: hasAnalyticsConsent() ? "granted" : "denied",
    ad_personalization: hasAnalyticsConsent() ? "granted" : "denied",
    wait_for_update: 500,
  });

  if (hasAnalyticsConsent()) loadProviders();
  else renderConsentBanner();

  window.LFTracking = {
    config,
    track,
    setConsent,
    reopenConsent,
    hasAnalyticsConsent,
    getCampaignContext: getStoredCampaignContext,
    getEventLog: () => [...window.__LF_EVENT_LOG__],
  };

  window.dispatchEvent(new CustomEvent("lf:tracking-ready", { detail: { config } }));
})();
