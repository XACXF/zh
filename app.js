// 账号数据存储
let accounts = [];
let notifications = [];
let deletedAccounts = []; // 回收站数据

// 获取当前用户名
function getCurrentUser() {
    return sessionStorage.getItem('currentUser') || 'default';
}

// 获取当前用户的账号数据键名
function getUserAccountsKey() {
    return 'accounts_' + getCurrentUser();
}

// 获取当前用户的回收站数据键名
function getDeletedAccountsKey() {
    return 'deleted_accounts_' + getCurrentUser();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    loadAccounts();
    loadDeletedAccounts();
    renderAccounts();
    renderRecycleBin();
    startCountdown();
    setupEventListeners();
    requestNotificationPermission();
});

// 请求通知权限
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// 发送系统通知
function sendSystemNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📱</text></svg>',
            tag: 'account-notification'
        });
    }
}

// 加载回收站数据
function loadDeletedAccounts() {
    try {
        const data = localStorage.getItem(getDeletedAccountsKey());
        deletedAccounts = data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('加载回收站失败:', e);
        deletedAccounts = [];
    }
}

// 保存回收站数据
function saveDeletedAccounts() {
    try {
        localStorage.setItem(getDeletedAccountsKey(), JSON.stringify(deletedAccounts));
    } catch (e) {
        console.error('保存回收站失败:', e);
    }
}

// 加载账号（按用户分开存储）
function loadAccounts() {
    try {
        const data = localStorage.getItem(getUserAccountsKey());
        accounts = data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('加载账号失败:', e);
        accounts = [];
    }
}

// 设置事件监听器
function setupEventListeners() {
    const accountForm = document.getElementById('accountForm');
    const statusFilter = document.getElementById('statusFilter');

    accountForm.addEventListener('submit', handleAddAccount);
    statusFilter.addEventListener('change', () => renderAccounts());
}

// 快捷租用功能 - 设置租期
function setRentDuration(duration) {
    const rentDurationInput = document.getElementById('rentDuration');
    if (rentDurationInput) {
        rentDurationInput.value = duration;
    }
}

// 添加账号
function handleAddAccount(e) {
    e.preventDefault();

    const accountName = document.getElementById('accountName').value.trim();
    const phoneNumber = document.getElementById('phoneNumber').value.trim();
    const rentDuration = parseInt(document.getElementById('rentDuration').value) || 0;
    const autoRent = document.getElementById('autoRent').checked;

    if (!accountName || !phoneNumber) {
        showNotification('请填写完整信息', 'error');
        return;
    }

    // 验证手机号
    if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
        showNotification('请输入有效的手机号码', 'error');
        return;
    }

    const newAccount = {
        id: Date.now(),
        name: accountName,
        phone: phoneNumber,
        status: 'idle',
        rentEndTime: null,
        remainingTime: 0,
        createdAt: new Date().toISOString()
    };

    // 如果设置了初始租期且勾选立即出租，则自动开始出租
    if (autoRent && rentDuration > 0) {
        newAccount.status = 'rented';
        newAccount.rentEndTime = new Date(Date.now() + rentDuration * 60 * 1000).toISOString();
        newAccount.remainingTime = rentDuration * 60;
    }

    accounts.push(newAccount);
    saveAccounts();
    renderAccounts();

    // 清空表单
    e.target.reset();
    document.getElementById('rentDuration').value = '0';
    const message = newAccount.status === 'rented'
        ? `账号 ${accountName} 添加成功并已出租${rentDuration}分钟`
        : '账号添加成功';
    showNotification(message, 'success');
}

