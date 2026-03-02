/**
 * newtyc.js
 * Sistema de noticias TyC Sports para WhatsApp
 * Compatible con ffmpeg.js para descargar imágenes correctamente
 */

const puppeteer = require("puppeteer");
const fs = require("node:fs");
const { readJSON, writeJSON } = require("./database");
const ffmpegService = require("../services/ffmpeg"); // <-- tu ffmpeg.js actualizado

let intervalStarted = false;
const MAX_ARTICLES = 5; // Máximo de noticias a enviar

// ----------------------------
// Obtener las últimas noticias con Puppeteer
// ----------------------------
async function getLatestNews(limit = MAX_ARTICLES) {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.goto("https://www.tycsports.com/noticias.html", { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    const newsLinks = await page.evaluate((max) => {
      const links = [];
      const all = Array.from(document.querySelectorAll("a[href*='/noticias/']"));
      for (const a of all) {
        const url = a.href.trim();
        const title = a.innerText.trim();
        if (!title || !url.includes("tycsports.com")) continue;
        if (links.find(l => l.url === url)) continue;
        links.push({ title, url });
        if (links.length >= max) break;
      }
      return links;
    }, limit);

    const articles = [];

    for (const news of newsLinks) {
      try {
        const newsPage = await browser.newPage();
        await newsPage.goto(news.url, { waitUntil: "networkidle2", timeout: 30000 });
        await new Promise(r => setTimeout(r, 1000));

        const data = await newsPage.evaluate(() => {
          const titleEl = document.querySelector("h1") || document.querySelector("h2");
          const summaryEl = document.querySelector("p") || document.querySelector(".MuiTypography-root");
          const timeEl = document.querySelector("time");
          const imgEl = document.querySelector("img[data-src]") || document.querySelector("picture img");

          const title = titleEl ? titleEl.innerText.trim() : "";
          const summary = summaryEl ? summaryEl.innerText.trim() : "";
          const timeRaw = timeEl ? timeEl.getAttribute("datetime") : "";
          const time = timeRaw ? new Date(timeRaw).toLocaleString("es-AR") : "";
          const imageUrl = imgEl ? (imgEl.getAttribute("data-src") || imgEl.src) : "";

          return { title, summary, time, imageUrl };
        });

        let imageBuffer = null;
        if (data.imageUrl) {
          try {
            const tempPath = await ffmpegService._createTempFilePath("jpg");
            await ffmpegService.downloadImage(data.imageUrl, tempPath);
            imageBuffer = fs.readFileSync(tempPath); // buffer real para enviar
            await ffmpegService.cleanup(tempPath); // limpiar temp
          } catch (e) {
            console.error("Error descargando imagen:", e.message);
          }
        }

        articles.push({
          title: data.title || news.title,
          url: news.url,
          summary: data.summary,
          time: data.time,
          imageBuffer
        });

        await newsPage.close();
      } catch (err) {
        console.error("Error abriendo noticia:", news.url, err.message);
      }
    }

    return articles;
  } catch (err) {
    console.error("TyC Puppeteer scraping error:", err.message);
    return [];
  } finally {
    if (browser) await browser.close();
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
        const msgOptions = {};
        if (latest.imageBuffer) {
          msgOptions.image = latest.imageBuffer;
          msgOptions.caption = `📰 *Noticias TyC Sports*\n\n*${latest.title}*\n${latest.summary ? `\n_${latest.summary}_\n` : ""}${latest.time ? `\n🕒 ${latest.time}\n` : ""}\n🔗 ${latest.url}`;
        } else {
          msgOptions.text = `📰 *Noticias TyC Sports*\n\n*${latest.title}*\n${latest.summary ? `\n_${latest.summary}_\n` : ""}${latest.time ? `\n🕒 ${latest.time}\n` : ""}\n🔗 ${latest.url}`;
        }

        await sock.sendMessage(group, msgOptions);
        console.log(`✅ Noticia enviada a ${group}: ${latest.title}`);
      } catch (err) {
        console.error("Error enviando noticia:", err.message);
      }
    }
  }
}

// ----------------------------
// Chequear nuevas noticias periódicamente
// ----------------------------
async function checkNews(sock) {
  const db = readJSON("news-tyc", { lastUrl: "", groupsEnabled: [] });
  if (!db.groupsEnabled.length) return;

  const latest = await getLatestNews(1);
  if (!latest.length) return;

  if (latest[0].url === db.lastUrl) return;

  db.lastUrl = latest[0].url;
  writeJSON("news-tyc", db);

  await sendNewsToGroups(sock, [latest[0]], db);
}

// ----------------------------
// Envío de noticias al iniciar
// ----------------------------
async function sendLatestOnStart(sock) {
  const db = readJSON("news-tyc", { lastUrl: "", groupsEnabled: [] });
  if (!db.groupsEnabled.length) return;

  const latest = await getLatestNews(MAX_ARTICLES);
  if (!latest.length) return;

  await sendNewsToGroups(sock, latest, db);

  db.lastUrl = latest[0].url;
  writeJSON("news-tyc", db);
}

// ----------------------------
// Inicializar sistema de noticias TyC
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
  }, 20 * 1000);
}

module.exports = { startTyCSystem };
