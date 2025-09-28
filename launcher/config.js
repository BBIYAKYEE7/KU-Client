const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class ConfigManager {
  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json');
    this.defaultConfig = {
      autoUpdate: false,
      disableUpdateCheck: false,
      checkInterval: 24 * 60 * 60 * 1000, // 24시간
      lastCheckTime: null
    };
  }

  // 설정 로드
  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const config = JSON.parse(data);
        return { ...this.defaultConfig, ...config };
      }
    } catch (error) {
      console.error('설정 로드 중 오류:', error);
    }
    return { ...this.defaultConfig };
  }

  // 설정 저장
  saveConfig(config) {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      console.error('설정 저장 중 오류:', error);
      return false;
    }
  }

  // 설정 초기화
  clearConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        fs.unlinkSync(this.configPath);
      }
      return true;
    } catch (error) {
      console.error('설정 초기화 중 오류:', error);
      return false;
    }
  }

  // 특정 설정 업데이트
  updateConfig(key, value) {
    try {
      const config = this.loadConfig();
      config[key] = value;
      return this.saveConfig(config);
    } catch (error) {
      console.error('설정 업데이트 중 오류:', error);
      return false;
    }
  }

  // 설정 가져오기
  getConfig(key) {
    try {
      const config = this.loadConfig();
      return config[key];
    } catch (error) {
      console.error('설정 가져오기 중 오류:', error);
      return null;
    }
  }
}

module.exports = new ConfigManager();