// 渲染账号列表
function renderAccounts() {
    const accountsList = document.getElementById('accountsList');
    const statusFilter = document.getElementById('statusFilter').value;

    let filteredAccounts = accounts;

    if (statusFilter !== 'all') {
        filteredAccounts = accounts.filter(account => account.status === statusFilter);
    }

    if (filteredAccounts.length === 0) {
        accountsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📱</div>
                <div class="empty-state-text">暂无账号，请添加新账号</div>
            </div>
        `;
        return;
    }

    accountsList.innerHTML = filteredAccounts.map(account => {
        const statusInfo = getStatusInfo(account.status);
        const timeDisplay = formatTime(account.remainingTime);

        return `
            <div class="account-card status-${account.status}" data-id="${account.id}">
                <div class="account-card-header">
                    <div>
                        <div class="account-name">${escapeHtml(account.name)}</div>
                        <div class="account-phone">
                            📱 <span id="phone-${account.id}">${escapeHtml(account.phone)}</span>
                            <button class="btn-copy" onclick="copyPhone('${account.phone}')" title="复制手机号">📋</button>
                        </div>
                    </div>
                    <span class="status-badge">${statusInfo.text}</span>
                </div>
                <div class="account-info">
                    ${account.status !== 'idle' ? `
                        <div class="info-row">
                            <span class="info-label">剩余时间</span>
                            <span class="info-value time-remaining" id="time-${account.id}">${timeDisplay}</span>
                        </div>
                        ${account.rentEndTime ? `
                            <div class="info-row">
                                <span class="info-label">到期时间</span>
                                <span class="info-value">${formatDateTime(account.rentEndTime)}</span>
                            </div>
                        ` : ''}
                        <div class="info-row">
                            <span class="info-label">出租时长</span>
                            <span class="info-value">${Math.floor(account.remainingTime / 60)} 分钟</span>
                        </div>
                    ` : `
                        <div class="info-row">
                            <span class="info-label">状态</span>
                            <span class="info-value">空闲中，可出租</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">操作提示</span>
                            <span class="info-value">点击"出租账号"开始计时</span>
                        </div>
                    `}
                </div>
                <div class="account-actions">
                    ${account.status === 'idle' ? `
                        <button class="btn btn-small btn-rent" onclick="rentAccount(${account.id})">出租账号</button>
                    ` : ''}
                    ${account.status === 'rented' || account.status === 'expiring' ? `
                        <button class="btn btn-small btn-extend" onclick="extendRent(${account.id})">续费</button>
                        <button class="btn btn-small btn-return" onclick="returnAccount(${account.id})">归还</button>
                    ` : ''}
                    ${account.status === 'expired' ? `
                        <button class="btn btn-small btn-rent" onclick="rentAccount(${account.id})">重新出租</button>
                    ` : ''}
                    <button class="btn btn-small btn-delete" onclick="deleteAccount(${account.id})">删除</button>
                </div>
            </div>
        `;
    }).join('');
}

// 出租账号 - 显示快捷选择弹窗
function rentAccount(accountId) {
    const account = accounts.find(a => a.id === accountId);
    if (!account) {
        return;
    }

    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'rentModal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>出租账号 - ${escapeHtml(account.name)}</h3>
            <p>请选择租期：</p>
            <div class="quick-options">
                <button onclick="confirmRent(${account.id}, 60)">1小时</button>
                <button onclick="confirmRent(${account.id}, 1440)">1天</button>
                <button onclick="confirmRent(${account.id}, 10080)">1周</button>
                <button onclick="confirmRent(${account.id}, 43200)">1个月</button>
                <button onclick="confirmRent(${account.id}, 525600)">1年</button>
            </div>
            <div class="custom-input">
                <input type="number" id="customRentDuration" placeholder="自定义分钟数" min="1">
                <button onclick="confirmCustomRent(${account.id})">确定</button>
            </div>
            <button class="cancel-btn" onclick="closeRentModal()">取消</button>
        </div>
    `;
    document.body.appendChild(modal);
}

// 确认出租
function confirmRent(accountId, duration) {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    account.status = 'rented';
    account.rentEndTime = new Date(Date.now() + duration * 60 * 1000).toISOString();
    account.remainingTime = duration * 60;

    saveAccounts();
    renderAccounts();
    closeRentModal();

    const timeText = getDurationText(duration);
    showNotification(`账号 ${account.name} 已出租 ${timeText}`, 'success');
}

// 确认自定义租期
function confirmCustomRent(accountId) {
    const input = document.getElementById('customRentDuration');
    const duration = parseInt(input.value);

    if (!duration || duration <= 0) {
        showNotification('请输入有效的租期', 'error');
        return;
    }

    confirmRent(accountId, duration);
}

// 关闭出租弹窗
function closeRentModal() {
    const modal = document.getElementById('rentModal');
    if (modal) {
        modal.remove();
    }
}

// 获取时长文本
function getDurationText(minutes) {
    if (minutes >= 525600) {
        const years = Math.floor(minutes / 525600);
        return `${years}年`;
    } else if (minutes >= 43200) {
        const months = Math.floor(minutes / 43200);
        return `${months}个月`;
    } else if (minutes >= 10080) {
        const weeks = Math.floor(minutes / 10080);
        return `${weeks}周`;
    } else if (minutes >= 1440) {
        const days = Math.floor(minutes / 1440);
        return `${days}天`;
    } else if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        return `${hours}小时`;
    }
    return `${minutes}分钟`;
}

