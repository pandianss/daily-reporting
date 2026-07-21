/**
 * IOB Daily Performance Reporting Portal - Apps Script Backend (hardened)
 *
 * Security model:
 *  - All requests are POST with a JSON body. GET returns an error (no credentials in URLs).
 *  - Passwords are stored as salted SHA-256 hashes (PassHash + Salt columns), never plaintext.
 *    Legacy plaintext passwords in the "Password" column are migrated automatically on each
 *    user's next successful login (or all at once via migrateAllPasswords()), then cleared.
 *  - Login issues a random session token (CacheService, 6h TTL). Every other action requires
 *    the token; identity, role and branch scope come from the server-side session, never from
 *    client-supplied fields.
 *  - Admin actions require a session whose role is Admin. There is NO shared passcode.
 *  - Login is rate-limited: 5 failed attempts locks the roll number for 15 minutes.
 *
 * First-time setup after deploying this version:
 *  1. Run migrateAllPasswords() once from the editor (hashes every legacy password, flags
 *     everyone except Admin for a forced change; the Admin is also flagged because the old
 *     password was exposed).
 *  2. Log into the portal as ADMIN with the old password; you will be forced to set a new one.
 *  3. Redeploy the web app (Deploy > Manage deployments > Edit > New version).
 */

const SESSION_TTL_SECONDS = 21600;      // 6 hours
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 900;            // 15 minutes
const MIN_PASSWORD_LENGTH = 8;
const SUBMISSIONS_SCAN_WINDOW = 5000;   // newest rows scanned for dashboards/upserts
const STATIC_CACHE_SECONDS = 300;       // Branches / RoleParameterMap cache

const GLOBAL_ROLES = ["RO SRM", "CHIEF MANAGER", "ADMIN"];
const MANAGEMENT_ROLES = ["RO SRM", "CHIEF MANAGER", "ADMIN", "RO GUARDIAN"];
const ENTRY_ROLES = ["1ST LINE", "2ND LINE", "RO GUARDIAN", "LBO", "PO"];

// ---------------------------------------------------------------- Routing

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === "login") return login(data);
    if (action === "changePassword") return changePassword(data);

    // Everything below requires a valid session
    const session = getSession(data.token);
    if (!session) return errorResponse("Session expired or invalid. Please log in again.", "AUTH");

    if (action === "logout") return logout(data.token);
    if (action === "getDashboardData") return getDashboardData(session, data.dateFilter, data.solCodeFilter);
    if (action === "submitReport") return submitReport(session, data);

    // Admin-only actions
    if (["uploadBaseTargets", "uploadMasterData", "saveRoleParamMapping", "saveTickerMessage", "resetUserPassword"].includes(action)) {
      if (String(session.role).trim().toUpperCase() !== "ADMIN") {
        return errorResponse("This action requires an Admin login.", "FORBIDDEN");
      }
      if (action === "uploadBaseTargets") return uploadBaseTargets(data.date, data.rows);
      if (action === "uploadMasterData") return uploadMasterData(data.branches, data.users);
      if (action === "saveRoleParamMapping") return saveRoleParamMapping(data.mapping);
      if (action === "saveTickerMessage") return saveTickerMessage(data.message);
      if (action === "resetUserPassword") return resetUserPassword(data.targetRollNumber);
    }

    return errorResponse("Invalid action");
  } catch (err) {
    return errorResponse(err.toString());
  }
}

function doGet(e) {
  // Credentials and tokens must never travel in URLs; the frontend uses POST for everything.
  return errorResponse("This API accepts POST requests only.");
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message, errorCode) {
  const payload = { success: false, error: message };
  if (errorCode) payload.errorCode = errorCode; // "AUTH" => client forces re-login
  return jsonResponse(payload);
}

// ---------------------------------------------------------------- Password hashing

