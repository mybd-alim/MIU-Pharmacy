const express = require('express');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.get('/logo.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'MUI_Logo.png'));
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

let browserInstance;
let browserLaunchPromise;

async function getBrowser() {
    if (browserInstance?.connected) {
        return browserInstance;
    }

    if (!browserLaunchPromise) {
        browserLaunchPromise = (async () => {
            const { default: puppeteer } = await import('puppeteer');
            return puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-extensions',
                    '--font-render-hinting=none',
                    '--disable-software-rasterizer',
                    '--js-flags="--max-old-space-size=256"'
                ]
            });
        })();
    }

    try {
        const browser = await browserLaunchPromise;
        browserInstance = browser;
        browserInstance.on('disconnected', () => {
            if (browserInstance === browser) {
                browserInstance = null;
            }
        });
        return browser;
    } finally {
        browserLaunchPromise = null;
    }
}

app.post('/generate-pdf', async (req, res) => {
    let page = null;
    try {
        const data = req.body;
        console.log('Generating PDF for:', data.studentName, '-', data.assignmentTitle);

        // Read the new optimized logo
        const logoPath = path.join(__dirname, 'public', 'MUI_Logo.png');
        let logoSrc = '';
        try {
            const logoBase64 = fs.readFileSync(logoPath, { encoding: 'base64' });
            logoSrc = `data:image/png;base64,${logoBase64}`;
        } catch (logoError) {
            console.error('Logo read error:', logoError);
            // Fallback or handle missing logo if needed
        }

        // Render EJS template to HTML string
        const html = await ejs.renderFile(path.join(__dirname, 'views', 'template.ejs'), {
            ...data,
            logoSrc
        });

        const browser = await getBrowser();
        page = await browser.newPage();
        
        // Optimize viewport for A4
        await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });

        // Set content and wait for basic load to avoid timeouts on slow connections
        console.log('Setting content...');
        await page.setContent(html, {
            waitUntil: 'load', // Faster than networkidle0
            timeout: 45000 
        });

        console.log('Generating PDF...');
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
            preferCSSPageSize: true
        });

        const safeStudentName = (data.studentName || 'Student').replace(/[^a-z0-9]/gi, '_');
        const safeAssignmentTitle = (data.assignmentTitle || 'Assignment').replace(/[^a-z0-9]/gi, '_');
        const fileName = `${safeStudentName}_${safeAssignmentTitle}.pdf`;

        console.log(`Successfully generated: ${fileName} (${pdfBuffer.length} bytes)`);

        res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': pdfBuffer.length,
            'Access-Control-Expose-Headers': 'Content-Disposition'
        });
        res.end(pdfBuffer);

    } catch (error) {
        console.error('CRITICAL ERROR during PDF generation:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false, 
                message: 'Error generating PDF', 
                error: error.message 
            });
        }
    } finally {
        if (page) {
            await page.close().catch(err => console.error('Error closing page:', err));
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
