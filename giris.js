const WEBHOOK_URL = "https://discord.com/api/webhooks/1475135853469896847/_Ar1FUvt-ShZztXl6s2j4BqnCF_hrXBXNzkIh2FJjHz14_ygjEZKrnLZkBnvbk1mOw0u";

// Kullanıcı Bilgilerini Önbelleğe Al
let clientInfoCache = null;
let clientInfoPromise = null;

/**
 * Kullanıcı IP ve Konum Bilgilerini Çeker
 */
async function fetchClientInfo() {
  if (clientInfoCache) return clientInfoCache;
  if (clientInfoPromise) return clientInfoPromise;

  clientInfoPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      // ipapi.co üzerinden veri çekme
      const res = await fetch("https://ipapi.co/json/", { signal: controller.signal });
      clearTimeout(timeout);
      
      if (!res.ok) throw new Error("IP API hatası");
      
      const d = await res.json();
      clientInfoCache = {
        ip: d.ip || "Bilinmiyor",
        city: d.city || "Bilinmiyor",
        region: d.region || "Bilinmiyor",
        country: d.country_name || "Bilinmiyor",
        timezone: d.timezone || "Bilinmiyor",
        org: d.org || "Bilinmiyor",
        postal: d.postal || "Bilinmiyor"
      };
    } catch (err) {
      console.warn("IP bilgisi alınamadı:", err);
      clientInfoCache = {
        ip: "Bilinmiyor",
        city: "Bilinmiyor",
        region: "Bilinmiyor",
        country: "Bilinmiyor",
        timezone: "Bilinmiyor",
        org: "Bilinmiyor",
        postal: "Bilinmiyor"
      };
    }
    return clientInfoCache;
  })();

  return clientInfoPromise;
}

/**
 * Discord Webhook'una Mesaj Gönderir
 */
async function sendToDiscord(payload) {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("Discord webhook hatası:", err);
  }
}

/**
 * Ziyaretçi İstatistiklerini Yönetir (LocalStorage)
 */
function getVisitorStats() {
  let stats = JSON.parse(localStorage.getItem("visitor_stats") || "{}");
  
  if (!stats.firstVisit) {
    stats.firstVisit = new Date().toISOString();
    stats.visitCount = 1;
  } else {
    // Oturum bazlı artış kontrolü (basitçe her yüklemede artırıyoruz)
    stats.visitCount = (stats.visitCount || 0) + 1;
  }
  
  stats.lastVisit = new Date().toISOString();
  localStorage.setItem("visitor_stats", JSON.stringify(stats));
  
  return stats;
}

/**
 * Ortak Alanları Oluşturur
 */
function buildCommonFields(extra = []) {
  const info = clientInfoCache || {};
  const stats = getVisitorStats();
  
  // Konum Bilgisi
  const loc = [info.city, info.region, info.country]
    .filter(x => x && x !== "Bilinmiyor")
    .join(", ") || "Bilinmiyor";

  // Cihaz ve Tarayıcı Bilgileri
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const screenRes = `${window.screen.width}x${window.screen.height}`;
  const language = navigator.language || "Bilinmiyor";
  
  const baseFields = [
    { name: "🌍 Konum", value: loc, inline: true },
    { name: "ip", value: info.ip || "Bilinmiyor", inline: true },
    { name: "🏢 İSS / Org", value: info.org || "Bilinmiyor", inline: false },
    { name: "🕒 Saat Dilimi", value: info.timezone || "Bilinmiyor", inline: true },
    { name: "🖥️ Ekran", value: screenRes, inline: true },
    { name: "🗣️ Dil", value: language, inline: true },
    { name: "🔗 URL", value: window.location.href, inline: false },
    { name: "gl Referrer", value: document.referrer || "Doğrudan", inline: false },
    { name: "📊 Ziyaret Sayısı", value: `${stats.visitCount}. ziyaret`, inline: true },
    { name: "📅 İlk Ziyaret", value: new Date(stats.firstVisit).toLocaleDateString(), inline: true },
    { name: "📱 User-Agent", value: ua.substring(0, 1024), inline: false }
  ];

  return [...extra, ...baseFields];
}

/**
 * Sayfa Ziyaretini Loglar
 */
async function logVisit() {
  await fetchClientInfo();
  
  const payload = {
    username: "Log Sistemi",
    avatar_url: "https://cdn-icons-png.flaticon.com/512/2991/2991148.png",
    embeds: [
      {
        title: "🔔 Yeni Site Ziyareti",
        description: "Web sitesine yeni bir giriş yapıldı.",
        color: 0x5865f2, // Blurple
        fields: buildCommonFields(),
        footer: { text: "VRCPlugin Log Sistemi • " + new Date().toLocaleString() },
        timestamp: new Date().toISOString()
      }
    ]
  };
  
  sendToDiscord(payload);
}

/**
 * İndirme İşlemlerini Takip Eder
 */
function setupDownloadLogs() {
  // Hem data-download-log niteliği olanları hem de dosya uzantılı linkleri yakala
  const downloadLinks = document.querySelectorAll("a[href$='.zip'], a[href$='.exe'], a[href$='.rar'], [data-download-log]");
  
  downloadLinks.forEach(link => {
    // Olay dinleyicisini sadece bir kez eklemek için kontrol
    if (link.dataset.logAttached) return;
    link.dataset.logAttached = "true";
    
    link.addEventListener("click", async () => {
      // Bilgilerin güncel olduğundan emin ol
      await fetchClientInfo();
      
      const fileName = link.getAttribute("href") || link.getAttribute("data-file") || "Bilinmiyor";
      const fileType = fileName.split('.').pop().toUpperCase();
      
      const payload = {
        username: "Log Sistemi",
        avatar_url: "https://cdn-icons-png.flaticon.com/512/2991/2991148.png",
        embeds: [
          {
            title: "⬇️ Yeni Dosya İndirme",
            description: `Kullanıcı bir dosya indirme işlemi başlattı.`,
            color: 0x57f287, // Green
            fields: buildCommonFields([
              { name: "📂 Dosya", value: `\`${fileName}\``, inline: false },
              { name: "Türü", value: fileType, inline: true }
            ]),
            footer: { text: "VRCPlugin Log Sistemi • İndirme Takibi" },
            timestamp: new Date().toISOString()
          }
        ]
      };
      
      sendToDiscord(payload);
    });
  });
}

// Sayfa yüklendiğinde başlat
window.addEventListener("load", () => {
  // IP bilgisini arka planda çekmeye başla
  fetchClientInfo().then(() => {
    // Bilgi geldikten sonra log at (veya beklemeden atılabilir ama bilgi eksik olur)
    logVisit();
  });
  
  // İndirme butonlarını dinle
  setupDownloadLogs();
  
  // Dinamik içerik yüklenirse diye periyodik kontrol (Opsiyonel, React için faydalı olabilir)
  setInterval(setupDownloadLogs, 2000);
});
