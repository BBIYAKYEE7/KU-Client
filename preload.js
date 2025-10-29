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
  deleteCredentials: ({ account }) => ipcRenderer.invoke('creds-delete', { account }),
  // KUPID 설정에서 마이그레이션
  migrateFromKupidConfig: () => ipcRenderer.invoke('migrate-from-kupid-config'),
  
  // 알림 관리
  startNotificationChecks: () => ipcRenderer.invoke('start-notification-checks'),
  stopNotificationChecks: () => ipcRenderer.invoke('stop-notification-checks'),
  checkForNewMessages: () => ipcRenderer.invoke('check-for-new-messages'),
  checkAssignmentDeadlines: () => ipcRenderer.invoke('check-assignment-deadlines'),
  testNotification: (type) => ipcRenderer.invoke('test-notification', type)
});

// ===== Canvas 경고 배너 즉시 억제(최초 깜빡임 방지) =====
(function suppressCanvasWarningEarly() {
  try {
    const href = location.href;
    const host = location.hostname || '';
    const isCanvasRelated = /(?:^|\.)mylms\.korea\.ac\.kr$/i.test(host) || /(?:^|\.)lms\.korea\.ac\.kr$/i.test(host) || /instructure\.com/i.test(href);
    if (!isCanvasRelated) return;

    const styleText = '.ic-flash-warning.flash-message-container.unsupported_browser{display:none!important;visibility:hidden!important;opacity:0!important;}';
    function injectStyleOnce() {
      try {
        if (document.getElementById('__kuCanvasHideStyle')) return;
        const style = document.createElement('style');
        style.id = '__kuCanvasHideStyle';
        style.type = 'text/css';
        style.appendChild(document.createTextNode(styleText));
        (document.head || document.documentElement).appendChild(style);
      } catch (_) {}
    }

    // 가능한 한 빨리 스타일 주입
    injectStyleOnce();
    document.addEventListener('readystatechange', injectStyleOnce, true);
    document.addEventListener('DOMContentLoaded', injectStyleOnce, true);

    // 배너 노드가 생성되자마자 제거
    const removeNow = () => {
      try {
        document.querySelectorAll('.ic-flash-warning.flash-message-container.unsupported_browser').forEach(el => el.remove());
      } catch (_) {}
    };
    removeNow();
    const mo = new MutationObserver(() => removeNow());
    mo.observe(document.documentElement, { childList: true, subtree: true });

    // 5초 후 옵저버 정리 (초기 로드 구간만 감시)
    setTimeout(() => { try { mo.disconnect(); } catch (_) {} }, 5000);
  } catch (_) {}
})();

