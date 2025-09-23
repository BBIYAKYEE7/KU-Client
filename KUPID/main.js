const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const notifier = require('node-notifier');
const configManager = require('./config');
const https = require('https');
const fs = require('fs');
const { exec } = require('child_process');
const AutoUpdater = require('./auto-updater');

let mainWindow;
let sessionTimer;
let warning10Timer;
let warning5Timer;
let sessionTimeout = 60 * 60 * 1000; // 60분 (밀리초)으로 연장
let warningTime = 10 * 60 * 1000; // 10분 전 경고로 연장
let globalLoginSuccess = false; // 전역 로그인 성공 상태
let autoUpdaterInstance = null; // 자동 업데이트 인스턴스
let autoUpdaterInitialized = false; // 자동 업데이트 초기화 상태
let warning10Shown = false; // 10분 전 알림 1회 제한
let warning5Shown = false;  // 5분 전 알림 1회 제한

// 로그인 설정 확인 및 페이지 로드 함수
async function checkLoginConfigAndLoadPage() {
  try {
    const config = configManager.loadConfig();
    try {
      const masked = { ...config };
      if (masked && typeof masked.password === 'string' && masked.password.length > 0) {
        masked.password = '***';
      }
      console.log('로드된 설정:', masked);
    } catch (_) {
      console.log('로드된 설정: <masked>');
    }
    
    // 로그인 설정이 완전한지 확인
    const hasValidConfig = config && 
                          config.username && 
                          config.username.trim() !== '' && 
                          config.password && 
                          config.password.trim() !== '' &&
                          config.autoLogin;
    
    if (hasValidConfig) {
      console.log('유효한 로그인 설정이 있습니다. 메인 페이지로 이동합니다.');
      mainWindow.loadFile('index.html');
    } else {
      console.log('로그인 설정이 없습니다. 로그인 설정 페이지로 이동합니다.');
      mainWindow.loadFile('login-setup.html');
    }
  } catch (error) {
    console.error('로그인 설정 확인 중 오류:', error);
    // 오류 발생 시 로그인 설정 페이지로 이동
    mainWindow.loadFile('login-setup.html');
  }
}



function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false, // 안정성을 위해 비활성화
      preload: path.resolve(__dirname, 'preload.js'),
      webviewTag: true,
      // V8 엔진 안정성을 위한 설정
      experimentalFeatures: false,
      enableWebSQL: false,
      // 추가 안정성 설정
      allowRunningInsecureContent: true,
      webgl: false,
      plugins: false
    },
    icon: path.join(__dirname, 'images', 'korea.png'),
    title: '고려대학교 포털',
    show: false,
    // 추가 안정성 설정
    webSecurity: false,
    allowRunningInsecureContent: true
  });

  // 로그인 설정 확인 후 적절한 페이지 로드
  console.log('로그인 설정 확인 중...');
  checkLoginConfigAndLoadPage();

  // 개발자 도구 (개발 모드에서만)
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // 윈도우가 준비되면 표시
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    startSessionTimer();
    
    // 자동 업데이트 시작 (앱이 완전히 로드된 후)
    setTimeout(() => {
      setupAutoUpdater();
    }, 3000); // 3초 후 업데이트 확인
  });

  // 페이지 로드 완료 시 세션 타이머 재시작
  mainWindow.webContents.on('did-finish-load', () => {
    resetSessionTimer();
  });

  // 네비게이션 시 세션 타이머 재시작
  mainWindow.webContents.on('did-navigate', () => {
    resetSessionTimer();
  });

  // 새 창 열림을 모두 현재 창으로 리다이렉트 (최신 API 사용)
  try {
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(url);
        }
      } catch (_) {}
      return { action: 'deny' };
    });
  } catch (_) {}

  // PDF/OZ 리포트는 항상 내부 PDF.js 뷰어로 강제 오픈
  try {
    const ses = mainWindow.webContents.session;
    const viewerPath = path.resolve(__dirname, 'pdf-viewer.html');
    const viewerUrlPrefix = String(pathToFileURL(viewerPath));
    const getViewerUrl = (originalUrl) => viewerUrlPrefix + '?file=' + encodeURIComponent(originalUrl);
    const looksLikePdfUrl = (url) => {
      if (!url) return false;
      try {
        const u = new URL(url);
        const pathname = u.pathname || '';
        if (/\.pdf$/i.test(pathname)) return true;
        if (/\.ozr$/i.test(pathname)) return true;
        if (/\/oz\d*\//i.test(pathname) || /\boz(server)?\b/i.test(url) || /\/oz80\/server/i.test(url)) return true;
        return false;
      } catch (_) {
        return /\.pdf(\?|#|$)/i.test(url) || /\.ozr(\?|#|$)/i.test(url) || /oz80\/server/i.test(url);
      }
    };

    ses.webRequest.onBeforeRequest((details, callback) => {
      try {
        const url = details.url;
        if (url && url.startsWith(viewerUrlPrefix)) return callback({});
        if ((details.resourceType === 'mainFrame' || details.resourceType === 'subFrame') && looksLikePdfUrl(url)) {
          const viewerUrl = getViewerUrl(url);
          if (details.resourceType === 'mainFrame') {
            try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(viewerUrl); } catch (_) {}
            return callback({ cancel: true });
          }
          // 서브프레임은 차단하지 않고 통과시킴 (일부 OZ 로더가 서브프레임을 사용)
          return callback({});
        }
      } catch (_) {}
      callback({});
    });

    // 응답 헤더로 PDF 응답을 탐지해 내부 뷰어로 전환 (HTML 뷰어 우회)
    ses.webRequest.onHeadersReceived((details, callback) => {
      try {
        if (details.resourceType === 'mainFrame') {
          const headers = details.responseHeaders || {};
          const get = (k) => headers[k] || headers[k.toLowerCase()];
          const ct = (get('Content-Type') || [''])[0];
          const cd = (get('Content-Disposition') || [''])[0];
          const isPdf = /application\/pdf/i.test(ct) || /\.pdf(\"|;|$)/i.test(cd || '');
          if (isPdf && !(details.url && details.url.startsWith(viewerUrlPrefix))) {
            const viewerUrl = getViewerUrl(details.url);
            try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(viewerUrl); } catch (_) {}
            return callback({ cancel: true });
          }
        }
      } catch (_) {}
      callback({ responseHeaders: details.responseHeaders });
    });
  } catch (e) {
    console.error('PDF 내부 뷰어 리디렉트 설정 오류:', e);
  }

  // 웹뷰 로드 완료 시 자동 로그인 시도 및 폰트 적용
  mainWindow.webContents.on('did-finish-load', () => {
    const currentURL = mainWindow.webContents.getURL();
    console.log('페이지 로드 완료:', currentURL);
    
    // index.html이 로드되면 웹뷰 이벤트를 설정
    if (currentURL.includes('index.html') || currentURL.endsWith('/')) {
      console.log('메인 페이지 로드됨, 웹뷰 이벤트 설정 중...');
      
      // 웹뷰 이벤트 리스너 설정
      setTimeout(() => {
        setupWebviewEventListeners();
      }, 1000);
    }
  });

  // 윈도우가 닫힐 때 타이머 정리
  mainWindow.on('closed', () => {
    if (sessionTimer) {
      clearTimeout(sessionTimer);
    }
  });
}

