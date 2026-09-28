const SHEET_URL = new URL("./sprite.png", import.meta.url);

const CANVAS_W = 40;
const CANVAS_H = 32;

const FRAMES = {
    idle: [[1, 1, 24, 32, 8, 0, 27, 10]],
    walk: [
        [1, 34, 24, 32, 8, 0, 27, 10],
        [26, 34, 24, 32, 8, 0, 27, 10],
        [51, 34, 24, 32, 8, 0, 27, 10],
        [76, 34, 24, 32, 8, 0, 27, 10],
    ],
    run: [
        [1, 67, 40, 24, 0, 8, 35, 18],
        [42, 67, 32, 24, 8, 8, 35, 19],
        [75, 67, 40, 24, 0, 8, 35, 18],
        [116, 67, 32, 24, 8, 8, 35, 19],
    ],
};

const defaults = {
    parent: document.body,
    mode: "wander",
    scale: 3,
    speed: 90, // px per second
    runSpeed: 260,
    fleeRadius: 150, // how close the mouse gets before the goose bolts
    frameMs: 150,
    idleMs: [1000, 3000],
};

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const randomPoint = (max) => ({ x: rand(0, max.x), y: rand(0, max.y) });

const MODES = {
    wander(g, now) {
        if (g.target || now < g.idleUntil) return;
        g.target = randomPoint(g.bounds());
    },

    avoid(g, now) {
        if (!g.mouse) {
            calm(g, now);
            return MODES.wander(g, now);
        }

        const mouse = { x: g.mouse.x - g.width / 2, y: g.mouse.y - g.height / 2 };
        const d = dist(g, mouse);

        if (g.running && g.target) {
            if (dist(g.target, mouse) > g.fleeRadius) return;
            g.target = null;
            g.running = false;
        }

        if (d >= (g.heading ? g.fleeRadius * 1.3 : g.fleeRadius)) {
            calm(g, now);
            if (!g.target && now >= g.idleUntil) {
                const p = randomPoint(g.bounds());
                if (dist(p, mouse) > g.fleeRadius) g.target = p;
            }
            return;
        }

        const angle = d ? Math.atan2(g.y - mouse.y, g.x - mouse.x) : rand(0, Math.PI * 2);
        let hx = Math.cos(angle);
        let hy = Math.sin(angle);

        const max = g.bounds();
        const blockedX = (g.x <= 0 && hx < 0) || (g.x >= max.x && hx > 0);
        const blockedY = (g.y <= 0 && hy < 0) || (g.y >= max.y && hy > 0);
        g.target = null;
        g.running = true;
        if (blockedX && blockedY) {
            g.heading = null;
            g.target = escape(g, mouse);
            return;
        }
        if (blockedX) {
            hx = 0;
            hy = Math.sign(hy) || (g.y < max.y / 2 ? 1 : -1);
        } else if (blockedY) {
            hy = 0;
            hx = Math.sign(hx) || (g.x < max.x / 2 ? 1 : -1);
        }
        g.heading = { x: hx, y: hy };
    },
};

const calm = (g, now) => {
    if (!g.heading) return;
    g.heading = null;
    g.running = false;
    g.idleUntil = now + rand(...g.idleMs);
};

const escape = (g, mouse) => {
    const max = g.bounds();
    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < 16; i++) {
        const angle = rand(0, Math.PI * 2);
        const r = g.fleeRadius * rand(2, 3);
        const p = {
            x: clamp(g.x + Math.cos(angle) * r, 0, max.x),
            y: clamp(g.y + Math.sin(angle) * r, 0, max.y),
        };
        const score = dist(p, mouse);
        if (score > bestScore) {
            best = p;
            bestScore = score;
        }
    }
    return best;
};

export const modes = Object.keys(MODES);

const checkMode = (mode) => {
    if (!Object.hasOwn(MODES, mode)) {
        throw new Error(`goose: unknown mode "${mode}" (expected one of: ${modes.join(", ")})`);
    }
    return mode;
};

const tag = (text) => {
    const el = document.createElement("span");
    el.textContent = text;
    Object.assign(el.style, {
        padding: "2px 6px",
        border: "2px solid #000",
        background: "#fff",
        color: "#000",
        font: "bold 12px/1.2 monospace",
        whiteSpace: "nowrap",
    });
    return el;
};

let sheetPromise;
const loadSheet = () => (sheetPromise ??= (async () => {
    const img = new Image();
    img.src = SHEET_URL;
    await img.decode();
    return img;
})());

