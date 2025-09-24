const { app, BrowserWindow, nativeTheme, ipcMain } = require('electron');
const path = require('path');
const keytar = require('keytar');

// IPC 핸들러들을 앱 준비 후에 등록
app.on('ready', () => {
ipcMain.handle('launcher-open-portal', (event, { account, password } = {}) => {
  const child = new BrowserWindow({
    width: 1200,
    height: 800,
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
    console.log('자격 증명 전달 시도:', { 
      hasAccount: !!account, 
      hasPassword: !!password, 
      accountLength: account ? account.length : 0,
      passwordLength: password ? password.length : 0,
      account: account,
      password: password ? '[HIDDEN]' : null
    });
    
    if (!account || !password) {
      console.log('자격 증명이 없어서 자동 로그인 중단');
      console.log('계정:', account);
      console.log('비밀번호:', password ? '[HIDDEN]' : null);
      return;
    }
    
    try {
      // 프리로드로 즉시 전달하여 최대한 빠르게 처리
      console.log('자격 증명을 preload로 전달');
      child.webContents.send('portal-credentials', { account, password });
    } catch (error) {
      console.error('자격 증명 전달 오류:', error);
    }
  };

  // 로그인 페이지 로드가 끝나면 시도
  // 모든 리소스 로드를 기다리지 않고, DOM 준비 직후 시도
  child.webContents.on('dom-ready', async () => {
    const url = child.webContents.getURL();
    console.log('포털 페이지 로드 완료:', url);
    if (/portal\.korea\.ac\.kr\/common\/Login\.kpd/.test(url)) {
      console.log('포털 로그인 페이지 감지, 자동 로그인 시도');
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
      // 상단 커스텀 헤더와 세션 타이머 주입
      try {
        // 이전 버전 헤더가 있으면 제거하고 플래그 초기화
        await child.webContents.executeJavaScript(`(function(){
          try {
            var old=document.getElementById('ku-helper-bar'); if(old) old.remove();
            var fabs=document.getElementsByClassName('ku-fab'); if(fabs&&fabs[0]) fabs[0].remove();
            window.__kuSessionBarInjected = false;
            document.body && (document.body.style.marginTop='');
          } catch(_){}
        })();`);
      // 이전 버전 헤더 제거 후 재주입
      
      // 같은 try 블록 내에서 연속 수행
      // 제거 → 스타일 주입 → 헤더 생성 순으로 처리
      
      // 제거 2차 확인
      await child.webContents.executeJavaScript(`(function(){
          try {
            var old=document.getElementById('ku-helper-bar'); if(old) old.remove();
            var fabs=document.getElementsByClassName('ku-fab'); if(fabs&&fabs[0]) fabs[0].remove();
            window.__kuSessionBarInjected = false;
            document.body && (document.body.style.marginTop='');
          } catch(_){}
        })();`);
        await child.webContents.insertCSS(`
          :root { --ku-helper-height: 40px; }
          #ku-helper-bar { position: fixed; top: 0; left: 0; right: 0; height: var(--ku-helper-height); background: linear-gradient(90deg, #b40017 0%, #e31b23 100%); color: #fff; display: grid; grid-template-columns: 220px 1fr 220px; align-items: center; padding: 0 12px; z-index: 999999; -webkit-app-region: drag; box-shadow: rgba(0,0,0,0.25) 0 2px 10px; }
          #ku-helper-bar .ku-btn { -webkit-app-region: no-drag; cursor: pointer; background: rgba(255,255,255,0.15); color: #fff; border: 1px solid rgba(255,255,255,0.25); border-radius: 8px; padding: 5px 9px; font-size: 12px; font-weight: 700; }
          #ku-helper-bar .ku-btn:hover { background: rgba(255,255,255,0.22); }
          #ku-helper-bar .left { display: flex; align-items: center; gap: 8px; }
          #ku-helper-bar .center { display: flex; align-items: center; justify-content: center; gap: 10px; }
          #ku-helper-bar .right { display: flex; gap: 8px; align-items: center; -webkit-app-region: no-drag; justify-content: flex-end; }
          #ku-progress { width: 360px; height: 8px; background: rgba(255,255,255,0.25); border-radius: 999px; overflow: hidden; }
          #ku-progress > div { height: 100%; width: 100%; background: #fff; transform-origin: left; transform: scaleX(1); }
          #ku-time-label { font-size: 12px; font-weight: 800; letter-spacing: 0.2px; }
          body { margin-top: var(--ku-helper-height) !important; }
          .ku-toast { position: fixed; top: calc(var(--ku-helper-height) + 12px); right: 12px; background: #111; color: #fff; padding: 10px 12px; border-radius: 10px; z-index: 999999; box-shadow: rgba(0,0,0,0.2) 0 6px 16px; font-size: 13px; opacity: 0.98; }
          .ku-fab { position: fixed; top: 6px; left: 84px; background: #e31b23; color: #fff; padding: 6px 12px; border-radius: 999px; z-index: 1000000; display: none; -webkit-app-region: no-drag; font-size: 12px; font-weight: 700; box-shadow: rgba(0,0,0,0.18) 0 6px 14px; }
        `);
        await child.webContents.executeJavaScript(`(function(){
          if (window.__kuSessionBarInjected) return; window.__kuSessionBarInjected = true;
          const bar = document.createElement('div');
          bar.id = 'ku-helper-bar';
          const left = document.createElement('div'); left.className='left';
          const backBtn = document.createElement('button');
          backBtn.className = 'ku-btn';
          backBtn.textContent = '← 런처로';
          backBtn.addEventListener('click', function(){ try { window.close(); } catch(_){} });
          left.appendChild(backBtn);
          const center = document.createElement('div'); center.className='center';
          const time = document.createElement('span'); time.id = 'ku-time-label'; time.textContent='세션: 60:00';
          const prog = document.createElement('div'); prog.id='ku-progress'; const fill=document.createElement('div'); prog.appendChild(fill);
          center.appendChild(time); center.appendChild(prog);
          const right = document.createElement('div'); right.className = 'right';
          const collapse = document.createElement('button'); collapse.className='ku-btn'; collapse.textContent='접기';
          right.appendChild(collapse);
          bar.appendChild(left); bar.appendChild(center); bar.appendChild(right);
          document.documentElement.appendChild(bar);
          const fab = document.createElement('button'); fab.className='ku-fab'; fab.textContent='헤더 열기'; document.documentElement.appendChild(fab);

          function toast(msg){ const t=document.createElement('div'); t.className='ku-toast'; t.textContent=msg; document.documentElement.appendChild(t); setTimeout(()=>{ t.remove(); }, 5000); }

          const totalMs = 60*60*1000; // 1 hour
          const start = Date.now();
          let alerted10=false, alerted5=false;
          function fmt(ms){ const s=Math.max(0, Math.floor(ms/1000)); const mm=String(Math.floor(s/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); return mm+':'+ss; }
          function tick(){
            const elapsed = Date.now()-start; const remain = Math.max(0, totalMs-elapsed); time.textContent = '세션: '+fmt(remain); fill.style.transform = 'scaleX('+(remain/totalMs)+')';
            const remainMin = Math.ceil(remain/60000);
            if (!alerted10 && remainMin<=10 && remain>0){ alerted10=true; toast('세션이 10분 후 만료됩니다. 진행 중인 작업을 저장하세요.'); }
            if (!alerted5 && remainMin<=5 && remain>0){ alerted5=true; toast('세션이 5분 후 만료됩니다.'); }
            if (remain>0) { window.__kuSessionTimer = setTimeout(tick, 1000); } else { toast('세션이 만료되었습니다. 재로그인이 필요할 수 있어요.'); }
          }
          tick();

          function collapseBar(){ document.body.style.marginTop='0px'; bar.style.display='none'; fab.style.display='inline-flex'; }
          function expandBar(){ document.body.style.marginTop='var(--ku-helper-height)'; bar.style.display='flex'; fab.style.display='none'; }
          collapse.addEventListener('click', collapseBar);
          fab.addEventListener('click', expandBar);
        })();`);
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
      // 헤더가 사라졌으면 재주입 시도 표시 플래그 유지
      try {
        await child.webContents.executeJavaScript(`(function(){ if(!document.getElementById('ku-helper-bar')){ window.__kuSessionBarInjected = false; } })();`);
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
      console.log('포털 로그인 페이지 리다이렉트 감지, 자동 로그인 재시도');
      setTimeout(() => { tryFillAndSubmit(); }, 200);
    }
  });

  // 페이지 로드 완료 후에도 자동 로그인 시도
  child.webContents.on('did-finish-load', async () => {
    const url = child.webContents.getURL();
    if (/portal\.korea\.ac\.kr\/common\/Login\.kpd/.test(url)) {
      console.log('포털 로그인 페이지 완전 로드 완료, 자동 로그인 재시도');
      setTimeout(() => { tryFillAndSubmit(); }, 500);
    }
  });

  // 네트워크 에러/빈 페이지 방어 재시도
  child.webContents.on('did-fail-load', () => {
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
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f1115' : '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
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

  // LMS 페이지 로드가 끝나면 자동 로그인 시도
  child.webContents.on('dom-ready', async () => {
    const url = child.webContents.getURL();
    console.log('LMS 페이지 로드 완료:', url);
    if (/mylms\.korea\.ac\.kr|lms\.korea\.ac\.kr|sso\.korea\.ac\.kr/.test(url)) {
      console.log('LMS 로그인 페이지 감지, 자동 로그인 시도');
      await tryLMSAutoLogin();
    }
  });

  // LMS 도메인에 Pretendard 폰트 적용
  child.webContents.on('dom-ready', async () => {
    const url = child.webContents.getURL();
    if (/mylms\.korea\.ac\.kr/.test(url)) {
      try {
        await child.webContents.insertCSS(`
          @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
          html, body, * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Apple SD Gothic Neo', Inter, system-ui, sans-serif !important; }
        `);
      } catch (_) {}
      // 상단 커스텀 헤더와 세션 타이머 주입
      try {
        await child.webContents.insertCSS(`
          :root { --ku-helper-height: 48px; }
          #ku-helper-bar { position: fixed; top: 0; left: 0; right: 0; height: var(--ku-helper-height); background: rgba(20, 20, 20, 0.85); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 16px 0 84px; z-index: 999999; -webkit-app-region: drag; backdrop-filter: saturate(180%) blur(12px); }
          #ku-helper-bar .ku-btn { -webkit-app-region: no-drag; cursor: pointer; background: #e31b23; color: #fff; border: none; border-radius: 8px; padding: 6px 10px; font-size: 13px; font-weight: 600; box-shadow: rgba(0,0,0,0.15) 0 2px 4px; }
          #ku-helper-bar .ku-btn:hover { filter: brightness(1.05); }
          #ku-helper-bar .right { display: flex; gap: 10px; align-items: center; -webkit-app-region: no-drag; }
          body { margin-top: var(--ku-helper-height) !important; }
          .ku-toast { position: fixed; top: calc(var(--ku-helper-height) + 12px); right: 12px; background: #111; color: #fff; padding: 10px 12px; border-radius: 10px; z-index: 999999; box-shadow: rgba(0,0,0,0.2) 0 6px 16px; font-size: 13px; opacity: 0.98; }
          .ku-fab { position: fixed; top: 8px; left: 84px; background: #e31b23; color: #fff; padding: 6px 12px; border-radius: 999px; z-index: 1000000; display: none; -webkit-app-region: no-drag; font-size: 12px; font-weight: 700; box-shadow: rgba(0,0,0,0.18) 0 6px 14px; }
        `);
        await child.webContents.executeJavaScript(`(function(){
          if (window.__kuSessionBarInjected) return; window.__kuSessionBarInjected = true;
          const bar = document.createElement('div');
          bar.id = 'ku-helper-bar';
          const left = document.createElement('div');
          const backBtn = document.createElement('button');
          backBtn.className = 'ku-btn';
          backBtn.textContent = '← 런처로';
          backBtn.addEventListener('click', function(){ try { window.close(); } catch(_){} });
          left.appendChild(backBtn);
          const right = document.createElement('div'); right.className = 'right';
          const label = document.createElement('span'); label.textContent = '세션 만료까지 남은 시간'; label.style.opacity='0.8'; label.style.fontSize='12px';
          const time = document.createElement('span'); time.id = 'ku-session-remaining'; time.style.fontWeight='700';
          const collapse = document.createElement('button'); collapse.className='ku-btn'; collapse.textContent='접기';
          right.appendChild(label); right.appendChild(time); right.appendChild(collapse);
          bar.appendChild(left); bar.appendChild(right);
          document.documentElement.appendChild(bar);
          const fab = document.createElement('button'); fab.className='ku-fab'; fab.textContent='헤더 열기'; document.documentElement.appendChild(fab);

          function toast(msg){ const t=document.createElement('div'); t.className='ku-toast'; t.textContent=msg; document.documentElement.appendChild(t); setTimeout(()=>{ t.remove(); }, 5000); }

          const totalMs = 60*60*1000; // 1 hour
          const start = Date.now();
          let alerted10=false, alerted5=false;
          function fmt(ms){ const s=Math.max(0, Math.floor(ms/1000)); const hh=String(Math.floor(s/3600)).padStart(2,'0'); const mm=String(Math.floor((s%3600)/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); return hh+':'+mm+':'+ss; }
          function tick(){
            const elapsed = Date.now()-start; const remain = Math.max(0, totalMs-elapsed); time.textContent = fmt(remain);
            const remainMin = Math.ceil(remain/60000);
            if (!alerted10 && remainMin<=10 && remain>0){ alerted10=true; toast('세션이 10분 후 만료됩니다. 진행 중인 작업을 저장하세요.'); }
            if (!alerted5 && remainMin<=5 && remain>0){ alerted5=true; toast('세션이 5분 후 만료됩니다.'); }
            if (remain>0) { window.__kuSessionTimer = setTimeout(tick, 1000); } else { toast('세션이 만료되었습니다. 재로그인이 필요할 수 있어요.'); }
          }
          tick();

          function collapseBar(){ document.body.style.marginTop='0px'; bar.style.display='none'; fab.style.display='inline-flex'; }
          function expandBar(){ document.body.style.marginTop='var(--ku-helper-height)'; bar.style.display='flex'; fab.style.display='none'; }
          collapse.addEventListener('click', collapseBar);
          fab.addEventListener('click', expandBar);
        })();`);
      } catch (_) {}
    }
  });

  // in-page 내비게이션에서도 폰트 유지 주입
  child.webContents.on('did-navigate-in-page', async (_e, url) => {
    if (/mylms\.korea\.ac\.kr/.test(url)) {
      try {
        await child.webContents.insertCSS(`
          @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
          html, body, * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Apple SD Gothic Neo', Inter, system-ui, sans-serif !important; }
        `);
      } catch (_) {}
      try {
        await child.webContents.executeJavaScript(`(function(){ if(!document.getElementById('ku-helper-bar')){ window.__kuSessionBarInjected = false; } })();`);
      } catch (_) {}
    }
  });

  // 페이지 로드 완료 후에도 자동 로그인 시도
  child.webContents.on('did-finish-load', async () => {
    const url = child.webContents.getURL();
    if (/mylms\.korea\.ac\.kr|lms\.korea\.ac\.kr|sso\.korea\.ac\.kr/.test(url)) {
      console.log('LMS 페이지 완전 로드 완료, 자동 로그인 재시도');
      setTimeout(() => { tryLMSAutoLogin(); }, 500);
    }
  });

  child.webContents.on('did-navigate-in-page', async (_e, url) => {
    if (/mylms\.korea\.ac\.kr|lms\.korea\.ac\.kr|sso\.korea\.ac\.kr/.test(url)) {
      setTimeout(() => { tryLMSAutoLogin(); }, 200);
    }
  });

  child.webContents.on('did-redirect-navigation', (_e, url) => {
    if (/mylms\.korea\.ac\.kr|lms\.korea\.ac\.kr|sso\.korea\.ac\.kr/.test(url)) {
      setTimeout(() => { tryLMSAutoLogin(); }, 200);
    }
  });

  // 네트워크 에러/빈 페이지 방어 재시도
  child.webContents.on('did-fail-load', () => {
    child.loadURL(lmsLoginUrl);
  });
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
}); // end of app.on('ready')

// 앱 실행 중 최초 1회만 로딩 화면을 보여주기 위한 플래그
let hasShownBootScreen = false;

function createWindow() {
  const win = new BrowserWindow({
    width: 920,
    height: 620,
    resizable: false,
    fullscreenable: false,
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