// ===== 빠른 포털 자동 로그인 주입 =====
// 메인에서 자격증명을 받으면, 로그인 페이지에서 즉시 채우고 제출
(function fastPortalAutoLogin() {
  let creds = null;
  ipcRenderer.on('portal-credentials', (_e, payload) => {
    // 민감정보 로그 제거
    creds = payload || null;
    tryInject();
  });

  function isPortalLogin() {
    try {
      const currentUrl = location.href;
      // 상세 URL 로그 제거
      
      // 다양한 포털 로그인 페이지 패턴 확인
      const isLoginPage = /portal\.korea\.ac\.kr\/common\/Login\.kpd/.test(currentUrl) ||
                         /portal\.korea\.ac\.kr.*Login/.test(currentUrl) ||
                         /portal\.korea\.ac\.kr/.test(currentUrl);
      
      // DOM 요소로도 확인
      const hasLoginForm = document.getElementById('oneid') || 
                          document.getElementById('one_id') ||
                          document.querySelector('input[placeholder*="KUPID"]') ||
                          document.querySelector('input[placeholder*="Single ID"]') ||
                          document.querySelector('input[type="password"]');
      
      // 탐지 결과 세부 로그 제거
      
      return isLoginPage || !!hasLoginForm;
    } catch (error) {
      console.error('URL 확인 오류:', error);
      return false;
    }
  }

  function fillAndSubmit() {
    try {
      if (!creds || !creds.account || !creds.password) return false;
      
      // 다양한 방법으로 로그인 필드 찾기
      var idEl = document.getElementById('oneid') || 
                 document.getElementById('one_id') ||
                 document.querySelector('input[name="oneid"]') ||
                 document.querySelector('input[name="one_id"]') ||
                 document.querySelector('input[placeholder*="KUPID"]') ||
                 document.querySelector('input[placeholder*="Single ID"]') ||
                 document.querySelector('input[type="text"]');
      
      var pwEl = document.getElementById('_pw') ||
                 document.getElementById('password') ||
                 document.querySelector('input[name="_pw"]') ||
                 document.querySelector('input[name="password"]') ||
                 document.querySelector('input[placeholder*="Password"]') ||
                 document.querySelector('input[type="password"]');
      
      // 요소 탐지/계정 값 로깅 제거
      
      if (!idEl || !pwEl) return false;
      
      // 기존 값 지우기
      idEl.value = '';
      pwEl.value = '';
      
      // 로그인 정보 입력
      idEl.value = creds.account;
      pwEl.value = creds.password;
      
      // 입력 이벤트 발생
      idEl.dispatchEvent(new Event('input', { bubbles: true }));
      pwEl.dispatchEvent(new Event('input', { bubbles: true }));
      idEl.dispatchEvent(new Event('change', { bubbles: true }));
      pwEl.dispatchEvent(new Event('change', { bubbles: true }));
      
      // 로그인 버튼 찾기
      var btn = document.getElementById('loginsubmit') ||
                document.querySelector('input[type="submit"]') ||
                document.querySelector('button[type="submit"]') ||
                document.querySelector('input[value="Login"]') ||
                document.querySelector('input[value="로그인"]') ||
                document.querySelector('button[onclick*="login"]') ||
                document.querySelector('button[onclick*="Login"]');
      
      if (btn) { 
        // 클릭 시도 로그 제거
        btn.click(); 
        return true; 
      }
      
      // 폼 제출 시도
      var form = idEl && idEl.form ? idEl.form : 
                 document.querySelector('form[action*="/common/Login.kpd"]') ||
                 document.querySelector('form[action*="/Login.kpd"]') ||
                 document.querySelector('form[method="post"]');
      
      if (form) { 
        // 폼 제출 로그 제거
        form.submit(); 
        return true; 
      }
      
      // Enter 키 시뮬레이션
      // 키 시뮬레이션 로그 제거
      pwEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      return true;
    } catch (error) {
      console.error('포털 자동 로그인 오류:', error);
      return false;
    }
  }

  function tryInject() {
    // 과도한 재시도 로그 제거
    
    // 자격 증명이 없으면 시도하지 않음
    if (!creds || !creds.account || !creds.password) {
      // 자격 증명 없음 로그 제거
      return;
    }
    
    if (!isPortalLogin()) {
      // 비로그인 페이지 로그 제거
      return;
    }
    
    // 감지 로그 제거
    if (fillAndSubmit()) {
      return;
    }
    
    // 재시도 로그 제거
    // 더 빠른 재시도 (간격 단축)
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (fillAndSubmit() || tries > 10) {
        clearInterval(t);
      }
    }, 50); // 25ms -> 50ms로 조정하여 안정성 향상
  }

  // DOM 상태 변화에 맞춰 최대한 빠르게 시도
  document.addEventListener('readystatechange', () => { tryInject(); }, true);
  document.addEventListener('DOMContentLoaded', () => { tryInject(); }, true);
  
  // 추가적인 이벤트 리스너
  window.addEventListener('load', () => { 
    setTimeout(tryInject, 100); 
  });
  
  // 페이지가 완전히 로드된 후에도 시도
  setTimeout(() => {
    tryInject();
  }, 1000);
})();

