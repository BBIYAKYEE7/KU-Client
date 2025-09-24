const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const fs = require('fs');
const https = require('https');
const { autoUpdater } = require('electron-updater');

// 설정 저장소 초기화
const store = new Store();

let mainWindow;
let updateWindow;

// 최초 실행 여부 확인
function isFirstRun() {
  return !store.get('hasRunBefore', false);
}

// 최초 실행 완료 표시
function markFirstRunComplete() {
  store.set('hasRunBefore', true);
}

// 로그인 설정 확인 및 페이지 로드 함수
async function checkLoginConfigAndLoadPage() {
  try {
    const credentials = store.get('credentials', {});
    
    // 로그인 설정이 완전한지 확인
    const hasValidConfig = credentials && 
                          credentials.username && 
                          credentials.username.trim() !== '' && 
                          credentials.password && 
                          credentials.password.trim() !== '' &&
                          credentials.remember;
    
    if (hasValidConfig) {
      console.log('유효한 로그인 설정이 있습니다. LMS 메인 페이지로 이동합니다.');
      // LMS 메인 페이지로 이동
      mainWindow.loadURL('https://mylms.korea.ac.kr/');
      
      // 웹뷰 로드 완료 시 자동 로그인 시도
      mainWindow.webContents.once('did-finish-load', () => {
        setTimeout(() => {
          performLMSAutoLogin(credentials);
        }, 2000);
      });
    } else {
      console.log('로그인 설정이 없습니다. 로그인 설정 페이지로 이동합니다.');
      mainWindow.loadFile('login.html');
    }
  } catch (error) {
    console.error('로그인 설정 확인 중 오류:', error);
    // 오류 발생 시 로그인 설정 페이지로 이동
    mainWindow.loadFile('login.html');
  }
}

// LMS 자동 로그인 실행 함수
async function performLMSAutoLogin(credentials) {
  try {
    console.log('LMS 자동 로그인 시도 중...', credentials.username);
    
    // 웹뷰에 스크립트 주입 후 실행
    const result = await mainWindow.webContents.executeJavaScript(`
      (async () => {
        try {
          console.log('LMS 자동 로그인 스크립트 실행 중...');
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
          
          // 로그인 폼 요소 찾기 (LMS 특화)
          let idInput = null;
          let pwInput = null;
          let loginForm = null;
          
          // ID 입력 필드 찾기 (LMS 특화)
          idInput = document.getElementById('one_id') || 
                   document.querySelector('input[name="one_id"]') ||
                   document.querySelector('input[name="user_id"]') ||
                   document.querySelector('input[placeholder*="KUPID"]') ||
                   document.querySelector('input[placeholder*="Single ID"]') ||
                   document.querySelector('input[type="text"]');
          
          // 비밀번호 입력 필드 찾기 (LMS 특화)
          pwInput = document.getElementById('password') ||
                   document.querySelector('input[name="user_password"]') ||
                   document.querySelector('input[name="password"]') ||
                   document.querySelector('input[placeholder*="Password"]') ||
                   document.querySelector('input[type="password"]');
          
          // 로그인 폼 찾기 (LMS 특화)
          loginForm = document.getElementById('loginFrm') ||
                     document.querySelector('form[name="loginFrm"]') ||
                     document.querySelector('form[action*="Login.do"]') ||
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
            idInput.value = '${credentials.username}';
            pwInput.value = '${credentials.password}';
            
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
              // 로그인 버튼 찾기 (LMS 특화)
              const loginBtn = document.querySelector('button[type="button"].userTypeCheck') ||
                              document.querySelector('button[onclick*="userTypeCheck"]') ||
                              document.querySelector('input[type="submit"]') || 
                              document.querySelector('button[type="submit"]') ||
                              document.querySelector('input[value="Login"]') ||
                              document.querySelector('input[value="로그인"]') ||
                              document.querySelector('.ibtn') ||
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
            }, 1500);
            
            return { success: true, message: 'LMS 자동 로그인 시도 완료' };
          } else {
            return { 
              success: false, 
              message: 'LMS 로그인 필드를 찾을 수 없습니다. idInput: ' + !!idInput + ', pwInput: ' + !!pwInput 
            };
          }
        } catch (error) {
          console.error('LMS 자동 로그인 스크립트 오류:', error);
          return { success: false, message: error.message };
        }
      })();
    `);
    
    if (result.success) {
      console.log('LMS 자동 로그인 성공:', result.message);
    } else {
      console.error('LMS 자동 로그인 실패:', result.message);
    }
    
    return result;
  } catch (error) {
    console.error('LMS 자동 로그인 오류:', error);
    return { success: false, message: error.message };
  }
}

