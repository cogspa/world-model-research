/**
 * World Model Research News Aggregator
 * Netlify Function: /.netlify/functions/world-model-news
 *
 * No API key and no extra npm package required. It combines Google News RSS
 * discovery feeds, arXiv results, and a small curated primary-source fallback.
 */

const DAY = 24 * 60 * 60 * 1000;
const MAX_AGE_DAYS = 550;
const CACHE_SECONDS = 60 * 60 * 3;

const TOPICS = [
  {
    id: 'world-models',
    label: 'World Models',
    query: '"world models" AI OR "world model" AI when:180d',
  },
  {
    id: 'lecun-jepa',
    label: 'Yann LeCun / AMI / JEPA',
    query: '("Yann LeCun" OR "AMI Labs" OR JEPA) "world model" when:365d',
  },
  {
    id: 'world-labs',
    label: 'World Labs / Marble',
    query: '("World Labs" OR Marble) ("world model" OR "spatial intelligence") when:365d',
  },
  {
    id: 'omniverse',
    label: 'NVIDIA Omniverse',
    query: '("NVIDIA Omniverse" OR "NVIDIA Cosmos") (OpenUSD OR "physical AI" OR simulation) when:365d',
  },
  {
    id: 'openusd',
    label: 'OpenUSD / AOUSD',
    query: '(OpenUSD OR AOUSD OR "Alliance for OpenUSD") (3D OR world OR standard) when:365d',
  },
  {
    id: 'world-building',
    label: 'World Building / Spatial Intelligence',
    query: '("spatial intelligence" OR "world building") ("3D world" OR generative OR AI) when:365d',
  },
];

const PRIMARY_DOMAINS = [
  'worldlabs.ai', 'amilabs.xyz', 'nvidia.com', 'aousd.org',
  'arxiv.org', 'openreview.net', 'pixar.com', 'openusd.org',
];
const TRUSTED_REPORTING_DOMAINS = [
  'reuters.com', 'apnews.com', 'wired.com', 'technologyreview.com',
  'nature.com', 'techcrunch.com', 'theverge.com', 'venturebeat.com',
];
const HIGH_SIGNAL_TERMS = [
  'world model', 'world models', 'jepa', 'marble', 'spatial intelligence',
  'openusd', 'omniverse', 'physical ai', 'simulation', 'digital twin',
];

const CURATED_SEED_ITEMS = [
  {
    title: 'Streaming 3DGS Worlds on the Web',
    description: 'World Labs explains Spark 2.0, a web renderer for streaming huge Gaussian-splat worlds generated and composed through Marble workflows.',
    url: 'https://www.worldlabs.ai/blog/spark-2.0',
    source: 'World Labs',
    domain: 'worldlabs.ai',
    publishedAt: '2026-04-14T00:00:00.000Z',
    topic: 'world-building',
    topicLabel: 'World Building / Spatial Intelligence',
    type: 'Primary source',
  },
  {
    title: 'LeWorldModel: Stable End-to-End Joint-Embedding Predictive Architecture from Pixels',
    description: 'A JEPA world-model paper with Yann LeCun among the authors, proposing stable end-to-end training from pixels and efficient planning.',
    url: 'https://arxiv.org/abs/2603.19312',
    source: 'arXiv',
    domain: 'arxiv.org',
    publishedAt: '2026-03-13T00:00:00.000Z',
    topic: 'lecun-jepa',
    topicLabel: 'Yann LeCun / AMI / JEPA',
    type: 'Primary source',
  },
  {
    title: 'Announcing the World API',
    description: 'World Labs launches an API for generating explorable 3D worlds using its multimodal world model, Marble.',
    url: 'https://www.worldlabs.ai/blog/announcing-the-world-api',
    source: 'World Labs',
    domain: 'worldlabs.ai',
    publishedAt: '2026-01-21T00:00:00.000Z',
    topic: 'world-labs',
    topicLabel: 'World Labs / Marble',
    type: 'Primary source',
  },
  {
    title: 'Marble: A Multimodal World Model',
    description: 'World Labs introduces Marble for creating, editing, expanding and exporting persistent 3D worlds.',
    url: 'https://www.worldlabs.ai/blog/marble-world-model',
    source: 'World Labs',
    domain: 'worldlabs.ai',
    publishedAt: '2025-11-12T00:00:00.000Z',
    topic: 'world-labs',
    topicLabel: 'World Labs / Marble',
    type: 'Primary source',
  },
  {
    title: 'OpenUSD v26.05: Key Features and Improvements',
    description: 'AOUSD publishes a production-focused release addressing build support, USD composition performance, validation and particle-field workflows.',
    url: 'https://aousd.org/blog/announcing-openusd-v26-05-key-features-and-improvements/',
    source: 'Alliance for OpenUSD',
    domain: 'aousd.org',
    publishedAt: '2026-05-22T00:00:00.000Z',
    topic: 'openusd',
    topicLabel: 'OpenUSD / AOUSD',
    type: 'Primary source',
  },
  {
    title: 'Yann LeCun’s AMI Raises $1.03 Billion for World-Model AI',
    description: 'Reuters reports that Advanced Machine Intelligence raised $1.03 billion to develop systems focused on reasoning, planning and modeling the real world.',
    url: 'https://www.reuters.com/business/ex-meta-ai-chief-yann-lecuns-ami-raises-103-billion-alternative-ai-approach-2026-03-10/',
    source: 'Reuters',
    domain: 'reuters.com',
    publishedAt: '2026-03-10T00:00:00.000Z',
    topic: 'lecun-jepa',
    topicLabel: 'Yann LeCun / AMI / JEPA',
    type: 'Trusted reporting',
  },
  {
    title: 'How OpenUSD and Digital Twins Are Powering Industrial and Physical AI',
    description: 'NVIDIA describes new Omniverse libraries, Cosmos world foundation models and OpenUSD-based digital-twin workflows for physical AI.',
    url: 'https://blogs.nvidia.com/blog/openusd-digital-twins-industrial-physical-ai/',
    source: 'NVIDIA Blog',
    domain: 'nvidia.com',
    publishedAt: '2025-08-20T00:00:00.000Z',
    topic: 'omniverse',
    topicLabel: 'NVIDIA Omniverse',
    type: 'Primary source',
  },
];

