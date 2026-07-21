// Daily Performance Reporting Portal - Core Client Application Logic

// State Management
let currentUser = null;
let wizardCards = [];
let currentStepIndex = 0;
let appSettings = {
  // Hardcode your Google Apps Script Web App URL here to make it automatically live for all devices (mobile/desktop):
  scriptUrl: "https://script.google.com/macros/s/AKfycbz_uK1nbMSBVYIdhHSFwq6hxBKAZGyeZsv-gfKofd_MxnPAcWTda62zfL0f9d4lS0Bf/exec",
  mockMode: false // Set to false by default for live sheets connection
};

// --- Session handling (live mode uses a server-issued token; mock mode has no token) ---
const SESSION_DURATION_MS = 6 * 60 * 60 * 1000; // matches the backend's 6h token TTL
let sessionToken = null;

function saveSession(token, user) {
  sessionToken = token || null;
  currentUser = user;
  localStorage.setItem("iob_user_session", JSON.stringify({
    token: sessionToken,
    user: user,
    expiresAt: Date.now() + SESSION_DURATION_MS
  }));
}

function handleSessionExpired() {
  logout();
  showToast("Your session has expired. Please log in again.");
}

// All live backend calls go through here: POST-only, token attached, AUTH errors force re-login
async function apiPost(payload, opts = {}) {
  if (!opts.noAuth) payload.token = sessionToken;
  const res = await fetch(appSettings.scriptUrl, { method: "POST", body: JSON.stringify(payload) });
  const result = await res.json();
  if (result && result.errorCode === "AUTH") {
    handleSessionExpired();
    throw new Error(result.error || "Session expired");
  }
  return result;
}

// Simulated Local Database for Mock Mode
let mockBranches = [
  { solCode: "1001", branchName: "IOB Cathedral Branch", region: "Chennai South", roGuardianRoll: "3001" },
  { solCode: "1002", branchName: "IOB Mount Road Branch", region: "Chennai South", roGuardianRoll: "3001" },
  { solCode: "1003", branchName: "IOB T-Nagar Branch", region: "Chennai South", roGuardianRoll: "3001" },
  { solCode: "1004", branchName: "IOB Adyar Branch", region: "Chennai South", roGuardianRoll: "3001" },
  { solCode: "1005", branchName: "IOB Mylapore Branch", region: "Chennai South", roGuardianRoll: "3001" }
];

const mockUsers = {
  "1001": { name: "Ramesh Kumar", role: "1st Line", assignedSols: ["1001"] },
  "2001": { name: "Anjali Sharma", role: "2nd Line", assignedSols: ["1001"] },
  "3001": { name: "Vikram Singh", role: "RO Guardian", assignedSols: ["1001", "1002", "1003"] },
  "9001": { name: "S. Srinivasan", role: "RO SRM", assignedSols: ["*"] },
  "CHIEF": { name: "M. Balaji", role: "Chief Manager", assignedSols: ["*"] },
  "ADMIN": { name: "Portal Admin", role: "Admin", assignedSols: ["*"] },
  "LBO1": { name: "Local Bank Officer", role: "LBO", assignedSols: ["1001"] },
  "PO1": { name: "Probationary Officer", role: "PO", assignedSols: ["1001"] }
};

let mockSubmissions = [
  // Cathedral Branch submissions for today
  {
    Timestamp: new Date().toISOString(),
    "Reporting Date": getTodayDateString(),
    "Roll Number": "1001",
    "Submitter Name": "Ramesh Kumar",
    Role: "1st Line",
    "SOL Code": "1001",
    "Branch Name": "IOB Cathedral Branch",
    Funding_Low_Bal: 12,
    Growth_SB: 450000,
    Growth_CD: 120000,
    Growth_TD: 1500000,
    Accts_Opened: 8,
    Accts_Diamond: 1,
    Accts_Platinum: 2,
    Accts_Ultra_HNI: 0,
    Accts_Premium: 4,
    Accts_Govt: 0,
    Accts_Temple: 1,
    Accts_Contractors: 0,
    Credit_Cards: 4,
    IOB_Connect: 8,
    Net_Banking: 6,
    CASA_Winback_Completed: 3,
    NPS: 2,
    SSY: 1,
    PPF: 1,
    Jewel_Loans_Fresh: 3,
    Jewel_Loans_Renewal: 1,
    Accident_Insurance: 4,
    Social_Media_Count: 3
  },
  {
    Timestamp: new Date().toISOString(),
    "Reporting Date": getTodayDateString(),
    "Roll Number": "2001",
    "Submitter Name": "Anjali Sharma",
    Role: "2nd Line",
    "SOL Code": "1001",
    "Branch Name": "IOB Cathedral Branch",
    Status_SB: "Achieved",
    Status_CD: "Positive",
    Status_CASA: "Achieved",
    Status_TD: "Positive",
    Reduction_Inoperative: 15,
    Reduction_Inactive: 8,
    Reduction_DEAF: 2,
    REKYC_Completed: 12,
    Nomination_Updated: 18,
    DQI_Progress: 9,
    Powerplay_Intent: "Yes"
  },
  // Mount Road Branch 1st Line
  {
    Timestamp: new Date().toISOString(),
    "Reporting Date": getTodayDateString(),
    "Roll Number": "1002_MOCK",
    "Submitter Name": "Priya Das",
    Role: "1st Line",
    "SOL Code": "1002",
    "Branch Name": "IOB Mount Road Branch",
    Funding_Low_Bal: 8,
    Growth_SB: -25000,
    Growth_CD: 85000,
    Growth_TD: 450000,
    Accts_Opened: 4,
    Accts_Diamond: 0,
    Accts_Platinum: 0,
    Accts_Ultra_HNI: 0,
    Accts_Premium: 2,
    Accts_Govt: 0,
    Accts_Temple: 0,
    Accts_Contractors: 1,
    Credit_Cards: 2,
    IOB_Connect: 5,
    Net_Banking: 3,
    CASA_Winback_Completed: 1,
    NPS: 1,
    SSY: 0,
    PPF: 0,
    Jewel_Loans_Fresh: 1,
    Jewel_Loans_Renewal: 2,
    Accident_Insurance: 2,
    Social_Media_Count: 0
  }
];

let mockDailyBase = {
  "1001": { targetAcctsOpened: 5, targetGrowthSB: 100000, targetGrowthCD: 50000, targetGrowthTD: 200000, allottedCasaWinback: 10, yestBalSB: 45200000, yestBalCD: 12800000, yestBalTD: 88500000,
            uptoYestAcctsSB: 78, uptoYestAcctsCD: 24, currMonthStepUpRD: 6, currMonthPlatinum: 11, currMonthUltraHni: 1, currMonthPremium: 18 },
  "1002": { targetAcctsOpened: 3, targetGrowthSB: 50000, targetGrowthCD: 20000, targetGrowthTD: 100000, allottedCasaWinback: 5, yestBalSB: 27400000, yestBalCD: 8100000, yestBalTD: 51200000,
            uptoYestAcctsSB: 45, uptoYestAcctsCD: 13, currMonthStepUpRD: 3, currMonthPlatinum: 6, currMonthUltraHni: 0, currMonthPremium: 10 },
  "1003": { targetAcctsOpened: 4, targetGrowthSB: 80000, targetGrowthCD: 40000, targetGrowthTD: 150000, allottedCasaWinback: 8, yestBalSB: 33600000, yestBalCD: 9700000, yestBalTD: 64800000,
            uptoYestAcctsSB: 58, uptoYestAcctsCD: 17, currMonthStepUpRD: 4, currMonthPlatinum: 8, currMonthUltraHni: 1, currMonthPremium: 13 },
  "1004": { targetAcctsOpened: 3, targetGrowthSB: 60000, targetGrowthCD: 30000, targetGrowthTD: 120000, allottedCasaWinback: 6, yestBalSB: 21900000, yestBalCD: 6400000, yestBalTD: 42700000,
            uptoYestAcctsSB: 36, uptoYestAcctsCD: 10, currMonthStepUpRD: 2, currMonthPlatinum: 4, currMonthUltraHni: 0, currMonthPremium: 7 },
  "1005": { targetAcctsOpened: 4, targetGrowthSB: 75000, targetGrowthCD: 35000, targetGrowthTD: 140000, allottedCasaWinback: 7, yestBalSB: 30100000, yestBalCD: 8800000, yestBalTD: 57300000,
            uptoYestAcctsSB: 51, uptoYestAcctsCD: 15, currMonthStepUpRD: 3, currMonthPlatinum: 7, currMonthUltraHni: 0, currMonthPremium: 11 }
};

let mockMonthlyBase = {
  "1001": { baseLowBalanceFunding: 15, baseLowBalSB: 120, baseLowBalCD: 45, bal31MarSB: 44100000, bal31MarCD: 12300000, bal31MarTD: 86200000,
            targetAcctsSB: 120, targetAcctsCD: 40, fyStepUpRD: 22, fyPlatinum: 41, fyUltraHni: 3, fyPremium: 65,
            prevMonthStepUpRD: 8, prevMonthPlatinum: 14, prevMonthUltraHni: 1, prevMonthPremium: 21,
            baseInoperativeAccts: 25, baseInoperativeAmt: 1850000, baseInactiveAccts: 20, baseInactiveAmt: 920000, baseDeafAccts: 5, baseDeafAmt: 210000 },
  "1002": { baseLowBalanceFunding: 10, baseLowBalSB: 85, baseLowBalCD: 30, bal31MarSB: 26800000, bal31MarCD: 7900000, bal31MarTD: 50100000,
            targetAcctsSB: 70, targetAcctsCD: 25, fyStepUpRD: 12, fyPlatinum: 24, fyUltraHni: 1, fyPremium: 38,
            prevMonthStepUpRD: 4, prevMonthPlatinum: 8, prevMonthUltraHni: 0, prevMonthPremium: 12,
            baseInoperativeAccts: 15, baseInoperativeAmt: 1120000, baseInactiveAccts: 12, baseInactiveAmt: 560000, baseDeafAccts: 3, baseDeafAmt: 130000 },
  "1003": { baseLowBalanceFunding: 12, baseLowBalSB: 95, baseLowBalCD: 38, bal31MarSB: 32900000, bal31MarCD: 9400000, bal31MarTD: 63500000,
            targetAcctsSB: 90, targetAcctsCD: 30, fyStepUpRD: 16, fyPlatinum: 30, fyUltraHni: 2, fyPremium: 47,
            prevMonthStepUpRD: 6, prevMonthPlatinum: 10, prevMonthUltraHni: 1, prevMonthPremium: 15,
            baseInoperativeAccts: 20, baseInoperativeAmt: 1430000, baseInactiveAccts: 15, baseInactiveAmt: 700000, baseDeafAccts: 4, baseDeafAmt: 160000 },
  "1004": { baseLowBalanceFunding: 8, baseLowBalSB: 60, baseLowBalCD: 22, bal31MarSB: 21400000, bal31MarCD: 6200000, bal31MarTD: 41800000,
            targetAcctsSB: 55, targetAcctsCD: 18, fyStepUpRD: 9, fyPlatinum: 17, fyUltraHni: 1, fyPremium: 27,
            prevMonthStepUpRD: 3, prevMonthPlatinum: 6, prevMonthUltraHni: 0, prevMonthPremium: 9,
            baseInoperativeAccts: 14, baseInoperativeAmt: 860000, baseInactiveAccts: 10, baseInactiveAmt: 420000, baseDeafAccts: 2, baseDeafAmt: 90000 },
  "1005": { baseLowBalanceFunding: 11, baseLowBalSB: 78, baseLowBalCD: 28, bal31MarSB: 29500000, bal31MarCD: 8500000, bal31MarTD: 56200000,
            targetAcctsSB: 80, targetAcctsCD: 27, fyStepUpRD: 13, fyPlatinum: 26, fyUltraHni: 1, fyPremium: 41,
            prevMonthStepUpRD: 5, prevMonthPlatinum: 9, prevMonthUltraHni: 0, prevMonthPremium: 13,
            baseInoperativeAccts: 18, baseInoperativeAmt: 1260000, baseInactiveAccts: 14, baseInactiveAmt: 610000, baseDeafAccts: 3, baseDeafAmt: 140000 }
};

// Submissions arrive in two shapes: camelCase payloads from this app and
// sheet-header keys ("SOL Code", Growth_SB) from Google Sheets / seeded mocks.
// Everything is converted to camelCase at the point of entry via normalizeSubmission.
const SHEET_KEY_MAP = {
  "Timestamp": "timestamp",
  "Reporting Date": "reportingDate",
  "Roll Number": "rollNumber",
  "Submitter Name": "submitterName",
  "Role": "role",
  "SOL Code": "solCode",
  "Branch Name": "branchName",
  "Funding_Low_Bal": "fundingLowBal",
  "Funding_SB": "fundingSB",
  "Funding_CD": "fundingCD",
  "Growth_SB": "growthSB",
  "Growth_CD": "growthCD",
  "Growth_TD": "growthTD",
  "Accts_Opened": "acctsOpened",
  "Accts_Step_Up_RD": "acctsStepUpRD",
  "Accts_Platinum": "acctsPlatinum",
  "Accts_Ultra_HNI": "acctsUltraHni",
  "Accts_Premium": "acctsPremium",
  "Accts_Govt": "acctsGovt",
  "Accts_Temple": "acctsTemple",
  "Accts_Contractors": "acctsContractors",
  "Credit_Cards": "creditCards",
  "IOB_Connect": "iobConnect",
  "Net_Banking": "netBanking",
  "CASA_Winback_Completed": "casaWinbackCompleted",
  "NPS": "nps",
  "SSY": "ssy",
  "PPF": "ppf",
  "Jewel_Loans_Fresh": "jewelLoansFresh",
  "Jewel_Loans_Renewal": "jewelLoansRenewal",
  "Accident_Insurance": "accidentInsurance",
  "Social_Media_Shared": "socialMediaShared",
  "Social_Media_Count": "socialMediaCount",
  "Status_SB": "statusSB",
  "Status_CD": "statusCD",
  "Status_CASA": "statusCASA",
  "Status_TD": "statusTD",
  "Activation_Inoperative": "activationInoperative",
  "Activation_Inoperative_Amt": "activationInoperativeAmt",
  "Activation_Inactive": "activationInactive",
  "Activation_Inactive_Amt": "activationInactiveAmt",
  "Activation_DEAF": "activationDeaf",
  "Activation_DEAF_Amt": "activationDeafAmt",
  "Reduction_Inoperative": "reductionInoperative",
  "Reduction_Inactive": "reductionInactive",
  "Reduction_DEAF": "reductionDeaf",
  "REKYC_Completed": "rekycCompleted",
  "Nomination_Updated": "nominationUpdated",
  "DQI_Progress": "dqiProgress",
  "Powerplay_Intent": "powerplayIntent",
  "RO_Campaigns_Checked": "roCampaignsChecked",
  "RO_Notes": "roNotes",
  "Loan_Housing": "loanHousing",
  "Loan_Vehicle": "loanVehicle",
  "Loan_Personal": "loanPersonal",
  "Loan_MSME": "loanMSME",
  "Loan_Agri": "loanAgri",
  "Accts_Opened_TAB": "acctsOpenedTAB",
  "Fastag": "fastag",
  "PMSBY": "pmsby",
  "PMJJBY": "pmjjby"
};

