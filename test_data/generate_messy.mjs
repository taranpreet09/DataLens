// Generates a deliberately dirty CSV with duplicates for DataLens quality demos.
// Run: node test_data/generate_messy.mjs
//
// Output: test_data/messy_retail_orders.csv
//
// Issues seeded into the file:
//   - 5 different date formats mixed in the same column
//   - Near-duplicate customer names (Smith / Smyth, Wilson / Wilsen, etc.)
//   - ~3% EXACT duplicate rows (every column identical) for hard dedup demo
//   - ~5% near-duplicate rows (same logical order, different formatting)
//   - Currency symbols and locales mixed inside numeric columns ($, USD, "1.299,00")
//   - Mixed-type column: shipping_days has integers, "9 days", "next day", "two weeks"
//   - PII (email + phone) for redaction demos
//   - Missing-value tokens: '', 'N/A', 'null', 'NULL', '#N/A', 'unknown', '-', '?'
//   - Case-variant categoricals: tokyo / Tokyo / TYO, germany / Germany / Deutschland / DE
//   - Discount stored as '15%', '15', '0.15', '15 percent'
//   - 4 deliberate header oddities? -> kept clean, parsing should still work

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'messy_retail_orders.csv');

// ---- CLI ----
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const ROWS = args.rows ? Number(args.rows) : 50_000; // small enough to upload, dirty enough to be useful

// ---- Deterministic PRNG ----
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(0xD15EA5E);

const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (lo, hi) => Math.floor(rand() * (hi - lo + 1)) + lo;
const round = (n, d = 2) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
const dateAdd = (b, days) => new Date(b.getTime() + days * 86400000);

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ---- Vocabularies ----
const FIRST = ['John','Jon','Jane','Mary','Maria','Mike','Michael','Sara','Sarah','Bob','Robert','Liz','Elizabeth','Will','William','Chris','Christopher','Kate','Katherine','Dave','David','Sam','Samuel','Pat','Patricia','Jen','Jennifer'];
const LAST  = ['Smith','Smyth','Johnson','Jonson','Brown','Browne','Davis','Davies','Wilson','Wilsen','Lee','Li','Patel','Pateel','Garcia','Garzia','Martinez','Martines','Anderson','Andersen'];
const STREETS = ['Main St','Oak Ave','Maple Dr','Pine Rd','Cedar Ln','Elm St','First Ave','Second St','Park Pl','Broadway','Market St','Mission Blvd'];
const CITY_VARIANTS = [
  ['New York','NYC','new york','New York City'],
  ['Los Angeles','LA','los angeles','L.A.'],
  ['San Francisco','SF','san francisco','S.F.'],
  ['Chicago','chicago','chi-town','CHI'],
  ['Mumbai','mumbai','Bombay','MUM'],
  ['London','london','LDN','Greater London'],
  ['Berlin','berlin','BER'],
  ['Tokyo','tokyo','TYO']
];
const COUNTRY_VARIANTS = [
  ['United States','USA','US','U.S.','U.S.A.','America','united states'],
  ['United Kingdom','UK','U.K.','Britain','GB','united kingdom'],
  ['India','IN','india','Bharat'],
  ['Germany','DE','germany','Deutschland'],
  ['Japan','JP','japan','Nippon'],
  ['Australia','AU','australia','AUS']
];
const CATEGORIES = ['Electronics','electronics','ELECTRONICS','Apparel','apparel','Clothing','clothes','Home','home goods','HOME','Books','books','Beauty','beauty','Sports','sports','Grocery','grocery'];
const PAYMENTS = ['Credit Card','credit card','CC','credit-card','Debit Card','debit','DEBIT','PayPal','paypal','pay-pal','Cash','cash','CASH','Apple Pay','applepay','apple_pay','Google Pay','gpay','google pay'];
const STATUS = ['shipped','Shipped','SHIPPED','delivered','Delivered','DELIVERED','pending','Pending','PENDING','cancelled','Cancelled','canceled','returned','Returned','refunded','Refunded'];
const MISSING = ['', 'N/A', 'n/a', 'NA', 'null', 'NULL', 'None', '-', '?', '#N/A', 'unknown'];
const NOTES = [
  'Loved the packaging! Will buy again.',
  'Item arrived damaged. Very disappointed.',
  'Fast shipping, exactly as described.',
  'Wrong size. Returning.',
  'Excellent quality for the price.',
  'Customer service was rude and unhelpful.',
  'Better than expected, highly recommend.',
  'Took forever to arrive. Frustrating experience.',
  'Smooth transaction, five stars.',
  'Good value, no complaints.',
  'Defective unit, refund requested.',
  'Perfect gift, recipient was thrilled.'
];

