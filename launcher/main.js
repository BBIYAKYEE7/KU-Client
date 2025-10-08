const { app, BrowserWindow, nativeTheme, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
// const keytar = require('keytar'); // 유니버셜 빌드를 위해 임시 비활성화
const AutoUpdater = require('./auto-updater');
// 세션 상단바(빨간 줄) 사용 여부
const ENABLE_SESSION_BAR = false;

// 자동 업데이트 관련 변수
let autoUpdaterInstance = null;
let autoUpdaterInitialized = false;

// 버전 오버라이드 제거: 항상 package.json 버전 사용

// ------------------------------
// Secure local credential storage (AES-256-GCM, file-based)
// ------------------------------
const crypto = require('crypto');
const { promises: fsp } = require('fs');

function getUserDataPath() {
  try { return app.getPath('userData'); } catch (_) { return path.join(process.cwd(), '.userData'); }
}

function getCredsFilePath() {
  return path.join(getUserDataPath(), 'creds.json');
}

function getKeyFilePath() {
  return path.join(getUserDataPath(), 'cred_key');
}

async function ensureKey() {
  const keyFile = getKeyFilePath();
  try {
    const existing = await fsp.readFile(keyFile);
    if (existing && existing.length === 32) return existing;
  } catch (_) { /* no key */ }
  await fsp.mkdir(getUserDataPath(), { recursive: true });
  const key = crypto.randomBytes(32);
  await fsp.writeFile(keyFile, key, { mode: 0o600 });
  return key;
}

async function loadCredsMap() {
  try {
    const buf = await fsp.readFile(getCredsFilePath(), 'utf8');
    return JSON.parse(buf || '{}');
  } catch (_) { return {}; }
}

async function saveCredsMap(map) {
  await fsp.mkdir(getUserDataPath(), { recursive: true });
  await fsp.writeFile(getCredsFilePath(), JSON.stringify(map, null, 2), { mode: 0o600 });
}

function encryptWithKey(key, plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('base64'), tag: tag.toString('base64'), data: enc.toString('base64') };
}

function decryptWithKey(key, payload) {
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const data = Buffer.from(payload.data, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}

// 알림 관련 변수
let messageCheckInterval;
let assignmentCheckInterval;
let lastMessageCount = 0;
let lastAssignmentData = null;
let lmsWindows = new Map(); // LMS 창들을 추적하기 위한 Map

// PDF 또는 PDF 뷰어(구글 Docs/Drive 포함) URL 여부 판별
function isPdfLikeUrl(rawUrl) {
  try {
    if (!rawUrl || typeof rawUrl !== 'string') return false;
    const url = rawUrl;
    // 직접 PDF 혹은 데이터/블롭
    if (/^data:|^blob:/i.test(url)) return true;
    if (/\.pdf($|\?|#)/i.test(url)) return true;
    if (/mimeType=application%2Fpdf|mime=application%2Fpdf/i.test(url)) return true;
    // 구글 문서/드라이브/콘텐츠 뷰어
    if (/docs\.google\.com\/gview/i.test(url)) return true;
    if (/drive\.google\.com\/(file\/|uc\?|open\?|preview|view)/i.test(url)) return true;
    if (/googleusercontent\.com\/viewer/i.test(url)) return true;
    if (/viewerng\/viewer\?/i.test(url)) return true; // 일부 구글 뷰어 변종
    return false;
  } catch (_) { return false; }
}

// 데스크탑 알림 표시 함수
function showNotification(title, body, icon = null) {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: title,
      body: body,
      icon: icon || path.join(__dirname, 'image/logo.png'),
      sound: true,
      urgency: 'normal'
    });
    
    notification.on('click', () => {
      // LMS 창이 있으면 포커스, 없으면 새로 열기
      const lmsWindow = Array.from(lmsWindows.values())[0];
      if (lmsWindow && !lmsWindow.isDestroyed()) {
        lmsWindow.show();
        lmsWindow.focus();
      }
    });
    
    notification.show();
  }
}