function normalizeSubmission(row) {
  const out = {};
  for (const key in row) {
    if (key === "action") continue; // internal API field, not report data
    out[SHEET_KEY_MAP[key] || key] = row[key];
  }
  if (out.solCode !== undefined && out.solCode !== null) {
    out.solCode = String(out.solCode).trim();
  }
  if (out.role) {
    let r = String(out.role).trim().toLowerCase();
    if (r.includes("1st")) out.role = "1st Line";
    else if (r.includes("2nd")) out.role = "2nd Line";
    else if (r.includes("guard")) out.role = "RO Guardian";
    else if (r.includes("lbo")) out.role = "LBO";
    else if (r.includes("po")) out.role = "PO";
  }
  if (out.reportingDate) {
    try {
      // If it is an ISO/long date string, extract yyyy-mm-dd
      let d = new Date(out.reportingDate);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        out.reportingDate = `${yyyy}-${mm}-${dd}`;
      } else {
        let s = String(out.reportingDate).trim();
        let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (m) {
          out.reportingDate = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
        }
      }
    } catch (e) {
      console.warn("Date normalization failed:", e);
    }
  }
  return out;
}

function normalizeBranch(br) {
  if (!br) return null;
  return {
    solCode: String(br.solCode || br["SOL Code"] || "").trim(),
    branchName: br.branchName || br["Branch Name"] || "",
    region: br.region || br["Region"] || "",
    roGuardianRoll: String(br.roGuardianRoll || br["RO Guardian Roll"] || "").trim()
  };
}

const BASE_KEY_MAP = {
  "Target_Accts_Opened": "targetAcctsOpened",
  "Target_Growth_SB": "targetGrowthSB",
  "Target_Growth_CD": "targetGrowthCD",
  "Target_Growth_TD": "targetGrowthTD",
  "Allotted_CASA_Winback": "allottedCasaWinback",
  "Yesterday_Bal_SB": "yestBalSB",
  "Yesterday_Bal_CD": "yestBalCD",
  "Yesterday_Bal_TD": "yestBalTD",
  "UptoYest_Accts_SB": "uptoYestAcctsSB",
  "UptoYest_Accts_CD": "uptoYestAcctsCD",
  "Curr_Month_Step_Up_RD": "currMonthStepUpRD",
  "Curr_Month_Platinum": "currMonthPlatinum",
  "Curr_Month_Ultra_HNI": "currMonthUltraHni",
  "Curr_Month_Premium": "currMonthPremium",
  "Target_Credit_Cards": "targetCreditCards",
  "Target_IOB_Connect": "targetIobConnect",
  "Target_Net_Banking": "targetNetBanking",
  "Target_Ongoing_Campaigns": "targetOngoingCampaigns",
  "Base_Low_Balance_Funding": "baseLowBalanceFunding",
  "Base_Low_Bal_SB": "baseLowBalSB",
  "Base_Low_Bal_CD": "baseLowBalCD",
  "Bal_31Mar_SB": "bal31MarSB",
  "Bal_31Mar_CD": "bal31MarCD",
  "Bal_31Mar_TD": "bal31MarTD",
  "Target_Accts_SB": "targetAcctsSB",
  "Target_Accts_CD": "targetAcctsCD",
  "FY_Step_Up_RD": "fyStepUpRD",
  "FY_Platinum": "fyPlatinum",
  "FY_Ultra_HNI": "fyUltraHni",
  "FY_Premium": "fyPremium",
  "Prev_Month_Step_Up_RD": "prevMonthStepUpRD",
  "Prev_Month_Platinum": "prevMonthPlatinum",
  "Prev_Month_Ultra_HNI": "prevMonthUltraHni",
  "Prev_Month_Premium": "prevMonthPremium",
  "Base_Inoperative_Accts": "baseInoperativeAccts",
  "Base_Inoperative_Amt": "baseInoperativeAmt",
  "Base_Inactive_Accts": "baseInactiveAccts",
  "Base_Inactive_Amt": "baseInactiveAmt",
  "Base_DEAF_Accts": "baseDeafAccts",
  "Base_DEAF_Amt": "baseDeafAmt"
};

function normalizeBase(row) {
  if (!row) return {};
  const out = {};
  for (const key in row) {
    const normKey = BASE_KEY_MAP[key] || key.toLowerCase().replace(/_/g, "");
    out[normKey] = row[key];
  }
  return out;
}

// Rows currently shown in the Submissions Log (already normalized); used by CSV export
let lastReportRows = null;

// Reference bases for the branch currently loaded in the entry form;
// used to derive growth status (total OS vs 31 March base)
let currentBranchBases = { daily: {}, monthly: {} };

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

const INPUT_TO_PARAM = {
  "sb-low-bal-funded": "fundingLowBal",
  "cd-low-bal-funded": "fundingLowBal",
  "sb-growth": "growthSB",
  "cd-growth": "growthCD",
  "td-growth": "growthTD",
  "acctsOpenedSB": "acctsOpened",
  "acctsOpenedCD": "acctsOpened",
  "acctsStepUpRD": "acctsStepUpRD",
  "acctsPlatinum": "acctsPlatinum",
  "acctsUltraHni": "acctsUltraHni",
  "acctsPremium": "acctsPremium",
  "govt-accts": "acctsGovt",
  "temple-accts": "acctsTemple",
  "contractor-accts": "acctsContractors",
  "credit-cards": "creditCards",
  "iob-connect": "iobConnect",
  "net-banking": "netBanking",
  "casaWinbackCompleted": "casaWinbackCompleted",
  "nps": "nps",
  "ssy": "ssy",
  "ppf": "ppf",
  "jewelLoansFresh": "jewelLoansFresh",
  "jewelLoansRenewal": "jewelLoansRenewal",
  "accidentInsurance": "accidentInsurance",
  "socialMediaCount": "socialMediaCount",
  "activationInoperative": "activationInoperative",
  "activationInoperativeAmt": "activationInoperativeAmt",
  "activationInactive": "activationInactive",
  "activationInactiveAmt": "activationInactiveAmt",
  "activationDeaf": "activationDeaf",
  "activationDeafAmt": "activationDeafAmt",
  "reductionInoperative": "reductionInoperative",
  "reductionInactive": "reductionInactive",
  "reductionDeaf": "reductionDeaf",
  "rekycCompleted": "rekycCompleted",
  "nominationUpdated": "nominationUpdated",
  "dqi-progress": "dqiProgress",
  "powerplay-intent": "powerplayIntent",
  "ro-campaigns-checked": "roCampaignsChecked",
  "ro-notes": "roNotes",
  "loan-housing": "loanHousing",
  "loan-vehicle": "loanVehicle",
  "loan-personal": "loanPersonal",
  "loan-msme": "loanMSME",
  "loan-agri": "loanAgri",
  "fastag": "fastag",
  "accts-opened-tab": "acctsOpenedTAB",
  "pmsby": "pmsby",
  "pmjjby": "pmjjby"
};

let roleParamMapping = {
  "1st Line": ["fundingLowBal", "growthSB", "growthCD", "growthTD", "acctsOpened", "acctsStepUpRD", "acctsPlatinum", "acctsUltraHni", "acctsPremium", "acctsGovt", "acctsTemple", "acctsContractors", "creditCards", "iobConnect", "netBanking", "casaWinbackCompleted", "nps", "ssy", "ppf", "jewelLoansFresh", "jewelLoansRenewal", "accidentInsurance", "socialMediaCount", "activationInoperative", "activationInoperativeAmt", "activationInactive", "activationInactiveAmt", "activationDeaf", "activationDeafAmt", "loanHousing", "loanVehicle", "loanPersonal", "loanMSME", "loanAgri", "acctsOpenedTAB", "fastag", "pmsby", "pmjjby"],
  "2nd Line": ["reductionInoperative", "reductionInactive", "reductionDeaf", "rekycCompleted", "nominationUpdated", "dqiProgress", "powerplayIntent"],
  "RO Guardian": ["roCampaignsChecked", "roNotes"],
  "LBO": ["fundingLowBal", "loanMSME", "loanAgri", "pmsby", "pmjjby"],
  "PO": ["growthSB", "growthCD", "growthTD", "loanHousing", "loanVehicle", "loanPersonal", "fastag", "acctsOpenedTAB"]
};

let roBroadcastMessage = "Welcome to the IOB Daily Performance Reporting Portal. Please ensure all daily metrics are submitted by 17:00 EOD.";
let globalSubmissions = [];
let lastSubmittedPayload = null;

function tagDOMWithParams() {
  for (let idOrName in INPUT_TO_PARAM) {
    const paramKey = INPUT_TO_PARAM[idOrName];
    const el = document.getElementById(idOrName) || document.querySelector(`[name="${idOrName}"]`);
    if (el) {
      let container = el.closest(".form-group") || el.closest(".form-checkbox-group") || el.closest("td") || el.closest("tr");
      if (container) {
        container.setAttribute("data-param", paramKey);
      }
    }
  }
}

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  // Load cached parameter mapping
  const cachedMapping = localStorage.getItem("iob_role_param_mapping");
  if (cachedMapping) {
    roleParamMapping = JSON.parse(cachedMapping);
  }
  
  const cachedTicker = localStorage.getItem("iob_ro_ticker");
  if (cachedTicker) {
    roBroadcastMessage = cachedTicker;
  }

  loadSettings();
  setupNavigation();
  setupFormHandlers();
  checkCachedSession();
  setupWizardBehavior();
  
  // Request system notification permission
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
  
  tagDOMWithParams();
  renderRoleParamMappingTable();
  initializeLottieLogos();
});

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

// Load configuration
function loadSettings() {
  const cachedSettings = localStorage.getItem("iob_portal_settings");
  if (cachedSettings) {
    const parsed = JSON.parse(cachedSettings);
    if (parsed.scriptUrl) {
      appSettings.scriptUrl = parsed.scriptUrl;
    }
    appSettings.mockMode = parsed.mockMode;
    appSettings.theme = parsed.theme || "system";
  } else {
    appSettings.theme = "system";
  }
  
  // Set in configuration inputs
  document.getElementById("google-script-url").value = appSettings.scriptUrl || "";
  document.getElementById("toggle-mock-mode").checked = appSettings.mockMode;
  document.getElementById("theme-select").value = appSettings.theme;
  
  applyTheme(appSettings.theme);
}

// Save configuration
document.getElementById("btn-save-settings").addEventListener("click", () => {
  const url = document.getElementById("google-script-url").value.trim();
  const mock = document.getElementById("toggle-mock-mode").checked;
  const theme = document.getElementById("theme-select").value;

  appSettings.scriptUrl = url;
  appSettings.mockMode = mock;
  appSettings.theme = theme;
  
  applyTheme(theme);
  
  localStorage.setItem("iob_portal_settings", JSON.stringify(appSettings));
  showToast("Settings saved successfully!");
});

// Draft auto-save helpers
function getDraftStorageKey() {
  if (!currentUser) return null;
  let solCode = "";
  const normRole = String(currentUser.role).trim().toUpperCase();
  if (normRole === "RO GUARDIAN") {
    const select = document.getElementById("guardian-sol-select");
    solCode = select ? select.value : "";
  } else {
    const sol = currentUser.branches && currentUser.branches[0];
    solCode = sol ? sol.solCode : "";
  }
  if (!solCode) return null;
  
  const formDate = document.getElementById("form-date").value || getTodayDateString();
  return `iob_draft_${currentUser.rollNumber}_${solCode}_${formDate}`;
}

function saveDraftToLocalStorage() {
  const key = getDraftStorageKey();
  if (!key) return;

  const form = document.getElementById("reporting-form");
  if (!form) return;

  const draftData = {};
  
  form.querySelectorAll("input, select, textarea").forEach(el => {
    // Only save mapped active fields (i.e. those that are visible / have data-param)
    let container = el.closest("[data-param]") || el.closest(".form-checkbox-group") || el.closest(".form-group");
    if (container && container.style.display === "none") return;

    const name = el.name || el.id;
    if (name) {
      if (el.type === "checkbox") {
        draftData[name] = el.checked;
      } else {
        draftData[name] = el.value;
      }
    }
  });

  localStorage.setItem(key, JSON.stringify(draftData));
}

function loadDraftFromLocalStorage() {
  const key = getDraftStorageKey();
  if (!key) return;

  const raw = localStorage.getItem(key);
  if (!raw) return;

  try {
    const draftData = JSON.parse(raw);
    const form = document.getElementById("reporting-form");
    if (!form) return;

    form.querySelectorAll("input, select, textarea").forEach(el => {
      const name = el.name || el.id;
      if (name && draftData[name] !== undefined) {
        if (el.type === "checkbox") {
          el.checked = draftData[name];
        } else {
          el.value = draftData[name];
        }
      }
    });

    updateGrowthStatusBadges();
  } catch (e) {
    console.error("Failed to load draft from localStorage", e);
  }
}

function clearDraftFromLocalStorage() {
  const key = getDraftStorageKey();
  if (key) {
    localStorage.removeItem(key);
  }
}

function setupDraftAutoSave() {
  const form = document.getElementById("reporting-form");
  if (form) {
    form.addEventListener("input", saveDraftToLocalStorage);
    form.addEventListener("change", saveDraftToLocalStorage);
  }
}

// Setup navigation actions
function setupNavigation() {
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-target");
      switchView(target);
      
      // Highlight tab
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
    });
  });

  // Logout button
  document.getElementById("logout-btn").addEventListener("click", () => {
    logout();
  });
}

function switchView(viewId) {
  // Guard access: if not logged in, force login view
  if (!currentUser && viewId !== "login-view") {
    viewId = "login-view";
  }

  // Guard access: if logged in, prevent bypassing role permissions
  if (currentUser) {
    const normRole = String(currentUser.role).trim().toUpperCase();
    const hasReports = ["RO SRM", "CHIEF MANAGER", "ADMIN", "RO GUARDIAN"].includes(normRole);
    const hasEntry = ["1ST LINE", "2ND LINE", "RO GUARDIAN", "LBO", "PO"].includes(normRole);
    const isAdmin = normRole === "ADMIN";

    if (viewId === "admin-view" && !isAdmin) {
      viewId = hasReports ? "dashboard-view" : "entry-view";
    }
    if (viewId === "settings-view" && !isAdmin) {
      viewId = hasReports ? "dashboard-view" : "entry-view";
    }
    if (viewId === "guardian-landing-view" && normRole !== "RO GUARDIAN") {
      viewId = hasReports ? "dashboard-view" : "entry-view";
    }
    if (viewId === "reports-view" && !hasReports) {
      viewId = "entry-view";
    }
    if (viewId === "dashboard-view" && !hasReports) {
      viewId = "entry-view";
    }
    if (viewId === "entry-view" && !hasEntry) {
      viewId = "dashboard-view";
    }
  }

  const panels = document.querySelectorAll(".view-panel");
  panels.forEach(p => p.classList.remove("active"));
  
  const targetPanel = document.getElementById(viewId);
  if (targetPanel) {
    targetPanel.classList.add("active");
    
    // Highlight matching navigation tab dynamically
    const tabs = document.querySelectorAll(".nav-tab");
    tabs.forEach(t => {
      if (t.getAttribute("data-target") === viewId) {
        t.classList.add("active");
      } else {
        t.classList.remove("active");
      }
    });
    
    // View-specific loading hooks
    if (viewId === "dashboard-view") {
      loadDashboardData();
    } else if (viewId === "reports-view") {
      loadReportsData();
    } else if (viewId === "guardian-landing-view") {
      loadGuardianLandingPage();
    } else if (viewId === "admin-view") {
      renderRoleParamMappingTable();
      document.getElementById("admin-ticker-input").value = roBroadcastMessage;
    }
  }
}

