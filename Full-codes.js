'use strict';

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';
const PRICE_API_URL = 'https://webservice.lorddeveloper.ir/arz/';
const FETCH_TIMEOUT = 10000; // 10 seconds

function getApiKey(env) {
  const key = env.TELEGRAM_BOT_TOKEN;
  if (!key) {
    console.error('TELEGRAM_BOT_TOKEN is not set in environment variables.');
    throw new Error('Token not configured');
  }
  return key;
}

async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeout}ms`);
    }
    throw error;
  }
}

async function telegramApiCall(method, body, token) {
  const url = `${TELEGRAM_API_BASE}${token}/${method}`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Telegram API HTTP error ${res.status} for ${method}:`, errorText);
    throw new Error(`Telegram API HTTP ${res.status}`);
  }

  const data = await res.json();
  console.log(`Telegram API response ${method}:`, JSON.stringify(data));

  if (!data.ok) {
    console.error(`Telegram API logical error for ${method}:`, JSON.stringify(data));
    throw new Error(`Telegram API error: ${data.description || 'Unknown error'}`);
  }

  return data.result;
}

async function sendMessage(chatId, text, replyMarkup, token) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }
  return telegramApiCall('sendMessage', body, token);
}

async function answerInlineQuery(inlineQueryId, results, token) {
  const body = {
    inline_query_id: inlineQueryId,
    results,
    cache_time: 0,
  };
  return telegramApiCall('answerInlineQuery', body, token);
}

async function fetchPriceData() {
  const res = await fetch(PRICE_API_URL);
  if (!res.ok) {
    throw new Error('خطا در دریافت اطلاعات از سرور');
  }
  const data = await res.json();
  return data;
}

function formatCurrency(p) {
  if (!p.currency) return '💶 اطلاعات ارز در دسترس نیست.';

  const c = p.currency;

  return `💶 <b>قیمت ارز</b>

🇺🇸 دلار: ${c.dollar}
🇪🇺 یورو: ${c.euro}
🇬🇧 پوند: ${c.pound}
🇦🇪 درهم: ${c.AED}
🇯🇵 ین: ${c.yen}
🇹🇷 لیر ترکیه: ${c.turkish_lira}
🇨🇳 یوان چین: ${c.chinese_yuan}
🇨🇦 دلار کانادا: ${c.canadian_dollar}`;
}

function formatGold(p) {
  if (!p.gold) return '🏵 اطلاعات طلا در دسترس نیست.';

  const g = p.gold;

  return `🏵 <b>قیمت طلا</b>

📍 انس طلا: ${g.ounce}
📍 مثقال طلا: ${g.gold}
📍 طلای ۱۸ عیار: ${g.gold_18}
📍 طلای ۲۴ عیار: ${g.gold_24}
📍 نقره: ${g.silver}`;
}

function formatCoin(p) {
  if (!p.coin) return '💰 اطلاعات سکه در دسترس نیست.';

  const c = p.coin;

  return `💰 <b>قیمت سکه</b>

📍 سکه بهار آزادی: ${c.gold_coin}
📍 سکه امامی: ${c.emami_coin}
📍 نیم سکه: ${c.half_coin}
📍 ربع سکه: ${c.quarter_coin}
📍 سکه گرمی: ${c.gramme_coin}`;
}

async function handleStart(chatId, userFirstName, token) {
  const welcomeText = `سلام ${userFirstName} عزیز 😃\n\n📶 به ربات نرخ لحظه‌ای طلا و ارز خوش آمدید.\nاز دکمه‌های زیر استفاده کنید.`;
  const keyboard = {
    keyboard: [
      [{ text: '💶 قیمت ارز' }],
      [{ text: '🏵 قیمت طلا' }, { text: '💰 قیمت سکه' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
  await sendMessage(chatId, welcomeText, keyboard, token);
}

async function handlePriceRequest(chatId, text, token) {
  let data;
  try {
    data = await fetchPriceData();
  } catch (err) {
    console.error('Failed to fetch price data:', err);
    await sendMessage(chatId, 'متأسفانه در دریافت اطلاعات خطایی رخ داد. لطفاً بعداً تلاش کنید.', null, token);
    return;
  }
  let message;
  if (text === '💶 قیمت ارز') {
    message = formatCurrency(data);
  } else if (text === '🏵 قیمت طلا') {
    message = formatGold(data);
  } else if (text === '💰 قیمت سکه') {
    message = formatCoin(data);
  } else {
    return;
  }
  await sendMessage(chatId, message, null, token);
}

async function handleMessage(message, token) {
  const chatId = message.chat.id;
  const text = message.text || '';
  if (text.startsWith('/start')) {
    const firstName = message.from.first_name || 'کاربر';
    await handleStart(chatId, firstName, token);
  } else if (text === '💶 قیمت ارز' || text === '🏵 قیمت طلا' || text === '💰 قیمت سکه') {
    await handlePriceRequest(chatId, text, token);
  }
}

async function handleInlineQuery(inlineQuery, token) {
  const queryId = inlineQuery.id;
  let currencyText = 'خطا در دریافت اطلاعات ارز';
  let goldText = 'خطا در دریافت اطلاعات طلا';
  let coinText = 'خطا در دریافت اطلاعات سکه';
  try {
    const data = await fetchPriceData();
    currencyText = formatCurrency(data);
    goldText = formatGold(data);
    coinText = formatCoin(data);
  } catch (err) {
    console.error('Inline price fetch error:', err);
  }
  const results = [
    {
      type: 'article',
      id: '1',
      title: '💶 نرخ ارز',
      input_message_content: {
        message_text: currencyText,
        parse_mode: 'HTML',
      },
    },
    {
      type: 'article',
      id: '2',
      title: '🏵 نرخ طلا',
      input_message_content: {
        message_text: goldText,
        parse_mode: 'HTML',
      },
    },
    {
      type: 'article',
      id: '3',
      title: '💰 نرخ سکه',
      input_message_content: {
        message_text: coinText,
        parse_mode: 'HTML',
      },
    },
  ];
  await answerInlineQuery(queryId, results, token);
}

async function handleUpdate(update, env) {
  const token = getApiKey(env);
  if (update.message) {
    await handleMessage(update.message, token);
  } else if (update.inline_query) {
    await handleInlineQuery(update.inline_query, token);
  }
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    try {
      if (!env.TELEGRAM_BOT_TOKEN) {
        console.error('Missing TELEGRAM_BOT_TOKEN environment variable.');
        return new Response('Server configuration error', { status: 500 });
      }
      const body = await request.json();
      await handleUpdate(body, env);
      return new Response('OK', { status: 200 });
    } catch (err) {
      console.error('Unhandled worker error:', err);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};