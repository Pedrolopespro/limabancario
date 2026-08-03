(function initializeTrackingPanel() {
  "use strict";

  const accessHash = "18575e7e46ca29367b43f09f026e1ba4d8a7f6026aee92bc1545ec56de2738ef";
  const repository = "Pedrolopespro/limabancario";
  const configPath = "scripts/tracking-config.js";
  const previewStorageKey = "lf_tracking_preview_config";
  const eventLogKey = "lf_tracking_event_log";
  const accessGate = document.querySelector("[data-access-gate]");
  const accessForm = document.querySelector("[data-access-form]");
  const accessInput = accessForm?.elements.access_key;
  const accessVisibilityToggle = document.querySelector("[data-access-visibility]");
  const accessMessage = document.querySelector("[data-access-message]");
  const panel = document.querySelector("[data-panel]");
  const configForm = document.querySelector("[data-config-form]");
  const publishMessage = document.querySelector("[data-publish-message]");
  const webhookMessage = document.querySelector("[data-webhook-message]");
  const eventLog = document.querySelector("[data-event-log]");
  const currentConfig = window.LF_TRACKING_CONFIG || {};

  const digest = async (value) => {
    const encoded = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest("SHA-256", encoded);
    return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  const setAccessVisibility = (isVisible) => {
    if (!accessInput || !accessVisibilityToggle) return;
    accessInput.type = isVisible ? "text" : "password";
    accessVisibilityToggle.textContent = isVisible ? "Ocultar" : "Mostrar";
    accessVisibilityToggle.setAttribute("aria-pressed", String(isVisible));
    accessVisibilityToggle.setAttribute(
      "aria-label",
      isVisible ? "Ocultar chave de acesso" : "Mostrar chave de acesso",
    );
  };

  const unlockPanel = () => {
    sessionStorage.setItem("lf_tracking_panel_access", "granted");
    accessGate.hidden = true;
    panel.hidden = false;
    configForm.elements.gtmId.focus();
  };

  const lockPanel = () => {
    sessionStorage.removeItem("lf_tracking_panel_access");
    panel.hidden = true;
    accessGate.hidden = false;
    accessForm.reset();
    setAccessVisibility(false);
    accessForm.elements.access_key.focus();
  };

  const setStatus = (key, active, text) => {
    document.querySelector(`[data-status-dot="${key}"]`)?.classList.toggle("is-active", active);
    const label = document.querySelector(`[data-status-text="${key}"]`);
    if (label) label.textContent = text;
  };

  const isValidId = (value, pattern) => !value || pattern.test(value);

  const readFormConfig = () => ({
    version: new Date().toISOString().slice(0, 10),
    environment: "production",
    siteName: "Lima Ferreira Direito Bancário Empresarial",
    gtmId: configForm.elements.gtmId.value.trim(),
    ga4MeasurementId: configForm.elements.ga4MeasurementId.value.trim(),
    metaPixelId: configForm.elements.metaPixelId.value.trim(),
    googleAdsId: configForm.elements.googleAdsId.value.trim(),
    googleAdsLeadLabel: configForm.elements.googleAdsLeadLabel.value.trim(),
    loadMetaDirectly: configForm.elements.loadMetaDirectly.checked,
    debug: configForm.elements.debug.checked,
    consent: {
      required: configForm.elements.consentRequired.checked,
      policyVersion: currentConfig.consent?.policyVersion || "2026-06",
    },
    form: {
      endpoint: configForm.elements.formEndpoint.value.trim(),
      method: configForm.elements.formMethod.value,
      format: configForm.elements.formFormat.value,
    },
  });

  const validateConfig = (config) => {
    const errors = [];
    if (!isValidId(config.gtmId, /^GTM-[A-Z0-9]+$/i)) errors.push("O ID do GTM é inválido.");
    if (!isValidId(config.ga4MeasurementId, /^G-[A-Z0-9]+$/i)) {
      errors.push("O ID do GA4 é inválido.");
    }
    if (!isValidId(config.metaPixelId, /^\d{5,25}$/)) errors.push("O ID do Meta Pixel é inválido.");
    if (!isValidId(config.googleAdsId, /^AW-[A-Z0-9]+$/i)) {
      errors.push("O ID do Google Ads é inválido.");
    }
    if (config.form.endpoint && !/^https:\/\//i.test(config.form.endpoint)) {
      errors.push("O webhook deve usar HTTPS.");
    }
    if (config.googleAdsId && !config.googleAdsLeadLabel) {
      errors.push("Informe o rótulo da conversão do Google Ads.");
    }
    if (config.gtmId && config.ga4MeasurementId) {
      errors.push(
        "Atenção: confirme que o GA4 não está também dentro do GTM para evitar pageviews duplicados.",
      );
    }
    return errors;
  };

  const updateStatusCards = (config) => {
    setStatus("gtm", Boolean(config.gtmId), config.gtmId || "Não configurado");
    setStatus("ga4", Boolean(config.ga4MeasurementId), config.ga4MeasurementId || "Não configurado");
    setStatus("meta", Boolean(config.metaPixelId), config.metaPixelId || "Não configurado");
    setStatus(
      "form",
      Boolean(config.form?.endpoint),
      config.form?.endpoint ? "Webhook ativo" : "Não configurado",
    );
  };

  const fillForm = (config) => {
    configForm.elements.gtmId.value = config.gtmId || "";
    configForm.elements.ga4MeasurementId.value = config.ga4MeasurementId || "";
    configForm.elements.metaPixelId.value = config.metaPixelId || "";
    configForm.elements.googleAdsId.value = config.googleAdsId || "";
    configForm.elements.googleAdsLeadLabel.value = config.googleAdsLeadLabel || "";
    configForm.elements.loadMetaDirectly.checked = config.loadMetaDirectly !== false;
    configForm.elements.formEndpoint.value = config.form?.endpoint || "";
    configForm.elements.formFormat.value = config.form?.format || "json";
    configForm.elements.formMethod.value = config.form?.method || "POST";
    configForm.elements.consentRequired.checked = config.consent?.required !== false;
    configForm.elements.debug.checked = Boolean(config.debug);
    updateStatusCards(config);
  };

  const createConfigSource = (config) =>
    `window.LF_TRACKING_CONFIG = ${JSON.stringify(config, null, 2)};\n`;

  const encodeBase64 = (source) => {
    const bytes = new TextEncoder().encode(source);
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
  };

  const githubRequest = async (url, token, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...options.headers,
      },
    });

    if (!response.ok) {
      let details = "";
      try {
        details = (await response.json()).message;
      } catch {
        details = response.statusText;
      }
      throw new Error(`GitHub respondeu ${response.status}: ${details}`);
    }

    return response.json();
  };

  const publishConfig = async (config, token, branch) => {
    const apiUrl = `https://api.github.com/repos/${repository}/contents/${configPath}`;
    const currentFile = await githubRequest(`${apiUrl}?ref=${encodeURIComponent(branch)}`, token);
    return githubRequest(apiUrl, token, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Atualiza configuracao de rastreamento",
        content: encodeBase64(createConfigSource(config)),
        sha: currentFile.sha,
        branch,
      }),
    });
  };

  const renderEventLog = () => {
    let events = [];
    try {
      events = JSON.parse(localStorage.getItem(eventLogKey) || "[]");
    } catch {
      events = [];
    }

    if (!events.length) {
      eventLog.innerHTML = "<p>Nenhum evento de prévia registrado neste navegador.</p>";
      return;
    }

    eventLog.innerHTML = events
      .slice(-30)
      .reverse()
      .map(
        (event) => `
          <div class="event-log__item">
            <strong>${event.event || "evento"}</strong>
            <span>${event.event_time ? new Date(event.event_time).toLocaleString("pt-BR") : ""}</span>
          </div>
        `,
      )
      .join("");
  };

  accessForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submittedHash = await digest(accessForm.elements.access_key.value);
    if (submittedHash !== accessHash) {
      accessMessage.textContent = "Chave incorreta.";
      return;
    }
    accessMessage.textContent = "";
    unlockPanel();
  });

  accessVisibilityToggle?.addEventListener("click", () => {
    setAccessVisibility(accessInput?.type === "password");
  });

  document.querySelector("[data-lock-panel]")?.addEventListener("click", lockPanel);

  configForm?.addEventListener("input", () => {
    updateStatusCards(readFormConfig());
    publishMessage.textContent = "";
  });

  document.querySelector("[data-save-preview]")?.addEventListener("click", () => {
    const config = { ...readFormConfig(), debug: true, environment: "preview" };
    const errors = validateConfig(config);
    if (errors.some((error) => !error.startsWith("Atenção:"))) {
      publishMessage.textContent = errors.join(" ");
      return;
    }
    localStorage.setItem(previewStorageKey, JSON.stringify(config));
    publishMessage.textContent = "Prévia salva neste navegador. Abra o teste para validar os eventos.";
  });

  document.querySelector("[data-open-preview]")?.addEventListener("click", () => {
    const config = { ...readFormConfig(), debug: true, environment: "preview" };
    localStorage.setItem(previewStorageKey, JSON.stringify(config));
    window.open("../?lf_tracking_preview=1", "_blank", "noopener");
  });

  document.querySelector("[data-test-webhook]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const config = readFormConfig();
    if (!config.form.endpoint) {
      webhookMessage.textContent = "Informe a URL do webhook antes de testar.";
      return;
    }
    if (!/^https:\/\//i.test(config.form.endpoint)) {
      webhookMessage.textContent = "O webhook precisa usar HTTPS.";
      return;
    }

    button.disabled = true;
    webhookMessage.textContent = "Enviando evento de teste sem dados pessoais...";
    const testPayload = {
      test: true,
      source: "tracking_panel",
      submitted_at: new Date().toISOString(),
    };
    const isFormEncoded = config.form.format === "form";

    try {
      const response = await fetch(config.form.endpoint, {
        method: config.form.method,
        headers: isFormEncoded ? undefined : { "Content-Type": "application/json" },
        body: isFormEncoded
          ? new URLSearchParams(testPayload)
          : JSON.stringify(testPayload),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      webhookMessage.textContent = `Conexão confirmada com status ${response.status}.`;
    } catch (error) {
      webhookMessage.textContent = `Falha no teste: ${
        error instanceof Error ? error.message : "erro de rede ou CORS"
      }.`;
    } finally {
      button.disabled = false;
    }
  });

  configForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const config = readFormConfig();
    const token = configForm.elements.githubToken.value.trim();
    const branch = configForm.elements.githubBranch.value.trim() || "main";
    const errors = validateConfig(config);
    const blockingErrors = errors.filter((error) => !error.startsWith("Atenção:"));

    if (blockingErrors.length) {
      publishMessage.textContent = blockingErrors.join(" ");
      return;
    }
    if (!token) {
      publishMessage.textContent = "Informe o token temporário do GitHub para publicar.";
      return;
    }

    const submitButton = configForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Publicando...";
    publishMessage.textContent = "Enviando a configuração ao GitHub...";

    try {
      const result = await publishConfig(config, token, branch);
      configForm.elements.githubToken.value = "";
      updateStatusCards(config);
      publishMessage.innerHTML = `Configuração publicada. <a href="${result.commit.html_url}" target="_blank" rel="noreferrer">Ver commit</a>. O Pages será atualizado automaticamente.`;
    } catch (error) {
      publishMessage.textContent =
        error instanceof Error ? error.message : "Não foi possível publicar a configuração.";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Publicar configuração";
    }
  });

  document.querySelector("[data-clear-log]")?.addEventListener("click", () => {
    localStorage.removeItem(eventLogKey);
    renderEventLog();
  });

  fillForm(currentConfig);
  renderEventLog();

  if (sessionStorage.getItem("lf_tracking_panel_access") === "granted") unlockPanel();
  else accessForm?.elements.access_key.focus();
})();
