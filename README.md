# 고려대학교 통합 런처 (Korea University Launcher)

고려대학교 학생들을 위한 통합 데스크톱 애플리케이션 모음입니다.

## 📦 포함된 애플리케이션

### 🏛️ KUPID (고려대학교 포털)
- 고려대학교 포털 시스템 통합 접근
- 자동 로그인 기능
- PDF 뷰어 내장
- 웹뷰 기반 인터페이스

### 📚 LMS (학습관리시스템)
- 고려대학교 LMS 시스템 접근
- 강의 자료 및 과제 관리
- 자동 로그인 지원

### 🎓 Sugang (수강신청)
- 수강신청 시스템 통합
- 실시간 수강신청 지원
- 오버레이 기능

### 🚀 Launcher (통합 런처)
- 모든 애플리케이션 통합 관리
- 원클릭 실행
- 자동 업데이트 지원

## 🛠️ 기술 스택

- **Electron**: 데스크톱 애플리케이션 프레임워크
- **Node.js**: 백엔드 런타임
- **HTML/CSS/JavaScript**: 프론트엔드
- **React**: 웹 인터페이스 (일부 앱)

## 📋 시스템 요구사항

- **운영체제**: Windows 10+, macOS 10.14+, Linux
- **Node.js**: 16.0.0 이상
- **메모리**: 최소 4GB RAM 권장
- **디스크**: 500MB 이상 여유 공간

## 🚀 설치 및 실행

### 1. 저장소 클론
```bash
git clone https://github.com/BBIYAKYEE7/Korea-University-Launcher.git
cd Korea-University-Launcher
```

### 2. 의존성 설치
```bash
# 각 애플리케이션별로 설치
cd KUPID && npm install
cd ../LMS && npm install
cd ../sugang && npm install
cd ../launcher && npm install
```

### 3. 애플리케이션 실행
```bash
# 런처 실행
cd launcher && npm start

# 개별 앱 실행
cd KUPID && npm start
cd LMS && npm start
cd sugang && npm start
```

## 📦 빌드 및 배포

### 개발용 빌드
```bash
npm run build
```

### 배포용 빌드
```bash
npm run dist
```

## 🔧 설정

각 애플리케이션의 `config.json` 파일에서 설정을 변경할 수 있습니다.

## 📝 사용법

1. **런처 실행**: `launcher` 폴더에서 애플리케이션을 실행
2. **원하는 앱 선택**: 런처에서 사용하고 싶은 애플리케이션 클릭
3. **자동 로그인**: 설정된 계정 정보로 자동 로그인 (선택사항)

## 🤝 기여하기

이 프로젝트는 고려대학교 학생들을 위해 개발되었습니다. 버그 리포트나 기능 제안은 Issues를 통해 해주세요.

## 📄 라이선스

이 프로젝트는 저작권 보호를 받습니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 👨‍💻 개발자

- **BBIYAKYEE7** - 프로젝트 개발 및 유지보수

## 📞 지원

문제가 발생하거나 도움이 필요한 경우:
- GitHub Issues를 통해 문의
- 이메일: bbiyakyee7@gmail.com

---

**고려대학교 학생들을 위한 통합 솔루션** 🎓
