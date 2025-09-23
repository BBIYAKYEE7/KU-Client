// 웹뷰 전용 preload 스크립트
(function() {
  'use strict';
  
  console.log('웹뷰 preload 스크립트 로드됨');
  
  // 기본 브라우저 팝업(alert/confirm/prompt) 억제 및 자동 처리
  (function suppressNativeDialogs(){
    try {
      const noop = () => undefined;
      
      window.alert = (...args) => { try { console.warn('[blocked alert]', args && args[0]); } catch(_) {} };
      window.confirm = (...args) => { try { console.warn('[auto confirm: true]', args && args[0]); } catch(_) {} return true; };
      window.prompt = (...args) => { try { console.warn('[auto prompt: empty]', args && args[0]); } catch(_) {} return ''; };
      window.print = noop;
      window.open = (...args) => { try { console.warn('[blocked window.open]', args && args[0]); } catch(_) {} return null; };
      
      // beforeunload 이벤트 차단
      window.addEventListener('beforeunload', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }, true);
      
      // 주기적으로 재적용
      setInterval(() => {
        try {
          window.alert = (...args) => { try { console.warn('[blocked alert]', args && args[0]); } catch(_) {} };
          window.confirm = (...args) => { try { console.warn('[auto confirm: true]', args && args[0]); } catch(_) {} return true; };
          window.prompt = (...args) => { try { console.warn('[auto prompt: empty]', args && args[0]); } catch(_) {} return ''; };
          window.print = noop;
          window.open = (...args) => { try { console.warn('[blocked window.open]', args && args[0]); } catch(_) {} return null; };
        } catch (_) {}
      }, 1000);
    } catch (_) {}
  })();
  
  // Pretendard 폰트 주입 함수 (모든 요소 강제 적용)
  function injectPretendardFont() {
    try {
      console.log('Pretendard 폰트 강력 주입 시작...');
      
      // 기존 스타일 제거
      const existingStyles = document.querySelectorAll('#pretendard-font-injection, #pretendard-force-style');
      existingStyles.forEach(style => style.remove());
      
      // 폰트 CSS 강력 주입 (Variable 폰트 방식)
      const fontCSS = `
        @font-face {
          font-family: 'Pretendard';
          src: url('./fonts/Pretendard-Regular.woff2') format('woff2');
          font-weight: 100 900;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'Pretendard';
          src: url('./fonts/Pretendard-Bold.woff2') format('woff2');
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }
        
        /* 모든 요소에 강제 적용 */
        html, body, * {
          font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          font-display: swap !important;
        }
        
        /* 모든 텍스트 요소 강제 적용 */
        *, *::before, *::after {
          font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          font-display: swap !important;
        }
        
        /* 바탕체 관련 클래스 강제 제거 */
        .batang, .batang *, [class*="batang"], [class*="Batang"], 
        .gulim, .gulim *, [class*="gulim"], [class*="Gulim"],
        [class*="batang"], [class*="Batang"], [class*="gulim"], [class*="Gulim"] {
          font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          font-display: swap !important;
        }
        
        /* 인라인 스타일 무시 */
        [style*="font-family"], [style*="fontFamily"] {
          font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          font-display: swap !important;
        }
        
        /* CSS 변수 재정의 */
        :root {
          --font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          --font-display: swap !important;
        }
        
        /* 모든 가능한 폰트 관련 속성 강제 적용 */
        [style*="font"], [style*="Font"] {
          font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          font-display: swap !important;
        }
      `;
      
      const style = document.createElement('style');
      style.id = 'pretendard-font-injection';
      style.textContent = fontCSS;
      document.head.appendChild(style);
      
      // 모든 요소에 직접 스타일 강제 적용
      function applyFontToAllElements() {
        try {
          const allElements = document.querySelectorAll('*');
          allElements.forEach(element => {
            if (element.style) {
              element.style.setProperty('font-family', 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', 'important');
              element.style.setProperty('font-display', 'swap', 'important');
            }
          });
          console.log('모든 요소에 Pretendard 폰트 적용 완료');
        } catch (error) {
          console.warn('요소별 폰트 적용 오류:', error);
        }
      }
      
      // 즉시 적용
      applyFontToAllElements();
      
      // 주기적으로 재적용 (2초마다, 10초간)
      let applyCount = 0;
      const intervalId = setInterval(() => {
        applyFontToAllElements();
        applyCount++;
        if (applyCount >= 5) {
          clearInterval(intervalId);
          console.log('Pretendard 폰트 주기적 적용 완료');
        }
      }, 2000);
      
      console.log('Pretendard 폰트 강력 주입 완료');
    } catch (error) {
      console.warn('폰트 주입 실패:', error);
    }
  }
  
  // 페이지 로드 시 폰트 주입
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectPretendardFont);
  } else {
    injectPretendardFont();
  }
  
  // 추가로 window load 이벤트에서도 주입
  window.addEventListener('load', injectPretendardFont);
  
  // MutationObserver로 동적 콘텐츠 처리 (깜빡임 방지)
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            if (node.style) {
              node.style.setProperty('font-family', 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', 'important');
              node.style.setProperty('font-display', 'swap', 'important');
            }
            // 자식 요소들도 처리
            const childElements = node.querySelectorAll('*');
            childElements.forEach(element => {
              if (element.style) {
                element.style.setProperty('font-family', 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', 'important');
                element.style.setProperty('font-display', 'swap', 'important');
              }
            });
          }
        });
      }
    });
  });
  
  // body가 준비되면 observer 시작
  if (document.body) {
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { 
        childList: true, 
        subtree: true 
      });
    });
  }
  
  console.log('웹뷰 preload 스크립트 초기화 완료');
})();
