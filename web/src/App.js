import React from 'react';
import './App.css';
//import { Analytics } from '@vercel/analytics/react';

const RELEASE_URL = 'https://github.com/BBIYAKYEE7/Korea-University-Launcher/releases/latest';

async function fetchLatestAssets(platform) {
  try {
    const res = await fetch('https://api.github.com/repos/BBIYAKYEE7/Korea-University-Launcher/releases/latest', { headers: { 'Accept': 'application/vnd.github+json' } });
    if (!res.ok) throw new Error('Failed to fetch releases');
    const data = await res.json();
    
    const assets = data.assets || [];
    const platformAssets = [];
    
    if (platform === 'windows') {
      // Windows 에셋들 찾기 (유니버셜)
      assets.forEach(asset => {
        if (/windows|\.exe$/i.test(asset.name) && !/mac|linux/i.test(asset.name)) {
          if (/universal/i.test(asset.name)) {
            platformAssets.push({ name: 'Windows Universal', url: asset.browser_download_url, filename: asset.name });
          } else {
            platformAssets.push({ name: 'Windows', url: asset.browser_download_url, filename: asset.name });
          }
        }
      });
    } else if (platform === 'mac') {
      // macOS 에셋들 찾기 (유니버셜)
      assets.forEach(asset => {
        if (/mac|\.dmg$|\.pkg$/i.test(asset.name) && !/windows|linux/i.test(asset.name)) {
          if (/universal/i.test(asset.name)) {
            platformAssets.push({ name: 'macOS Universal', url: asset.browser_download_url, filename: asset.name });
          } else {
            platformAssets.push({ name: 'macOS', url: asset.browser_download_url, filename: asset.name });
          }
        }
      });
    } else if (platform === 'linux') {
      // Linux 에셋들 찾기 (유니버셜)
      assets.forEach(asset => {
        if (/linux|\.AppImage$|\.deb$|\.rpm$/i.test(asset.name) && !/windows|mac/i.test(asset.name)) {
          if (/universal/i.test(asset.name)) {
            platformAssets.push({ name: 'Linux Universal', url: asset.browser_download_url, filename: asset.name });
          } else {
            platformAssets.push({ name: 'Linux', url: asset.browser_download_url, filename: asset.name });
          }
        }
      });
    }
    
    return platformAssets.length > 0 ? platformAssets : [{ name: 'GitHub Releases', url: RELEASE_URL, filename: 'releases' }];
  } catch (e) {
    return [{ name: 'GitHub Releases', url: RELEASE_URL, filename: 'releases' }];
  }
}

async function fetchLatestAssetUrl(platform) {
  const assets = await fetchLatestAssets(platform);
  return assets[0]?.url || RELEASE_URL;
}

function detectOS() {
  const ua = navigator.userAgent;
  if (/Windows NT/i.test(ua)) return 'windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'mac';
  if (/Linux/i.test(ua)) return 'linux';
  return 'unknown';
}

