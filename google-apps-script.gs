/**
 * ============================================================
 *  VOICE OF GOD — Backend Google Sheet
 * ------------------------------------------------------------
 *  Ce script reçoit les candidatures du formulaire et les
 *  enregistre dans TON Google Sheet. C'est gratuit et les
 *  données t'appartiennent (dans ton compte Google).
 *
 *  Voir GUIDE-INSTALLATION.md pour la mise en place (5 min).
 * ============================================================
 */

// ⚠️  Ce jeton DOIT être identique à READ_TOKEN dans index.html
const READ_TOKEN = "VOG-SECRET-2026";

// Ordre des colonnes dans le Google Sheet
const COLS = [
  "date", "nom", "age", "sexe", "ville", "tel", "email",
  "eglise", "conversion", "bapteme", "departement", "tessiture",
  "instrument", "niveau", "experience", "dispo", "motivation", "engagement"
];

const HEADERS = [
  "Date", "Nom & prénoms", "Âge", "Sexe", "Ville/Commune", "Téléphone", "Email",
  "Église", "Converti depuis", "Baptême", "Département(s)", "Tessiture",
  "Instrument", "Niveau", "Expérience", "Disponibilité", "Motivation", "Engagement"
];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("Candidatures");
  if (!sh) {
    sh = ss.insertSheet("Candidatures");
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Réception d'une candidature (POST depuis le formulaire) */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sh = getSheet_();
    const row = COLS.map(function (k) {
      if (k === "date") {
        // Date lisible dans le fuseau d'Abidjan
        return Utilities.formatDate(new Date(data.date || new Date()), "GMT", "yyyy-MM-dd HH:mm");
      }
      return data[k] || "";
    });
    sh.appendRow(row);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** Lecture des candidatures (GET depuis le tableau de bord admin) */
function doGet(e) {
  if (!e || !e.parameter || e.parameter.token !== READ_TOKEN) {
    return json_({ ok: false, error: "Accès refusé" });
  }
  const sh = getSheet_();
  const values = sh.getDataRange().getValues();
  values.shift(); // enlève l'en-tête
  const out = values.reverse().map(function (r) {
    const obj = {};
    COLS.forEach(function (k, i) { obj[k] = r[i]; });
    return obj;
  });
  return json_(out);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