function hashPassword(password, salt) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + ":" + password,
    Utilities.Charset.UTF_8
  );
  return digest.map(function (b) { return ((b & 0xff) + 0x100).toString(16).slice(1); }).join("");
}

function newSalt() {
  return Utilities.getUuid();
}

// Users sheet helpers. Expected headers: Roll Number, Name, Role, Assigned SOLs,
// Password (legacy, cleared on migration), PassHash, Salt, MustChange
function getUsersSheetInfo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Users");
  if (!sheet) throw new Error("'Users' sheet missing.");

  let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  ["PassHash", "Salt", "MustChange"].forEach(function (col) {
    if (headers.indexOf(col) === -1) {
      sheet.getRange(1, headers.length + 1).setValue(col);
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }
  });

  return {
    sheet: sheet,
    headers: headers,
    col: {
      roll: headers.indexOf("Roll Number"),
      name: headers.indexOf("Name"),
      role: headers.indexOf("Role"),
      sols: headers.indexOf("Assigned SOLs"),
      legacyPass: headers.indexOf("Password"),
      hash: headers.indexOf("PassHash"),
      salt: headers.indexOf("Salt"),
      mustChange: headers.indexOf("MustChange")
    }
  };
}

function findUserRow(info, rollNumber) {
  const data = info.sheet.getDataRange().getValues();
  const target = String(rollNumber).trim().toUpperCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][info.col.roll]).trim().toUpperCase() === target) {
      return { rowIndex: i + 1, row: data[i] };
    }
  }
  return null;
}

// Verifies a password against the hashed columns, falling back to the legacy plaintext
// column for not-yet-migrated users. Returns { ok, usedLegacy, usedDefault }.
function verifyPassword(info, userRow, enteredPassword) {
  const row = userRow.row;
  const storedHash = String(row[info.col.hash] || "").trim();
  const storedSalt = String(row[info.col.salt] || "").trim();
  const defaultPassword = String(row[info.col.roll]).trim(); // default = roll number

  if (storedHash && storedSalt) {
    return {
      ok: hashPassword(enteredPassword, storedSalt) === storedHash,
      usedLegacy: false,
      usedDefault: enteredPassword === defaultPassword
    };
  }

  // Legacy path: plaintext column (or roll-number default when the cell is blank)
  const legacy = info.col.legacyPass !== -1 ? String(row[info.col.legacyPass] || "").trim() : "";
  const expected = legacy || defaultPassword;
  return {
    ok: enteredPassword === expected,
    usedLegacy: true,
    usedDefault: enteredPassword === defaultPassword
  };
}

// Writes a new salted hash for the user and clears any legacy plaintext cell.
function storePassword(info, rowIndex, password, mustChange) {
  const salt = newSalt();
  info.sheet.getRange(rowIndex, info.col.hash + 1).setValue(hashPassword(password, salt));
  info.sheet.getRange(rowIndex, info.col.salt + 1).setValue(salt);
  info.sheet.getRange(rowIndex, info.col.mustChange + 1).setValue(mustChange ? 1 : 0);
  if (info.col.legacyPass !== -1) {
    info.sheet.getRange(rowIndex, info.col.legacyPass + 1).setValue("");
  }
}

/**
 * One-time migration: hash every legacy plaintext password (or the roll-number default),
 * clear the plaintext column, and flag every account for a forced password change.
 * Run manually from the Apps Script editor after deploying this version.
 */
function migrateAllPasswords() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const info = getUsersSheetInfo();
    const data = info.sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const alreadyHashed = String(data[i][info.col.hash] || "").trim() !== "";
      if (alreadyHashed) continue;
      const roll = String(data[i][info.col.roll]).trim();
      if (!roll) continue;
      const legacy = info.col.legacyPass !== -1 ? String(data[i][info.col.legacyPass] || "").trim() : "";
      // Every legacy password is treated as compromised: keep it working for one more
      // login, but force a change (MustChange=1) for everyone, including Admin.
      storePassword(info, i + 1, legacy || roll, true);
    }
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------- Sessions

