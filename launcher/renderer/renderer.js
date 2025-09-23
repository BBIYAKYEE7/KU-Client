document.addEventListener('DOMContentLoaded', () => {
  const portal = document.getElementById('btn-portal');
  const lms = document.getElementById('btn-lms');
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.querySelector('.theme-icon');
  const brandLogo = document.getElementById('brand-logo');
  const bootLoader = document.getElementById('boot-loader');
  const setupModal = document.getElementById('setup-modal');
  const setupAccount = document.getElementById('setup-account');
  const setupPortalPass = document.getElementById('setup-portal-pass');
  const setupSave = document.getElementById('setup-save');
  const setupCancel = document.getElementById('setup-cancel');

  // 부팅화면 관리
  const BootScreen = {
    async start() {
      // 메인에서 skipBoot=1을 넘기면 로딩을 건너뜀
      const params = new URLSearchParams(window.location.search);
      const shouldSkip = params.get('skipBoot') === '1';
      
      if (shouldSkip) {
        const header = document.querySelector('.header');
        const actions = document.querySelector('.actions');
        const footer = document.querySelector('.footer');
        const themeToggleEl = document.querySelector('.theme-toggle');
        if (bootLoader) bootLoader.classList.add('hidden');
        if (header) header.style.display = 'flex';
        if (actions) actions.style.display = 'grid';
        if (footer) footer.style.display = 'flex';
        if (themeToggleEl) themeToggleEl.style.display = 'flex';
        if (brandLogo) brandLogo.classList.add('fade-in');
        // 초기 표시 애니메이션 적용
        if (actions) actions.classList.add('show');
        if (footer) footer.classList.add('show');
        if (themeToggleEl) themeToggleEl.classList.add('show');
        return;
      }
      console.log('부팅화면 시작');
      
      // 모든 요소 숨기기
      const header = document.querySelector('.header');
      const actions = document.querySelector('.actions');
      const footer = document.querySelector('.footer');
      const themeToggle = document.querySelector('.theme-toggle');
      
      if (header) header.style.display = 'none';
      if (actions) actions.style.display = 'none';
      if (footer) footer.style.display = 'none';
      if (themeToggle) themeToggle.style.display = 'none';
      
      // 2.5초간 로딩 애니메이션 표시
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // 로딩 애니메이션 숨기기
      if (bootLoader) {
        bootLoader.classList.add('hidden');
      }
      
      // 헤더 표시 및 로고 페이드인 (가장 먼저)
      setTimeout(() => {
        if (header) header.style.display = 'flex';
        if (brandLogo) {
          brandLogo.classList.add('fade-in');
        }
      }, 100);
      
      // 메인 화면 요소들 표시
      setTimeout(() => {
        if (actions) actions.style.display = 'grid';
        if (footer) footer.style.display = 'flex';
        if (themeToggle) themeToggle.style.display = 'flex';
      }, 200);
      
      // 버튼들과 요소들 순차적 페이드인
      setTimeout(() => {
        if (actions) actions.classList.add('show');
      }, 400);
      
      setTimeout(() => {
        if (footer) footer.classList.add('show');
      }, 600);
      
      setTimeout(() => {
        if (themeToggle) themeToggle.classList.add('show');
      }, 800);
    }
  };

  // 테마 관리
  const ThemeManager = {
    async init() {
      // 저장된 테마 설정 로드
      const savedTheme = localStorage.getItem('launcher-theme');
      if (savedTheme) {
        this.setTheme(savedTheme);
      } else {
        // 시스템 다크모드 감지 (Electron API 우선)
        if (window.launcher && window.launcher.getSystemTheme) {
          try {
            const systemTheme = await window.launcher.getSystemTheme();
            this.setTheme(systemTheme);
          } catch (error) {
            // 폴백: 브라우저 API 사용
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
              this.setTheme('dark');
            } else {
              this.setTheme('light');
            }
          }
        } else {
          // 브라우저 API 사용
          if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            this.setTheme('dark');
          } else {
            this.setTheme('light');
          }
        }
      }

      // 시스템 테마 변경 감지
      if (window.launcher && window.launcher.onSystemThemeChange) {
        window.launcher.onSystemThemeChange((theme) => {
          // 사용자가 수동으로 테마를 변경하지 않은 경우에만 시스템 테마 따르기
          const userTheme = localStorage.getItem('launcher-theme');
          if (!userTheme) {
            this.setTheme(theme);
          }
        });
      }
    },

    setTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('launcher-theme', theme);
      
      // 아이콘 업데이트
      if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
      }
      
      // 로고 업데이트
      if (brandLogo) {
        brandLogo.src = theme === 'dark' ? '../image/logo(b).png' : '../image/logo(w).png';
      }
      
    },

    toggle() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      this.setTheme(newTheme);
    }
  };

  // 테마 토글 버튼
  themeToggle?.addEventListener('click', () => {
    ThemeManager.toggle();
  });

  // 포털 버튼
  portal?.addEventListener('click', async () => {
    portal.classList.add('clicked');
    setTimeout(() => portal.classList.remove('clicked'), 180);
    if (window.launcher && window.launcher.openPortal) {
      const account = localStorage.getItem('kupid-account') || '';
      let password = '';
      if (account && window.launcher.loadCredentials) {
        // 포털/LMS 공통 비밀번호로 통합 저장
        password = await window.launcher.loadCredentials({ account: 'kupid:' + account }) || '';
      }
      window.launcher.openPortal({ account, password });
    }
  });

  // LMS 버튼
  lms?.addEventListener('click', () => {
    lms.classList.add('clicked');
    setTimeout(() => lms.classList.remove('clicked'), 180);
    if (window.launcher && window.launcher.openLMS) {
      window.launcher.openLMS();
    }
  });


  // 테마 매니저 초기화
  ThemeManager.init();

  // 간단한 자격증명 저장/로드 예시 (포털 계정 기준)
  // 추후 UI가 생기면 입력값을 사용하도록 연결 가능
  async function saveLogin(account, password) {
    if (!window.launcher || !window.launcher.saveCredentials) return;
    await window.launcher.saveCredentials({ account, password });
  }

  async function loadLogin(account) {
    if (!window.launcher || !window.launcher.loadCredentials) return null;
    return await window.launcher.loadCredentials({ account });
  }

  async function deleteLogin(account) {
    if (!window.launcher || !window.launcher.deleteCredentials) return false;
    return await window.launcher.deleteCredentials({ account });
  }

  // 최초 실행 시 자격증명 확인 후 모달 표시 (로딩 후)
  (async () => {
    try {
      const lastAccount = localStorage.getItem('kupid-account') || '';
      if (setupAccount) setupAccount.value = lastAccount;
      const account = lastAccount;
      let hasAny = false;
      if (account) {
        const common = await loadLogin('kupid:' + account);
        hasAny = !!common;
      }
      // 로딩 UI가 사라진 뒤에 모달을 표시
      const showModal = () => {
        if (setupModal) {
          setupModal.classList.add('show');
        }
      };
      if (!hasAny) {
        const params = new URLSearchParams(window.location.search);
        const shouldSkip = params.get('skipBoot') === '1';
        if (shouldSkip) {
          // 로딩을 건너뛴 경우 약간 지연 후 표시
          setTimeout(showModal, 200);
        } else {
          // 부팅 로더가 2.5s 후 숨겨지므로 조금 더 딜레이 후 표시
          setTimeout(showModal, 2800);
        }
      }
    } catch (e) {}
  })();

  // 모달 동작
  setupCancel?.addEventListener('click', () => {
    if (!setupModal) return;
    setupModal.classList.remove('show');
  });

  setupSave?.addEventListener('click', async () => {
    const account = (setupAccount?.value || '').trim();
    const portalPw = setupPortalPass?.value || '';
    if (!account) {
      alert('학번을 입력하세요.');
      return;
    }
    localStorage.setItem('kupid-account', account);
    // 공통 비밀번호로 통합 저장 (포털/LMS 동일 자격 증명)
    const commonPw = portalPw;
    if (commonPw) await saveLogin('kupid:' + account, commonPw);
    if (setupModal) setupModal.classList.remove('show');
    // 민감정보 메모리에서 제거
    if (setupPortalPass) setupPortalPass.value = '';
    
  });
  
  // 부팅화면 시작
  BootScreen.start();
});


