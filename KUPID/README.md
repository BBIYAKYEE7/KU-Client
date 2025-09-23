# KUPID - Korea University Portal to Information Depository

고려대학교 포털 자동 로그인 및 세션 관리 Electron 애플리케이션

## 🚀 주요 기능

- 🔐 **자동 로그인**: 고려대학교 포털 자동 로그인
- ⏰ **세션 관리**: 자동 세션 타임아웃 및 경고
- 🎨 **Pretendard 폰트**: 모든 페이지에 고려대학교 브랜드 폰트 적용
- 🔄 **자동 업데이트**: GitHub Releases를 통한 자동 업데이트
- 🖥️ **크로스 플랫폼**: macOS, Windows, Linux 지원

## 📦 설치 및 실행

### 개발 환경

```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm start
```

### 배포용 빌드

```bash
# macOS용 빌드
npm run build

# Windows용 빌드
npm run build:win

# Linux용 빌드
npm run build:linux
```

## 🔄 자동 업데이트 시스템

### GitHub API 기반 자동 업데이트

KUPID는 GitHub API를 사용하여 자동 업데이트를 제공합니다. Personal Access Token이 필요하지 않으며, 공개 API만으로 작동합니다.

### 업데이트 작동 방식

1. **자동 확인**: 앱 시작 시 GitHub Releases API를 통해 최신 버전 확인
2. **버전 비교**: 현재 버전과 최신 버전을 비교하여 업데이트 필요성 판단
3. **플랫폼별 다운로드**: macOS, Windows, Linux에 맞는 파일 자동 선택
4. **사용자 선택**: 업데이트 발견 시 사용자가 다운로드/설치 여부 선택

### GitHub Releases 설정

1. GitHub 저장소에서 "Releases" 탭으로 이동
2. "Create a new release" 클릭
3. 태그 버전 입력 (예: v1.1.0)
4. 릴리즈 노트 작성
5. 플랫폼별 파일 업로드:
   - macOS: `.dmg` 또는 `.zip` 파일
   - Windows: `.exe` 또는 `.msi` 파일
   - Linux: `.AppImage` 또는 `.deb` 파일
6. "Publish release" 클릭

### 수동 업데이트 확인

- 앱 내 상단 툴바의 "🔄 업데이트" 버튼 클릭
- 또는 앱 시작 시 자동으로 확인 (3초 후)

## 📁 프로젝트 구조

```
KUPID/
├── main.js              # Electron 메인 프로세스
├── renderer.js          # 렌더러 프로세스
├── preload.js           # 프리로드 스크립트
├── webview-preload.js   # 웹뷰 전용 프리로드 스크립트
├── config.js            # 설정 관리
├── index.html           # 메인 UI
├── styles.css           # 스타일시트
├── login-setup.html     # 로그인 설정 페이지
├── login-setup.js       # 로그인 설정 로직
├── login-setup.css      # 로그인 설정 스타일
├── fonts/               # Pretendard 폰트
├── images/              # 로고 및 이미지
└── dist/                # 빌드 출력
```

## 🛠️ 기술 스택

- **Electron**: 크로스 플랫폼 데스크톱 앱
- **electron-updater**: 자동 업데이트
- **node-notifier**: 데스크톱 알림
- **Pretendard**: 고려대학교 브랜드 폰트

## 📋 빌드 결과물

빌드가 완료되면 `dist` 폴더에 다음 파일들이 생성됩니다:

- `고려대학교 포털 1.1.0.exe` - Windows 포터블 버전
- `고려대학교 포털 Setup 1.1.0.exe` - Windows 설치 프로그램
- `win-unpacked/` - 압축 해제된 앱 파일들

## 🔧 개발 환경 설정

### 필수 요구사항

- Node.js 16.0.0 이상
- npm 8.0.0 이상
- Git

### 개발 모드

```bash
# 개발자 도구와 함께 실행
npm run dev

# 핫 리로드 활성화
npm run dev:watch
```

## 📝 라이선스

MIT License

## 🤝 기여

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🐛 지원

문제가 발생하거나 기능 요청이 있으시면 GitHub Issues를 통해 알려주세요.

## 📞 연락처

- GitHub: [@BBIYAKYEE7](https://github.com/BBIYAKYEE7)
- 이메일: bbiyakyee7@gmail.com

---

**KUPID Team** - 고려대학교 포털을 더 편리하게 만들어드립니다! 🎓
