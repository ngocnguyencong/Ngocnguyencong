/** Source/medium → channel classification (denormalized at ingest). */

export interface SourceClass {
  channel: string;
  source: string;
  medium: string;
}

const AI_HOSTS =
  /chatgpt|openai|claude\.ai|perplexity|gemini|copilot\.microsoft|you\.com|phind|deepseek|mistral|meta\.ai|qwen|kimi|grok/i;
const SEARCH_HOSTS =
  /google|bing|yahoo|duckduckgo|baidu|yandex|ecosia|brave|qwant|startpage|aol|ask\.com|naver/i;
const SOCIAL_HOSTS =
  /twitter|x\.com|facebook|instagram|linkedin|reddit|tiktok|pinterest|youtube|youtu\.be|snapchat|threads|mastodon|bluesky|bsky|discord|telegram|whatsapp|quora|medium|substack|producthunt|hackernews|news\.ycombinator|dev\.to|github|gitlab|tumblr|vk\.com|weibo/i;
const VIDEO_HOSTS = /youtube|youtu\.be|vimeo|twitch|tiktok/i;
const SHOPPING_HOSTS = /amazon|ebay|etsy|aliexpress|shopify|walmart/i;
const PAID_MEDIUMS =
  /^(cpc|ppc|paid|paidsocial|paid_social|paidsearch|paid_search|display|banner|cpm|retargeting)$/i;
const EMAIL_MEDIUMS = /^(email|e-mail|newsletter|edm|mail)$/i;

function hostOf(ref: string | null | undefined): string {
  if (!ref) return "";
  try {
    return new URL(ref).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sourceName(host: string): string {
  const names: [RegExp, string][] = [
    [/google/, "Google"],
    [/bing/, "Bing"],
    [/duckduckgo/, "DuckDuckGo"],
    [/yahoo/, "Yahoo"],
    [/baidu/, "Baidu"],
    [/yandex/, "Yandex"],
    [/ecosia/, "Ecosia"],
    [/brave/, "Brave"],
    [/x\.com|twitter/, "X / Twitter"],
    [/facebook/, "Facebook"],
    [/instagram/, "Instagram"],
    [/linkedin/, "LinkedIn"],
    [/reddit/, "Reddit"],
    [/tiktok/, "TikTok"],
    [/youtube|youtu\.be/, "YouTube"],
    [/pinterest/, "Pinterest"],
    [/threads/, "Threads"],
    [/bsky|bluesky/, "Bluesky"],
    [/discord/, "Discord"],
    [/telegram/, "Telegram"],
    [/whatsapp/, "WhatsApp"],
    [/quora/, "Quora"],
    [/medium/, "Medium"],
    [/substack/, "Substack"],
    [/producthunt/, "Product Hunt"],
    [/news\.ycombinator|hackernews/, "Hacker News"],
    [/github/, "GitHub"],
    [/chatgpt|openai/, "ChatGPT"],
    [/claude/, "Claude"],
    [/perplexity/, "Perplexity"],
    [/gemini|copilot/, "Gemini"],
    [/amazon/, "Amazon"],
  ];
  for (const [re, name] of names) if (re.test(host)) return name;
  return host || "(direct)";
}

/**
 * Classify a visit source.
 *   utmSource/utmMedium explicit → paid/email/social/search/ai/affiliate by medium
 *   click id (gclid etc.) → paid_search/paid_social
 *   referrer host → ai | organic_search | social | video | shopping | referral
 *   none → direct
 */
export function classifySource(input: {
  referrer: string | null | undefined;
  utmSource: string | null | undefined;
  utmMedium: string | null | undefined;
  clickId: string | null | undefined;
  hostname: string;
}): SourceClass {
  const refHost = hostOf(input.referrer);
  const own = input.hostname.toLowerCase().replace(/^www\./, "");
  const externalRef = refHost && refHost !== own && !refHost.endsWith("." + own) ? refHost : "";

  const source = input.utmSource || (externalRef ? sourceName(externalRef) : "(direct)");
  const medium = input.utmMedium || (externalRef ? "referral" : "(none)");

  let channel = "direct";
  if (input.utmMedium) {
    const m = input.utmMedium;
    if (PAID_MEDIUMS.test(m)) channel = SEARCH_HOSTS.test(source) ? "paid_search" : "paid_social";
    else if (EMAIL_MEDIUMS.test(m)) channel = "email";
    else if (/^(social|social_media|sm)$/i.test(m)) channel = "social";
    else if (/^(organic|search|seo)$/i.test(m)) channel = "organic_search";
    else if (/^(ai|llm|chatbot)$/i.test(m)) channel = "ai";
    else if (/^(affiliate|partner|referral)$/i.test(m)) channel = "referral";
    else if (/^(community|forum)$/i.test(m)) channel = "social";
    else channel = "campaign";
  }
  if (channel === "direct" && input.clickId) {
    channel = /gclid|gclsrc|wbraid|gbraid|msclkid/i.test(input.clickId)
      ? "paid_search"
      : "paid_social";
  }
  if (channel === "direct" && externalRef) {
    if (AI_HOSTS.test(externalRef)) channel = "ai";
    else if (VIDEO_HOSTS.test(externalRef)) channel = "video";
    else if (SEARCH_HOSTS.test(externalRef)) channel = "organic_search";
    else if (SOCIAL_HOSTS.test(externalRef)) channel = "social";
    else if (SHOPPING_HOSTS.test(externalRef)) channel = "shopping";
    else channel = "referral";
  }

  return { channel, source, medium };
}
