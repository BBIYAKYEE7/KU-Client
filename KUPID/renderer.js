// 세션 타이머 관리
class SessionTimer {
    constructor() {
        this.sessionTimeout = 60 * 60 * 1000; // 60분으로 연장
        this.warningTime = 10 * 60 * 1000; // 10분 전 경고로 연장
        this.startTime = Date.now();
        this.timer = null;
        this.countdownTimer = null;
        
        this.init();
    }
    
    init() {
        this.updateTimer();
        this.startTimer();
        this.bindEvents();
    }
    
    startTimer() {
        this.timer = setInterval(() => {
            this.updateTimer();
        }, 1000);
    }
    
    updateTimer() {
        const elapsed = Date.now() - this.startTime;
        const remaining = this.sessionTimeout - elapsed;
        
        if (remaining <= 0) {
            this.showSessionExpired();
            return;
        }
        
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // 타이머 텍스트 업데이트
        const timerElement = document.getElementById('session-timer');
        if (timerElement) {
            timerElement.textContent = `세션: ${timeString}`;
        }
        
        // 프로그레스바 업데이트
        const progressElement = document.getElementById('session-progress-bar');
        if (progressElement) {
            const progress = (remaining / this.sessionTimeout) * 100;
            progressElement.style.width = `${progress}%`;
            
            // 경고 상태에 따른 색상 변경
            progressElement.className = 'session-progress-fill';
            timerElement.className = 'session-timer';
            
            if (remaining <= this.warningTime) {
                progressElement.classList.add('warning');
                timerElement.classList.add('warning');
            }
            
            if (remaining <= 60000) { // 1분 이하
                progressElement.classList.add('danger');
                timerElement.classList.add('danger');
            }
        }
        
        // 경고 모달 표시
        if (remaining <= this.warningTime && remaining > this.warningTime - 1000) {
            this.showWarningModal();
        }
    }
    
    showWarningModal() {
        const modal = document.getElementById('session-warning-modal');
        const countdownElement = document.getElementById('countdown');
        
        if (modal && !modal.classList.contains('visible')) {
            modal.classList.remove('hidden');
            modal.classList.add('visible');
            
            // 카운트다운 시작
            let countdown = 600; // 10분
            this.countdownTimer = setInterval(() => {
                const minutes = Math.floor(countdown / 60);
                const seconds = countdown % 60;
                countdownElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                
                if (countdown <= 0) {
                    this.hideWarningModal();
                    this.showSessionExpired();
                }
                countdown--;
            }, 1000);
        }
    }
    
    hideWarningModal() {
        const modal = document.getElementById('session-warning-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('visible');
        }
        
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
    }
    
    showSessionExpired() {
        this.stopTimer();
        
        // 세션 만료 알림
        if (window.electronAPI) {
            window.electronAPI.resetSessionTimer();
        }
        
        // 모달 표시
        const modal = document.getElementById('session-warning-modal');
        const modalContent = modal.querySelector('.modal-content');
        const modalHeader = modal.querySelector('.modal-header h3');
        const modalBody = modal.querySelector('.modal-body p');
        const countdownElement = document.getElementById('countdown');
        const extendBtn = document.getElementById('extend-session-btn');
        
        modalHeader.textContent = '세션 만료';
        modalBody.textContent = '세션이 만료되었습니다. 고려대학교 포털로 다시 이동합니다.';
        countdownElement.textContent = '만료됨';
        extendBtn.textContent = '포털로 이동';
        
        modal.classList.remove('hidden');
        modal.classList.add('visible');
    }
    
