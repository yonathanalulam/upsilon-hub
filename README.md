# Upsilon Hub

An automated intelligence platform tracking the frontier of modern physics, powered by AI.

## ⚡ The Mission

Keeping up with scientific breakthroughs is difficult. The signal-to-noise ratio in modern media is low, and important discoveries often get buried under clickbait.

[Upsilon Hub](https://upsilon-hub.vercel.app/) solves this by aggregating high-impact research news from the world's most respected institutions — like **CERN, NASA, MIT**, and leading physics journals — into one clean, real-time feed. Each article is accompanied by an AI-generated summary written for curious readers, with a direct link to the full original source for those who want to go deeper.

## 🤖 How It Works

- **Automated Retrieval** — A custom aggregation engine runs daily via GitHub Actions, pulling from 15 curated RSS feeds across physics and science media.
- **Smart Filtering** — Keyword-based algorithms filter out irrelevant content and classify articles into categories: Quantum Physics, Astrophysics, High Energy, Nanotech, Robotics, Optics, and more.
- **AI Summaries** — Each article is summarized by Google Gemini, producing a concise, accessible overview without reproducing copyrighted content. Readers can always follow the original source link for the full story.
- **Native Reader** — Articles open in a clean, distraction-free reader on the site itself, preserving the theme and typography of the rest of the hub.
- **Self-Deploying** — The system automatically rebuilds and deploys the live site on Vercel whenever fresh data is available.

## 🔒 Privacy & Copyright

Upsilon Hub only uses the excerpts that publishers voluntarily distribute via RSS feeds. No full article content is reproduced. AI summaries are original derivative works. No user data is collected or stored.

## 🛠️ Tech Stack

- [Astro](https://astro.build/) — Static site generation
- [Tailwind CSS](https://tailwindcss.com/) — Styling
- [Google Gemini](https://ai.google.dev/) — AI summarization
- [GitHub Actions](https://github.com/features/actions) — Daily automation
- [Vercel](https://vercel.com/) — Hosting & deployment
