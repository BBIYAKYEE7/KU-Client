const { contextBridge, ipcRenderer } = require('electron');

// 안전한 API를 렌더러 프로세스에 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 자격 증명 관리
  saveCredentials: (credentials) => ipcRenderer.invoke('save-credentials', credentials),
  loadCredentials: () => ipcRenderer.invoke('load-credentials'),
  clearCredentials: () => ipcRenderer.invoke('clear-credentials'),
  
  // LMS 네비게이션
  navigateToLMS: (credentials) => ipcRenderer.invoke('navigate-to-lms', credentials),
  
  // 세션 관리
  checkSession: () => ipcRenderer.invoke('check-session'),
  saveLoginTime: () => ipcRenderer.invoke('save-login-time'),
  
  // 업데이트 관리
  downloadUpdate: (downloadUrl, fileName) => ipcRenderer.invoke('download-update', downloadUrl, fileName),
  closeUpdateWindow: () => ipcRenderer.invoke('close-update-window'),
  checkUpdatesManual: () => ipcRenderer.invoke('check-updates-manual')
});
