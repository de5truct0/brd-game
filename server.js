const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Cache static files for better performance
app.use(express.static(__dirname, {
    maxAge: '1h',
    etag: true
}));

// Health check for Railway
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Game server running on port ${PORT}`);
});
