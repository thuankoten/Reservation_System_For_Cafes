export function isAuthRoute() {
  try {
    const p = window.location?.pathname || ''
    return p.startsWith('/auth/login') || p.startsWith('/auth/register') || p.startsWith('/auth/signup')
  } catch {
    return false
  }
}

export function showErrorAlert(message) {
  if (isAuthRoute()) return
  const msg = String(message || '').trim() || 'Đã xảy ra lỗi, vui lòng thử lại.'
  try {
    window.alert(msg)
  } catch {
    // noop
  }
}

export function setupGlobalErrorAlerts() {
  try {
    window.addEventListener('error', (e) => {
      const msg = e?.message || 'Đã xảy ra lỗi không xác định.'
      showErrorAlert(msg)
    })
    window.addEventListener('unhandledrejection', (e) => {
      const reason = e?.reason
      const msg = (reason && (reason.message || String(reason))) || 'Đã xảy ra lỗi không xác định.'
      showErrorAlert(msg)
    })
  } catch {
    // noop
  }
}
