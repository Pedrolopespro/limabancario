const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".primary-navigation");
const form = document.querySelector("#analysis-form");
const formShell = document.querySelector(".form-shell");
const formQuestions = [...document.querySelectorAll("[data-form-question]")];
const progressBar = document.querySelector("[data-progress-bar]");
const progressCurrent = document.querySelector("[data-progress-current]");
const progressTotal = document.querySelector("[data-progress-total]");
const progressSection = document.querySelector("[data-progress-section]");
const nextButton = document.querySelector("[data-form-next]");
const backButton = document.querySelector("[data-form-back]");
const submitButton = document.querySelector("[data-form-submit]");
const successPanel = document.querySelector("[data-form-success]");
const resetButton = document.querySelector("[data-form-reset]");
const deliveryStatus = document.querySelector("[data-form-delivery-status]");
const yearElement = document.querySelector("[data-current-year]");
const analysisSection = document.querySelector("#analise");
const specialistSection = document.querySelector("#especialista");
const heroSection = document.querySelector("#inicio");
const videoPreview = document.querySelector("[data-video-preview]");
const videoPlayButton = document.querySelector("[data-video-play]");
const mobileCta = document.querySelector("[data-mobile-cta]");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

let currentQuestion = 0;
let choiceAdvanceTimer;
let isSubmitting = false;

const trackEvent = (eventName, parameters = {}) => {
  window.LFTracking?.track(eventName, parameters);
};

if (specialistSection && analysisSection) {
  specialistSection.insertAdjacentElement("afterend", analysisSection);
}

const closeMenu = () => {
  if (!menuToggle || !navigation) return;

  menuToggle.setAttribute("aria-expanded", "false");
  navigation.classList.remove("is-open");
  document.body.classList.remove("menu-open");
};

const updateHeader = () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 32);
};

const createMobileCtaRipple = (event) => {
  if (!mobileCta || reducedMotionQuery.matches) return;

  const rect = mobileCta.getBoundingClientRect();
  const ripple = document.createElement("span");
  ripple.className = "mobile-cta__ripple";
  ripple.style.setProperty("--ripple-x", `${event.clientX - rect.left}px`);
  ripple.style.setProperty("--ripple-y", `${event.clientY - rect.top}px`);
  mobileCta.appendChild(ripple);

  window.setTimeout(() => ripple.remove(), 650);
};

const releaseMobileCta = () => {
  mobileCta?.classList.remove("is-pressing");
};

const getQuestionFields = (questionIndex) => {
  const panel = formQuestions[questionIndex];
  return panel ? [...panel.querySelectorAll("input, textarea, select")] : [];
};

const validateQuestion = (questionIndex) => {
  const fields = getQuestionFields(questionIndex);

  for (const field of fields) {
    if (!field.checkValidity()) {
      trackEvent("lf_form_validation_error", {
        form_id: form?.id,
        question_index: questionIndex + 1,
        question_id: formQuestions[questionIndex]?.querySelector("h3")?.id,
        field_name: field.name,
        validation_type: field.validity.valueMissing ? "required" : "format",
      });
      field.reportValidity();
      return false;
    }
  }

  return true;
};

const updateFormQuestion = (questionIndex) => {
  currentQuestion = questionIndex;
  window.clearTimeout(choiceAdvanceTimer);

  formQuestions.forEach((panel, index) => {
    const isActive = index === currentQuestion;

    panel.hidden = !isActive;
    panel.classList.toggle("is-active", isActive);
  });

  const activeQuestion = formQuestions[currentQuestion];
  const isLastQuestion = currentQuestion === formQuestions.length - 1;
  const displayQuestion = String(currentQuestion + 1).padStart(2, "0");

  if (progressBar) {
    progressBar.style.width = `${((currentQuestion + 1) / formQuestions.length) * 100}%`;
  }
  if (progressCurrent) progressCurrent.textContent = displayQuestion;
  if (progressTotal) progressTotal.textContent = String(formQuestions.length).padStart(2, "0");
  if (progressSection) {
    progressSection.textContent = activeQuestion?.dataset.questionSection || "Análise";
  }
  if (backButton) backButton.hidden = currentQuestion === 0;
  if (nextButton) nextButton.hidden = isLastQuestion;
  if (submitButton) submitButton.hidden = !isLastQuestion;
  if (deliveryStatus) deliveryStatus.textContent = "";

  trackEvent("lf_form_step_view", {
    form_id: form?.id,
    question_index: currentQuestion + 1,
    question_total: formQuestions.length,
    question_id: activeQuestion?.querySelector("h3")?.id,
    question_section: activeQuestion?.dataset.questionSection,
  });

  const activeHeading = activeQuestion?.querySelector("h3");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  window.requestAnimationFrame(() => {
    activeHeading?.focus({ preventScroll: true });
    formShell?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  });
};

