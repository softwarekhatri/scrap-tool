// src/scraper.js
const cheerio = require('cheerio');
const { URL } = require('url');
const puppeteer = require('puppeteer');
const https = require('https');
const http = require('http');

/**
 * @typedef {object} ExtractedData
 * @property {string} [title]
 * @property {string} [description]
 * @property {string} [author]
 * @property {string} [datePublished]
 * @property {string} [dateModified]
 * @property {object} [image]
 * @property {string} [articleSection]
 * @property {string} [articleBody]
 * @property {Array<object>} [breadcrumbs]
 * @property {Array<object>} [faqs]
 * @property {string} [publisherName]
 * @property {string} [publisherLogo]
 * @property {string} [authorUrl]
 */

class WebScraper {
    // Shared Puppeteer browser instance
    static browser = null;

    /**
     * Get or launch a shared Puppeteer browser instance (non-headless, stays open)
     * @returns {Promise<import('puppeteer').Browser>}
     */
    static async getBrowser() {
        if (WebScraper.browser && WebScraper.browser.isConnected()) {
            return WebScraper.browser;
        }
        // Use headless mode for background operation
        WebScraper.browser = await puppeteer.launch({ headless: 'new' });
        return WebScraper.browser;
    }

    /**
     * Fetch static HTML using Node.js http/https
     * @param {string} url
     * @returns {Promise<string>} HTML string
     */
    static fetchStaticHtml(url) {
        return new Promise((resolve, reject) => {
            const lib = url.startsWith('https') ? https : http;
            lib.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
    }
    /**
     * Scrapes a given URL and extracts metadata.
     * @param {string} url The URL to scrape.
     * @returns {Promise<ExtractedData>} The extracted data.
     */
    /**
     * Scrape a URL for a specific type: 'article', 'breadcrumbs', or 'faq'.
     * @param {string} url
     * @param {'article'|'breadcrumbs'|'faq'} type
     * @returns {Promise<ExtractedData>}
     */
    async scrapeUrl(url, type = 'article') {
        try {
            let html, $;
            if (type === 'faq') {
                // Use Puppeteer for dynamic FAQ extraction
                const browser = await WebScraper.getBrowser();
                const page = await browser.newPage();
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
                // Scroll to bottom to trigger lazy loading (if any)
                await page.evaluate(async () => {
                    await new Promise((resolve) => {
                        let totalHeight = 0;
                        const distance = 500;
                        const timer = setInterval(() => {
                            const scrollHeight = document.body.scrollHeight;
                            window.scrollBy(0, distance);
                            totalHeight += distance;
                            if (totalHeight >= scrollHeight) {
                                clearInterval(timer);
                                resolve();
                            }
                        }, 200);
                    });
                });
                // Try to click FAQ tab/button if present
                await page.evaluate(() => {
                    const faqSelectors = [
                        'a', 'button', '[role="tab"]', '.tab', '.menu-item', '.nav-item', '.accordion-title', '.accordion-header'
                    ];
                    const faqTexts = ['faq', 'frequently asked questions', 'faqs'];
                    let found = false;
                    for (const selector of faqSelectors) {
                        const elements = Array.from(document.querySelectorAll(selector));
                        for (const el of elements) {
                            const text = (el.textContent || '').toLowerCase();
                            if (faqTexts.some(faq => text.includes(faq))) {
                                el.click();
                                found = true;
                                break;
                            }
                        }
                        if (found) break;
                    }
                });
                // Wait for FAQ section if present (try common selectors)
                try {
                    await page.waitForSelector('.faq-content, [itemtype="https://schema.org/FAQPage"], h3', { timeout: 8000 });
                } catch (e) {
                    // Continue even if FAQ selector not found
                }
                html = await page.content();
                await page.close();
            } else {
                // Use static fetch for article and breadcrumbs
                html = await WebScraper.fetchStaticHtml(url);
            }
            $ = cheerio.load(html);
            const extractedData = this.extractMetadata($, url);
            return extractedData;
        } catch (error) {
            console.error(`Error in scrapeUrl for ${url}:`, error);
            throw new Error(`Failed to scrape URL: ${error.message}`);
        }
    }

    /**
     * Extracts metadata from the page using Cheerio.
     * @param {cheerio.CheerioAPI} $ Cheerio instance.
     * @param {string} url The original URL.
     * @returns {ExtractedData} The extracted data.
     */
    extractMetadata($, url) {
        const title = this.extractTitle($);
        const description = this.extractDescription($);
        const author = this.extractAuthor($);
        // Corrected function call to ensure a safe object is returned
        const { datePublished, dateModified } = this.extractDates($);
        const image = this.extractImage($, url);
        const articleSection = this.extractArticleSection($);
        const articleBody = this.extractArticleBody($);
        const breadcrumbs = this.extractBreadcrumbs($, url);
        const faqs = this.extractFaqs($);
        const { publisherName, publisherLogo } = this.extractPublisher($);
        const authorUrl = this.extractAuthorUrl($, url);

        return {
            title,
            description,
            author,
            datePublished,
            dateModified,
            image,
            articleSection,
            articleBody,
            breadcrumbs,
            faqs,
            publisherName,
            publisherLogo,
            authorUrl,
        };
    }

    // All other extraction functions remain the same...

    /**
     * Extracts FAQ data using multiple methods.
     * @param {cheerio.CheerioAPI} $ Cheerio instance.
     * @returns {Array<object>} An array of FAQ objects.
     */
    extractFaqs($) {
        const faqs = [];
        try {
            // Method 1: Find schema.org microdata (if any)
            $('[itemtype="https://schema.org/FAQPage"]').each((_, element) => {
                $(element).find('[itemprop="mainEntity"]').each((_, questionItem) => {
                    const question = $(questionItem).find('[itemprop="name"]').text().trim();
                    const answer = $(questionItem).find('[itemprop="acceptedAnswer"] [itemprop="text"]').text().trim();
                    if (question && answer) {
                        faqs.push({ question, answer });
                    }
                });
            });

            // Method 2: Find FAQs in JSON-LD structured data
            $('script[type="application/ld+json"]').each((_, element) => {
                try {
                    const data = JSON.parse($(element).html() || '');
                    if (data['@type'] === 'FAQPage' && data.mainEntity) {
                        data.mainEntity.forEach((item) => {
                            if (item['@type'] === 'Question' && item.name && item.acceptedAnswer) {
                                const question = item.name;
                                const answer = item.acceptedAnswer.text || item.acceptedAnswer.name || '';
                                if (question && answer) {
                                    faqs.push({ question, answer });
                                }
                            }
                        });
                    }
                } catch (e) {
                    // Ignore JSON parsing errors
                }
            });

            // Method 3: Look for .faq-content h3 + div (DesignCafe pattern)
            if (faqs.length === 0) {
                $('.faq-content h3').each((_, element) => {
                    const question = $(element).text().trim();
                    // The answer is in the next sibling div
                    let answer = '';
                    let next = $(element).next();
                    // Sometimes there may be whitespace or comments between h3 and div
                    while (next.length && next[0].type === 'text' && !next.text().trim()) {
                        next = next.next();
                    }
                    if (next.length && next.is('div')) {
                        answer = next.text().trim();
                    }
                    if (question && answer) {
                        faqs.push({ question, answer });
                    }
                });
            }

            // Method 4: Fallback to searching for common HTML structures (e.g., h3 + p, h4 + div)
            if (faqs.length === 0) {
                $('h3').each((_, element) => {
                    const nextEl = $(element).next();
                    if (nextEl.length && nextEl.is('p, div')) {
                        const question = $(element).text().trim();
                        const answer = nextEl.text().trim();
                        if (question && answer) {
                            faqs.push({ question, answer });
                        }
                    }
                });
            }

            // Method 5: Fallback for .faq-content .faq-item (if present)
            if (faqs.length === 0) {
                $('.faq-content .faq-item').each((_, element) => {
                    const question = $(element).find('h3, h4, .faq-question').first().text().trim();
                    const answer = $(element).find('div, p, .faq-answer').not('h3, h4, .faq-question').first().text().trim();
                    if (question && answer) {
                        faqs.push({ question, answer });
                    }
                });
            }

            // Clean up and deduplicate FAQs
            const uniqueFaqs = faqs.filter((faq, index, self) =>
                index === self.findIndex(f => f.question.toLowerCase() === faq.question.toLowerCase())
            );

            return uniqueFaqs.slice(0, 20); // Limit to 20 FAQs
        } catch (e) {
            console.error("Error in extractFaqs:", e);
            return []; // Return an empty array on error to prevent a crash
        }
    }

    // The rest of the functions are unchanged.
    extractTitle($) {
        return $('title').text().trim() || $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || null;
    }

    extractDescription($) {
        return $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || null;
    }

    extractAuthor($) {
        return $('meta[name="author"]').attr('content') || $('meta[property="article:author"]').attr('content') || $('[itemprop="author"] [itemprop="name"]').text().trim() || null;
    }

    /**
     * Extracts and formats date information.
     * @param {cheerio.CheerioAPI} $ Cheerio instance.
     * @returns {{datePublished: string|null, dateModified: string|null}}
     */
    extractDates($) {
        let datePublished = null;
        let dateModified = null;
        const dateElements = $('meta[property^="article:published_time"], meta[property^="article:modified_time"], time[itemprop^="datePublished"], time[itemprop^="dateModified"]');

        dateElements.each((i, el) => {
            const prop = $(el).attr('property') || $(el).attr('itemprop');
            const content = $(el).attr('content') || $(el).attr('datetime');
            if (prop && content) {
                if (prop.includes('published_time') || prop.includes('datePublished')) {
                    datePublished = this.formatDate(content);
                }
                if (prop.includes('modified_time') || prop.includes('dateModified')) {
                    dateModified = this.formatDate(content);
                }
            }
        });

        return {
            datePublished,
            dateModified
        };
    }

    extractImage($, baseUrl) {
        const ogImage = $('meta[property="og:image"]').attr('content');
        if (ogImage) {
            return {
                url: this.makeAbsoluteUrl(ogImage, baseUrl),
                width: $('meta[property="og:image:width"]').attr('content') || null,
                height: $('meta[property="og:image:height"]').attr('content') || null
            };
        }
        const regularImage = $('img').first().attr('src');
        if (regularImage) {
            return { url: this.makeAbsoluteUrl(regularImage, baseUrl) };
        }
        return null;
    }

    extractArticleSection($) {
        return $('meta[property="article:section"]').attr('content') || null;
    }

    extractArticleBody($) {
        const contentSelectors = [
            'article p',
            '.post-content p',
            '.entry-content p',
            '.article-content p',
            '.content p',
            'main p'
        ];

        let fullText = '';

        // Try to extract all paragraphs from the main content area
        for (const selector of contentSelectors) {
            const paragraphs = $(selector);
            if (paragraphs.length > 5) { // Ensure we have substantial content
                let combinedText = '';
                paragraphs.each((index, elem) => {
                    const text = $(elem).text().trim();
                    if (text.length > 20) { // Filter out very short paragraphs
                        combinedText += text + ' ';
                    }
                });

                if (combinedText.length > fullText.length) {
                    fullText = combinedText;
                }
            }
        }

        // If paragraph extraction didn't work well, fall back to container extraction
        if (fullText.length < 500) {
            const containerSelectors = [
                '[property="articleBody"]',
                '.article-body',
                '.post-body',
                '.entry-body',
                '.article-content',
                '.post-content',
                '.entry-content',
                '.content-area',
                '.main-content',
                'article',
                '.content',
                'main'
            ];

            for (const selector of containerSelectors) {
                const element = $(selector).first();
                if (element.length) {
                    const contentElement = element.clone();

                    // Remove unwanted elements
                    contentElement.find('script, style, nav, header, footer, .navigation, .breadcrumb, .social-share, .comments, .sidebar, .related-posts, .author-box, .tags, .categories, .meta, .advertisement, .ads, .social-media, .share-buttons').remove();

                    const content = contentElement.text().trim();
                    const cleanContent = content.replace(/\s+/g, ' ').trim();

                    if (cleanContent.length > fullText.length && cleanContent.length > 200) {
                        fullText = cleanContent;
                    }
                }
            }
        }

        if (fullText.length > 200) {
            // Clean up the text and return the complete content without any character limits
            const cleanText = fullText.replace(/\s+/g, ' ').trim();
            return cleanText;
        }

        return undefined;
    }

    // extractBreadcrumbs($, url) {
    //     const breadcrumbs = [];
    //     const jsonLd = this.extractJsonLd($);

    //     if (jsonLd && jsonLd['@type'] === 'BreadcrumbList' && jsonLd.itemListElement) {
    //         return jsonLd.itemListElement.map(item => ({
    //             name: item.item.name,
    //             url: item.item['@id'] || item.item.url || item.item.name,
    //             position: item.position
    //         }));
    //     }

    //     $('nav.breadcrumb a').each((i, el) => {
    //         const name = $(el).text().trim();
    //         const href = $(el).attr('href');
    //         if (name && href) {
    //             breadcrumbs.push({
    //                 name,
    //                 url: this.makeAbsoluteUrl(href, url),
    //                 position: i + 1
    //             });
    //         }
    //     });

    //     return breadcrumbs.length > 0 ? breadcrumbs : null;
    // }

    extractBreadcrumbs($, url) {
        const breadcrumbs = [];

        // Helper to ensure a single trailing slash
        function ensureTrailingSlash(u) {
            if (!u.endsWith('/')) {
                // Remove any trailing ? or # fragments before adding slash
                const urlObj = new URL(u, url);
                let base = urlObj.origin + urlObj.pathname;
                if (!base.endsWith('/')) base += '/';
                return base + (urlObj.search ? urlObj.search : '') + (urlObj.hash ? urlObj.hash : '');
            }
            return u;
        }

        // Try HTML-based breadcrumb selectors
        const breadcrumbSelectors = [
            '.breadcrumb a',
            '.breadcrumbs a',
            '[typeof="BreadcrumbList"] a',
            'nav[aria-label*="bread" i] a',
        ];

        let found = false;
        for (const selector of breadcrumbSelectors) {
            const elements = $(selector);
            if (elements.length > 0) {
                elements.each((index, element) => {
                    const $el = $(element);
                    const text = $el.text().trim();
                    const href = $el.attr('href');
                    if (text && href) {
                        let absoluteUrl = this.makeAbsoluteUrl(href, url);
                        absoluteUrl = ensureTrailingSlash(absoluteUrl);
                        breadcrumbs.push({
                            name: text,
                            url: absoluteUrl,
                            position: index + 1,
                        });
                    }
                });
                found = true;
                break;
            }
        }

        // If no breadcrumbs found, build from URL path
        if (!found) {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/').filter(s => s.length > 0);

            // Add home link
            breadcrumbs.push({
                name: 'Home',
                url: ensureTrailingSlash(`${urlObj.protocol}//${urlObj.host}`),
                position: 1,
            });

            let currentPath = '';
            pathSegments.forEach((segment, index) => {
                currentPath += `/${segment}`;
                const name = segment
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
                let urlPath = `${urlObj.protocol}//${urlObj.host}${currentPath}`;
                urlPath = ensureTrailingSlash(urlPath);
                breadcrumbs.push({
                    name,
                    url: urlPath,
                    position: index + 2,
                });
            });
        }
        return breadcrumbs;
    }

    extractPublisher($) {
        const publisherName = $('meta[property="og:site_name"]').attr('content') || null;
        const publisherLogo = $('[itemprop="publisher"] [itemprop="logo"]').attr('content') || null;
        return { publisherName, publisherLogo };
    }

    extractAuthorUrl($, baseUrl) {
        const selectors = [
            '[rel="author"]',
            '.author a',
            '.byline a',
            '.article-author a',
            '.post-author a',
            '.entry-author a',
            'a[href*="/author/"]',
            'a[href*="/authors/"]',
            '.author-info a',
            '.author-name a',
        ];

        for (const selector of selectors) {
            const element = $(selector).first();
            if (element.length && element.attr('href')) {
                const href = element.attr('href');
                return this.makeAbsoluteUrl(href, baseUrl);
            }
        }
        return undefined;
    }

    extractJsonLd($) {
        let jsonLd = null;
        $('script[type="application/ld+json"]').each((_, element) => {
            try {
                const data = JSON.parse($(element).html() || '');
                if (data && typeof data === 'object') {
                    jsonLd = data;
                    return false; // Exit the loop
                }
            } catch (e) {
                // Ignore JSON parsing errors
            }
        });
        return jsonLd;
    }

    makeAbsoluteUrl(url, baseUrl) {
        try {
            return new URL(url, baseUrl).href;
        } catch {
            return url;
        }
    }

    formatDate(dateStr) {
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                return null;
            }
            return date.toISOString();
        } catch {
            return null;
        }
    }
}

module.exports = { WebScraper };