// images 디렉토리 생성
function ensureImagesDirectory() {
  const imagesDir = path.join(__dirname, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
}

function createWindow() {
  // images 디렉토리 생성
  ensureImagesDirectory();
  
  // 메인 윈도우 생성
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      // Chromium 엔진 강제 사용
      experimentalFeatures: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      // User Agent를 Chromium으로 설정
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    icon: path.join(__dirname, 'images/icon.png'), // images 디렉토리에서 아이콘 로드
    title: '고려대학교 LMS',
    show: false
  });

  // 로그인 설정 확인 후 적절한 페이지 로드
  checkLoginConfigAndLoadPage();
  if (isFirstRun()) {
    markFirstRunComplete();
  }

  // 윈도우가 준비되면 표시
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // 업데이트 확인 (앱 시작 후 3초 뒤)
    setTimeout(() => {
      checkForUpdates();
    }, 3000);
  });

  // 개발자 도구 (디버깅용)
  mainWindow.webContents.openDevTools();

  // 윈도우가 닫힐 때
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}


// GitHub 릴리즈 API를 통한 업데이트 확인
function checkForUpdates() {
  const options = {
    hostname: 'api.github.com',
    path: '/repos/BBIYAKYEE7/Korea-University-LMS/releases/latest',
    method: 'GET',
    headers: {
      'User-Agent': 'Korea-University-LMS-Desktop'
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
        
        // 릴리즈 데이터 유효성 검사
        if (!release || !release.tag_name) {
          console.log('유효하지 않은 릴리즈 데이터:', release);
          return;
        }
        
        const currentVersion = app.getVersion();
        const latestVersion = release.tag_name.replace(/^v/, ''); // 'v' 제거 (정규식 사용)
        
        console.log('현재 버전:', currentVersion);
        console.log('최신 버전:', latestVersion);
        
        if (compareVersions(latestVersion, currentVersion) > 0) {
          showUpdateDialog(release);
        } else {
          console.log('이미 최신 버전입니다.');
        }
      } catch (error) {
        console.error('업데이트 확인 중 오류:', error);
        console.error('응답 데이터:', data);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('업데이트 확인 요청 실패:', error);
  });
  
  req.end();
}

// 버전 비교 함수
function compareVersions(version1, version2) {
  const v1parts = version1.split('.').map(Number);
  const v2parts = version2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
    const v1part = v1parts[i] || 0;
    const v2part = v2parts[i] || 0;
    
    if (v1part > v2part) return 1;
    if (v1part < v2part) return -1;
  }
  
  return 0;
}

