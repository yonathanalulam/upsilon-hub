import Parser from 'rss-parser';
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';


// persist summaries between runs so we don't re-summarize articles we've already seen
const CACHE_PATH = path.resolve('./src/data/summaryCache.json');
let summaryCache = {};
if (fs.existsSync(CACHE_PATH)) {
  try {
    summaryCache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
    console.log(`📦 Loaded summary cache (${Object.keys(summaryCache).length} entries)\n`);
  } catch {
    console.log('⚠️  Could not parse summaryCache.json — starting fresh.\n');
  }
}

// How many NEW (non-cached) Gemini calls we'll allow per run.
// The free tier is 1,500 requests/day. Daily runs of ~140 articles would exceed
// that immediately if everything is uncached. Capping at 25 keeps us safe even
// if the cache is wiped, and the cache fills quickly over the first few runs.
const MAX_NEW_GEMINI_CALLS_PER_RUN = 25;
let newGeminiCallsThisRun = 0;


// load .env manually — GitHub Actions injects GEMINI_API_KEY via secrets,
// but local runs need it from the file
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const geminiEnabled = GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here';
const groqEnabled = GROQ_API_KEY && GROQ_API_KEY !== 'your_groq_api_key_here';

let genAI, geminiModel;

if (geminiEnabled) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
  console.log('✨ Gemini 2.0 Flash Lite AI summaries: ENABLED\n');
} else {
  console.log('⚠️  GEMINI_API_KEY not set — Gemini disabled.\n');
}

if (groqEnabled) {
  console.log('✨ Groq fallback AI summaries: ENABLED\n');
} else {
  console.log('⚠️  GROQ_API_KEY not set — Groq fallback disabled.\n');
}

if (!geminiEnabled && !groqEnabled) {
  console.log('⚠️  No AI provider available — all summaries will fall back to RSS excerpts.\n');
}


const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Upsilon-Hub-NewsAggregator/1.0 (+https://upsilon-hub.vercel.app)'
  }
});