const HEADER = ['order_id','order_date','customer_name','customer_email','customer_phone','billing_address','city','country','product_category','product_name','quantity','unit_price','total_amount','discount_pct','payment_method','order_status','shipping_days','customer_notes'];

function buildRow(i) {
  // Customer
  const fnIdx = randInt(0, FIRST.length - 1);
  const lnIdx = randInt(0, LAST.length - 1);
  let firstName = FIRST[fnIdx];
  let lastName = LAST[lnIdx];
  const dupRoll = rand();
  if (dupRoll < 0.03) {
    firstName = FIRST[fnIdx % 2 === 0 ? fnIdx + 1 : fnIdx - 1] ?? firstName;
  } else if (dupRoll < 0.05) {
    firstName = firstName.toLowerCase();
    lastName = lastName.toLowerCase();
  } else if (dupRoll < 0.07) {
    firstName = firstName + ' '; // trailing whitespace dup
  }
  const fullName = `${firstName} ${lastName}`;

  // Date in one of 5 formats
  const baseDate = new Date('2024-01-01T00:00:00Z');
  const d = dateAdd(baseDate, randInt(0, 730));
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthsLong = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dateFormats = [
    d.toISOString().slice(0, 10),
    `${(d.getUTCMonth() + 1).toString().padStart(2,'0')}/${d.getUTCDate().toString().padStart(2,'0')}/${d.getUTCFullYear()}`,
    `${d.getUTCDate().toString().padStart(2,'0')}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`,
    `${monthsLong[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`,
    `${d.getUTCDate().toString().padStart(2,'0')}.${(d.getUTCMonth()+1).toString().padStart(2,'0')}.${d.getUTCFullYear()}`
  ];
  const orderDate = pick(dateFormats);

  // Email + phone (PII for redaction demo)
  const handle = `${firstName.trim().toLowerCase().replace(/\s+/g,'')}.${lastName.trim().toLowerCase()}${randInt(1, 999)}`;
  const domain = pick(['gmail.com','yahoo.com','hotmail.com','outlook.com','example.com','protonmail.com']);
  const email = rand() < 0.08 ? pick(MISSING) : `${handle}@${domain}`;

  const phoneFormats = [
    `+1-${randInt(200,999)}-${randInt(200,999)}-${randInt(1000,9999)}`,
    `(${randInt(200,999)}) ${randInt(200,999)}-${randInt(1000,9999)}`,
    `${randInt(200,999)}.${randInt(200,999)}.${randInt(1000,9999)}`,
    `${randInt(200,999)}${randInt(200,999)}${randInt(1000,9999)}`,
    `+44 20 ${randInt(1000,9999)} ${randInt(1000,9999)}`,
    `+91 ${randInt(70000,99999)} ${randInt(10000,99999)}`
  ];
  const phone = rand() < 0.06 ? pick(MISSING) : pick(phoneFormats);

  const billing = rand() < 0.04
    ? pick(MISSING)
    : `${randInt(1, 9999)} ${pick(STREETS)}${rand() < 0.3 ? `, Apt ${randInt(1, 500)}` : ''}`;

  const city = pick(pick(CITY_VARIANTS));
  const country = rand() < 0.03 ? pick(MISSING) : pick(pick(COUNTRY_VARIANTS));

  const category = pick(CATEGORIES);
  const productName = `${pick(['Premium','Pro','Lite','Plus','Basic','Deluxe','Eco','Smart'])} ${pick(['Widget','Gadget','Device','Kit','Bundle','Set','Pack','Edition'])} ${randInt(100, 999)}`;

  const quantity = randInt(1, 12);

  const priceVal = round(10 + Math.exp(2 + rand() * 4), 2);
  const priceFormats = [
    `$${priceVal.toFixed(2)}`,
    `$${priceVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    `${priceVal}`,
    `USD ${priceVal.toFixed(2)}`,
    `${priceVal.toFixed(2).replace('.', ',')}`,
    `${Math.round(priceVal)}`
  ];
  const unitPrice = rand() < 0.03 ? pick(MISSING) : pick(priceFormats);

  const correctTotal = round(priceVal * quantity * (1 - (rand() < 0.4 ? rand() * 0.3 : 0)), 2);
  const totalFormats = [
    `$${correctTotal.toFixed(2)}`,
    `${correctTotal}`,
    `USD ${correctTotal.toFixed(2)}`,
    correctTotal.toString()
  ];
  const totalAmount = rand() < 0.02 ? pick(MISSING) : pick(totalFormats);

  const discountVal = rand() < 0.5 ? 0 : round(rand() * 30, 1);
  const discountFormats = [
    `${discountVal}%`,
    `${discountVal}`,
    round(discountVal / 100, 3).toString(),
    `${discountVal} percent`
  ];
  const discountPct = rand() < 0.05 ? pick(MISSING) : pick(discountFormats);

  const paymentMethod = rand() < 0.02 ? pick(MISSING) : pick(PAYMENTS);
  const orderStatus = rand() < 0.02 ? pick(MISSING) : pick(STATUS);

  const shipNumeric = randInt(1, 21);
  const shipRoll = rand();
  let shippingDays;
  if (shipRoll < 0.7) shippingDays = shipNumeric;
  else if (shipRoll < 0.78) shippingDays = `${shipNumeric} days`;
  else if (shipRoll < 0.84) shippingDays = pick(['next day','same day','two weeks','overnight','express','standard']);
  else if (shipRoll < 0.9) shippingDays = pick(MISSING);
  else shippingDays = `${shipNumeric}d`;

  const notes = rand() < 0.6 ? pick(MISSING) : pick(NOTES);

  return [
    `ORD-${i.toString().padStart(8, '0')}`,
    orderDate, fullName, email, phone, billing,
    city, country, category, productName,
    quantity, unitPrice, totalAmount, discountPct,
    paymentMethod, orderStatus, shippingDays, notes
  ];
}

// Slight reshuffle: change order_id of a near-dup row but keep everything else.
function nearDuplicate(row) {
  const copy = row.slice();
  // change order_id and tweak one cosmetic field
  const newId = `ORD-${randInt(80_000_000, 99_999_999).toString().padStart(8,'0')}`;
  copy[0] = newId;
  // toggle date format on the same logical row
  // (keep the same printed value to mimic re-ingested duplicate)
  // tweak case of city
  if (typeof copy[6] === 'string' && copy[6].length > 0) {
    copy[6] = copy[6].toUpperCase();
  }
  return copy;
}

// ---- Stream out ----
async function main() {
  const stream = fs.createWriteStream(OUT, { encoding: 'utf8', highWaterMark: 1 << 20 });
  await new Promise((res) => stream.write(HEADER.join(',') + '\n', res));

  const exactDupRate = 0.03; // 3% exact duplicates
  const nearDupRate = 0.05;  // 5% near duplicates (same row, different order_id + city case)

  let buf = '';
  let written = 0;
  const flushEvery = 5000;

  // Keep a small ring buffer of recent rows so we can occasionally re-emit them verbatim.
  const recent = [];
  const recentMax = 200;

  for (let i = 0; i < ROWS; i++) {
    const row = buildRow(i);
    buf += row.map(csvCell).join(',') + '\n';
    written++;
    recent.push(row);
    if (recent.length > recentMax) recent.shift();

    // Inject exact duplicate
    if (rand() < exactDupRate && recent.length > 0) {
      const dup = recent[Math.floor(rand() * recent.length)];
      buf += dup.map(csvCell).join(',') + '\n';
      written++;
    }

    // Inject near duplicate (different order_id, otherwise same)
    if (rand() < nearDupRate && recent.length > 0) {
      const near = nearDuplicate(recent[Math.floor(rand() * recent.length)]);
      buf += near.map(csvCell).join(',') + '\n';
      written++;
    }

    if (i % flushEvery === flushEvery - 1) {
      if (!stream.write(buf)) await new Promise((r) => stream.once('drain', r));
      buf = '';
    }
  }

  if (buf.length) stream.write(buf);
  await new Promise((res) => stream.end(res));

  const stat = fs.statSync(OUT);
  console.log(`Wrote ${OUT}`);
  console.log(`  rows (incl. duplicates): ${written.toLocaleString()}`);
  console.log(`  base rows:               ${ROWS.toLocaleString()}`);
  console.log(`  approx exact duplicates: ~${Math.round(ROWS * exactDupRate).toLocaleString()}`);
  console.log(`  approx near duplicates:  ~${Math.round(ROWS * nearDupRate).toLocaleString()}`);
  console.log(`  size: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
