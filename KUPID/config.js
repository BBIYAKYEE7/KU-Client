const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class ConfigManager {
    constructor() {
        // 사용자별 데이터 디렉터리에 설정 저장 (배포 번들에 포함된 기본 config.json 무시)
        const userDataDir = app ? app.getPath('userData') : __dirname;
        this.configPath = path.join(userDataDir, 'config.json');
    }

    // 설정 저장
    saveConfig(config) {
        try {
            const configData = {
                username: config.username || '',
                password: config.password || '',
                autoLogin: config.autoLogin || false,
                rememberCredentials: config.rememberCredentials || false,
                autoUpdate: config.autoUpdate || false,
                disableUpdateCheck: config.disableUpdateCheck || false
            };
            
            fs.writeFileSync(this.configPath, JSON.stringify(configData, null, 2));
            console.log('설정이 저장되었습니다.');
            return true;
        } catch (error) {
            console.error('설정 저장 실패:', error);
            return false;
        }
    }

    // 설정 로드
    loadConfig() {
        try {
            // 사용자 데이터 경로에 설정이 없으면 기본값 반환 (최초 실행)
            if (!fs.existsSync(this.configPath)) {
                return {
                    username: '',
                    password: '',
                    autoLogin: false,
                    rememberCredentials: false,
                    autoUpdate: false,
                    disableUpdateCheck: false
                };
            }
            
            const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
            console.log('설정이 로드되었습니다.');
            return config;
        } catch (error) {
            console.error('설정 로드 실패:', error);
            return {
                username: '',
                password: '',
                autoLogin: false,
                rememberCredentials: false,
                autoUpdate: false,
                disableUpdateCheck: false
            };
        }
    }

    // 설정 삭제
    clearConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                fs.unlinkSync(this.configPath);
                console.log('설정이 삭제되었습니다.');
            }
            return true;
        } catch (error) {
            console.error('설정 삭제 실패:', error);
            return false;
        }
    }
}

module.exports = new ConfigManager();