const advanceFormQuestion = () => {
  if (!validateQuestion(currentQuestion)) return;

  const activeQuestion = formQuestions[currentQuestion];
  trackEvent("lf_form_step_complete", {
    form_id: form?.id,
    question_index: currentQuestion + 1,
    question_total: formQuestions.length,
    question_id: activeQuestion?.querySelector("h3")?.id,
    question_section: activeQuestion?.dataset.questionSection,
  });
  updateFormQuestion(Math.min(currentQuestion + 1, formQuestions.length - 1));
};

const applyPhoneMask = (value) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
};

const applyCnpjMask = (value) =>
  value
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");

const startVideoPreview = () => {
  if (!videoPreview) return;

  videoPreview.controls = false;
  videoPreview.muted = true;
  videoPreview.loop = true;
  videoPlayButton?.removeAttribute("hidden");

  const playPromise = videoPreview.play();
  playPromise?.catch(() => {
    // O poster e o botão continuam disponíveis quando o autoplay é bloqueado.
  });
};

const playVideoWithAudio = async () => {
  if (!videoPreview) return;

  videoPreview.pause();
  videoPreview.currentTime = 0;
  videoPreview.loop = false;
  videoPreview.muted = false;
  videoPreview.controls = true;
  videoPlayButton?.setAttribute("hidden", "");

  try {
    await videoPreview.play();
  } catch {
    videoPreview.controls = false;
    startVideoPreview();
  }
};

menuToggle?.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";

  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  navigation?.classList.toggle("is-open", !isOpen);
  document.body.classList.toggle("menu-open", !isOpen);
});

navigation?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", closeMenu);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

mobileCta?.addEventListener("pointerdown", (event) => {
  mobileCta.classList.add("is-pressing");
  createMobileCtaRipple(event);
});
mobileCta?.addEventListener("pointerup", releaseMobileCta);
mobileCta?.addEventListener("pointerleave", releaseMobileCta);
mobileCta?.addEventListener("pointercancel", releaseMobileCta);

videoPlayButton?.addEventListener("click", playVideoWithAudio);
videoPreview?.addEventListener("ended", () => {
  videoPreview.currentTime = 0;
  startVideoPreview();
});
startVideoPreview();

if (analysisSection && "IntersectionObserver" in window) {
  const analysisObserver = new IntersectionObserver(
    ([entry]) => {
      document.body.classList.toggle("analysis-visible", entry.isIntersecting);
    },
    { threshold: 0.05 },
  );

  analysisObserver.observe(analysisSection);
}

if (heroSection && "IntersectionObserver" in window) {
  const heroObserver = new IntersectionObserver(
    ([entry]) => {
      document.body.classList.toggle("past-hero", !entry.isIntersecting);
    },
    { threshold: 0.05 },
  );

  heroObserver.observe(heroSection);
}

nextButton?.addEventListener("click", () => {
  advanceFormQuestion();
});

backButton?.addEventListener("click", () => {
  trackEvent("lf_form_back", {
    form_id: form?.id,
    from_question: currentQuestion + 1,
    to_question: Math.max(currentQuestion, 1),
  });
  updateFormQuestion(Math.max(currentQuestion - 1, 0));
});

form?.querySelectorAll('input[type="radio"]').forEach((field) => {
  field.addEventListener("change", () => {
    choiceAdvanceTimer = window.setTimeout(() => {
      const activeQuestion = formQuestions[currentQuestion];
      if (activeQuestion?.contains(field) && field.checked) advanceFormQuestion();
    }, 280);
  });
});

form?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.target instanceof HTMLTextAreaElement) return;
  if (currentQuestion === formQuestions.length - 1) return;

  event.preventDefault();
  advanceFormQuestion();
});

document.querySelectorAll("[data-mask]").forEach((field) => {
  field.addEventListener("input", () => {
    field.value =
      field.dataset.mask === "phone" ? applyPhoneMask(field.value) : applyCnpjMask(field.value);
  });
});

const serializeForm = () => {
  const formData = new FormData(form);
  return Object.fromEntries(formData.entries());
};

const leadFieldLabels = {
  debt_amount: "Valor aproximado das dívidas",
  debt_type: "Dívida que mais preocupa",
  lawsuit: "Existe processo judicial",
  asset_block: "Bloqueio, penhora ou risco",
  company: "Empresa",
  cnpj: "CNPJ",
  location: "Cidade/Estado",
  case_note: "Principal preocupação",
  name: "Nome",
  phone: "WhatsApp",
  email: "E-mail",
  consent: "Autorização de contato",
};

const buildLeadPayload = () => {
  const campaign = window.LFTracking?.getCampaignContext?.() || {};
  return {
    ...serializeForm(),
    ...campaign,
    source: "landing_page",
    page_url: window.location.href,
    page_title: document.title,
    referrer: document.referrer || "",
    submitted_at: new Date().toISOString(),
  };
};

const buildWhatsAppMessage = (payload, formConfig) => {
  const lines = [
    formConfig.whatsappFallback?.intro ||
      "Olá, Lima Ferreira Advogados. Preenchi o Raio-X da Dívida Empresarial.",
    "",
    "Resumo do caso:",
  ];

  Object.entries(leadFieldLabels).forEach(([field, label]) => {
    if (!payload[field]) return;
    lines.push(`${label}: ${payload[field] === "on" ? "Sim" : payload[field]}`);
  });

  lines.push("", `Página de origem: ${payload.page_url}`);

  return lines.join("\n");
};

