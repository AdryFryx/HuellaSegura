const API_URL = 'http://localhost:5000/api';

// --- Autenticación ---

// Login
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const errorMsg = document.getElementById('login-error');

        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('huellasegura_user', JSON.stringify(data.user));
                window.location.href = 'index.html';
            } else {
                errorMsg.textContent = data.error || 'Error al iniciar sesión';
                errorMsg.classList.remove('hidden');
            }
        } catch (err) {
            errorMsg.textContent = 'Error de conexión con el servidor.';
            errorMsg.classList.remove('hidden');
        }
    });
}

// Registro
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('reg-username').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const errorMsg = document.getElementById('reg-error');

        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();

            if (res.ok) {
                alert('Cuenta creada exitosamente. Ahora puedes iniciar sesión.');
                toggleForms(); // Vuelve al login
            } else {
                errorMsg.textContent = data.error || 'Error al crear la cuenta';
                errorMsg.classList.remove('hidden');
            }
        } catch (err) {
            errorMsg.textContent = 'Error de conexión con el servidor.';
            errorMsg.classList.remove('hidden');
        }
    });
}

// Logout
function logout() {
    localStorage.removeItem('huellasegura_user');
    window.location.href = 'Login.html';
}

// --- Mascotas y Mapa ---
let mainMap = null;
let allMascotas = [];
let mapMarkers = [];
let currentFilter = 'todos';

// Cargar Mascotas en el Mapa (Pantalla Completa)
async function loadMascotas() {
    const mainMapContainer = document.getElementById('main-map');
    
    if (!mainMapContainer) return;

    if (!mainMap) {
        mainMap = L.map('main-map', { zoomControl: false }).setView([-33.4489, -70.6693], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(mainMap);
        
        // Agregar control de zoom abajo a la izquierda para que no interfiera con los filtros
        L.control.zoom({ position: 'bottomleft' }).addTo(mainMap);

        // Centrar en ubicación actual si hay permiso
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                mainMap.setView([position.coords.latitude, position.coords.longitude], 13);
            });
        }
    }

    try {
        const res = await fetch(`${API_URL}/mascotas`);
        allMascotas = await res.json();
        applyFilters(); // Dibuja los pines basados en el filtro actual
    } catch (err) {
        console.error('Error al cargar mascotas', err);
    }
}

// Aplicar filtros y búsqueda
window.applyFilters = function() {
    if (!mainMap) return;

    // Limpiar marcadores actuales
    mapMarkers.forEach(marker => mainMap.removeLayer(marker));
    mapMarkers = [];

    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const user = JSON.parse(localStorage.getItem('huellasegura_user'));

    // Si el filtro es "vet", no dibujamos mascotas por ahora (es simulado)
    if (currentFilter === 'vet') {
        alert("¡Pronto mostraremos veterinarias reales usando OpenStreetMap! Por ahora, vuelve a 'Todos'.");
        return;
    }

    const filtered = allMascotas.filter(m => {
        // Filtro por estado
        if (currentFilter !== 'todos' && m.estado.toLowerCase() !== currentFilter) {
            return false;
        }
        // Búsqueda por texto
        if (searchTerm && !m.nombre.toLowerCase().includes(searchTerm) && !m.ubicacion.toLowerCase().includes(searchTerm)) {
            return false;
        }
        return true;
    });

    const bounds = [];

    filtered.forEach(mascota => {
        if (!mascota.lat || !mascota.lng) return;

        const defaultImg = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60';
        const imgToUse = mascota.foto_url || defaultImg;
        const isOwner = user && user.id === mascota.usuario_id;
        
        let statusClass = mascota.estado.toLowerCase() === 'perdido' ? 'status-perdido' : 'status-encontrado';

        // HTML del Popup
        let popupHTML = `
            <div class="custom-popup">
                <img src="${imgToUse}" class="popup-img" onerror="this.src='${defaultImg}'">
                <div class="popup-details">
                    <span class="popup-status ${statusClass}">${mascota.estado.toUpperCase()}</span>
                    <h3 class="popup-title">${mascota.nombre}</h3>
                    <p class="popup-location">📍 ${mascota.ubicacion}</p>
                    <p style="font-size: 0.9rem; margin-bottom: 10px;">${mascota.descripcion}</p>
                    <p style="font-size: 0.75rem; color: #A0AEC0;">Reportado por: ${mascota.autor || 'Desconocido'}</p>
        `;

        if (isOwner) {
            popupHTML += `<div class="popup-actions">`;
            if (mascota.estado.toLowerCase() === 'perdido') {
                popupHTML += `<button class="popup-btn btn-edit" onclick="toggleEstado(${mascota.id}, 'Encontrado')">¡Encontrado!</button>`;
            } else {
                popupHTML += `<button class="popup-btn btn-edit" onclick="toggleEstado(${mascota.id}, 'Perdido')">Se Perdió</button>`;
            }
            popupHTML += `<button class="popup-btn btn-delete" onclick="eliminarAviso(${mascota.id})">Borrar</button></div>`;
        }

        // Botón para abrir el modal (siempre visible para todos)
        popupHTML += `<button class="btn-primary" style="margin-top: 10px; width: 100%; padding: 8px; font-size: 0.8rem;" onclick='openModal(${JSON.stringify(mascota).replace(/'/g, "&apos;")})'>Ver Detalles y Comentarios</button>`;

        popupHTML += `</div></div>`;

        const marker = L.marker([mascota.lat, mascota.lng]).addTo(mainMap);
        marker.bindPopup(popupHTML);
        mapMarkers.push(marker);
        bounds.push([mascota.lat, mascota.lng]);
    });

    // Si hay pines y no es la primera carga (esto es opcional, a veces es molesto que se mueva el mapa al filtrar)
    // if (bounds.length > 0) { mainMap.fitBounds(bounds, { padding: [50, 50] }); }
}