// 업데이트 다이얼로그 표시
function showUpdateDialog(release) {
  const updateWindow = new BrowserWindow({
    width: 500,
    height: 400,
    resizable: false,
    modal: true,
    parent: mainWindow,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: '업데이트 알림'
  });

  const updateHtml = `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>업데이트 알림</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                margin: 0;
                padding: 20px;
                background: #f5f5f5;
            }
            .update-container {
                background: white;
                border-radius: 10px;
                padding: 30px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .update-icon {
                font-size: 48px;
                text-align: center;
                margin-bottom: 20px;
            }
            h1 {
                text-align: center;
                color: #333;
                margin-bottom: 10px;
            }
            .version-info {
                text-align: center;
                color: #666;
                margin-bottom: 20px;
            }
            .release-notes {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
                margin-bottom: 20px;
                max-height: 150px;
                overflow-y: auto;
            }
            .platform-selection {
                margin-bottom: 20px;
            }
            .platform-option {
                display: flex;
                align-items: center;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 5px;
                margin-bottom: 10px;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            .platform-option:hover {
                background-color: #f0f0f0;
            }
            .platform-option input[type="radio"] {
                margin-right: 10px;
            }
            .platform-option.selected {
                background-color: #e3f2fd;
                border-color: #2196f3;
            }
            .buttons {
                display: flex;
                gap: 10px;
                justify-content: center;
            }
            button {
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
            }
            .btn-primary {
                background-color: #2196f3;
                color: white;
            }
            .btn-secondary {
                background-color: #6c757d;
                color: white;
            }
            button:hover {
                opacity: 0.9;
            }
        </style>
    </head>
    <body>
        <div class="update-container">
            <div class="update-icon">🔄</div>
            <h1>새 버전이 있습니다!</h1>
            <div class="version-info">
                현재 버전: ${app.getVersion()}<br>
                최신 버전: ${release.tag_name}
            </div>
            
            <div class="release-notes">
                <strong>업데이트 내용:</strong><br>
                ${release.body ? release.body.replace(/\n/g, '<br>') : '업데이트 내용이 없습니다.'}
            </div>
            
            <div class="platform-selection">
                <strong>다운로드할 플랫폼을 선택하세요:</strong>
                <div class="platform-option" onclick="selectPlatform(this, 'mac-x64')">
                    <input type="radio" name="platform" value="mac-x64" id="mac-x64">
                    <label for="mac-x64">macOS (Intel)</label>
                </div>
                <div class="platform-option" onclick="selectPlatform(this, 'mac-arm64')">
                    <input type="radio" name="platform" value="mac-arm64" id="mac-arm64">
                    <label for="mac-arm64">macOS (Apple Silicon)</label>
                </div>
                <div class="platform-option" onclick="selectPlatform(this, 'win-x64')">
                    <input type="radio" name="platform" value="win-x64" id="win-x64">
                    <label for="win-x64">Windows (64-bit)</label>
                </div>
                <div class="platform-option" onclick="selectPlatform(this, 'win-ia32')">
                    <input type="radio" name="platform" value="win-ia32" id="win-ia32">
                    <label for="win-ia32">Windows (32-bit)</label>
                </div>
                <div class="platform-option" onclick="selectPlatform(this, 'linux-x64')">
                    <input type="radio" name="platform" value="linux-x64" id="linux-x64">
                    <label for="linux-x64">Linux (64-bit)</label>
                </div>
            </div>
            
            <div class="buttons">
                <button class="btn-primary" onclick="downloadUpdate()">다운로드</button>
                <button class="btn-secondary" onclick="closeUpdate()">나중에</button>
            </div>
        </div>
        
        <script>
            let selectedPlatform = '';
            
            function selectPlatform(element, platform) {
                // 모든 옵션에서 selected 클래스 제거
                document.querySelectorAll('.platform-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                
                // 선택된 옵션에 selected 클래스 추가
                element.classList.add('selected');
                selectedPlatform = platform;
                
                // 라디오 버튼 체크
                document.getElementById(platform).checked = true;
            }
            
            function downloadUpdate() {
                if (!selectedPlatform) {
                    alert('플랫폼을 선택해주세요.');
                    return;
                }
                
                // 선택된 플랫폼에 맞는 다운로드 링크 찾기
                const assets = ${JSON.stringify(release.assets)};
                const platformMap = {
                    'mac-x64': 'dmg',
                    'mac-arm64': 'dmg',
                    'win-x64': 'exe',
                    'win-ia32': 'exe',
                    'linux-x64': 'AppImage'
                };
                
                const fileExtension = platformMap[selectedPlatform];
                const asset = assets.find(a => a.name.includes(fileExtension));
                
                if (asset) {
                    window.electronAPI.downloadUpdate(asset.browser_download_url, asset.name);
                } else {
                    alert('해당 플랫폼용 파일을 찾을 수 없습니다.');
                }
            }
            
            function closeUpdate() {
                window.electronAPI.closeUpdateWindow();
            }
        </script>
    </body>
    </html>
  `;

  updateWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(updateHtml)}`);
}

// Chromium 엔진 강제 사용 설정
app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('--disable-web-security');
app.commandLine.appendSwitch('--disable-features', 'TranslateUI');
app.commandLine.appendSwitch('--disable-ipc-flooding-protection');
app.commandLine.appendSwitch('--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

// 앱이 준비되면 윈도우 생성
app.whenReady().then(createWindow);

// 모든 윈도우가 닫혔을 때 (macOS 제외)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 앱이 활성화될 때 (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 자격 증명 저장
ipcMain.handle('save-credentials', async (event, credentials) => {
  try {
    store.set('credentials', {
      username: credentials.username,
      password: credentials.password,
      remember: credentials.remember
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 자격 증명 불러오기
ipcMain.handle('load-credentials', async () => {
  try {
    const credentials = store.get('credentials', {});
    return { success: true, credentials };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 자격 증명 삭제
ipcMain.handle('clear-credentials', async () => {
  try {
    store.delete('credentials');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// LMS 페이지로 이동
ipcMain.handle('navigate-to-lms', async (event, credentials) => {
  try {
    mainWindow.loadURL('https://mylms.korea.ac.kr/');
    
    // 웹뷰 로드 완료 시 자동 로그인 시도
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        performLMSAutoLogin(credentials);
      }, 2000);
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 세션 만료 체크
ipcMain.handle('check-session', async () => {
  try {
    const lastLogin = store.get('lastLogin', null);
    if (!lastLogin) {
      return { expired: true };
    }
    
    const now = new Date();
    const loginTime = new Date(lastLogin);
    const diffInHours = (now - loginTime) / (1000 * 60 * 60);
    
    return { expired: diffInHours >= 2 };
  } catch (error) {
    return { expired: true, error: error.message };
  }
});

// 로그인 시간 저장
ipcMain.handle('save-login-time', async () => {
  try {
    store.set('lastLogin', new Date().toISOString());
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 업데이트 다운로드
ipcMain.handle('download-update', async (event, downloadUrl, fileName) => {
  try {
    const { shell } = require('electron');
    await shell.openExternal(downloadUrl);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 업데이트 창 닫기
ipcMain.handle('close-update-window', async () => {
  try {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (window.getTitle() === '업데이트 알림') {
        window.close();
      }
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 수동 업데이트 확인
ipcMain.handle('check-updates-manual', async () => {
  try {
    checkForUpdates();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