    resetTimer() {
        this.startTime = Date.now();
        this.hideWarningModal();
        
        // 타이머 상태 초기화
        const timerElement = document.getElementById('session-timer');
        const progressElement = document.getElementById('session-progress-bar');
        
        if (timerElement) {
            timerElement.className = 'session-timer';
        }
        if (progressElement) {
            progressElement.className = 'session-progress-fill';
        }
        
        // Electron API를 통해 메인 프로세스 타이머도 재설정
        if (window.electronAPI) {
            window.electronAPI.resetSessionTimer();
        }
    }
    
    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
    }
    
    bindEvents() {
        // 새로고침 버튼
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                const webview = document.getElementById('portal-webview');
                if (webview) {
                    webview.reload();
                }
            });
        }
        
        // 홈으로 버튼
        const homeBtn = document.getElementById('home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                const webview = document.getElementById('portal-webview');
                if (webview) {
                    webview.loadURL('https://portal.korea.ac.kr/front/Main.kpd');
                }
            });
        }
        
        // 세션 연장 버튼
        const extendBtn = document.getElementById('extend-session-btn');
        if (extendBtn) {
            extendBtn.addEventListener('click', () => {
                this.resetTimer();
                this.hideWarningModal();
            });
        }
        
        // 모달 닫기 버튼
        const closeBtn = document.getElementById('close-modal-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideWarningModal();
            });
        }
        
        // 웹뷰 이벤트
        const webview = document.getElementById('portal-webview');
        if (webview) {
            webview.addEventListener('did-start-loading', () => {
                // 페이지 로딩 시작 시 타이머 재설정
                this.resetTimer();
            });
            
            webview.addEventListener('did-finish-load', () => {
                // 페이지 로딩 완료 시 타이머 재설정
                this.resetTimer();
            });
            
            webview.addEventListener('did-navigate', () => {
                // 네비게이션 시 타이머 재설정
                this.resetTimer();
            });
        }
        
        // 사용자 활동 감지
        document.addEventListener('mousedown', () => this.resetTimer());
        document.addEventListener('mousemove', () => this.resetTimer());
        document.addEventListener('keypress', () => this.resetTimer());
        document.addEventListener('scroll', () => this.resetTimer());
        document.addEventListener('touchstart', () => this.resetTimer());
        document.addEventListener('click', () => this.resetTimer());
        
        // 웹뷰 내부 활동도 감지
        const webviewElement = document.getElementById('portal-webview');
        if (webviewElement) {
            webviewElement.addEventListener('dom-ready', () => {
                webviewElement.addEventListener('mousedown', () => this.resetTimer());
                webviewElement.addEventListener('mousemove', () => this.resetTimer());
                webviewElement.addEventListener('keypress', () => this.resetTimer());
                webviewElement.addEventListener('scroll', () => this.resetTimer());
                webviewElement.addEventListener('click', () => this.resetTimer());
            });
        }
    }
}

// 자동 로그인 관리 클래스
class AutoLoginManager {
    constructor() {
        this.config = null;
        this.loginSuccess = false; // 로그인 성공 상태 추적
        this.init();
    }
    
    async init() {
        if (window.electronAPI) {
            this.config = await window.electronAPI.getLoginConfig();
            this.bindEvents();
            
            // 설정이 완전하지 않은 경우 로그인 설정 페이지로 이동
            if (!this.config || !this.config.username || !this.config.password) {
                setTimeout(() => {
                    if (window.electronAPI) {
                        window.electronAPI.openLoginSetup();
                    }
                }, 500);
            } else {
                // 자동 로그인이 설정되어 있으면 실행
                if (this.config.autoLogin && this.config.username && this.config.password) {
                    this.performAutoLogin();
                }
            }
        }
    }
    