// Función global para manejar los botones de filtro
window.setFilter = function(filterValue, btnElement) {
    currentFilter = filterValue;
    
    // Actualizar clases de los botones
    document.querySelectorAll('.chip').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    
    applyFilters();
}

// --- Acciones de Dueño ---

window.toggleEstado = async function(id, nuevoEstado) {
    const user = JSON.parse(localStorage.getItem('huellasegura_user'));
    if (!user) return;

    try {
        const res = await fetch(`${API_URL}/mascotas/${id}/estado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: nuevoEstado, usuario_id: user.id })
        });
        
        if (res.ok) {
            // Recargar datos y aplicar filtros
            loadMascotas();
        } else {
            const data = await res.json();
            alert(data.error || "Error al cambiar el estado");
        }
    } catch (err) {
        alert("Error de conexión");
    }
}

window.eliminarAviso = async function(id) {
    if (!confirm("¿Estás seguro de que quieres eliminar este aviso? Esta acción no se puede deshacer.")) return;
    
    const user = JSON.parse(localStorage.getItem('huellasegura_user'));
    if (!user) return;

    try {
        const res = await fetch(`${API_URL}/mascotas/${id}?usuario_id=${user.id}`, {
            method: 'DELETE'
        });
        
        if (res.ok) {
            loadMascotas();
        } else {
            const data = await res.json();
            alert(data.error || "Error al eliminar el aviso");
        }
    } catch (err) {
        alert("Error de conexión");
    }
}


// --- Modal y Comentarios ---
let currentMascotaId = null;

window.openModal = function(mascota) {
    currentMascotaId = mascota.id;
    const modal = document.getElementById('pet-modal');
    const infoContainer = document.getElementById('modal-info-container');
    const defaultImg = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60';
    const imgToUse = mascota.foto_url || defaultImg;
    
    let statusClass = mascota.estado.toLowerCase() === 'perdido' ? 'status-perdido' : 'status-encontrado';

    infoContainer.innerHTML = `
        <img src="${imgToUse}" alt="Foto" onerror="this.src='${defaultImg}'">
        <span class="popup-status ${statusClass}">${mascota.estado.toUpperCase()}</span>
        <h2 style="color: var(--primary); font-size: 2rem; margin-bottom: 10px;">${mascota.nombre}</h2>
        <p style="font-weight: 600; color: var(--text-main); margin-bottom: 15px;">📍 ${mascota.ubicacion}</p>
        <p style="color: var(--text-main); line-height: 1.6; margin-bottom: 20px;">${mascota.descripcion}</p>
        <p style="font-size: 0.9rem; color: var(--text-muted);">Reportado por: <strong>${mascota.autor || 'Desconocido'}</strong></p>
    `;

    modal.classList.remove('hidden');
    loadComentarios(mascota.id);
}

window.closeModal = function() {
    document.getElementById('pet-modal').classList.add('hidden');
    currentMascotaId = null;
}

async function loadComentarios(mascotaId) {
    const list = document.getElementById('comments-list');
    list.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Cargando...</p>';

    try {
        const res = await fetch(`${API_URL}/mascotas/${mascotaId}/comentarios`);
        const comentarios = await res.json();
        
        list.innerHTML = '';
        if (comentarios.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No hay comentarios aún. ¡Sé el primero en ayudar!</p>';
            return;
        }

        comentarios.forEach(c => {
            const date = new Date(c.fecha).toLocaleString();
            list.innerHTML += `
                <div class="comment-item">
                    <div class="comment-author">${c.autor}</div>
                    <div class="comment-text">${c.texto}</div>
                    <span class="comment-date">${date}</span>
                </div>
            `;
        });
        list.scrollTop = list.scrollHeight;
    } catch (err) {
        list.innerHTML = '<p style="color: red;">Error al cargar comentarios.</p>';
    }
}

const commentForm = document.getElementById('comment-form');
if (commentForm) {
    commentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = JSON.parse(localStorage.getItem('huellasegura_user'));
        if (!user) {
            alert('Debes iniciar sesión para comentar.');
            return;
        }
        
        const textInput = document.getElementById('comment-text');
        const texto = textInput.value;

        if (!currentMascotaId || !texto) return;

        try {
            const res = await fetch(`${API_URL}/mascotas/${currentMascotaId}/comentarios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texto, usuario_id: user.id })
            });

            if (res.ok) {
                textInput.value = '';
                loadComentarios(currentMascotaId);
            }
        } catch (err) {
            alert("Error enviando comentario");
        }
    });
}