// 메시지 수신 체크 함수
async function checkForNewMessages() {
  const activeLmsWindows = Array.from(lmsWindows.values()).filter(win => !win.isDestroyed());
  
  if (activeLmsWindows.length === 0) {
    return;
  }

  for (const lmsWindow of activeLmsWindows) {
    try {
      const result = await lmsWindow.webContents.executeJavaScript(`
        (async () => {
          try {
            // 메시지함 페이지로 이동
            const currentUrl = window.location.href;
            if (!currentUrl.includes('conversations')) {
              // 메시지함 페이지로 이동
              window.location.href = 'https://mylms.korea.ac.kr/conversations#filter=type=inbox';
              return { success: false, message: '메시지함 페이지로 이동 중' };
            }
            
            // 페이지 로딩 대기
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 읽지 않은 메시지 수 확인
            const unreadElements = document.querySelectorAll('.unread, .new, [class*="unread"], [class*="new"]');
            const unreadCount = unreadElements.length;
            
            // 또는 메시지 목록에서 읽지 않은 메시지 확인
            const messageRows = document.querySelectorAll('tr, .message-item, .conversation-item');
            let actualUnreadCount = 0;
            
            messageRows.forEach(row => {
              if (row.textContent.includes('읽지 않음') || 
                  row.classList.contains('unread') || 
                  row.classList.contains('new') ||
                  row.querySelector('.unread, .new')) {
                actualUnreadCount++;
              }
            });
            
            return { 
              success: true, 
              unreadCount: Math.max(unreadCount, actualUnreadCount),
              currentUrl: window.location.href
            };
          } catch (error) {
            return { success: false, message: error.message };
          }
        })();
      `);
      
      if (result.success && result.unreadCount > lastMessageCount) {
        const newMessageCount = result.unreadCount - lastMessageCount;
        showNotification(
          '새 메시지가 도착했습니다',
          `${newMessageCount}개의 새 메시지가 있습니다.`,
          path.join(__dirname, 'image/logo.png')
        );
      }
      
      lastMessageCount = result.unreadCount || 0;
    } catch (error) {
      console.error('메시지 체크 중 오류:', error);
    }
  }
}

// 과제 마감일 체크 함수
async function checkAssignmentDeadlines() {
  const activeLmsWindows = Array.from(lmsWindows.values()).filter(win => !win.isDestroyed());
  
  if (activeLmsWindows.length === 0) {
    return;
  }

  for (const lmsWindow of activeLmsWindows) {
    try {
      const result = await lmsWindow.webContents.executeJavaScript(`
        (async () => {
          try {
            // 캘린더 페이지로 이동
            const currentUrl = window.location.href;
            if (!currentUrl.includes('calendar')) {
              window.location.href = 'https://mylms.korea.ac.kr/calendar';
              return { success: false, message: '캘린더 페이지로 이동 중' };
            }
            
            // 페이지 로딩 대기
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 과제 정보 수집
            const assignments = [];
            const now = new Date();
            
            // 캘린더 이벤트에서 과제 정보 추출
            const events = document.querySelectorAll('.fc-event, .event, .assignment, [class*="assignment"]');
            
            events.forEach(event => {
              const title = event.textContent || event.title || '';
              const timeElement = event.querySelector('.time, .date, [class*="time"], [class*="date"]');
              const timeText = timeElement ? timeElement.textContent : '';
              
              if (title && (title.includes('과제') || title.includes('Assignment') || title.includes('제출'))) {
                // 시간 파싱 시도
                const deadline = parseDeadline(timeText);
                if (deadline) {
                  assignments.push({
                    title: title.trim(),
                    deadline: deadline,
                    timeText: timeText
                  });
                }
              }
            });
            
            // 또는 다른 방식으로 과제 정보 수집
            const assignmentElements = document.querySelectorAll('[class*="assignment"], [id*="assignment"]');
            assignmentElements.forEach(element => {
              const title = element.textContent || '';
              if (title.includes('과제') || title.includes('Assignment')) {
                const deadline = parseDeadline(title);
                if (deadline) {
                  assignments.push({
                    title: title.trim(),
                    deadline: deadline,
                    timeText: title
                  });
                }
              }
            });
            
            function parseDeadline(timeText) {
              if (!timeText) return null;
              
              // 다양한 시간 형식 파싱
              const patterns = [
                /(\\d{4})[\\-\\/](\\d{1,2})[\\-\\/](\\d{1,2})\\s+(\\d{1,2}):(\\d{2})/,
                /(\\d{1,2})[\\-\\/](\\d{1,2})[\\-\\/](\\d{4})\\s+(\\d{1,2}):(\\d{2})/,
                /(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})\\s+(\\d{1,2}):(\\d{2})/
              ];
              
              for (const pattern of patterns) {
                const match = timeText.match(pattern);
                if (match) {
                  const year = match[1];
                  const month = match[2];
                  const day = match[3];
                  const hour = match[4];
                  const minute = match[5];
                  return new Date(year, month - 1, day, hour, minute);
                }
              }
              
              return null;
            }
            
            return { 
              success: true, 
              assignments: assignments,
              currentUrl: window.location.href
            };
          } catch (error) {
            return { success: false, message: error.message };
          }
        })();
      `);
      
      if (result.success && result.assignments) {
        const now = new Date();
        const notificationTimes = [60, 30, 10, 5, 1]; // 분 단위
        
        result.assignments.forEach(assignment => {
          const timeDiff = assignment.deadline - now;
          const minutesUntilDeadline = Math.floor(timeDiff / (1000 * 60));
          
          // 알림 시간 체크
          notificationTimes.forEach(notificationTime => {
            if (minutesUntilDeadline <= notificationTime && minutesUntilDeadline > 0) {
              // 이전에 알림을 보냈는지 확인
              const notificationKey = assignment.title + '_' + notificationTime;
              if (!lastAssignmentData || !lastAssignmentData[notificationKey]) {
                showNotification(
                  '과제 마감 알림',
                  '"' + assignment.title + '" 과제가 ' + notificationTime + '분 후 마감됩니다.',
                  path.join(__dirname, 'image/logo.png')
                );
                
                // 알림 보낸 기록 저장
                if (!lastAssignmentData) lastAssignmentData = {};
                lastAssignmentData[notificationKey] = true;
              }
            }
          });
        });
      }
    } catch (error) {
      console.error('과제 마감일 체크 중 오류:', error);
    }
  }
}

