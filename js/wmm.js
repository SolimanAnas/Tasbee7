/* =========================================================================
   wmm.js — magnetic declination from the World Magnetic Model (WMM2025)

   Phone compasses (Android absolute orientation, iOS webkitCompassHeading)
   point to MAGNETIC north, while bearings such as the Qibla are measured
   from TRUE north. Adding the local declination converts one to the other.

   Coefficients: NOAA NCEI / BGS WMM2025 (public domain), valid 2025–2030.
   Usage: WMM.declination(lat, lng[, date[, altKm]]) → degrees, east positive.
   ========================================================================= */
(function (global) {
  'use strict';

  const EPOCH = 2025.0;
  const N_MAX = 12;
  // [n, m, g, h, g_dot, h_dot]  (nT, nT/yr)
  const COEFFS = [
    [1,0,-29351.8,0,12,0],[1,1,-1410.8,4545.4,9.7,-21.5],[2,0,-2556.6,0,-11.6,0],
    [2,1,2951.1,-3133.6,-5.2,-27.7],[2,2,1649.3,-815.1,-8,-12.1],[3,0,1361,0,-1.3,0],
    [3,1,-2404.1,-56.6,-4.2,4],[3,2,1243.8,237.5,0.4,-0.3],[3,3,453.6,-549.5,-15.6,-4.1],
    [4,0,895,0,-1.6,0],[4,1,799.5,278.6,-2.4,-1.1],[4,2,55.7,-133.9,-6,4.1],
    [4,3,-281.1,212,5.6,1.6],[4,4,12.1,-375.6,-7,-4.4],[5,0,-233.2,0,0.6,0],
    [5,1,368.9,45.4,1.4,-0.5],[5,2,187.2,220.2,0,2.2],[5,3,-138.7,-122.9,0.6,0.4],
    [5,4,-142,43,2.2,1.7],[5,5,20.9,106.1,0.9,1.9],[6,0,64.4,0,-0.2,0],[6,1,63.8,-18.4,-0.4,0.3],
    [6,2,76.9,16.8,0.9,-1.6],[6,3,-115.7,48.8,1.2,-0.4],[6,4,-40.9,-59.8,-0.9,0.9],
    [6,5,14.9,10.9,0.3,0.7],[6,6,-60.7,72.7,0.9,0.9],[7,0,79.5,0,0,0],[7,1,-77,-48.9,-0.1,0.6],
    [7,2,-8.8,-14.4,-0.1,0.5],[7,3,59.3,-1,0.5,-0.8],[7,4,15.8,23.4,-0.1,0],[7,5,2.5,-7.4,-0.8,-1],
    [7,6,-11.1,-25.1,-0.8,0.6],[7,7,14.2,-2.3,0.8,-0.2],[8,0,23.2,0,-0.1,0],[8,1,10.8,7.1,0.2,-0.2],
    [8,2,-17.5,-12.6,0,0.5],[8,3,2,11.4,0.5,-0.4],[8,4,-21.7,-9.7,-0.1,0.4],
    [8,5,16.9,12.7,0.3,-0.5],[8,6,15,0.7,0.2,-0.6],[8,7,-16.8,-5.2,0,0.3],[8,8,0.9,3.9,0.2,0.2],
    [9,0,4.6,0,0,0],[9,1,7.8,-24.8,-0.1,-0.3],[9,2,3,12.2,0.1,0.3],[9,3,-0.2,8.3,0.3,-0.3],
    [9,4,-2.5,-3.3,-0.3,0.3],[9,5,-13.1,-5.2,0,0.2],[9,6,2.4,7.2,0.3,-0.1],[9,7,8.6,-0.6,-0.1,-0.2],
    [9,8,-8.7,0.8,0.1,0.4],[9,9,-12.9,10,-0.1,0.1],[10,0,-1.3,0,0.1,0],[10,1,-6.4,3.3,0,0],
    [10,2,0.2,0,0.1,0],[10,3,2,2.4,0.1,-0.2],[10,4,-1,5.3,0,0.1],[10,5,-0.6,-9.1,-0.3,-0.1],
    [10,6,-0.9,0.4,0,0.1],[10,7,1.5,-4.2,-0.1,0],[10,8,0.9,-3.8,-0.1,-0.1],[10,9,-2.7,0.9,0,0.2],
    [10,10,-3.9,-9.1,0,0],[11,0,2.9,0,0,0],[11,1,-1.5,0,0,0],[11,2,-2.5,2.9,0,0.1],
    [11,3,2.4,-0.6,0,0],[11,4,-0.6,0.2,0,0.1],[11,5,-0.1,0.5,-0.1,0],[11,6,-0.6,-0.3,0,0],
    [11,7,-0.1,-1.2,0,0.1],[11,8,1.1,-1.7,-0.1,0],[11,9,-1,-2.9,-0.1,0],[11,10,-0.2,-1.8,-0.1,0],
    [11,11,2.6,-2.3,-0.1,0],[12,0,-2,0,0,0],[12,1,-0.2,-1.3,0,0],[12,2,0.3,0.7,0,0],
    [12,3,1.2,1,0,-0.1],[12,4,-1.3,-1.4,0,0.1],[12,5,0.6,0,0,0],[12,6,0.6,0.6,0.1,0],
    [12,7,0.5,-0.1,0,0],[12,8,-0.1,0.8,0,0],[12,9,-0.4,0.1,0,0],[12,10,-0.2,-1,-0.1,0],
    [12,11,-1.3,0.1,0,0],[12,12,-0.7,0.2,-0.1,-0.1]
  ];

  const A = 6378.137;                 // WGS-84 semi-major axis (km)
  const F = 1 / 298.257223563;        // WGS-84 flattening
  const E2 = F * (2 - F);
  const RE = 6371.2;                  // geomagnetic reference radius (km)
  const D2R = Math.PI / 180;

  function decimalYear(date) {
    const y = date.getUTCFullYear();
    const start = Date.UTC(y, 0, 1), end = Date.UTC(y + 1, 0, 1);
    return y + (date.getTime() - start) / (end - start);
  }

  function declination(lat, lng, date, altKm) {
    if (!isFinite(lat) || !isFinite(lng)) return 0;
    const t = typeof date === 'number' ? date : decimalYear(date || new Date());
    const dt = t - EPOCH;
    const alt = altKm || 0;

    // geodetic → geocentric spherical
    const phi = lat * D2R, lam = lng * D2R;
    const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
    const rc = A / Math.sqrt(1 - E2 * sinPhi * sinPhi);
    const xp = (rc + alt) * cosPhi, zp = (rc * (1 - E2) + alt) * sinPhi;
    const r = Math.hypot(xp, zp);
    const phiC = Math.asin(zp / r);
    const s = Math.sin(phiC), c = Math.cos(phiC);

    // Schmidt semi-normalised associated Legendre functions P[n][m] of
    // sin(phiC) and their derivatives dP[n][m] with respect to phiC
    const P = [], dP = [];
    for (let n = 0; n <= N_MAX; n++) { P.push(new Array(n + 1).fill(0)); dP.push(new Array(n + 1).fill(0)); }
    P[0][0] = 1;
    for (let n = 1; n <= N_MAX; n++) {
      for (let m = 0; m <= n; m++) {
        if (n === m) {
          const k = n === 1 ? 1 : Math.sqrt((2 * n - 1) / (2 * n));
          P[n][n]  = k * c * P[n - 1][n - 1];
          dP[n][n] = k * (c * dP[n - 1][n - 1] - s * P[n - 1][n - 1]);
        } else {
          const k1 = 2 * n - 1, den = Math.sqrt(n * n - m * m);
          const has2 = n - 2 >= m;
          const k2 = has2 ? Math.sqrt((n - 1) * (n - 1) - m * m) : 0;
          const p2 = has2 ? P[n - 2][m] : 0, d2 = has2 ? dP[n - 2][m] : 0;
          P[n][m]  = (k1 * s * P[n - 1][m] - k2 * p2) / den;
          dP[n][m] = (k1 * (c * P[n - 1][m] + s * dP[n - 1][m]) - k2 * d2) / den;
        }
      }
    }

    // field in the spherical frame (north, east, down)
    let bx = 0, by = 0, bz = 0;
    const ratio = RE / r;
    for (const [n, m, g0, h0, gd, hd] of COEFFS) {
      const g = g0 + dt * gd, h = h0 + dt * hd;
      const rr = Math.pow(ratio, n + 2);
      const cm = Math.cos(m * lam), sm = Math.sin(m * lam);
      bx -= rr * (g * cm + h * sm) * dP[n][m];
      by += rr * m * (g * sm - h * cm) * P[n][m];
      bz -= rr * (n + 1) * (g * cm + h * sm) * P[n][m];
    }
    by /= c;

    // rotate the north component back to the geodetic frame
    const psi = phiC - phi;
    const north = bx * Math.cos(psi) - bz * Math.sin(psi);
    return Math.atan2(by, north) / D2R;
  }

  global.WMM = { declination };
})(typeof window !== 'undefined' ? window : globalThis);
