/* prayer-service.js — the one place prayer times are computed.
 *
 * Used by index.html (home widget + prayer modal), js/notifications.js
 * (local scheduler), and js/schedule-builder.js (page + SW periodicsync),
 * so the home-screen times and the notification times can never disagree.
 *
 * Classic script, defines global PrayerService. Requires the adhan global
 * (data/adhan.js). Works in the service worker too — pass the method name
 * explicitly there (no localStorage in SW).
 */
(function (global) {
  'use strict';

  // Stored preference; default matches the app's declared default (UAE).
  function methodName() {
    try { return localStorage.getItem('calcMethod') || 'UAE'; }
    catch (e) { return 'UAE'; }
  }

  // Asr shadow rule. 'auto' (default) uses Hanafi where it is the official
  // practice — Pakistan, India, Bangladesh, Afghanistan (rough box below) or
  // an Urdu UI — and the standard Shafi'i/Maliki/Hanbali rule elsewhere
  // (incl. Turkey: Diyanet's official times use the standard Asr).
  function inSouthAsia(lat, lng) {
    lat = parseFloat(lat); lng = parseFloat(lng);
    return isFinite(lat) && isFinite(lng) && lat >= 6 && lat <= 38.5 && lng >= 61 && lng <= 93;
  }
  function asrSetting() {
    try { return localStorage.getItem('asrMadhab') || 'auto'; }
    catch (e) { return 'auto'; }
  }
  // Resolved rule: 'hanafi' or 'shafi'. Page context only (reads storage).
  function asrName() {
    const s = asrSetting();
    if (s === 'hanafi' || s === 'shafi') return s;
    try {
      if ((localStorage.getItem('zad_lang') || '') === 'ur') return 'hanafi';
      if (inSouthAsia(localStorage.getItem('prayer_lat'), localStorage.getItem('prayer_lng'))) return 'hanafi';
    } catch (e) { /* no storage (service worker) */ }
    return 'shafi';
  }

  // `asr` ('hanafi' | 'shafi') must be passed in the service worker;
  // pages may omit it to use the stored setting.
  function method(name, asr) {
    let m;
    switch (name || methodName()) {
      case 'UmmAlQura': m = adhan.CalculationMethod.UmmAlQura(); break;
      case 'Egypt':     m = adhan.CalculationMethod.Egyptian(); break;
      case 'Karachi':   m = adhan.CalculationMethod.Karachi(); break;
      case 'UAE':       m = adhan.CalculationMethod.Dubai(); break;
      default:          m = adhan.CalculationMethod.MuslimWorldLeague();
    }
    m.madhab = (asr || asrName()) === 'hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
    return m;
  }

  // adhan.PrayerTimes for the given coords/date, or null when impossible.
  function times(lat, lng, date, name) {
    if (typeof adhan === 'undefined') return null;
    lat = parseFloat(lat); lng = parseFloat(lng);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return new adhan.PrayerTimes(new adhan.Coordinates(lat, lng), date || new Date(), method(name));
  }

  global.PrayerService = { methodName, method, times, asrSetting, asrName };
})(typeof self !== 'undefined' ? self : this);