    bindEvents() {
        // 로그인 설정 버튼
        const loginSettingsBtn = document.getElementById('login-settings-btn');
        if (loginSettingsBtn) {
            loginSettingsBtn.addEventListener('click', () => {
                console.log('로그인 설정 버튼 클릭됨');
                this.showLoginSettingsModal();
            });
        }
        
        // 업데이트 버튼
        const updateBtn = document.getElementById('update-btn');
        if (updateBtn) {
            updateBtn.addEventListener('click', () => {
                console.log('업데이트 버튼 클릭됨');
                this.checkForUpdates();
            });
        }
        
        // 로그인 설정 모달 관련 버튼들
        const saveBtn = document.getElementById('save-login-settings-btn');
        const clearBtn = document.getElementById('clear-login-settings-btn');
        const closeBtn = document.getElementById('close-login-settings-btn');
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveLoginSettings();
            });
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearLoginSettings();
            });
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideLoginSettingsModal();
            });
        }
    }
    
    async showLoginSettingsModal() {
        const modal = document.getElementById('login-settings-modal');
        if (modal) {
            modal.classList.remove('hidden');
            
            // 기존 설정값 로드
            if (this.config) {
                const usernameInput = document.getElementById('username');
                const passwordInput = document.getElementById('password');
                const autoLoginCheckbox = document.getElementById('auto-login');
                const rememberCredentialsCheckbox = document.getElementById('remember-credentials');
                const autoUpdateCheckbox = document.getElementById('auto-update');
                
                if (usernameInput) usernameInput.value = this.config.username || '';
                if (passwordInput) passwordInput.value = this.config.password || '';
                if (autoLoginCheckbox) autoLoginCheckbox.checked = this.config.autoLogin || false;
                if (rememberCredentialsCheckbox) rememberCredentialsCheckbox.checked = this.config.rememberCredentials || false;
                
                // 자동 업데이트 상태 로드
                if (autoUpdateCheckbox && window.electronAPI) {
                    try {
                        const autoUpdateStatus = await window.electronAPI.getAutoUpdateStatus();
                        autoUpdateCheckbox.checked = autoUpdateStatus;
                    } catch (error) {
                        console.error('자동 업데이트 상태 로드 오류:', error);
                        autoUpdateCheckbox.checked = false;
                    }
                }
            }
        }
    }
    
    hideLoginSettingsModal() {
        const modal = document.getElementById('login-settings-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
    
    async saveLoginSettings() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const autoLogin = document.getElementById('auto-login').checked;
        const rememberCredentials = document.getElementById('remember-credentials').checked;
        const autoUpdate = document.getElementById('auto-update').checked;
        
        if (!username || !password) {
            alert('아이디와 비밀번호를 모두 입력해주세요.');
            return;
        }
        
        const config = {
            username: username,
            password: password,
            autoLogin: autoLogin,
            rememberCredentials: rememberCredentials
        };
        
        try {
            if (window.electronAPI) {
                const success = await window.electronAPI.saveLoginConfig(config);
                if (success) {
                    this.config = config;
                    
                    // 자동 업데이트 설정 저장
                    if (autoUpdate) {
                        await window.electronAPI.enableAutoUpdate();
                    } else {
                        await window.electronAPI.disableAutoUpdate();
                    }
                    
                    alert('설정이 저장되었습니다.');
                    this.hideLoginSettingsModal();
                    
                    // 자동 로그인이 활성화되어 있으면 즉시 실행
                    if (autoLogin) {
                        this.performAutoLogin();
                    }
                } else {
                    alert('설정 저장에 실패했습니다.');
                }
            }
        } catch (error) {
            console.error('설정 저장 오류:', error);
            alert('설정 저장 중 오류가 발생했습니다.');
        }
    }
    
    async clearLoginSettings() {
        if (confirm('저장된 로그인 정보를 삭제하시겠습니까?')) {
            try {
                if (window.electronAPI) {
                    const success = await window.electronAPI.clearLoginConfig();
                    if (success) {
                        this.config = null;
                        this.loginSuccess = false;
                        alert('로그인 정보가 삭제되었습니다.');
                        this.hideLoginSettingsModal();
                    } else {
                        alert('로그인 정보 삭제에 실패했습니다.');
                    }
                }
            } catch (error) {
                console.error('로그인 정보 삭제 오류:', error);
                alert('로그인 정보 삭제 중 오류가 발생했습니다.');
            }
        }
    }
    
    async performAutoLogin() {
        // 이미 로그인 성공한 경우 중단 (단, Login.kpd 페이지에서는 리셋)
        if (this.loginSuccess) {
            // 현재 페이지가 로그인 페이지인지 확인
            const webview = document.getElementById('portal-webview');
            if (webview) {
                const currentURL = webview.getURL();
                if (currentURL.includes('Login.kpd')) {
                    console.log('로그인 페이지 감지, 상태 리셋 후 자동 로그인 시도');
                    this.loginSuccess = false; // 상태 리셋
                } else {
                    console.log('이미 로그인 성공 상태, 자동 로그인 중단');
                    return;
                }
            } else {
                console.log('이미 로그인 성공 상태, 자동 로그인 중단');
                return;
            }
        }
        
        if (!this.config || !this.config.username || !this.config.password) {
            return;
        }
        
        console.log('렌더러에서 자동 로그인 시도:', this.config.username);
        
        // 즉시 자동 로그인 실행
        setTimeout(async () => {
            // 다시 한번 성공 상태 확인
            if (this.loginSuccess) {
                console.log('로그인 성공 상태 확인됨, 자동 로그인 중단');
                return;
            }
            
            if (window.electronAPI) {
                const result = await window.electronAPI.triggerAutoLogin();
                
                if (result && result.success) {
                    console.log('자동 로그인 성공:', result.message);
                    this.loginSuccess = true; // 성공 상태 설정
                    return;
                } else {
                    console.error('자동 로그인 실패:', result ? result.message : '알 수 없는 오류');
                    // 실패 시 한번만 재시도 (성공하지 않은 경우에만)
                    if (!this.loginSuccess) {
                        setTimeout(() => {
                            this.performAutoLogin();
                        }, 2000); // 2초 후 재시도
                    }
                }
            }
        }, 1000);
    }
    
    // 업데이트 관리 메서드들
    async checkForUpdates() {
        if (window.electronAPI) {
            try {
                console.log('업데이트 확인 시작...');
                await window.electronAPI.checkForUpdates();
            } catch (error) {
                console.error('업데이트 확인 중 오류:', error);
            }
        }
    }
    
    showUpdateButton() {
        const updateBtn = document.getElementById('update-btn');
        if (updateBtn) {
            updateBtn.style.display = 'inline-block';
        }
    }
    
    hideUpdateButton() {
        const updateBtn = document.getElementById('update-btn');
        if (updateBtn) {
            updateBtn.style.display = 'none';
        }
    }
}

