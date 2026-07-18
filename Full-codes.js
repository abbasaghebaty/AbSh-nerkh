// ============================================================
// ربات تلگرام - نرخ طلا و ارز (Cloudflare Workers)
// ============================================================

export default {
  async fetch(request, env) {
    // توکن ربات را از environment variables دریافت کنید
    const API_KEY = env.TELEGRAM_BOT_TOKEN; // نام متغیر در Cloudflare Dashboard

    // فقط درخواست‌های POST (webhook) را پردازش می‌کنیم
    if (request.method !== 'POST') {
      return new Response('Only POST requests are accepted', { status: 405 });
    }

    try {
      const update = await request.json();
      await handleTelegramUpdate(update, API_KEY);
      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Error processing update:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};

// ------------------------------------------------------------
// پردازشگر اصلی آپدیت‌های تلگرام
// ------------------------------------------------------------
async function handleTelegramUpdate(update, API_KEY) {
  // استخراج اطلاعات از آپدیت
  const message = update.message;
  const callbackQuery = update.callback_query;
  const inlineQuery = update.inline_query;

  // اگر پیام متنی باشد
  if (message && message.text) {
    const chatId = message.chat.id;
    const text = message.text;
    const firstName = message.from.first_name || 'کاربر';

    // دریافت قیمت‌ها از API (هر بار درخواست جدید)
    const prices = await fetchPrices();

    if (text === '/start') {
      await sendMessage(API_KEY, chatId, `
سلام ${firstName} عزیز 😃
📶 به ربات نرخ لحظه‌ای طلا و ارز و... خوش آمدید
🌟 به وسیله این ربات میتونی از آخرین قیمت‌های دلار و ارزهای مختلف و کلی چیزای دیگه مطلع بشی
🎈 برای شروع کافیه از دکمه‌های زیر استفاده کنی
      `, {
        reply_markup: {
          keyboard: [
            [{ text: '💶 قیمت ارز' }],
            [{ text: '🏵 قیمت طلا' }, { text: '💰 قیمت سکه' }]
          ],
          resize_keyboard: true
        }
      });
    }
    else if (text === '💶 قیمت ارز') {
      const currencyText = buildCurrencyText(prices);
      await sendMessage(API_KEY, chatId, currencyText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌟 اشتراک', switch_inline_query: '' }]
          ]
        }
      });
    }
    else if (text === '🏵 قیمت طلا') {
      const goldText = buildGoldText(prices);
      await sendMessage(API_KEY, chatId, goldText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌟 اشتراک', switch_inline_query: '' }]
          ]
        }
      });
    }
    else if (text === '💰 قیمت سکه') {
      const coinText = buildCoinText(prices);
      await sendMessage(API_KEY, chatId, coinText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌟 اشتراک', switch_inline_query: '' }]
          ]
        }
      });
    }
    // سایر پیام‌ها را نادیده بگیرید
  }

  // اگر inline query باشد
  else if (inlineQuery) {
    const inlineQueryId = inlineQuery.id;
    const prices = await fetchPrices();
    const currencyText = buildCurrencyText(prices);
    const goldText = buildGoldText(prices);
    const coinText = buildCoinText(prices);

    const results = [
      {
        type: 'article',
        id: btoa(String(Math.random() * 1000)),
        thumb_url: 'https://tlgur.com/d/BgvOnAb4',
        title: 'ارسال نرخ ارز',
        description: 'ارسال نرخ ارز به این چت',
        input_message_content: {
          parse_mode: 'html',
          message_text: currencyText
        },
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔹 ورود به ربات', url: 'https://t.me/my_test_ro_bot' }],
            [{ text: '🌟 اشتراک', switch_inline_query: '' }]
          ]
        }
      },
      {
        type: 'article',
        id: btoa(String(Math.random() * 1000)),
        thumb_url: 'https://tlgur.com/d/BgvOnAb4',
        title: 'ارسال نرخ طلا',
        description: 'ارسال نرخ طلا به این چت',
        input_message_content: {
          parse_mode: 'html',
          message_text: goldText
        },
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔹 ورود به ربات', url: 'https://t.me/my_test_ro_bot' }],
            [{ text: '🌟 اشتراک', switch_inline_query: '' }]
          ]
        }
      },
      {
        type: 'article',
        id: btoa(String(Math.random() * 1000)),
        thumb_url: 'https://tlgur.com/d/BgvOnAb4',
        title: 'ارسال نرخ سکه',
        description: 'ارسال نرخ سکه به این چت',
        input_message_content: {
          parse_mode: 'html',
          message_text: coinText
        },
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔹 ورود به ربات', url: 'https://t.me/my_test_ro_bot' }],
            [{ text: '🌟 اشتراک', switch_inline_query: '' }]
          ]
        }
      }
    ];

    await answerInlineQuery(API_KEY, inlineQueryId, results);
  }

  // callback_query را در صورت نیاز می‌توانید پردازش کنید (فعلاً خالی)
  // else if (callbackQuery) { ... }
}

