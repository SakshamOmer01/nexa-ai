import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

/**
 * Browser flows against the real stack: Next.js BFF + FastAPI + database.
 *
 * Each test gets a fresh browser context and a unique account. Accounts are seeded through the API
 * only when a test is about an existing user; signup itself goes through the UI so the form, BFF,
 * cookies and redirect are covered end to end.
 */

const BASE_URL = (process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const API_URL = (process.env.E2E_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");
const PASSWORD = "e2e-password-123";
const ACCESS_COOKIE = "nexa_access_token";
const REFRESH_COOKIE = "nexa_refresh_token";

function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function createAccount(
  request: APIRequestContext,
  email: string,
  fullName: string,
): Promise<void> {
  const response = await request.post(`${API_URL}/auth/signup`, {
    data: { email, password: PASSWORD, full_name: fullName },
  });
  expect(response.status(), await response.text()).toBe(201);
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function sessionCookies(context: BrowserContext) {
  const cookies = await context.cookies();
  return {
    access: cookies.find((cookie) => cookie.name === ACCESS_COOKIE),
    refresh: cookies.find((cookie) => cookie.name === REFRESH_COOKIE),
  };
}

/** A structurally valid JWT whose `exp` is in the past, so the proxy must refresh it. */
function staleAccessToken(): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const issuedAt = Math.floor(Date.now() / 1000) - 120;
  return [
    encode({ alg: "HS256", typ: "JWT" }),
    encode({ sub: "stale-access-token", iat: issuedAt, exp: issuedAt + 30 }),
    "not-a-real-signature",
  ].join(".");
}

test("signup creates an account and opens the dashboard", async ({ page, context }) => {
  const email = uniqueEmail("signup");

  await page.goto("/signup");
  await page.getByLabel(/Full name/).fill("Ada Lovelace");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Welcome back, Ada Lovelace" })).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();

  const { access, refresh } = await sessionCookies(context);
  expect(access, "access cookie").toBeDefined();
  expect(refresh, "refresh cookie").toBeDefined();
  expect(access?.httpOnly).toBe(true);
  expect(refresh?.httpOnly).toBe(true);
  expect(access?.value).not.toBe(refresh?.value);
});

test("login signs in an existing account", async ({ page, request, context }) => {
  const email = uniqueEmail("login");
  await createAccount(request, email, "Grace Hopper");

  await signIn(page, email);
  await expect(page.getByRole("heading", { name: "Welcome back, Grace Hopper" })).toBeVisible();
  await expect(page.getByText("Authenticated")).toBeVisible();

  const { access } = await sessionCookies(context);
  expect(access?.httpOnly).toBe(true);
});

test("a wrong password is rejected without creating a session", async ({
  page,
  request,
  context,
}) => {
  const email = uniqueEmail("wrong-password");
  await createAccount(request, email, "Mary Jackson");

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("definitely-not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  // Scope to the form: Next.js also renders a route-announcer element with role="alert".
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Invalid email or password.",
  );
  await expect(page).toHaveURL(/\/login$/);

  const { access, refresh } = await sessionCookies(context);
  expect(access, "access cookie").toBeUndefined();
  expect(refresh, "refresh cookie").toBeUndefined();
});

test("signup rejects an email that is already registered", async ({ page, request, context }) => {
  const email = uniqueEmail("duplicate");
  await createAccount(request, email, "Original Owner");

  await page.goto("/signup");
  await page.getByLabel(/Full name/).fill("Second Owner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "An account with this email already exists.",
  );
  await expect(page).toHaveURL(/\/signup$/);

  const { access, refresh } = await sessionCookies(context);
  expect(access, "access cookie").toBeUndefined();
  expect(refresh, "refresh cookie").toBeUndefined();
});

test("a cross-origin auth POST is rejected before it reaches the API", async ({ request }) => {
  const response = await request.post(`${BASE_URL}/api/auth/signup`, {
    headers: { Origin: "https://attacker.example" },
    data: { email: uniqueEmail("csrf"), password: PASSWORD },
  });

  expect(response.status()).toBe(403);
  expect(await response.json()).toMatchObject({ error: { code: "csrf_rejected" } });
  expect(response.headers()["set-cookie"], "no session may be issued").toBeUndefined();
});

test("an expired access cookie is refreshed silently", async ({ page, request, context }) => {
  const email = uniqueEmail("refresh");
  await createAccount(request, email, "Katherine Johnson");
  await signIn(page, email);

  const before = await sessionCookies(context);
  expect(before.access, "access cookie before refresh").toBeDefined();
  expect(before.refresh, "refresh cookie before refresh").toBeDefined();

  await context.addCookies([
    {
      name: ACCESS_COOKIE,
      value: staleAccessToken(),
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const tampered = await sessionCookies(context);
  expect(tampered.access?.value).not.toBe(before.access?.value);

  await page.goto("/dashboard");

  // The proxy rotated both tokens before rendering, so the session is still authenticated.
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Welcome back, Katherine Johnson" })).toBeVisible();

  const after = await sessionCookies(context);
  expect(after.access?.value, "rotated access token").not.toBe(tampered.access?.value);
  expect(after.refresh?.value, "rotated refresh token").not.toBe(before.refresh?.value);
});

test("logout revokes the session and protects the dashboard again", async ({
  page,
  request,
  context,
}) => {
  const email = uniqueEmail("logout");
  await createAccount(request, email, "Dorothy Vaughan");
  await signIn(page, email);

  const { refresh } = await sessionCookies(context);
  expect(refresh, "refresh cookie before logout").toBeDefined();

  // The header and the dashboard footer each render a sign-out control.
  await page.getByRole("main").getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/`);
  await expect
    .poll(async () => {
      const cookies = await sessionCookies(context);
      return Boolean(cookies.access || cookies.refresh);
    })
    .toBe(false);

  // The server-side token is revoked, not merely forgotten by the browser.
  const replay = await request.post(`${API_URL}/auth/refresh`, {
    data: { refresh_token: refresh?.value },
  });
  expect(replay.status()).toBe(401);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
