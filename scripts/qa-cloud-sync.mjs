#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.QA_BASE || "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const ADMIN = { email: "amir.behi2333@gmail.com", password: "Amir6229" };
const CLIENT = { email: "akbarmousavi1356@gmail.com", password: "Hr39/Vopq9" };
const BRAND = `Nimbus ${Date.now().toString().slice(-6)}`;
const FIRST = `Akbar${Date.now().toString().slice(-4)}`;

async function waitReady(page) {
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading") || document.body.innerText.length > 80,
    { timeout: 15000 },
  );
}

async function login(page, account, { scenario } = {}) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await waitReady(page);
  await page.locator("#email").fill(account.email);
  await page.locator("#password").fill(account.password);
  if (scenario) {
    const btn = page.getByRole("button", { name: scenario, exact: true });
    if (await btn.count()) await btn.click();
  }
  await page.getByRole("button", { name: /unlock|log in|sign in/i }).first().click();
  await page.waitForURL(/\/wallet/, { timeout: 15000 });
}

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const admin = await adminCtx.newPage();
admin.on("pageerror", (e) => console.error("admin pageerror", e.message));
admin.on("console", (m) => {
  if (m.type() === "error") console.error("admin console", m.text());
});

try {
  await login(admin, ADMIN);
  await admin.goto(`${BASE}/studio`, { waitUntil: "domcontentloaded" });
  await waitReady(admin);
  await admin.getByText("Site name", { exact: true }).locator("xpath=ancestor::div[contains(@class,'flex-col')][1]").locator("input").fill(BRAND);
  await admin.getByRole("button", { name: "Client" }).click();
  const firstInput = admin.getByText("First name", { exact: true }).locator("xpath=ancestor::div[contains(@class,'flex-col')][1]").locator("input");
  await firstInput.fill(FIRST);
  await admin.waitForFunction((v) => {
    const inputs = [...document.querySelectorAll("input")];
    return inputs.some((i) => i.value === v);
  }, FIRST);
  await admin.waitForTimeout(1800);
  await admin.screenshot({ path: "/workspace/screenshots/qa-cloud-admin.png" });

  const otherCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const other = await otherCtx.newPage();
  other.on("pageerror", (e) => console.error("other pageerror", e.message));
  await other.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await waitReady(other);
  await other.waitForTimeout(800);
  const homeText = await other.locator("body").innerText();
  await other.screenshot({ path: "/workspace/screenshots/qa-cloud-other-home.png" });
  if (!homeText.includes(BRAND)) {
    throw new Error(`other browser home missing brand "${BRAND}". got: ${homeText.slice(0, 400)}`);
  }

  await login(other, CLIENT, { scenario: "T20" });
  await other.goto(`${BASE}/wallet/profile`, { waitUntil: "domcontentloaded" });
  await other.waitForTimeout(1200);
  const values = await other.$$eval("input", (els) => els.map((e) => /** @type {HTMLInputElement} */ (e).value));
  await other.screenshot({ path: "/workspace/screenshots/qa-cloud-other-profile.png" });
  if (!values.includes(FIRST)) {
    throw new Error(`other browser profile missing first name "${FIRST}". inputs=${JSON.stringify(values)}`);
  }

  console.log(JSON.stringify({ ok: true, brand: BRAND, first: FIRST }));
  await otherCtx.close();
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: String(err?.message || err) }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
