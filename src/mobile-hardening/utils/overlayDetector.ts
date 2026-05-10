/**
 * overlayDetector — Fase 2 Mobile Hardening
 * NÃO ATIVAR em produção durante o freeze. Uso interno em DEV/CI.
 *
 * Detecta padrões comuns que causam "botão morto":
 * - <div class="absolute inset-0"> sem pointer-events-none cobrindo CTAs
 * - containers com pointer-events-none que envolvem elementos clicáveis
 * - elementos clicáveis com z-index abaixo de outro elemento sob o cursor
 */

export interface OverlayIssue {
  type:
    | "blocking-overlay"
    | "pointer-events-none-on-clickable"
    | "covered-by-sibling";
  element: HTMLElement;
  blockingElement?: HTMLElement;
  message: string;
}

const CLICKABLE_SELECTOR =
  'button, a[href], [role="button"], [role="link"], input, textarea, select, [tabindex]:not([tabindex="-1"])';

function isClickable(el: Element): el is HTMLElement {
  return el instanceof HTMLElement && el.matches(CLICKABLE_SELECTOR);
}

function hasPointerEventsNone(el: HTMLElement): boolean {
  return getComputedStyle(el).pointerEvents === "none";
}

export function detectOverlayIssues(root: HTMLElement = document.body): OverlayIssue[] {
  const issues: OverlayIssue[] = [];
  const clickables = Array.from(root.querySelectorAll(CLICKABLE_SELECTOR)).filter(
    isClickable
  );

  for (const el of clickables) {
    if (!(el.offsetParent !== null)) continue; // invisível

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    // 1. Container ancestral com pointer-events-none?
    let parent: HTMLElement | null = el.parentElement;
    while (parent && parent !== root) {
      if (hasPointerEventsNone(parent) && !hasPointerEventsNone(el)) {
        issues.push({
          type: "pointer-events-none-on-clickable",
          element: el,
          blockingElement: parent,
          message: `Clickable "${describe(el)}" está dentro de container com pointer-events:none ("${describe(parent)}").`,
        });
        break;
      }
      parent = parent.parentElement;
    }

    // 2. Outro elemento cobrindo o centro?
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const top = document.elementFromPoint(cx, cy);
    if (
      top &&
      top !== el &&
      !el.contains(top) &&
      !top.contains(el) &&
      !hasPointerEventsNone(top as HTMLElement)
    ) {
      issues.push({
        type: "covered-by-sibling",
        element: el,
        blockingElement: top as HTMLElement,
        message: `Clickable "${describe(el)}" está coberto por "${describe(top as HTMLElement)}".`,
      });
    }
  }

  return issues;
}

function describe(el: HTMLElement): string {
  const id = el.id ? `#${el.id}` : "";
  const cls =
    el.className && typeof el.className === "string"
      ? "." + el.className.split(/\s+/).slice(0, 2).join(".")
      : "";
  return `${el.tagName.toLowerCase()}${id}${cls}`;
}

/** Hook útil em DEV: roda detector e loga no console. */
export function logOverlayIssues(root?: HTMLElement): void {
  const issues = detectOverlayIssues(root);
  if (issues.length === 0) {
    console.info("[overlayDetector] Nenhum problema encontrado.");
    return;
  }
  console.group(`[overlayDetector] ${issues.length} problema(s):`);
  issues.forEach((i) => console.warn(i.message, i));
  console.groupEnd();
}