function createSession(userRecord) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put("sess_" + token, JSON.stringify(userRecord), SESSION_TTL_SECONDS);
  return token;
}

function getSession(token) {
  if (!token) return null;
  const cache = CacheService.getScriptCache();
  const raw = cache.get("sess_" + token);
  if (!raw) return null;
  cache.put("sess_" + token, raw, SESSION_TTL_SECONDS); // sliding expiry
  return JSON.parse(raw);
}

function logout(token) {
  if (token) CacheService.getScriptCache().remove("sess_" + token);
  return jsonResponse({ success: true });
}

// ---------------------------------------------------------------- Login

function login(data) {
  const rollNumber = String(data.rollNumber || "").trim();
  const password = String(data.password || "");
  if (!rollNumber || !password) return errorResponse("Roll number and password are required.");

  // Rate limiting per roll number
  const cache = CacheService.getScriptCache();
  const failKey = "fail_" + rollNumber.toUpperCase();
  const failures = Number(cache.get(failKey) || 0);
  if (failures >= MAX_LOGIN_ATTEMPTS) {
    return errorResponse("Too many failed attempts. This account is locked for 15 minutes.");
  }

  const info = getUsersSheetInfo();
  const userRow = findUserRow(info, rollNumber);
  if (!userRow) {
    cache.put(failKey, String(failures + 1), LOCKOUT_SECONDS);
    return errorResponse("Invalid roll number or password.");
  }

  const check = verifyPassword(info, userRow, password);
  if (!check.ok) {
    cache.put(failKey, String(failures + 1), LOCKOUT_SECONDS);
    return errorResponse("Invalid roll number or password.");
  }
  cache.remove(failKey);

  // Migrate legacy plaintext to a hash transparently on successful login
  if (check.usedLegacy) {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      storePassword(info, userRow.rowIndex, password, true); // legacy passwords were exposed: force a change
    } finally {
      lock.releaseLock();
    }
  }

  const mustChange = check.usedLegacy || check.usedDefault ||
    Number(userRow.row[info.col.mustChange] || 0) === 1;

  const userRecord = buildUserRecord(info, userRow);

  if (mustChange) {
    // No session until the password is changed; changePassword() issues the token.
    return jsonResponse({ success: true, mustChangePassword: true, user: userRecord });
  }

  const token = createSession(userRecord);
  return jsonResponse({ success: true, token: token, user: userRecord, mustChangePassword: false });
}

function buildUserRecord(info, userRow) {
  const row = userRow.row;
  const record = {
    rollNumber: String(row[info.col.roll]).trim(),
    name: row[info.col.name],
    role: row[info.col.role],
    assignedSols: String(row[info.col.sols] || "").split(",").map(function (s) { return s.trim(); }).filter(String)
  };
  record.branches = resolveUserBranches(record);
  return record;
}

function resolveUserBranches(userRecord) {
  const branches = getAllBranches();
  const normRole = String(userRecord.role).trim().toUpperCase();
  const isGlobal = GLOBAL_ROLES.includes(normRole) || userRecord.assignedSols.includes("*");
  return branches.filter(function (br) {
    return isGlobal ||
      (normRole === "RO GUARDIAN" && br.roGuardianRoll === userRecord.rollNumber) ||
      userRecord.assignedSols.includes(br.solCode);
  });
}

// ---------------------------------------------------------------- Password change / reset