let pendingSessionData = null; // Cache session during password change
let pendingOldPassword = null; // The password used at login; required by the backend to change it

// Check session cache
function checkCachedSession() {
  try {
    const cached = localStorage.getItem("iob_user_session");
    if (!cached) {
      switchView("login-view");
      return;
    }
    const parsed = JSON.parse(cached);
    const user = parsed.user || parsed; // legacy sessions stored the bare user object
    const expired = parsed.expiresAt ? Date.now() > parsed.expiresAt : true;
    const hasToken = !!parsed.token;

    // Live mode requires a fresh token; legacy/expired sessions must log in again
    if (expired || (!appSettings.mockMode && !hasToken)) {
      localStorage.removeItem("iob_user_session");
      switchView("login-view");
      return;
    }
    currentUser = user;
    sessionToken = parsed.token || null;
    setupSessionUI();
  } catch (e) {
    console.error("Corrupt session cache", e);
    localStorage.removeItem("iob_user_session");
    switchView("login-view");
  }
}

// User Authenticate Handler
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const rollNumber = document.getElementById("login-roll").value.trim();
  const password = document.getElementById("login-pass").value.trim();
  if (!rollNumber || !password) return;

  showToast("Authenticating...");
  
  if (appSettings.mockMode) {
    // Simulated authenticate
    const key = rollNumber.toUpperCase();
    const user = mockUsers[key];
    if (user) {
      // Validate password (mock-only demo credentials, not real ones)
      let mockPasswords = JSON.parse(localStorage.getItem("iob_mock_passwords") || "{}");
      const defaultPassword = (user.role === "Admin") ? "admin123" : rollNumber;
      const currentPassword = mockPasswords[rollNumber] || defaultPassword;
      
      if (password !== currentPassword) {
        showToast("Incorrect password. Default is your Roll Number.");
        return;
      }

      // Find branches in scope
      let userBranches = [];
      const isGlobal = ["RO SRM", "Chief Manager", "Admin"].includes(user.role) || user.assignedSols.includes("*");
      
      mockBranches.forEach(br => {
        if (isGlobal || 
            (user.role === "RO Guardian" && br.roGuardianRoll === rollNumber) || 
            user.assignedSols.includes(br.solCode)) {
          userBranches.push(br);
        }
      });

      const userRecord = {
        rollNumber: rollNumber,
        name: user.name,
        role: user.role,
        assignedSols: user.assignedSols,
        branches: userBranches
      };

      // Check first login password change constraint (except admin)
      const isDefault = (password === rollNumber && user.role !== "Admin");
      if (isDefault) {
        pendingOldPassword = password;
        showChangePasswordModal(userRecord);
        return;
      }

      saveSession(null, userRecord);
      setupSessionUI();
      showToast(`Welcome back, ${currentUser.name}!`);
    } else {
      showToast("Invalid roll number (Mock list: 1001, 2001, 3001, 9001, CHIEF, ADMIN)");
    }
  } else {
    // API authenticate: POST so credentials never appear in URLs or server logs
    if (!appSettings.scriptUrl) {
      showToast("Web App URL configuration is missing in Settings!");
      return;
    }
    try {
      const result = await apiPost({ action: "login", rollNumber: rollNumber, password: password }, { noAuth: true });
      if (result.success) {
        if (result.mustChangePassword) {
          pendingOldPassword = password;
          showChangePasswordModal(result.user);
          return;
        }
        saveSession(result.token, result.user);
        setupSessionUI();
        showToast(`Welcome back, ${currentUser.name}!`);
      } else {
        showToast(result.error || "Authentication failed");
      }
    } catch (err) {
      console.error(err);
      showToast("Server connection error during login.");
    }
  }
});

function showChangePasswordModal(userRecord) {
  pendingSessionData = userRecord;
  document.getElementById("change-password-modal").classList.add("open");
}

document.getElementById("change-password-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const newPass = document.getElementById("new-password").value;
  const confirmPass = document.getElementById("confirm-password").value;

  if (newPass.length < 8) {
    showToast("Password must be at least 8 characters long.");
    return;
  }

  if (newPass !== confirmPass) {
    showToast("Passwords do not match!");
    return;
  }

  showToast("Updating password...");

  if (appSettings.mockMode) {
    let mockPasswords = JSON.parse(localStorage.getItem("iob_mock_passwords") || "{}");
    mockPasswords[pendingSessionData.rollNumber] = newPass;
    localStorage.setItem("iob_mock_passwords", JSON.stringify(mockPasswords));

    saveSession(null, pendingSessionData);
    pendingOldPassword = null;

    document.getElementById("change-password-modal").classList.remove("open");
    setupSessionUI();
    showToast("Password changed successfully! You are logged in.");
    document.getElementById("change-password-form").reset();
  } else {
    try {
      // The backend verifies the current password and returns a fresh session token
      const result = await apiPost({
        action: "changePassword",
        rollNumber: pendingSessionData.rollNumber,
        oldPassword: pendingOldPassword,
        newPassword: newPass
      }, { noAuth: true });
      if (result.success) {
        saveSession(result.token, result.user || pendingSessionData);
        pendingOldPassword = null;

        document.getElementById("change-password-modal").classList.remove("open");
        setupSessionUI();
        showToast("Password changed successfully! You are logged in.");
        document.getElementById("change-password-form").reset();
      } else {
        showToast(result.error || "Failed to update password.");
      }
    } catch (err) {
      console.error(err);
      showToast("Network failure updating password.");
    }
  }
});

// Configure Portal UI elements based on roles
function setupSessionUI() {
  // Normalize branches on session startup to prevent undefined array crashes
  if (currentUser) {
    if (!currentUser.branches) currentUser.branches = [];
    currentUser.branches = currentUser.branches.map(normalizeBranch).filter(Boolean);
  }
  document.getElementById("login-view").classList.remove("active");
  document.getElementById("user-info-bar").style.display = "flex";
  document.getElementById("main-navigation").style.display = "flex";
  
  // Display the admin announcement ticker
  document.getElementById("admin-ticker-bar").style.display = "flex";
  document.getElementById("admin-ticker-text").textContent = roBroadcastMessage;
  
  document.getElementById("user-display-name").textContent = currentUser.name;
  document.getElementById("user-display-role").textContent = currentUser.role;

  // Set the default date field values
  const todayStr = getTodayDateString();
  document.getElementById("form-date").value = todayStr;
  document.getElementById("report-date-filter").value = todayStr;
  document.getElementById("admin-target-date").value = todayStr;

  // Filter navigation buttons (case-insensitive and trimmed for robustness)
  const normRole = String(currentUser.role).trim().toUpperCase();
  const hasReports = ["RO SRM", "CHIEF MANAGER", "ADMIN", "RO GUARDIAN"].includes(normRole);
  const hasEntry = ["1ST LINE", "2ND LINE", "RO GUARDIAN", "LBO", "PO"].includes(normRole);
  const isAdmin = normRole === "ADMIN";
  const isGuardian = normRole === "RO GUARDIAN";
  
  const navReports = document.getElementById("nav-reports");
  const navAdmin = document.getElementById("nav-admin");
  const navEntry = document.getElementById("nav-entry-form");
  const navSettings = document.getElementById("nav-settings");
  const navGuardian = document.getElementById("nav-guardian-branches");

  navReports.style.display = hasReports ? "block" : "none";
  navEntry.style.display = hasEntry ? "block" : "none";
  if (navGuardian) {
    navGuardian.style.display = isGuardian ? "block" : "none";
  }

  if (hasEntry) {
    setupReportingForm();
  }

  if (isAdmin) {
    navAdmin.style.display = "block";
    navSettings.style.display = "block";
  } else {
    navAdmin.style.display = "none";
    navSettings.style.display = "none";
  }

  // Redirect to start panel
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach(t => t.classList.remove("active"));
  
  if (isGuardian) {
    if (navGuardian) navGuardian.classList.add("active");
    switchView("guardian-landing-view");
  } else if (hasReports) {
    tabs[0].classList.add("active"); // Live dashboard
    switchView("dashboard-view");
  } else {
    const entryTab = document.getElementById("nav-entry-form");
    if (entryTab) entryTab.classList.add("active");
    switchView("entry-view");
  }
}

// Setup entry form layouts based on user scope
function setupReportingForm() {
  const role = currentUser.role;
  const solSelect = document.getElementById("guardian-sol-select");
  const isGuardian = String(role).trim().toUpperCase() === "RO GUARDIAN";
  if (solSelect) {
    solSelect.required = isGuardian;
  }

  const branchHeading = document.getElementById("form-branch-heading");
  
  // Set heading and load bases
  if (isGuardian) {
    branchHeading.textContent = "Guardian Multi-Branch Supervisor Review";
    
    // Only build the options list if it's empty to prevent resetting selection loops!
    if (solSelect.children.length === 0) {
      solSelect.innerHTML = "";
      currentUser.branches.forEach(br => {
        const opt = document.createElement("option");
        opt.value = br.solCode;
        opt.textContent = `${br.solCode} - ${br.branchName}`;
        solSelect.appendChild(opt);
      });

      if (currentUser.branches.length > 0) {
        loadBranchBases(currentUser.branches[0].solCode);
      }
    }
  } else {
    const sol = currentUser.branches[0] || { solCode: "???", branchName: "Unknown Branch" };
    branchHeading.textContent = `${role} Daily Reporting Panel: ${sol.solCode} - ${sol.branchName}`;
    loadBranchBases(sol.solCode);
  }

  // Apply role-based field/card visibility and (re)build the wizard steps,
  // starting the user at the first step.
  applyReportingFormLayout(true);
}

// Applies role-based visibility to fields/cards and rebuilds the wizard steps.
// Split out from setupReportingForm so a mid-session refresh (e.g. a fresh
// roleParamMapping arriving from the server) can re-apply the layout WITHOUT
// re-loading branch bases — which would recurse through loadBranchBases and
// fetchDashboardTelemetry — or snapping the wizard back to the first step.
// resetStep=true jumps to step 1 (initial setup / after submit); false keeps
// the user's current step, clamped to the new step range.
function applyReportingFormLayout(resetStep) {
  const role = currentUser.role;

  // Display sections containing metrics (guard against absent wrappers so a
  // single missing id can't abort the whole form/wizard setup)
  ["form-1st-line-section", "form-2nd-line-section", "form-ro-guardian-section", "form-loans-section"].forEach(sectionId => {
    const section = document.getElementById(sectionId);
    if (section) section.style.display = "block";
  });

  // Hide/Show inputs according to parameters mapping
  const activeParams = roleParamMapping[role] || [];
  
  // 1. Hide/Show individual mapped inputs
  document.querySelectorAll("[data-param]").forEach(container => {
    const key = container.getAttribute("data-param");
    if (activeParams.includes(key)) {
      container.style.display = "";
    } else {
      container.style.display = "none";
    }
  });

  // 2. Hide/Show parent cards
  const cards = document.querySelectorAll("#reporting-form .card");
  const normRole = String(currentUser.role).trim().toUpperCase();
  const isGuardianUser = currentUser && normRole === "RO GUARDIAN";

  // Handle static status card visibility explicitly
  const cardStatus = document.getElementById("card-status");
  if (cardStatus) {
    const is2ndLineOrMgmt = ["2ND LINE", "ADMIN", "CHIEF MANAGER", "RO SRM"].includes(normRole);
    cardStatus.style.display = is2ndLineOrMgmt ? "" : "none";
  }

  cards.forEach(card => {
    // If the card is the submit panel/wizard navigation bar, keep it visible!
    if (card.id === "wizard-navigation-bar" || card.querySelector("#wizard-navigation-bar")) {
      card.style.display = "";
      return;
    }
    
    // If the card is marked as reference data, show it to RO Guardians
    if (isGuardianUser && card.hasAttribute("data-reference-card")) {
      card.style.display = "";
      return;
    }

    const params = card.querySelectorAll("[data-param]");
    if (params.length > 0) {
      let hasVisible = false;
      params.forEach(p => {
        if (p.style.display !== "none") {
          hasVisible = true;
        }
      });
      card.style.display = hasVisible ? "" : "none";
    }
  });

  // Collect visible cards for the wizard steps. Only collapsible metric cards
  // are steps; the date/branch header and the navigation bar are plain .card
  // elements that must stay persistent across every step.
  wizardCards = [];
  cards.forEach(card => {
    if (!card.classList.contains("collapsible-card")) {
      return;
    }
    if (card.style.display !== "none") {
      wizardCards.push(card);
    }
  });

  if (resetStep) {
    currentStepIndex = 0;
  } else if (currentStepIndex > wizardCards.length - 1) {
    currentStepIndex = Math.max(0, wizardCards.length - 1);
  }
  updateWizardView();
}

// Fetch historical and monthly base numbers for reference
function loadBranchBases(solCode) {
  const form = document.getElementById("reporting-form");
  if (form) {
    // Preserve the chosen reporting date across form.reset() (which would
    // otherwise blank the required date field and block submission).
    const dateInput = document.getElementById("form-date");
    const preservedDate = (dateInput && dateInput.value) ? dateInput.value : getTodayDateString();
    form.reset();
    if (dateInput) dateInput.value = preservedDate;
  }

  if (appSettings.mockMode) {
    renderBranchBases(mockDailyBase[solCode] || {}, mockMonthlyBase[solCode] || {});
  } else {
    // Fetches base fields via Dashboard endpoint
    fetchDashboardTelemetry(solCode);
  }
}

