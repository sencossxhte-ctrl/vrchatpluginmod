const WEBHOOK_URL = "https://discord.com/api/webhooks/1480314205910339758/PIPNu-COi3Br6_ijXVeThGJLmkgKdDw3orLs555aOzzTp8--7tCYc3sU-BS0egTZBUcM";

// Kullanıcı Bilgilerini Önbelleğe Al
let clientInfoCache = null;
let clientInfoPromise = null;
let startTime = Date.now(); // Siteye giriş zamanı

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
 * @param {Object} payload - Gönderilecek veri
 * @param {boolean} keepAlive - Sayfa kapanırken isteğin kesilmemesi için (fetch keepalive)
 */
async function sendToDiscord(payload, keepAlive = false) {
  if (!WEBHOOK_URL) return;
  try {
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    };
    
    // Sayfa kapanırken isteğin tamamlanması için keepalive özelliği
    if (keepAlive) {
      options.keepalive = true;
    }

    await fetch(WEBHOOK_URL, options);
  } catch (err) {
    console.error("Discord webhook hatası:", err);
    
    // Eğer fetch başarısız olursa ve keepAlive ise navigator.sendBeacon deneyelim (yedek olarak)
    if (keepAlive && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(WEBHOOK_URL, blob);
    }
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
 * Sayfa Ziyaretini Loglar (GİRİŞ)
 */
async function logVisit() {
  await fetchClientInfo();
  
  const payload = {
    username: "Log Sistemi",
    avatar_url: "https://cdn-icons-png.flaticon.com/512/2991/2991148.png",
    embeds: [
      {
        title: "🟢 Siteye Giriş Yapıldı",
        description: "Kullanıcı siteye giriş yaptı.",
        color: 0x57F287, // Green
        fields: buildCommonFields(),
        footer: { text: "VRCPlugin Log Sistemi • Giriş" },
        timestamp: new Date().toISOString()
      }
    ]
  };
  
  sendToDiscord(payload);
}

/**
 * Sayfadan Çıkışı Loglar (ÇIKIŞ)
 */
function logExit() {
  const duration = Math.floor((Date.now() - startTime) / 1000); // Saniye cinsinden süre
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const timeSpent = `${minutes}dk ${seconds}sn`;

  const payload = {
    username: "Log Sistemi",
    avatar_url: "https://cdn-icons-png.flaticon.com/512/2991/2991148.png",
    embeds: [
      {
        title: "🔴 Siteden Çıkış Yapıldı",
        description: `Kullanıcı siteden ayrıldı.`,
        color: 0xED4245, // Red
        fields: buildCommonFields([
          { name: "⏱️ Geçirilen Süre", value: timeSpent, inline: false }
        ]),
        footer: { text: "VRCPlugin Log Sistemi • Çıkış" },
        timestamp: new Date().toISOString()
      }
    ]
  };

  // Sayfa kapanırken isteğin gitmesi için keepAlive: true
  sendToDiscord(payload, true);
}

/**
 * İndirme İşlemlerini Takip Eder (Event Delegation)
 */
function setupDownloadLogs() {
  document.addEventListener("click", async (e) => {
    // Tıklanan eleman veya ebeveynlerinden biri link mi?
    const link = e.target.closest("a");
    if (!link) return;

    // Link bir indirme linki mi?
    const href = link.getAttribute("href") || "";
    const isDownload = 
      href.endsWith(".zip") || 
      href.endsWith(".exe") || 
      href.endsWith(".rar") || 
      href.endsWith(".msi") ||
      link.hasAttribute("download") ||
      link.hasAttribute("data-download-log");

    if (!isDownload) return;

    // Bilgilerin güncel olduğundan emin ol
    await fetchClientInfo();
    
    const fileName = href || link.getAttribute("data-file") || "Bilinmiyor";
    const fileType = fileName.split('.').length > 1 ? fileName.split('.').pop().toUpperCase() : "DOSYA";
    
    const payload = {
      username: "Log Sistemi",
      avatar_url: "https://cdn-icons-png.flaticon.com/512/2991/2991148.png",
      embeds: [
        {
          title: "⬇️ Yeni Dosya İndirme",
          description: `Kullanıcı bir dosya indirme işlemi başlattı.`,
          color: 0xFEE75C, // Yellow
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
}

// Sayfa yüklendiğinde başlat
window.addEventListener("load", () => {
  // IP bilgisini arka planda çekmeye başla
  fetchClientInfo().then(() => {
    // Bilgi geldikten sonra log at
    logVisit();
  });
  
  // İndirme takibini başlat
  setupDownloadLogs();
});

// Sayfa kapanırken veya yenilenirken çıkış logu at
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === 'hidden') {
    logExit();
  }
});
// Alternatif çıkış yakalama (bazı tarayıcılar için)
window.addEventListener("pagehide", logExit);

