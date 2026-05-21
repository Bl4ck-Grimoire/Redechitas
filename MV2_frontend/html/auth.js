// auth.js — incluir en cada página con <script src="../auth.js"></script>
// O copiar inline. Provee funciones de sesión compartidas.

function getSession() {
    const s = localStorage.getItem('admin_session');
    return s ? JSON.parse(s) : null;
}

// Redirige a login si no hay sesión activa. Retorna el objeto de sesión.
function requireAuth() {
    const session = getSession();
    if (!session) { window.location.replace('/login.html'); return null; }
    if (session.password_changed === 0) { window.location.replace('/cambiar_password.html'); return null; }
    return session;
}

// true si es el superadmin (username = 'superadmin' Y conjunto_id = null)
function isSuperAdmin(session) {
    return session && session.username === 'superadmin' && session.conjunto_id === null;
}

// Cierra sesión y redirige al login
function logout() {
    localStorage.removeItem('admin_session');
    window.location.replace('/login.html');
}

// Añade badge del usuario activo + botón logout al navbar pasado como selector
function addUserBadge(navbarSelector, session) {
    const nav = document.querySelector(navbarSelector);
    if (!nav) return;
    const badge = document.createElement('div');
    badge.className = 'navbar-text d-flex align-items-center gap-2 me-3';
    const conjuntoLabel = isSuperAdmin(session)
        ? '<span class="badge bg-warning text-dark">Superadmin</span>'
        : `<span class="badge bg-light text-primary">Conjunto ${session.conjunto_id}</span>`;
    badge.innerHTML = `
        <i class="bi bi-person-circle text-white"></i>
        <span class="text-white small">${session.nombre}</span>
        ${conjuntoLabel}
        <button class="btn btn-outline-light btn-sm" onclick="logout()">
            <i class="bi bi-box-arrow-right me-1"></i>Salir
        </button>
    `;
    nav.appendChild(badge);
}