// Writes admin-ingested reference figures into the entry form grids
function renderBranchBases(dBase, mBase) {
  currentBranchBases = { daily: dBase, monthly: mBase };
  updateGrowthStatusBadges();
  
  // Update 2nd Line status indicators automatically
  const statusSB = growthStatusVs31Mar("SB", 0);
  const statusCD = growthStatusVs31Mar("CD", 0);
  const statusTD = growthStatusVs31Mar("TD", 0);
  const totalYestSBCD = (Number(dBase.yestBalSB) || 0) + (Number(dBase.yestBalCD) || 0);
  const totalBaseSBCD = (Number(mBase.bal31MarSB) || 0) + (Number(mBase.bal31MarCD) || 0);
  const statusCASA = totalYestSBCD >= totalBaseSBCD ? "Positive" : "Negative";

  [["sb", statusSB], ["cd", statusCD], ["td", statusTD], ["casa", statusCASA]].forEach(([segment, status]) => {
    const el = document.getElementById(`2nd-status-${segment}`);
    if (el) {
      el.textContent = status;
      el.className = `badge badge-${status === "Positive" ? "success" : "danger"}`;
    }
  });

  const summaryStatus = document.getElementById("summary-status");
  if (summaryStatus) {
    summaryStatus.innerHTML = `
      <span class="summary-badge ${statusSB === 'Positive' ? 'badge-success' : 'badge-danger'}">SB: ${statusSB}</span>
      <span class="summary-badge ${statusCD === 'Positive' ? 'badge-success' : 'badge-danger'}">CD: ${statusCD}</span>
      <span class="summary-badge ${statusCASA === 'Positive' ? 'badge-success' : 'badge-danger'}">CASA: ${statusCASA}</span>
    `;
  }

  // Low balance funding grid: totals come from admin monthly ingestion
  document.getElementById("low-bal-total-sb").textContent = mBase.baseLowBalSB || 0;
  document.getElementById("low-bal-total-cd").textContent = mBase.baseLowBalCD || 0;

  // Balance growth grid: 31 March closing and yesterday's balance from admin ingestion
  document.getElementById("bal-31mar-sb").textContent = formatCurrency(mBase.bal31MarSB || 0);
  document.getElementById("bal-31mar-cd").textContent = formatCurrency(mBase.bal31MarCD || 0);
  document.getElementById("bal-31mar-td").textContent = formatCurrency(mBase.bal31MarTD || 0);
  document.getElementById("bal-yest-sb").textContent = formatCurrency(dBase.yestBalSB || 0);
  document.getElementById("bal-yest-cd").textContent = formatCurrency(dBase.yestBalCD || 0);
  document.getElementById("bal-yest-td").textContent = formatCurrency(dBase.yestBalTD || 0);

  // Account opening: monthly target and run rate up to yesterday, gap computed
  const aoTargetSB = Number(mBase.targetAcctsSB) || 0;
  const aoTargetCD = Number(mBase.targetAcctsCD) || 0;
  const aoYestSB = Number(dBase.uptoYestAcctsSB) || 0;
  const aoYestCD = Number(dBase.uptoYestAcctsCD) || 0;
  document.getElementById("ao-target-sb").textContent = aoTargetSB;
  document.getElementById("ao-uptoyest-sb").textContent = aoYestSB;
  document.getElementById("ao-gap-sb").textContent = Math.max(0, aoTargetSB - aoYestSB);
  document.getElementById("ao-target-cd").textContent = aoTargetCD;
  document.getElementById("ao-uptoyest-cd").textContent = aoYestCD;
  document.getElementById("ao-gap-cd").textContent = Math.max(0, aoTargetCD - aoYestCD);

  // Premium product adoption references (FY / prev month from monthly, current month from daily)
  [["StepUpRD", "stepuprd"], ["Platinum", "platinum"], ["UltraHni", "uhni"], ["Premium", "premium"]].forEach(([key, slug]) => {
    document.getElementById(`pa-fy-${slug}`).textContent = Number(mBase["fy" + key]) || 0;
    document.getElementById(`pa-prev-${slug}`).textContent = Number(mBase["prevMonth" + key]) || 0;
    document.getElementById(`pa-curr-${slug}`).textContent = Number(dBase["currMonth" + key]) || 0;
  });

  // CASA winback allotment
  document.getElementById("casa-winback-allotted").textContent = dBase.allottedCasaWinback || 0;

  // 1st Line activation grid bases (last month end: count and amount)
  document.getElementById("act-base-count-inoperative").textContent = mBase.baseInoperativeAccts || 0;
  document.getElementById("act-base-amt-inoperative").textContent = formatCurrency(mBase.baseInoperativeAmt || 0);
  document.getElementById("act-base-count-inactive").textContent = mBase.baseInactiveAccts || 0;
  document.getElementById("act-base-amt-inactive").textContent = formatCurrency(mBase.baseInactiveAmt || 0);
  document.getElementById("act-base-count-deaf").textContent = mBase.baseDeafAccts || 0;
  document.getElementById("act-base-amt-deaf").textContent = formatCurrency(mBase.baseDeafAmt || 0);

  // 2nd Line reactivation grid
  document.getElementById("base-inoperative").textContent = mBase.baseInoperativeAccts || 0;
  document.getElementById("base-inactive").textContent = mBase.baseInactiveAccts || 0;
  document.getElementById("base-deaf").textContent = mBase.baseDeafAccts || 0;
  
  loadDraftFromLocalStorage();
  updateAccordionSummaries(dBase, mBase);
}

async function fetchDashboardTelemetry(solCode) {
  if (!appSettings.scriptUrl) return;
  try {
    const dateFilter = document.getElementById("form-date").value || getTodayDateString();
    const data = await apiPost({ action: "getDashboardData", dateFilter: dateFilter, solCodeFilter: solCode });
    if (data.success) {
      let dBase = (data.dailyBase && data.dailyBase[solCode]) || {};
      let mBase = (data.monthlyBase && data.monthlyBase[solCode]) || {};
      
      dBase = normalizeBase(dBase);
      mBase = normalizeBase(mBase);
      
      if (data.roleParamMapping) {
        roleParamMapping = data.roleParamMapping;
        localStorage.setItem("iob_role_param_mapping", JSON.stringify(roleParamMapping));
        // Re-apply layout only — must NOT call setupReportingForm here, which
        // would loadBranchBases -> fetchDashboardTelemetry again (infinite
        // refresh) and reset the wizard to step 1 mid-navigation.
        applyReportingFormLayout(false);
      }
      
      if (data.roBroadcastMessage) {
        roBroadcastMessage = data.roBroadcastMessage;
        localStorage.setItem("iob_ro_ticker", roBroadcastMessage);
        const textEl = document.getElementById("admin-ticker-text");
        if (textEl) textEl.textContent = roBroadcastMessage;
      }
      
      renderBranchBases(dBase, mBase);
    }
  } catch (e) {
    console.error("Bases load fail", e);
  }
}

// Submitting Reporting Form
function setupFormHandlers() {
  setupDraftAutoSave();
  const form = document.getElementById("reporting-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Client-side negative value validation
    const allowedNegativeIds = ["sb-growth", "cd-growth", "td-growth"];
    let validationFailed = false;
    form.querySelectorAll("input[type='number']").forEach(input => {
      let container = input.closest("[data-param]") || input.closest(".form-checkbox-group") || input.closest(".form-group");
      if (container && container.style.display === "none") return;
      
      const val = Number(input.value) || 0;
      if (val < 0 && !allowedNegativeIds.includes(input.id)) {
        let labelText = "";
        const labelEl = input.labels && input.labels[0];
        if (labelEl) {
          labelText = labelEl.textContent;
        } else {
          const parent = input.closest(".form-group") || input.closest("td") || input.closest("tr");
          const label = parent ? parent.querySelector("label") || parent.querySelector("strong") : null;
          labelText = label ? label.textContent : (input.name || input.id);
        }
        showToast(`Field "${labelText.replace(/\(.*\)/g, "").replace(/:/g, "").trim()}" cannot be negative.`);
        input.focus();
        validationFailed = true;
      }
    });
    if (validationFailed) return;

    // Resolve reporting SOL Details
    let solCode = "";
    let branchName = "";
    const normRole = String(currentUser.role).trim().toUpperCase();
    
    if (normRole === "RO GUARDIAN") {
      solCode = document.getElementById("guardian-sol-select").value;
      const match = currentUser.branches.find(b => b.solCode === solCode);
      branchName = match ? match.branchName : "";
    } else {
      const sol = currentUser.branches[0];
      solCode = sol ? sol.solCode : "";
      branchName = sol ? sol.branchName : "";
    }

    if (!solCode) {
      showToast("SOL branch code could not be resolved.");
      return;
    }

    const payload = {
      action: "submitReport",
      reportingDate: document.getElementById("form-date").value,
      "Reporting Date": document.getElementById("form-date").value,
      rollNumber: currentUser.rollNumber,
      "Roll Number": currentUser.rollNumber,
      submitterName: currentUser.name,
      "Submitter Name": currentUser.name,
      "Submitter Nam": currentUser.name,
      role: currentUser.role,
      "Role": currentUser.role,
      solCode: solCode,
      "SOL Code": solCode,
      branchName: branchName,
      "Branch Name": branchName
    };

    // Serialize Form Fields dynamically based on role's parameter configuration
    const formData = new FormData(form);
    const matchedKey = Object.keys(roleParamMapping).find(k => k.trim().toUpperCase() === normRole);
    const activeParams = roleParamMapping[currentUser.role] || roleParamMapping[matchedKey] || [];
    
    activeParams.forEach(paramKey => {
      const idOrNames = Object.keys(INPUT_TO_PARAM).filter(k => INPUT_TO_PARAM[k] === paramKey);
      idOrNames.forEach(idOrName => {
        const el = document.getElementById(idOrName) || document.querySelector(`[name="${idOrName}"]`);
        if (el) {
          let container = el.closest("[data-param]");
          if (container && container.style.display === "none") return;
          
          let val = null;
          if (el.type === "checkbox") {
            val = el.checked ? "Yes" : "No";
          } else if (el.type === "number") {
            val = Number(el.value) || 0;
          } else {
            val = el.value.trim();
          }
          
          if (paramKey === "fundingLowBal") {
            payload.fundingSB = Number(formData.get("fundingSB")) || 0;
            payload.fundingCD = Number(formData.get("fundingCD")) || 0;
            payload.fundingLowBal = payload.fundingSB + payload.fundingCD;
          } else if (paramKey === "growthSB") {
            payload.growthSB = Number(formData.get("growthSB")) || 0;
            payload.statusSB = growthStatusVs31Mar("SB", payload.growthSB);
          } else if (paramKey === "growthCD") {
            payload.growthCD = Number(formData.get("growthCD")) || 0;
            payload.statusCD = growthStatusVs31Mar("CD", payload.growthCD);
          } else if (paramKey === "growthTD") {
            payload.growthTD = Number(formData.get("growthTD")) || 0;
            payload.statusTD = growthStatusVs31Mar("TD", payload.growthTD);
          } else if (paramKey === "acctsOpened") {
            payload.acctsOpened = (Number(formData.get("acctsOpenedSB")) || 0) + (Number(formData.get("acctsOpenedCD")) || 0);
            payload.acctsOpenedSB = Number(formData.get("acctsOpenedSB")) || 0;
            payload.acctsOpenedCD = Number(formData.get("acctsOpenedCD")) || 0;
          } else {
            const fieldName = el.name || el.id;
            payload[fieldName] = val;
          }
        }
      });
    });

    // Automatically calculate and append status parameters for 2nd Line submissions
    if (normRole === "2ND LINE") {
      payload.statusSB = growthStatusVs31Mar("SB", 0);
      payload.statusCD = growthStatusVs31Mar("CD", 0);
      payload.statusTD = growthStatusVs31Mar("TD", 0);
      
      const totalYestSBCD = (Number(currentBranchBases.daily.yestBalSB) || 0) + (Number(currentBranchBases.daily.yestBalCD) || 0);
      const totalBaseSBCD = (Number(currentBranchBases.monthly.bal31MarSB) || 0) + (Number(currentBranchBases.monthly.bal31MarCD) || 0);
      payload.statusCASA = totalYestSBCD >= totalBaseSBCD ? "Positive" : "Negative";
    }

    // Submit payload
    showToast("Submitting performance report...");
    
    if (appSettings.mockMode) {
      // Mock submit
      const record = normalizeSubmission(payload);
      record.timestamp = new Date().toISOString();
      mockSubmissions.push(record);
      globalSubmissions.push(record);
      lastSubmittedPayload = payload;
      clearDraftFromLocalStorage();
      form.reset();
      document.getElementById("form-date").value = getTodayDateString();
      updateGrowthStatusBadges();
      showToast("Report submitted successfully (Mock Offline)!");
      triggerSubmitNotification(solCode, currentUser.role);
      showSuccessPage(solCode);
    } else {
      try {
        const result = await apiPost(payload);
        if (result.success) {
          lastSubmittedPayload = payload;
          clearDraftFromLocalStorage();
          form.reset();
          document.getElementById("form-date").value = getTodayDateString();
          updateGrowthStatusBadges();
          
          // Pre-fetch live status behind-the-scenes so Guardian audited branches is up to date
          if (normRole === "RO GUARDIAN") {
            try {
              const data = await apiPost({ action: "getDashboardData" });
              if (data.success) {
                globalSubmissions = (data.submissions || []).map(normalizeSubmission);
              }
            } catch (e) {
              console.error(e);
            }
          }
          
          showToast(result.updated
            ? "Existing report for this date was updated in Google Sheets!"
            : "Performance report logged successfully in Google Sheets!");
          triggerSubmitNotification(solCode, currentUser.role);
          showSuccessPage(solCode);
        } else {
          showToast(result.error || "Submission failure.");
        }
      } catch (err) {
        console.error(err);
        showToast("Network fail when writing to Google Sheets.");
      }
    }
  });

  // Guardian branch selector refreshes that branch's bases
  document.getElementById("guardian-sol-select").addEventListener("change", (e) => {
    loadBranchBases(e.target.value);
  });

  // Guardian Back to Branch list button
  const btnGuardianBack = document.getElementById("btn-guardian-back");
  if (btnGuardianBack) {
    btnGuardianBack.addEventListener("click", () => {
      switchView("guardian-landing-view");
    });
  }

  // Form date selector refreshes bases for that selected date
  document.getElementById("form-date").addEventListener("change", () => {
    let solCode = "";
    if (currentUser.role === "RO Guardian") {
      solCode = document.getElementById("guardian-sol-select").value;
    } else if (currentUser.branches && currentUser.branches[0]) {
      solCode = currentUser.branches[0].solCode;
    }
    if (solCode) {
      loadBranchBases(solCode);
    }
  });

  // Live auto-status badges for the balance growth grid
  ["sb-growth", "cd-growth", "td-growth"].forEach(id => {
    document.getElementById(id).addEventListener("input", updateGrowthStatusBadges);
  });

  // Search filter inside dashboard
  document.getElementById("db-search").addEventListener("input", (e) => {
    filterDashboardGrid(e.target.value.trim());
  });

  // Reports data filter listeners
  document.getElementById("report-date-filter").addEventListener("change", () => {
    loadReportsData();
  });
  document.getElementById("report-search-filter").addEventListener("input", () => {
    filterReportsTable();
  });

  // Modal Close
  document.getElementById("modal-close-btn").addEventListener("click", () => {
    document.getElementById("detail-modal").classList.remove("open");
  });

  // CSV uploader fields
  setupAdminDropzone("dropzone-unified-targets", "file-unified-targets", "status-upload-unified", parseUnifiedCSV);
  setupAdminDropzone("dropzone-master-branches", "file-master-branches", "status-upload-master-branches", parseMasterBranchesCSV);
  setupAdminDropzone("dropzone-master-users", "file-master-users", "status-upload-master-users", parseMasterUsersCSV);

  // CSV Template downloads
  document.getElementById("btn-download-template").addEventListener("click", () => {
    downloadCSVTemplate();
  });
  document.getElementById("btn-download-branch-template").addEventListener("click", () => {
    downloadMasterBranchTemplate();
  });
  document.getElementById("btn-download-user-template").addEventListener("click", () => {
    downloadMasterUserTemplate();
  });

  // Admin targets save button
  document.getElementById("btn-admin-submit").addEventListener("click", () => {
    submitUnifiedTargets();
  });

  // Admin master data save button
  document.getElementById("btn-master-submit").addEventListener("click", () => {
    submitMasterData();
  });

  // CSV Export Trigger
  document.getElementById("btn-export-csv").addEventListener("click", () => {
    exportConsolidatedCSV();
  });

  // Admin password reset button
  document.getElementById("btn-reset-password").addEventListener("click", async () => {
    const targetRoll = document.getElementById("reset-user-roll").value.trim();
    if (!targetRoll) {
      showToast("Please enter a User Roll Number to reset.");
      return;
    }
    
    showToast("Resetting password...");
    
    if (appSettings.mockMode) {
      const match = mockUsers[targetRoll.toUpperCase()] || (mockUsers[targetRoll]);
      if (!match) {
        showToast("User Roll Number not found in mock data.");
        return;
      }
      let mockPasswords = JSON.parse(localStorage.getItem("iob_mock_passwords") || "{}");
      delete mockPasswords[targetRoll]; // Deleting custom password resets it to default
      localStorage.setItem("iob_mock_passwords", JSON.stringify(mockPasswords));
      showToast(`Password for Roll ${targetRoll} has been reset to default (${targetRoll})!`);
      document.getElementById("reset-user-roll").value = "";
    } else {
      try {
        const result = await apiPost({
          action: "resetUserPassword",
          targetRollNumber: targetRoll
        });
        if (result.success) {
          showToast(`Password for Roll ${targetRoll} has been reset to default successfully!`);
          document.getElementById("reset-user-roll").value = "";
        } else {
          showToast(result.error || "Failed to reset password.");
        }
      } catch (err) {
        console.error(err);
        showToast("Network fail trying to reset password.");
      }
    }
  });

  // Save parameter configurations
  const btnSaveMapping = document.getElementById("btn-save-param-mapping");
  if (btnSaveMapping) {
    btnSaveMapping.addEventListener("click", async () => {
      showToast("Saving parameter mapping...");
      
      // Rebuild the role parameter mapping from checkboxes
      const checkboxes = document.querySelectorAll(".param-map-check");
      const newMapping = {
        "1st Line": [],
        "2nd Line": [],
        "RO Guardian": [],
        "LBO": [],
        "PO": []
      };
      
      checkboxes.forEach(cb => {
        const param = cb.getAttribute("data-param");
        const role = cb.getAttribute("data-role");
        if (cb.checked) {
          newMapping[role].push(param);
        }
      });
      
      roleParamMapping = newMapping;
      localStorage.setItem("iob_role_param_mapping", JSON.stringify(roleParamMapping));
      
      if (appSettings.mockMode) {
        showToast("Parameter configurations saved successfully in local mock mode!");
      } else {
        if (!appSettings.scriptUrl) {
          showToast("Google Web App URL must be configured!");
          return;
        }
        try {
          const result = await apiPost({
            action: "saveRoleParamMapping",
            mapping: roleParamMapping
          });
          if (result.success) {
            showToast("Parameter mapping saved successfully to Google Sheets!");
          } else {
            showToast(result.error || "Failed to save parameter mapping.");
          }
        } catch (e) {
          console.error(e);
          showToast("Network fail saving parameter mappings.");
        }
      }
    });
  }

  // Save ticker message
  const btnSaveTicker = document.getElementById("btn-save-ticker");
  if (btnSaveTicker) {
    btnSaveTicker.addEventListener("click", async () => {
      const text = document.getElementById("admin-ticker-input").value.trim();
      if (!text) {
        showToast("Broadcast message cannot be empty!");
        return;
      }
      
      showToast("Updating broadcast message...");
      
      roBroadcastMessage = text;
      localStorage.setItem("iob_ro_ticker", roBroadcastMessage);
      
      const tickerText = document.getElementById("admin-ticker-text");
      if (tickerText) tickerText.textContent = roBroadcastMessage;
      
      if (appSettings.mockMode) {
        showToast("Announcement message updated in local mock session!");
      } else {
        if (!appSettings.scriptUrl) {
          showToast("Google Web App URL must be configured!");
          return;
        }
        try {
          const result = await apiPost({
            action: "saveTickerMessage",
            message: roBroadcastMessage
          });
          if (result.success) {
            showToast("Broadcast message successfully pushed to Google Sheet!");
          } else {
            showToast(result.error || "Failed to update broadcast message.");
          }
        } catch (e) {
          console.error(e);
          showToast("Network fail updating broadcast message.");
        }
      }
    });
  }

  // Success view action button click listener
  document.getElementById("btn-success-action").addEventListener("click", () => {
    const normRole = String(currentUser.role).trim().toUpperCase();
    if (normRole === "RO GUARDIAN") {
      loadGuardianLandingPage();
    } else {
      setupReportingForm();
      switchView("entry-view");
    }
  });

  // Success view download WhatsApp image click listener
  document.getElementById("btn-download-share-img").addEventListener("click", () => {
    const solCode = document.getElementById("success-sol").textContent;
    generateWhatsAppStatusImage(solCode);
  });
}