// --- Crear Aviso ---

// Inicializar mapa de crear aviso (si estamos en esa página)
const formMapContainer = document.getElementById('form-map');
let formMap = null;
let currentMarker = null;

if (formMapContainer) {
    // Centro por defecto
    formMap = L.map('form-map').setView([-33.4489, -70.6693], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(formMap);

    // Intentar centrar en la ubicación real del usuario
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            formMap.setView([position.coords.latitude, position.coords.longitude], 14);
        });
    }

    formMap.on('click', async function(e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        
        // Guardar coordenadas en los inputs ocultos
        document.getElementById('mascota-lat').value = lat;
        document.getElementById('mascota-lng').value = lng;

        // Poner o mover el marcador
        if (currentMarker) {
            currentMarker.setLatLng(e.latlng);
        } else {
            currentMarker = L.marker(e.latlng).addTo(formMap);
        }

        // Obtener la dirección automáticamente (Reverse Geocoding usando Nominatim)
        const ubicacionInput = document.getElementById('mascota-ubicacion');
        ubicacionInput.placeholder = "Buscando dirección...";
        
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
            const data = await response.json();
            if (data && data.display_name) {
                // Tomar una versión simplificada de la dirección si es posible, o usar la completa
                let direccion = "";
                if (data.address.road) {
                    direccion = data.address.road;
                    if (data.address.house_number) direccion += " " + data.address.house_number;
                    if (data.address.city || data.address.town || data.address.village) {
                        direccion += ", " + (data.address.city || data.address.town || data.address.village);
                    }
                } else {
                    direccion = data.display_name.split(',').slice(0, 3).join(',');
                }
                ubicacionInput.value = direccion;
            } else {
                ubicacionInput.placeholder = "Lugar donde se perdió / encontró";
            }
        } catch (error) {
            console.error("Error obteniendo dirección:", error);
            ubicacionInput.placeholder = "Lugar donde se perdió / encontró";
        }
    });
}

const crearAvisoForm = document.getElementById('crear-aviso-form');
if (crearAvisoForm) {
    crearAvisoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = JSON.parse(localStorage.getItem('huellasegura_user'));
        if (!user) return;

        const nombre = document.getElementById('mascota-nombre').value;
        const ubicacion = document.getElementById('mascota-ubicacion').value;
        const lat = document.getElementById('mascota-lat').value;
        const lng = document.getElementById('mascota-lng').value;
        const fotoInput = document.getElementById('mascota-foto');
        const descripcion = document.getElementById('mascota-desc').value;
        const errorMsg = document.getElementById('aviso-error');

        if (!lat || !lng) {
            errorMsg.textContent = 'Por favor, haz clic en el mapa para marcar la ubicación exacta.';
            errorMsg.classList.remove('hidden');
            return;
        }

        // Usar FormData para enviar archivos e información en la misma petición
        const formData = new FormData();
        formData.append('nombre', nombre);
        formData.append('ubicacion', ubicacion);
        formData.append('lat', lat);
        formData.append('lng', lng);
        formData.append('descripcion', descripcion);
        formData.append('usuario_id', user.id);
        
        if (fotoInput.files.length > 0) {
            formData.append('foto', fotoInput.files[0]);
        }

        try {
            const res = await fetch(`${API_URL}/mascotas`, {
                method: 'POST',
                body: formData // Fetch setea automáticamente el Content-Type a multipart/form-data
            });

            if (res.ok) {
                alert('¡Aviso publicado exitosamente!');
                window.location.href = 'index.html';
            } else {
                const data = await res.json();
                errorMsg.textContent = data.error || 'Error al publicar el aviso';
                errorMsg.classList.remove('hidden');
            }
        } catch (err) {
            errorMsg.textContent = 'Error de conexión con el servidor.';
            errorMsg.classList.remove('hidden');
        }
    });
}
