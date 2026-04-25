import 'dotenv/config';

const SERVICE_KEY = process.env.SERVICE_KEY;
const BASE = 'https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo';

if (!SERVICE_KEY) {
  throw new Error('SERVICE_KEY missing in .env');
}

async function call(params) {
  const qs = new URLSearchParams({
    serviceKey: SERVICE_KEY,
    resultType: 'json',
    ...params,
  });
  const url = `${BASE}?${qs.toString()}`;
  const res = await fetch(url);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error(`Non-JSON response: ${text.slice(0, 200)}`);
  }
  if (data?.response?.header?.resultCode !== '00') {
    throw new Error(`API error: ${data?.response?.header?.resultMsg || text.slice(0, 200)}`);
  }
  return data.response.body;
}

export async function fetchByIsin(isinCd, basDt) {
  const body = await call({
    isinCd,
    numOfRows: '1',
    pageNo: '1',
    ...(basDt ? { basDt } : {}),
  });
  const items = body?.items?.item;
  if (!items || items.length === 0) return null;
  return items[0];
}

export async function fetchRange(isinCd, beginBasDt, endBasDt, { numOfRows = 10000 } = {}) {
  const out = [];
  let pageNo = 1;
  while (true) {
    const body = await call({
      isinCd,
      beginBasDt,
      endBasDt,
      numOfRows: String(numOfRows),
      pageNo: String(pageNo),
    });
    const items = body?.items?.item || [];
    out.push(...items);
    const total = Number(body?.totalCount || 0);
    if (out.length >= total || items.length === 0) break;
    pageNo += 1;
  }
  return out;
}
