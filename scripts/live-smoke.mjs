/**
 * live-smoke.mjs
 * Local-only VoiLoad smoke test against a real, logged-in Facebook thread.
 * See docs/facebook-live-smoke-test.md.
 *
 *   pnpm smoke:login   # opens Chromium; log in, open the test thread, Cmd+Q
 *   pnpm smoke:live    # builds dist/ and tests the saved thread
 *
 * The session lives only in the persistent Chromium profile under
 * .voiload-smoke/ (gitignored, repo root): no storageState / cookie export, no
 * trace, HAR, video or screenshot. The report contains only counts, UI labels,
 * durations and WAV header fields — no names, message text, thread IDs or URLs.
 *
 * Never run this in CI: it needs a real Facebook session.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const [mode] = process.argv.slice(2);
if (!["login", "run"].includes(mode)) {
  console.error("usage: node scripts/live-smoke.mjs <login|run>");
  process.exit(2);
}

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(REPO, "dist");
const SMOKE_DIR = join(REPO, ".voiload-smoke");
const PROFILE = join(SMOKE_DIR, "profile");
const THREAD_FILE = join(SMOKE_DIR, "thread-url");

mkdirSync(PROFILE, { recursive: true });
chmodSync(SMOKE_DIR, 0o700);

// ---------------------------------------------------------------------------
// Detection constants, read from the repo so this script tracks the source.
// ---------------------------------------------------------------------------
const constantsSrc = readFileSync(join(REPO, "extension/scripts/utils/constants.ts"), "utf8");

function constString(name) {
  const m = constantsSrc.match(new RegExp(`${name}:\\s*\\n?\\s*(["'])(.*?)\\1`));
  if (!m) throw new Error(`cannot read ${name} from constants.ts`);
  return m[2];
}

const SLIDER_SELECTOR = constString("VOICE_MESSAGE_SLIDER_SELECTOR");
const PLAY_BUTTON_SELECTOR = constString("PLAY_BUTTON_SELECTOR");
const NON_VOICE_MEDIA_SELECTOR = constString("NON_VOICE_MEDIA_SELECTOR");
const MAX_DEPTH = Number(constantsSrc.match(/VOICE_MESSAGE_CONTAINER_MAX_DEPTH:\s*(\d+)/)[1]);
const DURATION_SOURCE = constantsSrc.match(/DURATION_TEXT_PATTERN:\s*\/(.+?)\/,/)[1];
const labelBlock = constantsSrc.match(/VOICE_MESSAGE_SLIDER_ARIA_LABEL:\s*\[([\s\S]*?)\]/)[1];
const KNOWN_LABELS = [...labelBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const THREAD_RE =
  /^https:\/\/(www\.)?(messenger\.com|facebook\.com\/messages)\/(e2ee\/)?t\/[^/?#]+/;

async function launch() {
  if (!existsSync(DIST)) throw new Error(`dist/ not found at ${DIST}; run pnpm build`);
  return chromium.launchPersistentContext(PROFILE, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: [
      `--disable-extensions-except=${DIST}`,
      `--load-extension=${DIST}`,
      "--disable-blink-features=AutomationControlled",
    ],
  });
}

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------
async function login() {
  const ctx = await launch();
  let lastThread = null;
  const track = (p) =>
    p.on("framenavigated", (f) => {
      if (f === p.mainFrame() && THREAD_RE.test(f.url())) lastThread = f.url();
    });
  ctx.pages().forEach(track);
  ctx.on("page", track);

  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto("https://www.facebook.com/messages/");
  console.log("Log in, open the test thread (with short + long voice messages), then quit Chromium (Cmd+Q).");

  // On macOS closing the last window does not quit Chromium, so finish when
  // either the browser quits or no page is left open.
  await new Promise((done) => {
    ctx.on("close", done);
    const onPageClose = () => ctx.pages().length === 0 && done();
    ctx.pages().forEach((p) => p.on("close", onPageClose));
    ctx.on("page", (p) => p.on("close", onPageClose));
  });
  await ctx.close().catch(() => {});
  if (lastThread) {
    writeFileSync(THREAD_FILE, lastThread.match(THREAD_RE)[0] + "\n", { mode: 0o600 });
    console.log("Saved test thread (URL kept private in .voiload-smoke/thread-url).");
  } else {
    console.log("No thread was opened; thread-url unchanged.");
  }
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------
const report = { verdict: "pass", checks: [] };

function check(name, ok, detail = {}) {
  report.checks.push({ name, ok, ...detail });
  if (!ok && report.verdict === "pass") report.verdict = `fail: ${name}`;
  return ok;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readStore(sw) {
  return sw.evaluate(async () => {
    const stored = await chrome.storage.session.get("voiceMessages");
    const items = stored?.voiceMessages ?? [];
    return items.map((it) => ({
      durationMs: it.durationMs ?? null,
      hasDownloadUrl: !!it.downloadUrl,
      blobType: it.blobType ?? null,
    }));
  });
}

async function instrumentDownloads(sw) {
  await sw.evaluate(() => {
    if (self.__SMOKE_PATCHED) return;
    self.__SMOKE_DOWNLOADS = [];
    chrome.downloads.download = (options, cb) => {
      self.__SMOKE_DOWNLOADS.push(options);
      const id = Date.now() % 100000;
      if (typeof cb === "function") cb(id);
      return Promise.resolve(id);
    };
    self.__SMOKE_PATCHED = true;
  });
}

/** Parses the WAV header of a blob URL inside the page that minted it. */
async function inspectWav(page, url) {
  return page.evaluate(async (u) => {
    const buf = await (await fetch(u)).arrayBuffer();
    const v = new DataView(buf);
    const tag = (o) => String.fromCharCode(...new Uint8Array(buf, o, 4));
    if (buf.byteLength < 44 || tag(0) !== "RIFF" || tag(8) !== "WAVE") {
      return { isWav: false, bytes: buf.byteLength };
    }
    const channels = v.getUint16(22, true);
    const sampleRate = v.getUint32(24, true);
    const bitsPerSample = v.getUint16(34, true);
    const dataBytes = v.getUint32(40, true);
    const durationSec = dataBytes / (sampleRate * channels * (bitsPerSample / 8));
    return { isWav: true, bytes: buf.byteLength, channels, sampleRate, bitsPerSample, durationSec };
  }, url);
}

