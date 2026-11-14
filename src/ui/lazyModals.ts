export type ModalId =
  | "historical-audits"
  | "research-library"
  | "ai-advisor"
  | "accuracy-provenance"
  | "neighborhood-compare"
  | "methodology";

const MODAL_ENDPOINTS: Record<ModalId, string> = {
  "historical-audits": "/data/modals/historical_audits.json",
  "research-library": "/data/modals/study_library_540.json",
  "ai-advisor": "/data/modals/advisor_templates.json",
  "accuracy-provenance": "/data/modals/accuracy_provenance.json",
  "neighborhood-compare": "/data/modals/compare_schema.json",
  "methodology": "/data/modals/methodology_vintages.json",
};

const modalCache = new Map<ModalId, unknown>();

export async function openLazyModal(
  modalId: ModalId,
  containerEl: HTMLElement,
  renderFn: (data: unknown) => string
): Promise<void> {
  containerEl.hidden = false;
  containerEl.setAttribute("aria-busy", "true");

  if (!modalCache.has(modalId)) {
    containerEl.innerHTML = `<div class="modal-skeleton" role="status">Loading ${modalId.replace("-", " ")}…</div>`;
    const response = await fetch(MODAL_ENDPOINTS[modalId]);
    if (!response.ok) {
      containerEl.innerHTML = `<p role="alert">Failed to load dataset (${response.status}).</p>`;
      containerEl.setAttribute("aria-busy", "false");
      return;
    }
    const payload = await response.json();
    modalCache.set(modalId, payload);
  }

  containerEl.innerHTML = renderFn(modalCache.get(modalId));
  containerEl.setAttribute("aria-busy", "false");
}
