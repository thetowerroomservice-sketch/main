const https = require('https');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const WEB_APP_URL = 'https://spiffy-duckanoo-29986d.netlify.app';

function sendTelegram(method, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        const options = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${TELEGRAM_TOKEN}/${method}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(body));
        });

        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    try {
        const update = JSON.parse(event.body);

        // При команде /start или любом сообщении отправляем кнопку с открытием сайта
        if (update.message && update.message.text) {
            const chatId = update.message.chat.id;

            await sendTelegram('sendMessage', {
                chat_id: chatId,
                text: '🏨 <b>Добро пожаловать в The Tower Hotel!</b>\n\nНажмите кнопку ниже, чтобы открыть сервис обслуживания:',
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🏨 Открыть меню услуг", web_app: { url: WEB_APP_URL } }]
                    ]
                }
            });
            return { statusCode: 200, body: "OK" };
        }

        // Приём заказа из формы сайта
        if (update.action === "send_order") {
            await sendTelegram('sendMessage', {
                chat_id: CHAT_ID,
                text: update.text,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[{ text: "✅ Принять заказ", callback_data: "accept_order" }]]
                }
            });
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

        // Обработка нажатия кнопки "Принять заказ" менеджером
        if (update.callback_query) {
            const callback = update.callback_query;
            const message = callback.message;
            const managerName = callback.from.first_name || "Менеджер";

            if (callback.data === "accept_order") {
                await sendTelegram('answerCallbackQuery', { callback_query_id: callback.id, text: "Заказ принят!" });

                const timeStr = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                const updatedText = message.text.replace(
                    "⏳ Статус: Ожидает доставки",
                    `✅ <b>Принято менеджером:</b> ${managerName}\n⏱ <b>Время:</b> ${timeStr}`
                );

                await sendTelegram('editMessageText', {
                    chat_id: message.chat.id,
                    message_id: message.message_id,
                    text: updatedText,
                    parse_mode: 'HTML'
                });
            }
            return { statusCode: 200, body: "OK" };
        }

        return { statusCode: 200, body: "OK" };
    } catch (err) {
        return { statusCode: 500, body: err.toString() };
    }
};