// 알림 체크 시작
function startNotificationChecks() {
  // 메시지 체크 (5분마다)
  messageCheckInterval = setInterval(checkForNewMessages, 5 * 60 * 1000);
  
  // 과제 마감일 체크 (1분마다)
  assignmentCheckInterval = setInterval(checkAssignmentDeadlines, 1 * 60 * 1000);
  
  console.log('알림 체크가 시작되었습니다.');
}

// 알림 체크 중지
function stopNotificationChecks() {
  if (messageCheckInterval) {
    clearInterval(messageCheckInterval);
    messageCheckInterval = null;
  }
  
  if (assignmentCheckInterval) {
    clearInterval(assignmentCheckInterval);
    assignmentCheckInterval = null;
  }
  
  console.log('알림 체크가 중지되었습니다.');
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

// IPC 핸들러들을 앱 준비 후에 등록
app.on('ready', () => {
ipcMain.handle('launcher-open-portal', (event, { account, password } = {}) => {
  const child = new BrowserWindow({
    width: 1200,
    height: 800,
    title: '',
    // 기본 시스템 타이틀바 표시
    titleBarStyle: 'default',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f1115' : '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      disableDialogs: true,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: false,
      webSecurity: true
    }
  });
  
  // 새 창 열기 제어: PDF/구글뷰어는 현재 창에서 열고, 외부 링크는 기본 브라우저로
  try {
  child.webContents.setWindowOpenHandler(({ url }) => {
      try {
        if (isPdfLikeUrl(url)) {
          child.loadURL(url);
          return { action: 'deny' };
        }
        // 다운로드 링크 가로채기: 쿼리 노출 방지 (새 창 금지)
        if (/download|file|attachment|assign|submission|export/i.test(url)) {
          try { child.webContents.session.downloadURL(url); } catch (_) {}
          return { action: 'deny' };
        }
      } catch (_) {}
      return { action: 'allow' };
    });
  } catch (_) {}
  // 로그인 페이지를 직접 열어 자동 로그인 안정화 (Intro는 세션 모달로 막히는 경우가 있어 Login.kpd로 진입)
  const loginUrl = 'https://portal.korea.ac.kr/common/Login.kpd';
  const referrer = 'https://portal.korea.ac.kr/front/Main.kpd';
  child.loadURL(loginUrl, { httpReferrer: referrer });

  // 일부 사이트는 Electron UA를 차단하므로 최신 크롬 UA로 스푸핑
  try {
    child.webContents.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
  } catch (_) {}

  // 포털 도메인 요청에 공통 Referer를 강제 설정(리다이렉트 중에도 유지)
  try {
    const ses = child.webContents.session;
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      if (details.url.includes('portal.korea.ac.kr')) {
        details.requestHeaders['Referer'] = referrer;
        details.requestHeaders['Origin'] = 'https://portal.korea.ac.kr';
      }
      callback({ requestHeaders: details.requestHeaders });
    });
  } catch (_) {}

  const tryFillAndSubmit = async () => {
    // 민감 정보 로그 제거
    
    if (!account || !password) {
      return;
    }
    
    try {
      // 프리로드로 즉시 전달하여 최대한 빠르게 처리
      child.webContents.send('portal-credentials', { account, password });
    } catch (error) {
      console.error('자격 증명 전달 오류:', error);
    }
  };

  // 로그인 페이지 로드가 끝나면 시도
  // 모든 리소스 로드를 기다리지 않고, DOM 준비 직후 시도
  child.webContents.on('dom-ready', async () => {
    const url = child.webContents.getURL();
    if (/portal\.korea\.ac\.kr\/common\/Login\.kpd/.test(url)) {
      await tryFillAndSubmit();
    }
    // Pretendard 글꼴 전역 적용 (로그인 이후 페이지 포함 모든 포털 도메인에 주입)
    if (/portal\.korea\.ac\.kr\//.test(url)) {
      try {
        await child.webContents.insertCSS(`
          @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
          html, body, * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Apple SD Gothic Neo', Inter, system-ui, sans-serif !important; }
        `);
      } catch (_) {}
      // 세션 만료 알림만 주입 (헤더 없이)
      try {
        await child.webContents.insertCSS(`
          .ku-session-toast { 
            position: fixed; 
            top: 20px; 
            right: 20px; 
            background: #e31b23; 
            color: #fff; 
            padding: 15px 20px; 
            border-radius: 10px; 
            z-index: 999999; 
            box-shadow: rgba(0,0,0,0.3) 0 8px 20px; 
            font-size: 14px; 
            font-weight: 600;
            max-width: 300px;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
          }
          .ku-session-toast.show {
            opacity: 1;
            transform: translateX(0);
          }
          .ku-session-toast.warning {
            background: #ffc107;
            color: #000;
          }
          .ku-session-toast.error {
            background: #dc3545;
          }
        `);
        
        await child.webContents.executeJavaScript(`(function(){
          if (window.__kuSessionNotificationInjected) return; 
          window.__kuSessionNotificationInjected = true;
          
          function showToast(msg, type = 'warning') {
            const toast = document.createElement('div');
            toast.className = 'ku-session-toast ' + type;
            toast.textContent = msg;
            document.documentElement.appendChild(toast);
            
            // 애니메이션으로 표시
            setTimeout(() => toast.classList.add('show'), 100);
            
            // 5초 후 제거
            setTimeout(() => {
              toast.classList.remove('show');
              setTimeout(() => toast.remove(), 300);
            }, 5000);
          }

          const totalMs = 60*60*1000; // 1시간
          const start = Date.now();
          let alerted10 = false, alerted5 = false, alerted1 = false;
          
          function tick() {
            const elapsed = Date.now() - start;
            const remain = Math.max(0, totalMs - elapsed);
            const remainMin = Math.ceil(remain / 60000);
            
            if (!alerted10 && remainMin <= 10 && remain > 0) {
              alerted10 = true;
              showToast('세션이 10분 후 만료됩니다. 진행 중인 작업을 저장하세요.', 'warning');
            }
            if (!alerted5 && remainMin <= 5 && remain > 0) {
              alerted5 = true;
              showToast('세션이 5분 후 만료됩니다. 작업을 완료하세요.', 'warning');
            }
            if (!alerted1 && remainMin <= 1 && remain > 0) {
              alerted1 = true;
              showToast('세션이 1분 후 만료됩니다!', 'error');
            }
            if (remain > 0) {
              window.__kuSessionTimer = setTimeout(tick, 1000);
            } else {
              showToast('세션이 만료되었습니다. 재로그인이 필요할 수 있습니다.', 'error');
            }
          }
          
          tick();
        })();`);
      } catch (_) {}
    }
  });

  // in-page 내비게이션에서도 폰트 유지 주입
  child.webContents.on('did-navigate-in-page', async (_e, url, isMainFrame) => {
    if (!isMainFrame) return; // 서브프레임은 무시
    if (/portal\.korea\.ac\.kr\//.test(url)) {
      try {
        await child.webContents.insertCSS(`
          @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
          html, body, * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Apple SD Gothic Neo', Inter, system-ui, sans-serif !important; }
        `);
      } catch (_) {}
      // 헤더가 사라졌으면 재주입 시도 표시 플래그 유지
      try {
        await child.webContents.executeJavaScript(`(function(){ if(!document.getElementById('ku-helper-bar')){ window.__kuSessionBarInjected = false; } })();`);
      } catch (_) {}
    }
  });

  // 포털 네비게이션 처리: PDF/뷰어는 간섭하지 않고, 특수한 오류/인트로 페이지에서만 로그인으로 복귀
  child.webContents.on('did-navigate', (e, url) => {
    // PDF/구글뷰어/데이터/블롭 미리보기는 간섭하지 않음
    if (isPdfLikeUrl(url)) return;
    if (/portal\.korea\.ac\.kr\/front\/Main\.kpd/.test(url)) return; // 이미 메인
    // 포털 도메인 내 특수 페이지(인트로/세션만료/오류 등)에서만 로그인으로 복귀
    if (/portal\.korea\.ac\.kr\/.+/.test(url)
        && !/common\/Login\.kpd/.test(url)
        && /(intro|Intro|session|expired|timeout|Timeout|invalid|Invalid|error|Error)\b/.test(url)) {
      child.loadURL(loginUrl, { httpReferrer: referrer });
    }
  });

  // 리다이렉트 이벤트에도 대비하여 재시도
  child.webContents.on('did-redirect-navigation', (e, url, _isInPlace, isMainFrame) => {
    if (!isMainFrame) return; // 서브프레임은 무시
    // PDF/구글뷰어/데이터/블롭 미리보기는 간섭하지 않음
    if (isPdfLikeUrl(url)) return;
    if (/portal\.korea\.ac\.kr\/common\/Login\.kpd/.test(url)) {
      console.log('포털 로그인 페이지 리다이렉트 감지, 자동 로그인 재시도');
      setTimeout(() => { tryFillAndSubmit(); }, 200);
    }
  });

  // 페이지 로드 완료 후에도 자동 로그인 시도
  child.webContents.on('did-finish-load', async (_e) => {
    const url = child.webContents.getURL(); // 메인 프레임 기준 URL
    // PDF/구글뷰어/데이터/블롭 미리보기는 간섭하지 않음
    if (isPdfLikeUrl(url)) return;
    if (/portal\.korea\.ac\.kr\/common\/Login\.kpd/.test(url)) {
      setTimeout(() => { tryFillAndSubmit(); }, 500);
    }
  });

  // 네트워크 에러/빈 페이지 방어 재시도 (PDF/뷰어는 예외)
  child.webContents.on('did-fail-load', (_e, errorCode, errorDesc, validatedURL, isMainFrame) => {
    if (!isMainFrame) return; // 서브프레임 실패는 무시
    try {
      if (validatedURL && isPdfLikeUrl(validatedURL)) return;
    } catch(_) {}
    child.loadURL(loginUrl, { httpReferrer: referrer });
  });
});