const openWhatsAppFallback = (payload, formConfig) => {
  const fallback = formConfig.whatsappFallback || {};
  const number = String(fallback.number || "").replace(/\D/g, "");

  if (!fallback.enabled || !number) {
    throw new Error("O canal de recebimento ainda não foi configurado.");
  }

  const message = encodeURIComponent(buildWhatsAppMessage(payload, formConfig));
  const url = `https://wa.me/${number}?text=${message}`;
  const openedWindow = window.open(url, "_blank", "noopener,noreferrer");

  if (!openedWindow) {
    window.location.href = url;
  }

  return { ok: true, channel: "whatsapp", url };
};

const sendLead = async () => {
  const formConfig = window.LFTracking?.config?.form || window.LF_TRACKING_CONFIG?.form || {};
  const endpoint = formConfig.endpoint?.trim();
  const payload = buildLeadPayload();

  if (!endpoint) {
    return openWhatsAppFallback(payload, formConfig);
  }

  const isFormEncoded = formConfig.format === "form";
  let response;

  try {
    response = await fetch(endpoint, {
      method: formConfig.method || "POST",
      headers: isFormEncoded ? undefined : { "Content-Type": "application/json" },
      body: isFormEncoded ? new URLSearchParams(payload) : JSON.stringify(payload),
    });
  } catch {
    return openWhatsAppFallback(payload, formConfig);
  }

  if (!response.ok) {
    return openWhatsAppFallback(payload, formConfig);
  }

  return { ok: true, channel: "webhook", response };
};

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isSubmitting || !validateQuestion(currentQuestion)) return;

  const activeQuestion = formQuestions[currentQuestion];
  trackEvent("lf_form_step_complete", {
    form_id: form.id,
    question_index: currentQuestion + 1,
    question_total: formQuestions.length,
    question_id: activeQuestion?.querySelector("h3")?.id,
    question_section: activeQuestion?.dataset.questionSection,
  });
  trackEvent("lf_form_submit_attempt", {
    form_id: form.id,
    question_total: formQuestions.length,
  });

  isSubmitting = true;
  submitButton?.setAttribute("aria-busy", "true");
  if (submitButton) submitButton.firstChild.textContent = "Enviando ";
  if (deliveryStatus) deliveryStatus.textContent = "Enviando suas informações com segurança...";

  try {
    const delivery = await sendLead();
    trackEvent("lf_form_submit", {
      form_id: form.id,
      delivery_status: "confirmed",
      delivery_channel: delivery.channel,
    });
    trackEvent("generate_lead", {
      form_id: form.id,
      lead_type: "raio_x_divida_empresarial",
      delivery_channel: delivery.channel,
      value: 1,
      currency: "BRL",
    });

    form.hidden = true;
    document.querySelector(".form-progress")?.setAttribute("hidden", "");
    const successText = successPanel?.querySelector("p:last-of-type");
    if (successText) {
      successText.textContent =
        delivery.channel === "whatsapp"
          ? "Abrimos o WhatsApp com as respostas preenchidas. Envie a mensagem para que a equipe receba o caso e faça o retorno."
          : "A equipe recebeu as informações iniciais por e-mail e entrará em contato pelos canais informados.";
    }
    successPanel.hidden = false;
    successPanel.focus();
  } catch (error) {
    trackEvent("lf_form_submit_error", {
      form_id: form.id,
      delivery_status: "failed",
      error_type: error instanceof TypeError ? "network" : "configuration_or_endpoint",
    });
    if (deliveryStatus) {
      deliveryStatus.textContent =
        error instanceof Error
          ? `${error.message} Tente novamente ou fale diretamente com a equipe.`
          : "Não foi possível enviar. Tente novamente ou fale diretamente com a equipe.";
    }
  } finally {
    isSubmitting = false;
    submitButton?.removeAttribute("aria-busy");
    if (submitButton) submitButton.firstChild.textContent = "Enviar para o Raio-X ";
  }
});

resetButton?.addEventListener("click", () => {
  form?.reset();
  form.hidden = false;
  document.querySelector(".form-progress")?.removeAttribute("hidden");
  successPanel.hidden = true;
  updateFormQuestion(0);
});

if (progressTotal) progressTotal.textContent = String(formQuestions.length).padStart(2, "0");
if (yearElement) yearElement.textContent = new Date().getFullYear();

document.querySelector("[data-privacy-settings]")?.addEventListener("click", () => {
  window.LFTracking?.reopenConsent();
});

trackEvent("lf_form_step_view", {
  form_id: form?.id,
  question_index: 1,
  question_total: formQuestions.length,
  question_id: formQuestions[0]?.querySelector("h3")?.id,
  question_section: formQuestions[0]?.dataset.questionSection,
});
