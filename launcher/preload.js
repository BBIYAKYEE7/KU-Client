const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  openPortal: (payload) => ipcRenderer.invoke('launcher-open-portal', payload || {}),
  openLMS: (payload) => ipcRenderer.invoke('launcher-open-lms', payload || {}),
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  onSystemThemeChange: (callback) => {
    ipcRenderer.on('system-theme-changed', (event, theme) => {
      callback(theme);
    });
  },
  // 자격 증명 API
  saveCredentials: ({ account, password }) => ipcRenderer.invoke('creds-save', { account, password }),
  loadCredentials: ({ account }) => ipcRenderer.invoke('creds-load', { account }),
  deleteCredentials: ({ account }) => ipcRenderer.invoke('creds-delete', { account })
});

// ===== 빠른 포털 자동 로그인 주입 =====
// 메인에서 자격증명을 받으면, 로그인 페이지에서 즉시 채우고 제출
(function fastPortalAutoLogin() {
  let creds = null;
  ipcRenderer.on('portal-credentials', (_e, payload) => {
    creds = payload || null;
    tryInject();
  });

  function isPortalLogin() {
    try {
      return /portal\.korea\.ac\.kr\/common\/Login\.kpd/.test(location.href);
    } catch { return false; }
  }

  function fillAndSubmit() {
    try {
      if (!creds || !creds.account || !creds.password) return false;
      var idEl = document.getElementById('oneid');
      var pwEl = document.getElementById('_pw');
      if (!idEl || !pwEl) return false;
      idEl.value = creds.account;
      pwEl.value = creds.password;
      var btn = document.getElementById('loginsubmit');
      if (btn) { btn.click(); return true; }
      var form = idEl && idEl.form ? idEl.form : document.querySelector('form[action*="/common/Login.kpd"]');
      if (form) { form.submit(); return true; }
      return false;
    } catch { return false; }
  }

  function tryInject() {
    if (!isPortalLogin()) return;
    if (fillAndSubmit()) return;
    const obs = new MutationObserver((_m, o) => { if (fillAndSubmit()) { o.disconnect(); } });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    // 안전망: 아주 빠른 재시도 몇 번
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (fillAndSubmit() || tries > 20) clearInterval(t);
    }, 25);
  }

  // DOM 상태 변화에 맞춰 최대한 빠르게 시도
  document.addEventListener('readystatechange', () => { tryInject(); }, true);
  document.addEventListener('DOMContentLoaded', () => { tryInject(); }, true);
})();

// ===== 빠른 LMS 자동 로그인 주입 =====
(function fastLmsAutoLogin() {
  let creds = null;
  ipcRenderer.on('lms-credentials', (_e, payload) => {
    creds = payload || null;
    tryInject();
  });

  function isLmsLogin() {
    try {
      const href = location.href;
      return /kulms\.korea\.ac\.kr\//.test(href) || /\/Login\.do$/.test(href) || document.getElementById('one_id');
    } catch { return false; }
  }

  function fillAndSubmit() {
    try {
      if (!creds || !creds.account || !creds.password) return false;
      var idEl = document.getElementById('one_id');
      var pwEl = document.getElementById('password');
      if (!idEl || !pwEl) return false;
      idEl.value = creds.account;
      pwEl.value = creds.password;
      var btn = document.querySelector('button.userTypeCheck') || document.querySelector('.userTypeCheck');
      if (btn) { btn.click(); return true; }
      var form = document.getElementById('loginFrm') || document.querySelector('form[action*="/Login.do"]');
      if (form) { form.submit(); return true; }
      return false;
    } catch { return false; }
  }

  function tryInject() {
    if (!isLmsLogin()) return;
    if (fillAndSubmit()) return;
    const obs = new MutationObserver((_m, o) => { if (fillAndSubmit()) { o.disconnect(); } });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    let tries = 0;
    const t = setInterval(() => { tries++; if (fillAndSubmit() || tries > 20) clearInterval(t); }, 25);
  }

  document.addEventListener('readystatechange', () => { tryInject(); }, true);
  document.addEventListener('DOMContentLoaded', () => { tryInject(); }, true);
})();


