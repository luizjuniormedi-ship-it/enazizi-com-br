import { type Page } from "@playwright/test";

type Role = "student" | "professor" | "admin";

const roleEnv = {
  student: {
    email: ["E2E_USER_EMAIL", "E2E_ALUNO_EMAIL", "TEST_STUDENT_EMAIL"],
    password: ["E2E_USER_PASSWORD", "E2E_ALUNO_PASSWORD", "TEST_STUDENT_PASSWORD"],
  },
  professor: {
    email: ["E2E_PROFESSOR_EMAIL", "TEST_PROFESSOR_EMAIL", "E2E_USER_EMAIL"],
    password: ["E2E_PROFESSOR_PASSWORD", "TEST_PROFESSOR_PASSWORD", "E2E_USER_PASSWORD"],
  },
  admin: {
    email: ["E2E_ADMIN_EMAIL", "TEST_ADMIN_EMAIL", "E2E_USER_EMAIL"],
    password: ["E2E_ADMIN_PASSWORD", "TEST_ADMIN_PASSWORD", "E2E_USER_PASSWORD"],
  },
} as const;

function firstEnv(names: readonly string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

export function getCredentials(role: Role = "student") {
  return {
    email: firstEnv(roleEnv[role].email),
    password: firstEnv(roleEnv[role].password),
  };
}

export function hasCredentials(role: Role = "student") {
  const credentials = getCredentials(role);
  return Boolean(credentials.email && credentials.password);
}

export async function loginAs(page: Page, role: Role = "student", baseUrl = "") {
  const { email, password } = getCredentials(role);
  if (!email || !password) {
    throw new Error(
      `Credenciais E2E ausentes para ${role}. Configure uma das combinações esperadas de email/senha.`,
    );
  }

  await page.addInitScript(() => {
    localStorage.setItem("enazizi_v2_welcome_seen", "true");
    localStorage.setItem("enazizi_v2_onboarding_done", "true");
  });

  await page.goto(`${baseUrl}/login`);
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  await page.locator('input[type="password"], input[name="password"]').first().fill(password);
  await page.getByRole("button", { name: /entrar|login/i }).first().click();

  const leftLogin = await page.waitForURL((url) => !/\/login(?:\?|$)/.test(url.pathname), {
    timeout: 20_000,
  }).then(() => true).catch(() => false);

  if (!leftLogin) {
    await page.locator('input[type="password"], input[name="password"]').first().fill("").catch(() => {});
    await page.locator('input[type="email"], input[name="email"]').first().fill("").catch(() => {});
    throw new Error(`login ${role} não saiu de /login`);
  }

  await page.evaluate(() => {
    localStorage.setItem("enazizi_v2_welcome_seen", "true");
    localStorage.setItem("enazizi_v2_onboarding_done", "true");
  });

  const skipOnboarding = page.getByRole("button", { name: /Pular e ir ao Dashboard|Iniciar Configuração/i }).first();
  if (await skipOnboarding.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await page.evaluate(() => {
      localStorage.setItem("enazizi_v2_welcome_seen", "true");
      localStorage.setItem("enazizi_v2_onboarding_done", "true");
    });
    await page.getByRole("button", { name: /Pular e ir ao Dashboard/i }).click().catch(() => {});
  }
}