function decodeXml(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]*>/g, '')
    .trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? decodeXml(m[1]) : '';
}

function attr(block, tagName, attrName) {
  const m = block.match(new RegExp(`<${tagName}[^>]*${attrName}="([^"]+)"[^>]*>`, 'i'));
  return m ? decodeXml(m[1]) : '';
}

function domainFromUrl(url = '') {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
}

function dateIso(value) {
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? null : d.toISOString();
}

function sourceType(domain) {
  if (PRIMARY_DOMAINS.some((d) => domain.endsWith(d))) return 'Primary source';
  if (TRUSTED_REPORTING_DOMAINS.some((d) => domain.endsWith(d))) return 'Trusted reporting';
  return 'Coverage';
}

function relevanceScore(item) {
  const combined = `${item.title} ${item.description}`.toLowerCase();
  const signal = HIGH_SIGNAL_TERMS.reduce((n, term) => n + (combined.includes(term) ? 1 : 0), 0);
  const freshnessDays = Math.max(0, (Date.now() - new Date(item.publishedAt).valueOf()) / DAY);
  const freshness = Math.max(0, 20 - Math.floor(freshnessDays / 21));
  const authority = item.type === 'Primary source' ? 35 : item.type === 'Trusted reporting' ? 22 : 7;
  return authority + freshness + signal * 8;
}

function cleanGoogleNewsUrl(url) {
  return url;
}

function parseRss(xml, topic) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return blocks.map((block) => {
    const url = cleanGoogleNewsUrl(tag(block, 'link'));
    const rawSource = tag(block, 'source');
    const domain = attr(block, 'source', 'url') ? domainFromUrl(attr(block, 'source', 'url')) : domainFromUrl(url);
    const publishedAt = dateIso(tag(block, 'pubDate'));
    const item = {
      title: tag(block, 'title').replace(/\s+-\s+[^-]+$/, ''),
      description: tag(block, 'description'),
      url,
      source: rawSource || domain || 'News source',
      domain,
      publishedAt,
      topic: topic.id,
      topicLabel: topic.label,
      type: sourceType(domain),
    };
    return { ...item, score: relevanceScore(item) };
  }).filter((item) => item.title && item.url && item.publishedAt);
}

function parseAtom(xml, topic) {
  const blocks = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
  return blocks.map((block) => {
    const url = attr(block, 'link', 'href');
    const publishedAt = dateIso(tag(block, 'published') || tag(block, 'updated'));
    const item = {
      title: tag(block, 'title').replace(/\s+/g, ' '),
      description: tag(block, 'summary').replace(/\s+/g, ' '),
      url,
      source: 'arXiv',
      domain: 'arxiv.org',
      publishedAt,
      topic: topic.id,
      topicLabel: topic.label,
      type: 'Primary source',
    };
    return { ...item, score: relevanceScore(item) };
  }).filter((item) => item.title && item.url && item.publishedAt);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'WorldModelResearchNews/1.0 (research news reader)' },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function fetchTopic(topic) {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(topic.query)}&hl=en-US&gl=US&ceid=US:en`;
  try { return parseRss(await fetchText(rssUrl), topic); }
  catch { return []; }
}

async function fetchResearch() {
  const topic = { id: 'lecun-jepa', label: 'Yann LeCun / AMI / JEPA' };
  const search = '(all:"world model" AND (all:JEPA OR au:LeCun))';
  const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(search)}&start=0&max_results=10&sortBy=submittedDate&sortOrder=descending`;
  try { return parseAtom(await fetchText(url), topic); }
  catch { return []; }
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.url.replace(/[?#].*$/, '').toLowerCase() || item.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default async () => {
  const discovered = (await Promise.all(TOPICS.map(fetchTopic))).flat();
  const research = await fetchResearch();
  const curated = CURATED_SEED_ITEMS.map((item) => ({ ...item, score: relevanceScore(item) }));
  const cutoff = Date.now() - MAX_AGE_DAYS * DAY;
  const items = dedupe([...curated, ...research, ...discovered])
    .filter((item) => new Date(item.publishedAt).valueOf() >= cutoff)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt) || b.score - a.score)
    .slice(0, 80);

  return new Response(JSON.stringify({
    generatedAt: new Date().toISOString(),
    topics: TOPICS.map(({ id, label }) => ({ id, label })),
    items,
    note: 'Primary-source items are prioritized. Coverage items are discovered through current RSS search feeds and should be editorially reviewed before featuring.',
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=0, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400`,
      'Access-Control-Allow-Origin': '*',
    },
  });
};