function changePassword(data) {
  const rollNumber = String(data.rollNumber || "").trim();
  const oldPassword = String(data.oldPassword || "");
  const newPassword = String(data.newPassword || "");

  if (!rollNumber || !oldPassword) return errorResponse("Current password is required.");
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return errorResponse("Password must be at least " + MIN_PASSWORD_LENGTH + " characters long.");
  }
  if (newPassword === rollNumber) return errorResponse("New password cannot be your roll number.");

  const info = getUsersSheetInfo();
  const userRow = findUserRow(info, rollNumber);
  if (!userRow) return errorResponse("User not found.");

  const check = verifyPassword(info, userRow, oldPassword);
  if (!check.ok) return errorResponse("Current password is incorrect.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    storePassword(info, userRow.rowIndex, newPassword, false);
  } finally {
    lock.releaseLock();
  }
  CacheService.getScriptCache().remove("fail_" + rollNumber.toUpperCase());

  // Log the user straight in with their new password
  const userRecord = buildUserRecord(info, userRow);
  const token = createSession(userRecord);
  return jsonResponse({ success: true, token: token, user: userRecord });
}

function resetUserPassword(targetRollNumber) {
  const target = String(targetRollNumber || "").trim();
  if (!target) return errorResponse("Target roll number is required.");

  const info = getUsersSheetInfo();
  const userRow = findUserRow(info, target);
  if (!userRow) return errorResponse("User not found.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // Reset to the roll-number default and force a change on next login
    storePassword(info, userRow.rowIndex, String(userRow.row[info.col.roll]).trim(), true);
  } finally {
    lock.releaseLock();
  }
  return jsonResponse({ success: true });
}

// ---------------------------------------------------------------- Cached reference data

function getAllBranches() {
  return getCachedJson("cache_branches", function () {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Branches");
    if (!sheet || sheet.getLastRow() < 2) return [];
    const data = sheet.getDataRange().getValues();
    const list = [];
    for (let i = 1; i < data.length; i++) {
      const sol = String(data[i][0]).trim();
      if (!sol) continue;
      list.push({
        solCode: sol,
        branchName: data[i][1] || "",
        region: data[i][2] || "",
        roGuardianRoll: String(data[i][3] || "").trim()
      });
    }
    return list;
  });
}

function getParamMappingAndTicker() {
  return getCachedJson("cache_parammap", function () {
    const result = {
      mapping: {},
      ticker: "Welcome to the IOB Daily Performance Reporting Portal. Please ensure all daily metrics are submitted by 17:00 EOD."
    };
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("RoleParameterMap");
    if (!sheet || sheet.getLastRow() < 2) return result;

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rolesList = ["1st Line", "2nd Line", "RO Guardian", "LBO", "PO"];
    const keyIdx = headers.indexOf("Parameter Key");
    const nameIdx = headers.indexOf("Parameter Name");
    rolesList.forEach(function (role) { result.mapping[role] = []; });

    for (let i = 1; i < data.length; i++) {
      const key = data[i][keyIdx];
      if (key === "roBroadcastMessage") {
        result.ticker = data[i][nameIdx] || result.ticker;
        continue;
      }
      rolesList.forEach(function (role) {
        const colIdx = headers.indexOf(role);
        if (colIdx !== -1 && Number(data[i][colIdx]) === 1) {
          result.mapping[role].push(key);
        }
      });
    }
    return result;
  });
}

function getCachedJson(key, producer) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const value = producer();
  try {
    cache.put(key, JSON.stringify(value), STATIC_CACHE_SECONDS);
  } catch (e) {
    // Value too large for cache: serve uncached
  }
  return value;
}

function invalidateCaches() {
  CacheService.getScriptCache().removeAll(["cache_branches", "cache_parammap"]);
}

// ---------------------------------------------------------------- Dashboard

function parseSheetDate(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  const str = String(val).trim();
  const match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    return match[1] + "-" + match[2].padStart(2, "0") + "-" + match[3].padStart(2, "0");
  }
  try {
    return Utilities.formatDate(new Date(val), Session.getScriptTimeZone(), "yyyy-MM-dd");
  } catch (e) {
    return str;
  }
}

