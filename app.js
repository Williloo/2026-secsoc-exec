import { spawnGoose } from "goose";

const goose = spawnGoose({ mode: "avoid" });

const popup = document.getElementById("popup");
if (popup) {
    setTimeout(() => {
        popup.showModal();
        popup.focus();
    }, 500);
}

(async () => {
    const sources = [
        { url: "https://ifconfig.me/ip", parse: (t) => t.trim() },
        { url: "https://api.ipify.org?format=json", parse: (t) => JSON.parse(t).ip },
    ];

    for (const { url, parse } of sources) {
        try {
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) continue;
            const ip = parse(await res.text());
            if (ip) {
                goose.carry(ip);
                return;
            }
        } catch {
            // try the next source
        }
    }
})();

(() => {
    const form = document.getElementById("flag-form");
    const input = document.getElementById("flag-input");
    if (!form || !input) return;

    const hashes = {
        "caec8da3fb3aea35c05095e2c2abcda0a80c366432c6941aea278087cea4b0ab": "sauce",
        "072fe9a853c6e334e06867489c26385e59123fd8bc44b056756219d574aac68d": "coding",
        "df3ee88579a300d975d710e9440f4932624097a5c701325f8df54c9432c54d69": "crypto",
    };

    const storeKey = "ctf-solved";
    let solved = new Set();
    try {
        solved = new Set(JSON.parse(localStorage.getItem(storeKey) || "[]"));
    } catch {
    }

    const tile = (id) => document.querySelector(`.chall[data-chall="${id}"]`);
    for (const id of solved) tile(id)?.classList.add("solved");

    const sha256 = async (text) => {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    };

    const flash = (state) => {
        form.classList.remove("correct", "wrong");
        void input.offsetWidth;
        form.classList.add(state);
        setTimeout(() => form.classList.remove(state), 1200);
    };

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const flag = input.value.trim();
        if (!flag) return;

        const id = hashes[await sha256(flag)];
        if (!id) {
            flash("wrong");
            return;
        }

        if (solved.has(id)) {
            flash("correct");
        } else {
            solved.add(id);
            tile(id)?.classList.add("solved");
            try { localStorage.setItem(storeKey, JSON.stringify([...solved])); } catch {}
            flash("correct");
        }
        input.value = "";
    });
})();
