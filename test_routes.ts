import { chromium } from "playwright";

const routes = [
  "/",
  "/login",
  "/dashboard",
  "/dashboard/flashcards",
  "/dashboard/simulados",
  "/dashboard/banco-erros",
  "/dashboard/planner",
  "/dashboard/sessao-estudo",
  "/dashboard/image-quiz",
  "/dashboard/analytics",
  "/dashboard/perfil",
  "/admin",
  "/professor",
  "/enaflix",
  "/dashboard/questoes-imagem", // Should redirect
  "/dashboard/admin", // Should redirect
  "/dashboard/professor", // Should redirect
];

async function testRoutes() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const results = [];

  for (const route of routes) {
    const url = `http://localhost:8080${route}`;
    try {
      const response = await page.goto(url);
      const finalUrl = page.url();
      results.push({
        route,
        status: response?.status(),
        finalUrl,
        redirected: finalUrl !== url && !finalUrl.includes("login") // Ignore auth redirects for now
      });
    } catch (e) {
      results.push({ route, status: "ERROR", error: e.message });
    }
  }

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}

testRoutes();
