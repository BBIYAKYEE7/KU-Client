const https = require('https');
const { app, dialog, shell } = require('electron');
const path = require('path');

class AutoUpdater {
  constructor() {
    this.currentVersion = app.getVersion();
    this.repoOwner = 'BBIYAKYEE7';
    this.repoName = 'Korea-University-Launcher';
    this.githubApiUrl = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`;
    this.releaseUrl = 'https://github.com/BBIYAKYEE7/Korea-University-Launcher/releases/latest';
    this.userSelectedArch = null; // 사용자가 선택한 아키텍처 (우선 적용)
  }

  // GitHub API에서 최신 릴리즈 정보 가져오기
  async checkForUpdates() {
    try {
      console.log('업데이트 확인 중...');
      console.log('현재 버전:', this.currentVersion);
      
      const releaseInfo = await this.fetchLatestRelease();
      
      if (!releaseInfo) {
        console.log('릴리즈 정보를 가져올 수 없습니다.');
        return null;
      }

      console.log('최신 릴리즈 정보:', releaseInfo);
      console.log('릴리즈 태그:', releaseInfo.tag_name);
      
      const latestVersion = releaseInfo.tag_name.replace('v', '');
      console.log('정리된 최신 버전:', latestVersion);
      
      const isNewer = this.compareVersions(latestVersion, this.currentVersion);
      
      if (isNewer) {
        console.log('새로운 버전이 발견되었습니다:', latestVersion);
        return {
          version: latestVersion,
          releaseNotes: releaseInfo.body,
          downloadUrl: releaseInfo.html_url,
          assets: releaseInfo.assets
        };
      } else {
        console.log('최신 버전입니다. 업데이트가 필요하지 않습니다.');
        return null;
      }
    } catch (error) {
      console.error('업데이트 확인 중 오류:', error);
      return null;
    }
  }

  // GitHub API 호출
  fetchLatestRelease() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${this.repoOwner}/${this.repoName}/releases/latest`,
        method: 'GET',
        headers: {
          'User-Agent': 'Korea-University-Launcher-AutoUpdater/1.0.0',
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
            if (res.statusCode === 200) {
              const releaseInfo = JSON.parse(data);
              resolve(releaseInfo);
            } else {
              console.error('GitHub API 오류:', res.statusCode, data);
              reject(new Error(`GitHub API 오류: ${res.statusCode}`));
            }
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

  // 버전 비교 함수
  compareVersions(version1, version2) {
    // 버전 문자열 정리 (v 접두사 제거, 공백 제거)
    const cleanVersion1 = version1.replace(/^v/, '').trim();
    const cleanVersion2 = version2.replace(/^v/, '').trim();
    
    const v1Parts = cleanVersion1.split('.').map(Number);
    const v2Parts = cleanVersion2.split('.').map(Number);
    
    console.log(`버전 비교: ${cleanVersion1} vs ${cleanVersion2}`);
    console.log(`파싱된 버전: [${v1Parts.join(', ')}] vs [${v2Parts.join(', ')}]`);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1 = v1Parts[i] || 0;
      const v2 = v2Parts[i] || 0;
      
      if (v1 > v2) {
        console.log(`버전 ${cleanVersion1}이 ${cleanVersion2}보다 최신입니다.`);
        return true;
      }
      if (v1 < v2) {
        console.log(`버전 ${cleanVersion1}이 ${cleanVersion2}보다 이전입니다.`);
        return false;
      }
    }
    
    console.log(`버전이 동일합니다: ${cleanVersion1}`);
    return false; // 동일한 버전
  }

  // 업데이트 다이얼로그 표시
  async showUpdateDialog(updateInfo) {
    const options = {
      type: 'info',
      title: '새로운 버전이 있습니다!',
      message: `KU Client v${updateInfo.version}이(가) 출시되었습니다.`,
      detail: `현재 버전: v${this.currentVersion}\n최신 버전: v${updateInfo.version}\n\n${updateInfo.releaseNotes || '새로운 기능과 개선사항이 포함되었습니다.'}`,
      buttons: ['업데이트 (아키텍처 선택)', '수동 다운로드', '나중에', '업데이트 확인 안함'],
      defaultId: 0,
      cancelId: 2,
      icon: path.join(__dirname, 'image', 'logo(w).png')
    };

    const result = await dialog.showMessageBox(options);
    
    switch (result.response) {
      case 0: // 업데이트 (아키텍처 선택)
        await this.promptArchitectureAndUpdate(updateInfo);
        break;
      case 1: // 수동 다운로드
        this.manualDownload(updateInfo);
        break;
      case 2: // 나중에
        // 아무것도 하지 않음
        break;
      case 3: // 업데이트 확인 안함
        this.disableUpdateCheck();
        break;
    }
  }

  // 아키텍처 선택 다이얼로그 + 가이드 제공 후 다운로드 진행
  async promptArchitectureAndUpdate(updateInfo) {
    try {
      const platform = process.platform; // 'win32' | 'darwin' | 'linux'
      let archChoices = [];
      let defaultId = 0;
      let helpText = '';

      if (platform === 'win32') {
        archChoices = ['x64 (가장 흔함)', 'x86 (32-bit)', 'arm64'];
        defaultId = 0;
        helpText = '윈도우에서 내 아키텍처 확인: 설정 → 시스템 → 정보 → 시스템 종류에서 x64/x86/ARM 확인';
      } else if (platform === 'darwin') {
        archChoices = ['arm64 (Apple Silicon)', 'x64 (Intel)'];
        // 2020-06 이후 Mac은 대부분 ARM(Apple Silicon) 권장
        defaultId = 0;
        helpText = 'Mac 아키텍처 확인: 좌상단  → 이 Mac에 관하여 → 칩(Apple M1/M2 등은 arm64), 그 외 Intel은 x64';
      } else if (platform === 'linux') {
        archChoices = ['x64 (amd64)', 'arm64 (aarch64)'];
        defaultId = 0;
        helpText = '리눅스 아키텍처 확인: 터미널에서 "uname -m" 실행 → x86_64면 x64, aarch64면 arm64';
      } else {
        archChoices = ['x64', 'arm64'];
        defaultId = 0;
      }

      const sel = await dialog.showMessageBox({
        type: 'question',
        title: '아키텍처 선택',
        message: '설치할 아키텍처를 선택하세요.',
        detail: helpText,
        buttons: archChoices.concat(['취소']),
        defaultId: defaultId,
        cancelId: archChoices.length,
        icon: path.join(__dirname, 'image', 'logo(w).png')
      });

      if (sel.response === archChoices.length) {
        return; // 취소
      }

      const chosen = archChoices[sel.response];
      this.userSelectedArch = this.normalizeArchChoice(chosen);
      await this.downloadUpdate(updateInfo);
    } catch (e) {
      console.error('아키텍처 선택/업데이트 오류:', e);
    }
  }

  normalizeArchChoice(choice) {
    const c = String(choice || '').toLowerCase();
    if (c.includes('arm')) return 'arm64';
    if (c.includes('86') && !c.includes('64')) return 'ia32';
    return 'x64';
  }
  
  // 수동 다운로드 (브라우저에서)
  manualDownload(updateInfo) {
    console.log('수동 다운로드 시작...');
    
    // 플랫폼/아키텍처에 맞는 인스톨러 선택
    const asset = this.getInstallerAsset(updateInfo.assets);
    const downloadUrl = asset ? asset.browser_download_url : updateInfo.downloadUrl;
    
    // 브라우저에서 다운로드 페이지 열기
    shell.openExternal(downloadUrl);
    
    // 사용자에게 알림
    dialog.showMessageBox({
      type: 'info',
      title: '다운로드 시작',
      message: '브라우저에서 다운로드가 시작됩니다.',
      detail: '다운로드가 완료되면 설치 파일을 실행하여 업데이트를 완료하세요.',
      buttons: ['확인']
    });
  }

  // 업데이트 다운로드
  async downloadUpdate(updateInfo) {
    console.log('업데이트 다운로드 시작...');
    
    try {
      // 플랫폼/아키텍처에 맞는 인스톨러 선택
      const asset = this.getInstallerAsset(updateInfo.assets);
      if (!asset) {
        throw new Error('해당 OS/아키텍처에 맞는 설치 파일을 찾을 수 없습니다.');
      }
      const downloadUrl = asset.browser_download_url;
      const fileName = asset.name;
      
      // 다운로드 진행률 표시
      await this.showDownloadProgress(downloadUrl, fileName);
      
    } catch (error) {
      console.error('업데이트 다운로드 오류:', error);
      
      // 오류 발생 시 브라우저에서 다운로드
      const downloadUrl = updateInfo.downloadUrl;
      shell.openExternal(downloadUrl);
      
      dialog.showMessageBox({
        type: 'warning',
        title: '자동 다운로드 실패',
        message: '자동 다운로드에 실패했습니다.',
        detail: '브라우저에서 다운로드 페이지가 열립니다. 수동으로 다운로드 후 설치해주세요.',
        buttons: ['확인']
      });
    }
  }

  // OS/아키텍처별 인스톨러 자산 선택
  getInstallerAsset(assets = []) {
    try {
      if (!Array.isArray(assets)) return null;
      const platform = process.platform; // 'win32' | 'darwin' | 'linux'
      const arch = this.userSelectedArch || process.arch; // 사용자 선택 우선
      const names = assets.map(a => (a && a.name) || '').filter(Boolean);
      console.log('릴리즈 자산 목록:', names.join(', '));

      const isMatchArch = (name) => {
        const n = name.toLowerCase();
        // arm64는 arm64 / aarch64 명시적으로만 매칭
        if (arch === 'arm64') return /(arm64|aarch64)/i.test(n);
        // 32비트는 64가 포함되지 않고, 32/ia32/x86/i386 키워드가 있는 경우만
        if (arch === 'ia32' || arch === 'x86') return /(ia32|x86|i386|32)/i.test(n) && !/64/.test(n);
        // 기본 x64: arm 계열 키워드가 포함된 경우는 제외
        const isExplicitX64 = /(x64|amd64)/i.test(n);
        const looksLikeGeneric64 = /64/.test(n) && !/(arm|aarch)/i.test(n);
        const hasNoArchHint = !/(arm|aarch|ia32|x86|i386|x64|amd64|32|64)/i.test(n);
        return isExplicitX64 || looksLikeGeneric64 || hasNoArchHint;
      };

      const hasNoArchHint = (name) => !/(arm|aarch|ia32|x86|i386|x64|amd64|32|64)/i.test(name.toLowerCase());
      const isOtherArch = (name) => {
        const n = name.toLowerCase();
        if (arch === 'arm64') return /(x64|amd64|ia32|x86|i386|32)/i.test(n);
        if (arch === 'ia32' || arch === 'x86') return /(x64|amd64|arm|aarch|arm64)/i.test(n);
        // x64 기본
        return /(arm|aarch|arm64)/i.test(n) || (/(ia32|x86|i386|32)/i.test(n) && !/64/.test(n));
      };

      // 플랫폼별 확장자/키워드
      const pickBy = (predicate) => assets.find(a => a && a.name && predicate(a.name)) || null;
      const pickSafe = (predicate) => assets.find(a => a && a.name && predicate(a.name) && !isOtherArch(a.name)) || null;

      if (platform === 'win32') {
        // 우선순위: exe(nsis) -> msi, 항상 현재 아키텍처 또는 아키텍처 미표기만 허용
        let found = pickSafe((n) => /\.exe$/i.test(n) && isMatchArch(n));
        if (!found) found = pickSafe((n) => /\.msi$/i.test(n) && isMatchArch(n));
        if (!found) found = pickSafe((n) => /\.exe$/i.test(n) && hasNoArchHint(n));
        if (!found) found = pickSafe((n) => /\.msi$/i.test(n) && hasNoArchHint(n));
        return found || null;
      }

      if (platform === 'darwin') {
        // 우선순위: dmg -> zip, 현재 아키텍처 우선, 다음은 아키텍처 미표기
        let found = pickSafe((n) => /\.dmg$/i.test(n) && isMatchArch(n));
        if (!found) found = pickSafe((n) => /\.zip$/i.test(n) && /mac|darwin|osx|macos/i.test(n) && isMatchArch(n));
        if (!found) found = pickSafe((n) => /\.dmg$/i.test(n) && hasNoArchHint(n));
        if (!found) found = pickSafe((n) => /\.zip$/i.test(n) && /mac|darwin|osx|macos/i.test(n) && hasNoArchHint(n));
        return found || null;
      }

      if (platform === 'linux') {
        // 우선순위: deb -> AppImage -> rpm, 현재 아키텍처 우선, 다음은 아키텍처 미표기
        let found = pickSafe((n) => /\.deb$/i.test(n) && isMatchArch(n));
        if (!found) found = pickSafe((n) => /AppImage$/i.test(n) && isMatchArch(n));
        if (!found) found = pickSafe((n) => /\.rpm$/i.test(n) && isMatchArch(n));
        if (!found) found = pickSafe((n) => /\.deb$/i.test(n) && hasNoArchHint(n));
        if (!found) found = pickSafe((n) => /AppImage$/i.test(n) && hasNoArchHint(n));
        if (!found) found = pickSafe((n) => /\.rpm$/i.test(n) && hasNoArchHint(n));
        return found || null;
      }

      return null;
    } catch (_) {
      return null;
    }
  }
  
  // 다운로드 진행률 표시 및 자동 설치
  async showDownloadProgress(downloadUrl, fileName) {
    const https = require('https');
    const http = require('http');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    const downloadPath = path.join(os.tmpdir(), fileName);
    
    return new Promise((resolve, reject) => {
      // 다운로드 진행률 다이얼로그 표시
      const progressDialog = dialog.showMessageBox({
        type: 'info',
        title: '업데이트 다운로드 중',
        message: '새로운 버전을 다운로드하고 있습니다...',
        detail: '잠시만 기다려주세요.',
        buttons: [],
        cancelId: -1
      });
      
      const file = fs.createWriteStream(downloadPath);
      let downloadedBytes = 0;
      let totalBytes = 0;

      const followRedirects = (url, redirectCount = 0) => {
        try {
          if (redirectCount > 5) {
            throw new Error('리다이렉트가 너무 많습니다.');
          }

          const parsed = new URL(url);
          const getter = parsed.protocol === 'https:' ? https : http;

          const req = getter.get({
            protocol: parsed.protocol,
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + (parsed.search || ''),
            headers: {
              'User-Agent': 'Korea-University-Launcher-AutoUpdater/1.0.0',
              'Accept': 'application/octet-stream'
            }
          }, (res) => {
            // 리다이렉트 처리
            if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode)) {
              const next = res.headers.location;
              if (!next) {
                file.close();
                fs.unlink(downloadPath, () => {});
                return reject(new Error('리다이렉트 위치를 찾을 수 없습니다.'));
              }
              res.resume();
              return followRedirects(new URL(next, url).toString(), redirectCount + 1);
            }

            if (res.statusCode && res.statusCode >= 400) {
              file.close();
              fs.unlink(downloadPath, () => {});
              return reject(new Error(`다운로드 실패: HTTP ${res.statusCode}`));
            }

            totalBytes = parseInt(res.headers['content-length'] || '0', 10) || 0;

            res.on('data', (chunk) => {
              downloadedBytes += chunk.length;
              if (totalBytes > 0) {
                const progress = Math.round((downloadedBytes / totalBytes) * 100);
                console.log(`다운로드 진행률: ${progress}%`);
              } else {
                console.log(`다운로드 중... ${Math.round(downloadedBytes / 1024)}KB`);
              }
            });

            res.pipe(file);

            file.on('finish', async () => {
              file.close();
              console.log('다운로드 완료:', downloadPath);
              try {
                await this.installUpdate(downloadPath);
                resolve();
              } catch (e) {
                reject(e);
              }
            });

            file.on('error', (error) => {
              fs.unlink(downloadPath, () => {});
              reject(error);
            });
          });

          req.on('error', (err) => {
            fs.unlink(downloadPath, () => {});
            reject(err);
          });
        } catch (e) {
          fs.unlink(downloadPath, () => {});
          reject(e);
        }
      };

      followRedirects(downloadUrl);
    });
  }
  
  // 업데이트 자동 설치
  async installUpdate(installerPath) {
    try {
      console.log('업데이트 설치 시작:', installerPath);
      
      // 설치 전 사용자에게 알림
      const result = await dialog.showMessageBox({
        type: 'question',
        title: '업데이트 설치',
        message: '다운로드가 완료되었습니다.',
        detail: '지금 업데이트를 설치하시겠습니까? 설치 중에는 앱이 종료됩니다.',
        buttons: ['지금 설치', '나중에'],
        defaultId: 0,
        cancelId: 1
      });
      
      if (result.response === 0) {
        const { exec } = require('child_process');
        const platform = process.platform;
        const pathModule = require('path');
        const ext = pathModule.extname(installerPath).toLowerCase();
        
        // 우선 OS 기본 핸들러로 열기 (가장 호환성 좋음)
        try {
          const opened = await shell.openPath(installerPath);
          if (!opened) {
            // openPath가 성공적으로 핸들링한 경우 빈 문자열을 반환함
            console.log('OS 기본 핸들러로 설치 파일을 열었습니다.');
            setTimeout(() => app.quit(), 2000);
            return;
          }
          // opened가 비어있지 않으면 에러 메시지 문자열
          console.warn('openPath 경고/오류:', opened);
        } catch (e) {
          console.warn('openPath 실패, 대체 경로 시도:', e);
        }
        
        // 대체 경로: 플랫폼별 실행
        if (platform === 'win32') {
          exec(`start "" "${installerPath}"`, { shell: true }, (error) => {
            if (error) {
              console.error('Windows 설치 실행 오류:', error);
              dialog.showErrorBox('설치 오류', '설치 프로그램을 실행하지 못했습니다. 다운로드 폴더에서 수동으로 실행해 주세요.');
              return;
            }
            setTimeout(() => app.quit(), 2000);
          });
          return;
        }
        
        if (platform === 'darwin') {
          // dmg/zip 모두 Finder로 열기 시도
          exec(`open "${installerPath}"`, (error) => {
            if (error) {
              console.error('macOS 설치 실행 오류:', error);
              dialog.showErrorBox('설치 안내', '디스크 이미지 또는 압축 파일을 Finder에서 수동으로 열어 설치해 주세요.');
              return;
            }
            setTimeout(() => app.quit(), 2000);
          });
          return;
        }
        
        if (platform === 'linux') {
          // 배포판마다 다름: 파일 열기 우선 시도
          exec(`xdg-open "${installerPath}"`, (error) => {
            if (error) {
              console.error('Linux 설치 실행 오류:', error);
              dialog.showMessageBox({
                type: 'info',
                title: '설치 안내',
                message: '리눅스 설치 안내',
                detail: '다운로드된 파일을 더블클릭하여 설치 관리자로 열어 설치해 주세요. (예: .deb는 소프트웨어 설치로 열기)\n루트 권한이 필요한 경우 관리자 비밀번호가 요구될 수 있습니다.',
                buttons: ['확인']
              });
              return;
            }
            setTimeout(() => app.quit(), 2000);
          });
          return;
        }
      } else {
        // 나중에 설치 선택 시 임시 파일 정리
        const fs = require('fs');
        fs.unlink(installerPath, (err) => {
          if (err) console.error('임시 파일 삭제 오류:', err);
        });
        
        dialog.showMessageBox({
          type: 'info',
          title: '설치 연기',
          message: '설치가 연기되었습니다.',
          detail: '언제든지 업데이트 버튼을 눌러 다시 설치할 수 있습니다.',
          buttons: ['확인']
        });
      }
      
    } catch (error) {
      console.error('업데이트 설치 오류:', error);
      dialog.showErrorBox('설치 오류', '업데이트 설치 중 오류가 발생했습니다.');
    }
  }

  // 업데이트 확인 비활성화
  disableUpdateCheck() {
    // 설정에 업데이트 확인 비활성화 플래그 저장
    try {
      const config = require('./config');
      const currentConfig = config.loadConfig();
      currentConfig.disableUpdateCheck = true;
      config.saveConfig(currentConfig);
      
      dialog.showMessageBox({
        type: 'info',
        title: '업데이트 확인 비활성화',
        message: '자동 업데이트 확인이 비활성화되었습니다.',
        detail: '설정에서 언제든지 다시 활성화할 수 있습니다.',
        buttons: ['확인']
      });
    } catch (error) {
      console.error('업데이트 확인 비활성화 중 오류:', error);
    }
  }

  // 업데이트 확인 활성화
  enableUpdateCheck() {
    try {
      const config = require('./config');
      const currentConfig = config.loadConfig();
      currentConfig.disableUpdateCheck = false;
      config.saveConfig(currentConfig);
      
      dialog.showMessageBox({
        type: 'info',
        title: '업데이트 확인 활성화',
        message: '자동 업데이트 확인이 활성화되었습니다.',
        detail: '앱을 재시작하면 업데이트 확인이 시작됩니다.',
        buttons: ['확인']
      });
    } catch (error) {
      console.error('업데이트 확인 활성화 중 오류:', error);
    }
  }

  // 수동 업데이트 확인
  async checkForUpdatesManually() {
    const updateInfo = await this.checkForUpdates();
    
    if (updateInfo) {
      await this.showUpdateDialog(updateInfo);
    } else {
      dialog.showMessageBox({
        type: 'info',
        title: '업데이트 확인',
        message: '최신 버전입니다!',
        detail: `현재 버전 v${this.currentVersion}이(가) 최신 버전입니다.`,
        buttons: ['확인']
      });
    }
  }

  // 자동 업데이트 확인 시작
  startAutoUpdateCheck() {
    // 설정에서 업데이트 확인 비활성화 여부 확인
    try {
      const config = require('./config');
      const currentConfig = config.loadConfig();
      
      if (currentConfig && currentConfig.disableUpdateCheck) {
        console.log('자동 업데이트 확인이 비활성화되어 있습니다.');
        return;
      }
    } catch (error) {
      console.error('설정 로드 중 오류:', error);
    }

    // 30초 후 첫 번째 업데이트 확인
    setTimeout(async () => {
      const updateInfo = await this.checkForUpdates();
      if (updateInfo) {
        // 자동 업데이트가 활성화되어 있으면 자동으로 업데이트
        if (this.isAutoUpdateEnabled()) {
          console.log('자동 업데이트가 활성화되어 있습니다. 자동으로 업데이트를 시작합니다.');
          await this.downloadUpdate(updateInfo);
        } else {
          await this.showUpdateDialog(updateInfo);
        }
      }
    }, 30000);

    // 이후 24시간마다 업데이트 확인
    setInterval(async () => {
      const updateInfo = await this.checkForUpdates();
      if (updateInfo) {
        // 자동 업데이트가 활성화되어 있으면 자동으로 업데이트
        if (this.isAutoUpdateEnabled()) {
          console.log('자동 업데이트가 활성화되어 있습니다. 자동으로 업데이트를 시작합니다.');
          await this.downloadUpdate(updateInfo);
        } else {
          await this.showUpdateDialog(updateInfo);
        }
      }
    }, 24 * 60 * 60 * 1000); // 24시간
  }
  
  // 자동 업데이트 활성화 여부 확인
  isAutoUpdateEnabled() {
    try {
      const config = require('./config');
      const currentConfig = config.loadConfig();
      return currentConfig && currentConfig.autoUpdate === true;
    } catch (error) {
      console.error('자동 업데이트 설정 확인 중 오류:', error);
      return false;
    }
  }
  
  // 자동 업데이트 활성화
  enableAutoUpdate() {
    try {
      const config = require('./config');
      const currentConfig = config.loadConfig();
      currentConfig.autoUpdate = true;
      config.saveConfig(currentConfig);
      
      dialog.showMessageBox({
        type: 'info',
        title: '자동 업데이트 활성화',
        message: '자동 업데이트가 활성화되었습니다.',
        detail: '새로운 버전이 발견되면 자동으로 다운로드하고 설치됩니다.',
        buttons: ['확인']
      });
    } catch (error) {
      console.error('자동 업데이트 활성화 중 오류:', error);
    }
  }
  
  // 자동 업데이트 비활성화
  disableAutoUpdate() {
    try {
      const config = require('./config');
      const currentConfig = config.loadConfig();
      currentConfig.autoUpdate = false;
      config.saveConfig(currentConfig);
      
      dialog.showMessageBox({
        type: 'info',
        title: '자동 업데이트 비활성화',
        message: '자동 업데이트가 비활성화되었습니다.',
        detail: '새로운 버전이 발견되면 알림만 표시됩니다.',
        buttons: ['확인']
      });
    } catch (error) {
      console.error('자동 업데이트 비활성화 중 오류:', error);
    }
  }
}

module.exports = AutoUpdater;
