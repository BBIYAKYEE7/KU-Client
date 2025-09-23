document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const statusMessage = document.getElementById('statusMessage');
    const rememberMe = document.getElementById('rememberMe');
    
    const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');

    // 저장된 자격 증명 불러오기
    await loadSavedCredentials();

    // 세션 만료 체크
    await checkSessionExpiry();

    // 폼 제출 이벤트
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleLogin();
    });

    // Enter 키 이벤트
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });

    // 업데이트 확인 버튼 이벤트
    if (checkUpdatesBtn) {
        checkUpdatesBtn.addEventListener('click', async () => {
            try {
                showStatusMessage('업데이트를 확인하는 중...', 'info');
                await window.electronAPI.checkUpdatesManual();
                setTimeout(() => {
                    hideStatusMessage();
                }, 2000);
            } catch (error) {
                console.error('업데이트 확인 오류:', error);
                showStatusMessage('업데이트 확인 중 오류가 발생했습니다.', 'error');
            }
        });
    }
});

async function loadSavedCredentials() {
    try {
        const result = await window.electronAPI.loadCredentials();
        if (result.success && result.credentials.username) {
            document.getElementById('username').value = result.credentials.username;
            document.getElementById('password').value = result.credentials.password || '';
            document.getElementById('rememberMe').checked = result.credentials.remember || false;
        }
    } catch (error) {
        console.error('자격 증명 불러오기 실패:', error);
    }
}

async function checkSessionExpiry() {
    try {
        const result = await window.electronAPI.checkSession();
        if (result.expired) {
            showStatusMessage('세션이 만료되었습니다. 다시 로그인해주세요.', 'warning');
        }
    } catch (error) {
        console.error('세션 체크 실패:', error);
    }
}

async function handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const remember = document.getElementById('rememberMe').checked;
    

    // 간단한 유효성
    document.getElementById('usernameHelp').textContent = '';
    document.getElementById('passwordHelp').textContent = '';

    if (!username) {
        document.getElementById('usernameHelp').textContent = '아이디를 입력해주세요.';
    }
    if (!password) {
        document.getElementById('passwordHelp').textContent = '비밀번호를 입력해주세요.';
    }

    if (!username || !password) {
        showStatusMessage('아이디와 비밀번호를 모두 입력해주세요.', 'error');
        return;
    }

    setLoading(true);

    try {
        // 기존 저장된 자격 증명 확인
        const existingCredentials = await window.electronAPI.loadCredentials();
        const hasExistingCredentials = existingCredentials.success && existingCredentials.credentials.username;

        // 자격 증명 저장
        if (remember || hasExistingCredentials) {
            await window.electronAPI.saveCredentials({
                username: username,
                password: password,
                remember: remember
            });
        } else {
            await window.electronAPI.clearCredentials();
        }

        // 로그인 시간 저장
        await window.electronAPI.saveLoginTime();

        // LMS로 이동 및 자동 로그인
        const result = await window.electronAPI.navigateToLMS({
            username: username,
            password: password
        });

        if (result.success) {
            showStatusMessage('로그인 성공! LMS로 이동합니다...', 'success');
            setTimeout(() => { hideStatusMessage(); }, 2000);
        } else {
            showStatusMessage('로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요.', 'error');
        }
    } catch (error) {
        console.error('로그인 오류:', error);
        showStatusMessage('로그인 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
    } finally {
        setLoading(false);
    }
}

function setLoading(loading) {
    const loginBtn = document.getElementById('loginBtn');
    const btnText = loginBtn.querySelector('.btn-text');
    const btnLoading = loginBtn.querySelector('.btn-loading');
    if (loading) {
        loginBtn.disabled = true;
        loginBtn.classList.add('loading');
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline';
    } else {
        loginBtn.disabled = false;
        loginBtn.classList.remove('loading');
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

function showStatusMessage(message, type = 'error') {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type} show`;
    setTimeout(() => { hideStatusMessage(); }, 3000);
}

function hideStatusMessage() {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.classList.remove('show');
    setTimeout(() => { statusMessage.style.display = 'none'; }, 300);
}

// 입력 필드 포커스 효과
document.querySelectorAll('input[type="text"], input[type="password"]').forEach(input => {
    input.addEventListener('focus', function() { this.parentElement.classList.add('focused'); });
    input.addEventListener('blur', function() { this.parentElement.classList.remove('focused'); });
});

// 비밀번호 표시/숨기기 옵션이 생기면 사용할 함수
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
}
