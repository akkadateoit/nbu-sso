// NBU SSO Landing Page — client script

async function checkHealth() {
  var pill = document.getElementById('status-pill')
  var text = document.getElementById('status-text')
  var dot  = pill ? pill.querySelector('.status-dot') : null
  try {
    var r = await fetch('/api/v1/health')
    var d = await r.json()
    if (d.status === 'ok') {
      pill.className = 'online'
      dot.className  = 'status-dot pulse'
      text.textContent = 'ระบบพร้อมใช้งาน'
    } else {
      pill.className = 'error'
      dot.className  = 'status-dot'
      text.textContent = 'ระบบมีปัญหา'
    }
  } catch (e) {
    pill.className = 'error'
    dot.className  = 'status-dot'
    text.textContent = 'เชื่อมต่อไม่ได้'
  }
}

function copyUrl() {
  var url = document.getElementById('base-url').textContent
  navigator.clipboard.writeText(url).then(function () {
    var btn = document.querySelector('.copy-btn')
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
    setTimeout(function () {
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>'
    }, 2000)
  })
}

checkHealth()
setInterval(checkHealth, 30000)
