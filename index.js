const axios = require('axios');
const express = require('express');
const fs = require('fs');
const cron = require('node-cron');

const app = express();
app.use(express.json());

// --- CONFIGURACIÓN ---
const TELEGRAM_TOKEN = "8640853323:AAGsctgIU-Mzi3bW5ScFx7wY7hVzq-CtVe0";
const CHAT_ID = "-1003770869079";
const BSC_API_KEY = "APRKUDAJ2BH41CXBYTTCYSMD3QVQDQSK86";
const WALLET_TESORERIA = "0x6Cd7bbB8a8C0C1B24a449c3AD8F913974de7b009";
const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";

// Base de datos de usuarios (JSON local)
const DB_FILE = './users_db.json';
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

// --- UTILIDADES ---
async function sendTelegram(message) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: "Markdown"
        });
    } catch (err) {
        console.error("Error al enviar a Telegram:", err.response?.data || err.message);
    }
}

// --- 1. REPORTE DE TESORERÍA (Cada 4 Horas) ---
// Se ejecuta a las 00:00, 04:00, 08:00, 12:00, 16:00 y 20:00
cron.schedule('0 */4 * * *', async () => {
    console.log("Generando reporte de tesorería...");
    try {
        const ahora = Math.floor(Date.now() / 1000);
        const hace4horas = ahora - (4 * 60 * 60);

        // Obtener historial de USDT
        const resp = await axios.get(`https://api.bscscan.com/api`, {
            params: {
                module: "account",
                action: "tokentx",
                address: WALLET_TESORERIA,
                contractaddress: USDT_CONTRACT,
                sort: "desc",
                apikey: BSC_API_KEY
            }
        });

        const txs = resp.data.result || [];
        const recibidos = txs.filter(tx => 
            tx.to.toLowerCase() === WALLET_TESORERIA.toLowerCase() && 
            parseInt(tx.timeStamp) >= hace4horas
        );

        const suma4h = recibidos.reduce((acc, tx) => acc + (parseFloat(tx.value) / 1e18), 0);
        
        // Obtener Saldo Total
        const balResp = await axios.get(`https://api.bscscan.com/api`, {
            params: {
                module: "account",
                action: "tokenbalance",
                contractaddress: USDT_CONTRACT,
                address: WALLET_TESORERIA,
                tag: "latest",
                apikey: BSC_API_KEY
            }
        });
        const saldoTotal = parseFloat(balResp.data.result) / 1e18;

        const reporte = `📊 *REPORTE PERIÓDICO DE TESORERÍA*\n\n` +
                        `🔹 *Monto Recibido (últimas 4h):* \`${suma4h.toFixed(2)}\` USDT\n` +
                        `🔹 *Balance Total Actual:* \`${saldoTotal.toFixed(2)}\` USDT\n\n` +
                        `_Generado automáticamente por el sistema de monitoreo._`;

        await sendTelegram(reporte);
    } catch (err) {
        console.error("Error en cron de tesorería:", err.message);
    }
});

// --- 2. WEBHOOK PARA ALERTAS EN TIEMPO REAL (MORALIS) ---
app.post('/webhook-moralis', async (req, res) => {
    const body = req.body;

    // Moralis envía confirmaciones de stream, las ignoramos
    if (body.confirmed) return res.sendStatus(200);
    if (!body.logs || body.logs.length === 0) return res.sendStatus(200);

    let usersDB = JSON.parse(fs.readFileSync(DB_FILE));

    for (const log of body.logs) {
        const user = log.fromAddress.toLowerCase();
        const contract = log.address.toLowerCase();
        let msg = "";

        // Verificar si es usuario nuevo
        const isNew = !usersDB.includes(user);
        if (isNew) {
            usersDB.push(user);
            fs.writeFileSync(DB_FILE, JSON.stringify(usersDB));
        }

        // Caso A: Contrato Principal (Inversiones/Reinversiones)
        if (contract === "0xc03353f94613777b7c08360be5d51bb493a8b0f8") {
            const status = isNew ? "✅ *USUARIO NUEVO DETECTADO*" : "🔄 *REINVERSIÓN / APORTE DETECTADO*";
            msg = `${status}\n\n` +
                  `👤 *Billetera:* \`${user}\`\n` +
                  `🌐 *Protocolo:* Nostradamus DeFi\n` +
                  `🔗 [Ver detalle en BscScan](https://bscscan.com/tx/${log.transactionHash})`;
        } 
        // Caso B: Contrato de Retiros
        else if (contract === "0xd9a3eb426b10656746e522af36379a1291ccfdd3") {
            msg = `⚠️ *RETIRO DE FONDOS DETECTADO*\n\n` +
                  `👤 *Billetera:* \`${user}\`\n` +
                  `📋 *Acción:* Liquidación / Retiro de posición\n` +
                  `🔗 [Ver detalle en BscScan](https://bscscan.com/tx/${log.transactionHash})`;
        }

        if (msg) await sendTelegram(msg);
    }
    res.sendStatus(200);
});

// Inicio del servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Monitor Nostradamus activo en puerto ${PORT}`);
});