(function () {
  'use strict';

  const base = location.pathname.includes('/pages/') ? '../' : './';

  let deferredPrompt = null;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isInstalled = localStorage.getItem('zad_installed') === 'true';
  const hasDismissed = sessionStorage.getItem('zad_dismiss_install') === 'true';

  if (isStandalone || isInstalled) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    localStorage.setItem('zad_installed', 'false');
  });

  window.addEventListener('appinstalled', () => {
    localStorage.setItem('zad_installed', 'true');
    const toast = document.getElementById('pwa-install-toast');
    if (toast) toast.remove();
  });

  setTimeout(() => {
    if (!deferredPrompt || hasDismissed) return;
    showToast();
  }, 3000);

  function showToast() {
    const existing = document.getElementById('pwa-install-toast');
    if (existing) return;

    const toast = document.createElement('div');
    toast.id = 'pwa-install-toast';
    toast.innerHTML =
      '<div class="pwa-install-glass">' +
        '<div class="pwa-install-row">' +
           '<img class="pwa-install-icon" src="' + base + 'icons/icon-192.png" alt="" width="44" height="44">' +
          '<div class="pwa-install-text">' +
            '<span class="pwa-install-title">' + (window.I18n ? window.I18n.t('app_name') : 'زاد المسلم') + '</span>' +
            '<span class="pwa-install-sub">' + (window.I18n ? window.I18n.t('pwa_install_desc') : 'حمّل التطبيق للوصول السريع') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="pwa-install-actions">' +
          '<button class="pwa-install-btn pwa-install-btn-primary" id="pwaInstallBtn">' + (window.I18n ? window.I18n.t('pwa_install') : 'تثبيت') + '</button>' +
          '<button class="pwa-install-btn pwa-install-btn-skip" id="pwaDismissBtn">' + (window.I18n ? window.I18n.t('pwa_later') : 'لاحقاً') + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('pwa-install-visible'));

    document.getElementById('pwaInstallBtn').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        localStorage.setItem('zad_installed', 'true');
      }
      deferredPrompt = null;
      toast.classList.remove('pwa-install-visible');
      setTimeout(() => toast.remove(), 400);
    });

    document.getElementById('pwaDismissBtn').addEventListener('click', () => {
      sessionStorage.setItem('zad_dismiss_install', 'true');
      toast.classList.remove('pwa-install-visible');
      setTimeout(() => toast.remove(), 400);
    });
  }
})();
