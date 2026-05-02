const express = require('express');
const puppeteer = require('puppeteer');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.post('/generate-pdf', async (req, res) => {
    try {
        const data = req.body;

        // No longer using background image as we are using CSS/SVG


        // Read the new optimized logo
        const logoPath = path.join(__dirname, 'public', 'MUI_Logo.png');
        const logoBase64 = fs.readFileSync(logoPath, { encoding: 'base64' });
        const logoSrc = `data:image/png;base64,${logoBase64}`;

        // Render EJS template to HTML string
        const html = await ejs.renderFile(path.join(__dirname, 'views', 'template.ejs'), {
            ...data,
            logoSrc
        });

        // Launch Puppeteer and generate PDF
        const browser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });
        const page = await browser.newPage();

        // Optimize viewport for A4
        await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });

        // Set content and wait for it to be fully loaded
        await page.setContent(html, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
            preferCSSPageSize: true
        });

        await browser.close();

        const safeStudentName = (data.studentName || 'Student').replace(/[^a-z0-9]/gi, '_');
        const safeAssignmentTitle = (data.assignmentTitle || 'Assignment').replace(/[^a-z0-9]/gi, '_');
        const fileName = `${safeStudentName}_${safeAssignmentTitle}.pdf`;

        res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': pdfBuffer.length
        });
        res.end(pdfBuffer);
    } catch (error) {
        console.error('Error generating PDF:', error);
        if (!res.headersSent) {
            res.status(500).send('Error generating PDF: ' + error.message);
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
