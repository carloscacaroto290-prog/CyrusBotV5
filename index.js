const axios = require('axios');
const express = require('express');
const fs = require('fs');
const cron = require('node-cron');

const app = express();
app.use(express.json());

// ==========================================
// CONFIGURACIÓN DE CYRUS (TOKEN Y CONTRATOS)
// ==========================================
const TELEGRAM_TOKEN = "8640853323:AAGsctgIU-Mzi3bW5ScFx7wY7hVzq-CtVe0";
const CHAT_ID = "-1003770869079";
const BSC_API_KEY = "APRKUDAJ2BH41CXBYTTCYSMD3QVQDQSK86";
const WALLET_TESORERIA = "0x6Cd7bbB8a8C0C1B24a449c3AD8F913974de7b009";
const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";

const DB_FILE = './users_db.json';

// Iniciar base de datos local si no existe
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

// Función principal para enviar a Telegram
async function sendTelegram(message) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: "Markdown"
        });
    } catch (err) {
        console.error("❌ Error enviando a Telegram:", err.response ? err.response.data : err.message);
    }
}

// ==========================================
// RUTAS DE DIAGNÓSTICO Y RED
// ==========================================

// Log de peticiones para ver si Moralis llega
app.use((req, res, next) => {
    console.log(`📩 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// 1. Ruta de vida (Lo que ves en el navegador)
app.get('/', (req, res) => {
    res.status(200).send('<h1>Cyrus Monitor Online 🚀</h1><p>Servidor escuchando correctamente.</p>');
});

// 2. Ruta de prueba manual (Escribe esto en tu navegador para probar Telegram)
app.get('/test-telegram', async (req, res) => {
    try {
        await sendTelegram("🚀 *CONEXIÓN EXITOSA:* El monitor de Cyrus ya puede publicar en este canal.");
        res.send("✅ Mensaje de prueba enviado. Revisa Telegram.");
    } catch (e) {
        res.status(500).send("Error: " + e.message);
    }
});

// ==========================================
// WEBHOOK PARA MORALIS
// ==========================================
app.post('/webhook-moralis', async (req, res) => {
    // 1. Responder 200 OK inmediatamente (Obligatorio para Moralis)
    res.status(200).send('OK');

    const body = req.body;
    if (!body || !body.logs || body.logs.length === 0) return;

    console.log("🔥 Procesando evento de la Blockchain...");
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

        // Lógica Contrato Inversión Cyrus
        if (contract === "0xc03353f94613777b7c08360be5d51bb493a8b0f8") {
            const status = isNew ? "✅ *USUARIO NUEVO DETECTADO*" : "🔄 *REINVERSIÓN DETECTADA*";
            msg = `${status}\n\n👤 *Billetera:* \`${user}\`\n🌐 *Protocolo:* Cyrus DeFi\n🔗 [Ver BscScan](https://bscscan.com/tx/${log.transactionHash})`;
        } 
        // Lógica Contrato Retiro Cyrus
        else if (contract === "0xd9a3eb426b10656746e522af36379a1291ccfdd3") {
            msg = `⚠️ *RETIRO DE FONDOS DETECTADO*\n\n👤 *Billetera:* \`${user}\`\n📋 *Acción:* Liquidación de posición\n🔗 [Ver BscScan](https://bscscan.com/tx/${log.transactionHash})`;
        }

        if (msg) await sendTelegram(msg);
    }
});

// ==========================================
// REPORTE DE TESORERÍA (CADA 4 HORAS)
// ==========================================
cron.schedule('0 */4 * * *', async () => {
    console.log("⏳ Generando reporte de tesorería automático...");
    try {
        // NUEVA URL API V2 (Con el chainid=56 para la red BSC)
        const url = `https://api.etherscan.io/v2/api?chainid=56&module=account&action=tokenbalance&contractaddress=${USDT_CONTRACT}&address=${WALLET_TESORERIA}&tag=latest&apikey=${BSC_API_KEY}`;
        
        const balResp = await axios.get(url);

        // Freno de emergencia: Si la API responde con error, abortamos para evitar el NaN
        if (balResp.data.status === "0") {
            console.error("❌ La API rechazó la consulta. Razón:", balResp.data.result);
            return; 
        }

        const saldoTotal = parseFloat(balResp.data.result) / 1e18;

        const reporte = `📊 *REPORTE PERIÓDICO DE TESORERÍA CYRUS*\n\n🔹 *Balance Total Actual:* \`${saldoTotal.toFixed(2)}\` USDT\n\n_Generado automáticamente por Cyrus Monitor._`;
        await sendTelegram(reporte);
    } catch (err) {
        console.error("❌ Error en reporte Cron:", err.message);
    }
});

// ==========================================
// ARRANQUE DEL SERVIDOR (EL TRUCO DEL 0.0.0.0)
// ==========================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Cyrus Monitor activo en puerto ${PORT} y escuchando en 0.0.0.0`);
});
