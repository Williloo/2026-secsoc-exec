(async () => {
    const el = document.getElementById("ip");
    if (!el) return;

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
                el.textContent = ip;
                return;
            }
        } catch {
            // try the next source
        }
    }

    el.textContent = "unavailable";
})();
