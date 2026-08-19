/**
 * End-to-end smoke test for the whole decision loop.
 *
 * Covers: home render, DE/EN switch, deck build, left swipe advance, drag-to-like
 * ending a solo round, group session creation, a second tab joining, identical
 * decks on both, and a unanimous match landing on both devices at once.
 *
 *   npm run build && npm run preview      # in one shell
 *   npm run e2e                           # in another
 */
import { chromium } from '@playwright/test'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:4173/choiceapp/'
const SHOTS = process.env.SHOT_DIR ?? 'e2e/screenshots'

// PW_CHROMIUM lets a preinstalled browser be reused; otherwise Playwright's
// own download is used (npx playwright install chromium).
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
)
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()

const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

const step = (msg) => console.log(`  ${msg}`)

// Waits until the top card has finished any fly-out/promotion animation and
// is sitting still inside the viewport, so drags target a stable element.
async function settledTopCard(target) {
  await target.waitForFunction(() => {
    const el = document.querySelector('[data-testid="card"][data-top="true"]')
    if (!el) return false
    const r = el.getBoundingClientRect()
    const settled = r.x > 0 && r.x < window.innerWidth && r.width > 100
    const prev = window.__lastBox
    window.__lastBox = `${Math.round(r.x)}:${Math.round(r.width)}`
    return settled && prev === window.__lastBox
  }, null, { timeout: 10000, polling: 100 })
  return target.locator('[data-testid="card"][data-top="true"]')
}

// ---- 1. Home renders ----
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('text=SwipeDecide')
step(`home heading: "${await page.locator('h1').first().innerText()}"`)
await page.screenshot({ path: `${SHOTS}/01-home.png` })

// ---- 2. Language toggle swaps the whole UI ----
await page.getByRole('button', { name: 'DE', exact: true }).click()
await page.waitForTimeout(300)
const deHeading = await page.locator('h1').first().innerText()
step(`after DE toggle: "${deHeading}"`)
if (!/entscheidet/i.test(deHeading)) throw new Error('German UI did not apply')
await page.screenshot({ path: `${SHOTS}/02-home-de.png` })
await page.getByRole('button', { name: 'EN', exact: true }).click()
await page.waitForTimeout(300)

// ---- 3. Activities deck (offline dataset, no network needed) ----
await page.getByRole('button', { name: /Just me/ }).click()
await page.waitForURL(/#\/categories/)
await page.getByRole('button', { name: /Activities/ }).click()
await page.waitForSelector('[data-testid="card"]', { timeout: 15000 })
await settledTopCard(page)
const firstTitle = await page.locator('[data-top="true"] h2').innerText()
step(`first card: "${firstTitle}"`)
await page.screenshot({ path: `${SHOTS}/03-swipe.png` })

// ---- 4. Left swipe advances without ending the round ----
const progressBefore = await page.locator('text=/\\d+ of \\d+/').innerText()
await page.getByRole('button', { name: /^Pass on/ }).click()
await page.waitForTimeout(700)
const progressAfter = await page.locator('text=/\\d+ of \\d+/').innerText()
step(`progress ${progressBefore} -> ${progressAfter}`)
if (progressBefore === progressAfter) throw new Error('Left swipe did not advance the deck')

// ---- 5. Drag gesture commits a like and ends the solo round ----
const card = await settledTopCard(page)
const box = await card.boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
for (let i = 1; i <= 10; i++) {
  await page.mouse.move(box.x + box.width / 2 + i * 26, box.y + box.height / 2, { steps: 2 })
}
await page.mouse.up()
await page.waitForURL(/#\/result/, { timeout: 8000 })
step('drag right -> navigated to /result (solo first-like-wins)')
await page.waitForSelector('text=Your pick')
const winner = await page.locator('h1').first().innerText()
step(`winner: "${winner}"`)
await page.screenshot({ path: `${SHOTS}/04-result.png` })

// ---- 6. Group lobby: create a session and read back the share link ----
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /With friends/ }).click()
await page.waitForURL(/#\/categories/)
await page.getByRole('button', { name: /Activities/ }).click()
await page.getByLabel('Your name').fill('Anna')
await page.getByRole('button', { name: 'Create a group' }).click()
await page.waitForURL(/#\/s\//, { timeout: 10000 })
await page.waitForSelector('text=Invite your group')
const link = await page.locator('input[readonly]').inputValue()
step(`session link: ${link}`)
await page.screenshot({ path: `${SHOTS}/05-lobby.png` })

// ---- 7. A second "device" (tab) joins via the link and the host sees it ----
const guest = await ctx.newPage()
await guest.goto(link, { waitUntil: 'networkidle' })
await guest.getByLabel('Your name').fill('Ben')
await guest.getByRole('button', { name: 'Join', exact: true }).click()
await guest.waitForSelector('text=Waiting for the host', { timeout: 10000 })
step('guest joined and is waiting for the host')
await page.waitForSelector('text=Ben', { timeout: 10000 })
step('host sees the guest appear live in the lobby')
await page.screenshot({ path: `${SHOTS}/06-lobby-two.png` })

// ---- 8. Start the round; both devices swipe the same deck ----
await page.getByRole('button', { name: /Start the round/ }).click()
await settledTopCard(page)
await settledTopCard(guest)
const hostDeck = await page.locator('[data-top="true"] h2').innerText()
const guestDeck = await guest.locator('[data-top="true"] h2').innerText()
step(`host card "${hostDeck}" | guest card "${guestDeck}"`)
if (hostDeck !== guestDeck) throw new Error('Decks diverged between devices')
await page.screenshot({ path: `${SHOTS}/07-group-swipe.png` })

// ---- 9. Unanimous like on the same card ends the round for BOTH ----
await page.getByRole('button', { name: /^Like/ }).click()
await page.waitForTimeout(800)
const hostAfterLike = await page.locator('body').innerText()
if (hostAfterLike.includes("It's a match")) throw new Error('Matched before everyone liked it')
step('one like is not a match (correct)')

await guest.getByRole('button', { name: /^Like/ }).click()
await page.waitForSelector("text=It's a match!", { timeout: 10000 })
await guest.waitForSelector("text=It's a match!", { timeout: 10000 })
const matchTitle = await page.locator('h1').first().innerText()
step(`MATCH on both devices: "${matchTitle}"`)
if (matchTitle !== hostDeck) throw new Error('Winner is not the card both liked')
await page.screenshot({ path: `${SHOTS}/08-match.png` })

console.log(errors.length ? `\nCONSOLE ERRORS:\n${errors.join('\n')}` : '\nNo console errors.')
await browser.close()
console.log('\nSMOKE TEST PASSED')