// Reads only the newest `windowSize` data rows of a sheet as {headers, rows, startRow}.
function getRecentRows(sheet, windowSize) {
  if (!sheet) return { headers: [], rows: [], startRow: 2 };
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { headers: [], rows: [], startRow: 2 };
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const startRow = Math.max(2, lastRow - windowSize + 1);
  const rows = sheet.getRange(startRow, 1, lastRow - startRow + 1, lastCol).getValues();
  return { headers: headers, rows: rows, startRow: startRow };
}

function rowToObject(headers, row) {
  const obj = {};
  for (let j = 0; j < headers.length; j++) obj[headers[j]] = row[j];
  return obj;
}

function getDashboardData(session, dateFilter, solCodeFilter) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const filterDateStr = dateFilter || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  // Scope comes exclusively from the server-side session
  const normRole = String(session.role).trim().toUpperCase();
  const isGlobal = GLOBAL_ROLES.includes(normRole) || (session.assignedSols || []).includes("*");
  const scopeSols = (session.branches || []).map(function (b) { return b.solCode; });
  const inScope = function (sol) { return isGlobal || scopeSols.includes(sol); };
  const wantSol = function (sol) { return (!solCodeFilter || sol === solCodeFilter) && inScope(sol); };

  const branches = getAllBranches().filter(function (b) { return wantSol(b.solCode); });

  // Submissions: newest window only, filtered by date and scope
  const subsData = getRecentRows(ss.getSheetByName("Submissions"), SUBMISSIONS_SCAN_WINDOW);
  const submissions = [];
  for (let i = 0; i < subsData.rows.length; i++) {
    const obj = rowToObject(subsData.headers, subsData.rows[i]);
    const sol = String(obj["SOL Code"] || "").trim();
    if (!wantSol(sol)) continue;
    if (parseSheetDate(obj["Reporting Date"]) !== filterDateStr) continue;
    submissions.push(obj);
  }

  // BaseTargets: the sheet holds one snapshot per upload; exact-date match wins, latest row is fallback
  const baseData = getRecentRows(ss.getSheetByName("BaseTargets"), SUBMISSIONS_SCAN_WINDOW);
  const dailyBase = {};
  const latestBases = {};
  for (let i = 0; i < baseData.rows.length; i++) {
    const obj = rowToObject(baseData.headers, baseData.rows[i]);
    const sol = String(obj["SOL Code"] || "").trim();
    if (!wantSol(sol)) continue;
    latestBases[sol] = obj;
    if (parseSheetDate(obj["Date"]) === filterDateStr) dailyBase[sol] = obj;
  }
  for (const sol in latestBases) {
    if (!dailyBase[sol]) dailyBase[sol] = latestBases[sol];
  }

  const config = getParamMappingAndTicker();

  return jsonResponse({
    success: true,
    branches: branches,
    submissions: submissions,
    dailyBase: dailyBase,
    monthlyBase: dailyBase,
    date: filterDateStr,
    isManagementView: MANAGEMENT_ROLES.includes(normRole),
    roleParamMapping: config.mapping,
    roBroadcastMessage: config.ticker
  });
}

// ---------------------------------------------------------------- Submissions (upsert)

