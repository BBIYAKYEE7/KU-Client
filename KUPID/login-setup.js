// 로그인 설정 페이지 로직
class LoginSetup {
    constructor() {
        this.form = document.getElementById('login-setup-form');
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.validateForm();
    }
    
    bindEvents() {
        // 폼 제출 이벤트
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });
        
        // 입력 필드 변경 시 유효성 검사
        const inputs = this.form.querySelectorAll('input[type="text"], input[type="password"]');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this.validateForm();
            });
        });
        
        // 체크박스 변경 시 유효성 검사
        const checkboxes = this.form.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.validateForm();
            });
        });
    }
    
    validateForm() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const autoLogin = document.getElementById('auto-login').checked;
        const rememberCredentials = document.getElementById('remember-credentials').checked;
        
        const submitBtn = this.form.querySelector('button[type="submit"]');
        
        // 기본 유효성 검사
        const isValid = username.length > 0 && password.length > 0;
        
        // 자동 로그인이 체크되어 있으면 로그인 정보 저장도 체크되어야 함
        const autoLoginValid = !autoLogin || (autoLogin && rememberCredentials);
        
        submitBtn.disabled = !isValid || !autoLoginValid;
        
        // 오류 메시지 표시
        this.showValidationMessages(username, password, autoLogin, rememberCredentials);
    }
    
    showValidationMessages(username, password, autoLogin, rememberCredentials) {
        // 기존 오류 메시지 제거
        this.clearValidationMessages();
        
        // 아이디 검증
        if (username.length === 0) {
            this.showFieldError('username', '아이디를 입력해주세요.');
        }
        
        // 비밀번호 검증
        if (password.length === 0) {
            this.showFieldError('password', '비밀번호를 입력해주세요.');
        } else if (password.length < 6) {
            this.showFieldError('password', '비밀번호는 6자 이상이어야 합니다.');
        }
        
        // 자동 로그인 설정 검증
        if (autoLogin && !rememberCredentials) {
            this.showFieldError('auto-login', '자동 로그인을 사용하려면 로그인 정보 저장을 활성화해야 합니다.');
        }
    }
    
    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        errorDiv.style.color = '#f44336';
        errorDiv.style.fontSize = '12px';
        errorDiv.style.marginTop = '4px';
        
        field.parentNode.appendChild(errorDiv);
        field.style.borderColor = '#f44336';
    }
    
    clearValidationMessages() {
        // 기존 오류 메시지 제거
        const errorMessages = document.querySelectorAll('.field-error');
        errorMessages.forEach(msg => msg.remove());
        
        // 입력 필드 테두리 색상 초기화
        const inputs = this.form.querySelectorAll('input[type="text"], input[type="password"]');
        inputs.forEach(input => {
            input.style.borderColor = '#e1e5e9';
        });
    }
    
    async handleSubmit() {
        const formData = new FormData(this.form);
        
        const config = {
            username: formData.get('username').trim(),
            password: formData.get('password'),
            autoLogin: formData.get('autoLogin') === 'on',
            rememberCredentials: formData.get('rememberCredentials') === 'on'
        };
        
        // 로딩 상태 표시
        this.setLoadingState(true);
        
        try {
            if (window.electronAPI) {
                const success = await window.electronAPI.saveLoginConfig(config);
                
                if (success) {
                    // 성공 메시지 표시
                    this.showSuccessMessage();
                    
                    // 1.5초 후 메인 페이지로 이동
                    setTimeout(() => {
                        if (window.electronAPI) {
                            window.electronAPI.startPortal();
                        }
                    }, 1500);
                } else {
                    this.showErrorMessage('설정 저장에 실패했습니다. 다시 시도해주세요.');
                }
            } else {
                this.showErrorMessage('Electron API를 사용할 수 없습니다.');
            }
        } catch (error) {
            console.error('설정 저장 오류:', error);
            this.showErrorMessage('오류가 발생했습니다: ' + error.message);
        } finally {
            this.setLoadingState(false);
        }
    }
    
    setLoadingState(loading) {
        const submitBtn = this.form.querySelector('button[type="submit"]');
        const container = document.querySelector('.setup-container');
        
        if (loading) {
            submitBtn.textContent = '설정 저장 중...';
            container.classList.add('loading');
        } else {
            submitBtn.textContent = '설정 완료 및 시작';
            container.classList.remove('loading');
        }
    }
    
    showSuccessMessage() {
        const submitBtn = this.form.querySelector('button[type="submit"]');
        submitBtn.textContent = '설정 완료!';
        submitBtn.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
        
        // 성공 메시지 표시
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #4CAF50;">
                <h3>설정이 완료되었습니다!</h3>
                <p>고려대학교 포털로 이동합니다...</p>
            </div>
        `;
        
        this.form.appendChild(successDiv);
    }
    
    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <div style="background: #ffebee; border: 1px solid #f44336; border-radius: 8px; padding: 16px; margin-top: 16px; color: #f44336;">
                <strong>오류:</strong> ${message}
            </div>
        `;
        
        // 기존 오류 메시지 제거
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        this.form.appendChild(errorDiv);
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    new LoginSetup();
});

