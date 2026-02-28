const WEBHOOK_URL = "https://discord.com/api/webhooks/1475135853469896847/_Ar1FUvt-ShZztXl6s2j4BqnCF_hrXBXNzkIh2FJjHz14_ygjEZKrnLZkBnvbk1mOw0u"

let clientInfoCache = null
let clientInfoPromise = null

async function fetchClientInfo() {
  if (clientInfoCache) return clientInfoCache
  if (clientInfoPromise) return clientInfoPromise

  clientInfoPromise = (async () => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4000)
      const res = await fetch("https://ipapi.co/json/", { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) throw new Error("ipapi error")
      const d = await res.json()
      clientInfoCache = {
        ip: d.ip || "Bilinmiyor",
        city: d.city || "",
        region: d.region || "",
        country: d.country_name || "",
        timezone: d.timezone || "Bilinmiyor",
        org: d.org || "unknown"
      }
    } catch (_) {
      clientInfoCache = {
        ip: "Bilinmiyor",
        city: "",
        region: "",
        country: "",
        timezone: "Bilinmiyor",
        org: "unknown"
      }
    }
    return clientInfoCache
  })()

  return clientInfoPromise
}

async function sendToDiscord(payload) {
  if (!WEBHOOK_URL) return
  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
  } catch (err) {
    console.log("Discord webhook hatası:", err)
  }
}

function buildCommonFields(extra) {
  const info = clientInfoCache || {}
  const loc =
    [info.city, info.region, info.country]
      .filter(x => x && x.trim() !== "")
      .join(", ") || "Bilinmiyor"

  const base = [
    { name: "IP", value: info.ip || "Bilinmiyor", inline: true },
    { name: "Konum", value: loc, inline: true },
    { name: "Saat Dilimi", value: info.timezone || "Bilinmiyor", inline: true },
    { name: "ASN / Org", value: info.org || "unknown", inline: false },
    { name: "URL", value: window.location.href, inline: false },
    {
      name: "Referrer",
      value: document.referrer && document.referrer.trim() !== "" ? document.referrer : "Doğrudan giriş",
      inline: false
    },
    { name: "Dil", value: navigator.language || "unknown", inline: true },
    { name: "User-Agent", value: navigator.userAgent || "unknown", inline: false }
  ]

  return Array.isArray(extra) ? extra.concat(base) : base
}

async function logVisit() {
  await fetchClientInfo()
  const payload = {
    content: null,
    embeds: [
      {
        title: "Yeni Ziyaret",
        description: "Siteye yeni bir ziyaret tespit edildi.",
        color: 0x5865f2,
        fields: buildCommonFields(),
        footer: { text: "MivoraCraft Web • Ziyaret Log" },
        timestamp: new Date().toISOString()
      }
    ]
  }
  sendToDiscord(payload)
}

function setupDownloadLogs() {
  const buttons = document.querySelectorAll("[data-download-log]")
  if (!buttons.length) return

  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      await fetchClientInfo()
      const file = btn.getAttribute("data-file") || btn.getAttribute("href") || "Bilinmiyor"
      const payload = {
        content: null,
        embeds: [
          {
            title: "Yeni İndirme",
            description: "Launcher indirildi.",
            color: 0x57f287,
            fields: buildCommonFields([{ name: "Dosya", value: file, inline: false }]),
            footer: { text: "MivoraCraft Web • İndirme Log" },
            timestamp: new Date().toISOString()
          }
        ]
      }
      sendToDiscord(payload)
    })
  })
}

window.addEventListener("load", () => {
  fetchClientInfo()
  logVisit()
  setupDownloadLogs()
})

