const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".primary-navigation");
const form = document.querySelector("#analysis-form");
const formSteps = [...document.querySelectorAll("[data-form-step]")];
const stepIndicators = [...document.querySelectorAll("[data-step-indicator]")];
const progressBar = document.querySelector("[data-progress-bar]");
const nextButton = document.querySelector("[data-form-next]");
const backButton = document.querySelector("[data-form-back]");
const submitButton = document.querySelector("[data-form-submit]");
const successPanel = document.querySelector("[data-form-success]");
const resetButton = document.querySelector("[data-form-reset]");
const yearElement = document.querySelector("[data-current-year]");
const analysisSection = document.querySelector("#analise");
const strategyDiagram = document.querySelector("[data-strategy-diagram]");

let currentStep = 1;

const closeMenu = () => {
  if (!menuToggle || !navigation) return;

  menuToggle.setAttribute("aria-expanded", "false");
  navigation.classList.remove("is-open");
  document.body.classList.remove("menu-open");
};

const updateHeader = () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 32);
};

const getStepFields = (step) => {
  const panel = formSteps.find((item) => Number(item.dataset.formStep) === step);
  return panel ? [...panel.querySelectorAll("input, textarea, select")] : [];
};

const validateStep = (step) => {
  const fields = getStepFields(step);

  for (const field of fields) {
    if (!field.checkValidity()) {
      field.reportValidity();
      return false;
    }
  }

  return true;
};

const updateFormStep = (step) => {
  currentStep = step;

  formSteps.forEach((panel) => {
    const panelStep = Number(panel.dataset.formStep);
    const isActive = panelStep === currentStep;

    panel.hidden = !isActive;
    panel.classList.toggle("is-active", isActive);
  });

  stepIndicators.forEach((indicator) => {
    const indicatorStep = Number(indicator.dataset.stepIndicator);
    const isActive = indicatorStep === currentStep;

    indicator.classList.toggle("is-active", isActive);
    indicator.classList.toggle("is-complete", indicatorStep < currentStep);
    if (isActive) {
      indicator.setAttribute("aria-current", "step");
    } else {
      indicator.removeAttribute("aria-current");
    }
  });

  if (progressBar) progressBar.style.width = `${(currentStep / formSteps.length) * 100}%`;
  if (backButton) backButton.hidden = currentStep === 1;
  if (nextButton) nextButton.hidden = currentStep === formSteps.length;
  if (submitButton) submitButton.hidden = currentStep !== formSteps.length;

  const activeHeading = formSteps
    .find((panel) => Number(panel.dataset.formStep) === currentStep)
    ?.querySelector("h3");
  activeHeading?.focus({ preventScroll: true });
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

if (analysisSection && "IntersectionObserver" in window) {
  const analysisObserver = new IntersectionObserver(
    ([entry]) => {
      document.body.classList.toggle("analysis-visible", entry.isIntersecting);
    },
    { threshold: 0.05 },
  );

  analysisObserver.observe(analysisSection);
}

if (strategyDiagram && "IntersectionObserver" in window) {
  const strategyObserver = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) strategyDiagram.classList.add("is-visible");
    },
    { threshold: 0.35 },
  );

  strategyObserver.observe(strategyDiagram);
} else {
  strategyDiagram?.classList.add("is-visible");
}

nextButton?.addEventListener("click", () => {
  if (!validateStep(currentStep)) return;
  updateFormStep(Math.min(currentStep + 1, formSteps.length));
});

backButton?.addEventListener("click", () => {
  updateFormStep(Math.max(currentStep - 1, 1));
});

document.querySelectorAll("[data-mask]").forEach((field) => {
  field.addEventListener("input", () => {
    field.value =
      field.dataset.mask === "phone" ? applyPhoneMask(field.value) : applyCnpjMask(field.value);
  });
});

form?.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!validateStep(currentStep)) return;

  form.hidden = true;
  document.querySelector(".form-progress")?.setAttribute("hidden", "");
  successPanel.hidden = false;
  successPanel.focus();
});

resetButton?.addEventListener("click", () => {
  form?.reset();
  form.hidden = false;
  document.querySelector(".form-progress")?.removeAttribute("hidden");
  successPanel.hidden = true;
  updateFormStep(1);
});

if (yearElement) yearElement.textContent = new Date().getFullYear();
