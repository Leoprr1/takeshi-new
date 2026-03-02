/**
 * newtyc.js — Sistema de noticias desde Instagram (TyC Sports)
 * Login manual solo la primera vez + cookies + detección de sesión expirada
 * Siempre envía al menos la última publicación
 * Ahora soporta posts y reels
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const { readJSON, writeJSON } = require("./database");
const ffmpegService = require("../services/ffmpeg");

let intervalStarted = false;
const MAX_ARTICLES = 5;
const INSTAGRAM_USER = "tycsports";
const COOKIES_PATH = "./cookies.json";

// --------------------------------------------------
// FUNCIÓN PARA ESPERAR TIEMPO
// --------------------------------------------------
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --------------------------------------------------
// LOGIN INSTAGRAM CON DETECCIÓN DE SESIÓN EXPIRADA
// --------------------------------------------------
async function instagramLogin(page) {
  const cookiesExist = fs.existsSync(COOKIES_PATH);

  if (cookiesExist) {
    console.log("🍪 Cargando cookies guardadas...");
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, "utf8"));
    await page.setCookie(...cookies);
    await page.goto("https://www.instagram.com/", { waitUntil: "networkidle2" });
    try {
      await waitForFeed(page);
      console.log("✅ Sesión válida con cookies.");
      return;
    } catch {
      console.log("⚠ Sesión expirada. Necesario login manual.");
    }
  }

  console.log("🔐 Abriendo Instagram para login manual...");
  await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "networkidle2" });
  console.log("⌛ Por favor, iniciá sesión manualmente en la ventana del navegador.");
  await waitForFeed(page);

  console.log("✅ Sesión detectada, guardando cookies...");
  const cookies = await page.cookies();
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
  console.log("🍪 Cookies guardadas correctamente.");
}

// --------------------------------------------------
// ESPERA ROBUSTA DEL FEED
// --------------------------------------------------
async function waitForFeed(page) {
  const timeout = 20000; // 20 segundos máximo
  const startTime = Date.now();
  let feedDetected = false;

  while (!feedDetected && Date.now() - startTime < timeout) {
    feedDetected = await page.evaluate(() => !!document.querySelector("a[href*='/p/'], a[href*='/reel/']"));
    if (!feedDetected) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await wait(1000);
    }
  }

  if (!feedDetected) {
    console.log("⚠ No se detectó feed, se tomará la primera publicación si existe.");
  }
}

// --------------------------------------------------
// OBTENER ÚLTIMAS PUBLICACIONES (POSTS Y REELS)
// --------------------------------------------------
async function getLatestNews(limit = MAX_ARTICLES) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: fs.existsSync(COOKIES_PATH),
      defaultViewport: null,
      args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await instagramLogin(page);
    await page.goto(`https://www.instagram.com/${INSTAGRAM_USER}/`, { waitUntil: "networkidle2" });

    await waitForFeed(page);

    const posts = await page.evaluate((max) => {
      const links = Array.from(
        document.querySelectorAll("a[href*='/p/'], a[href*='/reel/']")
      ).slice(0, max);

      return links.map(a => {
        const img = a.querySelector("img");
        return {
          url: a.href,
          title: "", // se asignará más tarde desde el caption real
          imageUrl: img ? img.src : "",
        };
      });
    }, limit);

    console.log("📝 Posts detectados:", posts.map(p => p.url));
    await browser.close();
    return posts;
  } catch (err) {
    console.error("❌ Instagram Puppeteer error:", err.message);
    if (browser) await browser.close();
    return [];
  }
}

// --------------------------------------------------
// DETALLES DE CADA PUBLICACIÓN
// --------------------------------------------------
async function fetchNewsDetails(items) {
  const articles = [];
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    for (const item of items) {
      try {
        const page = await browser.newPage();
        await page.goto(item.url, { waitUntil: "networkidle2" });
        await wait(1500);

        const detail = await page.evaluate(() => {
          const article = document.querySelector("article");

          let summary = "";
          if (article) {
            const spans = Array.from(article.querySelectorAll("span"))
              .map(s => s.innerText.trim())
              .filter(text => text && !text.startsWith("Photo by"));
            summary = spans.join("\n");
          }

          const timeEl = article ? article.querySelector("time") : null;
          const imgEl = article ? article.querySelector("img") : null;

          return {
            summary: summary || "Noticia TyC Sports",
            time: timeEl ? new Date(timeEl.getAttribute("datetime")).toISOString() : "",
            imageUrl: imgEl ? imgEl.src : "",
          };
        });

        await page.close();

        let imageBuffer = null;
        const finalImageUrl = detail.imageUrl || item.imageUrl;

        if (finalImageUrl) {
          try {
            const tmpPath = await ffmpegService._createTempFilePath("jpg");
            await ffmpegService.downloadImage(finalImageUrl, tmpPath);
            imageBuffer = fs.readFileSync(tmpPath);
            await ffmpegService.cleanup(tmpPath);
          } catch (e) {
            console.error("⚠ Error bajando imagen:", e.message);
          }
        }

        // Crear un título limpio a partir del caption (primeras 50 caracteres del primer renglón)
        const cleanTitle = detail.summary ? detail.summary.split("\n")[0].slice(0, 50) : "Noticia TyC Sports";

        articles.push({
          title: cleanTitle,
          url: item.url,
          summary: detail.summary,
          time: detail.time,
          imageBuffer,
        });
      } catch (err) {
        console.error("Error procesando publicación:", err.message);
      }
    }
  } catch (err) {
    console.error("Error en browser detalles:", err.message);
  } finally {
    if (browser) await browser.close();
  }

  console.log("📝 Detalles de posts:", articles.map(a => a.url));
  return articles.sort((a, b) => new Date(b.time) - new Date(a.time));
}

// --------------------------------------------------
// ENVIAR A GRUPOS
// --------------------------------------------------
async function sendNewsToGroups(sock, newsItem, db) {
  if (!newsItem || !db.groupsEnabled?.length) return;

  for (const group of db.groupsEnabled) {
    try {
      const msgOptions = newsItem.imageBuffer
        ? { image: newsItem.imageBuffer, caption: `📰 *Noticias TyC Sports*\n\n*${newsItem.title}*\n\n_${newsItem.summary}_\n\n🔗 ${newsItem.url}` }
        : { text: `📰 *Noticias TyC Sports*\n\n*${newsItem.title}*\n\n_${newsItem.summary}_\n\n🔗 ${newsItem.url}` };

      await sock.sendMessage(group, msgOptions);
      console.log("✅ Publicación enviada a:", group, "-", newsItem.title);
    } catch (err) {
      console.error("Error enviando publicación al grupo", group, ":", err.message);
    }
  }
}

// --------------------------------------------------
// CHEQUEAR NUEVAS PUBLICACIONES (SOLO LA ÚLTIMA)
// --------------------------------------------------
async function checkNews(sock) {
  const db = readJSON("news-tyc", { lastUrl: "", groupsEnabled: [] });
  if (!db.groupsEnabled?.length) {
    console.log("⚠ No hay grupos habilitados en news-tyc.json");
    return;
  }

  const scraped = await getLatestNews(1); // solo obtenemos la última publicación
  if (!scraped.length) return;

  const articles = await fetchNewsDetails(scraped);
  if (!articles.length) return;

  const latest = articles[0];

  // Si ya se envió, no hacemos nada
  if (latest.url === db.lastUrl) return;

  // Guardamos la última URL enviada
  db.lastUrl = latest.url;
  writeJSON("news-tyc", db);

  // Enviar la última publicación a los grupos habilitados
  await sendNewsToGroups(sock, latest, db);
}

// --------------------------------------------------
// INICIO
// --------------------------------------------------
function startTyCSystem(sock) {
  if (intervalStarted) return;
  intervalStarted = true;

  console.log("📡 Sistema TyC Instagram iniciado");
  setInterval(async () => {
    try {
      await checkNews(sock);
    } catch (err) {
      console.error("Interval error:", err.message);
    }
  }, 60 * 1000);
}

module.exports = { startTyCSystem };
