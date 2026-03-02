/**
 * newtyc.js — Sistema de noticias TyC Sports (funcional y optimizado)
 * Extrae noticias reales desde tycsports.com
 */

const puppeteer = require("puppeteer");
const fs = require("node:fs");
const { readJSON, writeJSON } = require("./database");
const ffmpegService = require("../services/ffmpeg");

let intervalStarted = false;
const MAX_ARTICLES = 1;

// ----------------------------
// Obtener últimas noticias reales desde TyC
// ----------------------------
async function getLatestNews(limit = MAX_ARTICLES) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto("https://www.tycsports.com/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await new Promise((r) => setTimeout(r, 2000));

    const newsItems = await page.evaluate((max) => {
      const results = [];
      const newsUrlRegex = /-id\d+\.html$/;

      const links = Array.from(document.querySelectorAll("a[href^='https://www.tycsports.com/']"));

      for (const a of links) {
        if (results.length >= max) break;

        const url = a.href.trim();
        if (!newsUrlRegex.test(url)) continue;

        // Extraemos título provisional del enlace
        let title = a.querySelector("h3")?.innerText.trim() || "";

        // Imagen provisional
        const imgEl = a.querySelector("img");
        const imageUrl = imgEl ? imgEl.getAttribute("data-src") || imgEl.src || "" : "";

        if (results.find(r => r.url === url)) continue;

        results.push({ title, url, imageUrl });
      }

      return results;
    }, limit);

    await browser.close();
    return newsItems;
  } catch (err) {
    console.error("TyC Puppeteer scraping error:", err.message);
    if (browser) await browser.close();
    return [];
  }
}

// ----------------------------
// Enviar lista de noticias a grupos
// ----------------------------
async function sendNewsToGroups(sock, newsList, db) {
  if (!newsList || !newsList.length) return;

  for (const group of db.groupsEnabled) {
    for (const latest of newsList) {
      try {
        const msgOptions = latest.imageBuffer
          ? { image: latest.imageBuffer, caption: `📰 *Noticias TyC Sports*\n\n*${latest.title}*\n${latest.summary ? `\n_${latest.summary}_\n` : ""}\n🔗 ${latest.url}` }
          : { text: `📰 *Noticias TyC Sports*\n\n*${latest.title}*\n${latest.summary ? `\n_${latest.summary}_\n` : ""}\n🔗 ${latest.url}` };

        await sock.sendMessage(group, msgOptions);
        console.log(`✅ Noticia enviada: ${latest.title}`);
      } catch (err) {
        console.error("Error enviando noticia:", err.message);
      }
    }
  }
}

// ----------------------------
// Obtener detalles completos de cada noticia
// ----------------------------
async function fetchNewsDetails(items) {
  const articles = [];
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });

    for (const item of items) {
      try {
        const detailPage = await browser.newPage();
        await detailPage.goto(item.url, { waitUntil: "networkidle2", timeout: 30000 });
        await new Promise((r) => setTimeout(r, 1000));

        // Extraemos resumen, título real y hora
        const detail = await detailPage.evaluate(() => {
          const titleEl = document.querySelector("h1") || document.querySelector("h2") || document.querySelector("h3");
          const summaryEl = document.querySelector(".lead, .intro, p");
          const timeEl = document.querySelector("time");
          const imgEl = document.querySelector("figure img");

          const title = titleEl ? titleEl.innerText.trim() : "";
          const summary = summaryEl ? summaryEl.innerText.trim() : "";
          const timeRaw = timeEl ? timeEl.getAttribute("datetime") || "" : "";
          const time = timeRaw ? new Date(timeRaw).toLocaleString("es-AR") : "";
          const imageUrl = imgEl ? imgEl.getAttribute("data-src") || imgEl.src || "" : "";

          return { title, summary, time, imageUrl };
        });

        await detailPage.close();

        let imageBuffer = null;
        const finalImageUrl = detail.imageUrl || item.imageUrl;
        if (finalImageUrl) {
          try {
            const tmpPath = await ffmpegService._createTempFilePath("jpg");
            await ffmpegService.downloadImage(finalImageUrl, tmpPath);
            imageBuffer = fs.readFileSync(tmpPath);
            await ffmpegService.cleanup(tmpPath);
          } catch (e) {
            console.error("Error bajando imagen:", e.message);
          }
        }

        articles.push({
          title: detail.title || item.title,
          url: item.url,
          summary: detail.summary,
          time: detail.time,
          imageBuffer
        });

      } catch (err) {
        console.error("Error procesando noticia:", err.message);
      }
    }
  } catch (err) {
    console.error("Error en browser de detalles:", err.message);
  } finally {
    if (browser) await browser.close();
  }

  return articles;
}

// ----------------------------
// Chequear nuevas noticias periódicamente
// ----------------------------
async function checkNews(sock) {
  const db = readJSON("news-tyc", { lastUrl: "", groupsEnabled: [] });
  if (!db.groupsEnabled.length) return;

  const scraped = await getLatestNews(MAX_ARTICLES);
  if (!scraped.length) return;
  if (scraped[0].url === db.lastUrl) return;

  db.lastUrl = scraped[0].url;
  writeJSON("news-tyc", db);

  const articles = await fetchNewsDetails(scraped);
  await sendNewsToGroups(sock, articles, db);
}

// ----------------------------
// Envío de noticias al iniciar
// ----------------------------
async function sendLatestOnStart(sock) {
  const db = readJSON("news-tyc", { lastUrl: "", groupsEnabled: [] });
  if (!db.groupsEnabled.length) return;

  const scraped = await getLatestNews(MAX_ARTICLES);
  if (!scraped.length) return;

  db.lastUrl = scraped[0].url;
  writeJSON("news-tyc", db);

  const articles = await fetchNewsDetails(scraped);
  await sendNewsToGroups(sock, articles, db);
}

// ----------------------------
// Inicializar sistema TyC
// ----------------------------
function startTyCSystem(sock) {
  if (intervalStarted) return;
  intervalStarted = true;

  console.log("📡 Sistema de noticias TyC iniciado");

  sendLatestOnStart(sock);

  setInterval(async () => {
    try {
      await checkNews(sock);
    } catch (err) {
      console.error("TyC interval error:", err.message);
    }
  }, 1 * 60 * 1000);
}

module.exports = { startTyCSystem };
