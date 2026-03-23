const axios = require('axios');
const express = require('express');
const fs = require('fs');
const cron = require('node-cron');

const app = express();
app.use(express.json());

// --- CONFIGURACIÓN DE CYRUS ---
const TELEGRAM_TOKEN = "8640853323:AAGsctgIU-Mzi3bW5ScFx7wY7hVzq-CtVe0";
const CHAT_ID = "-1003770869079";
const BSC_API_KEY = "APRKUDAJ2BH41CXBYTTCYSMD3QVQDQSK86";
const WALLET_TESORERIA = "0x6Cd7bbB8a8C0C1B24a449c3AD8F913974de7b009";
const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";

const DB_FILE = './users_db.json';

// Crear base de datos si no existe
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

// Función para enviar mensajes a Telegram
async function sendTelegram(message) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: "Markdown"
        });
    } catch (err) {
        console.error("❌ Error Telegram:", err.message);
    }
}

// --- MONITOREO DE PETICIONES (LOGS) ---
app.use((req, res, next) => {
    console.log(`📩 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// --- RUTAS DEL SERVIDOR ---

// 1. Ruta principal para el navegador (Prueba de vida)
app.get('/', (req, res) => {
    res.status(200).send('Cyrus Monitor Online 🚀');
});

// RUTA DE PRUEBA MANUAL
app.get('/test-telegram', async (req, res) => {
    try {
        await sendTelegram("🚀 *MENSAJE DE PRUEBA:* El sistema de monitoreo Cyrus está vinculado correctamente con Railway.");
        res.send("✅ Mensaje de prueba enviado. Revisa tu canal de Telegram.");
    } catch (error) {
        res.status(500).send("❌ Error al enviar mensaje: " + error.message);
    }
});

// 2. Webhook para Moralis (Cualquier ruta POST)
app.post('*', async (req, res) => {
    // Respondemos 200 inmediatamente para Moralis
    res.status(200).send('OK');

    const body = req.body;
    if (!body || !body.logs || body.logs.length === 0) return;

    console.log("🔥 Procesando evento detectado en la blockchain...");
    
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

        // Lógica de Contratos Cyrus
        if (contract === "0xc03353f94613777b7c08360be5d51bb493a8b0f8") {
            const status = isNew ? "✅ *USUARIO NUEVO DETECTADO*" : "🔄 *REINVERSIÓN DETECTADA*";
            msg = `${status}\n\n👤 *Billetera:* \`${user}\`\n🌐 *Protocolo:* Cyrus DeFi\n🔗 [Ver BscScan](https://bscscan.com/tx/${log.transactionHash})`;
        } else if (contract === "0xd9a3eb426b10656746e522af36379a1291ccfdd3") {
            msg = `⚠️ *RETIRO DE FONDOS DETECTADO*\n\n👤 *Billetera:* \`${user}\`\n📋 *Acción:* Liquidación / Retiro\n🔗 [Ver BscScan](https://bscscan.com/tx/${log.transactionHash})`;
        }

        if (msg) await sendTelegram(msg);
    }
});

// --- REPORTES AUTOMÁTICOS (Cada 4 horas) ---
cron.schedule('0 */4 * * *', async () => {
    console.log("⏳ Generando reporte de tesorería...");
    try {
        const balResp = await axios.get(`https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=${USDT_CONTRACT}&address=${WALLET_TESORERIA}&tag=latest&apikey=${BSC_API_KEY}`);
        const saldoTotal = parseFloat(balResp.data.result) / 1e18;

        const reporte = `📊 *REPORTE PERIÓDICO DE TESORERÍA CYRUS*\n\n🔹 *Balance Total Actual:* \`${saldoTotal.toFixed(2)}\` USDT\n\n_Generado por el sistema de monitoreo Cyrus._`;
        await sendTelegram(reporte);
    } catch (err) {
        console.error("❌ Error en reporte programado:", err.message);
    }
});

// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 8080;
// Escribe esto en tu navegador: https://tu-link.up.railway.app/test
app.get('/test', async (req, res) => {
    try {
        await sendTelegram("🚀 *PRUEBA DE CONEXIÓN:* Cyrus Monitor está listo.");
        res.send("<h1>✅ Mensaje enviado a Telegram</h1>");
    } catch (e) {
        res.status(500).send("Error: " + e.message);
    }
});
app.listen
