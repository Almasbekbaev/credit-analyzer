'use strict';

const $ = id => document.getElementById(id);
const form = $('inputForm');
const num = v => v === '' || v === null ? 0 : Number(v) || 0;
const val = name => form.elements[name] ? form.elements[name].value : '';
const nval = name => num(val(name));
const fmt = (v, digits = 2) => Number.isFinite(v) ? v.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
const fmt0 = v => Number.isFinite(v) ? Math.round(v).toLocaleString('ru-RU') : '—';
const fmtPct = (v, digits = 2) => Number.isFinite(v) ? fmt(v, digits) + ' %' : '—';
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const SEGMENTS = {
  micro: { name: 'Микро', liquidityWeight: 1.3, capitalWeight: 0.8, currentRatio: 1.5, autonomy: 0.4, debtEbitda: 3, pdAddon: 1.5 },
  small: { name: 'Малый', liquidityWeight: 1.3, capitalWeight: 0.8, currentRatio: 1.5, autonomy: 0.4, debtEbitda: 3, pdAddon: 0.75 },
  medium: { name: 'Средний', liquidityWeight: 1, capitalWeight: 1, currentRatio: 2, autonomy: 0.5, debtEbitda: 3, pdAddon: 0.5 },
  large: { name: 'Крупный', liquidityWeight: 0.8, capitalWeight: 1.2, currentRatio: 2, autonomy: 0.5, debtEbitda: 2.5, pdAddon: 0 }
};
const MASTER_SCALE = [
  { cls: 'AAA', min: 90, pd: 0.1, microAddon: 0, desc: 'Исключительная надёжность' },
  { cls: 'AA', min: 82, pd: 0.3, microAddon: 0.1, desc: 'Очень высокая надёжность' },
  { cls: 'A', min: 74, pd: 0.7, microAddon: 0.2, desc: 'Высокая надёжность' },
  { cls: 'BBB', min: 66, pd: 1.5, microAddon: 0.4, desc: 'Хорошая, инвестиционная' },
  { cls: 'BB', min: 58, pd: 3, microAddon: 0.8, desc: 'Удовлетворительная' },
  { cls: 'B', min: 50, pd: 6, microAddon: 1.5, desc: 'Ниже среднего, спекулятивная' },
  { cls: 'CCC', min: 40, pd: 12, microAddon: 2.5, desc: 'Существенный риск' },
  { cls: 'CC', min: 30, pd: 22, microAddon: 4, desc: 'Высокий риск дефолта' },
  { cls: 'C', min: 20, pd: 35, microAddon: 5, desc: 'Крайне высокий риск' },
  { cls: 'D', min: 0, pd: 60, microAddon: 0, desc: 'Дефолт/преддефолтное состояние' }
];
const ZONE = {
  investment: 'Инвестиционная зона',
  speculative: 'Спекулятивная зона',
  default: 'Дефолтная зона'
};
const BM_FIELDS = [
  ['currentRatio', 'Текущая ликвидность'], ['autonomy', 'Автономия'], ['ros', 'ROS, %'],
  ['debtEbitda', 'Долг/EBITDA'], ['dsoDays', 'Дебиторка, дни'], ['dscr', 'Типичный DSCR'], ['loanRate', 'Ставка, %']
];
const BENCHMARKS_FALLBACK = {
  meta: { updated: '2026-11-07', source: 'Экспертная калибровка на базе открытой статистики (Росстат, отраслевые обзоры).' },
  industries: [
    { id: 'production', name: 'Производство', riskClass: 'neutral', medians: { currentRatio: 1.6, autonomy: 0.42, ros: 8, debtEbitda: 2.4, dsoDays: 55, dscr: 1.4, loanRate: 19 } },
    { id: 'trade', name: 'Оптовая и розничная торговля', riskClass: 'neutral', medians: { currentRatio: 1.3, autonomy: 0.3, ros: 4.5, debtEbitda: 3, dsoDays: 35, dscr: 1.3, loanRate: 20 } },
    { id: 'construction', name: 'Строительство', riskClass: 'risky', medians: { currentRatio: 1.2, autonomy: 0.25, ros: 6, debtEbitda: 3.5, dsoDays: 75, dscr: 1.2, loanRate: 21 } },
    { id: 'transport', name: 'Транспорт и логистика', riskClass: 'neutral', medians: { currentRatio: 1.3, autonomy: 0.32, ros: 6.5, debtEbitda: 3, dsoDays: 45, dscr: 1.3, loanRate: 20 } },
    { id: 'it', name: 'IT и связь', riskClass: 'stable', medians: { currentRatio: 1.8, autonomy: 0.55, ros: 14, debtEbitda: 1.8, dsoDays: 40, dscr: 1.6, loanRate: 18 } },
    { id: 'agriculture', name: 'Сельское хозяйство', riskClass: 'neutral', medians: { currentRatio: 1.5, autonomy: 0.38, ros: 9, debtEbitda: 3.2, dsoDays: 50, dscr: 1.3, loanRate: 19.5 } },
    { id: 'services', name: 'Услуги', riskClass: 'stable', medians: { currentRatio: 1.5, autonomy: 0.45, ros: 10, debtEbitda: 2.2, dsoDays: 40, dscr: 1.4, loanRate: 19.5 } },
    { id: 'hospitality', name: 'Общепит и гостиницы', riskClass: 'risky', medians: { currentRatio: 1.1, autonomy: 0.28, ros: 5.5, debtEbitda: 3.2, dsoDays: 10, dscr: 1.2, loanRate: 21.5 } }
  ]
};
let benchmarks = BENCHMARKS_FALLBACK;
let news = { meta: {}, byIndustry: {} };
let analysis = null;
let activeProjectId = null;
let overrideCache = {};
let dataSource = 'local';