// 续费 - 显示快捷选择弹窗
function extendRent(accountId) {
    const account = accounts.find(a => a.id === accountId);
    if (!account) {
        return;
    }

    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'extendModal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>续费账号 - ${escapeHtml(account.name)}</h3>
            <p>当前剩余时间：${formatTime(account.remainingTime)}</p>
            <p>请选择续费时长：</p>
            <div class="quick-options">
                <button onclick="confirmExtend(${account.id}, 60)">1小时</button>
                <button onclick="confirmExtend(${account.id}, 1440)">1天</button>
                <button onclick="confirmExtend(${account.id}, 10080)">1周</button>
                <button onclick="confirmExtend(${account.id}, 43200)">1个月</button>
                <button onclick="confirmExtend(${account.id}, 525600)">1年</button>
            </div>
            <div class="custom-input">
                <input type="number" id="customExtendDuration" placeholder="自定义分钟数" min="1">
                <button onclick="confirmCustomExtend(${account.id})">确定</button>
            </div>
            <button class="cancel-btn" onclick="closeExtendModal()">取消</button>
        </div>
    `;
    document.body.appendChild(modal);
}

// 确认续费
function confirmExtend(accountId, duration) {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    const currentTime = account.rentEndTime ? new Date(account.rentEndTime) : new Date();
    account.rentEndTime = new Date(currentTime.getTime() + duration * 60 * 1000).toISOString();
    account.remainingTime += duration * 60;
    account.status = 'rented';

    saveAccounts();
    renderAccounts();
    closeExtendModal();

    const timeText = getDurationText(duration);
    showNotification(`账号 ${account.name} 已续费 ${timeText}，总剩余时间：${formatTime(account.remainingTime)}`, 'success');
}

// 确认自定义续费
function confirmCustomExtend(accountId) {
    const input = document.getElementById('customExtendDuration');
    const duration = parseInt(input.value);

    if (!duration || duration <= 0) {
        showNotification('请输入有效的续费时长', 'error');
        return;
    }

    confirmExtend(accountId, duration);
}

// 关闭续费弹窗
function closeExtendModal() {
    const modal = document.getElementById('extendModal');
    if (modal) {
        modal.remove();
    }
}

// 归还账号
function returnAccount(accountId) {
    if (!confirm('确定要归还该账号吗？')) return;

    const account = accounts.find(a => a.id === accountId);
    if (account) {
        account.status = 'idle';
        account.rentEndTime = null;
        account.remainingTime = 0;

        saveAccounts();
        renderAccounts();
        showNotification(`账号 ${account.name} 已归还`, 'success');
    }
}

// 删除账号（移到回收站）
function deleteAccount(accountId) {
    if (!confirm('确定要删除该账号吗？账号将被移到回收站。')) return;

    // 找到要删除的账号
    const accountToDelete = accounts.find(a => a.id === accountId);
    if (!accountToDelete) return;

    // 添加到回收站（记录删除时间）
    accountToDelete.deletedAt = new Date().toISOString();
    deletedAccounts.push(accountToDelete);
    saveDeletedAccounts();

    // 从正常列表中移除
    accounts = accounts.filter(a => a.id !== accountId);
    saveAccounts();
    renderAccounts();
    renderRecycleBin();
    showNotification('账号已移到回收站', 'success');
}

// 恢复账号
function restoreAccount(accountId) {
    const accountToRestore = deletedAccounts.find(a => a.id === accountId);
    if (!accountToRestore) return;

    // 移除删除时间
    delete accountToRestore.deletedAt;

    // 恢复到正常列表
    accounts.push(accountToRestore);
    deletedAccounts = deletedAccounts.filter(a => a.id !== accountId);

    saveAccounts();
    saveDeletedAccounts();
    renderAccounts();
    renderRecycleBin();
    showNotification(`账号 ${accountToRestore.name} 已恢复`, 'success');
}

// 彻底删除账号
function permanentlyDeleteAccount(accountId) {
    if (!confirm('确定要彻底删除该账号吗？此操作不可恢复！')) return;

    deletedAccounts = deletedAccounts.filter(a => a.id !== accountId);
    saveDeletedAccounts();
    renderRecycleBin();
    showNotification('账号已彻底删除', 'success');
}

// 清空回收站
function emptyRecycleBin() {
    if (!confirm('确定要清空回收站吗？所有账号将被彻底删除！')) return;

    deletedAccounts = [];
    saveDeletedAccounts();
    renderRecycleBin();
    showNotification('回收站已清空', 'success');
}

// 渲染回收站
function renderRecycleBin() {
    const recycleBinList = document.getElementById('recycleBinList');
    if (!recycleBinList) return;

    if (deletedAccounts.length === 0) {
        recycleBinList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">回收站是空的</p>';
        return;
    }

    recycleBinList.innerHTML = deletedAccounts.map(account => `
        <div class="account-card status-deleted" data-id="${account.id}">
            <div class="account-card-header">
                <div>
                    <div class="account-name">${escapeHtml(account.name)}</div>
                    <div class="account-phone">
                            📱 <span>${escapeHtml(account.phone)}</span>
                            <button class="btn-copy" onclick="copyPhone('${account.phone}')" title="复制手机号">📋</button>
                        </div>
                </div>
                <span class="status-badge status-deleted-badge">已删除</span>
            </div>
            <div class="account-info">
                <div class="info-row">
                    <span class="info-label">删除时间</span>
                    <span class="info-value">${formatDateTime(account.deletedAt)}</span>
                </div>
            </div>
            <div class="account-actions">
                <button class="btn btn-small btn-restore" onclick="restoreAccount(${account.id})">恢复</button>
                <button class="btn btn-small btn-delete" onclick="permanentlyDeleteAccount(${account.id})">彻底删除</button>
            </div>
        </div>
    `).join('');
}

// 开始倒计时
function startCountdown() {
    setInterval(() => {
        let needRender = false;

        accounts.forEach(account => {
            if (account.status === 'rented' || account.status === 'expiring') {
                if (account.rentEndTime) {
                    const endTime = new Date(account.rentEndTime);
                    const now = new Date();
                    const diff = Math.max(0, Math.floor((endTime - now) / 1000));

                    const oldStatus = account.status;

                    account.remainingTime = diff;

                    // 实时更新时间显示
                    const timeElement = document.getElementById(`time-${account.id}`);
                    if (timeElement) {
                        timeElement.textContent = formatTime(account.remainingTime);
                    }

                    if (diff === 0) {
                        account.status = 'expired';
                        showNotification(`账号 ${account.name} 已到期！`, 'warning');
                        sendSystemNotification('账号到期', `账号 ${account.name} 已到期！`);
                        needRender = true;
                    } else if (diff <= 300 && account.status === 'rented') {
                        account.status = 'expiring';
                        if (!notifications.includes(account.id)) {
                            showNotification(`账号 ${account.name} 即将到期，剩余 ${formatTime(diff)}`, 'warning');
                            sendSystemNotification('账号即将到期', `账号 ${account.name} 将在 ${formatTime(diff)} 后到期`);
                            notifications.push(account.id);
                        }
                        needRender = true;
                    }

                    if (oldStatus !== account.status) {
                        needRender = true;
                    }
                }
            }
        });

        if (needRender) {
            renderAccounts();
        }

        notifications = notifications.filter(id => {
            const account = accounts.find(a => a.id === id);
            return account && account.status !== 'expired';
        });
    }, 1000);
}

// 获取状态信息
function getStatusInfo(status) {
    const statusMap = {
        'idle': { text: '空闲', class: 'success' },
        'rented': { text: '出租中', class: 'primary' },
        'expiring': { text: '即将到期', class: 'warning' },
        'expired': { text: '已到期', class: 'error' }
    };
    return statusMap[status] || { text: '未知', class: 'default' };
}

// 格式化时间
function formatTime(seconds) {
    if (seconds <= 0) return '0分钟';

    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    const secs = seconds % 60;

    let result = '';
    if (days > 0) result += `${days}天 `;
    if (hours > 0) result += `${hours}小时 `;
    if (minutes > 0) result += `${minutes}分钟 `;
    if (secs > 0 && !days && !hours) result += `${secs}秒`;

    return result.trim() || '0秒';
}

// 格式化日期时间
function formatDateTime(isoString) {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 保存账号到本地存储（按用户分开存储）
function saveAccounts() {
    try {
        localStorage.setItem(getUserAccountsKey(), JSON.stringify(accounts));
    } catch (e) {
        console.error('保存账号失败:', e);
    }
}

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// HTML转义防止XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 复制手机号到剪贴板
function copyPhone(phone) {
    navigator.clipboard.writeText(phone).then(() => {
        showNotification('手机号已复制到剪贴板', 'success');
    }).catch(err => {
        // 兼容旧浏览器
        const input = document.createElement('input');
        input.value = phone;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showNotification('手机号已复制到剪贴板', 'success');
    });
}

// 退出登录
function logout() {
    if (!confirm('确定要退出登录吗？')) return;
    sessionStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

// 显示当前用户
function displayCurrentUser() {
    const display = document.getElementById('currentUserDisplay');
    if (display) {
        const user = getCurrentUser();
        display.textContent = `当前用户: ${user}`;
    }
}

// 检查登录状态
function checkLogin() {
    const currentUser = sessionStorage.getItem('currentUser');
    if (!currentUser) {
        window.location.href = 'login.html';
    }
}

// 显示数据存储路径
function displayDataPath() {
    const pathElement = document.getElementById('dataStoragePath');
    if (pathElement) {
        pathElement.textContent = '浏览器 localStorage (应用数据)';
    }
}

// 页面加载时检查登录
checkLogin();
displayCurrentUser();
displayDataPath();