function showSuccessPage(solCode) {
  const normRole = String(currentUser.role).trim().toUpperCase();
  
  // 1. Populate static submitter details card
  document.getElementById("success-date").textContent = document.getElementById("form-date").value || getTodayDateString();
  document.getElementById("success-sol").textContent = solCode;
  document.getElementById("success-name").textContent = currentUser.name || "Unknown Submitter";
  document.getElementById("success-role").textContent = currentUser.role || "Unknown Role";
  
  // 2. Clear previous list
  const listEl = document.getElementById("success-branches-list");
  listEl.innerHTML = "";
  
  // 3. Handle view based on role
  const guardianSection = document.getElementById("success-guardian-summary");
  const actionBtn = document.getElementById("btn-success-action");
  
  if (normRole === "RO GUARDIAN") {
    guardianSection.style.display = "block";
    actionBtn.textContent = "Back to Branch Selection";
    
    const todayStr = document.getElementById("form-date").value || getTodayDateString();
    
    const assignedBranches = (currentUser && currentUser.branches) || [];
    assignedBranches.forEach(b => {
      const hasSubmitted = globalSubmissions.some(sub => {
        const subSol = String(sub.solCode).trim();
        const subRole = String(sub.role).trim().toUpperCase();
        const subDate = sub.reportingDate;
        return subSol === String(b.solCode).trim() && 
               subRole === "RO GUARDIAN" && 
               subDate === todayStr;
      });
      
      const item = document.createElement("div");
      item.style.display = "flex";
      item.style.justifyContent = "space-between";
      item.style.alignItems = "center";
      item.style.padding = "0.5rem 0.75rem";
      item.style.border = "1px solid var(--border-color)";
      item.style.borderRadius = "0.375rem";
      item.style.backgroundColor = "var(--card-bg)";
      item.style.marginBottom = "0.25rem";
      
      const titleSpan = document.createElement("span");
      titleSpan.innerHTML = `<strong style="color: var(--text-primary); font-size: 0.875rem;">${b.solCode}</strong> - <span style="font-size: 0.8rem; color: var(--text-secondary);">${b.branchName}</span>`;
      
      const statusBadge = document.createElement("span");
      statusBadge.style.fontSize = "0.7rem";
      statusBadge.style.fontWeight = "600";
      statusBadge.style.padding = "0.2rem 0.6rem";
      statusBadge.style.borderRadius = "9999px";
      
      if (hasSubmitted) {
        statusBadge.textContent = "✔️ AUDITED";
        statusBadge.style.backgroundColor = "rgba(16, 185, 129, 0.1)";
        statusBadge.style.color = "var(--success)";
        statusBadge.style.border = "1px solid rgba(16, 185, 129, 0.15)";
      } else {
        statusBadge.textContent = "❌ PENDING";
        statusBadge.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
        statusBadge.style.color = "var(--danger)";
        statusBadge.style.border = "1px solid rgba(239, 68, 68, 0.15)";
      }
      
      item.appendChild(titleSpan);
      item.appendChild(statusBadge);
      listEl.appendChild(item);
    });
  } else {
    guardianSection.style.display = "none";
    actionBtn.textContent = "Back to Entry Form";
  }
  
  // 4. Show success view
  switchView("success-view");
}

// Dynamic dashboard compiler
async function loadDashboardData() {
  const dateStr = getTodayDateString();
  let branches = [];
  let submissions = [];
  
  if (appSettings.mockMode) {
    const isGlobal = ["RO SRM", "Chief Manager", "Admin"].includes(currentUser.role) || currentUser.assignedSols.includes("*");
    if (isGlobal) {
      branches = mockBranches;
      submissions = mockSubmissions.map(normalizeSubmission).filter(s => s.reportingDate === dateStr);
    } else {
      branches = currentUser.branches;
      const allowedSols = branches.map(b => b.solCode);
      submissions = mockSubmissions.map(normalizeSubmission)
                                   .filter(s => s.reportingDate === dateStr && allowedSols.includes(s.solCode));
    }
  } else {
    if (!appSettings.scriptUrl) return;
    try {
      const data = await apiPost({ action: "getDashboardData" });
      if (data.success) {
        branches = (data.branches || []).map(normalizeBranch);
        globalSubmissions = (data.submissions || []).map(normalizeSubmission);
        submissions = globalSubmissions;
        if (data.roleParamMapping) {
          roleParamMapping = data.roleParamMapping;
          localStorage.setItem("iob_role_param_mapping", JSON.stringify(roleParamMapping));
        }
        if (data.roBroadcastMessage) {
          roBroadcastMessage = data.roBroadcastMessage;
          localStorage.setItem("iob_ro_ticker", roBroadcastMessage);
          const textEl = document.getElementById("admin-ticker-text");
          if (textEl) textEl.textContent = roBroadcastMessage;
        }
      }
    } catch (e) {
      console.error(e);
      showToast("Error retrieving live dashboard");
      return;
    }
  }

  // Calculate Aggregates
  let totalOpened = 0;
  let totalSB = 0;
  let totalCD = 0;

  submissions.forEach(sub => {
    totalOpened += Number(sub.acctsOpened) || 0;
    totalSB += Number(sub.growthSB) || 0;
    totalCD += Number(sub.growthCD) || 0;
  });

  document.getElementById("stat-total-accounts").textContent = totalOpened;
  document.getElementById("stat-total-sb-growth").textContent = formatCurrency(totalSB);
  document.getElementById("stat-total-cd-growth").textContent = formatCurrency(totalCD);

  // Compute Completion %
  // Each branch has 3 roles that can report (1st Line, 2nd Line, RO Guardian)
  let expectedSubmits = branches.length * 3;
  let actualSubmits = submissions.length;
  let rate = expectedSubmits > 0 ? Math.round((actualSubmits / expectedSubmits) * 100) : 0;
  document.getElementById("stat-submission-rate").textContent = `${rate}%`;

  // Draw Grid Cards
  const grid = document.getElementById("branches-status-grid");
  grid.innerHTML = "";

  branches.forEach(br => {
    const box = document.createElement("div");
    box.className = "branch-status-box";
    box.dataset.name = `${br.solCode} ${br.branchName}`.toLowerCase();
    
    // Check submissions for this branch
    const sub1st = submissions.find(s => s.solCode === br.solCode && s.role === "1st Line");
    const sub2nd = submissions.find(s => s.solCode === br.solCode && s.role === "2nd Line");
    const subRO = submissions.find(s => s.solCode === br.solCode && s.role === "RO Guardian");

    box.innerHTML = `
      <div class="branch-status-name" title="${escapeHtml(br.branchName)}">${escapeHtml(`${br.solCode} - ${br.branchName}`)}</div>
      <div class="role-tag ${sub1st ? 'submitted' : 'pending'}">
        <span>1st Line</span>
        <span>${sub1st ? '✓' : '✗'}</span>
      </div>
      <div class="role-tag ${sub2nd ? 'submitted' : 'pending'}">
        <span>2nd Line</span>
        <span>${sub2nd ? '✓' : '✗'}</span>
      </div>
      <div class="role-tag ${subRO ? 'submitted' : 'pending'}">
        <span>RO Guard</span>
        <span>${subRO ? '✓' : '✗'}</span>
      </div>
    `;

    grid.appendChild(box);
  });
}

function filterDashboardGrid(query) {
  const q = query.toLowerCase();
  const boxes = document.querySelectorAll(".branch-status-box");
  boxes.forEach(box => {
    if (box.dataset.name.includes(q)) {
      box.style.display = "flex";
    } else {
      box.style.display = "none";
    }
  });
}

// Dynamic report logs compiler for SRM / Chief Manager / Admin
async function loadReportsData() {
  const dateFilter = document.getElementById("report-date-filter").value;
  let rows = [];
  
  if (appSettings.mockMode) {
    const all = mockSubmissions.map(normalizeSubmission).filter(s => s.reportingDate === dateFilter);
    const isGlobal = ["RO SRM", "Chief Manager", "Admin"].includes(currentUser.role) || currentUser.assignedSols.includes("*");
    if (isGlobal) {
      rows = all;
    } else {
      const allowedSols = currentUser.branches.map(b => b.solCode);
      rows = all.filter(s => allowedSols.includes(s.solCode));
    }
  } else {
    if (!appSettings.scriptUrl) return;
    try {
      const data = await apiPost({ action: "getDashboardData", dateFilter: dateFilter });
      if (data.success && data.isManagementView) {
        globalSubmissions = (data.submissions || []).map(normalizeSubmission);
        rows = globalSubmissions;
        if (data.roleParamMapping) {
          roleParamMapping = data.roleParamMapping;
          localStorage.setItem("iob_role_param_mapping", JSON.stringify(roleParamMapping));
        }
        if (data.roBroadcastMessage) {
          roBroadcastMessage = data.roBroadcastMessage;
          localStorage.setItem("iob_ro_ticker", roBroadcastMessage);
          const textEl = document.getElementById("admin-ticker-text");
          if (textEl) textEl.textContent = roBroadcastMessage;
        }
      } else {
        showToast("Consolidated details only available for Management roles.");
        return;
      }
    } catch (e) {
      console.error(e);
      showToast("Network failure retrieving submissions log.");
      return;
    }
  }

  lastReportRows = rows;

  // Populate dynamic table
  const table = document.getElementById("consolidated-report-table");
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  thead.innerHTML = `
    <tr>
      <th>SOL Code</th>
      <th>Branch Name</th>
      <th>Submitter</th>
      <th>Role</th>
      <th>SB Growth (₹)</th>
      <th>CD Growth (₹)</th>
      <th>Accts Opened</th>
      <th>Inop. Reduction</th>
      <th>REKYC Done</th>
      <th>Action</th>
    </tr>
  `;

  tbody.innerHTML = "";

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-secondary);">No reports submitted for the selected date.</td></tr>`;
    return;
  }

  rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.className = "report-row";
    tr.dataset.searchable = `${row.solCode || ""} ${row.branchName || ""} ${row.submitterName || ""}`.toLowerCase();

    const role = row.role || "—";
    const roleBadge = role === "1st Line" ? "badge-info" : (role === "2nd Line" ? "badge-success" : "badge-warning");

    tr.innerHTML = `
      <td><strong>${escapeHtml(row.solCode || "—")}</strong></td>
      <td>${escapeHtml(row.branchName || "—")}</td>
      <td>${escapeHtml(row.submitterName || "—")}</td>
      <td><span class="badge ${roleBadge}">${escapeHtml(role)}</span></td>
      <td>${displayCell(row.growthSB, true)}</td>
      <td>${displayCell(row.growthCD, true)}</td>
      <td>${displayCell(row.acctsOpened)}</td>
      <td>${displayCell(row.reductionInoperative)}</td>
      <td>${displayCell(row.rekycCompleted)}</td>
      <td><button class="btn btn-secondary btn-drilldown" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; width: auto;" data-index="${index}">View All</button></td>
    `;

    tbody.appendChild(tr);
  });

  // Attach drill down modal triggers
  tbody.querySelectorAll(".btn-drilldown").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = e.target.getAttribute("data-index");
      openDetailModal(rows[idx]);
    });
  });
}