const SOURCES = [
  { name: "APS Physics", url: "http://feeds.aps.org/rss/recent/physics.xml" },
  { name: "Physics World", url: "https://physicsworld.com/feed" },
  { name: "CERN News", url: "https://home.cern/api/news/news/feed.rss" },
  { name: "MIT News", url: "https://news.mit.edu/rss/topic/physics" },
  { name: "Quanta Magazine", url: "https://api.quantamagazine.org/feed/" },
  { name: "Scientific American", url: "http://rss.sciam.com/ScientificAmerican-Global" },
  { name: "New Scientist", url: "https://www.newscientist.com/subject/physics/feed/" },
  { name: "Ars Technica", url: "https://arstechnica.com/science/feed/" },
  { name: "Live Science", url: "https://www.livescience.com/feeds/all" },
  { name: "Phys.org", url: "https://phys.org/rss-feed/physics-news/" },
  { name: "SciTechDaily", url: "https://scitechdaily.com/tag/physics/feed/" },
  { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/matter_energy/physics.xml" },
  { name: "Symmetry Mag", url: "https://www.symmetrymagazine.org/feed" },
  { name: "Space.com", url: "https://www.space.com/feeds/news" },
  { name: "IEEE Spectrum", url: "https://spectrum.ieee.org/feeds/topic/robotics" }
];

const TOPIC_KEYWORDS = [
  { id: "Quantum Physics", terms: ["quantum", "entanglement", "qubit", "qubits", "spin", "superposition", "decoherence"] },
  { id: "Astrophysics", terms: ["space", "universe", "galaxy", "galaxies", "star", "stars", "planet", "planets", "nasa", "webb", "black hole", "cosmos", "solar", "asteroid"] },
  { id: "High Energy", terms: ["particle", "particles", "collider", "cern", "lhc", "neutrino", "boson", "dark matter", "antimatter", "symmetry", "quark"] },
  { id: "Nanotech", terms: ["nano", "nanotech", "nanotechnology", "nanoscale", "graphene", "material science", "microscopic", "molecular", "carbon nanotube"] },
  { id: "Robotics", terms: ["robot", "robots", "robotics", "robotic", "drone", "drones", "autonomous", "actuator", "bionic", "android", "automation"] },
  { id: "Nuclear Physics", terms: ["nuclear", "fission", "fusion", "radioactive", "reactor", "isotope", "atomic"] },
  { id: "Optics", terms: ["laser", "lasers", "light", "optic", "optics", "photon", "photons", "hologram", "lens", "microscope"] },
  { id: "Condensed Matter", terms: ["superconductor", "semiconductor", "crystal", "fluid", "solid state", "condensed", "material"] },
  { id: "Thermodynamics", terms: ["entropy", "heat", "thermal", "energy efficiency", "dynamic", "temperature"] },
  { id: "Plasma Physics", terms: ["plasma", "ionization", "charged particle", "solar wind"] }
];

const EXCLUDED_TERMS = [
  "tiktok", "celebrity", "movie", "politics", "horoscope", "astrology", "zodiac",
  "stock market", "chatgpt", "generative ai", "dating", "fashion", "deal"
];

const THEME_GALLERY = {
  "Quantum Physics": [
    "https://images.pexels.com/photos/256381/pexels-photo-256381.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/373543/pexels-photo-373543.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1148820/pexels-photo-1148820.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/60504/security-protection-anti-virus-software-60504.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/5473182/pexels-photo-5473182.jpeg?auto=compress&cs=tinysrgb&w=800"
  ],
  "Astrophysics": [
    "https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2150/sky-space-dark-galaxy.jpg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/39561/solar-flare-sun-eruption-energy-39561.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/110854/pexels-photo-110854.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/586030/pexels-photo-586030.jpeg?auto=compress&cs=tinysrgb&w=800"
  ],
  "High Energy": [
     "https://images.pexels.com/photos/60022/pexels-photo-60022.jpeg?auto=compress&cs=tinysrgb&w=800",
     "https://images.pexels.com/photos/256302/pexels-photo-256302.jpeg?auto=compress&cs=tinysrgb&w=800",
     "https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=800",
     "https://images.pexels.com/photos/632470/pexels-photo-632470.jpeg?auto=compress&cs=tinysrgb&w=800"
  ],
  "Nanotech": [
    "https://images.pexels.com/photos/3825527/pexels-photo-3825527.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/8438993/pexels-photo-8438993.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/3735707/pexels-photo-3735707.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/356043/pexels-photo-356043.jpeg?auto=compress&cs=tinysrgb&w=800"
  ],
  "Robotics": [
    "https://images.pexels.com/photos/8386434/pexels-photo-8386434.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2599244/pexels-photo-2599244.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/11035471/pexels-photo-11035471.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2085831/pexels-photo-2085831.jpeg?auto=compress&cs=tinysrgb&w=800"
  ],
  "Nuclear Physics": [
    "https://images.pexels.com/photos/3044470/pexels-photo-3044470.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/5473068/pexels-photo-5473068.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/4597922/pexels-photo-4597922.jpeg?auto=compress&cs=tinysrgb&w=800"
  ],
  "Optics": [
    "https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/3862632/pexels-photo-3862632.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/5726706/pexels-photo-5726706.jpeg?auto=compress&cs=tinysrgb&w=800"
  ],
  "Condensed Matter": [
    "https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/3662919/pexels-photo-3662919.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/256262/pexels-photo-256262.jpeg?auto=compress&cs=tinysrgb&w=800"
  ],
  "Thermodynamics": [
    "https://images.pexels.com/photos/2803163/pexels-photo-2803163.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2085831/pexels-photo-2085831.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/220201/pexels-photo-220201.jpeg?auto=compress&cs=tinysrgb&w=800"
  ],
  "Plasma Physics": [
    "https://images.pexels.com/photos/110854/pexels-photo-110854.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/4597922/pexels-photo-4597922.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/360591/pexels-photo-360591.jpeg?auto=compress&cs=tinysrgb&w=800"
  ],
  "Universal": [
    "https://images.pexels.com/photos/2034892/pexels-photo-2034892.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/5037913/pexels-photo-5037913.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/6256247/pexels-photo-6256247.jpeg?auto=compress&cs=tinysrgb&w=800"
  ]
};

function classifyArticle(item) {
  const text = (item.title + " " + (item.contentSnippet || "") + " " + (item.categories || []).join(" ")).toLowerCase();
  if (EXCLUDED_TERMS.some(badWord => text.includes(badWord))) return null;
  for (const topic of TOPIC_KEYWORDS) {
    if (topic.terms.some(term => new RegExp(`\\b${term}\\b`, 'i').test(text))) return topic.id;
  }
  return null;
}

function isRoboticsValid(item) {
  const text = (item.title + " " + item.contentSnippet).toLowerCase();
  const forbidden = ["chatbot", "chatgpt", "generative ai", "llm", "large language model", "stock market"];
  const required = ["robot", "drone", "machine", "actuator", "sensor", "autonomous", "rover"];
  if (forbidden.some(w => text.includes(w))) return false;
  return required.some(w => text.includes(w));
}

function getFallbackImage(category) {
  const gallery = THEME_GALLERY[category] || THEME_GALLERY["Universal"];
  return gallery[Math.floor(Math.random() * gallery.length)];
}


async function getOgImage(url) {
  try {
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'Upsilon-Hub-NewsAggregator/1.0 (+https://upsilon-hub.vercel.app)',
        'Accept': 'text/html'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);
    return $('meta[property="og:image"]').attr('content') || null;
  } catch {
    return null;
  }
}

