// Import required modules
const express = require('express');
const path = require('path');
const { WebScraper } = require('./src/scraper');
const { SchemaGenerator } = require('./src/schemaGenerator');

// Initialize Express app
const app = express();
const port = 3003;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Create instances of our classes
const webScraper = new WebScraper();
const schemaGenerator = new SchemaGenerator();

// API endpoint to get article schema
app.get('/api/article', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({ error: 'URL query parameter is required.' });
    }

    try {
        const data = await webScraper.scrapeUrl(url);
        const schema = schemaGenerator.generateArticleSchema(data, url);
        res.json(schema);
    } catch (error) {
        console.error(`Error scraping article for URL ${url}:`, error);
        res.status(500).json({ error: `Failed to scrape article data: ${error.message}` });
    }
});

// API endpoint to get breadcrumbs schema
app.get('/api/breadcrumbs', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({ error: 'URL query parameter is required.' });
    }
    try {
        const data = await webScraper.scrapeUrl(url);
        const schema = schemaGenerator.generateBreadcrumbSchema(data);
        res.json(schema);
    } catch (error) {
        console.error(`Error scraping breadcrumbs for URL ${url}:`, error);
        res.status(500).json({ error: `Failed to scrape breadcrumbs data: ${error.message}` });
    }
});

// API endpoint to get FAQ schema
app.get('/api/faqs', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({ error: 'URL query parameter is required.' });
    }

    try {
        const data = await webScraper.scrapeUrl(url);
        // Ensure data.faqs is a valid array before generating the schema
        if (!data.faqs || data.faqs.length === 0) {
            return res.status(400).json({ error: 'No FAQ data found on this page.' });
        }
        const schema = schemaGenerator.generateFaqSchema(data);
        res.json(schema);
    } catch (error) {
        console.error(`Error scraping FAQ for URL ${url}:`, error);
        res.status(500).json({ error: `Failed to scrape FAQ data: ${error.message}` });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
