import Parser from 'rss-parser';
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import axios from 'axios';

const parser = new Parser({ 
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  }
});

const SOURCES = [
  // --- QUANTUM ---
  { category: "Quantum Physics", name: "SciTechDaily", url: "https://scitechdaily.com/tag/quantum-physics/feed/" },
  { category: "Quantum Physics", name: "Phys.org", url: "https://phys.org/rss-feed/physics-news/quantum-physics/" },
  { category: "Quantum Physics", name: "Quanta Magazine", url: "https://api.quantamagazine.org/feed/" }, // High Quality Replacement

  // --- ASTROPHYSICS ---
  { category: "Astrophysics", name: "Space.com", url: "https://www.space.com/feeds/news" },
  { category: "Astrophysics", name: "Universe Today", url: "https://www.universetoday.com/feed/" },
  { category: "Astrophysics", name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/space_time/astrophysics.xml" },

  // --- HIGH ENERGY (Fixed Sources) ---
  { category: "High Energy", name: "Symmetry Mag", url: "https://www.symmetrymagazine.org/feed" }, // Excellent visuals, reliable
  { category: "High Energy", name: "Phys.org", url: "https://phys.org/rss-feed/physics-news/high-energy-particle-physics/" }, 
  { category: "High Energy", name: "SciTechDaily", url: "https://scitechdaily.com/tag/particle-physics/feed/" }, // Replaces broken MIT link

  // --- NANOTECH (Fixed Sources) ---
  { category: "Nanotech", name: "Phys.org", url: "https://phys.org/rss-feed/nanotech-news/" }, // Replaces broken Nano Mag
  { category: "Nanotech", name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/matter_energy/nanotechnology.xml" },

  // --- ROBOTICS ---
  { category: "Robotics", name: "IEEE Spectrum", url: "https://spectrum.ieee.org/feeds/topic/robotics" },
  { category: "Robotics", name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/computers_math/robotics.xml" },
];

const THEME_GALLERY = {
    "Quantum Physics": [
        "https://images.pexels.com/photos/256381/pexels-photo-256381.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/373543/pexels-photo-373543.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/1148820/pexels-photo-1148820.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/2034892/pexels-photo-2034892.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=800",
        "https://images.pexels.com/photos/17483848/pexels-photo-17483848.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/17485705/pexels-photo-17485705.jpeg?auto=compress&cs=tinysrgb&w=800"
    ],
    "Astrophysics": [
        "https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/2150/sky-space-dark-galaxy.jpg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/39561/solar-flare-sun-eruption-energy-39561.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/110854/pexels-photo-110854.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/73873/star-clusters-rosette-nebula-star-73873.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/87009/earth-soil-creep-moon-lunar-surface-87009.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/586030/pexels-photo-586030.jpeg?auto=compress&cs=tinysrgb&w=800"
    ],
    "Nanotech": [
        "https://images.pexels.com/photos/256262/pexels-photo-256262.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/356043/pexels-photo-356043.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/3735707/pexels-photo-3735707.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/3825527/pexels-photo-3825527.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/8438993/pexels-photo-8438993.jpeg?auto=compress&cs=tinysrgb&w=800"
    ],
    "High Energy": [
        "https://images.pexels.com/photos/60022/pexels-photo-60022.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/256302/pexels-photo-256302.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=800"
    ],
    "Robotics": [
        "https://images.pexels.com/photos/8386434/pexels-photo-8386434.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/2599244/pexels-photo-2599244.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/1036622/pexels-photo-1036622.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=800", 
        "https://images.pexels.com/photos/11035471/pexels-photo-11035471.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
};

function isRoboticsValid(item) {
  const text = (item.title + " " + item.contentSnippet).toLowerCase();
  const forbidden = ["chatbot", "chatgpt", "generative ai", "llm", "large language model", "stock market", "virtual reality", "software update"];
  const required = ["robot", "drone", "machine", "actuator", "sensor", "autonomous vehicle", "rover", "mechanic", "bot", "bionic", "hardware"];
  
  if (forbidden.some(word => text.includes(word))) return false;
  if (!required.some(word => text.includes(word))) return false;
  return true;
}

function getRandomFallback(category) {
    const gallery = THEME_GALLERY[category] || THEME_GALLERY["Quantum Physics"];
    return gallery[Math.floor(Math.random() * gallery.length)];
}

async function getOgImage(url) {
  try {
    const { data } = await axios.get(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 3000
    });
    const $ = cheerio.load(data);
    return $('meta[property="og:image"]').attr('content') || null;
  } catch (error) { return null; }
}

async function fetchNews() {
  console.log("🚀 Starting Prioritized Fetch...");
  let allNews = [];

  for (const source of SOURCES) {
    try {
      console.log(`\n📡 Contacting ${source.name} [${source.category}]...`);
      const feed = await parser.parseURL(source.url);
      const items = feed.items.slice(0, 10); 

      for (const item of items) {
        if (source.category === "Robotics" && !isRoboticsValid(item)) continue; 
        process.stdout.write(`   ↳ ${item.title.substring(0, 30)}... `);
        
        // 1. TRY SCRAPE
        let image = await getOgImage(item.link);
        let isReal = false;
        
        // 2. FALLBACK
        if (!image) {
            image = getRandomFallback(source.category); 
            console.log("🎲 (Fallback)");
        } else {
            isReal = true;
            console.log("✅ (Scraped)");
        }

        allNews.push({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          category: source.category,
          sourceName: source.name,
          image: image,
          isReal: isReal, 
          summary: item.contentSnippet ? item.contentSnippet.substring(0, 140) + "..." : ""
        });
      }
    } catch (error) { console.error(`❌ Error: ${error.message}`); }
  }

 
  allNews.sort((a, b) => {
    if (a.isReal === b.isReal) return 0.5 - Math.random(); 
    return b.isReal - a.isReal; 
  });

  const outputPath = path.resolve('./src/data/news.json');
  fs.writeFileSync(outputPath, JSON.stringify(allNews, null, 2));
  console.log(`\n🎉 DONE! Saved ${allNews.length} articles (Real images prioritized).`);
}

fetchNews();