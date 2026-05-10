/**
 * routeAssertions — Fase 2 Mobile Hardening
 * NÃO ATIVAR em produção durante o freeze. Uso em DEV/CI.
 *
 * Verifica que todos os href/Link apontam para rotas declaradas no router.
 * Recebe a lista de rotas conhecidas (extraída de App.tsx ou similar).
 */

export interface RouteAssertionResult {
  href: string;
  element: HTMLElement;
  reason: "unknown-route" | "external-without-noopener" | "empty-href";
}

export interface AssertRoutesOptions {
  /** Caminhos válidos (ex: ["/", "/missao-estudo", "/tutor"]). */
  knownRoutes: string[];
  /** Permitir rotas dinâmicas? Ex: /missao/:id  (matching por prefixo). */
  allowPrefixes?: string[];
  root?: HTMLElement;
}

export function assertRoutes(opts: AssertRoutesOptions): RouteAssertionResult[] {
  const { knownRoutes, allowPrefixes = [], root = document.body } = opts;
  const out: RouteAssertionResult[] = [];

  const anchors = Array.from(root.querySelectorAll("a")) as HTMLAnchorElement[];
  for (const a of anchors) {
    const href = a.getAttribute("href");
    if (!href) {
      out.push({ href: "", element: a, reason: "empty-href" });
      continue;
    }
    if (/^https?:\/\//.test(href)) {
      const rel = a.getAttribute("rel") ?? "";
      if (a.target === "_blank" && !rel.includes("noopener")) {
        out.push({ href, element: a, reason: "external-without-noopener" });
      }
      continue;
    }
    const path = href.split("?")[0].split("#")[0];
    const known = knownRoutes.includes(path);
    const prefixOk = allowPrefixes.some((p) => path.startsWith(p));
    if (!known && !prefixOk) {
      out.push({ href, element: a, reason: "unknown-route" });
    }
  }
  return out;
}
