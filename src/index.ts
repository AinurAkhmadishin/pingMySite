import 'dotenv/config';
import express, { Request, Response } from 'express';
import TelegramBot from 'node-telegram-bot-api';
import https from 'https';
import http from 'http';

const HttpsProxyAgent = require('https-proxy-agent');

const BOT_TOKEN = process.env.BOT_TOKEN!;
const CHECK_INTERVAL = 60000;
const TIMEOUT = 10000;

interface Monitor {
  url: string;
  isDown: boolean;
  lastChecked: number | null;
}

interface CheckResult {
  ok: boolean;
  status: number | string;
}

const botOptions: any = { polling: true };
if (process.env.PROXY_URL) {
  botOptions.request = {
    agent: new HttpsProxyAgent(process.env.PROXY_URL)
  };
}

const bot = new TelegramBot(BOT_TOKEN, botOptions);
const app = express();
const PORT = process.env.PORT || 3000;

const monitors = new Map<number, Monitor[]>();

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    `👋 Добро пожаловать в Ping Bot!

Команды:
/add <url> — добавить сайт на мониторинг
/list — показать ваши отслеживаемые сайты
/remove <номер> — удалить сайт из списка
/help — показать это сообщение

Пример: /add https://google.com`
  );
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `📋 Как пользоваться:

/add <url> — начать мониторинг сайта
  Пример: /add https://example.com

/list — посмотреть все ваши отслеживаемые сайты

/remove <номер> — остановить мониторинг сайта
  Пример: /remove 1

Вы получите уведомление, когда сайт станет недоступен! 🚨`
  );
});

bot.onText(/\/add\s+(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  if (!match) return;
  let url = match[1].trim();

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  if (!monitors.has(chatId)) {
    monitors.set(chatId, []);
  }

  const userMonitors = monitors.get(chatId)!;

  if (userMonitors.some(m => m.url === url)) {
    bot.sendMessage(chatId, `⚠️ Сайт ${url} уже отслеживается!`);
    return;
  }

  userMonitors.push({
    url,
    isDown: false,
    lastChecked: null
  });

  bot.sendMessage(chatId, `✅ Добавлен ${url}\nМониторинг запущен!`);
});

bot.onText(/\/list/, (msg) => {
  const chatId = msg.chat.id;
  const userMonitors = monitors.get(chatId);

  if (!userMonitors || userMonitors.length === 0) {
    bot.sendMessage(chatId, '📭 Нет сайтов на мониторинге.\nИспользуйте /add чтобы начать отслеживание.');
    return;
  }

  let message = '📊 Ваши отслеживаемые сайты:\n\n';
  userMonitors.forEach((m, i) => {
    const status = m.isDown ? '🔴 НЕДОСТУПЕН' : '🟢 РАБОТАЕТ';
    const lastCheck = m.lastChecked ? new Date(m.lastChecked).toLocaleTimeString() : 'Ещё не проверялся';
    message += `${i + 1}. ${m.url}\n   Статус: ${status} | Последняя проверка: ${lastCheck}\n\n`;
  });

  bot.sendMessage(chatId, message);
});

bot.onText(/\/remove\s+(\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  if (!match) return;
  const index = parseInt(match[1]) - 1;
  const userMonitors = monitors.get(chatId);

  if (!userMonitors || index < 0 || index >= userMonitors.length) {
    bot.sendMessage(chatId, '❌ Неверный номер. Используйте /list для просмотра сайтов.');
    return;
  }

  const removed = userMonitors.splice(index, 1)[0];
  bot.sendMessage(chatId, `🗑️ Удалён ${removed.url} из мониторинга.`);
});

function checkSite(url: string): Promise<CheckResult> {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => resolve({ ok: false, status: 'Таймаут' }), TIMEOUT);

    client.get(url, { timeout: TIMEOUT }, (res) => {
      clearTimeout(timeout);
      const statusCode = res.statusCode!;
      res.resume();
      res.on('end', () => {
        resolve({ ok: statusCode >= 200 && statusCode < 400, status: statusCode });
      });
    }).on('error', (err: Error) => {
      clearTimeout(timeout);
      resolve({ ok: false, status: err.message });
    });
  });
}

async function checkAllSites() {
  for (const [chatId, userMonitors] of monitors) {
    for (const monitor of userMonitors) {
      const result = await checkSite(monitor.url);
      monitor.lastChecked = Date.now();

      if (!result.ok && !monitor.isDown) {
        monitor.isDown = true;
        bot.sendMessage(chatId,
          `🚨 ВНИМАНИЕ: Сайт НЕДОСТУПЕН!\n\n` +
          `URL: ${monitor.url}\n` +
          `Ошибка: ${result.status}\n` +
          `Время: ${new Date().toLocaleString()}`
        );
      } else if (result.ok && monitor.isDown) {
        monitor.isDown = false;
        bot.sendMessage(chatId,
          `✅ Сайт снова РАБОТАЕТ!\n\n` +
          `URL: ${monitor.url}\n` +
          `Время: ${new Date().toLocaleString()}`
        );
      }
    }
  }
}

setInterval(checkAllSites, CHECK_INTERVAL);

app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'Ping Bot is running', monitoredSites: monitors.size });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🤖 Ping Bot started`);
});
