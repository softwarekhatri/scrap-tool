// public/client.js

document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const getArticleBtn = document.getElementById('getArticleBtn');
    const getBreadcrumbsBtn = document.getElementById('getBreadcrumbsBtn');
    const getFaqBtn = document.getElementById('getFaqBtn');
    const output = document.getElementById('output');

    /**
     * Fetches data from the specified API endpoint and displays it.
     * @param {string} endpoint The API endpoint (e.g., '/api/article').
     */
    async function fetchData(endpoint) {
        const url = urlInput.value;
        if (!url) {
            output.textContent = 'Please enter a valid URL.';
            return;
        }

        output.textContent = 'Fetching data...';

        try {
            const response = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Something went wrong');
            }
            // output.textContent = JSON.parse(data, null, 2);
            output.textContent = data;
        } catch (error) {
            output.textContent = `Error: ${error.message}`;
            console.error(error);
        }
    }

    // Add event listeners to the buttons
    getArticleBtn.addEventListener('click', () => fetchData('/api/article'));
    getBreadcrumbsBtn.addEventListener('click', () => fetchData('/api/breadcrumbs'));
    getFaqBtn.addEventListener('click', () => fetchData('/api/faqs'));
});
