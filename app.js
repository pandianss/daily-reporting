// Daily Performance Reporting Portal - Core Client Application Logic

// State Management
let currentUser = null;
let appSettings = {
  // Hardcode your Google Apps Script Web App URL here to make it automatically live for all devices (mobile/desktop):
  scriptUrl: "https://script.google.com/macros/s/AKfycbx-yuR65ayhY9BD449xHxTN-YvphR1hLF4nlak4TAQ0UKQHa_ieQMzOlEdAl_a-VFTpVQ/exec", 
  mockMode: false // Set to false by default for live sheets connection
};

// Simulated Local Database for Mock Mode
const mockBranches = [
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
            uptoYestAcctsSB: 78, uptoYestAcctsCD: 24, currMonthDiamond: 6, currMonthPlatinum: 11, currMonthUltraHni: 1, currMonthPremium: 18 },
  "1002": { targetAcctsOpened: 3, targetGrowthSB: 50000, targetGrowthCD: 20000, targetGrowthTD: 100000, allottedCasaWinback: 5, yestBalSB: 27400000, yestBalCD: 8100000, yestBalTD: 51200000,
            uptoYestAcctsSB: 45, uptoYestAcctsCD: 13, currMonthDiamond: 3, currMonthPlatinum: 6, currMonthUltraHni: 0, currMonthPremium: 10 },
  "1003": { targetAcctsOpened: 4, targetGrowthSB: 80000, targetGrowthCD: 40000, targetGrowthTD: 150000, allottedCasaWinback: 8, yestBalSB: 33600000, yestBalCD: 9700000, yestBalTD: 64800000,
            uptoYestAcctsSB: 58, uptoYestAcctsCD: 17, currMonthDiamond: 4, currMonthPlatinum: 8, currMonthUltraHni: 1, currMonthPremium: 13 },
  "1004": { targetAcctsOpened: 3, targetGrowthSB: 60000, targetGrowthCD: 30000, targetGrowthTD: 120000, allottedCasaWinback: 6, yestBalSB: 21900000, yestBalCD: 6400000, yestBalTD: 42700000,
            uptoYestAcctsSB: 36, uptoYestAcctsCD: 10, currMonthDiamond: 2, currMonthPlatinum: 4, currMonthUltraHni: 0, currMonthPremium: 7 },
  "1005": { targetAcctsOpened: 4, targetGrowthSB: 75000, targetGrowthCD: 35000, targetGrowthTD: 140000, allottedCasaWinback: 7, yestBalSB: 30100000, yestBalCD: 8800000, yestBalTD: 57300000,
            uptoYestAcctsSB: 51, uptoYestAcctsCD: 15, currMonthDiamond: 3, currMonthPlatinum: 7, currMonthUltraHni: 0, currMonthPremium: 11 }
};

