// Light-mode audit: logs into the dashboard, walks key pages, and reports
// unique (text-color, background) pairs with low contrast in LIGHT mode.
// Parses hex/rgb/rgba/oklab so effective backgrounds composite correctly.
const { spawn } = require("child_process");
const path = require("path");

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9223;
const PROFILE = path.join(process.env.TEMP || "/tmp", "rf-audit-profile2");
const BASE = "http://localhost:3000";

const PAGES = [
  ["/login", "login"],
  ["/dashboard", "dashboard"],
  ["/properties", "properties"],
  ["/leads", "pipeline"],
  ["/odhad", "odhad"],
  ["/portfolio", "portfolio"],
  ["/market", "market"],
  ["/vykupy", "vykupy"],
  ["/call-mode", "call-mode"],
  ["/settings", "settings"],
  ["/alerts", "alerts"],
  ["/tasks", "tasks"],
  ["/searches", "searches"],
];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const edge = spawn(EDGE, [
    "--headless=new", "--disable-gpu", "--no-sandbox",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    "--window-size=1440,2400", "about:blank",
  ], { stdio: "ignore" });
  await sleep(2500);

  let targets;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/json`);
      targets = await res.json();
      if (targets.some((t) => t.type === "page")) break;
    } catch {}
    await sleep(500);
  }
  const page = targets.find((t) => t.type === "page");
  if (!page) { console.error("No page target"); process.exit(1); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let msgId = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = ++msgId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evalJS(expr) {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails)
      return { error: r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text };
    return r.result?.result?.value;
  }
  async function nav(url, waitMs = 3000) {
    await send("Page.navigate", { url });
    await sleep(waitMs);
    await sleep(1200);
  }

  const AUDIT_JS = `
    (() => {
      // --- color parsing (hex, rgb/rgba, oklab/oklch) ---
      function hexToRgb(h) {
        h = h.replace("#", "");
        if (h.length === 3) h = h.split("").map((c) => c + c).join("");
        if (h.length !== 6) return null;
        return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16), 1];
      }
      function parseRgb(s) {
        const m = s.match(/rgba?\\(([^)]+)\\)/);
        if (!m) return null;
        const parts = m[1].split(/[,\\s/]+/).filter(Boolean).map(parseFloat);
        if (parts.length < 3) return null;
        return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
      }
      function oklabToRgb(str) {
        // oklab(a b c / alpha) or oklab(l a b)
        const m = str.match(/oklab\\(([^)]+)\\)/);
        if (!m) return null;
        const parts = m[1].split(/[,\\s/]+/).filter(Boolean).map((x) => parseFloat(x));
        if (parts.length < 3) return null;
        let L = parts[0], a = parts[1], b = parts[2];
        const alpha = parts.length > 3 ? parts[3] : 1;
        const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
        const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
        const s_ = L - 0.0894841775 * a - 1.291485548 * b;
        const l = l_ ** 3, mm = m_ ** 3, s = s_ ** 3;
        const r = +4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s;
        const g = -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s;
        const bl = -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s;
        const clamp = (v) => Math.min(255, Math.max(0, Math.round(v * 255)));
        return [clamp(r), clamp(g), clamp(bl), alpha];
      }
      function oklchToRgb(str) {
        const m = str.match(/oklch\\(([^)]+)\\)/);
        if (!m) return null;
        const parts = m[1].split(/[,\\s/]+/).filter(Boolean).map((x) => parseFloat(x));
        if (parts.length < 3) return null;
        const L = parts[0], C = parts[1], H = (parts[2] * Math.PI) / 180;
        const a = C * Math.cos(H), b = C * Math.sin(H);
        const alpha = parts.length > 3 ? parts[3] : 1;
        const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
        const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
        const s_ = L - 0.0894841775 * a - 1.291485548 * b;
        const l = l_ ** 3, mm = m_ ** 3, s = s_ ** 3;
        const r = +4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s;
        const g = -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s;
        const bl = -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s;
        const clamp = (v) => Math.min(255, Math.max(0, Math.round(v * 255)));
        return [clamp(r), clamp(g), clamp(bl), alpha];
      }
      function parseColor(str) {
        if (!str) return null;
        str = str.trim();
        if (str === "transparent") return [0,0,0,0];
        if (str.startsWith("#")) return hexToRgb(str);
        if (str.startsWith("rgb")) return parseRgb(str);
        if (str.startsWith("oklab(")) return oklabToRgb(str);
        if (str.startsWith("oklch(")) return oklchToRgb(str);
        return null;
      }
      function luminance([r,g,b]) {
        const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      }
      function contrast(a, b) {
        const la = luminance(a), lb = luminance(b);
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
      }
      function composite(fg, bg) {
        const a = fg[3] ?? 1;
        return [fg[0]*a + bg[0]*(1-a), fg[1]*a + bg[1]*(1-a), fg[2]*a + bg[2]*(1-a)];
      }
      function isDark(c) { return luminance(c) < 0.4; }
      function effectiveBg(el) {
        let node = el;
        let bg = [245, 245, 245]; // light page bg
        while (node && node !== document.documentElement) {
          const cs = getComputedStyle(node);
          const c = parseColor(cs.backgroundColor);
          if (c && c[3] > 0.04) {
            bg = composite(c, bg);
            if (c[3] >= 0.99) break;
          }
          node = node.parentElement;
        }
        return bg;
      }
      const pairs = new Map();
      const els = document.querySelectorAll("body *");
      for (const el of els) {
        if (el.children.length > 0) continue;
        const text = (el.textContent || "").trim();
        if (!text) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        if (parseFloat(cs.fontSize) < 10) continue;
        if (el.closest("input, textarea, select, option, script, style, svg")) continue;
        const color = parseColor(cs.color);
        if (!color || (color[3] ?? 1) < 0.4) continue;
        const bg = effectiveBg(el);
        const fg = composite(color, bg);
        const ratio = contrast(fg, bg);
        // Flag: light-mode problems = readable text rendered in a color that is too
        // close to a LIGHT background (low contrast) OR dark-on-dark.
        const lowOnLight = !isDark(bg) && ratio < 2.6;
        if (lowOnLight) {
          const key = cs.color + " ||| " + cs.backgroundColor;
          if (!pairs.has(key)) pairs.set(key, []);
          const arr = pairs.get(key);
          if (arr.length < 2) {
            arr.push({
              tag: el.tagName,
              text: text.slice(0, 40),
              cls: String(el.className || "").slice(0, 70),
              ratio: Math.round(ratio * 100) / 100,
              fontSize: cs.fontSize,
            });
          }
        }
      }
      const out = [];
      for (const [key, samples] of pairs) {
        const [colorStr, bgStr] = key.split(" ||| ");
        out.push({ color: colorStr, bg: bgStr, count: samples.length, samples });
      }
      return out;
    })()
  `;

  const results = {};
  for (const [route, name] of PAGES) {
    try {
      await nav(BASE + route);
      results[name] = await evalJS(AUDIT_JS);
    } catch (e) {
      results[name] = { error: String(e).slice(0, 120) };
    }
  }

  // Try logging in
  try {
    await nav(BASE + "/login");
    await evalJS(`
      (() => {
        const email = document.querySelector('input[type="email"]');
        const pass = document.querySelector('input[type="password"]');
        const form = email?.closest("form");
        if (form) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
          setter.call(email, "cakmak@tuta.com");
          email.dispatchEvent(new Event("input", { bubbles: true }));
          setter.call(pass, "realflip2026");
          pass.dispatchEvent(new Event("input", { bubbles: true }));
          form.requestSubmit();
          return "submitted";
        }
        return "no form";
      })()
    `);
    await sleep(7000);
    for (const [route, name] of [["/dashboard", "dashboard-auth"], ["/leads", "pipeline-auth"], ["/properties", "properties-auth"], ["/portfolio", "portfolio-auth"], ["/market", "market-auth"], ["/call-mode", "callmode-auth"], ["/settings", "settings-auth"], ["/alerts", "alerts-auth"], ["/tasks", "tasks-auth"], ["/searches", "searches-auth"], ["/contacts", "contacts-auth"], ["/investors", "investors-auth"]]) {
      await nav(BASE + route, 4000);
      results[name] = await evalJS(AUDIT_JS);
    }
  } catch (e) {
    results["login-attempt"] = String(e).slice(0, 120);
  }

  console.log(JSON.stringify(results, null, 1));
  ws.close();
  edge.kill();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