ipcMain.handle('launcher-open-lms', (event, { account, password } = {}) => {
  console.log('LMS 열기 요청:', { 
    hasAccount: !!account, 
    hasPassword: !!password, 
    accountLength: account ? account.length : 0,
    passwordLength: password ? password.length : 0,
    account: account
  });
  
  const child = new BrowserWindow({
    width: 1200,
    height: 800,
    title: '',
    // 기본 시스템 타이틀바 표시
    titleBarStyle: 'default',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f1115' : '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      disableDialogs: true
    }
  });
  
  // LMS 창을 Map에 추가
  const windowId = child.id;
  lmsWindows.set(windowId, child);
  
  // 창이 닫힐 때 Map에서 제거
  child.on('closed', () => {
    lmsWindows.delete(windowId);
  });
  
  // 새 창 열기 제어: PDF/구글뷰어는 현재 창에서 열고, 외부 링크는 기본 브라우저로
  try {
    child.webContents.setWindowOpenHandler(({ url }) => {
      try {
        if (isPdfLikeUrl(url)) {
          child.loadURL(url);
          return { action: 'deny' };
        }
      } catch (_) {}
      return { action: 'allow' };
    });
  } catch (_) {}
  
  // LMS 로그인 페이지로 직접 이동
  const lmsLoginUrl = 'https://mylms.korea.ac.kr/';
  child.loadURL(lmsLoginUrl);

  // 일부 사이트는 Electron UA를 차단하므로 최신 크롬 UA로 스푸핑
  try {
    child.webContents.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
  } catch (_) {}

  const tryLMSAutoLogin = async () => {
    console.log('LMS 자격 증명 전달 시도(프리로드):', { 
      hasAccount: !!account, 
      hasPassword: !!password 
    });
    if (!account || !password) return;
    try {
      child.webContents.send('lms-credentials', { account, password });
    } catch (error) {
      console.error('LMS 자격 증명 전달 오류:', error);
    }
  };

  // LMS 페이지 로드가 끝나면 자동 로그인 시도 (로그인 관련 페이지에서만)
  child.webContents.on('dom-ready', async () => {
    const url = child.webContents.getURL(); // 메인 프레임 기준 URL
    console.log('LMS 페이지 로드 완료:', url);
    if ((/sso\.korea\.ac\.kr/.test(url)) || (/mylms\.korea\.ac\.kr|lms\.korea\.ac\.kr/.test(url) && /(login|Login|signin|auth)/i.test(url))) {
      console.log('LMS 로그인 페이지 감지, 자동 로그인 시도');
      await tryLMSAutoLogin();
      // Canvas 브라우저 지원 경고 배너 최소 침습 제거
      try {
        await child.webContents.executeJavaScript(`(function(){
          if (window.__kuCanvasBannerRemoved) return; 
          window.__kuCanvasBannerRemoved = true;

          function hideCanvasBanner() {
            try {
              document.querySelectorAll('.ic-flash-warning.flash-message-container.unsupported_browser').forEach(el => el.remove());
              document.querySelectorAll('.ic-flash-warning .close_link, .ic-flash-warning .Button--icon-action, .ic-flash-warning .icon-x').forEach(btn => { try { btn.click(); } catch(_){} });
            } catch (_) {}
          }
          hideCanvasBanner();
          let i = 0; 
          const timer = setInterval(() => { hideCanvasBanner(); if (++i > 50) clearInterval(timer); }, 100);
        })();`);
      } catch (_) {}
    }

    // LMS 도메인에 Pretendard 폰트 적용 (복구)
    if (/mylms\.korea\.ac\.kr|lms\.korea\.ac\.kr/.test(url)) {
      try {
        await child.webContents.insertCSS(`
          @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
          html, body, * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Apple SD Gothic Neo', Inter, system-ui, sans-serif !important; }
        `);
      } catch (_) {}
    }
  });

  // 페이지 로드 완료 후에도 자동 로그인 시도
  child.webContents.on('did-finish-load', async (_e) => {
    const url = child.webContents.getURL(); // 메인 프레임 기준 URL
    if (isPdfLikeUrl(url)) return;
    if ((/sso\.korea\.ac\.kr/.test(url)) || (/mylms\.korea\.ac\.kr|lms\.korea\.ac\.kr/.test(url) && /(login|Login|signin|auth)/i.test(url))) {
      console.log('LMS 페이지 완전 로드 완료, 자동 로그인 재시도');
      setTimeout(() => { tryLMSAutoLogin(); }, 500);
    }
  });

  child.webContents.on('did-navigate-in-page', async (_e, url, isMainFrame) => {
    if (!isMainFrame) return; // 서브프레임은 무시
    if (isPdfLikeUrl(url)) return;

    // LMS 도메인에 Pretendard 폰트 적용 (in-page 이동 시에도 유지)
    if (/mylms\.korea\.ac\.kr|lms\.korea\.ac\.kr/.test(url)) {
      try {
        await child.webContents.insertCSS(`
          @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
          html, body, * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Apple SD Gothic Neo', Inter, system-ui, sans-serif !important; }
        `);
      } catch (_) {}
    }

    if ((/sso\.korea\.ac\.kr/.test(url)) || (/mylms\.korea\.ac\.kr|lms\.korea\.ac\.kr/.test(url) && /(login|Login|signin|auth)/i.test(url))) {
      setTimeout(() => { tryLMSAutoLogin(); }, 200);
      try {
        await child.webContents.executeJavaScript(`(function(){
          function hideCanvasBanner() {
            try {
              document.querySelectorAll('.ic-flash-warning.flash-message-container.unsupported_browser').forEach(el => el.remove());
              document.querySelectorAll('.ic-flash-warning .close_link, .ic-flash-warning .Button--icon-action, .ic-flash-warning .icon-x').forEach(btn => { try { btn.click(); } catch(_){} });
            } catch (_) {}
          }
          hideCanvasBanner();
          let i = 0; const timer = setInterval(() => { hideCanvasBanner(); if (++i > 30) clearInterval(timer); }, 100);
        })();`);
      } catch (_) {}
    }
  });

  child.webContents.on('did-redirect-navigation', (_e, url, _isInPlace, isMainFrame) => {
    if (!isMainFrame) return; // 서브프레임은 무시
    if (isPdfLikeUrl(url)) return;
    if ((/sso\.korea\.ac\.kr/.test(url)) || (/mylms\.korea\.ac\.kr|lms\.korea\.ac\.kr/.test(url) && /(login|Login|signin|auth)/i.test(url))) {
      setTimeout(() => { tryLMSAutoLogin(); }, 200);
    }
  });

  // 네트워크 에러/빈 페이지 방어 재시도 (PDF/뷰어는 예외)
  child.webContents.on('did-fail-load', (_e, errorCode, errorDesc, validatedURL, isMainFrame) => {
    if (!isMainFrame) return; // 서브프레임 실패는 무시
    try { if (validatedURL && isPdfLikeUrl(validatedURL)) return; } catch(_) {}
    child.loadURL(lmsLoginUrl);
  });
});

