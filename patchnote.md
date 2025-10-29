# 🎉 Korea University Launcher v1.2.0 - 장학금 신청 팝업 & PDF 뷰어 해결!

## 🔧 주요 버그 수정

### 📄 PDF 뷰어 문제 완전 해결
- **LMS PDF 뷰어가 안 보이는 문제** 완전 해결
- PDF 플러그인 활성화 및 권한 설정 개선
- PDF 뷰어 URL 패턴 인식 개선
- 내장 PDF 뷰어 성능 최적화

### 🎓 장학금 신청 팝업 문제 해결
- **장학금 신청 버튼 클릭 시 팝업이 안 나오는 문제** 완전 해결
- 웹페이지 내 모달 팝업 구현으로 Firefox와 동일한 경험 제공
- 브라우저 다이얼로그 차단 문제 해결

## ✨ 새로운 기능

### 🎯 장학금 신청 팝업 기능
- **웹페이지 내 모달 팝업**: 별도 창이 아닌 현재 페이지 내에서 팝업 표시
- **Firefox와 동일한 UX**: 브라우저에서와 동일한 사용자 경험 제공
- **자동 버튼 감지**: 다양한 버튼 구조 자동 감지 및 처리
- **동적 팝업 생성**: 페이지 로드 후 추가되는 버튼도 자동 감지

### 🎯 PDF 뷰어 개선사항
- **PDF 플러그인 자동 활성화**: PDF 파일을 더 안정적으로 표시
- **PDF 뷰어 URL 패턴 확장**: 다양한 PDF 뷰어 형식 지원
- **PDF 뷰어 헤더 최적화**: PDF 로딩 속도 개선
- **PDF 뷰어 디버깅**: 문제 발생 시 상세한 로그 제공

### 🔍 기술적 개선사항
- `plugins: true` 설정으로 PDF 플러그인 활성화
- `experimentalFeatures: true` 설정으로 최신 기능 지원
- `sandbox: false` 설정으로 JavaScript 주입 활성화
- `disableDialogs: false` 설정으로 브라우저 다이얼로그 허용
- PDF 뷰어 관련 권한 설정 강화
- PDF 요청 시 적절한 Accept 헤더 설정

## 🐛 해결된 문제들

### 장학금 신청 팝업 관련
- ✅ 장학금 신청 버튼 클릭 시 팝업이 안 나오는 문제
- ✅ 별도 창으로 팝업이 열리는 문제 (웹페이지 내 모달로 변경)
- ✅ 브라우저 다이얼로그가 차단되는 문제
- ✅ JavaScript 주입이 실패하는 문제 (sandbox 설정 해제)
- ✅ 다양한 버튼 구조 감지 실패 문제

### PDF 뷰어 관련
- ✅ LMS에서 PDF 파일이 안 보이는 문제
- ✅ PDF 플러그인이 비활성화되어 있던 문제
- ✅ PDF 뷰어 URL 패턴 인식 부족 문제
- ✅ PDF 뷰어 관련 헤더 설정 부족 문제

### 사용자 경험 개선
- ✅ 장학금 신청 시 Firefox와 동일한 팝업 경험 제공
- ✅ PDF 파일 클릭 시 내장 뷰어에서 바로 열림
- ✅ PDF 뷰어 로딩 속도 개선
- ✅ PDF 뷰어 안정성 향상
- ✅ PDF 뷰어 디버깅 정보 추가

## 🚀 사용법

### 장학금 신청하기
1. KUPID에 로그인
2. 등록/장학 → 장학금 신청 메뉴로 이동
3. 원하는 장학금의 "신청" 버튼 클릭
4. 웹페이지 내 팝업에서 "OK" 버튼 클릭하여 신청 완료!

### PDF 파일 보기
1. LMS에 로그인
2. 강의 자료나 과제에서 PDF 파일 클릭
3. 내장 PDF 뷰어에서 바로 확인!

### 문제 해결
- 장학금 신청 팝업이 안 나온다면 클라이언트를 재시작해주세요
- PDF 뷰어가 여전히 안 보인다면 클라이언트를 재시작해주세요
- 문제가 지속되면 개발자 도구에서 PDF 플러그인 상태를 확인할 수 있습니다

## 🔧 기술적 세부사항

### 장학금 신청 팝업 설정
```javascript
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  nodeIntegration: false,
  contextIsolation: true,
  devTools: false,
  webSecurity: true,
  plugins: true,
  experimentalFeatures: true
  // sandbox: false (제거됨)
  // disableDialogs: false (제거됨)
}
```

### PDF 플러그인 설정
```javascript
webPreferences: {
  plugins: true,
  experimentalFeatures: true
}
```

### PDF 뷰어 URL 패턴
- `.pdf` 파일 확장자
- `viewer.php`, `viewer.html` 뷰어
- `pdfviewer`, `pdf-viewer` 패턴
- LMS 도메인 PDF URL

### PDF 뷰어 헤더 최적화
- `Accept: application/pdf,application/x-pdf,application/x-bzpdf,application/x-gzpdf,*/*`
- `Accept-Encoding: gzip, deflate, br`
- `Accept-Language: ko-KR,ko;q=0.9,en;q=0.8`

## 📦 지원 플랫폼
- **Windows**: Windows 10 이상 (x64, ARM64)
- **macOS**: macOS 10.14 이상 (Intel, Apple Silicon)
- **Linux**: Ubuntu 18.04 이상 (x64, ARM64)

## 🎯 향후 계획
- 장학금 신청 팝업 기능 추가 개선 (더 많은 팝업 타입 지원)
- PDF 뷰어 성능 추가 최적화
- 다양한 문서 형식 지원 확장
- 사용자 피드백 기반 PDF 뷰어 개선
- 포털 내 다른 팝업 기능들 지원 확장
- 모바일 디바이스 지원 검토

---

**고려대학교 학생들의 더 나은 학습 환경을 위해** 📚✨