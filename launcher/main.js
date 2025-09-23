const { app, BrowserWindow, nativeTheme, ipcMain } = require('electron');
const path = require('path');
const keytar = require('keytar');

// IPC 핸들러들을 한 번만 등록
ipcMain.handle('launcher-open-portal', (event, { account, password } = {}) => {
  const child = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f1115' : '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
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
    if (!account || !password) return;
    try {
      // 프리로드로 즉시 전달하여 최대한 빠르게 처리
      child.webContents.send('portal-credentials', { account, password });
    } catch (_) {}
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
    }
  });

  // in-page 내비게이션에서도 폰트 유지 주입
  child.webContents.on('did-navigate-in-page', async (_e, url) => {
    if (/portal\.korea\.ac\.kr\//.test(url)) {
      try {
        await child.webContents.insertCSS(`
          @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
          html, body, * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Apple SD Gothic Neo', Inter, system-ui, sans-serif !important; }
        `);
      } catch (_) {}
    }
  });

  // 로그인 성공 시 메인으로 이동
  child.webContents.on('did-navigate', (e, url) => {
    if (/portal\.korea\.ac\.kr\/front\/Main\.kpd/.test(url)) return; // 이미 메인
    // Intro나 타임아웃 페이지로 간 경우 로그인 페이지로 돌림
    if (/portal\.korea\.ac\.kr\/.+/.test(url) && !/common\/Login\.kpd/.test(url)) {
      child.loadURL(loginUrl, { httpReferrer: referrer });
    }
  });

  // 리다이렉트 이벤트에도 대비하여 재시도
  child.webContents.on('did-redirect-navigation', (e, url) => {
    if (/portal\.korea\.ac\.kr\/common\/Login\.kpd/.test(url)) {
      setTimeout(() => { tryFillAndSubmit(); }, 200);
    }
  });

  // 네트워크 에러/빈 페이지 방어 재시도
  child.webContents.on('did-fail-load', () => {
    child.loadURL(loginUrl, { httpReferrer: referrer });
  });
});

ipcMain.handle('launcher-open-lms', () => {
  const child = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f1115' : '#ffffff',
  });
  child.loadURL('https://mylms.korea.ac.kr/');
});

// 시스템 테마 감지
ipcMain.handle('get-system-theme', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

// 자격 증명 저장/로드/삭제 (macOS Keychain 등 안전한 저장소 사용)
const SERVICE_NAME = 'KoreaUniversityLauncher';

ipcMain.handle('creds-save', async (event, { account, password }) => {
  if (!account || typeof password !== 'string') {
    throw new Error('Invalid credentials');
  }
  await keytar.setPassword(SERVICE_NAME, account, password);
  return true;
});

ipcMain.handle('creds-load', async (event, { account }) => {
  if (!account) throw new Error('Account required');
  const password = await keytar.getPassword(SERVICE_NAME, account);
  return password || null;
});

ipcMain.handle('creds-delete', async (event, { account }) => {
  if (!account) throw new Error('Account required');
  const ok = await keytar.deletePassword(SERVICE_NAME, account);
  return ok;
});

// 앱 실행 중 최초 1회만 로딩 화면을 보여주기 위한 플래그
let hasShownBootScreen = false;

function createWindow() {
  const win = new BrowserWindow({
    width: 920,
    height: 620,
    resizable: false,
    fullscreenable: false,
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
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


