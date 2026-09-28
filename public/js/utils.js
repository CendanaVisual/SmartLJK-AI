const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:8000/api' 
    : '/api'; // Adjust for production

/**
 * Generic API Call wrapper dengan automatic dual-routing fallback
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP Method (GET, POST, etc.)
 * @param {object|FormData} data - Payload
 * @param {boolean} isFormData - Is the data a FormData object?
 * @returns {Promise<any>} Response JSON
 */
async function apiCall(endpoint, method = 'GET', data = null, isFormData = false) {
    let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    let url = `${API_BASE}${cleanEndpoint}`;
    
    const options = {
        method,
        headers: {}
    };

    if (data) {
        if (isFormData) {
            options.body = data;
        } else {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        }
    }

    try {
        let response = await fetch(url, options);

        // Jika 404 (misal karena Vercel rewrite prefix mismatch), coba rute alternatif
        if (response.status === 404) {
            let altUrl = url.includes('/api/') 
                ? url.replace('/api/', '/') 
                : url.replace(window.location.origin, `${window.location.origin}/api`);
            
            if (altUrl !== url) {
                try {
                    const altRes = await fetch(altUrl, options);
                    if (altRes.ok) {
                        return await altRes.json();
                    }
                } catch (err) {
                    // Abaikan fallback error, gunakan error utama di bawah
                }
            }
        }

        if (!response.ok) {
            let errMsg = `Error ${response.status}: ${response.statusText}`;
            try {
                const errData = await response.json();
                errMsg = errData.detail || errData.message || errMsg;
            } catch (e) {
                // Ignore parse error
            }
            throw new Error(errMsg);
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - 'success', 'error', 'warning', 'info'
 */
function showNotification(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';

    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

/**
 * Format a date string to Indonesian locale
 * @param {string} dateString 
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

/**
 * Format score to 2 decimal places
 * @param {number} score 
 * @returns {string} Formatted score
 */
function formatScore(score) {
    if (score === null || score === undefined) return '0.00';
    return parseFloat(score).toFixed(2);
}

/**
 * Generate a unique ID
 * @returns {string} Random string
 */
function generateId() {
    return Math.random().toString(36).substring(2, 11);
}

/**
 * Debounce function to limit calls
 * @param {Function} fn 
 * @param {number} delay 
 * @returns {Function}
 */
function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            fn.apply(this, args);
        }, delay);
    };
}
