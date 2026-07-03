/**
 * 奶油分帳 — Google 試算表後端
 *
 * 設定步驟：
 * 1. 建立一個新的 Google 試算表
 * 2. 試算表 → 擴充功能 → Apps Script
 * 3. 貼上此檔案全部內容，儲存
 * 4. 部署 → 新增部署作業 → 類型選「網頁應用程式」
 *    - 執行身分：我
 *    - 誰可以存取：任何人
 * 5. 複製「網頁應用程式」URL，貼到 index.html 的同步設定裡
 *
 * 試算表會自動建立兩個工作表：
 *   plans — 每個分帳計劃一列（JSON）
 *   rates — 全站共用匯率（一列）
 */

var PLANS_SHEET = 'plans';
var RATES_SHEET = 'rates';

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSs() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function ensureSheets() {
  var ss = getSs();
  var plans = ss.getSheetByName(PLANS_SHEET);
  if (!plans) {
    plans = ss.insertSheet(PLANS_SHEET);
    plans.appendRow(['plan_id', 'plan_name', 'updated_at', 'data']);
    plans.getRange(1, 1, 1, 4).setFontWeight('bold');
  }
  var rates = ss.getSheetByName(RATES_SHEET);
  if (!rates) {
    rates = ss.insertSheet(RATES_SHEET);
    rates.appendRow(['anchor', 'updated_at', 'source', 'values_json']);
    rates.getRange(1, 1, 1, 4).setFontWeight('bold');
    rates.appendRow(['TWD', '', '', '{"TWD":1}']);
  }
  return { plans: plans, rates: rates };
}

function doGet(e) {
  ensureSheets();
  var action = (e.parameter.action || '').toLowerCase();
  try {
    if (action === 'list') return jsonOut({ ok: true, plans: listPlans() });
    if (action === 'plan') return jsonOut({ ok: true, plan: getPlan(e.parameter.id) });
    if (action === 'rates') return jsonOut({ ok: true, rates: getRates() });
    return jsonOut({ ok: false, error: 'unknown action' });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  ensureSheets();
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ ok: false, error: 'invalid json' });
  }
  try {
    var action = (body.action || '').toLowerCase();
    if (action === 'saveplan') {
      savePlan(body.plan);
      return jsonOut({ ok: true });
    }
    if (action === 'deleteplan') {
      deletePlan(body.id);
      return jsonOut({ ok: true });
    }
    if (action === 'saverates') {
      saveRates(body.rates);
      return jsonOut({ ok: true });
    }
    return jsonOut({ ok: false, error: 'unknown action' });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function listPlans() {
  var sheet = ensureSheets().plans;
  var rows = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var id = rows[i][0];
    if (!id) continue;
    try {
      var plan = JSON.parse(rows[i][3]);
      out.push({
        id: plan.id,
        name: plan.name,
        emoji: plan.emoji,
        closed: !!plan.closed,
        createdAt: plan.createdAt,
        baseCurrency: plan.baseCurrency,
        updatedAt: plan.updatedAt || rows[i][2] || '',
        memberCount: (plan.members || []).length,
        expenseCount: (plan.expenses || []).length,
      });
    } catch (ignore) {}
  }
  out.sort(function(a, b) {
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
  return out;
}

function getPlan(id) {
  if (!id) return null;
  var sheet = ensureSheets().plans;
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      return JSON.parse(rows[i][3]);
    }
  }
  return null;
}

function savePlan(plan) {
  if (!plan || !plan.id) throw new Error('plan.id required');
  plan.updatedAt = plan.updatedAt || new Date().toISOString();
  var sheet = ensureSheets().plans;
  var rows = sheet.getDataRange().getValues();
  var json = JSON.stringify(plan);
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(plan.id)) {
      sheet.getRange(i + 1, 1, 1, 4).setValues([[plan.id, plan.name, plan.updatedAt, json]]);
      return;
    }
  }
  sheet.appendRow([plan.id, plan.name, plan.updatedAt, json]);
}

function deletePlan(id) {
  if (!id) throw new Error('id required');
  var sheet = ensureSheets().plans;
  var rows = sheet.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function getRates() {
  var sheet = ensureSheets().rates;
  var row = sheet.getRange(2, 1, 1, 4).getValues()[0];
  if (!row[0]) return { anchor: 'TWD', updatedAt: null, source: null, values: { TWD: 1 } };
  var values;
  try { values = JSON.parse(row[3]); } catch (e) { values = { TWD: 1 }; }
  return {
    anchor: row[0],
    updatedAt: row[1] || null,
    source: row[2] || null,
    values: values,
  };
}

function saveRates(rates) {
  if (!rates) throw new Error('rates required');
  var sheet = ensureSheets().rates;
  sheet.getRange(2, 1, 1, 4).setValues([[
    rates.anchor || 'TWD',
    rates.updatedAt || '',
    rates.source || '',
    JSON.stringify(rates.values || { TWD: 1 }),
  ]]);
}