let mockMonthlyBase = {
  "1001": { baseLowBalanceFunding: 15, baseLowBalSB: 120, baseLowBalCD: 45, bal31MarSB: 44100000, bal31MarCD: 12300000, bal31MarTD: 86200000,
            targetAcctsSB: 120, targetAcctsCD: 40, fyDiamond: 22, fyPlatinum: 41, fyUltraHni: 3, fyPremium: 65,
            prevMonthDiamond: 8, prevMonthPlatinum: 14, prevMonthUltraHni: 1, prevMonthPremium: 21,
            baseInoperativeAccts: 25, baseInoperativeAmt: 1850000, baseInactiveAccts: 20, baseInactiveAmt: 920000, baseDeafAccts: 5, baseDeafAmt: 210000 },
  "1002": { baseLowBalanceFunding: 10, baseLowBalSB: 85, baseLowBalCD: 30, bal31MarSB: 26800000, bal31MarCD: 7900000, bal31MarTD: 50100000,
            targetAcctsSB: 70, targetAcctsCD: 25, fyDiamond: 12, fyPlatinum: 24, fyUltraHni: 1, fyPremium: 38,
            prevMonthDiamond: 4, prevMonthPlatinum: 8, prevMonthUltraHni: 0, prevMonthPremium: 12,
            baseInoperativeAccts: 15, baseInoperativeAmt: 1120000, baseInactiveAccts: 12, baseInactiveAmt: 560000, baseDeafAccts: 3, baseDeafAmt: 130000 },
  "1003": { baseLowBalanceFunding: 12, baseLowBalSB: 95, baseLowBalCD: 38, bal31MarSB: 32900000, bal31MarCD: 9400000, bal31MarTD: 63500000,
            targetAcctsSB: 90, targetAcctsCD: 30, fyDiamond: 16, fyPlatinum: 30, fyUltraHni: 2, fyPremium: 47,
            prevMonthDiamond: 6, prevMonthPlatinum: 10, prevMonthUltraHni: 1, prevMonthPremium: 15,
            baseInoperativeAccts: 20, baseInoperativeAmt: 1430000, baseInactiveAccts: 15, baseInactiveAmt: 700000, baseDeafAccts: 4, baseDeafAmt: 160000 },
  "1004": { baseLowBalanceFunding: 8, baseLowBalSB: 60, baseLowBalCD: 22, bal31MarSB: 21400000, bal31MarCD: 6200000, bal31MarTD: 41800000,
            targetAcctsSB: 55, targetAcctsCD: 18, fyDiamond: 9, fyPlatinum: 17, fyUltraHni: 1, fyPremium: 27,
            prevMonthDiamond: 3, prevMonthPlatinum: 6, prevMonthUltraHni: 0, prevMonthPremium: 9,
            baseInoperativeAccts: 14, baseInoperativeAmt: 860000, baseInactiveAccts: 10, baseInactiveAmt: 420000, baseDeafAccts: 2, baseDeafAmt: 90000 },
  "1005": { baseLowBalanceFunding: 11, baseLowBalSB: 78, baseLowBalCD: 28, bal31MarSB: 29500000, bal31MarCD: 8500000, bal31MarTD: 56200000,
            targetAcctsSB: 80, targetAcctsCD: 27, fyDiamond: 13, fyPlatinum: 26, fyUltraHni: 1, fyPremium: 41,
            prevMonthDiamond: 5, prevMonthPlatinum: 9, prevMonthUltraHni: 0, prevMonthPremium: 13,
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
  "Accts_Diamond": "acctsDiamond",
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
  "Curr_Month_Diamond": "currMonthDiamond",
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
  "FY_Diamond": "fyDiamond",
  "FY_Platinum": "fyPlatinum",
  "FY_Ultra_HNI": "fyUltraHni",
  "FY_Premium": "fyPremium",
  "Prev_Month_Diamond": "prevMonthDiamond",
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
  { key: "acctsDiamond", name: "Adoption: SB Diamond" },
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
  "acctsDiamond": "acctsDiamond",
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
  "1st Line": ["fundingLowBal", "growthSB", "growthCD", "growthTD", "acctsOpened", "acctsDiamond", "acctsPlatinum", "acctsUltraHni", "acctsPremium", "acctsGovt", "acctsTemple", "acctsContractors", "creditCards", "iobConnect", "netBanking", "casaWinbackCompleted", "nps", "ssy", "ppf", "jewelLoansFresh", "jewelLoansRenewal", "accidentInsurance", "socialMediaCount", "activationInoperative", "activationInoperativeAmt", "activationInactive", "activationInactiveAmt", "activationDeaf", "activationDeafAmt", "loanHousing", "loanVehicle", "loanPersonal", "loanMSME", "loanAgri", "acctsOpenedTAB", "fastag", "pmsby", "pmjjby"],
  "2nd Line": ["reductionInoperative", "reductionInactive", "reductionDeaf", "rekycCompleted", "nominationUpdated", "dqiProgress", "powerplayIntent"],
  "RO Guardian": ["roCampaignsChecked", "roNotes"],
  "LBO": ["fundingLowBal", "loanMSME", "loanAgri", "pmsby", "pmjjby"],
  "PO": ["growthSB", "growthCD", "growthTD", "loanHousing", "loanVehicle", "loanPersonal", "fastag", "acctsOpenedTAB"]
};

let roBroadcastMessage = "Welcome to the IOB Daily Performance Reporting Portal. Please ensure all daily metrics are submitted by 17:00 EOD.";

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
  
  // Request system notification permission
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
  
  tagDOMWithParams();
  renderRoleParamMappingTable();
});

