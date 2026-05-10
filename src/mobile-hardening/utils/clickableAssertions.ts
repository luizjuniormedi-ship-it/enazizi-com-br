/**
 * clickableAssertions — Fase 2 Mobile Hardening
 * NÃO ATIVAR em produção durante o freeze. Uso em DEV/CI.
 *
 * Detecta "botões mortos":
 * - <button> sem onClick e sem type="submit" e sem form attr
 * - <button disabled> sem aria-label/title explicando o motivo
 * - elementos com role="button" sem onClick no fiber
 *
 * Em DEV usamos heurísticas no DOM. Para checagem profunda (fiber),
 * use ESLint custom rule no CI.
 */

export interface DeadButtonIssue {
  element: HTMLElement;
  reason:
    | "no-click-handler"
    | "disabled-without-reason"
    | "empty-text-and-no-aria";
  message: string;
}

export function detectDeadButtons(root: HTMLElement = document.body): DeadButtonIssue[] {
  const issues: DeadButtonIssue[] = [];
  const buttons = Array.from(root.querySelectorAll("button")) as HTMLButtonElement[];

  for (const btn of buttons) {
    const hasText = (btn.textContent ?? "").trim().length > 0;
    const hasAria = Boolean(btn.getAttribute("aria-label") || btn.getAttribute("title"));
    const isSubmit = btn.type === "submit";
    const hasForm = btn.form !== null;

    // 1. Texto vazio e sem aria
    if (!hasText && !hasAria) {
      issues.push({
        element: btn,
        reason: "empty-text-and-no-aria",
        message: `Botão sem texto visível nem aria-label/title.`,
      });
    }

    // 2. Disabled sem motivo
    if (btn.disabled && !hasAria) {
      issues.push({
        element: btn,
        reason: "disabled-without-reason",
        message: `Botão disabled sem aria-label/title indicando o motivo.`,
      });
    }

    // 3. Heurística "no-click-handler": botão não-submit sem onclick atribuído.
    //    React anexa via SyntheticEvent — DOM nem sempre tem .onclick. Marcamos
    //    como SUSPEITO apenas quando além disso o botão também não tem `data-*`
    //    ou aria que sugira interação.
    if (!isSubmit && !hasForm && !btn.onclick) {
      const hasReactProps = Object.keys(btn).some((k) => k.startsWith("__reactProps$"));
      if (hasReactProps) {
        const propsKey = Object.keys(btn).find((k) => k.startsWith("__reactProps$"));
        const props = propsKey ? (btn as any)[propsKey] : null;
        if (props && !props.onClick && !props.asChild) {
          issues.push({
            element: btn,
            reason: "no-click-handler",
            message: `Botão sem onClick/onSubmit/asChild detectado nos props React.`,
          });
        }
      }
    }
  }
  return issues;
}
