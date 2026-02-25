import Parser from 'rss-parser';
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
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

  if (EXCLUDED_TERMS.some(badWord => text.includes(badWord))) {
    return null;
  }

  for (const topic of TOPIC_KEYWORDS) {
    if (topic.terms.some(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'i');
      return regex.test(text);
    })) {
      return topic.id;
    }
  }

  return null;
}

function isRoboticsValid(item) {
  const text = (item.title + " " + item.contentSnippet).toLowerCase();
  const forbidden = ["chatbot", "chatgpt", "generative ai", "llm", "large language model", "stock market"];
  const required = ["robot", "drone", "machine", "actuator", "sensor", "autonomous", "rover"];

  if (forbidden.some(word => text.includes(word))) return false;
  return required.some(word => text.includes(word));
}

function getFallbackImage(category) {
  const gallery = THEME_GALLERY[category] || THEME_GALLERY["Universal"];
  return gallery[Math.floor(Math.random() * gallery.length)];
}

async function getOgImage(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(4000)
    });
    
    if (!response.ok) return null;
    
    const data = await response.text();
    const $ = cheerio.load(data);
    return $('meta[property="og:image"]').attr('content') || null;
  } catch (error) { 
    return null; 
  }
}

async function fetchNews() {
  console.log("🚀 Starting Massive Physics Fetch...");
  let allNews = [];

  for (const source of SOURCES) {
    try {
      console.log(`\n📡 Contacting ${source.name}...`);
      
      const feed = await Promise.race([
        parser.parseURL(source.url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Feed timeout')), 15000))
      ]);

      const items = feed.items.slice(0, 15);

      for (const item of items) {
        let category = classifyArticle(item);

        if (!category) {
           if (source.name === "IEEE Spectrum" && isRoboticsValid(item)) {
               category = "Robotics";
           } else {
               continue;
           }
        }

        process.stdout.write(`   ↳ [${category}] ${item.title.substring(0, 30)}... `);

        let image = await getOgImage(item.link);
        let isReal = false;

        if (!image) {
          image = getFallbackImage(category);
          console.log("🎲 (Fallback)");
        } else {
          isReal = true;
          console.log("✅ (Scraped)");
        }

        allNews.push({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          category: category,
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
    return (b.isReal ? 1 : 0) - (a.isReal ? 1 : 0);
  });

  const realCount = allNews.filter(n => n.isReal).length;
  const fallbackCount = allNews.filter(n => !n.isReal).length;

  const outputPath = path.resolve('./src/data/news.json');
  fs.writeFileSync(outputPath, JSON.stringify(allNews, null, 2));

  console.log(`\n🎉 DONE! Processed ${allNews.length} articles.`);
  console.log(`📸 Scraped Images: ${realCount} | 🎲 Fallback Images: ${fallbackCount}`);
  console.log(`✨ Trash & "General Physics" have been filtered out.`);
  
  process.exit(0); 
}

fetchNews();