function filterReportsTable() {
  const query = document.getElementById("report-search-filter").value.toLowerCase();
  const rows = document.querySelectorAll(".report-row");
  rows.forEach(tr => {
    if (tr.dataset.searchable.includes(query)) {
      tr.style.display = "table-row";
    } else {
      tr.style.display = "none";
    }
  });
}

// Drill down Modal popup creator
function openDetailModal(data) {
  const modal = document.getElementById("detail-modal");
  
  const sol = data.solCode || "—";
  const name = data.branchName || "—";
  const submitter = data.submitterName || "—";
  const role = data.role || "—";
  const date = data.reportingDate || getTodayDateString();
  const time = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : "";

  document.getElementById("modal-branch-title").textContent = `SOL ${sol} - ${name}`;
  document.getElementById("modal-metadata-line").textContent = `Submitted by ${submitter} (${role}) on ${date} ${time}`;

  const container = document.getElementById("modal-body-content");
  container.innerHTML = "";

  // Dynamic keys mapper
  const ignoreKeys = ["timestamp", "reportingDate", "rollNumber", "submitterName", "role", "solCode", "branchName"];
  
  let gridHtml = `<div class="form-grid-2">`;
  
  // Left half: parameters & value
  let leftList = `<table class="matrix-table"><thead><tr><th>Parameter</th><th>Submitted Value</th></tr></thead><tbody>`;
  // Right half: values
  let rightList = `<table class="matrix-table"><thead><tr><th>Parameter</th><th>Submitted Value</th></tr></thead><tbody>`;
  
  let index = 0;
  
  for (let key in data) {
    if (!ignoreKeys.includes(key) && data[key] !== null && data[key] !== undefined && data[key] !== "") {
      let val = data[key];
      if (typeof val === "boolean") {
        val = val ? "Yes" : "No";
      } else if (typeof val === "number" && (key.toLowerCase().includes("growth") || key.toLowerCase().includes("volume") || key.toLowerCase().endsWith("amt"))) {
        val = formatCurrency(val);
      }

      const rowStr = `<tr><td><strong>${escapeHtml(labelForKey(key))}</strong></td><td>${escapeHtml(val)}</td></tr>`;
      
      if (index % 2 === 0) {
        leftList += rowStr;
      } else {
        rightList += rowStr;
      }
      index++;
    }
  }

  leftList += `</tbody></table>`;
  rightList += `</tbody></table>`;
  gridHtml += `<div>${leftList}</div><div>${rightList}</div></div>`;

  container.innerHTML = gridHtml;
  modal.classList.add("open");
}