// ------------------------------------------------------------
// توابع کمکی برای دریافت قیمت‌ها از API
// ------------------------------------------------------------
async function fetchPrices() {
  const url = 'http://webservice.lorddeveloper.ir/arz/';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch prices: ${response.status}`);
  }
  const data = await response.json();
  return data;
}

// ------------------------------------------------------------
// توابع ساخت متن‌ها
// ------------------------------------------------------------
function buildCurrencyText(p) {
  const c = p.currency;
  return `💵 قیمت ارز های کشور های مختلف:
🇺🇸 دلار: ${c.dollar}
🇪🇺 یورو : ${c.euro}
🇬🇧 یوند : ${c.pound}
🇦🇪 درهم : ${c.AED}
🇯🇵 ین : ${c.yen}
🇹🇷 لیر ترکیه : ${c.turkish_lira}
🇨🇳 یوان چین : ${c.chinese_yuan}
🇨🇦 دلار کانادا : ${c.canadian_dollar}
🇦🇺 دلار استرلیا : ${c.australian_dollar}
🇳🇿 دلار نیوزلند :${c.newzealand_dollar}
🇸🇪 کرون سوئد : ${c.swedish_krona}
🇩🇰 کرون دانمارک : ${c.danish_krona}
🇳🇴 کرون نروژ : ${c.norwegian_krona}
🇰🇼 دینار کویت : ${c.kuwaiti_dinar}
🇸🇦 ریال عربستان : ${c.arabian_rial}
🇶🇦 ریال قطر : ${c.qatar_rial}
🇮🇶 دینار عراق : ${c.iraqi_dinar}
🇸🇾 لیر سوریه : ${c.syrian_lair}
🇮🇳 روپیه هندوستان : ${c.indian_rupee}
🇵🇰 روپیه پاکستان : ${c.pakistani_rupee}
🇧🇭 دینار بحرین : ${c.bahrain_dinar}
🇷🇺 روبل روسیه : ${c.russian_ruble}
🇦🇿 منات اذربایجان : ${c.azerbaijani_manat}
🇦🇲 درام ارمنستان : ${c.armenian_drama}
🇹🇭 بات تایلند : ${c.thai_baht}
🇭🇰 دلار هنگ کنگ : ${c.hongkong_dollar}`;
}

function buildGoldText(p) {
  return `💵 قیمت طلا: 
📍 یک انس طلا: ${p.gold.ounce}
📍 یک مثقال طلا: ${p.gold.gold}
📍 طلا 18 عیار: ${p.gold.gold_18}
📍 طلا 24 عیار: ${p.gold.gold_24}
📍 نقره: ${p.gold.silver}`;
}

function buildCoinText(p) {
  return `💵 قیمت سکه: 
📍 سکه بهار آزادی: ${p.coin.gold_coin}
📍 سکه امامی: ${p.coin.emami_coin}
📍 نیم سکه: ${p.coin.half_coin}
📍 ربع سکه: ${p.coin.quarter_coin}
📍 سکه گرمی: ${p.coin.gramme_coin}`;
}

// ------------------------------------------------------------
// توابع ارسال درخواست به API تلگرام
// ------------------------------------------------------------
async function sendMessage(apiKey, chatId, text, extra = {}) {
  const url = `https://api.telegram.org/bot${apiKey}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'html',
    ...extra
  };
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

async function answerInlineQuery(apiKey, inlineQueryId, results) {
  const url = `https://api.telegram.org/bot${apiKey}/answerInlineQuery`;
  const payload = {
    inline_query_id: inlineQueryId,
    results: results,
    cache_time: 0
  };
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}