function generateSlug(title, url) {
  const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  // hash the article URL so the slug is always the same for the same article,
  // even across daily rebuilds — random bytes would break saved bookmarks every run
  const hash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 8);
  return `${baseSlug}-${hash}`;
}

function getRssExcerpt(item) {
  const rawContent = item.content || item['content:encoded'] || '';
  const snippetText = item.contentSnippet || '';
  const stripped = rawContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const best = stripped.length > snippetText.length ? stripped : snippetText;
  return best.slice(0, 600).trim();
}


// Gemini rate-limiting: 30 RPM on free tier = one call every ~2s
let lastGeminiCall = 0;
const GEMINI_DELAY_MS = 2100;

// tripped to true the moment we see a 429 from either provider
let geminiQuotaExhausted = false;
let groqQuotaExhausted = false;

function buildSummaryPrompt(title, sourceName, rssExcerpt, category) {
  return `You are a science writer for Upsilon Hub, a physics news aggregator. Write an AI summary of the following article for curious readers.

Article Title: "${title}"
Source: ${sourceName}
Category: ${category}
RSS Excerpt: "${rssExcerpt}"

Instructions:
- Write 3 to 5 paragraphs (around 200–280 words total)
- Start directly with the substance — no "This article..." or "According to..." openers
- Explain the core discovery or development clearly
- Give relevant context (why it matters, what came before, how it fits into the field)
- Highlight one or two genuinely fascinating or surprising aspects
- End with an open question or hint at what comes next — leaving the reader curious to read more
- Keep the tone engaging, clear, and accessible to an educated non-specialist
- Do NOT reproduce quotes, specific data, or detailed methodology — those are for the original article
- Return plain text only, no markdown, no bullet points`;
}

async function generateGeminiSummary(title, sourceName, rssExcerpt, category) {
  if (!geminiEnabled || !geminiModel || geminiQuotaExhausted) return null;
  if (newGeminiCallsThisRun >= MAX_NEW_GEMINI_CALLS_PER_RUN) return null;

  // space calls out to stay under 30 RPM
  const now = Date.now();
  const wait = GEMINI_DELAY_MS - (now - lastGeminiCall);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastGeminiCall = Date.now();

  const prompt = buildSummaryPrompt(title, sourceName, rssExcerpt, category);

  try {
    const result = await Promise.race([
      geminiModel.generateContent(prompt),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini timeout')), 15000))
    ]);
    newGeminiCallsThisRun++;
    const text = result.response.text().trim();
    return text.length > 50 ? text : null;
  } catch (err) {
    if (err.message?.includes('429')) {
      geminiQuotaExhausted = true;
      console.log(`\n   🚫 Gemini quota hit — switching to Groq fallback for remaining articles.`);
      return null;
    }
    console.log(`   ⚠️  Gemini error: ${err.message?.split('\n')[0]}`);
    return null;
  }
}

