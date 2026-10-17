/** Compact UA parser — bot filter + device/browser/os buckets, no dependency. */

const BOT_UA =
  /bot|crawler|spider|crawling|headlesschrome|phantomjs|selenium|webdriver|puppeteer|playwright|python-requests|curl|wget|java\/|go-http-client|node\.js|axios|postman|scrapy|httpx|okhttp|monitor|uptime|pingdom|lighthouse|pagespeed/i;

export interface ParsedUA {
  device: string; // desktop | mobile | tablet | bot | other
  browser: string;
  os: string;
  isBot: boolean;
}

function pick(ua: string, re: RegExp, name: string, versionGroup = 1): string {
  const m = re.exec(ua);
  return m ? `${name} ${m[versionGroup]?.replace(/_/g, ".").split(".")[0] ?? ""}`.trim() : "";
}

export function parseUA(ua: string | null | undefined): ParsedUA {
  if (!ua || ua.length < 5) {
    return { device: "other", browser: "Unknown", os: "Unknown", isBot: true };
  }
  const isBot = BOT_UA.test(ua);

  const browser =
    pick(ua, /Edg(?:e|A|iOS)?\/(\d+)/i, "Edge") ||
    pick(ua, /OPR\/(\d+)/i, "Opera") ||
    pick(ua, /SamsungBrowser\/(\d+)/i, "Samsung Internet") ||
    pick(ua, /(?:Chrome|CriOS)\/(\d+)/i, "Chrome") ||
    pick(ua, /Firefox\/(\d+)/i, "Firefox") ||
    pick(ua, /Version\/(\d+)[^)]*Safari\//i, "Safari") ||
    pick(ua, /MSIE (\d+)/i, "IE") ||
    pick(ua, /Trident.*rv:(\d+)/i, "IE") ||
    "Unknown";

  const os =
    pick(ua, /Windows NT ([\d.]+)/i, "Windows") ||
    pick(ua, /Mac OS X ([\d_]+)/i, "macOS") ||
    pick(ua, /Android ([\d.]+)/i, "Android") ||
    pick(ua, /iPhone OS ([\d_]+)/i, "iOS") ||
    pick(ua, /CPU OS ([\d_]+)/i, "iPadOS") ||
    pick(ua, /CrOS [^\s]+ ([\d.]+)/i, "ChromeOS") ||
    (/Linux/i.test(ua) ? "Linux" : "") ||
    "Unknown";

  let device: string;
  if (isBot) device = "bot";
  else if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)))
    device = "tablet";
  else if (/Mobile|iPhone|Android|Phone|Opera Mini|IEMobile/i.test(ua)) device = "mobile";
  else device = "desktop";

  return { device, browser, os, isBot };
}