// Consolidated Reports Downloader
function exportConsolidatedCSV() {
  const dateFilter = document.getElementById("report-date-filter").value;
  const rows = lastReportRows || [];

  if (rows.length === 0) {
    showToast("No data to export!");
    return;
  }

  // Union of keys across all rows (1st Line, 2nd Line and RO rows carry different fields)
  const headers = [];
  rows.forEach(r => {
    Object.keys(r).forEach(k => {
      if (!headers.includes(k)) headers.push(k);
    });
  });

  const lines = [headers.map(csvField).join(",")];
  rows.forEach(r => {
    lines.push(headers.map(h => csvField(r[h])).join(","));
  });

  // BOM so Excel decodes ₹ and other UTF-8 characters correctly
  const blob = new Blob([String.fromCharCode(0xFEFF) + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `IOB_Consolidated_Reporting_${dateFilter}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("CSV Download triggered!");
}

// Drag & drop file upload parser for Admin Targets
let uploadedUnifiedRows = [];

function setupAdminDropzone(zoneId, fileInputId, statusId, parseFn) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(fileInputId);
  const status = document.getElementById(statusId);

  zone.addEventListener("click", () => input.click());

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.style.borderColor = "var(--primary-light)";
  });

  zone.addEventListener("dragleave", () => {
    zone.style.borderColor = "var(--border-color)";
  });

  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.style.borderColor = "var(--border-color)";
    
    if (e.dataTransfer.files.length > 0) {
      input.files = e.dataTransfer.files;
      parseFn(input.files[0], status);
    }
  });

  input.addEventListener("change", () => {
    if (input.files.length > 0) {
      parseFn(input.files[0], status);
    }
  });
}

function parseUnifiedCSV(file, statusElement) {
  statusElement.textContent = `Reading ${file.name}...`;
  
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const text = e.target.result;
      const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        statusElement.textContent = "CSV contains no rows!";
        return;
      }

      const headers = lines[0].split(",").map(h => h.trim().replace(/['"]/g, ""));
      const parsedRows = [];

      for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(",").map(c => c.trim().replace(/['"]/g, ""));
        if (columns.length === headers.length) {
          let rowObj = {};
          headers.forEach((h, colIdx) => {
            rowObj[h] = columns[colIdx];
          });
          parsedRows.push(rowObj);
        }
      }

      // Map unified targets CSV fields
      uploadedUnifiedRows = parsedRows.map(r => ({
        solCode: r["SOL Code"] || r["solCode"],
        branchName: r["Branch Name"] || r["branchName"],
        targetAcctsOpened: Number(r["Target_Accts_Opened"]) || Number(r["targetAcctsOpened"]) || 0,
        targetGrowthSB: Number(r["Target_Growth_SB"]) || Number(r["targetGrowthSB"]) || 0,
        targetGrowthCD: Number(r["Target_Growth_CD"]) || Number(r["targetGrowthCD"]) || 0,
        targetGrowthTD: Number(r["Target_Growth_TD"]) || Number(r["targetGrowthTD"]) || 0,
        allottedCasaWinback: Number(r["Allotted_CASA_Winback"]) || Number(r["allottedCasaWinback"]) || 0,
        yestBalSB: Number(r["Yesterday_Bal_SB"]) || Number(r["yestBalSB"]) || 0,
        yestBalCD: Number(r["Yesterday_Bal_CD"]) || Number(r["yestBalCD"]) || 0,
        yestBalTD: Number(r["Yesterday_Bal_TD"]) || Number(r["yestBalTD"]) || 0,
        uptoYestAcctsSB: Number(r["UptoYest_Accts_SB"]) || Number(r["uptoYestAcctsSB"]) || 0,
        uptoYestAcctsCD: Number(r["UptoYest_Accts_CD"]) || Number(r["uptoYestAcctsCD"]) || 0,
        currMonthStepUpRD: Number(r["Curr_Month_Step_Up_RD"]) || Number(r["currMonthStepUpRD"]) || 0,
        currMonthPlatinum: Number(r["Curr_Month_Platinum"]) || Number(r["currMonthPlatinum"]) || 0,
        currMonthUltraHni: Number(r["Curr_Month_Ultra_HNI"]) || Number(r["currMonthUltraHni"]) || 0,
        currMonthPremium: Number(r["Curr_Month_Premium"]) || Number(r["currMonthPremium"]) || 0,
        targetCreditCards: Number(r["Target_Credit_Cards"]) || Number(r["targetCreditCards"]) || 0,
        targetIobConnect: Number(r["Target_IOB_Connect"]) || Number(r["targetIobConnect"]) || 0,
        targetNetBanking: Number(r["Target_Net_Banking"]) || Number(r["targetNetBanking"]) || 0,
        targetOngoingCampaigns: Number(r["Target_Ongoing_Campaigns"]) || Number(r["targetOngoingCampaigns"]) || 0,
        baseLowBalanceFunding: Number(r["Base_Low_Balance_Funding"]) || Number(r["baseLowBalanceFunding"]) || 0,
        baseLowBalSB: Number(r["Base_Low_Bal_SB"]) || Number(r["baseLowBalSB"]) || 0,
        baseLowBalCD: Number(r["Base_Low_Bal_CD"]) || Number(r["baseLowBalCD"]) || 0,
        bal31MarSB: Number(r["Bal_31Mar_SB"]) || Number(r["bal31MarSB"]) || 0,
        bal31MarCD: Number(r["Bal_31Mar_CD"]) || Number(r["bal31MarCD"]) || 0,
        bal31MarTD: Number(r["Bal_31Mar_TD"]) || Number(r["bal31MarTD"]) || 0,
        targetAcctsSB: Number(r["Target_Accts_SB"]) || Number(r["targetAcctsSB"]) || 0,
        targetAcctsCD: Number(r["Target_Accts_CD"]) || Number(r["targetAcctsCD"]) || 0,
        fyStepUpRD: Number(r["FY_Step_Up_RD"]) || Number(r["fyStepUpRD"]) || 0,
        fyPlatinum: Number(r["FY_Platinum"]) || Number(r["fyPlatinum"]) || 0,
        fyUltraHni: Number(r["FY_Ultra_HNI"]) || Number(r["fyUltraHni"]) || 0,
        fyPremium: Number(r["FY_Premium"]) || Number(r["fyPremium"]) || 0,
        prevMonthStepUpRD: Number(r["Prev_Month_Step_Up_RD"]) || Number(r["prevMonthStepUpRD"]) || 0,
        prevMonthPlatinum: Number(r["Prev_Month_Platinum"]) || Number(r["prevMonthPlatinum"]) || 0,
        prevMonthUltraHni: Number(r["Prev_Month_Ultra_HNI"]) || Number(r["prevMonthUltraHni"]) || 0,
        prevMonthPremium: Number(r["Prev_Month_Premium"]) || Number(r["prevMonthPremium"]) || 0,
        baseInoperativeAmt: Number(r["Base_Inoperative_Amt"]) || Number(r["baseInoperativeAmt"]) || 0,
        baseInactiveAmt: Number(r["Base_Inactive_Amt"]) || Number(r["baseInactiveAmt"]) || 0,
        baseDeafAmt: Number(r["Base_DEAF_Amt"]) || Number(r["baseDeafAmt"]) || 0,
        baseInoperativeAccts: Number(r["Base_Inoperative_Accts"]) || Number(r["baseInoperativeAccts"]) || 0,
        baseInactiveAccts: Number(r["Base_Inactive_Accts"]) || Number(r["baseInactiveAccts"]) || 0,
        baseDeafAccts: Number(r["Base_DEAF_Accts"]) || Number(r["baseDeafAccts"]) || 0
      }));
      statusElement.textContent = `Successfully loaded ${uploadedUnifiedRows.length} branch rows.`;
      showToast("CSV successfully parsed.");
    } catch (err) {
      statusElement.textContent = "Fail parsing CSV. Check formatting.";
      console.error(err);
    }
  };
  reader.readAsText(file);
}

// Download CSV Template
function downloadCSVTemplate() {
  const headers = [
    "SOL Code", "Branch Name", "Target_Accts_Opened", "Target_Growth_SB", "Target_Growth_CD", "Target_Growth_TD",
    "Allotted_CASA_Winback", "Yesterday_Bal_SB", "Yesterday_Bal_CD", "Yesterday_Bal_TD", "UptoYest_Accts_SB", "UptoYest_Accts_CD",
    "Curr_Month_Step_Up_RD", "Curr_Month_Platinum", "Curr_Month_Ultra_HNI", "Curr_Month_Premium", "Target_Credit_Cards",
    "Target_IOB_Connect", "Target_Net_Banking", "Target_Ongoing_Campaigns", "Base_Low_Balance_Funding", "Base_Low_Bal_SB",
    "Base_Low_Bal_CD", "Bal_31Mar_SB", "Bal_31Mar_CD", "Bal_31Mar_TD", "Target_Accts_SB", "Target_Accts_CD",
    "FY_Step_Up_RD", "FY_Platinum", "FY_Ultra_HNI", "FY_Premium", "Prev_Month_Step_Up_RD", "Prev_Month_Platinum",
    "Prev_Month_Ultra_HNI", "Prev_Month_Premium", "Base_Inoperative_Accts", "Base_Inoperative_Amt",
    "Base_Inactive_Accts", "Base_Inactive_Amt", "Base_DEAF_Accts", "Base_DEAF_Amt"
  ];
  
  const sampleData = [
    "1001", "IOB Cathedral Branch", "5", "100000", "50000", "200000",
    "10", "45200000", "12800000", "88500000", "78", "24",
    "6", "11", "1", "18", "5",
    "10", "8", "4", "15", "120",
    "45", "44100000", "12300000", "86200000", "120", "40",
    "22", "41", "3", "65", "8", "14",
    "1", "21", "25", "1850000",
    "20", "920000", "5", "210000"
  ];

  const csvContent = headers.join(",") + "\n" + sampleData.join(",");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "IOB_Target_Base_Template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("CSV Template download triggered!");
}

// Upload CSV figures to Sheets API
async function submitUnifiedTargets() {
  const targetDate = document.getElementById("admin-target-date").value;
  if (!targetDate) {
    showToast("Target date is required!");
    return;
  }

  if (uploadedUnifiedRows.length === 0) {
    showToast("No parsed file to upload!");
    return;
  }

  showToast("Uploading target changes...");

  if (appSettings.mockMode) {
    // Save to mock daily and monthly bases for full compatibility
    uploadedUnifiedRows.forEach(r => {
      mockDailyBase[r.solCode] = r;
      mockMonthlyBase[r.solCode] = r;
    });
    showToast("Targets updated successfully in local mock session!");
    uploadedUnifiedRows = [];
    document.getElementById("status-upload-unified").textContent = "No file loaded";
  } else {
    if (!appSettings.scriptUrl) {
      showToast("Google Web App URL must be configured!");
      return;
    }
    
    try {
      const result = await apiPost({
        action: "uploadBaseTargets",
        date: targetDate,
        rows: uploadedUnifiedRows
      });
      if (result.success) {
        showToast("Targets successfully uploaded to Google Sheets!");
        uploadedUnifiedRows = [];
        document.getElementById("status-upload-unified").textContent = "No file loaded";
      } else {
        showToast(result.error || "Upload failed.");
      }
    } catch (e) {
      console.error(e);
      showToast("Connection fail uploading target files.");
    }
  }
}

// Master Data storage
let uploadedMasterBranches = [];
let uploadedMasterUsers = [];

function parseMasterBranchesCSV(file, statusElement) {
  statusElement.textContent = `Reading ${file.name}...`;
  
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const text = e.target.result;
      const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        statusElement.textContent = "CSV contains no rows!";
        return;
      }
      const headers = lines[0].split(",").map(h => h.trim().replace(/['"]/g, ""));
      const parsedRows = [];
      for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(",").map(c => c.trim().replace(/['"]/g, ""));
        if (columns.length === headers.length) {
          let rowObj = {};
          headers.forEach((h, colIdx) => {
            rowObj[h] = columns[colIdx];
          });
          parsedRows.push(rowObj);
        }
      }

      uploadedMasterBranches = parsedRows.map(r => ({
        solCode: String(r["SOL Code"] || r["solCode"] || "").trim(),
        branchName: r["Branch Name"] || r["branchName"] || "",
        region: r["Region"] || r["region"] || "",
        roGuardianRoll: String(r["RO Guardian Roll"] || r["roGuardianRoll"] || "").trim()
      }));
      statusElement.textContent = `Loaded ${uploadedMasterBranches.length} branch rows.`;
      showToast("Branch Master CSV successfully parsed.");
    } catch (err) {
      statusElement.textContent = "Fail parsing CSV.";
      console.error(err);
    }
  };
  reader.readAsText(file);
}

function parseMasterUsersCSV(file, statusElement) {
  statusElement.textContent = `Reading ${file.name}...`;
  
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const text = e.target.result;
      const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        statusElement.textContent = "CSV contains no rows!";
        return;
      }
      const headers = lines[0].split(",").map(h => h.trim().replace(/['"]/g, ""));
      const parsedRows = [];
      for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(",").map(c => c.trim().replace(/['"]/g, ""));
        if (columns.length === headers.length) {
          let rowObj = {};
          headers.forEach((h, colIdx) => {
            rowObj[h] = columns[colIdx];
          });
          parsedRows.push(rowObj);
        }
      }

      uploadedMasterUsers = parsedRows.map(r => ({
        rollNumber: String(r["Roll Number"] || r["rollNumber"] || "").trim(),
        name: r["Name"] || r["name"] || "",
        role: r["Role"] || r["role"] || "",
        assignedSols: r["Assigned SOLs"] || r["assignedSols"] || "",
        password: r["Password"] || r["password"] || ""
      }));
      statusElement.textContent = `Loaded ${uploadedMasterUsers.length} user profiles.`;
      showToast("User Master CSV successfully parsed.");
    } catch (err) {
      statusElement.textContent = "Fail parsing CSV.";
      console.error(err);
    }
  };
  reader.readAsText(file);
}

function downloadMasterBranchTemplate() {
  const headers = ["SOL Code", "Branch Name", "Region", "RO Guardian Roll"];
  const sampleData = [
    ["1001", "IOB Cathedral Branch", "Chennai South", "3001"],
    ["1002", "IOB Mount Road Branch", "Chennai South", "3001"]
  ];
  const csvContent = headers.join(",") + "\n" + sampleData.map(r => r.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "IOB_Branches_Master_Template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Branch template download triggered!");
}

function downloadMasterUserTemplate() {
  const headers = ["Roll Number", "Name", "Role", "Assigned SOLs", "Password"];
  const sampleData = [
    ["1001", "Ramesh Kumar", "1st Line", "1001", ""],
    ["2001", "Anjali Sharma", "2nd Line", "1001", ""],
    ["3001", "Vikram Singh", "RO Guardian", "1001,1002", ""],
    ["9001", "S. Srinivasan", "RO SRM", "*", ""],
    ["LBO1", "LBO Officer", "LBO", "1001", ""],
    ["PO1", "Product Officer", "PO", "*", ""]
  ];
  const csvContent = headers.join(",") + "\n" + sampleData.map(r => r.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "IOB_Users_Master_Template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("User template download triggered!");
}

async function submitMasterData() {
  if (uploadedMasterBranches.length === 0 && uploadedMasterUsers.length === 0) {
    showToast("No master data files loaded to upload!");
    return;
  }

  showToast("Uploading master directory database...");

  if (appSettings.mockMode) {
    if (uploadedMasterBranches.length > 0) {
      mockBranches = [...uploadedMasterBranches];
    }
    if (uploadedMasterUsers.length > 0) {
      uploadedMasterUsers.forEach(u => {
        // Store assignedSols as an array so scope checks are exact (not substring) matches
        mockUsers[u.rollNumber.toUpperCase()] = {
          ...u,
          assignedSols: String(u.assignedSols || "").split(",").map(s => s.trim()).filter(String)
        };
      });
    }
    showToast("Master directory updated in local mock session!");
    uploadedMasterBranches = [];
    uploadedMasterUsers = [];
    document.getElementById("status-upload-master-branches").textContent = "No file loaded";
    document.getElementById("status-upload-master-users").textContent = "No file loaded";
  } else {
    if (!appSettings.scriptUrl) {
      showToast("Google Web App URL must be configured!");
      return;
    }
    try {
      const result = await apiPost({
        action: "uploadMasterData",
        branches: uploadedMasterBranches,
        users: uploadedMasterUsers
      });
      if (result.success) {
        showToast("Master directory updated successfully in Google Sheet!");
        uploadedMasterBranches = [];
        uploadedMasterUsers = [];
        document.getElementById("status-upload-master-branches").textContent = "No file loaded";
        document.getElementById("status-upload-master-users").textContent = "No file loaded";
      } else {
        showToast(result.error || "Master upload failed.");
      }
    } catch (e) {
      console.error(e);
      showToast("Connection fail uploading master directories.");
    }
  }
}

// Logouts
function logout() {
  // Best-effort server-side token invalidation before clearing local state
  if (!appSettings.mockMode && sessionToken && appSettings.scriptUrl) {
    fetch(appSettings.scriptUrl, { method: "POST", body: JSON.stringify({ action: "logout", token: sessionToken }) }).catch(() => {});
  }
  currentUser = null;
  sessionToken = null;
  localStorage.removeItem("iob_user_session");
  document.getElementById("user-info-bar").style.display = "none";
  document.getElementById("main-navigation").style.display = "none";
  document.getElementById("admin-ticker-bar").style.display = "none";
  document.getElementById("login-roll").value = "";
  
  const solSelect = document.getElementById("guardian-sol-select");
  if (solSelect) solSelect.innerHTML = "";
  
  switchView("login-view");
  showToast("Logged out successfully.");
}

// Utility Helpers
function getTodayDateString() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

// Status compares total outstanding (yesterday's balance + today's growth/decline)
// against the 31 March base for the segment
function growthStatusVs31Mar(segment, todaysGrowth) {
  const totalOS = (Number(currentBranchBases.daily["yestBal" + segment]) || 0) + todaysGrowth;
  const base31Mar = Number(currentBranchBases.monthly["bal31Mar" + segment]) || 0;
  return totalOS >= base31Mar ? "Positive" : "Negative";
}

// Recomputes the automatic status badges from today's growth inputs
function updateGrowthStatusBadges() {
  [["sb-growth", "growth-status-sb", "SB"], ["cd-growth", "growth-status-cd", "CD"], ["td-growth", "growth-status-td", "TD"]].forEach(([inputId, badgeId, segment]) => {
    const raw = document.getElementById(inputId).value;
    const badge = document.getElementById(badgeId);
    if (raw === "") {
      badge.textContent = "—";
      badge.className = "badge badge-neutral";
      badge.title = "";
      return;
    }
    const growth = Number(raw) || 0;
    const totalOS = (Number(currentBranchBases.daily["yestBal" + segment]) || 0) + growth;
    const base31Mar = Number(currentBranchBases.monthly["bal31Mar" + segment]) || 0;
    badge.title = `Total OS ${formatCurrency(totalOS)} vs 31.03 base ${formatCurrency(base31Mar)}`;
    if (totalOS >= base31Mar) {
      badge.textContent = "Positive";
      badge.className = "badge badge-success";
    } else {
      badge.textContent = "Negative";
      badge.className = "badge badge-danger";
    }
  });
  updateGrowthSummaryBadge();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Human label for a field key: growthSB -> "Growth SB", nps -> "NPS"
function labelForKey(key) {
  if (/^[a-z]{2,4}$/.test(key)) return key.toUpperCase();
  const spaced = key.replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Table cell renderer: em-dash for missing values, optional currency formatting
function displayCell(value, isCurrency) {
  if (value === undefined || value === null || value === "") return "—";
  if (isCurrency) return formatCurrency(Number(value) || 0);
  return escapeHtml(value);
}

// Quote a CSV field, doubling internal quotes; neutralize text starting with
// formula characters so exported files are safe to open in Excel
function csvField(value) {
  if (value === undefined || value === null) return "";
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str) && isNaN(Number(str))) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function formatCurrency(num) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(num);
}

function showToast(message) {
  const toast = document.getElementById("toast-bar");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

function triggerSubmitNotification(solCode, role) {
  // Trigger system notification
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification("IOB Daily Reporting Portal", {
        body: `Daily performance report for SOL ${solCode} (${role}) has been submitted successfully!`,
        icon: "https://images.unsplash.com/photo-1557200134-90327ee9fafa?w=128"
      });
    } catch (e) {
      console.warn("Could not trigger browser Notification API, falling back to overlay toast.", e);
    }
  }
}

function renderRoleParamMappingTable() {
  const table = document.getElementById("role-param-mapping-table");
  if (!table) return;
  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";

  const roles = ["1st Line", "2nd Line", "RO Guardian", "LBO", "PO"];

  PARAM_LIST.forEach(p => {
    const tr = document.createElement("tr");
    
    // Label cell
    let tdLabel = document.createElement("td");
    tdLabel.innerHTML = `<strong>${escapeHtml(p.name)}</strong> <span style="font-size:0.7rem; color:var(--text-secondary); display:block;">(${p.key})</span>`;
    tr.appendChild(tdLabel);
    
    // Role columns
    roles.forEach(role => {
      let td = document.createElement("td");
      td.style.textAlign = "center";
      const isChecked = (roleParamMapping[role] || []).includes(p.key);
      td.innerHTML = `<input type="checkbox" class="param-map-check" data-param="${p.key}" data-role="${role}" ${isChecked ? "checked" : ""} style="width:1.1rem; height:1.1rem; cursor:pointer;">`;
      tr.appendChild(td);
    });
    
    tbody.appendChild(tr);
  });
}

// Dynamically renders the list of assigned branches for the RO Guardian on landing
async function loadGuardianLandingPage() {
  const grid = document.getElementById("guardian-branches-grid");
  if (!grid) return;
  
  grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem;">Loading branch submission status...</div>`;
  
  const dateStr = getTodayDateString();
  let submissions = [];
  
  if (appSettings.mockMode) {
    submissions = mockSubmissions.map(normalizeSubmission).filter(s => s.reportingDate === dateStr);
  } else {
    if (!appSettings.scriptUrl) return;
    try {
      const data = await apiPost({ action: "getDashboardData" });
      if (data.success) {
        globalSubmissions = (data.submissions || []).map(normalizeSubmission);
        submissions = globalSubmissions;
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to sync live submissions status.");
    }
  }
  
  grid.innerHTML = "";
  
  if (currentUser.branches.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem;">No branches have been assigned to your roll number under the Branches database.</div>`;
    return;
  }
  
  currentUser.branches.forEach(br => {
    // Check submissions logged today
    const sub1st = submissions.find(s => s.solCode === br.solCode && s.role === "1st Line" && s.reportingDate === dateStr);
    const sub2nd = submissions.find(s => s.solCode === br.solCode && s.role === "2nd Line" && s.reportingDate === dateStr);
    const subRO = submissions.find(s => s.solCode === br.solCode && s.role === "RO Guardian" && s.reportingDate === dateStr);
    
    const isCompleted = !!subRO; 
    const isSubmittingToday = (!!sub1st || !!sub2nd);
    
    const card = document.createElement("div");
    card.className = `card branch-status-box ${isCompleted ? 'completed-highlight' : (isSubmittingToday ? 'submitted-highlight' : '')}`;
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.justifyContent = "space-between";
    card.style.padding = "1.25rem";
    card.style.margin = "0";
    
    card.innerHTML = `
      <div>
        <div class="branch-status-name" style="font-weight: 700; font-size: 1.05rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.75rem; color: var(--text-primary);">
          🏦 ${escapeHtml(br.solCode)} - ${escapeHtml(br.branchName)}
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; padding: 0.25rem 0.5rem; border-radius: 4px; background: ${sub1st ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.05)'}; color: ${sub1st ? 'var(--success)' : 'var(--text-secondary)'}; font-weight: 500;">
            <span>1st Line Entry</span>
            <span>${sub1st ? '✓ Submitted' : '✗ Pending'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; padding: 0.25rem 0.5rem; border-radius: 4px; background: ${sub2nd ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.05)'}; color: ${sub2nd ? 'var(--success)' : 'var(--text-secondary)'}; font-weight: 500;">
            <span>2nd Line Entry</span>
            <span>${sub2nd ? '✓ Submitted' : '✗ Pending'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; padding: 0.25rem 0.5rem; border-radius: 4px; background: ${subRO ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.05)'}; color: ${subRO ? 'var(--success)' : 'var(--text-secondary)'}; font-weight: 500;">
            <span>Your Audit Report</span>
            <span>${subRO ? '✓ Completed' : '✗ Pending'}</span>
          </div>
        </div>
      </div>
      <button class="btn ${isCompleted ? 'btn-secondary' : 'btn-primary'}" style="width: 100%; font-size: 0.8rem; padding: 0.5rem; margin: 0;">
        ${isCompleted ? 'Edit / View Audit Report' : 'Review & Submit Report'}
      </button>
    `;
    
    card.addEventListener("click", () => {
      const select = document.getElementById("guardian-sol-select");
      if (select) {
        select.value = br.solCode;
        loadBranchBases(br.solCode);
      }
      
      const tabs = document.querySelectorAll(".nav-tab");
      tabs.forEach(t => t.classList.remove("active"));
      const entryTab = document.getElementById("nav-entry-form");
      if (entryTab) entryTab.classList.add("active");
      
      switchView("entry-view");
    });
    
    grid.appendChild(card);
  });
  switchView("guardian-landing-view");
}

function updateWizardView() {
  // Hide all wizard cards
  wizardCards.forEach(card => {
    card.style.display = "none";
  });
  
  if (wizardCards.length === 0) return;
  
  // Show only the current card
  const activeCard = wizardCards[currentStepIndex];
  if (activeCard) {
    activeCard.style.display = "block";
    activeCard.classList.remove("collapsed");
  }
  
  // Update buttons
  const btnPrev = document.getElementById("btn-wizard-prev");
  const btnNext = document.getElementById("btn-wizard-next");
  const btnSubmit = document.getElementById("btn-wizard-submit");
  const progress = document.getElementById("wizard-progress-indicator");
  
  if (btnPrev) btnPrev.style.display = currentStepIndex > 0 ? "block" : "none";
  if (btnNext) btnNext.style.display = currentStepIndex < wizardCards.length - 1 ? "block" : "none";
  if (btnSubmit) btnSubmit.style.display = currentStepIndex === wizardCards.length - 1 ? "block" : "none";
  
  if (progress) {
    progress.textContent = `Section ${currentStepIndex + 1} of ${wizardCards.length}`;
  }
}

function setupWizardBehavior() {
  const btnPrev = document.getElementById("btn-wizard-prev");
  const btnNext = document.getElementById("btn-wizard-next");

  if (btnPrev) {
    btnPrev.addEventListener("click", () => {
      if (currentStepIndex > 0) {
        currentStepIndex--;
        updateWizardView();
        const form = document.getElementById("reporting-form");
        if (form) form.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener("click", () => {
      if (currentStepIndex < wizardCards.length - 1) {
        currentStepIndex++;
        updateWizardView();
        const form = document.getElementById("reporting-form");
        if (form) form.scrollIntoView({ behavior: "smooth" });
      }
    });
  }
}

function updateAccordionSummaries(dBase, mBase) {
  // Low Balance Accounts Funding summary
  const summaryLowBal = document.getElementById("summary-low-bal");
  if (summaryLowBal) {
    summaryLowBal.innerHTML = `
      <span class="summary-badge">SB Base: ${mBase.baseLowBalSB || 0}</span>
      <span class="summary-badge">CD Base: ${mBase.baseLowBalCD || 0}</span>
    `;
  }

  // Balance Growth summary
  updateGrowthSummaryBadge();

  // Account Opening Performance summary
  const summaryAO = document.getElementById("summary-ao");
  if (summaryAO) {
    const sbGap = Math.max(0, (Number(mBase.targetAcctsSB) || 0) - (Number(dBase.uptoYestAcctsSB) || 0));
    const cdGap = Math.max(0, (Number(mBase.targetAcctsCD) || 0) - (Number(dBase.uptoYestAcctsCD) || 0));
    summaryAO.innerHTML = `
      <span class="summary-badge">SB Gap: ${sbGap}</span>
      <span class="summary-badge">CD Gap: ${cdGap}</span>
    `;
  }

  // Premium Product Adoption summary
  const summaryPA = document.getElementById("summary-pa");
  if (summaryPA) {
    summaryPA.innerHTML = `
      <span class="summary-badge">Step-up RD: ${dBase.currMonthStepUpRD || 0}</span>
      <span class="summary-badge">Platinum: ${dBase.currMonthPlatinum || 0}</span>
    `;
  }

  // Activation summary
  const summaryActivation = document.getElementById("summary-activation");
  if (summaryActivation) {
    summaryActivation.innerHTML = `
      <span class="summary-badge">Inop Base: ${mBase.baseInoperativeAccts || 0}</span>
      <span class="summary-badge">Inactive Base: ${mBase.baseInactiveAccts || 0}</span>
    `;
  }

  // Digital Banking summary
  const summaryDigital = document.getElementById("summary-digital");
  if (summaryDigital) {
    summaryDigital.innerHTML = `
      <span class="summary-badge">CC Target: ${dBase.targetCreditCards || 0}</span>
      <span class="summary-badge">Connect Target: ${dBase.targetIobConnect || 0}</span>
    `;
  }

  // Scheme summary
  const summarySchemes = document.getElementById("summary-schemes");
  if (summarySchemes) {
    summarySchemes.innerHTML = `
      <span class="summary-badge">CASA Allotted: ${dBase.allottedCasaWinback || 0}</span>
    `;
  }

  // 2nd Line Reactivation summary
  const summaryReactivation = document.getElementById("summary-reactivation");
  if (summaryReactivation) {
    summaryReactivation.innerHTML = `
      <span class="summary-badge">Inop: ${mBase.baseInoperativeAccts || 0}</span>
      <span class="summary-badge">Inactive: ${mBase.baseInactiveAccts || 0}</span>
    `;
  }
}

function updateGrowthSummaryBadge() {
  const summaryGrowth = document.getElementById("summary-growth");
  if (!summaryGrowth) return;

  const getStatus = (segment) => {
    const inputVal = document.getElementById(`${segment.toLowerCase()}-growth`).value;
    const growth = Number(inputVal) || 0;
    const totalOS = (Number(currentBranchBases.daily["yestBal" + segment]) || 0) + growth;
    const base31Mar = Number(currentBranchBases.monthly["bal31Mar" + segment]) || 0;
    return totalOS >= base31Mar ? "Positive" : "Negative";
  };

  const sbStatus = getStatus("SB");
  const cdStatus = getStatus("CD");
  const tdStatus = getStatus("TD");

  summaryGrowth.innerHTML = `
    <span class="summary-badge ${sbStatus === 'Positive' ? 'badge-success' : 'badge-danger'}">SB: ${sbStatus}</span>
    <span class="summary-badge ${cdStatus === 'Positive' ? 'badge-success' : 'badge-danger'}">CD: ${cdStatus}</span>
    <span class="summary-badge ${tdStatus === 'Positive' ? 'badge-success' : 'badge-danger'}">TD: ${tdStatus}</span>
  `;
}

function downloadCanvasImage(canvas, filename) {
  try {
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("WhatsApp status image downloaded successfully!");
  } catch (err) {
    console.error("Canvas export failed:", err);
    showToast("CORS policy restriction. Running through a local server will resolve this.");
  }
}

function generateWhatsAppStatusImage(solCode) {
  showToast("Generating shareable image...");
  
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  
  // Polyfill roundRect if missing
  if (typeof ctx.roundRect !== "function") {
    ctx.roundRect = function(x, y, w, h, r) {
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
      this.beginPath();
      this.moveTo(x+r, y);
      this.arcTo(x+w, y,   x+w, y+h, r);
      this.arcTo(x+w, y+h, x,   y+h, r);
      this.arcTo(x,   y+h, x,   y,   r);
      this.arcTo(x,   y,   x+w, y,   r);
      this.closePath();
      return this;
    };
  }

  const normRole = String(currentUser.role).trim().toUpperCase();
  const todayStr = document.getElementById("form-date").value || getTodayDateString();
  const branchName = lastSubmittedPayload ? (lastSubmittedPayload.branchName || lastSubmittedPayload["Branch Name"] || "") : "";
  
  function drawText(text, x, y, font, color, align = "left", maxWidth = null) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    if (maxWidth) {
      ctx.fillText(text, x, y, maxWidth);
    } else {
      ctx.fillText(text, x, y);
    }
  }

  function drawMainContent(withImageLogo) {
    // 1. Draw midnight blue gradient background
    const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
    grad.addColorStop(0, "#080c14");
    grad.addColorStop(0.5, "#0f172a");
    grad.addColorStop(1, "#1e1b4b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);
    
    // Draw soft glows
    ctx.fillStyle = "rgba(99, 102, 241, 0.08)";
    ctx.beginPath();
    ctx.arc(200, 300, 400, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(16, 185, 129, 0.05)";
    ctx.beginPath();
    ctx.arc(880, 1600, 500, 0, Math.PI * 2);
    ctx.fill();

    // 2. Draw IOB header brand
    if (withImageLogo) {
      try {
        const logo = new Image();
        logo.src = "2026logo_min.svg";
        // If image is already completed, draw it
        if (logo.complete || logo.naturalWidth > 0) {
          const logoW = 340;
          const logoH = (logo.naturalHeight / logo.naturalWidth) * logoW || 130;
          ctx.drawImage(logo, (1080 - logoW) / 2, 100, logoW, logoH);
        } else {
          // Emulated text header
          drawText("INDIAN OVERSEAS BANK", 540, 160, "bold 42px Inter", "#ffffff", "center");
        }
      } catch (e) {
        drawText("INDIAN OVERSEAS BANK", 540, 160, "bold 42px Inter", "#ffffff", "center");
      }
    } else {
      // Draw fallback geometric emblem
      ctx.fillStyle = "#0284c7"; // Sky blue
      ctx.beginPath();
      ctx.roundRect(540 - 50, 70, 100, 100, 12);
      ctx.fill();
      
      // Grid lines
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 6;
      ctx.strokeRect(540 - 35, 85, 70, 70);
      ctx.beginPath();
      ctx.moveTo(540 - 35, 85);
      ctx.lineTo(540 + 35, 155);
      ctx.moveTo(540 + 35, 85);
      ctx.lineTo(540 - 35, 155);
      ctx.stroke();

      drawText("INDIAN OVERSEAS BANK", 540, 230, "bold 42px Inter", "#ffffff", "center");
    }

    const titleOffset = withImageLogo ? 260 : 300;
    drawText("DAILY REPORTING PORTAL", 540, titleOffset, "600 24px Inter", "#eab308", "center");

    // Gold separator line
    ctx.strokeStyle = "rgba(234, 179, 8, 0.3)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(100, titleOffset + 40);
    ctx.lineTo(980, titleOffset + 40);
    ctx.stroke();

    // 3. Draw Translucent Card
    const cardX = 80;
    const cardY = titleOffset + 80;
    const cardW = 920;
    const cardH = 1350;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 30);
    ctx.fill();
    ctx.stroke();

    // 4. Success Badge / Title
    ctx.fillStyle = "rgba(16, 185, 129, 0.1)";
    ctx.beginPath();
    ctx.roundRect(cardX + 60, cardY + 50, cardW - 120, 110, 16);
    ctx.fill();
    
    if (normRole === "RO GUARDIAN") {
      drawText("🛡️ GUARDIAN BRANCH AUDIT", 540, cardY + 100, "bold 34px Inter", "#34d399", "center");
      drawText("AUDIT SUBMISSION COMPLETED", 540, cardY + 138, "bold 20px Inter", "#ffffff", "center");
    } else {
      drawText("✓ PERFORMANCE REPORT", 540, cardY + 100, "bold 34px Inter", "#34d399", "center");
      drawText("SUBMITTED SUCCESSFULLY", 540, cardY + 138, "bold 20px Inter", "#ffffff", "center");
    }

    // 5. Metadata Block
    const metaY = cardY + 220;
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.beginPath();
    ctx.roundRect(cardX + 40, metaY, cardW - 80, 220, 20);
    ctx.fill();
    ctx.stroke();

    // Draw metadata items
    const leftColX = cardX + 80;
    const rightColX = cardX + 380;
    
    drawText("Submitter:", leftColX, metaY + 55, "600 24px Inter", "#94a3b8");
    drawText(currentUser.name || "Unknown", rightColX, metaY + 55, "600 24px Inter", "#ffffff", "left", 480);
    
    drawText("Role & Roll:", leftColX, metaY + 110, "600 24px Inter", "#94a3b8");
    drawText(`${currentUser.role} (${currentUser.rollNumber})`, rightColX, metaY + 110, "600 24px Inter", "#ffffff");

    drawText("Reporting Date:", leftColX, metaY + 165, "600 24px Inter", "#94a3b8");
    drawText(todayStr, rightColX, metaY + 165, "600 24px Inter", "#ffffff");

    // 6. SOL Detail Header
    const solY = metaY + 245;
    drawText(`BRANCH: ${solCode} - ${branchName}`, 540, solY + 30, "bold 26px Inter", "#ffffff", "center", 820);
    
    // Separator
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.beginPath();
    ctx.moveTo(cardX + 60, solY + 60);
    ctx.lineTo(cardX + cardW - 60, solY + 60);
    ctx.stroke();

    // 7. Dynamic Data List
    const dataY = solY + 110;
    
    if (normRole === "RO GUARDIAN") {
      drawText("TAGGED BRANCHES AUDIT STATUS TODAY", 540, dataY, "bold 24px Inter", "#eab308", "center");
      
      const assignedBranches = (currentUser && currentUser.branches) || [];
      let currentItemY = dataY + 70;
      
      assignedBranches.forEach((b, index) => {
        if (index >= 10) return; // Cap listing to fit height
        
        const hasSubmitted = globalSubmissions.some(sub => {
          const subSol = String(sub.solCode).trim();
          const subRole = String(sub.role).trim().toUpperCase();
          const subDate = sub.reportingDate;
          return subSol === String(b.solCode).trim() && 
                 subRole === "RO GUARDIAN" && 
                 subDate === todayStr;
        });

        ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
        ctx.beginPath();
        ctx.roundRect(cardX + 60, currentItemY - 35, cardW - 120, 60, 10);
        ctx.fill();

        drawText(`${b.solCode} - ${b.branchName}`, cardX + 90, currentItemY, "500 22px Inter", "#ffffff", "left", 540);
        
        if (hasSubmitted) {
          drawText("✓ AUDITED", cardX + cardW - 100, currentItemY, "bold 22px Inter", "#34d399", "right");
        } else {
          drawText("✗ PENDING", cardX + cardW - 100, currentItemY, "bold 22px Inter", "#f87171", "right");
        }
        currentItemY += 80;
      });
    } else {
      drawText("KEY METRICS PERFORMANCE", 540, dataY, "bold 24px Inter", "#eab308", "center");
      
      let currentItemY = dataY + 70;
      const excludedKeys = [
        "action", "token", "rollNumber", "submitterName", "role", "solCode", 
        "branchName", "reportingDate", "statusSB", "statusCD", "statusTD", "statusCASA",
        "Reporting Date", "Roll Number", "Submitter Name", "Submitter Nam", "Role", "SOL Code", "Branch Name"
      ];
      
      let rowCount = 0;
      for (const key in lastSubmittedPayload) {
        if (excludedKeys.includes(key)) continue;
        if (rowCount >= 10) break; // prevent overflowing the card boundary

        const rawValue = lastSubmittedPayload[key];
        let displayValue = String(rawValue);
        
        // Format money if applicable
        if (key.toLowerCase().includes("growth") || key.toLowerCase().includes("amt")) {
          const valNum = Number(rawValue) || 0;
          displayValue = (valNum >= 0 ? "+" : "") + formatCurrency(valNum);
        } else if (rawValue === true || rawValue === "true" || rawValue === "Yes") {
          displayValue = "✓ Yes";
        } else if (rawValue === false || rawValue === "false" || rawValue === "No") {
          displayValue = "✗ No";
        }

        if (rowCount % 2 === 0) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
          ctx.beginPath();
          ctx.roundRect(cardX + 60, currentItemY - 35, cardW - 120, 60, 10);
          ctx.fill();
        }

        const label = labelForKey(key);
        drawText(label, cardX + 90, currentItemY, "500 22px Inter", "#cbd5e1", "left", 540);
        drawText(displayValue, cardX + cardW - 90, currentItemY, "bold 22px Inter", "#ffffff", "right");

        currentItemY += 80;
        rowCount++;
      }
      
      if (rowCount === 0) {
        drawText("Daily reports saved successfully.", 540, dataY + 120, "italic 22px Inter", "#94a3b8", "center");
      }
    }

    // 8. Footer Info
    const footerY = 1850;
    drawText("IOB DAILY PERFORMANCE PORTAL", 540, footerY, "bold 22px Inter", "#eab308", "center");
    drawText("Secure Digital reporting. Direct Sync with central Google Sheets.", 540, footerY + 30, "20px Inter", "#64748b", "center");
  }

  // Pre-load IOB logo
  const logo = new Image();
  logo.crossOrigin = "anonymous";
  
  logo.onload = function() {
    drawMainContent(true);
    downloadCanvasImage(canvas, `IOB_Daily_Report_SOL_${solCode}_${todayStr}.png`);
  };

  logo.onerror = function() {
    console.warn("Unable to load SVG logo. Falling back to geometric rendering.");
    drawMainContent(false);
    downloadCanvasImage(canvas, `IOB_Daily_Report_SOL_${solCode}_${todayStr}.png`);
  };

  logo.src = "2026logo_min.svg";
}

function initializeLottieLogos() {
  if (typeof lottie === "undefined") {
    console.warn("Lottie library not loaded.");
    return;
  }

  function setupLottieAnimation(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const anim = lottie.loadAnimation({
      container: container,
      renderer: "svg",
      loop: false,
      autoplay: true,
      animationData: typeof IOB_LOTTIE_LOGO !== "undefined" ? IOB_LOTTIE_LOGO : null
    });

    anim.addEventListener("complete", () => {
      anim.loop = true;
      anim.playSegments([90, 210], true);
    });
  }

  setupLottieAnimation("lottie-logo-container");
  setupLottieAnimation("lottie-login-container");
}
