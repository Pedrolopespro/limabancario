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
const yearElement = document.querySelector("[data-current-year]");
const analysisSection = document.querySelector("#analise");
const specialistSection = document.querySelector("#especialista");
const heroSection = document.querySelector("#inicio");
const videoPreview = document.querySelector("[data-video-preview]");
const videoPlayButton = document.querySelector("[data-video-play]");

let currentQuestion = 0;
let choiceAdvanceTimer;

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

const getQuestionFields = (questionIndex) => {
  const panel = formQuestions[questionIndex];
  return panel ? [...panel.querySelectorAll("input, textarea, select")] : [];
};

const validateQuestion = (questionIndex) => {
  const fields = getQuestionFields(questionIndex);

  for (const field of fields) {
    if (!field.checkValidity()) {
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

form?.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!validateQuestion(currentQuestion)) return;

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
  updateFormQuestion(0);
});

if (progressTotal) progressTotal.textContent = String(formQuestions.length).padStart(2, "0");
if (yearElement) yearElement.textContent = new Date().getFullYear();