// Load configuration
function loadSettings() {
  const cachedSettings = localStorage.getItem("iob_portal_settings");
  if (cachedSettings) {
    const parsed = JSON.parse(cachedSettings);
    if (parsed.scriptUrl) {
      appSettings.scriptUrl = parsed.scriptUrl;
    }
    appSettings.mockMode = parsed.mockMode;
  }
  
  // Set in configuration inputs
  document.getElementById("google-script-url").value = appSettings.scriptUrl || "";
  document.getElementById("toggle-mock-mode").checked = appSettings.mockMode;
}

// Save configuration
document.getElementById("btn-save-settings").addEventListener("click", () => {
  const url = document.getElementById("google-script-url").value.trim();
  const mock = document.getElementById("toggle-mock-mode").checked;

  appSettings.scriptUrl = url;
  appSettings.mockMode = mock;
  
  localStorage.setItem("iob_portal_settings", JSON.stringify(appSettings));
  showToast("Settings saved successfully!");
});

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
    const hasEntry = ["1ST LINE", "2ND LINE", "RO GUARDIAN"].includes(normRole);
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

// Check session cache
function checkCachedSession() {
  const cachedUser = localStorage.getItem("iob_user_session");
  if (cachedUser) {
    currentUser = JSON.parse(cachedUser);
    setupSessionUI();
  } else {
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
      // Validate password
      let mockPasswords = JSON.parse(localStorage.getItem("iob_mock_passwords") || "{}");
      const defaultPassword = (user.role === "Admin") ? "a3130gsm" : rollNumber;
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
        showChangePasswordModal(userRecord);
        return;
      }
      
      currentUser = userRecord;
      localStorage.setItem("iob_user_session", JSON.stringify(currentUser));
      setupSessionUI();
      showToast(`Welcome back, ${currentUser.name}!`);
    } else {
      showToast("Invalid roll number (Mock list: 1001, 2001, 3001, 9001, CHIEF, ADMIN)");
    }
  } else {
    // API authenticate
    if (!appSettings.scriptUrl) {
      showToast("Web App URL configuration is missing in Settings!");
      return;
    }
    try {
      const response = await fetch(`${appSettings.scriptUrl}?action=authenticate&rollNumber=${encodeURIComponent(rollNumber)}&password=${encodeURIComponent(password)}`);
      const result = await response.json();
      if (result.success) {
        if (result.mustChangePassword) {
          showChangePasswordModal(result.user);
          return;
        }
        currentUser = result.user;
        localStorage.setItem("iob_user_session", JSON.stringify(currentUser));
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
  
  if (newPass.length < 6) {
    showToast("Password must be at least 6 characters long.");
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
    
    currentUser = pendingSessionData;
    localStorage.setItem("iob_user_session", JSON.stringify(currentUser));
    
    document.getElementById("change-password-modal").classList.remove("open");
    setupSessionUI();
    showToast("Password changed successfully! You are logged in.");
    document.getElementById("change-password-form").reset();
  } else {
    try {
      const response = await fetch(appSettings.scriptUrl, {
        method: "POST",
        body: JSON.stringify({
          action: "changePassword",
          rollNumber: pendingSessionData.rollNumber,
          newPassword: newPass
        })
      });
      const result = await response.json();
      if (result.success) {
        currentUser = pendingSessionData;
        localStorage.setItem("iob_user_session", JSON.stringify(currentUser));
        
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
  const hasEntry = ["1ST LINE", "2ND LINE", "RO GUARDIAN"].includes(normRole);
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
  
  const branchHeading = document.getElementById("form-branch-heading");
  
  // Set heading and load bases
  if (String(role).trim().toUpperCase() === "RO GUARDIAN") {
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

  // Display sections containing metrics
  document.getElementById("form-1st-line-section").style.display = "block";
  document.getElementById("form-2nd-line-section").style.display = "block";
  document.getElementById("form-ro-guardian-section").style.display = "block";
  document.getElementById("form-loans-section").style.display = "block";

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
  const isGuardianUser = currentUser && String(currentUser.role).trim().toUpperCase() === "RO GUARDIAN";

  cards.forEach(card => {
    // If the card is the submit panel, keep it visible!
    if (card.querySelector(".btn-submit-form")) {
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
}

// Fetch historical and monthly base numbers for reference
function loadBranchBases(solCode) {
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
  [["Diamond", "diamond"], ["Platinum", "platinum"], ["UltraHni", "uhni"], ["Premium", "premium"]].forEach(([key, slug]) => {
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
}

async function fetchDashboardTelemetry(solCode) {
  if (!appSettings.scriptUrl) return;
  try {
    const dateFilter = document.getElementById("form-date").value || getTodayDateString();
    const res = await fetch(`${appSettings.scriptUrl}?action=getDashboardData&rollNumber=${currentUser.rollNumber}&dateFilter=${dateFilter}`);
    const data = await res.json();
    if (data.success) {
      let dBase = (data.dailyBase && data.dailyBase[solCode]) || {};
      let mBase = (data.monthlyBase && data.monthlyBase[solCode]) || {};
      
      dBase = normalizeBase(dBase);
      mBase = normalizeBase(mBase);
      
      if (data.roleParamMapping) {
        roleParamMapping = data.roleParamMapping;
        localStorage.setItem("iob_role_param_mapping", JSON.stringify(roleParamMapping));
        setupReportingForm();
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
  const form = document.getElementById("reporting-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Resolve reporting SOL Details
    let solCode = "";
    let branchName = "";
    
    if (currentUser.role === "RO Guardian") {
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
      rollNumber: currentUser.rollNumber,
      submitterName: currentUser.name,
      role: currentUser.role,
      solCode: solCode,
      branchName: branchName
    };

    // Serialize Form Fields dynamically based on role's parameter configuration
    const formData = new FormData(form);
    const activeParams = roleParamMapping[currentUser.role] || [];
    
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
    if (currentUser.role === "2nd Line") {
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
      form.reset();
      document.getElementById("form-date").value = getTodayDateString();
      updateGrowthStatusBadges();
      showToast("Report submitted successfully (Mock Offline)!");
      triggerSubmitNotification(solCode, currentUser.role);
      
      // Update form configurations to original bases
      setupReportingForm();
    } else {
      try {
        const response = await fetch(appSettings.scriptUrl, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.success) {
          form.reset();
          document.getElementById("form-date").value = getTodayDateString();
          updateGrowthStatusBadges();
          showToast("Performance report logged successfully in Google Sheets!");
          triggerSubmitNotification(solCode, currentUser.role);
          setupReportingForm();
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
      const passcode = document.getElementById("admin-passcode-field").value;
      if (!passcode) {
        showToast("Admin passcode is required in the targets panel above to reset user passwords.");
        return;
      }
      try {
        const response = await fetch(appSettings.scriptUrl, {
          method: "POST",
          body: JSON.stringify({
            action: "resetUserPassword",
            rollNumber: currentUser.rollNumber,
            passcode: passcode,
            targetRollNumber: targetRoll
          })
        });
        const result = await response.json();
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
      const passcode = document.getElementById("admin-passcode-field").value;
      if (!passcode) {
        showToast("Admin passcode is required to save mapping changes!");
        return;
      }
      
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
          const response = await fetch(appSettings.scriptUrl, {
            method: "POST",
            body: JSON.stringify({
              action: "saveRoleParamMapping",
              passcode: passcode,
              rollNumber: currentUser.rollNumber,
              mapping: roleParamMapping
            })
          });
          const result = await response.json();
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
      const passcode = document.getElementById("admin-passcode-field").value;
      if (!passcode) {
        showToast("Admin passcode is required to update broadcast message!");
        return;
      }
      
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
          const response = await fetch(appSettings.scriptUrl, {
            method: "POST",
            body: JSON.stringify({
              action: "saveTickerMessage",
              passcode: passcode,
              rollNumber: currentUser.rollNumber,
              message: roBroadcastMessage
            })
          });
          const result = await response.json();
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
      const res = await fetch(`${appSettings.scriptUrl}?action=getDashboardData&rollNumber=${currentUser.rollNumber}`);
      const data = await res.json();
      if (data.success) {
        branches = (data.branches || []).map(normalizeBranch);
        submissions = (data.submissions || []).map(normalizeSubmission);
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
      const res = await fetch(`${appSettings.scriptUrl}?action=getDashboardData&rollNumber=${currentUser.rollNumber}&dateFilter=${dateFilter}`);
      const data = await res.json();
      if (data.success && data.isManagementView) {
        rows = (data.submissions || []).map(normalizeSubmission);
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
    if (!ignoreKeys.includes(key) && data[key] !== null && data[key] !== undefined) {
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
        currMonthDiamond: Number(r["Curr_Month_Diamond"]) || Number(r["currMonthDiamond"]) || 0,
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
        fyDiamond: Number(r["FY_Diamond"]) || Number(r["fyDiamond"]) || 0,
        fyPlatinum: Number(r["FY_Platinum"]) || Number(r["fyPlatinum"]) || 0,
        fyUltraHni: Number(r["FY_Ultra_HNI"]) || Number(r["fyUltraHni"]) || 0,
        fyPremium: Number(r["FY_Premium"]) || Number(r["fyPremium"]) || 0,
        prevMonthDiamond: Number(r["Prev_Month_Diamond"]) || Number(r["prevMonthDiamond"]) || 0,
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
    "Curr_Month_Diamond", "Curr_Month_Platinum", "Curr_Month_Ultra_HNI", "Curr_Month_Premium", "Target_Credit_Cards",
    "Target_IOB_Connect", "Target_Net_Banking", "Target_Ongoing_Campaigns", "Base_Low_Balance_Funding", "Base_Low_Bal_SB",
    "Base_Low_Bal_CD", "Bal_31Mar_SB", "Bal_31Mar_CD", "Bal_31Mar_TD", "Target_Accts_SB", "Target_Accts_CD",
    "FY_Diamond", "FY_Platinum", "FY_Ultra_HNI", "FY_Premium", "Prev_Month_Diamond", "Prev_Month_Platinum",
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
  const passcode = document.getElementById("admin-passcode-field").value;
  const targetDate = document.getElementById("admin-target-date").value;
  if (!passcode) {
    showToast("Admin passcode is required!");
    return;
  }
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
      const payload = {
        action: "uploadBaseTargets",
        passcode: passcode,
        rollNumber: currentUser.rollNumber,
        date: targetDate,
        rows: uploadedUnifiedRows
      };
      
      const res = await fetch(appSettings.scriptUrl, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const result = await res.json();
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
  const passcode = document.getElementById("admin-passcode-field").value;
  if (!passcode) {
    showToast("Admin passcode is required!");
    return;
  }

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
        mockUsers[u.rollNumber.toUpperCase()] = u;
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
      const payload = {
        action: "uploadMasterData",
        passcode: passcode,
        rollNumber: currentUser.rollNumber,
        branches: uploadedMasterBranches,
        users: uploadedMasterUsers
      };
      const res = await fetch(appSettings.scriptUrl, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const result = await res.json();
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
  currentUser = null;
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
      const res = await fetch(`${appSettings.scriptUrl}?action=getDashboardData&rollNumber=${currentUser.rollNumber}`);
      const data = await res.json();
      if (data.success) {
        submissions = (data.submissions || []).map(normalizeSubmission);
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
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; padding: 0.25rem 0.5rem; border-radius: 4px; background: ${sub1st ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.05)'}; color: ${sub1st ? 'var(--success-color)' : 'var(--text-secondary)'}; font-weight: 500;">
            <span>1st Line Entry</span>
            <span>${sub1st ? '✓ Submitted' : '✗ Pending'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; padding: 0.25rem 0.5rem; border-radius: 4px; background: ${sub2nd ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.05)'}; color: ${sub2nd ? 'var(--success-color)' : 'var(--text-secondary)'}; font-weight: 500;">
            <span>2nd Line Entry</span>
            <span>${sub2nd ? '✓ Submitted' : '✗ Pending'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; padding: 0.25rem 0.5rem; border-radius: 4px; background: ${subRO ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.05)'}; color: ${subRO ? 'var(--success-color)' : 'var(--text-secondary)'}; font-weight: 500;">
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
}
