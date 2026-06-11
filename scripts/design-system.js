const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".primary-navigation");
const gridToggle = document.querySelector(".grid-toggle");
const colorSwatches = document.querySelectorAll("[data-copy]");
const interactionNote = document.querySelector(".interaction-note");

const closeMenu = () => {
  if (!menuToggle || !navigation) return;

  menuToggle.setAttribute("aria-expanded", "false");
  navigation.classList.remove("is-open");
  document.body.classList.remove("menu-open");
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

gridToggle?.addEventListener("click", () => {
  const isActive = gridToggle.getAttribute("aria-pressed") === "true";

  gridToggle.setAttribute("aria-pressed", String(!isActive));
  document.body.classList.toggle("show-grid", !isActive);
});

colorSwatches.forEach((swatch) => {
  swatch.addEventListener("click", async () => {
    const value = swatch.dataset.copy;

    try {
      await navigator.clipboard.writeText(value);
      if (interactionNote) interactionNote.textContent = `${value} copiado.`;
    } catch {
      if (interactionNote) interactionNote.textContent = `Cor selecionada: ${value}.`;
    }
  });
});
