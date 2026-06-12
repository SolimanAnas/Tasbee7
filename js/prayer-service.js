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

  function method(name) {
    let m;
    switch (name || methodName()) {
      case 'UmmAlQura': m = adhan.CalculationMethod.UmmAlQura(); break;
      case 'Egypt':     m = adhan.CalculationMethod.Egyptian(); break;
      case 'Karachi':   m = adhan.CalculationMethod.Karachi(); break;
      case 'UAE':       m = adhan.CalculationMethod.Dubai(); break;
      default:          m = adhan.CalculationMethod.MuslimWorldLeague();
    }
    m.madhab = adhan.Madhab.Shafi;
    return m;
  }

  // adhan.PrayerTimes for the given coords/date, or null when impossible.
  function times(lat, lng, date, name) {
    if (typeof adhan === 'undefined') return null;
    lat = parseFloat(lat); lng = parseFloat(lng);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return new adhan.PrayerTimes(new adhan.Coordinates(lat, lng), date || new Date(), method(name));
  }

  global.PrayerService = { methodName, method, times };
})(typeof self !== 'undefined' ? self : this);