// ===== 빠른 LMS 자동 로그인 주입 =====
(function fastLmsAutoLogin() {
  let creds = null;
  let hasCompletedAutoLogin = false; // 로그인 성공/시도 완료 후 재시도 방지
  ipcRenderer.on('lms-credentials', (_e, payload) => {
    // 민감정보 로그 제거
    creds = payload || null;
    tryInject();
  });

  function isLmsLogin() {
    try {
      const href = location.href;
      // 상세 URL 로그 제거
      const url = new URL(href);
      const host = url.hostname;
      const path = url.pathname + url.search;

      // 로그인 전용 호스트/경로만 허용 (프로필/설정 등 일반 페이지 제외)
      const isLoginHost = /^(sso|lms)\.korea\.ac\.kr$/i.test(host);
      const isExplicitLoginPath = /(Login|login)\b|Login\.do|login\.php/i.test(path) || /Login\.do/i.test(href);

      // DOM 상의 로그인 폼(정확한 선택자만) 존재 여부
      const hasLoginForm = document.getElementById('loginFrm') ||
                           document.querySelector('form[name="loginFrm"]') ||
                           document.querySelector('form[action*="Login.do"]') ||
                           document.querySelector('button.userTypeCheck, button[onclick*="userTypeCheck"]');

      const isLoginPage = (isLoginHost || isExplicitLoginPath) && !!hasLoginForm;

      // 탐지 결과 세부 로그 제거

      return isLoginPage;
    } catch (error) {
      console.error('LMS URL 확인 오류:', error);
      return false;
    }
  }

  function fillAndSubmit() {
    try {
      if (hasCompletedAutoLogin) {
        return true;
      }
      if (!creds || !creds.account || !creds.password) {
        return false;
      }
      
      // 상세 시도 로그 제거
      
      // LMS 로그인 폼 요소 찾기 (LMS 특화 - 더 정확한 선택자)
      var idEl = document.getElementById('one_id') || 
                 document.querySelector('input[name="one_id"]') ||
                 document.querySelector('input[name="user_id"]');
      
      var pwEl = document.getElementById('password') ||
                 document.querySelector('input[name="user_password"]') ||
                 document.querySelector('input[name="password"]');
      
      // 필드 탐지 로그 제거
      
      if (!idEl || !pwEl) return false;
      
      // 기존 값 지우기
      idEl.value = '';
      pwEl.value = '';
      
      // 로그인 정보 입력
      // 입력 값/길이 로그 제거
      idEl.value = creds.account;
      pwEl.value = creds.password;
      
      // 입력 완료 로그 제거
      
      // 입력 이벤트 발생 (LMS 특화 - 더 강력한 이벤트)
      idEl.dispatchEvent(new Event('input', { bubbles: true }));
      pwEl.dispatchEvent(new Event('input', { bubbles: true }));
      idEl.dispatchEvent(new Event('change', { bubbles: true }));
      pwEl.dispatchEvent(new Event('change', { bubbles: true }));
      idEl.dispatchEvent(new Event('blur', { bubbles: true }));
      pwEl.dispatchEvent(new Event('blur', { bubbles: true }));
      
      // 포커스 이벤트도 발생
      idEl.focus();
      pwEl.focus();
      
      // 로그인 버튼 찾기 (LMS 특화 - 더 정확한 버튼 선택자)
      var btn = document.querySelector('button[type="button"].userTypeCheck') ||
                document.querySelector('button[onclick*="userTypeCheck"]') ||
                document.querySelector('input[type="submit"]') || 
                document.querySelector('button[type="submit"]');
      
      if (btn) { 
        btn.click(); 
        hasCompletedAutoLogin = true;
        return true; 
      }
      
      // 폼 제출 시도 (LMS 특화)
      var form = document.getElementById('loginFrm') ||
                 document.querySelector('form[name="loginFrm"]') ||
                 document.querySelector('form[action*="Login.do"]') ||
                 document.querySelector('form[method="post"]');
      
      if (form) { 
        form.submit(); 
        hasCompletedAutoLogin = true;
        return true; 
      }
      
      // Enter 키 시뮬레이션 (LMS 특화 - 더 강력한 이벤트)
      // 키 시뮬레이션 로그 제거
      pwEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      pwEl.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      pwEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      hasCompletedAutoLogin = true;
      return true;
    } catch (error) {
      console.error('LMS 자동 로그인 오류:', error);
      return false;
    }
  }

  function tryInject() {
    // 과도한 재시도 로그 제거
    if (hasCompletedAutoLogin) {
      return;
    }
    
    // 자격 증명이 없으면 시도하지 않음
    if (!creds || !creds.account || !creds.password) {
      // 자격 증명 없음 관련 상세 로그 제거
      return;
    }
    
    if (!isLmsLogin()) {
      return;
    }
    
    // 감지 로그 제거
    if (fillAndSubmit()) {
      return;
    }
    
    // 첫 실패/감시 로그 제거
    const obs = new MutationObserver((_m, o) => { 
      if (fillAndSubmit()) { 
        o.disconnect(); 
      } 
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    
    let tries = 0;
    const t = setInterval(() => { 
      tries++; 
      if (hasCompletedAutoLogin || fillAndSubmit() || tries > 20) {
        clearInterval(t);
        obs.disconnect();
      }
    }, 25);
  }

  document.addEventListener('readystatechange', () => { tryInject(); }, true);
  document.addEventListener('DOMContentLoaded', () => { tryInject(); }, true);
  
  // 추가적인 이벤트 리스너
  window.addEventListener('load', () => { 
    setTimeout(tryInject, 100); 
  });
  
  // 페이지가 완전히 로드된 후에도 시도
  setTimeout(() => {
    tryInject();
  }, 1000);
})();
