// src/schemaGenerator.js
// Converted from the provided TypeScript file to JavaScript

// Mock a simple ExtractedData type for clarity
// You might need to adjust some properties based on your exact needs.
/**
 * @typedef {object} ExtractedData
 * @property {string} [title]
 * @property {string} [description]
 * @property {object} [image]
 * @property {string} [author]
 * @property {string} [authorUrl]
 * @property {string} [publisherName]
 * @property {string} [publisherLogo]
 * @property {string} [datePublished]
 * @property {string} [dateModified]
 * @property {string} [articleSection]
 * @property {string} [articleBody]
 * @property {Array<object>} [breadcrumbs]
 * @property {Array<object>} [faqs]
 */

class SchemaGenerator {
    /**
     * Generates an Article schema.
     * @param {ExtractedData} data The extracted data.
     * @param {string} url The original URL.
     * @returns {object|null} The schema object or null.
     */
    generateArticleSchema(data, url) {
        const schema = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": data.title,
            "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": url
            }
        };

        if (data.description) {
            schema.description = data.description;
        }

        if (data.image) {
            schema.image = {
                "@type": "ImageObject",
                "url": data.image.url,
                ...(data.image.height && { height: data.image.height }),
                ...(data.image.width && { width: data.image.width })
            };
        }

        if (data.author) {
            schema.author = {
                "@type": "Person",
                "name": data.author,
                ...(data.authorUrl && { url: data.authorUrl })
            };
        }

        if (data.publisherName) {
            schema.publisher = {
                "@type": "Organization",
                "name": data.publisherName,
                ...(data.publisherLogo && {
                    logo: {
                        "@type": "ImageObject",
                        "url": data.publisherLogo
                    }
                })
            };
        }

        if (data.datePublished) {
            schema.datePublished = data.datePublished;
        }

        if (data.dateModified) {
            schema.dateModified = data.dateModified;
        }

        if (data.articleSection) {
            schema.articleSection = data.articleSection;
        }

        if (data.articleBody) {
            schema.articleBody = data.articleBody;
        }
        return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
    }

    /**
     * Generates a BreadcrumbList schema.
     * @param {ExtractedData} data The extracted data.
     * @returns {object|null} The schema object or null.
     */
    // generateBreadcrumbSchema(data) {
    //     if (!data.breadcrumbs || data.breadcrumbs.length === 0) {
    //         return null;
    //     }
    //     const schema = {
    //         "@context": "https://schema.org/",
    //         "@type": "BreadcrumbList",
    //         "name": data.title,
    //         "itemListElement": data.breadcrumbs.map(breadcrumb => ({
    //             "@type": "ListItem",
    //             "position": breadcrumb.position.toString(),
    //             "item": {
    //                 "@id": breadcrumb.url,
    //                 "name": breadcrumb.name
    //             }
    //         }))
    //     };
    //     return `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`;
    // }

    generateBreadcrumbSchema(data) {
        if (!data.breadcrumbs || data.breadcrumbs.length === 0) {
            console.warn("No breadcrumbs data available.");
            return null;
        }

        // Helper to ensure a single trailing slash
        function ensureTrailingSlash(u) {
            if (!u.endsWith('/')) {
                try {
                    const urlObj = new URL(u);
                    let base = urlObj.origin + urlObj.pathname;
                    if (!base.endsWith('/')) base += '/';
                    return base + (urlObj.search ? urlObj.search : '') + (urlObj.hash ? urlObj.hash : '');
                } catch {
                    return u.endsWith('/') ? u : u + '/';
                }
            }
            return u;
        }

        const schema = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": data.breadcrumbs.map((crumb, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "name": crumb.name,
                "item": ensureTrailingSlash(crumb.url)
            }))
        };
        return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
    }


    // Helper to make absolute URLs
    makeAbsoluteUrl(href, baseUrl) {
        try {
            return new URL(href, baseUrl).href;
        } catch {
            return href;
        }
    }

    /**
     * Generates an FAQPage schema.
     * @param {ExtractedData} data The extracted data.
     * @returns {object|null} The schema object or null.
     */
    generateFaqSchema(data) {
        if (!data.faqs || data.faqs.length === 0) {
            return null;
        }

        const schema = {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": data.faqs.map(faq => ({
                "@type": "Question",
                "name": faq.question,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": faq.answer
                }
            }))
        };
        return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
    }
}

module.exports = { SchemaGenerator };