function App() {
  const os = detectOS();
  const primaryText = os === 'mac' ? 'macOS용 다운로드' : os === 'windows' ? 'Windows용 다운로드' : os === 'linux' ? 'Linux용 다운로드' : '최신 버전 보기';
  const storedTheme = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
  const [showModal, setShowModal] = React.useState(false);
  const [isClosing, setIsClosing] = React.useState(false);
  const [modalAssets, setModalAssets] = React.useState([]);
  const [modalPlatform, setModalPlatform] = React.useState('');
  const [showInstallGuide, setShowInstallGuide] = React.useState(false);
  const [installGuidePlatform, setInstallGuidePlatform] = React.useState('');
  const [currentTheme, setCurrentTheme] = React.useState(storedTheme || 'dark');
  
  React.useEffect(() => {
    if (storedTheme) {
      document.documentElement.setAttribute('data-theme', storedTheme);
      setCurrentTheme(storedTheme);
      // 초기 로드 시에도 올바른 로고 설정
      const heroImage = document.querySelector('.hero-image');
      if (heroImage) {
        heroImage.src = storedTheme === 'light' ? '/images/logo(w).png' : '/images/logo(b).png';
      }
    }
  }, [storedTheme]);
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    if (current === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
      setCurrentTheme('light');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'dark');
      setCurrentTheme('dark');
    }
    // 메인 로고 교체
    const heroImage = document.querySelector('.hero-image');
    const themeNow = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    if (heroImage) {
      heroImage.src = themeNow === 'light' ? '/images/logo(w).png' : '/images/logo(b).png';
    }
    // 아이콘 교체 (라이트 모드에서 120주년 아이콘으로)
    const badge = document.querySelector('.footer-badge');
    if (badge) {
      badge.src = themeNow === 'light' ? '/images/kuni120-1-hd.png' : '/images/kuni120-2.png';
    }
  }
  async function handleWindowsClick(e) {
    e.preventDefault();
    setInstallGuidePlatform('windows');
    setShowInstallGuide(true);
  }
  
  async function handleMacClick(e) {
    e.preventDefault();
    setInstallGuidePlatform('mac');
    setShowInstallGuide(true);
  }
  
  async function handleLinuxClick(e) {
    e.preventDefault();
    setInstallGuidePlatform('linux');
    setShowInstallGuide(true);
  }
  
  async function showArchitectureSelector(platform) {
    const assets = await fetchLatestAssets(platform);
    
    if (assets.length === 1 && assets[0].filename === 'releases') {
      // 에셋을 찾지 못한 경우 GitHub Releases로 이동
      window.location.href = assets[0].url;
      return;
    }
    
    if (assets.length === 1) {
      // 에셋이 하나만 있는 경우 바로 다운로드
      window.location.href = assets[0].url;
      return;
    }
    
    // 여러 아키텍처가 있는 경우 모달 표시
    setModalAssets(assets);
    setModalPlatform(platform);
    setShowModal(true);
  }

  function handleAssetSelect(url) {
    window.location.href = url;
    setShowModal(false);
  }

  function closeModal() {
    setIsClosing(true);
    setTimeout(() => {
      setShowModal(false);
      setIsClosing(false);
    }, 300); // 애니메이션 지속 시간과 동일하게 설정
  }

  function closeInstallGuide() {
    setShowInstallGuide(false);
  }

  async function handlePrimaryClick(e) {
    e.preventDefault();
    if (os === 'windows') {
      setInstallGuidePlatform('windows');
      setShowInstallGuide(true);
    } else if (os === 'mac') {
      setInstallGuidePlatform('mac');
      setShowInstallGuide(true);
    } else if (os === 'linux') {
      setInstallGuidePlatform('linux');
      setShowInstallGuide(true);
    } else {
      alert('지원되지 않는 운영체제입니다. Windows, macOS, Linux 버전을 제공합니다.');
    }
  }

  return (
    <div className="theme-transition">
      <header className="header glass" role="banner">
        <div className="container header-inner">
          <a className="brand" href="#top" aria-label="KUPID 홈">
            <img className="brand-logo-wide" src="/images/kulogo(r).png" alt="고려대로고" width="125" height="36"/>
          </a>
          
          <nav className="nav">
            <a href="#features">기능</a>
            <a href="#download">다운로드</a>
            <a href="#faq">FAQ</a>
          </nav>
          
          {/* 테마변경 버튼 */}
          <a className="btn" href="#" onClick={(e)=>{e.preventDefault();toggleTheme();}} aria-label="테마 전환">테마 전환</a>
        </div>
      </header>

      <main id="top" className="main" role="main">
        <section className="container hero" aria-labelledby="hero-title">
          <div>
            <h1 id="hero-title">KU Client</h1>
            <p className="subtitle">고려대학교 통합 클라이언트 - KUPID, LMS를 하나의 앱에서</p>
            <p className="notice">⚠️ 이 프로젝트는 고려대학교의 공식 프로젝트가 아닙니다. 개인 개발자가 만든 비공식 앱입니다.</p>
            <div className="cta">
              <a className="btn btn-primary" href="#" onClick={handlePrimaryClick} aria-describedby="primary-desc">{primaryText}</a>
              <p id="primary-desc" className="vh">접속한 운영체제를 자동으로 감지하여 올바른 설치 파일을 안내합니다.</p>
              <a className="btn btn-ghost" href="#features">자세히 보기</a>
            </div>
          </div>
          <div>
            <img className="hero-image hero-image--wide" src={currentTheme === 'light' ? "/images/logo(w).png" : "/images/logo(b).png"} alt="고려대학교 엠블럼" />
          </div>
        </section>

        <section id="features" className="section container" aria-labelledby="feature-title">
          <h2 id="feature-title">주요 기능</h2>
          <ul className="features">
            <li className="glass">
              <h3>통합 관리</h3>
              <p>KUPID, LMS, 수강신청 등 고려대학교의 모든 서비스를 하나의 앱에서 관리합니다.</p>
            </li>
            <li className="glass">
              <h3>원클릭 실행</h3>
              <p>복잡한 로그인 과정 없이 원하는 서비스에 바로 접근할 수 있습니다.</p>
            </li>
            <li className="glass">
              <h3>자동 업데이트</h3>
              <p>GitHub Releases를 통해 최신 버전을 손쉽게 유지합니다.</p>
            </li>
            <li className="glass">
              <h3>크로스 플랫폼</h3>
              <p>Windows, macOS, Linux에서 동일한 경험을 제공합니다.</p>
            </li>
          </ul>
        </section>

        <section id="download" className="section section-alt" aria-labelledby="download-title">
          <div className="container">
            <h2 id="download-title">다운로드</h2>
            <p className="muted">아래에서 운영체제에 맞는 설치 파일을 선택하세요. 아키텍처별로 다운로드할 수 있습니다.</p>
            <div className="download">
              <a className="card glass" href="#" onClick={handleMacClick} aria-label="macOS용 다운로드">
                <div className="card-body">
                  <span className="os">macOS</span>
                  <span className="hint">Universal (Apple Silicon / Intel)</span>
                </div>
              </a>
              <a className="card glass" href="#" onClick={handleWindowsClick} aria-label="Windows용 다운로드">
                <div className="card-body">
                  <span className="os">Windows</span>
                  <span className="hint">Universal (x64 / ARM64)</span>
                </div>
              </a>
              <a className="card glass" href="#" onClick={handleLinuxClick} aria-label="Linux용 다운로드">
                <div className="card-body">
                  <span className="os">Linux</span>
                  <span className="hint">Universal / DEB</span>
                </div>
              </a>
            </div>
            <p className="tiny">최신 릴리즈는 GitHub에서 제공됩니다. 다운로드가 시작되지 않으면 릴리즈 페이지에서 수동으로 선택하세요.</p>
          </div>
        </section>

        <section id="security" className="section section-alt" aria-labelledby="security-title">
          <div className="container">
            <h2 id="security-title">⚠️ 보안 경고 해결 방법</h2>
            <p className="muted">코드 서명이 되어있지 않아 다운로드 시 보안 경고가 나타날 수 있습니다. 아래 방법을 따라 안전하게 설치하세요.</p>
            
            <div className="security-guide">
              <div className="glass">
                <h3>🪟 Windows</h3>
                <div className="security-steps">
                  <div className="step">
                    <h4>1. SmartScreen 경고</h4>
                    <p>다운로드 후 실행 시 "Windows에서 PC를 보호했습니다" 경고가 나타납니다.</p>
                    <p><strong>해결법:</strong> "추가 정보" → "실행" 버튼을 클릭하세요.</p>
                  </div>
                  <div className="step">
                    <h4>2. 바이러스 백신 경고</h4>
                    <p>일부 백신 프로그램에서 위험한 파일로 인식할 수 있습니다.</p>
                    <p><strong>해결법:</strong> 백신 프로그램에서 예외 처리하거나 일시적으로 비활성화하세요.</p>
                  </div>
                  <div className="step">
                    <h4>3. 대안 방법</h4>
                    <p>여전히 문제가 있다면:</p>
                    <ul>
                      <li>Windows Defender에서 실시간 보호를 일시적으로 끄기</li>
                      <li>파일을 우클릭 → "속성" → "차단 해제" 체크</li>
                      <li>관리자 권한으로 실행</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="glass">
                <h3>🍎 macOS</h3>
                <div className="security-steps">
                  <div className="step">
                    <h4>1. Gatekeeper 경고</h4>
                    <p>"개발자를 확인할 수 없습니다" 경고가 나타납니다.</p>
                    <p><strong>해결법:</strong> "확인" → 시스템 환경설정 → 보안 및 개인 정보 보호 → "확인 없이 열기"</p>
                  </div>
                  <div className="step">
                    <h4>2. 터미널을 통한 설치</h4>
                    <p>터미널에서 다음 명령어를 실행하세요:</p>
                    <code>sudo xattr -rd com.apple.quarantine /Applications/KU\ Client.app</code>
                  </div>
                  <div className="step">
                    <h4>3. 대안 방법</h4>
                    <p>여전히 문제가 있다면:</p>
                    <ul>
                      <li>시스템 환경설정 → 보안 및 개인 정보 보호 → "모든 곳에서 허용"</li>
                      <li>앱을 우클릭 → "열기" 선택</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="glass">
                <h3>🐧 Linux</h3>
                <div className="security-steps">
                  <div className="step">
                    <h4>1. 실행 권한</h4>
                    <p>다운로드 후 실행 권한이 없을 수 있습니다.</p>
                    <p><strong>해결법:</strong> 터미널에서 <code>chmod +x KU-Client-linux-universal.deb</code></p>
                  </div>
                  <div className="step">
                    <h4>2. DEB 패키지 설치</h4>
                    <p>Ubuntu/Debian 계열:</p>
                    <code>sudo dpkg -i KU-Client-linux-universal.deb</code>
                    <p>의존성 문제 시:</p>
                    <code>sudo apt-get install -f</code>
                  </div>
                  <div className="step">
                    <h4>3. AppImage 실행</h4>
                    <p>AppImage 파일의 경우:</p>
                    <code>chmod +x KU-Client-linux-universal.AppImage</code><br/>
                    <code>./KU-Client-linux-universal.AppImage</code>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="security-notice">
              <p><strong>💡 참고사항:</strong> 이 앱은 오픈소스이며 GitHub에서 소스코드를 확인할 수 있습니다. 코드 서명 비용이 높아 현재 적용하지 못했지만, 앱 자체는 안전합니다.</p>
            </div>
          </div>
        </section>

        <section id="faq" className="section container" aria-labelledby="faq-title">
          <h2 id="faq-title">자주 묻는 질문</h2>
          <details>
            <summary>실행 시 보안 경고가 나와요.</summary>
            <p>코드 서명이 되어있지 않아 발생하는 정상적인 현상입니다. 위의 "보안 경고 해결 방법" 섹션을 참고하여 OS별 해결법을 따라주세요. 앱 자체는 안전하며 오픈소스로 공개되어 있습니다.</p>
          </details>
          <details>
            <summary>어떤 서비스들을 통합 관리할 수 있나요?</summary>
            <p>현재 KUPID(고려대학교 포털), LMS(학습관리시스템)을 통합 관리할 수 있습니다. 각 서비스는 런처에서 실행되며, 런처에서 원클릭으로 접근할 수 있습니다. 추후에는 수강신청 서비스도 추가할 예정입니다.</p>
          </details>
          <details>
            <summary>자동 업데이트는 어떻게 작동하나요?</summary>
            <p>앱은 주기적으로 GitHub Releases를 확인하여 새 버전을 안내합니다. 설정에서 자동/수동을 선택할 수 있습니다.</p>
          </details>
          <details>
            <summary>모든 서비스가 갑자기 접속이 안돼요!</summary>
              <p>본 서비스는 개인 개발자가 고려대학교에서 제공하는 웹사이트를 앱으로 만든것으로 고려대학교 서버가 다운되면 앱을 통한 접속도 어렵습니다.</p>
          </details>
          <details>
            <summary>앱이 정상적으로 작동하지 않아요.</summary>
            <p>다음 사항을 확인해보세요:</p>
            <ul>
              <li>인터넷 연결 상태 확인</li>
              <li>고려대학교 서버 상태 확인</li>
              <li>앱을 관리자 권한으로 실행</li>
              <li>최신 버전으로 업데이트</li>
              <li>방화벽이나 백신 프로그램의 차단 여부 확인</li>
            </ul>
          </details>
        </section>
      </main>

      <footer className="footer" role="contentinfo">
        <div className="container">
          <div className="footer-inner glass">
            <img className="footer-badge" src="/images/kuni120-2.png" alt="고려대학교 120주년 아이콘" width="24" height="24" />
            <h3 className="footer-brand">BBIYAKYEE7</h3>
            <p className="footer-sub">2025 © Copyright by BBIYAKYEE7, All rights reserved.</p>
            <p className="footer-sub">Made and serviced with React.js</p>
            <div className="footer-ctas">
              <a className="btn-footer" href="mailto:bbiyakyee7@gmail.com" aria-label="Email">✉️ 이메일</a>
              <a className="btn-footer" href="https://github.com/BBIYAKYEE7" target="_blank" rel="noopener noreferrer" aria-label="GitHub">🐙 GitHub</a>
              <a className="btn-footer" href="https://instagram.com/bbiyakyee7" target="_blank" rel="noopener noreferrer" aria-label="Instagram">📷 Instagram</a>
            </div>
          </div>
        </div>
      </footer>

      {/* 아키텍처 선택 모달 */}
      {showModal && (
        <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={closeModal}>
          <div className={`modal-content glass ${isClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>아키텍처 선택</h3>
              <button className="modal-close" onClick={closeModal} aria-label="닫기">×</button>
            </div>
            <div className="modal-body">
              <p>사용 가능한 {modalPlatform === 'windows' ? 'Windows' : modalPlatform === 'mac' ? 'macOS' : 'Linux'} 아키텍처를 선택하세요:</p>
              <div className="modal-assets">
                {modalAssets.map((asset, index) => (
                  <button
                    key={index}
                    className="modal-asset-btn"
                    onClick={() => handleAssetSelect(asset.url)}
                  >
                    <span className="asset-name">{asset.name}</span>
                    <span className="asset-filename">{asset.filename}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 간단한 설치 가이드 모달 */}
      {showInstallGuide && (
        <div className="modal-overlay" onClick={closeInstallGuide}>
          <div className="modal-content glass simple-install-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{installGuidePlatform === 'windows' ? '🪟 Windows' : installGuidePlatform === 'mac' ? '🍎 macOS' : '🐧 Linux'} 설치 안내</h3>
              <button className="modal-close" onClick={closeInstallGuide} aria-label="닫기">×</button>
            </div>
            <div className="modal-body">
              <div className="install-warning">
                <p>⚠️ 코드 서명이 되어있지 않아 보안 경고가 나타날 수 있습니다.</p>
                <p>앱은 안전하며 오픈소스로 공개되어 있습니다.</p>
              </div>
              
              <div className="install-steps">
                {installGuidePlatform === 'windows' && (
                  <div className="step">
                    <h4>Windows 설치 방법</h4>
                    <p>1. 다운로드 후 "추가 정보" → "실행" 클릭</p>
                    <p>2. 백신 프로그램에서 예외 처리</p>
                  </div>
                )}
                
                {installGuidePlatform === 'mac' && (
                  <div className="step">
                    <h4>macOS 설치 방법</h4>
                    <p>1. "확인" → 시스템 환경설정 → 보안 및 개인 정보 보호 → "확인 없이 열기"</p>
                    <p>2. 또는 터미널에서: <code>sudo xattr -rd com.apple.quarantine /Applications/KU\ Client.app</code></p>
                  </div>
                )}
                
                {installGuidePlatform === 'linux' && (
                  <div className="step">
                    <h4>Linux 설치 방법</h4>
                    <p>1. 실행 권한 부여: <code>chmod +x KU-Client-linux-universal.deb</code></p>
                    <p>2. 설치: <code>sudo dpkg -i KU-Client-linux-universal.deb</code></p>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button className="btn btn-primary" onClick={() => {
                  closeInstallGuide();
                  showArchitectureSelector(installGuidePlatform);
                }}>
                  다운로드 계속하기
                </button>
                <button className="btn btn-ghost" onClick={closeInstallGuide}>
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* <Analytics/> */}
    </div>
  );
}

export default App;