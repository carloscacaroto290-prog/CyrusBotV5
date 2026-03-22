const axios = require('axios');
const express = require('express');
const fs = require('fs');
const cron = require('node-cron');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = "8640853323:AAGsctgIU-Mzi3bW5ScFx7wY7hVzq-CtVe0";
const CHAT_ID = "-1003770869079";
const BSC_API_KEY = "APRKUDAJ2BH41CXBYTTCYSMD3QVQDQSK86";
const WALLET_TESORERIA = "0x6Cd7bbB8a8C0C1B24a449c3AD8F913974de7b009";
const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";

const DB_FILE = './users_db.json';
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));

async function sendTelegram(message) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: "Markdown"
        });
    } catch (err) { console.error("Error Telegram:", err.message); }
}

// Endpoint para Moralis (SIEMPRE responde 200 primero)
app.post('/webhook-moralis', async (req, res) => {
    res.status(200).send('OK'); 
    const body = req.body;
    if (!body || !body.logs || body.logs.length === 0) return;

    let usersDB = JSON.parse(fs.readFileSync(DB_FILE));
    for (const log of body.logs) {
        const user = log.fromAddress.toLowerCase();
        const contract = log.address.toLowerCase();
        let msg = "";
        const isNew = !usersDB.includes(user);
        if (isNew) {
            usersDB.push(user);
            fs.writeFileSync(DB_FILE, JSON.stringify(usersDB));
        }

        if (contract === "0xc03353f94613777b7c08360be5d51bb493a8b0f8") {
            const status = isNew ? "✅ *USUARIO NUEVO DETECTADO*" : "🔄 *REINVERSIÓN / APORTE DETECTADO*";
            msg = `${status}\n\n👤 *Billetera:* \`${user}\`\n🌐 *Protocolo:* Nostradamus DeFi\n🔗 [Ver BscScan](https://bscscan.com/tx/${log.transactionHash})`;
        } else if (contract === "0xd9a3eb426b10656746e522af36379a1291ccfdd3") {
            msg = `⚠️ *RETIRO DE FONDOS DETECTADO*\n\n👤 *Billetera:* \`${user}\`\n📋 *Acción:* Liquidación / Retiro\n🔗 [Ver BscScan](https://bscscan.com/tx/${log.transactionHash})`;
        }
        if (msg) await sendTelegram(msg);
    }
});

// Ruta raíz para probar en el navegador (Evita el 502)
app.get('/', (req, res) => res.send('Monitor Nostradamus Online 🚀'));

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Monitor activo en puerto ${PORT}`);
});
