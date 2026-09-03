/**
 * Browser walkthrough used to verify the UI (§67, §70).
 * Requires the app to be running (npm run build && npm start) and
 * `npm i --no-save playwright` for the browser binaries.
 *
 *   node scripts/e2e.mjs [baseUrl] [outDir]
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = process.argv[3] ?? '/tmp/shots';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Rotaract@2026';

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#field-1, input[type=email]', email);
  await page.fill('input[type=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL(/dashboard/, { timeout: 20000 });
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });

  // ---------- Desktop, as the Secretary (admin view) ----------
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await desktop.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  console.log('\nAdmin (Secretary)');
  await login(page, 'secretary@rotaract.demo');
  check('signs in with email + password', page.url().includes('/dashboard'));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/01-admin-dashboard.png`, fullPage: true });
  check('admin dashboard shows club overview', await page.getByText('Club overview').first().isVisible());
  check('reporting health card present', await page.getByText('Reporting health').first().isVisible());

  await page.goto(`${BASE}/events`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/02-events.png`, fullPage: true });
  check('events table lists seeded events', (await page.locator('table tbody tr').count()) > 3);

  await page.goto(`${BASE}/reviews`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/03-reviews.png`, fullPage: true });
  check('review queue renders', await page.getByRole('heading', { name: 'Pending reviews' }).isVisible());

  await page.goto(`${BASE}/analytics`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/04-analytics.png`, fullPage: true });
  check('charts render', (await page.locator('svg.recharts-surface').count()) >= 3);

  await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/05-reports.png`, fullPage: true });

  // Open the first event detail page
  await page.goto(`${BASE}/events`, { waitUntil: 'networkidle' });
  await page.locator('table tbody tr a').first().click();
  await page.waitForURL(/\/events\/.+/, { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/06-event-detail.png`, fullPage: true });
  check('event detail shows the gallery', await page.getByText('Photographs').first().isVisible());
  check('event detail shows the Drive card', await page.getByText('Google Drive').first().isVisible());

  // Global search
  await page.fill('#global-search', 'Care2Cook');
  await page.waitForTimeout(900);
  const suggestion = await page.getByText('Care2Cook').count();
  check('global search returns matches', suggestion > 0, `${suggestion} hits`);
  await page.screenshot({ path: `${OUT}/07-search.png` });

  // ---------- Mobile, as a board member ----------
  console.log('\nBoard member (mobile)');
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const m = await mobile.newPage();
  m.on('pageerror', (e) => errors.push(String(e)));

  await login(m, 'akshaya@rotaract.demo');
  await m.waitForTimeout(1000);
  await m.screenshot({ path: `${OUT}/08-mobile-dashboard.png`, fullPage: true });
  check('mobile dashboard renders', await m.getByText('Welcome,').first().isVisible());
  check('bottom navigation is present', await m.locator('nav[aria-label="Primary"]').isVisible());

  await m.goto(`${BASE}/events/new`, { waitUntil: 'networkidle' });
  await m.waitForTimeout(600);
  await m.screenshot({ path: `${OUT}/09-mobile-wizard-step1.png`, fullPage: true });
  check('wizard opens on step 1', await m.getByText('Step 1 of 13').isVisible());

  // Fill the first step and continue — this also creates the draft server-side.
  await m.getByLabel('Event name').fill('E2E — Kitchen Support Drive');
  await m.getByLabel('Event date').fill('2026-08-28');
  await m.getByLabel('Start time').fill('11:30');
  await m.getByRole('button', { name: 'Continue' }).click();
  await m.waitForTimeout(2500);
  check('advances to step 2 after saving the draft', await m.getByText('Step 2 of 13').isVisible());
  check('shows the autosave indicator', (await m.getByText(/Draft saved/).count()) > 0);
  await m.screenshot({ path: `${OUT}/10-mobile-wizard-step2.png`, fullPage: true });

  // Step 2 → leadership, 3 → venue (required), 4 → collaboration, 5 → participation
  await m.getByRole('button', { name: 'Continue' }).click(); // leadership → venue
  await m.waitForTimeout(900);
  await m.getByLabel('Venue').fill('Madhukarai Government School');
  await m.getByRole('button', { name: 'Continue' }).click(); // venue → collaboration
  await m.waitForTimeout(900);
  await m.getByRole('button', { name: 'Continue' }).click(); // collaboration → participation
  await m.waitForTimeout(1200);
  const onParticipation = await m.getByText('Total participants').count();
  if (onParticipation) {
    await m.getByLabel('Rotaractors present').fill('14');
    await m.getByLabel('Guests / others present').fill('6');
    await m.waitForTimeout(400);
    const total = await m.locator('text=Total participants').locator('..').innerText();
    check('total participants is calculated for the user', total.includes('20'), total.replace(/\n/g, ' '));
    await m.screenshot({ path: `${OUT}/11-mobile-participation.png`, fullPage: true });
  } else {
    check('reached the participation step', false);
  }

  // Completeness rail should say the report is not ready yet
  const notReady = await m.getByText(/Please complete/).count();
  check('completeness rail blocks an incomplete report', notReady > 0);

  console.log('\nConsole');
  const realErrors = errors.filter((e) => !/favicon|Download the React DevTools/i.test(e));
  check('no unexpected browser console errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  await browser.close();
  console.log(failures === 0 ? '\nAll UI checks passed.\n' : `\n${failures} UI check(s) failed.\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