function classifySegment() {
  return val('industry') && ($('segmentOverride').value || (nval('revenue') / 1000 <= 120 ? 'micro' : nval('revenue') / 1000 <= 800 ? 'small' : nval('revenue') / 1000 <= 2000 ? 'medium' : 'large'));
}
function getIndustry() { return benchmarks.industries.find(i => i.id === val('industry')) || benchmarks.industries[0]; }
function getMedians() { return Object.assign({}, getIndustry().medians, overrideCache[val('industry')] || {}); }

function loanSchedule(amount, annualRate, months, type) {
  if (amount <= 0 || months <= 0) return [];
  const i = annualRate / 1200;
  let balance = amount;
  const result = [];
  const annuity = i ? amount * i * Math.pow(1 + i, months) / (Math.pow(1 + i, months) - 1) : amount / months;
  for (let m = 1; m <= months; m++) {
    const interest = balance * i;
    let principal = type === 'diff' ? amount / months : annuity - interest;
    if (m === months || principal > balance) principal = balance;
    const payment = principal + interest;
    balance = Math.max(0, balance - principal);
    result.push({ month: m, payment, interest, principal, balance });
  }
  return result;
}
function byYear(schedule, horizon) {
  return Array.from({ length: horizon }, (_, y) => {
    const payments = schedule.slice(y * 12, (y + 1) * 12);
    return payments.reduce((a, p) => ({ service: a.service + p.payment, interest: a.interest + p.interest, principal: a.principal + p.principal }), { service: 0, interest: 0, principal: 0 });
  });
}
function cashflows() { return Array.from({ length: nval('horizon') || 5 }, (_, i) => num(form.elements['cf' + i] && form.elements['cf' + i].value)); }
function npv(cfs, rate) { return cfs.reduce((sum, cf, i) => sum + cf / Math.pow(1 + rate, i), 0); }
function irr(cfs) {
  if (!cfs.some(x => x < 0) || !cfs.some(x => x > 0)) return null;
  let lo = -0.99, hi = 10, flo = npv(cfs, lo), fhi = npv(cfs, hi);
  if (flo * fhi > 0) return null;
  for (let k = 0; k < 150; k++) {
    const mid = (lo + hi) / 2, fm = npv(cfs, mid);
    if (flo * fm <= 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}
function payback(cfs, rate = 0) {
  let cum = cfs[0];
  if (cum >= 0) return 0;
  for (let i = 1; i < cfs.length; i++) {
    const cf = rate ? cfs[i] / Math.pow(1 + rate, i) : cfs[i];
    const prev = cum;
    cum += cf;
    if (cum >= 0) return i - 1 + (cf > 0 ? -prev / cf : 0);
  }
  return null;
}
function score(value, good, acceptable, higherBetter = true) {
  if (!Number.isFinite(value)) return 0;
  const split = higherBetter ? value >= good : value <= good;
  const mid = higherBetter ? value >= acceptable : value <= acceptable;
  return split ? 2 : mid ? 1 : 0;
}

function calculate() {
  const i = { loan: nval('loanAmount'), rate: nval('loanRate'), months: nval('loanTerm'), horizon: clamp(Math.round(nval('horizon') || 5), 3, 10), discount: nval('discountRate') / 100 };
  Object.assign(i, {
    cash: nval('cash'), rec: nval('receivables'), inv: nval('inventory'), other: nval('otherCurrent'), fixed: nval('fixedAssets'),
    short: nval('shortDebt'), long: nval('longDebt'), equity: nval('equity'), revenue: nval('revenue'), cogs: nval('cogs'), opex: nval('opex'),
    depr: nval('depreciation'), interest: nval('interestExpense'), net: nval('netIncome')
  });
  i.currentAssets = i.cash + i.rec + i.inv + i.other;
  i.assets = i.currentAssets + i.fixed;
  i.totalDebt = i.short + i.long;
  i.liabEquity = i.totalDebt + i.equity;
  i.segment = classifySegment() || 'medium';
  i.norms = SEGMENTS[i.segment];
  i.ebit = i.revenue - i.cogs - i.opex - i.depr;
  i.ebitda = i.ebit + i.depr;
  i.cfs = cashflows();
  i.schedule = loanSchedule(i.loan, i.rate, i.months, val('scheduleType'));
  i.yearlyDebt = byYear(i.schedule, i.horizon);
  i.dscr = i.yearlyDebt.map((d, y) => d.service > 0 ? { year: y + 1, cf: i.cfs[y] || 0, service: d.service, value: (i.cfs[y] || 0) / d.service } : null).filter(Boolean);
  const active = i.dscr.filter(d => Number.isFinite(d.value));
  i.dscrValues = active.map(d => ({ ...d, clipped: clamp(d.value, -1, 3) }));
  i.dscrAvg = active.length ? active.reduce((s, d) => s + clamp(d.value, -1, 3) * d.service, 0) / active.reduce((s, d) => s + d.service, 0) : null;
  i.dscrMin = active.length ? Math.min(...active.map(d => clamp(d.value, -1, 3))) : null;
  const projectCF = [-i.loan, ...i.cfs];
  i.npv = npv(projectCF, i.discount);
  i.irr = irr(projectCF);
  i.pi = i.loan > 0 ? (i.npv + i.loan) / i.loan : null;
  i.pbSimple = payback(projectCF);
  i.pbDiscount = payback(projectCF, i.discount);
  i.ratios = {
    currentRatio: i.short ? i.currentAssets / i.short : null,
    quickRatio: i.short ? (i.cash + i.rec) / i.short : null,
    absoluteRatio: i.short ? i.cash / i.short : null,
    autonomy: i.assets ? i.equity / i.assets : null,
    debtEquity: i.equity > 0 ? i.totalDebt / i.equity : null,
    ownWC: i.currentAssets ? (i.equity - i.fixed) / i.currentAssets : null,
    roa: i.assets ? i.net / i.assets * 100 : null,
    ros: i.revenue ? i.net / i.revenue * 100 : null,
    debtEbitda: i.ebitda > 0 ? (i.totalDebt + i.loan) / i.ebitda : null,
    interestCoverage: i.interest > 0 ? i.ebit / i.interest : null,
    dso: i.revenue > 0 ? i.rec / i.revenue * 365 : null
  };
  const r = i.ratios, n = i.norms;
  const factors = [
    { key: 'currentRatio', title: 'Текущая ликвидность', value: r.currentRatio, norm: `≥ ${n.currentRatio}`, weight: 10, points: score(r.currentRatio, n.currentRatio, n.currentRatio * 0.75), group: 'liquidity', fmt },
    { key: 'quickRatio', title: 'Быстрая ликвидность', value: r.quickRatio, norm: '≥ 1.0', weight: 7, points: score(r.quickRatio, i.segment === 'micro' || i.segment === 'small' ? 0.9 : 1, i.segment === 'micro' || i.segment === 'small' ? 0.6 : 0.7), group: 'liquidity', fmt },
    { key: 'absoluteRatio', title: 'Абсолютная ликвидность', value: r.absoluteRatio, norm: '≥ 0.2', weight: 4, points: score(r.absoluteRatio, 0.2, 0.1), group: 'liquidity', fmt },
    { key: 'autonomy', title: 'Коэффициент автономии', value: r.autonomy, norm: `≥ ${n.autonomy}`, weight: 10, points: score(r.autonomy, n.autonomy, n.autonomy - 0.1), group: 'capital', fmt },
    { key: 'debtEquity', title: 'Долг / собственный капитал', value: r.debtEquity, norm: '≤ 1.0', weight: 6, points: score(r.debtEquity, 1, 2, false), group: 'capital', fmt },
    { key: 'ownWC', title: 'Обеспеченность собственными оборотными средствами', value: r.ownWC, norm: '≥ 0.1', weight: 5, points: score(r.ownWC, 0.1, 0), group: 'capital', fmt },
    { key: 'roa', title: 'Рентабельность активов (ROA)', value: r.roa, norm: '≥ 8 %', weight: 7, points: score(r.roa, 8, 3), group: 'profitability', fmt: v => fmtPct(v) },
    { key: 'ros', title: 'Рентабельность продаж (ROS)', value: r.ros, norm: '≥ 10 %', weight: 7, points: score(r.ros, 10, 4), group: 'profitability', fmt: v => fmtPct(v) },
    { key: 'debtEbitda', title: 'Долг / EBITDA (с учётом кредита)', value: r.debtEbitda, norm: `≤ ${n.debtEbitda}`, weight: 12, points: score(r.debtEbitda, n.debtEbitda, n.debtEbitda + 1.5, false), group: 'debt', fmt },
    { key: 'interestCoverage', title: 'Покрытие процентов (EBIT / проценты)', value: r.interestCoverage, norm: '≥ 2.0', weight: 8, points: score(r.interestCoverage, 2, 1.2), group: 'debt', fmt },
    { key: 'dscrAvg', title: 'Средний взвешенный DSCR', value: i.dscrAvg, norm: '≥ 1.5', weight: 12, points: score(i.dscrAvg, 1.5, 1.1), group: 'debt', fmt },
    { key: 'dscrMin', title: 'Минимальный DSCR', value: i.dscrMin, norm: '≥ 1.2', weight: 8, points: score(i.dscrMin, 1.2, 1), group: 'debt', fmt },
    { key: 'npv', title: 'NPV проекта', value: i.npv, norm: '> 0 тыс. ₽', weight: 4, points: Number.isFinite(i.pi) && i.pi >= 1.2 ? 2 : i.npv > 0 ? 1 : 0, group: 'investment', fmt: fmt0 }
  ];
  let earned = 0, possible = 0;
  factors.forEach(f => {
    const mult = f.group === 'liquidity' ? n.liquidityWeight : f.group === 'capital' ? n.capitalWeight : 1;
    f.adjustedWeight = f.weight * mult;
    earned += f.points * f.adjustedWeight;
    possible += 2 * f.adjustedWeight;
  });
  i.factors = factors;
  i.score = Math.round(earned / possible * 100);
  i.rating = MASTER_SCALE.find(x => i.score >= x.min);
  const basePD = i.rating.pd;
  const addon = i.segment === 'micro' ? i.rating.microAddon : i.segment === 'small' ? i.rating.microAddon * 0.6 : i.segment === 'medium' ? Math.min(0.5, i.rating.microAddon) : 0;
  const industry = getIndustry(), industryMult = industry.riskClass === 'risky' ? 1.3 : industry.riskClass === 'stable' ? 0.9 : 1;
  const dscrMult = Number.isFinite(i.dscrAvg) ? (i.dscrAvg < 1 ? 1.5 : i.dscrAvg >= 1.5 ? 0.8 : 1) : 1;
  i.pd = clamp((basePD + addon) * industryMult * dscrMult, 0.05, 99);
  i.adjustments = [`Базовая PD рейтинга ${i.rating.cls}: ${fmt(basePD)} %`];
  if (addon) i.adjustments.push(`Сегмент «${i.norms.name}»: +${fmt(addon)} п.п.`);
  if (industryMult !== 1) i.adjustments.push(`Отрасль «${industry.name}»: × ${industryMult}`);
  if (dscrMult !== 1) i.adjustments.push(`Модификатор DSCR: × ${dscrMult}`);
  i.lgd = clamp(nval('lgd'), 0, 100) / 100;
  i.el = i.pd / 100 * i.lgd * i.loan;
  return i;
}

function render() {
  const a = analysis;
  const seg = SEGMENTS[a.segment];
  $('segmentBadge').textContent = seg.name;
  $('segmentBadge').className = 'badge ' + (a.segment === 'large' ? 'badge-good' : a.segment === 'medium' ? 'badge-neutral' : 'badge-warn');
  let cls = a.score >= 70 ? 'good' : a.score >= 50 ? 'warn' : 'bad';
  $('verdictCard').className = 'card verdict-card ' + cls;
  $('verdictScore').textContent = a.score;
  $('verdictText').textContent = a.score >= 70 ? 'Финансирование целесообразно' : a.score >= 50 ? 'Возможно при дополнительных условиях' : 'Финансирование не рекомендуется';
  $('verdictNote').textContent = a.score >= 70 ? 'Показатели соответствуют нормативам модели.' : a.score >= 50 ? 'Поручительства, ковенанты по DSCR, снижение суммы/срока. См. рекомендации.' : 'Существенные риски — см. рекомендации по снижению рисков.';
  const r = a.rating;
  $('ratingCard').className = 'card rating-card ' + (['AAA', 'AA', 'A', 'BBB'].includes(r.cls) ? 'investment' : r.cls === 'D' ? 'default' : 'speculative');
  $('ratingClass').textContent = r.cls;
  $('ratingPD').textContent = fmt(a.pd) + ' %';
  $('ratingZone').textContent = `${ZONE[['AAA', 'AA', 'A', 'BBB'].includes(r.cls) ? 'investment' : r.cls === 'D' ? 'default' : 'speculative']} · ${r.desc}`;
  $('ratingEL').textContent = `EL = PD × LGD × EAD = ${fmt0(a.el)} тыс. ₽ (LGD ${fmt0(a.lgd * 100)} %)`;
  $('ratingScale').innerHTML = `<div class="rating-marker" style="left:${a.score}%"></div>`;
  $('ratingAdjustments').innerHTML = a.adjustments.map(x => `<li>${esc(x)}</li>`).join('');

  $('ratiosTable').tBodies[0].innerHTML = a.factors.map(f => {
    const badge = f.points === 2 ? 'badge-good' : f.points === 1 ? 'badge-warn' : 'badge-bad';
    const label = !Number.isFinite(f.value) ? 'нет данных' : ['норма', 'приемлемо', 'высокий риск'][f.points];
    return `<tr><td>${f.title}</td><td>${f.fmt(f.value)}</td><td>${f.norm}</td><td><span class="badge ${badge}">${label}</span></td></tr>`;
  }).join('');
  $('dscrTable').tBodies[0].innerHTML = a.dscr.map(d => `<tr><td>${d.year}</td><td>${fmt0(d.cf)}</td><td>${fmt0(d.service)}</td><td><span class="badge ${d.value >= 1.2 ? 'badge-good' : d.value >= 1 ? 'badge-warn' : 'badge-bad'}">${fmt(d.value)}</span></td></tr>`).join('') || '<tr><td colspan="4">Нет данных по долговому обслуживанию</td></tr>';
  $('dscrChart').innerHTML = barChart(a.dscr.map(d => ({ label: 'Год ' + d.year, value: clamp(d.value, -1, 3), raw: fmt(d.value), color: d.value >= 1.2 ? '#1a7f4b' : d.value >= 1 ? '#c28a17' : '#b3231e' })), 1.2);

  const stats = [['NPV', fmt0(a.npv) + ' тыс. ₽'], ['IRR', a.irr === null ? '—' : fmt(a.irr * 100) + ' %'], ['PI, индекс доходности', fmt(a.pi)], ['Простой срок окупаемости', a.pbSimple === null ? 'Не окупается' : fmt(a.pbSimple) + ' лет'], ['Дисконтированный срок окупаемости', a.pbDiscount === null ? 'Не окупается' : fmt(a.pbDiscount) + ' лет']];
  $('investStats').innerHTML = stats.map(s => `<div class="stat"><div class="stat-value">${s[1]}</div><div class="stat-label">${s[0]}</div></div>`).join('');
  $('paymentTable').tBodies[0].innerHTML = a.schedule.map(p => `<tr><td>${p.month}</td><td>${fmt0(p.payment)}</td><td>${fmt0(p.interest)}</td><td>${fmt0(p.principal)}</td><td>${fmt0(p.balance)}</td></tr>`).join('') || '<tr><td colspan="5">Укажите параметры кредита</td></tr>';
  $('paymentChart').innerHTML = barChart(a.yearlyDebt.filter(y => y.service > 0).map((y, idx) => ({ label: 'Год ' + (idx + 1), value: y.service, raw: fmt0(y.service) + ' тыс. ₽', color: '#14539a' })));

  renderBenchmark(); renderNews(); renderConclusion(); renderRecommendations(); renderBalance();
  $('printTitle').textContent = `Кредитный анализ: ${val('projectName') || 'Проект'}`;
  $('printDate').textContent = `Дата анализа: ${val('analysisDate')} · Отрасль: ${getIndustry().name} · Сегмент: ${seg.name} · Вердикт: ${a.score}/100 · Рейтинг: ${r.cls} · PD: ${fmt(a.pd)} %`;
}

function barChart(rows, ref) {
  if (!rows.length) return '';
  const width = 650, h = 30, max = Math.max(...rows.map(r => r.value), ref || 0, 1), zero = ref ? 60 : 0;
  const neg = rows.some(r => r.value < 0), domainMax = max * 1.1, domainMin = neg ? -1 : 0;
  const x = v => 65 + (v - domainMin) / (domainMax - domainMin) * 510;
  let svg = `<svg viewBox="0 0 ${width} ${rows.length * h + 30}" role="img" aria-label="График показателей">`;
  rows.forEach((r, i) => {
    const y = i * h + 4;
    svg += `<text x="0" y="${y + 16}" font-size="12" fill="#5d6b7a">${r.label}</text><rect x="${Math.min(x(0), x(r.value))}" y="${y}" width="${Math.max(1, Math.abs(x(r.value) - x(0)))}" height="19" rx="4" fill="${r.color}"/><text x="${x(r.value) + 6}" y="${y + 15}" font-size="12" fill="#1c2733">${r.raw}</text>`;
  });
  if (ref) svg += `<line x1="${x(ref)}" x2="${x(ref)}" y1="0" y2="${rows.length * h}" stroke="#1c2733" stroke-dasharray="4,3"/><text x="${x(ref) + 4}" y="${rows.length * h + 20}" font-size="11" fill="#5d6b7a">целевой уровень ${fmt(ref)}</text>`;
  return svg + '</svg>';
}

function renderBenchmark() {
  const a = analysis, m = getMedians(), r = a.ratios;
  const rows = [
    ['Текущая ликвидность', r.currentRatio, m.currentRatio, fmt, true],
    ['Коэффициент автономии', r.autonomy, m.autonomy, fmt, true],
    ['Рентабельность продаж, %', r.ros, m.ros, fmt, true],
    ['Долг / EBITDA', r.debtEbitda, m.debtEbitda, fmt, false],
    ['Оборачиваемость дебиторки, дни', r.dso, m.dsoDays, v => fmt0(v), false],
    ['Средний DSCR', a.dscrAvg, m.dscr, fmt, true],
    ['Ставка по кредиту, %', a.rate, m.loanRate, fmt, false]
  ];
  let comments = [];
  $('benchmarkIndustry').textContent = '· ' + getIndustry().name;
  $('benchmarkTable').tBodies[0].innerHTML = rows.map(([label, value, median, formatter, up]) => {
    const dev = Number.isFinite(value) && median ? (value / median - 1) * 100 : null;
    const good = dev === null ? null : up ? dev >= 0 : dev <= 0;
    const near = dev !== null && Math.abs(dev) <= 10;
    if (dev !== null && !good && !near) comments.push(`${label}: показатель ниже отраслевой медианы на ${fmt0(Math.abs(dev))} % — признак слабой конкурентной позиции.`);
    return `<tr><td>${label}</td><td>${formatter(value)}</td><td>${formatter(median)}</td><td>${dev === null ? '—' : (dev > 0 ? '+' : '') + fmt0(dev) + ' %'}</td><td><span class="badge ${good ? 'badge-good' : near ? 'badge-warn' : 'badge-bad'}">${good ? 'лучше' : near ? 'в пределах нормы' : 'хуже'}</span></td></tr>`;
  }).join('');
  $('benchmarkSource').textContent = `Медианы: ${benchmarks.meta.source || 'справочник'}. Обновлено: ${benchmarks.meta.updated || '—'}. Можно переопределить в настройках рейтинга.`;
  $('benchmarkComment').innerHTML = comments.map(c => `<div class="concl-block warn">${esc(c)}</div>`).join('') || '<div class="concl-block good">По доступным показателям заёмщик не хуже отраслевой медианы (с учётом допуска 10 %).</div>';
}
function renderNews() {
  const items = news.byIndustry[val('industry')] || [];
  $('newsIndustry').textContent = '· ' + getIndustry().name;
  $('newsDate').textContent = `Данные на ${news.meta.updated || 'дату не указана'}.`;
  $('newsList').innerHTML = items.length ? items.slice(0, 10).map(n => {
    const safeURL = /^https?:\/\//i.test(n.link || '') ? n.link : '';
    return `<li><div class="news-title">${safeURL ? `<a href="${esc(safeURL)}" target="_blank" rel="noopener noreferrer">${esc(n.title)}</a>` : esc(n.title)}</div><div class="news-meta">${esc(n.date || '')} · ${esc(n.source || '')}</div></li>`;
  }).join('') : '<li><p class="muted">Нет свежих новостей. Используйте отраслевые показатели и обновите данные.</p></li>';
}
function renderConclusion() {
  const a = analysis, r = a.ratios;
  const c = (level, title, text) => ({ level, title, text });
  const blocks = [
    c(r.currentRatio >= a.norms.currentRatio ? 'good' : r.currentRatio >= a.norms.currentRatio * .75 ? 'warn' : 'bad', 'Ликвидность', `Текущая ликвидность: ${fmt(r.currentRatio)} при нормативе ≥ ${a.norms.currentRatio}. Быстрая: ${fmt(r.quickRatio)}, абсолютная: ${fmt(r.absoluteRatio)}.`),
    c(r.autonomy >= a.norms.autonomy ? 'good' : 'warn', 'Финансовая устойчивость', `Автономия: ${fmt(r.autonomy)} при нормативе ≥ ${a.norms.autonomy}. Долг/капитал: ${fmt(r.debtEquity)}. Сегментные веса применены для категории «${a.norms.name}».`),
    c(a.net < 0 || (r.ros !== null && r.ros < 0) ? 'bad' : r.ros >= 10 ? 'good' : 'warn', 'Рентабельность', `Чистая прибыль: ${fmt0(a.net)} тыс. ₽. ROA: ${fmtPct(r.roa)}, ROS: ${fmtPct(r.ros)}. EBITDA: ${fmt0(a.ebitda)} тыс. ₽.`),
    c(a.dscrMin >= 1.2 ? 'good' : a.dscrMin >= 1 ? 'warn' : 'bad', 'Долговое обслуживание', `Средний DSCR: ${fmt(a.dscrAvg)}, минимальный: ${fmt(a.dscrMin)}. Долг/EBITDA с учётом кредита: ${fmt(r.debtEbitda)} (норматив ≤ ${a.norms.debtEbitda}).`),
    c(a.npv > 0 && a.pbDiscount !== null ? 'good' : 'warn', 'Инвестиционная эффективность', `NPV: ${fmt0(a.npv)} тыс. ₽ при ставке ${fmt0(a.discount * 100)} %. IRR: ${a.irr === null ? 'не определяется' : fmt(a.irr * 100) + ' %'}. Дисконтированный срок окупаемости: ${a.pbDiscount === null ? 'не достигается в горизонте' : fmt(a.pbDiscount) + ' лет'}.`),
    c(a.pd < 3 ? 'good' : a.pd < 12 ? 'warn' : 'bad', 'Рейтинг и ожидаемые потери', `Скоринг: ${a.score}/100, рейтинг ${a.rating.cls}; итоговая PD ${fmt(a.pd)} %. EL: ${fmt0(a.el)} тыс. ₽. Оценка модельная и не заменяет решение кредитного комитета.`)
  ];
  if (a.assets && Math.abs(a.assets - a.liabEquity) / a.assets > .01) blocks.push(c('warn', 'Сходимость баланса', `Активы отличаются от обязательств и капитала на ${fmt0(a.assets - a.liabEquity)} тыс. ₽. Проверьте исходные данные.`));
  $('conclusion').innerHTML = blocks.map(b => `<div class="concl-block ${b.level}"><strong>${b.title}.</strong> ${b.text}</div>`).join('');
}
function renderBalance() {
  const a = analysis, box = $('balanceWarning');
  if (!a.assets && !a.liabEquity) { box.hidden = true; return; }
  const diff = a.assets - a.liabEquity, limit = Math.max(a.assets, a.liabEquity) * .01;
  box.hidden = false;
  box.classList.toggle('bad', Math.abs(diff) > limit);
  box.textContent = Math.abs(diff) <= limit ? `Баланс сходится. Активы: ${fmt0(a.assets)} тыс. ₽.` : `Баланс не сходится: активы ${fmt0(a.assets)} тыс. ₽; обязательства + капитал ${fmt0(a.liabEquity)} тыс. ₽. Расхождение: ${fmt0(diff)} тыс. ₽.`;
}

function recommendations(a) {
  const r = a.ratios, rec = [];
  const add = (severity, title, items) => rec.push({ severity, title, items: items.filter(Boolean) });
  if (r.currentRatio === null || r.currentRatio < a.norms.currentRatio) add(r.currentRatio !== null && r.currentRatio < 1 ? 'critical' : 'warning', 'Ликвидность и оборотный капитал', [
    'Установить ковенант по минимальной текущей ликвидности и ежемесячно контролировать отчётность.',
    r.rec > 0 ? `Ускорить взыскание дебиторской задолженности (${fmt0(a.rec)} тыс. ₽), ввести лимиты отсрочки платежа.` : '',
    'Заменить часть краткосрочных обязательств долгосрочным финансированием; сформировать резерв денежных средств.',
    'Ограничить дивиденды и вывод средств до восстановления нормативной ликвидности.'
  ]);
  if (r.autonomy === null || r.autonomy < a.norms.autonomy || (r.debtEquity !== null && r.debtEquity > 2)) add('warning', 'Структура капитала', [
    'Привлечь дополнительный вклад собственников или субординированный заём с отсрочкой погашения.',
    'Направлять прибыль на капитализацию; ограничить распределение прибыли до достижения норматива.',
    'При предоставлении кредита предусмотреть запрет на увеличение долговой нагрузки без согласования.'
  ]);
  if (a.dscrAvg === null || a.dscrMin < 1.2) {
    const safe = safeLoan(a);
    add(a.dscrMin !== null && a.dscrMin < 1 ? 'critical' : 'warning', 'Долговая нагрузка и DSCR', [
      a.dscrMin === null ? 'Заполнить денежный поток и параметры кредита для проверки способности обслуживать долг.' : '',
      Number.isFinite(safe) && safe < a.loan ? `Рассмотреть снижение суммы кредита до ${fmt0(safe)} тыс. ₽ — оценочный ориентир для DSCR ≥ 1.2 в слабом году.` : '',
      'Увеличить срок кредита или предусмотреть льготный период по основному долгу в первые годы с низким DSCR.',
      'Установить ковенант DSCR ≥ 1.2 с ограничением новых займов и распределения прибыли при нарушении.',
      'Предусмотреть резервный счёт для покрытия долговых платежей на 3–6 месяцев. Увеличение срока повышает суммарные проценты.'
    ]);
  }
  if (a.net < 0 || (r.ros !== null && r.ros < 4) || (r.interestCoverage !== null && r.interestCoverage < 2)) add(a.net < 0 ? 'critical' : 'warning', 'Прибыльность и операционный риск', [
    'Запросить план повышения маржинальности: пересмотр цен, себестоимости и неэффективных расходов.',
    'Провести стресс-тест снижения выручки на 20 % и увеличения ставки на 3 п.п. до принятия решения.',
    'Обеспечить ежемесячный мониторинг управленческой отчётности и отклонений от бюджета.'
  ]);
  if (a.npv <= 0 || a.irr === null || a.irr < a.discount || a.pbDiscount === null) add(a.npv < 0 ? 'critical' : 'warning', 'Экономика проекта', [
    'Пересмотреть объём инвестиций, доходы и расходы: проект может не создавать стоимость при заданной ставке дисконтирования.',
    'Подтвердить прогноз договорами/предварительными заказами и независимой сметой.',
    'Разделить финансирование на транши с достижением проверяемых операционных и финансовых показателей.'
  ]);
  if (Math.abs(a.assets - a.liabEquity) > Math.max(a.assets, a.liabEquity) * .01 || ['cash', 'rec', 'equity', 'revenue', 'depr', 'net'].some(k => a[k] === 0 && val(k === 'rec' ? 'receivables' : k) === '')) add('info', 'Качество исходных данных', [
    'Проверить сходимость баланса и заполнить недостающие показатели; отсутствующие данные получают 0 баллов в скоринге.',
    'Сверить управленческую отчётность с бухгалтерской и налоговой отчётностью, банковскими выписками.',
    (a.segment === 'micro' || a.segment === 'small') ? 'Для микро-/малого бизнеса запросить дополнительные подтверждения выручки и оборотов — типична менее надёжная отчётность.' : ''
  ]);
  if (a.score < 70 || a.pd >= 3 || getIndustry().riskClass === 'risky') add('info', 'Условия структурирования и мониторинга', [
    'Рассмотреть поручительства собственников/основных компаний группы и залог ликвидных активов.',
    `Отраслевой риск (${getIndustry().name}): проводить мониторинг спроса, контрактов и отраслевых новостей; новости в скоринг не включены.`,
    'Предусмотреть финансовые ковенанты, целевое использование средств, регулярную отчётность и право досрочного отзыва при существенном ухудшении.',
    'Оценить страхование имущества/бизнес-рисков там, где это применимо. Стоимость обеспечения и страхования учесть в экономике проекта отдельно.'
  ]);
  if (!rec.length) add('ok', 'Остаточные меры контроля', ['Все ключевые показатели соответствуют нормативам модели. Сохранить ежеквартальный мониторинг DSCR, ликвидности и автономии.', 'Провести стресс-тест сценариев и проверить концентрацию клиентов/поставщиков до выдачи.']);
  return rec;
}
function safeLoan(a) {
  if (!a.dscr.length || a.loan <= 0) return null;
  const unit = loanSchedule(1, a.rate, a.months, val('scheduleType')), years = byYear(unit, a.horizon);
  let max = Infinity;
  a.dscr.forEach((d, k) => { if (years[k] && years[k].service > 0 && d.cf > 0) max = Math.min(max, d.cf / (1.2 * years[k].service)); });
  return Number.isFinite(max) ? Math.max(0, max * 0.97) : null;
}
function renderRecommendations() {
  $('recommendations').innerHTML = recommendations(analysis).map((r, i) => `<div class="rec-block ${r.severity}"><div class="rec-title">${i + 1}. ${r.title}</div><ul class="rec-list">${r.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('');
}

function getProjects() { try { return JSON.parse(localStorage.getItem('creditAnalyzerProjects') || '[]'); } catch (_) { return []; } }
function formData() { const data = {}; [...form.elements].filter(e => e.name).forEach(e => { data[e.name] = e.type === 'radio' ? (e.checked ? e.value : undefined) : e.value; }); return JSON.parse(JSON.stringify(data)); }
function fillForm(data) {
  [...form.elements].filter(e => e.name).forEach(e => { if (data[e.name] === undefined) return; if (e.type === 'radio') e.checked = e.value === data[e.name]; else e.value = data[e.name]; });
  renderCFInputs(data); $('segmentOverride').value = data._segmentOverride || ''; calculateAndRender();
}
function saveProject() {
  if (!analysis) return;
  const list = getProjects().filter(p => p.id !== activeProjectId);
  if (!activeProjectId) activeProjectId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  list.unshift({ id: activeProjectId, name: val('projectName') || 'Проект без названия', date: val('analysisDate'), score: analysis.score, rating: analysis.rating.cls, data: Object.assign(formData(), { _segmentOverride: $('segmentOverride').value }) });
  try { localStorage.setItem('creditAnalyzerProjects', JSON.stringify(list.slice(0, 100))); }
  catch (_) { activeProjectId = null; alert('Не удалось сохранить проект: недостаточно места в хранилище браузера.'); }
  renderProjects();
}
function renderProjects() {
  const list = getProjects();
  $('savedList').innerHTML = list.length ? list.map(p => `<div class="saved-item"><span class="saved-name">${esc(p.name)}</span><span class="saved-meta">${esc(p.date || 'без даты')} · ${p.score}/100 · ${esc(p.rating)}</span><button type="button" class="btn btn-ghost btn-small" data-open="${p.id}">Открыть</button><button type="button" class="btn btn-danger btn-small" data-delete="${p.id}" aria-label="Удалить проект">Удалить</button></div>`).join('') : '<p class="muted">Нет сохранённых проектов. Проект автоматически сохраняется после расчёта.</p>';
}
function renderCFInputs(data) {
  const h = clamp(Math.round(nval('horizon') || 5), 3, 10);
  $('cashflowInputs').innerHTML = Array.from({ length: h }, (_, i) => `<label class="field"><span class="field-label">Год ${i + 1}</span><input type="number" name="cf${i}" step="1" value="${data ? esc(data['cf' + i] || '') : esc(form.elements['cf' + i] ? form.elements['cf' + i].value : '')}"></label>`).join('');
}
function renderOverrides() {
  overrideCache = {};
  try { overrideCache = JSON.parse(localStorage.getItem('creditAnalyzerOverrides') || '{}'); } catch (_) {}
  const m = Object.assign({}, getIndustry().medians);
  $('benchmarkOverrides').innerHTML = BM_FIELDS.map(([key, label]) => `<label class="field"><span class="field-label">${label}</span><input type="number" step="0.01" data-override="${key}" placeholder="${m[key]}" value="${overrideCache[val('industry')] && overrideCache[val('industry')][key] !== undefined ? overrideCache[val('industry')][key] : ''}"></label>`).join('');
}
function calculateAndRender() {
  const hasData = ['loanAmount', 'revenue', 'cash', 'fixedAssets', 'equity'].some(name => val(name) !== '');
  $('resultsContent').hidden = !hasData;
  $('emptyState').hidden = hasData;
  if (!hasData) { analysis = null; return; }
  analysis = calculate(); render(); saveProject();
}
function resetForm() { form.reset(); activeProjectId = null; renderCFInputs(); $('segmentOverride').value = ''; calculateAndRender(); }

form.addEventListener('input', e => {
  if (e.target.name === 'horizon') renderCFInputs();
  if (e.target.name === 'industry') renderOverrides();
  calculateAndRender();
});
form.addEventListener('change', calculateAndRender);
$('segmentOverride').addEventListener('change', calculateAndRender);
$('benchmarkOverrides').addEventListener('input', e => {
  if (!e.target.dataset.override) return;
  const obj = overrideCache[val('industry')] || {};
  if (e.target.value === '') delete obj[e.target.dataset.override]; else obj[e.target.dataset.override] = Number(e.target.value);
  overrideCache[val('industry')] = obj;
  try { localStorage.setItem('creditAnalyzerOverrides', JSON.stringify(overrideCache)); } catch (_) {}
  calculateAndRender();
});
$('savedList').addEventListener('click', e => {
  const open = e.target.dataset.open, del = e.target.dataset.delete, list = getProjects();
  if (open) { const p = list.find(x => x.id === open); if (p) { activeProjectId = p.id; fillForm(p.data); renderOverrides(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }
  if (del) {
    if (activeProjectId === del) activeProjectId = null;
    const next = list.filter(p => p.id !== del);
    try { localStorage.setItem('creditAnalyzerProjects', JSON.stringify(next)); } catch (_) {}
    renderProjects();
  }
});
$('btnNew').addEventListener('click', resetForm);
$('btnPrint').addEventListener('click', () => { if (!analysis) { alert('Сначала заполните данные для расчёта.'); return; } window.print(); });
$('btnDemo').addEventListener('click', () => {
  resetForm();
  fillForm({ projectName: 'Производственная компания — модернизация', industry: 'production', analysisDate: '2026-11-07', horizon: '5', discountRate: '22', loanAmount: '15000', loanRate: '19', loanTerm: '60', scheduleType: 'annuity', cash: '3500', receivables: '7800', inventory: '9200', otherCurrent: '500', fixedAssets: '32000', shortDebt: '10500', longDebt: '9000', equity: '33500', revenue: '52000', cogs: '31500', opex: '6500', depreciation: '2400', interestExpense: '1500', netIncome: '6900', cf0: '5500', cf1: '7000', cf2: '7800', cf3: '8400', cf4: '9000', lgd: '45', _segmentOverride: 'large' });
  renderOverrides();
});
document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(t => { t.classList.toggle('active', t === btn); t.setAttribute('aria-selected', t === btn); });
  document.querySelectorAll('.tab-panel').forEach(p => { p.hidden = p.id !== btn.dataset.tab; });
}));
document.querySelector('.tabs').addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const tabs = [...document.querySelectorAll('.tab')], i = tabs.indexOf(document.activeElement);
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus(); tabs[next].click();
});

async function loadData() {
  $('dataFreshness').textContent = `Встроенные бенчмарки на ${benchmarks.meta.updated}.`;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  try {
    const b = await fetch('data/benchmarks.json', { cache: 'no-store' });
    if (b.ok) { const data = await b.json(); if (Array.isArray(data.industries) && data.industries.length) benchmarks = data; }
    const n = await fetch('data/news.json', { cache: 'no-store' });
    if (n.ok) news = await n.json();
    dataSource = 'fresh';
  } catch (_) {}
  $('dataFreshness').textContent = `${dataSource === 'fresh' ? 'Справочник загружен' : 'Встроенные значения (при недоступности JSON)'}; обновлено ${benchmarks.meta.updated || '—'}. Ключевая ставка ЦБ РФ: ${benchmarks.meta.cbrKeyRate ? benchmarks.meta.cbrKeyRate + ' % на ' + benchmarks.meta.cbrKeyRateDate : 'нет данных'}.`;
  populateIndustries(); renderOverrides(); renderProjects();
  if (!getProjects().length) $('btnDemo').click();
  else { const recent = getProjects()[0]; activeProjectId = recent.id; fillForm(recent.data); renderOverrides(); }
}
function populateIndustries() {
  const previous = val('industry') || 'production';
  form.elements.industry.innerHTML = benchmarks.industries.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('');
  form.elements.industry.value = benchmarks.industries.some(i => i.id === previous) ? previous : benchmarks.industries[0].id;
}
populateIndustries();
form.elements.analysisDate.value = new Date().toISOString().slice(0, 10);
renderCFInputs(); renderProjects(); renderOverrides(); calculateAndRender(); loadData();
