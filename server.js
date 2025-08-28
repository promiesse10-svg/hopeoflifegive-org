import express from 'express';
import 'dotenv/config';
import { Client, Environment } from 'square';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// --- Config from env ---
const {
  PORT = 8080,
  SQUARE_ENVIRONMENT = 'production',
  SQUARE_ACCESS_TOKEN,
  SQUARE_LOCATION_ID,
  SQUARE_APP_ID
} = process.env;

if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID || !SQUARE_APP_ID) {
  console.error('❌ Missing Square env vars. Set SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_APP_ID in .env');
  process.exit(1);
}

// --- Square client (PRODUCTION by default) ---
const client = new Client({
  environment: SQUARE_ENVIRONMENT === 'production' ? Environment.Production : Environment.Sandbox,
  accessToken: SQUARE_ACCESS_TOKEN
});

// --- Middleware ---
app.use(express.json());

// --- Serve static site ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Inject public config (APP_ID + LOCATION_ID) ---
app.get('/config.js', (_req, res) => {
  res.type('application/javascript').send(
    `window.SQUARE_CONFIG = {
      appId: ${JSON.stringify(SQUARE_APP_ID)},
      locationId: ${JSON.stringify(SQUARE_LOCATION_ID)},
      apiBaseUrl: ""
    };`
  );
});

// --- Payments endpoint ---
app.post('/api/pay', async (req, res) => {
  try {
    const { token, amount, idempotencyKey, fund, name, email } = req.body || {};
    if (!token || !amount) return res.status(400).json({ error: 'Missing token or amount' });

    const noteParts = [
      fund ? `Fund: ${fund}` : null,
      name ? `Name: ${name}` : null,
      email ? `Email: ${email}` : null
    ].filter(Boolean);

    const { paymentsApi } = client;
    const result = await paymentsApi.createPayment({
      sourceId: token,
      idempotencyKey: idempotencyKey || randomUUID(),
      amountMoney: { amount: Number(amount), currency: 'USD' }, // cents
      locationId: SQUARE_LOCATION_ID,
      note: noteParts.join(' | ') || undefined,
      buyerEmailAddress: email || undefined
    });

    res.json({ ok: true, payment: result.result.payment });
  } catch (err) {
    const message =
      err?.errors?.[0]?.detail ||
      err?.message ||
      'Payment error';
    res.status(500).json({ error: message });
  }
});

// --- Fallback to index.html for any other route ---
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Live on http://localhost:${PORT} (${SQUARE_ENVIRONMENT.toUpperCase()})`);
});