function submitReport(session, data) {
  const normRole = String(session.role).trim().toUpperCase();
  if (!ENTRY_ROLES.includes(normRole)) {
    return errorResponse("Your role is not permitted to submit reports.", "FORBIDDEN");
  }

  const solCode = String(data.solCode || "").trim();
  const scopeSols = (session.branches || []).map(function (b) { return b.solCode; });
  const isGlobal = (session.assignedSols || []).includes("*");
  if (!solCode || (!isGlobal && !scopeSols.includes(solCode))) {
    return errorResponse("You are not assigned to branch SOL " + solCode + ".", "FORBIDDEN");
  }

  const reportingDate = parseSheetDate(data.reportingDate) ||
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  // Identity comes from the session; client-supplied values are ignored
  data.rollNumber = session.rollNumber;
  data.submitterName = session.name;
  data.role = session.role;
  data.reportingDate = reportingDate;

  const normalizedData = {};
  for (const key in data) {
    normalizedData[key.toLowerCase().replace(/_/g, "")] = data[key];
  }

  // Server-side validation: ensure count and amount fields (except growth) are not negative
  const allowedNegativeKeys = ["growthsb", "growthcd", "growthtd"];
  for (const key in normalizedData) {
    const val = normalizedData[key];
    if (typeof val === "number" && val < 0 && !allowedNegativeKeys.includes(key)) {
      return errorResponse("Invalid negative value for field: " + key, "BAD_REQUEST");
    }
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Submissions");
  if (!sheet) return errorResponse("'Submissions' sheet missing.");

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return errorResponse("Server busy, please retry.");
  try {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRow = headers.map(function (header) {
      const nHeader = String(header).toLowerCase().replace(/_/g, "");
      if (nHeader === "timestamp") return new Date();
      return normalizedData[nHeader] !== undefined ? normalizedData[nHeader] : "";
    });

    // Upsert: one submission per roll + SOL + date (resubmitting updates the earlier row)
    const recent = getRecentRows(sheet, SUBMISSIONS_SCAN_WINDOW);
    const rollIdx = recent.headers.indexOf("Roll Number");
    const solIdx = recent.headers.indexOf("SOL Code");
    const dateIdx = recent.headers.indexOf("Reporting Date");
    let existingRowNumber = -1;
    if (rollIdx !== -1 && solIdx !== -1 && dateIdx !== -1) {
      for (let i = recent.rows.length - 1; i >= 0; i--) {
        if (String(recent.rows[i][rollIdx]).trim() === session.rollNumber &&
            String(recent.rows[i][solIdx]).trim() === solCode &&
            parseSheetDate(recent.rows[i][dateIdx]) === reportingDate) {
          existingRowNumber = recent.startRow + i;
          break;
        }
      }
    }

    if (existingRowNumber !== -1) {
      sheet.getRange(existingRowNumber, 1, 1, newRow.length).setValues([newRow]);
      return jsonResponse({ success: true, updated: true });
    }
    sheet.appendRow(newRow);
    return jsonResponse({ success: true, updated: false });
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------- Admin uploads (batched)

function uploadBaseTargets(date, rows) {
  if (!rows || !rows.length) return errorResponse("No rows to upload.");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("BaseTargets");
  if (!sheet) return errorResponse("'BaseTargets' sheet missing.");

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return errorResponse("Server busy, please retry.");
  try {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }

    const outRows = rows.map(function (row) {
      const normalizedRow = {};
      for (const key in row) {
        normalizedRow[key.toLowerCase().replace(/_/g, "")] = row[key];
      }
      return headers.map(function (header) {
        const nHeader = String(header).toLowerCase().replace(/_/g, "");
        if (nHeader === "date") return date;
        return normalizedRow[nHeader] !== undefined ? normalizedRow[nHeader] : 0;
      });
    });

    // One batched write instead of one appendRow call per branch
    sheet.getRange(2, 1, outRows.length, headers.length).setValues(outRows);
  } finally {
    lock.releaseLock();
  }
  return jsonResponse({ success: true });
}

function uploadMasterData(branches, users) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return errorResponse("Server busy, please retry.");
  try {
    if (branches && branches.length > 0) {
      const sheet = ss.getSheetByName("Branches");
      if (!sheet) return errorResponse("'Branches' sheet missing.");
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
      }
      const outRows = branches.map(function (b) {
        return headers.map(function (h) {
          if (h === "SOL Code") return b.solCode;
          if (h === "Branch Name") return b.branchName;
          if (h === "Region") return b.region;
          if (h === "RO Guardian Roll") return b.roGuardianRoll;
          return "";
        });
      });
      sheet.getRange(2, 1, outRows.length, headers.length).setValues(outRows);
    }

    if (users && users.length > 0) {
      const info = getUsersSheetInfo();
      const sheet = info.sheet;
      const headers = info.headers;

      // Preserve existing credentials: a master re-upload must not reset anyone's password
      const existing = sheet.getDataRange().getValues();
      const credByRoll = {};
      for (let i = 1; i < existing.length; i++) {
        const roll = String(existing[i][info.col.roll]).trim().toUpperCase();
        if (!roll) continue;
        credByRoll[roll] = {
          hash: existing[i][info.col.hash] || "",
          salt: existing[i][info.col.salt] || "",
          mustChange: existing[i][info.col.mustChange]
        };
      }

      if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
      }

      const outRows = users.map(function (u) {
        const roll = String(u.rollNumber || "").trim();
        const cred = credByRoll[roll.toUpperCase()];
        let hash, salt, mustChange;
        if (cred && cred.hash) {
          hash = cred.hash;
          salt = cred.salt;
          mustChange = cred.mustChange;
        } else {
          // New user: default password is their roll number, forced change on first login.
          // Plaintext passwords in the uploaded CSV are deliberately ignored.
          salt = newSalt();
          hash = hashPassword(roll, salt);
          mustChange = 1;
        }
        return headers.map(function (h) {
          if (h === "Roll Number") return roll;
          if (h === "Name") return u.name;
          if (h === "Role") return u.role;
          if (h === "Assigned SOLs") return u.assignedSols;
          if (h === "Password") return "";
          if (h === "PassHash") return hash;
          if (h === "Salt") return salt;
          if (h === "MustChange") return mustChange;
          return "";
        });
      });
      sheet.getRange(2, 1, outRows.length, headers.length).setValues(outRows);
    }
  } finally {
    lock.releaseLock();
  }
  invalidateCaches();
  return jsonResponse({ success: true });
}