// Groq free tier: llama-3.3-70b-versatile, 14,400 req/day, 6,000 tokens/min
// We use it as a fallback when Gemini quota runs out or the per-run cap is hit.
async function generateGroqSummary(title, sourceName, rssExcerpt, category) {
  if (!groqEnabled || groqQuotaExhausted) return null;

  const prompt = buildSummaryPrompt(title, sourceName, rssExcerpt, category);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.7
      }),
      signal: AbortSignal.timeout(20000)
    });

    if (response.status === 429) {
      groqQuotaExhausted = true;
      console.log(`\n   🚫 Groq quota hit — falling back to RSS excerpts.`);
      return null;
    }

    if (!response.ok) {
      console.log(`   ⚠️  Groq error: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    return text && text.length > 50 ? text : null;
  } catch (err) {
    console.log(`   ⚠️  Groq error: ${err.message?.split('\n')[0]}`);
    return null;
  }
}

// tries Gemini first (up to the per-run cap), then Groq, then gives up
async function generateAiSummary(title, sourceName, rssExcerpt, category) {
  const geminiResult = await generateGeminiSummary(title, sourceName, rssExcerpt, category);
  if (geminiResult) return geminiResult;

  // only try Groq if Gemini was genuinely unavailable (quota/cap), not just an error
  const geminiUnavailable = !geminiEnabled || geminiQuotaExhausted || newGeminiCallsThisRun >= MAX_NEW_GEMINI_CALLS_PER_RUN;
  if (geminiUnavailable && groqEnabled) {
    return await generateGroqSummary(title, sourceName, rssExcerpt, category);
  }

  return null;
}


async function fetchNews() {
  console.log("🚀 Starting Upsilon Hub fetch (RSS excerpt mode — copyright safe)...\n");
  const startTime = Date.now();
  let allNews = [];
  let aiCount = 0;
  let cachedCount = 0;

  for (const source of SOURCES) {
    try {
      console.log(`📡 Contacting ${source.name}...`);
      
      const feed = await Promise.race([
        parser.parseURL(source.url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Feed timeout')), 15000))
      ]);

      const classified = [];
      for (const item of feed.items.slice(0, 20)) {
        let category = classifyArticle(item);
        if (!category) {
          if (source.name === "IEEE Spectrum" && isRoboticsValid(item)) category = "Robotics";
          else continue;
        }
        classified.push({ item, category });
      }

      if (classified.length === 0) {
        console.log(`   ✅ 0 articles added from ${source.name}`);
        continue;
      }

      // fire all OG image requests at once per source — serial would be >5s per article
      console.log(`   ↳ Fetching ${classified.length} OG images in parallel...`);
      const ogImages = await Promise.all(
        classified.map(({ item }) => getOgImage(item.link))
      );

      let sourceCount = 0;

      // AI calls stay serial so we can throttle them properly
      for (let i = 0; i < classified.length; i++) {
        const { item, category } = classified[i];
        const ogImage = ogImages[i];
        const image = ogImage || getFallbackImage(category);
        const isReal = !!ogImage;

        process.stdout.write(`   ↳ [${category}] ${item.title.substring(0, 38)}... `);

        const slug = generateSlug(item.title, item.link);
        const rssExcerpt = getRssExcerpt(item);
        const summary = item.contentSnippet 
          ? item.contentSnippet.substring(0, 160).trim() + "..."
          : rssExcerpt.substring(0, 160).trim() + "...";

        // reuse cached summaries — no API call needed if we've seen this URL before
        let aiSummary = summaryCache[item.link] || null;
        if (aiSummary) {
          process.stdout.write('(cached) ');
          cachedCount++;
        } else {
          aiSummary = await generateAiSummary(item.title, source.name, rssExcerpt, category);
          if (aiSummary) {
            summaryCache[item.link] = aiSummary;
          }
        }
        if (aiSummary) aiCount++;

        console.log(isReal ? `🖼️  ${aiSummary ? '🤖 AI' : ''}` : `🎲 ${aiSummary ? '🤖 AI' : ''}`);

        allNews.push({
          title: item.title,
          link: item.link,
          slug,
          pubDate: item.pubDate,
          category,
          sourceName: source.name,
          image,
          isReal,
          summary,
          excerpt: rssExcerpt,
          ...(aiSummary && { aiSummary }),
        });

        sourceCount++;
      }

      console.log(`   ✅ ${sourceCount} articles added from ${source.name}`);
    } catch (error) { 
      console.error(`   ❌ Error: ${error.message}`); 
    }
  }

  allNews.sort((a, b) => {
    if (a.isReal === b.isReal) return 0.5 - Math.random();
    return (b.isReal ? 1 : 0) - (a.isReal ? 1 : 0);
  });

  const realCount = allNews.filter(n => n.isReal).length;

  fs.writeFileSync(CACHE_PATH, JSON.stringify(summaryCache, null, 2));
  console.log(`💾 Summary cache saved (${Object.keys(summaryCache).length} total entries).`);

  const outputPath = path.resolve('./src/data/news.json');
  fs.writeFileSync(outputPath, JSON.stringify(allNews, null, 2));

  const totalSecs = Math.floor((Date.now() - startTime) / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  console.log(`\n🎉 DONE! ${allNews.length} articles saved in ${mins}m ${secs}s.`);
  console.log(`🖼️  OG Images: ${realCount} | 🤖 AI Summaries: ${aiCount} (${cachedCount} cached, ${newGeminiCallsThisRun} new Gemini)${geminiQuotaExhausted ? ' — Gemini quota hit' : ''}${groqQuotaExhausted ? ' — Groq quota hit' : ''}`);
  console.log(`✅ Copyright-safe: RSS excerpts only. No full article reproduction.`);
  
  process.exit(0); 
}

fetchNews();