// GitHub API를 사용한 자동 업데이트 시스템
class GitHubUpdater {
  constructor() {
    this.owner = 'BBIYAKYEE7';
    this.repo = 'KUPID';
    this.currentVersion = app.getVersion();
    this.updateUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/releases/latest`;
  }

  // GitHub API 호출
  async fetchLatestRelease() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${this.owner}/${this.repo}/releases/latest`,
        method: 'GET',
        headers: {
          'User-Agent': 'KUPID-App',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const release = JSON.parse(data);
            resolve(release);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }

  // 버전 비교
  isNewerVersion(latestVersion) {
    const current = this.currentVersion.split('.').map(Number);
    const latest = latestVersion.split('.').map(Number);
    
    for (let i = 0; i < Math.max(current.length, latest.length); i++) {
      const currentPart = current[i] || 0;
      const latestPart = latest[i] || 0;
      
      if (latestPart > currentPart) return true;
      if (latestPart < currentPart) return false;
    }
    
    return false;
  }

  // 플랫폼별 다운로드 URL 찾기
  getDownloadUrl(release, platform) {
    const assets = release.assets || [];
    const platformPatterns = {
      'darwin': ['mac', 'dmg', 'zip'],
      'win32': ['win', 'exe', 'msi'],
      'linux': ['linux', 'AppImage', 'deb']
    };

    const patterns = platformPatterns[process.platform] || [];
    
    for (const asset of assets) {
      const assetName = asset.name.toLowerCase();
      if (patterns.some(pattern => assetName.includes(pattern))) {
        return asset.browser_download_url;
      }
    }
    
    return null;
  }

  // 업데이트 확인
  async checkForUpdates() {
    try {
      console.log('GitHub API를 통해 업데이트 확인 중...');
      const release = await this.fetchLatestRelease();
      
      if (!release || !release.tag_name) {
        console.log('릴리즈 정보를 찾을 수 없습니다.');
        return null;
      }

      const latestVersion = release.tag_name.replace('v', '');
      console.log(`최신 버전: ${latestVersion}, 현재 버전: ${this.currentVersion}`);

      if (this.isNewerVersion(latestVersion)) {
        console.log('새로운 버전이 발견되었습니다!');
        return {
          version: latestVersion,
          release: release,
          downloadUrl: this.getDownloadUrl(release, process.platform)
        };
      } else {
        console.log('이미 최신 버전입니다.');
        return null;
      }
    } catch (error) {
      console.error('업데이트 확인 중 오류:', error);
      return null;
    }
  }

  // 업데이트 다운로드
  async downloadUpdate(downloadUrl, progressCallback) {
    return new Promise((resolve, reject) => {
      const fileName = `KUPID-update-${Date.now()}.zip`;
      const filePath = path.join(app.getPath('temp'), fileName);
      
      const file = fs.createWriteStream(filePath);
      let downloadedBytes = 0;
      let totalBytes = 0;

      https.get(downloadUrl, (response) => {
        totalBytes = parseInt(response.headers['content-length'], 10);
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          const progress = (downloadedBytes / totalBytes) * 100;
          
          if (progressCallback) {
            progressCallback({
              percent: Math.round(progress),
              downloadedBytes,
              totalBytes
            });
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve(filePath);
        });

        file.on('error', (error) => {
          fs.unlink(filePath, () => {}); // 파일 삭제
          reject(error);
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  // 업데이트 설치
  async installUpdate(filePath) {
    return new Promise((resolve, reject) => {
      // macOS의 경우
      if (process.platform === 'darwin') {
        exec(`open "${filePath}"`, (error) => {
          if (error) {
            reject(error);
          } else {
            // 앱 종료
            setTimeout(() => {
              app.quit();
            }, 1000);
            resolve();
          }
        });
      }
      // Windows의 경우
      else if (process.platform === 'win32') {
        exec(`start "" "${filePath}"`, (error) => {
          if (error) {
            reject(error);
          } else {
            setTimeout(() => {
              app.quit();
            }, 1000);
            resolve();
          }
        });
      }
      // Linux의 경우
      else {
        exec(`xdg-open "${filePath}"`, (error) => {
          if (error) {
            reject(error);
          } else {
            setTimeout(() => {
              app.quit();
            }, 1000);
            resolve();
          }
        });
      }
    });
  }
}

// 자동 업데이트 설정
function setupAutoUpdater() {
  // 이미 초기화된 경우 중복 실행 방지
  if (autoUpdaterInitialized) {
    console.log('자동 업데이트가 이미 초기화되어 있습니다.');
    return;
  }
  
  try {
    autoUpdaterInstance = new AutoUpdater();
    
    // 자동 업데이트 확인 시작
    autoUpdaterInstance.startAutoUpdateCheck();
    
    // IPC 핸들러 등록 (한 번만 등록)
    ipcMain.handle('check-for-updates', async () => {
      return await autoUpdaterInstance.checkForUpdatesManually();
    });
    
    ipcMain.handle('enable-update-check', () => {
      autoUpdaterInstance.enableUpdateCheck();
    });
    
    ipcMain.handle('disable-update-check', () => {
      autoUpdaterInstance.disableUpdateCheck();
    });
    
    ipcMain.handle('enable-auto-update', () => {
      autoUpdaterInstance.enableAutoUpdate();
    });
    
    ipcMain.handle('disable-auto-update', () => {
      autoUpdaterInstance.disableAutoUpdate();
    });
    
    ipcMain.handle('get-auto-update-status', () => {
      return autoUpdaterInstance.isAutoUpdateEnabled();
    });
    
    autoUpdaterInitialized = true;
    console.log('자동 업데이트 시스템이 초기화되었습니다.');
  } catch (error) {
    console.error('자동 업데이트 초기화 중 오류:', error);
  }
}

function startSessionTimer() {
  resetSessionTimer();
}

function resetSessionTimer() {
  if (sessionTimer) {
    clearTimeout(sessionTimer);
  }
  if (warning10Timer) {
    clearTimeout(warning10Timer);
  }
  if (warning5Timer) {
    clearTimeout(warning5Timer);
  }

  // 알림 플래그 초기화
  warning10Shown = false;
  warning5Shown = false;

  // 경고 알림 (10분 전)
  warning10Timer = setTimeout(() => {
    showSessionWarning(10);
  }, sessionTimeout - (10 * 60 * 1000));

  // 경고 알림 (5분 전)
  warning5Timer = setTimeout(() => {
    showSessionWarning(5);
  }, sessionTimeout - (5 * 60 * 1000));

  // 세션 만료 알림
  sessionTimer = setTimeout(() => {
    showSessionExpired();
  }, sessionTimeout);
}

function showSessionWarning(minutes) {
  const m = Number(minutes) === 5 ? 5 : 10;
  if (m === 10 && warning10Shown) return;
  if (m === 5 && warning5Shown) return;

  // 데스크탑 알림
  if (Notification.isSupported()) {
    new Notification({
      title: '고려대학교 포털',
      body: `세션이 ${m}분 후 만료됩니다. 활동을 계속하시면 세션이 연장됩니다.`,
      icon: path.join(__dirname, 'images', 'korea.png')
    }).show();
  } else {
    notifier.notify({
      title: '고려대학교 포털',
      message: `세션이 ${m}분 후 만료됩니다. 활동을 계속하시면 세션이 연장됩니다.`,
      icon: path.join(__dirname, 'images', 'korea.png'),
      sound: true
    });
  }

  // 다이얼로그 표시 (필요 시 1회만)
  dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: '세션 만료 경고',
    message: `세션이 ${m}분 후 만료됩니다.`,
    detail: '활동을 계속하시면 세션이 자동으로 연장됩니다.',
    buttons: ['확인']
  });

  if (m === 10) warning10Shown = true;
  if (m === 5) warning5Shown = true;
}

function showSessionExpired() {
  // 데스크탑 알림
  if (Notification.isSupported()) {
    new Notification({
      title: '고려대학교 포털',
      body: '세션이 만료되었습니다. 다시 로그인해주세요.',
      icon: path.join(__dirname, 'images', 'korea.png')
    }).show();
  } else {
    notifier.notify({
      title: '고려대학교 포털',
      message: '세션이 만료되었습니다. 다시 로그인해주세요.',
      icon: path.join(__dirname, 'images', 'korea.png'),
      sound: true
    });
  }

  // 다이얼로그 표시
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '세션 만료',
    message: '세션이 만료되었습니다.',
    detail: '고려대학교 포털로 다시 이동합니다.',
    buttons: ['확인']
  }).then(() => {
    // 웹뷰에서 포털 메인 페이지로 이동
    mainWindow.webContents.executeJavaScript(`
      const webview = document.getElementById('portal-webview');
      if (webview) {
        webview.loadURL('https://portal.korea.ac.kr/front/Main.kpd');
      }
    `);
  });
}

// 웹뷰 이벤트 리스너 설정 함수
function setupWebviewEventListeners() {
  try {
    console.log('웹뷰 이벤트 리스너 설정 중...');
    
    // 웹뷰 요소에 이벤트 리스너 추가
    mainWindow.webContents.executeJavaScript(`
      (() => {
        try {
          const webview = document.getElementById('portal-webview');
          if (webview) {
            console.log('웹뷰 요소 발견, 이벤트 리스너 설정 중...');
            
            let loginAttempted = false; // 로그인 시도 여부 추적
            let loginSuccess = false; // 로그인 성공 여부 추적
            let pageLoadCount = 0; // 페이지 로드 횟수 추적
            
            // 웹뷰 로드 완료 이벤트
            webview.addEventListener('did-finish-load', () => {
              console.log('웹뷰 로드 완료됨');
              const webviewURL = webview.getURL();
              console.log('웹뷰 URL:', webviewURL);
              
              pageLoadCount++;
              console.log('페이지 로드 횟수:', pageLoadCount);
              
              // 새로고침 방지 (너무 많은 로드가 발생하면 중단)
              if (pageLoadCount > 10) {
                console.log('너무 많은 페이지 로드가 발생하여 자동 로그인 중단');
                return;
              }
              
              if (webviewURL.includes('portal.korea.ac.kr')) {
                console.log('고려대학교 포털 페이지 감지됨');
                
                // 웹뷰에 preload 스크립트 설정 (절대 경로로 설정)
                const preloadPath = path.resolve(__dirname, 'webview-preload.js');
                console.log('웹뷰 preload 경로:', preloadPath);
                webview.setAttribute('preload', preloadPath);
                
                // Pretendard 폰트 강제 적용 (통합된 강력한 방법)
                setTimeout(() => {
                  try {
                    webview.executeJavaScript(\`
                      (() => {
                        'use strict';
                        
                        try {
                          console.log('Pretendard 폰트 강제 적용 시작...');
                          
                          // Pretendard 폰트 강제 적용 클래스
                          class PretendardFontApplier {
                        constructor() {
                          this.isApplied = false;
                          this.intervalId = null;
                          this.observer = null;
                          this.forceStyleId = 'pretendard-force-style-v2';
                          this.init();
                        }
                        
                        init() {
                          console.log('Pretendard 폰트 강제 적용 초기화 시작');
                          
                          // 즉시 적용
                          this.applyFont();
                          
                          // DOM 로드 완료 시 적용
                          if (document.readyState === 'loading') {
                            document.addEventListener('DOMContentLoaded', () => this.applyFont());
                          }
                          
                          // Window 로드 완료 시 적용
                          window.addEventListener('load', () => this.applyFont());
                          
                          // MutationObserver 설정
                          this.setupMutationObserver();
                          
                          // 주기적 재적용 (2초마다)
                          this.startPeriodicApplication();
                          
                          // 30초 후 주기적 재적용 중단
                          setTimeout(() => {
                            this.stopPeriodicApplication();
                            console.log('Pretendard 폰트 주기적 적용 완료');
                          }, 30000);
                        }
                        
                        // 폰트 강제 적용 메인 함수
                        applyFont() {
                          try {
                            console.log('Pretendard 폰트 강제 적용 실행...');
                            
                            // 1. CSS 스타일 주입
                            this.injectCSS();
                            
                            // 2. 모든 요소에 직접 스타일 적용
                            this.applyToAllElements();
                            
                            // 3. 특정 클래스/ID 강제 적용
                            this.applyToSpecificElements();
                            
                            // 4. 인라인 스타일 무시 강제 적용
                            this.overrideInlineStyles();
                            
                            this.isApplied = true;
                            console.log('Pretendard 폰트 강제 적용 완료');
                          } catch (error) {
                            console.error('Pretendard 폰트 적용 오류:', error);
                          }
                        }
                        
                        // CSS 스타일 주입
                        injectCSS() {
                          // 기존 스타일 제거
                          const existingStyle = document.getElementById(this.forceStyleId);
                          if (existingStyle) {
                            existingStyle.remove();
                          }
                          
                          // 새로운 강제 스타일 생성
                          const style = document.createElement('style');
                          style.id = this.forceStyleId;
                          style.textContent = \`
                            /* Pretendard 폰트 정의 */
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
                            
                            /* 최고 우선순위로 모든 요소에 Pretendard 폰트 강제 적용 */
                            html, body, * {
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
                            
                            /* 모든 텍스트 요소 강제 적용 */
                            *, *::before, *::after {
                              font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
                            }
                            
                            /* 고려대학교 포털 특정 요소들 강제 적용 */
                            .header2, .main_menu, .menu3, .msub, .section, .portlet, .quickmenu, .footer01,
                            .wrapper, .main_left2, .main_right2, .portletList, .section_content,
                            .list li, .list li a, .title, .grp_title, .txt_right, .count,
                            .box, .box_content, .box_tab_content, .tbllist, .tbllist td,
                            .timetable, .ekuschedule, .results, .messages,
                            .top, .bottom, .utility2, .search, .main_contents2 {
                              font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
                            }
                            
                            /* 모달 및 팝업 강제 적용 */
                            .modal, .modal-content, .modal-header, .modal-body, .modal-footer,
                            .ui-dialog, .ui-dialog-content, .layerpop, .lp_inner {
                              font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
                            }
                            
                            /* 폼 요소들 강제 적용 */
                            input, textarea, select, button, label, form {
                              font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
                            }
                            
                            /* 테이블 요소들 강제 적용 */
                            table, th, td, tr, thead, tbody {
                              font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
                            }
                          \`;
                          
                          document.head.appendChild(style);
                        }
                        
                        // 모든 요소에 직접 스타일 적용
                        applyToAllElements() {
                          try {
                            const allElements = document.querySelectorAll('*');
                            allElements.forEach(element => {
                              if (element.style) {
                                element.style.setProperty('font-family', 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', 'important');
                              }
                            });
                          } catch (error) {
                            console.error('모든 요소 폰트 적용 오류:', error);
                          }
                        }
                        
                        // 특정 요소들에 강제 적용
                        applyToSpecificElements() {
                          const selectors = [
                            '.header2', '.main_menu', '.menu3', '.msub', '.section', '.portlet',
                            '.quickmenu', '.footer01', '.wrapper', '.main_left2', '.main_right2',
                            '.portletList', '.section_content', '.list li', '.list li a',
                            '.title', '.grp_title', '.txt_right', '.count', '.box',
                            '.box_content', '.box_tab_content', '.tbllist', '.tbllist td',
                            '.timetable', '.ekuschedule', '.results', '.messages',
                            '.top', '.bottom', '.utility2', '.search', '.main_contents2',
                            '.modal', '.modal-content', '.ui-dialog', '.ui-dialog-content',
                            'input', 'textarea', 'select', 'button', 'label', 'form',
                            'table', 'th', 'td', 'tr', 'thead', 'tbody'
                          ];
                          
                          selectors.forEach(selector => {
                            try {
                              const elements = document.querySelectorAll(selector);
                              elements.forEach(element => {
                                if (element.style) {
                                  element.style.setProperty('font-family', 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', 'important');
                                }
                              });
                            } catch (error) {
                              // 개별 선택자 오류 무시
                            }
                          });
                        }
                        
                        // 인라인 스타일 무시 강제 적용
                        overrideInlineStyles() {
                          try {
                            const elementsWithStyle = document.querySelectorAll('[style*="font-family"]');
                            elementsWithStyle.forEach(element => {
                              const style = element.getAttribute('style');
                              if (style && (style.includes('Batang') || style.includes('batang') || 
                                           style.includes('Gulim') || style.includes('gulim') ||
                                           !style.includes('Pretendard'))) {
                                element.style.setProperty('font-family', 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', 'important');
                              }
                            });
                          } catch (error) {
                            console.error('인라인 스타일 무시 적용 오류:', error);
                          }
                        }
                        
                        // MutationObserver 설정
                        setupMutationObserver() {
                          try {
                            this.observer = new MutationObserver((mutations) => {
                              let shouldReapply = false;
                              mutations.forEach((mutation) => {
                                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                                  shouldReapply = true;
                                } else if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                                  shouldReapply = true;
                                }
                              });
                              
                              if (shouldReapply) {
                                setTimeout(() => this.applyFont(), 100);
                              }
                            });
                            
                            this.observer.observe(document.body, {
                              childList: true,
                              subtree: true,
                              attributes: true,
                              attributeFilter: ['style']
                            });
                          } catch (error) {
                            console.error('MutationObserver 설정 오류:', error);
                          }
                        }
                        
                        // 주기적 재적용 시작
                        startPeriodicApplication() {
                          this.intervalId = setInterval(() => {
                            this.applyFont();
                          }, 2000);
                        }
                        
                        // 주기적 재적용 중단
                        stopPeriodicApplication() {
                          if (this.intervalId) {
                            clearInterval(this.intervalId);
                            this.intervalId = null;
                          }
                        }
                        
                        // 정리
                        destroy() {
                          this.stopPeriodicApplication();
                          if (this.observer) {
                            this.observer.disconnect();
                            this.observer = null;
                          }
                        }
                      }
                      
                      // 전역 변수로 저장
                      window.pretendardFontApplier = new PretendardFontApplier();
                      
                      // 페이지 언로드 시 정리
                      window.addEventListener('beforeunload', () => {
                        if (window.pretendardFontApplier) {
                          window.pretendardFontApplier.destroy();
                        }
                      });
                      
                      console.log('Pretendard 폰트 강제 적용 통합 스크립트 완료');
                        } catch (error) {
                          console.error('Pretendard 폰트 강제 적용 스크립트 오류:', error);
                        }
                      })();
                    \`);
                  } catch (error) {
                    console.error('웹뷰 JavaScript 실행 오류:', error);
                  }
                }, 3000); // 3초 후 실행
                
                // PDF 링크는 전역 onBeforeRequest에서 내부 뷰어로 리디렉트 처리됨
                
                // Login.kpd 페이지인지 확인
                if (webviewURL.includes('Login.kpd')) {
                  console.log('Login.kpd 페이지 감지됨, 로그인 폼 재감지');
                  loginAttempted = false; // 새로운 페이지이므로 로그인 시도 초기화
                  loginSuccess = false;
                  globalLoginSuccess = false; // 전역 상태 리셋 (로그아웃/세션 만료로 인한 재로그인 가능)
                  console.log('로그인 폼 재감지로 전역 상태 리셋, 자동 로그인 재시작');
                  
                  // 자동 로그인 시도 함수 (개선된 버전)
                  const attemptLogin = (attemptNumber) => {
                    if (loginSuccess) {
                      console.log(\`로그인 이미 성공, \${attemptNumber}번째 시도 중단\`);
                      return;
                    }
                    
                    console.log(\`\${attemptNumber}번째 자동 로그인 시도...\`);
                    window.electronAPI.triggerAutoLogin().then(result => {
                      if (result && result.success) {
                        loginSuccess = true;
                        globalLoginSuccess = true; // 전역 상태 업데이트
                        console.log(\`\${attemptNumber}번째 자동 로그인 성공, 추가 시도 중단\`);
                      } else {
                        console.log(\`\${attemptNumber}번째 자동 로그인 실패\`);
                      }
                    }).catch(error => {
                      console.error(\`\${attemptNumber}번째 자동 로그인 오류:\`, error);
                    });
                  };
                  
                  // 즉시 자동 로그인 시도
                  setTimeout(() => attemptLogin('첫 번째'), 500);
                  
                  // 3초 후 재시도
                  setTimeout(() => attemptLogin('두 번째'), 3000);
                  
                  // 8초 후 최종 시도
                  setTimeout(() => attemptLogin('세 번째'), 8000);
                } else if (webviewURL.includes('error') || webviewURL.includes('404')) {
                  // 에러 페이지 감지 시 메인 페이지로 리다이렉트
                  console.log('에러 페이지 감지됨, 메인 페이지로 리다이렉트');
                  webview.loadURL('https://portal.korea.ac.kr/front/Main.kpd');
~                } else if (webviewURL.includes('Main.kpd') || webviewURL.includes('main') || webviewURL.includes('front/Main.kpd')) {
                  // 메인 페이지로 이동한 경우 로그인 성공으로 간주
                  console.log('메인 페이지 감지됨, 로그인 성공으로 간주');
                  loginSuccess = true;
                  globalLoginSuccess = true; // 전역 상태 업데이트
                  loginAttempted = true;
                  
                  // 로그인 성공 후 더 이상 자동 로그인 시도하지 않음
                  console.log('로그인 성공으로 간주되어 자동 로그인 시도 중단');
                  
                  // 메인 페이지에서 새로고침 방지
                  webview.executeJavaScript(\`
                    // 페이지 새로고침 방지
                    window.addEventListener('beforeunload', (e) => {
                      e.preventDefault();
                      e.returnValue = '';
                    });
                    
                    // 자동 새로고침 방지
                    if (window.location.href.includes('Main.kpd')) {
                      console.log('메인 페이지에서 새로고침 방지 설정');
                      
                      // 메타 태그로 새로고침 방지
                      const meta = document.createElement('meta');
                      meta.httpEquiv = 'refresh';
                      meta.content = '0';
                      document.head.appendChild(meta);
                      
                      // 자동 새로고침 스크립트 비활성화
                      const scripts = document.querySelectorAll('script');
                      scripts.forEach(script => {
                        if (script.textContent.includes('reload') || script.textContent.includes('refresh')) {
                          script.remove();
                        }
                      });
                      
                      // 로그인 성공 상태를 부모 창에 알림
                      if (window.parent && window.parent.postMessage) {
                        window.parent.postMessage({ type: 'LOGIN_SUCCESS' }, '*');
                      }
                    }
                  \`);
                } else if (loginSuccess && !webviewURL.includes('Login.kpd')) {
                  // 이미 로그인 성공한 경우 추가 시도 중단 (단, Login.kpd 페이지에서는 제외)
                  console.log('이미 로그인 성공 상태, 추가 시도 중단');
                  return;
                } else if (!loginAttempted && !loginSuccess) {
                  // 다른 포털 페이지에서 로그인 시도
                  console.log('포털 페이지에서 자동 로그인 시도');
                  loginAttempted = true;
                  
                  setTimeout(() => {
                    if (!loginSuccess) {
                      window.electronAPI.triggerAutoLogin().then(result => {
                        if (result && result.success) {
                          loginSuccess = true;
                          globalLoginSuccess = true; // 전역 상태 업데이트
                          console.log('자동 로그인 성공, 추가 시도 중단');
                        }
                      });
                    }
                  }, 1000); // 2초에서 1초로 단축
                } else if (loginSuccess) {
                  // 이미 로그인 성공한 경우 추가 시도 방지
                  console.log('이미 로그인 성공 상태, 추가 시도 중단');
                  return;
                }
              }
            });
            
            // 웹뷰 로드 실패 이벤트
            webview.addEventListener('did-fail-load', (event) => {
              console.error('웹뷰 로딩 실패:', event);
            });
            
            console.log('웹뷰 이벤트 리스너 설정 완료');
          } else {
            console.log('웹뷰 요소를 찾을 수 없음');
          }
        } catch (error) {
          console.error('웹뷰 이벤트 리스너 설정 오류:', error);
        }
      })();
    `);
    
    console.log('웹뷰 이벤트 리스너 설정 완료');
  } catch (error) {
    console.error('웹뷰 이벤트 리스너 설정 실패:', error);
  }
}

// Pretendard 폰트 주입 함수
async function injectPretendardFont() {
  try {
    console.log('Pretendard 폰트 주입 중...');
    
    await mainWindow.webContents.executeJavaScript(`
      (() => {
        try {
          // 기존 폰트 스타일 제거
          const existingStyle = document.getElementById('pretendard-font-injection');
          if (existingStyle) {
            existingStyle.remove();
          }
          
          // Pretendard 폰트 CSS 주입
          const style = document.createElement('style');
          style.id = 'pretendard-font-injection';
          style.textContent = \`
            @font-face {
              font-family: 'Pretendard';
              src: local('Pretendard'), local('Pretendard-Regular');
              font-weight: 400;
              font-style: normal;
              font-display: swap;
            }
            
            @font-face {
              font-family: 'Pretendard';
              src: local('Pretendard-Bold'), local('Pretendard Bold');
              font-weight: 700;
              font-style: normal;
              font-display: swap;
            }
            
            * {
              font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            }
            
            body, html {
              font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            }
            
            input, textarea, select, button, a, span, div, p, h1, h2, h3, h4, h5, h6 {
              font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            }
            
            .login-box, .login-form, .login-input, .portal-content, .main-content {
              font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            }
            
            /* 모든 텍스트 요소에 강제 적용 */
            [class*="text"], [class*="label"], [class*="title"], [class*="header"] {
              font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            }
          \`;
          
          document.head.appendChild(style);
          
          // 폰트 강제 적용을 위한 추가 스크립트
          const forceFontScript = document.createElement('script');
          forceFontScript.textContent = \`
            // 모든 요소에 폰트 강제 적용
            function forcePretendardFont() {
              const allElements = document.querySelectorAll('*');
              allElements.forEach(el => {
                if (el.style) {
                  el.style.setProperty('font-family', 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', 'important');
                }
              });
            }
            
            // 즉시 실행
            forcePretendardFont();
            
            // DOM 변경 감지하여 새 요소에도 적용
            const observer = new MutationObserver(forcePretendardFont);
            observer.observe(document.body, { childList: true, subtree: true });
          \`;
          
          document.head.appendChild(forceFontScript);
          console.log('Pretendard 폰트 주입 완료');
        } catch (error) {
          console.error('폰트 주입 오류:', error);
        }
      })();
    `);
    
    console.log('Pretendard 폰트 주입 성공');
  } catch (error) {
    console.error('Pretendard 폰트 주입 실패:', error);
  }
}

// 자동 로그인 실행 함수
async function performAutoLogin(config) {
  try {
    console.log('자동 로그인 시도 중...', config.username);
    
    // 웹뷰에 스크립트 주입 후 실행
    const result = await mainWindow.webContents.executeJavaScript(`
      (async () => {
        try {
          console.log('웹뷰에서 자동 로그인 스크립트 실행 중...');
          console.log('현재 페이지 URL:', window.location.href);
          console.log('현재 페이지 제목:', document.title);
          
          // 페이지가 완전히 로드될 때까지 대기
          if (document.readyState !== 'complete') {
            console.log('페이지 로딩 대기 중...');
            await new Promise(resolve => {
              window.addEventListener('load', resolve, { once: true });
            });
          }
          
          // 잠시 대기
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // 모든 입력 필드 찾기
          const allInputs = document.querySelectorAll('input');
          console.log('모든 입력 필드:', allInputs.length);
          
          // 각 입력 필드 정보 출력
          allInputs.forEach((input, index) => {
            console.log(\`입력 필드 \${index + 1}:\`, {
              type: input.type,
              name: input.name,
              id: input.id,
              placeholder: input.placeholder,
              value: input.value
            });
          });
          
          // 로그인 폼 요소 찾기 (더 정확하게)
          let idInput = null;
          let pwInput = null;
          let loginForm = null;
          
          // ID 입력 필드 찾기 (고려대학교 포털 특화)
          idInput = document.getElementById('oneid') || 
                   document.querySelector('input[name="oneid"]') ||
                   document.querySelector('input[name="id"]') ||
                   document.querySelector('input[placeholder*="아이디"]') ||
                   document.querySelector('input[placeholder*="ID"]') ||
                   document.querySelector('input[type="text"]');
          
          // 비밀번호 입력 필드 찾기 (고려대학교 포털 특화)
          pwInput = document.getElementById('_pw') ||
                   document.querySelector('input[name="_pw"]') ||
                   document.querySelector('input[name="pw"]') ||
                   document.querySelector('input[name="password"]') ||
                   document.querySelector('input[name="userpw"]') ||
                   document.querySelector('input[placeholder*="비밀번호"]') ||
                   document.querySelector('input[placeholder*="Password"]') ||
                   document.querySelector('input[type="password"]');
          
          // 로그인 폼 찾기 (고려대학교 포털 특화)
          loginForm = document.getElementById('01a605fc169d3b967e451d202b93bb70cbca36ee8f3ba24c26d5e45523496bd5') ||
                     document.querySelector('form[action*="Login.kpd"]') ||
                     document.querySelector('form[action*="Login"]') ||
                     document.querySelector('form[action*="login"]') ||
                     document.querySelector('form[method="post"]') ||
                     document.querySelector('form');
          
          console.log('찾은 요소들:', {
            idInput: !!idInput,
            pwInput: !!pwInput,
            loginForm: !!loginForm
          });
          
          if (idInput && pwInput) {
            console.log('로그인 정보 입력 중...');
            
            // 기존 값 지우기
            idInput.value = '';
            pwInput.value = '';
            
            // 로그인 정보 입력
            idInput.value = '${config.username}';
            pwInput.value = '${config.password}';
            
            // 입력 이벤트 발생 (더 강력하게)
            idInput.dispatchEvent(new Event('input', { bubbles: true }));
            pwInput.dispatchEvent(new Event('input', { bubbles: true }));
            idInput.dispatchEvent(new Event('change', { bubbles: true }));
            pwInput.dispatchEvent(new Event('change', { bubbles: true }));
            idInput.dispatchEvent(new Event('blur', { bubbles: true }));
            pwInput.dispatchEvent(new Event('blur', { bubbles: true }));
            
            // 포커스 이벤트도 발생
            idInput.focus();
            pwInput.focus();
            
            console.log('로그인 정보 입력 완료');
            
            // 잠시 대기 후 로그인 시도
            setTimeout(() => {
              // 로그인 버튼 찾기 (고려대학교 포털 특화)
              const loginBtn = document.querySelector('input[type="submit"]') || 
                              document.querySelector('button[type="submit"]') ||
                              document.querySelector('input[value="로그인"]') ||
                              document.querySelector('input[value="LOGIN"]') ||
                              document.querySelector('input[value="Login"]') ||
                              document.querySelector('.login-btn') ||
                              document.querySelector('#loginBtn') ||
                              document.querySelector('input[onclick*="login"]') ||
                              document.querySelector('button[onclick*="login"]') ||
                              document.querySelector('input[onclick*="Login"]') ||
                              document.querySelector('button[onclick*="Login"]');
              
              if (loginBtn) {
                console.log('로그인 버튼 클릭 시도...');
                loginBtn.click();
              } else if (loginForm && loginForm.submit) {
                console.log('폼 제출 시도...');
                loginForm.submit();
              } else {
                console.log('Enter 키 시뮬레이션...');
                pwInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                pwInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                pwInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
              }
            }, 1500);
            
            return { success: true, message: '자동 로그인 시도 완료' };
          } else {
            return { 
              success: false, 
              message: '로그인 필드를 찾을 수 없습니다. idInput: ' + !!idInput + ', pwInput: ' + !!pwInput 
            };
          }
        } catch (error) {
          console.error('자동 로그인 스크립트 오류:', error);
          return { success: false, message: error.message };
        }
      })();
    `);
    
    if (result.success) {
      console.log('자동 로그인 성공:', result.message);
    } else {
      console.error('자동 로그인 실패:', result.message);
    }
    
    return result;
  } catch (error) {
    console.error('자동 로그인 오류:', error);
    return { success: false, message: error.message };
  }
}

// IPC 핸들러
ipcMain.handle('reset-session-timer', () => {
  resetSessionTimer();
});



ipcMain.handle('get-session-info', () => {
  return {
    timeout: sessionTimeout,
    warningTime: warningTime
  };
});

// PDF 뷰어 지원: 요청 URL의 쿠키 헤더 생성
ipcMain.handle('get-cookie-header', async (event, targetUrl) => {
  try {
    if (!targetUrl) return '';
    const ses = mainWindow.webContents.session;
    const cookies = await ses.cookies.get({ url: targetUrl });
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    return cookieHeader;
  } catch (e) {
    console.error('쿠키 헤더 생성 오류:', e);
    return '';
  }
});

// PDF 바이너리를 base64로 가져오기 (세션 쿠키 포함)
ipcMain.handle('fetch-pdf-base64', async (event, targetUrl) => {
  return await new Promise(async (resolve) => {
    try {
      if (!targetUrl) return resolve({ ok: false, error: 'empty url' });
      const ses = mainWindow.webContents.session;
      const cookies = await ses.cookies.get({ url: targetUrl });
      const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const u = new URL(targetUrl);
      const options = {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + (u.search || ''),
        method: 'GET',
        headers: {
          'Cookie': cookieHeader,
          'User-Agent': 'KUPID-Electron',
          'Accept': 'application/pdf,*/*;q=0.8'
        }
      };

      const getter = u.protocol === 'https:' ? https : require('http');
      const req = getter.request(options, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // 간단한 302 처리
          ipcMain.emit('noop');
          event.sender.send('noop');
        }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          try {
            const buf = Buffer.concat(chunks);
            const b64 = buf.toString('base64');
            resolve({ ok: true, base64: b64 });
          } catch (e2) {
            resolve({ ok: false, error: e2.message });
          }
        });
      });
      req.on('error', (e) => resolve({ ok: false, error: e.message }));
      req.end();
    } catch (e) {
      resolve({ ok: false, error: e.message });
    }
  });
});

