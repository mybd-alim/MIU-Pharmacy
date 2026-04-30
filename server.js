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


        // Read logo image as base64
        const logoPath = path.join(__dirname, 'public', 'FinalLogo_PNG.png');
        const logoBase64 = fs.readFileSync(logoPath, { encoding: 'base64' });
        const logoSrc = `data:image/png;base64,${logoBase64}`;

        // Render EJS template to HTML string
        const html = await ejs.renderFile(path.join(__dirname, 'views', 'template.ejs'), {
            ...data,
            bgImageSrc,
            logoSrc
        });

        // Launch Puppeteer and generate PDF
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' }
        });

        await browser.close();

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="Cover_Page.pdf"'
        });
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send('Error generating PDF');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