// 글로벌 단축키 등록 제거: 읽음 처리 기능 롤백
// (기존 등록이 있었다면 해제)
try {
  const { globalShortcut } = require('electron');
  app.whenReady().then(() => {
    try { globalShortcut.unregister('CommandOrControl+Shift+A'); } catch(_) {}
    try { globalShortcut.unregister('CommandOrControl+Shift+R'); } catch(_) {}
  });
} catch (_) {}

// 시스템 테마 감지
ipcMain.handle('get-system-theme', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

// 자격 증명 저장/로드/삭제 (macOS Keychain 등 안전한 저장소 사용)
const SERVICE_NAME = 'KUClient';

// 유니버셜 빌드를 위해 keytar 기능 임시 비활성화
ipcMain.handle('creds-save', async (_event, { account, password }) => {
  if (!account || typeof password !== 'string') {
    throw new Error('Invalid credentials');
  }
  const key = await ensureKey();
  const enc = encryptWithKey(key, password);
  const map = await loadCredsMap();
  map[account] = enc;
  await saveCredsMap(map);
  return true;
});

ipcMain.handle('creds-load', async (_event, { account }) => {
  if (!account) throw new Error('Account required');
  const map = await loadCredsMap();
  const payload = map[account];
  if (!payload) return null;
  const key = await ensureKey();
  try {
    return decryptWithKey(key, payload);
  } catch (_) {
    return null;
  }
});

ipcMain.handle('creds-delete', async (_event, { account }) => {
  if (!account) throw new Error('Account required');
  const map = await loadCredsMap();
  if (map[account]) {
    delete map[account];
    await saveCredsMap(map);
    return true;
  }
  return false;
});

// KUPID 앱의 로그인 설정(config.json)을 읽어와 마이그레이션 시도
ipcMain.handle('migrate-from-kupid-config', async () => {
  try {
    // 1) 사용자가 이전에 KUPID 앱을 실행했다면 userData 경로에 저장됨
    // macOS 기준 예상 경로: ~/Library/Application Support/KUPID/config.json
    const homeDir = require('os').homedir();
    const candidates = [];
    // 일반적인 Electron userData 기본 디렉토리 추정치들 추가
    candidates.push(path.join(homeDir, 'Library', 'Application Support', 'KUPID', 'config.json'));
    candidates.push(path.join(homeDir, 'AppData', 'Roaming', 'KUPID', 'config.json')); // Windows 대비
    candidates.push(path.join(homeDir, '.config', 'KUPID', 'config.json')); // Linux 대비
    // 2) 프로젝트 내 기본 config.json (개발 환경 폴백)
    candidates.push(path.join(__dirname, '..', 'KUPID', 'config.json'));

    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, 'utf8');
          const cfg = JSON.parse(raw);
          const username = (cfg && typeof cfg.username === 'string') ? cfg.username.trim() : '';
          const password = (cfg && typeof cfg.password === 'string') ? cfg.password : '';
          if (username && password) {
            return { account: username, password };
          }
        }
      } catch (_) {
        // 다음 후보로 진행
      }
    }
    return null;
  } catch (e) {
    return null;
  }
});

