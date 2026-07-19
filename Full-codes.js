async function fetchPriceData() {
  const res = await fetch(PRICE_API_URL, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Cloudflare Worker' }
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error('Price API HTTP', res.status, errorText);
    throw new Error('خطا در دریافت اطلاعات از سرور');
  }
  const rawText = await res.text();
  console.log('Price API raw response:', rawText);
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    console.error('Price API invalid JSON:', rawText);
    throw new Error('فرمت پاسخ سرور نامعتبر است');
  }
  return data;
}

function extractItemsByType(data, typeKeyword) {
  let items = [];
  // معمولاً خروجی داخل data.data است (آرایه یا آبجکت)
  if (data && data.data) {
    if (Array.isArray(data.data)) {
      items = data.data;
    } else if (typeof data.data === 'object') {
      // ممکن است شامل آرایه‌های currencies/gold/coins باشد
      if (typeKeyword === 'currency' && Array.isArray(data.data.currencies)) {
        items = data.data.currencies;
      } else if (typeKeyword === 'gold' && Array.isArray(data.data.gold)) {
        items = data.data.gold;
      } else if (typeKeyword === 'coin' && Array.isArray(data.data.coins)) {
        items = data.data.coins;
      } else {
        // همه مقادیر آبجکت را یکجا بررسی کن
        items = Object.values(data.data).filter(v => typeof v === 'object' && v !== null && v.name && v.price);
      }
    }
  } else if (Array.isArray(data)) {
    items = data;
  } else if (typeof data === 'object') {
    items = Object.values(data).filter(v => typeof v === 'object' && v !== null && v.name && v.price);
  }

  // حالا بر اساس نام یا فیلد type فیلتر کن
  const keywords = {
    currency: ['ارز', 'دلار', 'یورو', 'پوند', 'درهم', 'لیر', 'currency'],
    gold: ['طلا', 'مثقال', 'انس', 'gold', 'عیار'],
    coin: ['سکه', 'تمام', 'نیم', 'ربع', 'coin', 'امامی']
  };

  const filtered = items.filter(item => {
    const name = (item.name || '').toLowerCase();
    const type = (item.type || item.group || '').toLowerCase();
    return keywords[typeKeyword].some(k => name.includes(k) || type.includes(k));
  });

  if (filtered.length > 0) return filtered;

  // اگر فیلتر جواب نداد (مثلاً API بدون فیلد type همه را برگردانده)،
  // همان کل items را برگردان (کاربر دستی انتخاب کرده)
  if (items.length > 0) return items;

  return [];
}

function formatCurrency(rawData) {
  const items = extractItemsByType(rawData, 'currency');
  if (items.length === 0) return '💶 اطلاعات ارز در دسترس نیست.';
  const lines = items.map(i => `${i.name}: ${i.price}`);
  return '💶 <b>قیمت ارز</b>\n\n' + lines.join('\n');
}

function formatGold(rawData) {
  const items = extractItemsByType(rawData, 'gold');
  if (items.length === 0) return '🏵 اطلاعات طلا در دسترس نیست.';
  const lines = items.map(i => `${i.name}: ${i.price}`);
  return '🏵 <b>قیمت طلا</b>\n\n' + lines.join('\n');
}

function formatCoin(rawData) {
  const items = extractItemsByType(rawData, 'coin');
  if (items.length === 0) return '💰 اطلاعات سکه در دسترس نیست.';
  const lines = items.map(i => `${i.name}: ${i.price}`);
  return '💰 <b>قیمت سکه</b>\n\n' + lines.join('\n');
}