// 페이지 초기화
document.addEventListener('DOMContentLoaded', () => {
    // 세션 타이머 시작
    const sessionTimer = new SessionTimer();
    
    // 자동 로그인 매니저 시작
    const autoLoginManager = new AutoLoginManager();
    
    // AutoLoginManager 초기화 완료 후 로그인 설정 확인
    setTimeout(async () => {
        // 설정이 로드될 때까지 대기
        if (autoLoginManager.config) {
            console.log('설정 로드됨:', autoLoginManager.config);
            
            // 자동 로그인이 설정되어 있으면 실행
            if (autoLoginManager.config.autoLogin && autoLoginManager.config.username && autoLoginManager.config.password) {
                autoLoginManager.performAutoLogin();
            }
        }
    }, 1000); // 1초 대기
    
    // Electron API가 사용 가능한 경우
    if (window.electronAPI) {
        // 세션 정보 가져오기
        window.electronAPI.getSessionInfo().then(info => {
            if (info) {
                sessionTimer.sessionTimeout = info.timeout;
                sessionTimer.warningTime = info.warningTime;
            }
        });
        
        // 사용자 활동 시 타이머 재설정
        window.electronAPI.onUserActivity(() => {
            sessionTimer.resetTimer();
        });
    }
    
    // 웹뷰 설정
    const webview = document.getElementById('portal-webview');
    if (webview) {
        // 웹뷰 설정
        webview.setAttribute('webpreferences', 'contextIsolation=yes, nodeIntegration=no');
        
        // 로딩 인디케이터
        webview.addEventListener('did-start-loading', () => {
            console.log('웹뷰 로딩 시작');
            // 로딩 시작 시 처리
        });
        
        webview.addEventListener('did-finish-load', () => {
            // 로딩 완료 시 자동 로그인 시도 (로그인 성공하지 않은 경우에만)
            if (autoLoginManager.config && autoLoginManager.config.autoLogin && !autoLoginManager.loginSuccess) {
                autoLoginManager.performAutoLogin();
            }
        });
        
        webview.addEventListener('did-fail-load', (event) => {
            console.error('웹뷰 로딩 실패:', event);
        });
    }
});

// 페이지 종료 시 정리
window.addEventListener('beforeunload', () => {
    // 타이머 정리
    if (window.sessionTimer) {
        window.sessionTimer.stopTimer();
    }
});

