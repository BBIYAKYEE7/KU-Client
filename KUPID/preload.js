const { contextBridge, ipcRenderer } = require('electron');

// Pretendard 폰트 CSS 주입 함수 (개선된 버전)
function injectPretendardFont() {
  try {
    console.log('Pretendard 폰트 주입 시작...');
    
    // 기존 스타일 제거
    const existingStyles = document.querySelectorAll('#pretendard-font-injection, #pretendard-force-style');
    existingStyles.forEach(style => style.remove());
    
    // 1. 기본 폰트 CSS (시스템 폰트 우선 사용)
    const style = document.createElement('style');
    style.id = 'pretendard-font-injection';
    style.textContent = `
      /* 시스템에 설치된 Pretendard 폰트 사용 */
      @font-face {
        font-family: 'Pretendard';
        src: local('Pretendard'), local('Pretendard-Regular'), local('Pretendard Regular');
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Pretendard';
        src: local('Pretendard-Bold'), local('Pretendard Bold'), local('PretendardBold');
        font-weight: 700;
        font-style: normal;
        font-display: swap;
      }
    `;
    document.head.appendChild(style);
    
    // 2. 강제 적용 스타일 (최고 우선순위)
    const forceStyle = document.createElement('style');
    forceStyle.id = 'pretendard-force-style';
    forceStyle.textContent = `
      /* 최고 우선순위로 모든 요소에 폰트 적용 */
      html, html * {
        font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      }
      
      /* 바탕체 관련 클래스 강제 제거 */
      .batang, .batang *, [class*="batang"], [class*="Batang"], .gulim, .gulim *, [class*="gulim"], [class*="Gulim"] {
        font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      }
      
      /* 인라인 스타일 무시 */
      [style*="font-family"], [style*="fontFamily"] {
        font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      }
      
      /* CSS 변수 재정의 */
      :root {
        --font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      }
    `;
    document.head.appendChild(forceStyle);
    
    // 3. 모든 기존 요소에 직접 스타일 적용
    function applyFontToAllElements() {
      try {
        const allElements = document.querySelectorAll('*');
        allElements.forEach(element => {
          if (element.style) {
            element.style.setProperty('font-family', 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', 'important');
          }
        });
      } catch (error) {
        console.error('요소별 폰트 적용 오류:', error);
      }
    }
    
    // 즉시 적용
    applyFontToAllElements();
    
    // 4. MutationObserver로 동적 요소 처리
    const observer = new MutationObserver((mutations) => {
      let shouldReapply = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldReapply = true;
        }
      });
      
      if (shouldReapply) {
        setTimeout(applyFontToAllElements, 100);
      }
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: true,
      attributeFilter: ['style']
    });
    
    // 5. 주기적으로 재적용 (더 안정적인 방법)
    const intervalId = setInterval(() => {
      applyFontToAllElements();
    }, 2000);
    
    // 10초 후 인터벌 중단
    setTimeout(() => {
      clearInterval(intervalId);
      console.log('Pretendard 폰트 주기적 적용 완료');
    }, 10000);
    
    console.log('Pretendard 폰트가 모든 페이지에 주입되었습니다.');
  } catch (error) {
    console.error('Pretendard 폰트 주입 중 오류:', error);
  }
}

// 렌더러 프로세스에서 사용할 API 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 세션 타이머 재설정
  resetSessionTimer: () => ipcRenderer.invoke('reset-session-timer'),
  
  // 세션 정보 가져오기
  getSessionInfo: () => ipcRenderer.invoke('get-session-info'),
  
  // 자동 로그인 관련 API
  getLoginConfig: () => ipcRenderer.invoke('get-login-config'),
  saveLoginConfig: (config) => ipcRenderer.invoke('save-login-config', config),
  clearLoginConfig: () => ipcRenderer.invoke('clear-login-config'),
  performAutoLogin: (credentials) => ipcRenderer.invoke('perform-auto-login', credentials),
  triggerAutoLogin: () => ipcRenderer.invoke('trigger-auto-login'),
  startPortal: () => ipcRenderer.invoke('start-portal'),
  openLoginSetup: () => ipcRenderer.invoke('open-login-setup'),
  
  // Pretendard 폰트 주입
  injectPretendardFont: () => injectPretendardFont(),
  
  // 업데이트 관련 API
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  enableUpdateCheck: () => ipcRenderer.invoke('enable-update-check'),
  disableUpdateCheck: () => ipcRenderer.invoke('disable-update-check'),
  enableAutoUpdate: () => ipcRenderer.invoke('enable-auto-update'),
  disableAutoUpdate: () => ipcRenderer.invoke('disable-auto-update'),
  getAutoUpdateStatus: () => ipcRenderer.invoke('get-auto-update-status'),
  
  // 사용자 활동 감지
  onUserActivity: (callback) => {
    try {
      // 마우스 클릭, 키보드 입력, 스크롤 등의 사용자 활동 감지
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
      
      events.forEach(event => {
        document.addEventListener(event, () => {
          if (callback && typeof callback === 'function') {
            callback();
          }
        }, { passive: true });
      });
    } catch (error) {
      console.error('사용자 활동 감지 설정 오류:', error);
    }
  },
  
  // PDF 뷰어용 API
  getCookieHeader: (url) => ipcRenderer.invoke('get-cookie-header', url),
  fetchPdfBase64: (url) => ipcRenderer.invoke('fetch-pdf-base64', url),
  viewerGoBack: () => ipcRenderer.invoke('viewer-go-back'),
  viewerGoHome: () => ipcRenderer.invoke('viewer-go-home')
});

// 페이지 로드 시 세션 타이머 재설정 및 폰트 주입
window.addEventListener('load', () => {
  ipcRenderer.invoke('reset-session-timer');
  injectPretendardFont();
});

// DOMContentLoaded 시에도 폰트 주입
document.addEventListener('DOMContentLoaded', () => {
  injectPretendardFont();
});

// 사용자 활동 시 세션 타이머 재설정
if (window.electronAPI && window.electronAPI.onUserActivity) {
  window.electronAPI.onUserActivity(() => {
    ipcRenderer.invoke('reset-session-timer');
  });
}