function saveRoleParamMapping(mapping) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("RoleParameterMap");
  if (!sheet) sheet = ss.insertSheet("RoleParameterMap");

  const headers = ["Parameter Key", "Parameter Name", "1st Line", "2nd Line", "RO Guardian", "LBO", "PO"];

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return errorResponse("Server busy, please retry.");
  try {
    // Preserve the ticker row across rewrites
    let ticker = null;
    if (sheet.getLastRow() > 1) {
      const data = sheet.getDataRange().getValues();
      const keyIdx = data[0].indexOf("Parameter Key");
      const nameIdx = data[0].indexOf("Parameter Name");
      for (let i = 1; i < data.length; i++) {
        if (data[i][keyIdx] === "roBroadcastMessage") ticker = data[i][nameIdx];
      }
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    const rows = PARAM_LIST.map(function (p) {
      return [
        p.key,
        p.name,
        (mapping["1st Line"] || []).includes(p.key) ? 1 : 0,
        (mapping["2nd Line"] || []).includes(p.key) ? 1 : 0,
        (mapping["RO Guardian"] || []).includes(p.key) ? 1 : 0,
        (mapping["LBO"] || []).includes(p.key) ? 1 : 0,
        (mapping["PO"] || []).includes(p.key) ? 1 : 0
      ];
    });
    if (ticker !== null) rows.push(["roBroadcastMessage", ticker, 0, 0, 0, 0, 0]);
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  } finally {
    lock.releaseLock();
  }
  invalidateCaches();
  return jsonResponse({ success: true });
}

function saveTickerMessage(message) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("RoleParameterMap");
  if (!sheet) {
    sheet = ss.insertSheet("RoleParameterMap");
    sheet.getRange(1, 1, 1, 7).setValues([["Parameter Key", "Parameter Name", "1st Line", "2nd Line", "RO Guardian", "LBO", "PO"]]);
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return errorResponse("Server busy, please retry.");
  try {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const keyIdx = headers.indexOf("Parameter Key");
    const nameIdx = headers.indexOf("Parameter Name");

    let rowIdx = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][keyIdx] === "roBroadcastMessage") {
        rowIdx = i + 1;
        break;
      }
    }

    if (rowIdx === -1) {
      const newRow = headers.map(function (h) {
        if (h === "Parameter Key") return "roBroadcastMessage";
        if (h === "Parameter Name") return message;
        return 0;
      });
      sheet.appendRow(newRow);
    } else {
      sheet.getRange(rowIdx, nameIdx + 1).setValue(message);
    }
  } finally {
    lock.releaseLock();
  }
  invalidateCaches();
  return jsonResponse({ success: true });
}

