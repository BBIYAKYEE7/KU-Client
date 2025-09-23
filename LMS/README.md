# 고려대학교 LMS 데스크탑 앱

[![React](https://img.shields.io/badge/React-18.0.0-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

고려대학교 LMS(Learning Management System)를 위한 Electron 기반 데스크탑 애플리케이션입니다.

## 주요 기능

- 🚀 **자동 로그인**: 저장된 자격 증명으로 원클릭 로그인
- 💾 **자격 증명 저장**: 로그인 정보를 안전하게 저장 (선택사항)
- ⏰ **세션 관리**: 2시간 세션 만료 자동 감지
- 🖥️ **크로스 플랫폼**: Windows, macOS 지원
- 🎨 **모던 UI**: 깔끔하고 직관적인 사용자 인터페이스

## 시스템 요구사항

- **Windows**: Windows 10 이상
- **macOS**: macOS 10.14 이상
- **메모리**: 최소 4GB RAM
- **디스크**: 100MB 여유 공간

## 설치 방법

### 1. 개발 환경에서 실행

```bash
# 의존성 설치
npm install

# 개발 모드로 실행
npm start
```

### 2. 실행 파일 빌드

```bash
# 모든 플랫폼용 빌드
npm run build

# Windows용 빌드
npm run build-win

# macOS용 빌드
npm run build-mac
```

빌드된 파일은 `dist` 폴더에서 확인할 수 있습니다.

## 사용 방법

1. **앱 실행**: 고려대학교 LMS 앱을 실행합니다.
2. **로그인 정보 입력**: KUPID Single ID와 비밀번호를 입력합니다.
3. **자격 증명 저장** (선택): "로그인 정보 저장" 체크박스를 선택하여 다음에 자동 로그인할 수 있습니다.
4. **로그인**: "로그인" 버튼을 클릭하면 자동으로 LMS에 로그인됩니다.

## 보안 고려사항

- 로그인 정보는 로컬 컴퓨터에만 저장됩니다.
- 저장된 자격 증명은 암호화되어 보관됩니다.
- 세션은 2시간 후 자동으로 만료됩니다.

## 문제 해결

### 로그인이 안 되는 경우
- KUPID Single ID와 비밀번호가 정확한지 확인하세요.
- 인터넷 연결 상태를 확인하세요.
- 고려대학교 LMS 서버 상태를 확인하세요.

### 앱이 실행되지 않는 경우
- 시스템 요구사항을 확인하세요.
- 최신 버전의 앱을 사용하고 있는지 확인하세요.
- 관리자 권한으로 실행해보세요.

## 개발자 정보

이 앱은 고려대학교 학생을 위해 개발되었습니다.

## 라이선스

MIT License

## 지원

문제가 발생하거나 개선 사항이 있으시면 이슈를 등록해주세요.