// 뒤로가기/홈 이동
ipcMain.handle('viewer-go-back', () => {
  try {
    if (mainWindow && mainWindow.webContents.canGoBack()) {
      mainWindow.webContents.goBack();
      return true;
    }
  } catch (_) {}
  return false;
});

ipcMain.handle('viewer-go-home', () => {
  try {
    mainWindow.loadFile('index.html');
    return true;
  } catch (e) {
    console.error('홈 이동 오류:', e);
    return false;
  }
});

// 자동 로그인 관련 IPC 핸들러
ipcMain.handle('get-login-config', () => {
  return configManager.loadConfig();
});

ipcMain.handle('save-login-config', (event, config) => {
  return configManager.saveConfig(config);
});

ipcMain.handle('clear-login-config', () => {
  return configManager.clearConfig();
});

ipcMain.handle('trigger-auto-login', async () => {
  try {
    // 현재 웹뷰 URL 확인
    const currentURL = await mainWindow.webContents.executeJavaScript(`
      (() => {
        const webview = document.getElementById('portal-webview');
        if (webview) {
          return webview.getURL();
        }
        return '';
      })();
    `);
    
    // Login.kpd 페이지인 경우 전역 상태 리셋
    if (currentURL.includes('Login.kpd')) {
      console.log('로그인 폼 감지됨, 전역 상태 리셋');
      globalLoginSuccess = false;
    }
    
    // 전역 로그인 성공 상태 확인 (Login.kpd 페이지 제외)
    if (globalLoginSuccess && !currentURL.includes('Login.kpd')) {
      console.log('전역 로그인 성공 상태 확인됨, 자동 로그인 중단');
      return { success: true, message: '이미 로그인된 상태' };
    }
  
    const config = configManager.loadConfig();
    try {
      const masked = { ...config };
      if (masked && typeof masked.password === 'string' && masked.password.length > 0) {
        masked.password = '***';
      }
      console.log('자동 로그인 트리거됨, 설정:', masked);
    } catch (_) {
      console.log('자동 로그인 트리거됨, 설정: <masked>');
    }
    
    // 설정이 없거나 불완전한 경우
    if (!config || !config.username || !config.password) {
      console.log('로그인 설정이 없거나 불완전함');
      return { success: false, message: '로그인 설정이 없습니다' };
    }
    
    console.log('자동 로그인 시도 중...');
    
    // 이미 메인 페이지에 있다면 로그인 성공으로 간주
    if (currentURL.includes('Main.kpd') || currentURL.includes('front/Main.kpd')) {
      console.log('이미 메인 페이지에 있음, 로그인 성공으로 간주');
      globalLoginSuccess = true; // 전역 상태 업데이트
      return { success: true, message: '이미 로그인된 상태' };
    }
    
    // 웹뷰에서 자동 로그인 실행
    const result = await mainWindow.webContents.executeJavaScript(`
        (async () => {
          try {
            const webview = document.getElementById('portal-webview');
            if (webview) {
              console.log('웹뷰 요소 발견, 자동 로그인 스크립트 실행 중...');
              
              // 웹뷰 내부에서 자동 로그인 실행
              try {
                const result = await webview.executeJavaScript(\`
                  (async () => {
                    try {
                      console.log('웹뷰에서 자동 로그인 스크립트 실행 중...');
                      console.log('현재 페이지 URL:', window.location.href);
                      console.log('현재 페이지 제목:', document.title);
                      
                      // 페이지가 완전히 로드될 때까지 대기
                      if (document.readyState !== 'complete') {
                        console.log('페이지 로딩 대기 중...');
                        await new Promise(resolve => {
                          window.addEventListener('load', resolve, { once: true });
                        });
                      }
                      
                      // 잠시 대기 (시간 단축)
                      await new Promise(resolve => setTimeout(resolve, 200));
                      
                      // 모든 입력 필드 찾기
                      const allInputs = document.querySelectorAll('input');
                      console.log('모든 입력 필드:', allInputs.length);
                      
                      // 각 입력 필드 정보 출력
                      allInputs.forEach((input, index) => {
                        console.log('입력 필드 ' + (index + 1) + ':', {
                          type: input.type,
                          name: input.name,
                          id: input.id,
                          placeholder: input.placeholder,
                          value: input.value
                        });
                      });
                      
                      // 로그인 폼 요소 찾기 (더 정확하게)
                      let idInput = null;
                      let pwInput = null;
                      let loginForm = null;
                      
                      // ID 입력 필드 찾기 (고려대학교 포털 특화)
                      idInput = document.getElementById('oneid') || 
                               document.querySelector('input[name="oneid"]') ||
                               document.querySelector('input[name="id"]') ||
                               document.querySelector('input[placeholder*="아이디"]') ||
                               document.querySelector('input[placeholder*="ID"]') ||
                               document.querySelector('input[type="text"]');
                      
                      // 비밀번호 입력 필드 찾기 (고려대학교 포털 특화)
                      pwInput = document.getElementById('_pw') ||
                               document.querySelector('input[name="_pw"]') ||
                               document.querySelector('input[name="pw"]') ||
                               document.querySelector('input[name="password"]') ||
                               document.querySelector('input[placeholder*="비밀번호"]') ||
                               document.querySelector('input[placeholder*="Password"]') ||
                               document.querySelector('input[type="password"]');
                      
                      // 로그인 폼 찾기 (고려대학교 포털 특화)
                      loginForm = document.getElementById('01a605fc169d3b967e451d202b93bb70cbca36ee8f3ba24c26d5e45523496bd5') ||
                                 document.querySelector('form[action*="Login.kpd"]') ||
                                 document.querySelector('form[action*="Login"]') ||
                                 document.querySelector('form[action*="login"]') ||
                                 document.querySelector('form');
                      
                      console.log('찾은 요소들:', {
                        idInput: !!idInput,
                        pwInput: !!pwInput,
                        loginForm: !!loginForm
                      });
                      
                      if (idInput && pwInput) {
                        console.log('로그인 정보 입력 중...');
                        
                        // 기존 값 지우기
                        idInput.value = '';
                        pwInput.value = '';
                        
                        // 로그인 정보 입력
                        idInput.value = '${config.username}';
                        pwInput.value = '${config.password}';
                        
                        // 입력 이벤트 발생 (더 강력하게)
                        idInput.dispatchEvent(new Event('input', { bubbles: true }));
                        pwInput.dispatchEvent(new Event('input', { bubbles: true }));
                        idInput.dispatchEvent(new Event('change', { bubbles: true }));
                        pwInput.dispatchEvent(new Event('change', { bubbles: true }));
                        idInput.dispatchEvent(new Event('blur', { bubbles: true }));
                        pwInput.dispatchEvent(new Event('blur', { bubbles: true }));
                        
                        // 포커스 이벤트도 발생
                        idInput.focus();
                        pwInput.focus();
                        
                        console.log('로그인 정보 입력 완료');
                        
                        // 잠시 대기 후 로그인 시도 (시간 단축)
                        setTimeout(() => {
                          // 로그인 버튼 찾기 (고려대학교 포털 특화)
                          const loginBtn = document.querySelector('input[type="submit"]') || 
                                          document.querySelector('button[type="submit"]') ||
                                          document.querySelector('input[value="로그인"]') ||
                                          document.querySelector('input[value="LOGIN"]') ||
                                          document.querySelector('.login-btn') ||
                                          document.querySelector('#loginBtn') ||
                                          document.querySelector('input[onclick*="login"]') ||
                                          document.querySelector('button[onclick*="login"]');
                          
                          if (loginBtn) {
                            console.log('로그인 버튼 클릭 시도...');
                            loginBtn.click();
                          } else if (loginForm && loginForm.submit) {
                            console.log('폼 제출 시도...');
                            loginForm.submit();
                          } else {
                            console.log('Enter 키 시뮬레이션...');
                            pwInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                            pwInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                            pwInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                          }
                        }, 500); // 1.5초에서 0.5초로 단축
                        
                        return { success: true, message: '자동 로그인 시도 완료' };
                      } else {
                        return { 
                          success: false, 
                          message: '로그인 필드를 찾을 수 없습니다. idInput: ' + !!idInput + ', pwInput: ' + !!pwInput 
                        };
                      }
                    } catch (error) {
                      console.error('자동 로그인 스크립트 오류:', error);
                      return { success: false, message: error.message };
                    }
                  })();
                \`);
                
                if (result && result.success) {
                  console.log('자동 로그인 성공:', result.message);
                } else {
                  console.error('자동 로그인 실패:', result ? result.message : '알 수 없는 오류');
                }
                
                return result;
              } catch (webviewError) {
                console.error('웹뷰 스크립트 실행 오류:', webviewError);
                return { success: false, message: webviewError.message };
              }
            } else {
              console.log('웹뷰 요소를 찾을 수 없음');
              return { success: false, message: '웹뷰를 찾을 수 없습니다' };
            }
          } catch (error) {
            console.error('자동 로그인 트리거 오류:', error);
            return { success: false, message: error.message };
          }
        })();
      `);
      
      return result;
  } catch (error) {
    console.error('자동 로그인 트리거 오류:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('perform-auto-login', async (event, credentials) => {
  try {
    // 웹뷰에서 자동 로그인 실행
    const result = await mainWindow.webContents.executeJavaScript(`
      (async () => {
        try {
          // 로그인 폼 요소 찾기
          const idInput = document.getElementById('oneid');
          const pwInput = document.getElementById('_pw');
          const loginForm = document.getElementById('01a605fc169d3b967e451d202b93bb70cbca36ee8f3ba24c26d5e45523496bd5');
          
          if (idInput && pwInput && loginForm) {
            // 로그인 정보 입력
            idInput.value = '${credentials.username}';
            pwInput.value = '${credentials.password}';
            
            // 폼 제출
            loginForm.submit();
            return { success: true, message: '로그인 시도 완료' };
          } else {
            return { success: false, message: '로그인 폼을 찾을 수 없습니다' };
          }
        } catch (error) {
          return { success: false, message: error.message };
        }
      })();
    `);
    
    return result;
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// 포털 시작 핸들러
ipcMain.handle('start-portal', () => {
  try {
    // 메인 포털 페이지로 이동
    mainWindow.loadFile('index.html');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// 로그인 설정 페이지 핸들러
ipcMain.handle('open-login-setup', () => {
  try {
    mainWindow.loadFile('login-setup.html');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// V8 엔진 안정성을 위한 옵션 설정
app.commandLine.appendSwitch('--js-flags', '--max-old-space-size=2048 --no-opt --no-lazy');
app.commandLine.appendSwitch('--disable-background-timer-throttling');
app.commandLine.appendSwitch('--disable-renderer-backgrounding');
app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('--disable-gpu-sandbox');
app.commandLine.appendSwitch('--disable-software-rasterizer');
app.commandLine.appendSwitch('--disable-dev-shm-usage');
app.commandLine.appendSwitch('--no-sandbox');
app.commandLine.appendSwitch('--disable-web-security');
app.commandLine.appendSwitch('--disable-features', 'TranslateUI');
app.commandLine.appendSwitch('--disable-ipc-flooding-protection');

// 오류 메시지 억제
process.on('unhandledRejection', (reason, promise) => {
  // 무시
});

process.on('uncaughtException', (error) => {
  // 무시
});

// 콘솔 로그 억제
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.log = (...args) => {
  // 중요한 로그만 허용
  if (args[0] && typeof args[0] === 'string' && 
      (args[0].includes('로그인') || args[0].includes('업데이트'))) {
    originalConsoleLog(...args);
  }
};

console.warn = (...args) => {
  // 경고 메시지 억제
};

console.error = (...args) => {
  // 오류 메시지 억제
};

// 앱 이벤트
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 보안 설정
app.on('web-contents-created', (event, contents) => {
  try {
    contents.setWindowOpenHandler(({ url }) => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(url);
        }
      } catch (_) {}
      return { action: 'deny' };
    });
  } catch (_) {}
});