// Parameter catalogue (kept in sync with PARAM_LIST in app.js)
const PARAM_LIST = [
  { key: "fundingLowBal", name: "Low Balance Funding Count" },
  { key: "growthSB", name: "SB Balance Growth" },
  { key: "growthCD", name: "CD Balance Growth" },
  { key: "growthTD", name: "TD Balance Growth" },
  { key: "acctsOpened", name: "Account Opening Targets" },
  { key: "acctsGovt", name: "Govt Accounts Opened" },
  { key: "acctsTemple", name: "Temple Accounts Opened" },
  { key: "acctsContractors", name: "Contractor Accounts Opened" },
  { key: "acctsStepUpRD", name: "Adoption: Step-up RD" },
  { key: "acctsPlatinum", name: "Adoption: SB Platinum" },
  { key: "acctsUltraHni", name: "Adoption: SB Ultra HNI" },
  { key: "acctsPremium", name: "Adoption: Premium" },
  { key: "creditCards", name: "Credit Cards Issued" },
  { key: "iobConnect", name: "IOB Connect Adoptions" },
  { key: "netBanking", name: "Net Banking Adoptions" },
  { key: "casaWinbackCompleted", name: "CASA Winback Completed" },
  { key: "nps", name: "NPS Registrations" },
  { key: "ssy", name: "SSY Registrations" },
  { key: "ppf", name: "PPF Registrations" },
  { key: "jewelLoansFresh", name: "Jewel Loans: Fresh" },
  { key: "jewelLoansRenewal", name: "Jewel Loans: Renewal" },
  { key: "accidentInsurance", name: "PA Insurance Policies" },
  { key: "socialMediaCount", name: "Social Media Shared Posts" },
  { key: "activationInoperative", name: "Inoperative Count Reactivated" },
  { key: "activationInoperativeAmt", name: "Inoperative Amt Reactivated" },
  { key: "activationInactive", name: "Inactive Count Reactivated" },
  { key: "activationInactiveAmt", name: "Inactive Amt Reactivated" },
  { key: "activationDeaf", name: "DEAF Count Reactivated" },
  { key: "activationDeafAmt", name: "DEAF Amt Reactivated" },
  { key: "reductionInoperative", name: "Inoperative Accounts Reduction" },
  { key: "reductionInactive", name: "Inactive Accounts Reduction" },
  { key: "reductionDeaf", name: "DEAF Accounts Reduction" },
  { key: "rekycCompleted", name: "REKYC Completed" },
  { key: "nominationUpdated", name: "Nomination Updated" },
  { key: "dqiProgress", name: "DQI Progress Count" },
  { key: "powerplayIntent", name: "Powerplay Intent Checklists" },
  { key: "roCampaignsChecked", name: "RO Campaigns Checked Review" },
  { key: "roNotes", name: "Supervisor Audit Notes" },
  { key: "loanHousing", name: "Housing Loan Sanctions" },
  { key: "loanVehicle", name: "Vehicle Loan Sanctions" },
  { key: "loanPersonal", name: "Personal Loan Sanctions" },
  { key: "loanMSME", name: "Core MSME Sanctions" },
  { key: "loanAgri", name: "Core Agri Sanctions" },
  { key: "acctsOpenedTAB", name: "Accounts Opened via TAB" },
  { key: "fastag", name: "FASTag Accounts Activated" },
  { key: "pmsby", name: "PMSBY Registrations" },
  { key: "pmjjby", name: "PMJJBY Registrations" }
];