export function spawnGoose(options = {}) {
    const { parent, mode, scale, speed, runSpeed, fleeRadius, frameMs, idleMs } = { ...defaults, ...options };
    const width = CANVAS_W * scale;
    const height = CANVAS_H * scale;

    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    Object.assign(el.style, {
        position: "fixed",
        left: "0px",
        top: "0px",
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: "none",
        zIndex: "2147483647",
    });

    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    Object.assign(canvas.style, {
        position: "absolute",
        left: "0px",
        top: "0px",
        width: "100%",
        height: "100%",
        imageRendering: "pixelated",
    });
    el.append(canvas);
    parent.append(el);
    const ctx = canvas.getContext("2d");

    const bounds = () => ({
        x: Math.max(0, document.documentElement.clientWidth - width),
        y: Math.max(0, document.documentElement.clientHeight - height),
    });

    const g = {
        mode: checkMode(mode),
        x: 0,
        y: bounds().y,
        width,
        height,
        fleeRadius,
        idleMs,
        bounds,
        target: null,
        heading: null,
        running: false,
        idleUntil: 0,
        mouse: null,
    };

    const listeners = new AbortController();
    const listen = { signal: listeners.signal, passive: true };
    window.addEventListener("pointermove", (e) => { g.mouse = { x: e.clientX, y: e.clientY }; }, listen);
    document.documentElement.addEventListener("pointerleave", () => { g.mouse = null; }, listen);

    let sheet = null;
    let facing = 1;
    let drawn = null;
    let held = null;
    let heldAt = null;
    let last = performance.now();
    let raf = 0;

    const tick = (now) => {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;

        MODES[g.mode](g, now);

        if (g.heading) {
            const max = bounds();
            const step = runSpeed * dt;
            g.x = clamp(g.x + g.heading.x * step, 0, max.x);
            g.y = clamp(g.y + g.heading.y * step, 0, max.y);
            if (Math.abs(g.heading.x) > 0.15) facing = Math.sign(g.heading.x);
        } else if (g.target) {
            const dx = g.target.x - g.x;
            const dy = g.target.y - g.y;
            const d = Math.hypot(dx, dy);
            const step = (g.running ? runSpeed : speed) * dt;
            if (d <= step) {
                g.x = g.target.x;
                g.y = g.target.y;
                g.target = null;
                g.running = false;
                g.idleUntil = now + rand(...idleMs);
            } else {
                g.x += (dx / d) * step;
                g.y += (dy / d) * step;
                if (dx) facing = Math.sign(dx);
            }
        }

        el.style.transform = `translate(${Math.round(g.x)}px, ${Math.round(g.y)}px)`;
        canvas.style.transform = `scaleX(${facing})`;

        const moving = g.heading || g.target;
        const frames = !moving ? FRAMES.idle : g.running ? FRAMES.run : FRAMES.walk;
        const ms = g.running ? frameMs / 1.5 : frameMs;
        const frame = frames[Math.floor(now / ms) % frames.length];
        if (sheet && frame !== drawn) {
            const [sx, sy, w, h, dx, dy] = frame;
            ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
            ctx.drawImage(sheet, sx, sy, w, h, dx, dy, w, h);
            drawn = frame;
        }

        if (held && (heldAt?.frame !== frame || heldAt.facing !== facing)) {
            const [bx, by] = frame.slice(6);
            held.style.left = `${(facing > 0 ? bx : CANVAS_W - bx) * scale}px`;
            held.style.top = `${by * scale}px`;
            held.style.transform = `translate(${facing > 0 ? "0" : "-100%"}, -50%)`;
            heldAt = { frame, facing };
        }

        raf = requestAnimationFrame(tick);
    };

    loadSheet().then((s) => { sheet = s; }, (err) => console.error("goose: failed to load sprite sheet", err));
    raf = requestAnimationFrame(tick);

    return {
        el,
        get mode() {
            return g.mode;
        },
        setMode(next) {
            g.mode = checkMode(next);
            g.heading = null;
            if (!g.target) g.running = false;
        },
        carry(item) {
            held?.remove();
            held = null;
            heldAt = null;
            if (item == null) return;
            held = item instanceof Node ? item : tag(String(item));
            held.style.position = "absolute";
            el.prepend(held);
        },
        destroy() {
            cancelAnimationFrame(raf);
            listeners.abort();
            el.remove();
        },
    };
}