// 알림 체크 시작
ipcMain.handle('start-notification-checks', async () => {
  try {
    startNotificationChecks();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 알림 체크 중지
ipcMain.handle('stop-notification-checks', async () => {
  try {
    stopNotificationChecks();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 새 메시지 체크 (수동)
ipcMain.handle('check-for-new-messages', async () => {
  try {
    await checkForNewMessages();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 과제 마감일 체크 (수동)
ipcMain.handle('check-assignment-deadlines', async () => {
  try {
    await checkAssignmentDeadlines();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 테스트 알림
ipcMain.handle('test-notification', async (event, type) => {
  try {
    if (type === 'message') {
      showNotification(
        '테스트 메시지 알림',
        '새 메시지가 도착했습니다. (테스트)',
        path.join(__dirname, 'image/logo.png')
      );
    } else if (type === 'assignment') {
      showNotification(
        '테스트 과제 알림',
        '과제 마감이 1시간 남았습니다. (테스트)',
        path.join(__dirname, 'image/logo.png')
      );
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
}); // end of app.on('ready')

// 앱 실행 중 최초 1회만 로딩 화면을 보여주기 위한 플래그
let hasShownBootScreen = false;

function createWindow() {
  const win = new BrowserWindow({
    width: 920,
    height: 620,
    resizable: false,
    fullscreenable: false,
    title: '',
    titleBarStyle: 'hiddenInset',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f1115' : '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 첫 실행 이후부터는 로딩 화면을 건너뛰기 위해 쿼리 전달
  win.loadFile('renderer/index.html', {
    search: hasShownBootScreen ? 'skipBoot=1' : ''
  });

  // 첫 윈도우 생성 시점 이후에는 부팅화면을 보여준 것으로 처리
  if (!hasShownBootScreen) {
    hasShownBootScreen = true;
  }

  // 시스템 테마 변경 감지
  nativeTheme.on('updated', () => {
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    win.webContents.send('system-theme-changed', theme);
  });

  // 자동 업데이트 시작: 로딩 화면과 동시에 시작
  setupAutoUpdater();
  
  // 알림 체크 시작 (앱이 완전히 로드된 후)
  setTimeout(() => {
    startNotificationChecks();
  }, 5000); // 5초 후 알림 체크 시작
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopNotificationChecks();
  if (process.platform !== 'darwin') app.quit();
});

// 앱 종료 전 정리
app.on('before-quit', () => {
  stopNotificationChecks();
});