async function downloadViaRightClick(page, sw, index) {
  await sw.evaluate(() => (self.__SMOKE_DOWNLOADS = []));
  const slider = page.locator(SLIDER_SELECTOR).nth(index);
  await slider.scrollIntoViewIfNeeded().catch(() => {});
  await slider.dispatchEvent("contextmenu");
  await sleep(1500);
  await sw.evaluate(() =>
    chrome.contextMenus.onClicked.dispatch({ menuItemId: "downloadVoiceMessage" }, undefined)
  );
  for (let i = 0; i < 20; i++) {
    const dls = await sw.evaluate(() => self.__SMOKE_DOWNLOADS);
    if (dls.length) {
      await sleep(500);
      return sw.evaluate(() => self.__SMOKE_DOWNLOADS);
    }
    await sleep(500);
  }
  return [];
}

async function run() {
  if (!existsSync(THREAD_FILE)) throw new Error("no test thread saved; run `pnpm smoke:login` first");
  const threadUrl = readFileSync(THREAD_FILE, "utf8").trim();

  const ctx = await launch();
  try {
    const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker", { timeout: 15_000 }));
    check("extension service worker loaded", !!sw);
    await instrumentDownloads(sw);

    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(threadUrl, { waitUntil: "domcontentloaded" });
    await sleep(3000);

    const cookies = await ctx.cookies(["https://www.facebook.com", "https://www.messenger.com"]);
    const signedIn = cookies.some((c) => c.name === "c_user" && c.value !== "");
    if (!check("signed in (c_user cookie present)", signedIn)) {
      report.verdict = "session-expired: run `pnpm smoke:login` again";
      return;
    }
    check("thread URL still a thread", THREAD_RE.test(page.url()), {
      landedOnThread: THREAD_RE.test(page.url()),
    });

    const sliderAppeared = await page
      .waitForSelector(SLIDER_SELECTOR, { timeout: 45_000 })
      .then(() => true)
      .catch(() => false);
    if (!check("voice slider selector matches", sliderAppeared, { selector: SLIDER_SELECTOR })) {
      report.verdict = "dom-drift: no slider (or thread has no voice message)";
      return;
    }
    await sleep(2000);

    const sliders = await page.$$eval(
      SLIDER_SELECTOR,
      (els, k) => {
        const re = new RegExp(k.durationSource);
        return els.map((el) => {
          let guard = { found: false, depth: null, hasVideo: false };
          let node = el.parentElement;
          for (let d = 0; node && d < k.maxDepth; d++) {
            const hasPlay = !!node.querySelector(k.play);
            const hasVideo = !!node.querySelector(k.video);
            const text = (node.textContent ?? "").match(re);
            if (hasVideo) guard.hasVideo = true;
            if (hasPlay && text && !hasVideo) {
              guard = { found: true, depth: d, hasVideo: false, durationText: text[0] };
              break;
            }
            node = node.parentElement;
          }
          return {
            ariaLabel: el.getAttribute("aria-label"),
            valuemax: Number(el.getAttribute("aria-valuemax")),
            guard,
          };
        });
      },
      { durationSource: DURATION_SOURCE, maxDepth: MAX_DEPTH, play: PLAY_BUTTON_SELECTOR, video: NON_VOICE_MEDIA_SELECTOR }
    );

    const voice = sliders.map((s, i) => ({ ...s, index: i })).filter((s) => s.guard.found);
    const labels = [...new Set(sliders.map((s) => s.ariaLabel))];
    check("container guard recognises voice messages", voice.length > 0, {
      sliders: sliders.length,
      recognised: voice.length,
      rejectedWithVideo: sliders.filter((s) => !s.guard.found && s.guard.hasVideo).length,
    });
    report.ariaLabels = labels.map((l) => ({ label: l, inDictionary: KNOWN_LABELS.includes(l) }));
    report.voiceMessages = voice.map((s) => ({ valuemaxSec: s.valuemax, durationText: s.guard.durationText }));

    // Blob capture: page-context hook -> content -> background store.
    let items = [];
    for (let i = 0; i < 20 && !items.some((it) => it.hasDownloadUrl); i++) {
      items = await readStore(sw);
      await sleep(1000);
    }
    report.capturedItems = items;
    if (!check("audio captured into background store", items.some((it) => it.hasDownloadUrl), {
      captured: items.length,
    })) {
      return;
    }

    // Short and long message via the right-click path.
    if (!voice.length) return;
    const targets = [voice[0]];
    const longest = voice.reduce((a, b) => (b.valuemax > a.valuemax ? b : a));
    if (longest.index !== voice[0].index) targets.push(longest);

    for (const t of targets) {
      const name = `right-click download (slider ${t.valuemax}s)`;
      const dls = await downloadViaRightClick(page, sw, t.index);
      if (!check(`${name}: download started`, dls.length > 0)) continue;
      const dl = dls[dls.length - 1];
      const fellBack = dls.length > 1 || /voice-msg-/.test(dl.filename);
      check(`${name}: matched (not batch fallback)`, !fellBack, {
        downloads: dls.length,
        filename: dl.filename.replace(/voice-msg-.*\.wav$/, "voice-msg-<id>.wav"),
      });
      if (!dl.url.startsWith("blob:")) {
        check(`${name}: is WAV`, false, { urlScheme: dl.url.split(":")[0] });
        continue;
      }
      const wav = await inspectWav(page, dl.url).catch((e) => ({ isWav: false, error: String(e).slice(0, 120) }));
      check(`${name}: is WAV`, wav.isWav, wav);
      if (wav.isWav && t.valuemax > 0) {
        const diff = Math.abs(wav.durationSec - t.valuemax);
        check(`${name}: duration matches`, diff <= Math.max(1.5, t.valuemax * 0.1), {
          wavSec: Number(wav.durationSec.toFixed(2)),
          sliderSec: t.valuemax,
        });
      }
    }
  } finally {
    await ctx.close();
  }
}

try {
  if (mode === "login") {
    await login();
  } else {
    await run();
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.verdict === "pass" ? 0 : 1;
  }
} catch (e) {
  console.error(String(e?.message ?? e).replace(/https?:\/\/\S+/g, "<url>"));
  process.exitCode = 1;
}
