from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from models import init_db, get_db_connection
import sqlite3
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
# Configuración para subida de archivos
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
# Habilitar CORS para permitir peticiones desde el frontend
CORS(app)

# Inicializar la base de datos al arrancar
init_db()

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({'error': 'Faltan datos requeridos'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Nota: En un entorno de producción, la contraseña DEBE ser encriptada (hasheada)
        cursor.execute(
            'INSERT INTO usuarios (username, email, password) VALUES (?, ?, ?)',
            (username, email, password)
        )
        conn.commit()
        return jsonify({'message': 'Usuario registrado exitosamente'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'El usuario o el correo ya existen'}), 409
    finally:
        conn.close()

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Faltan datos requeridos'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    usuario = cursor.execute(
        'SELECT * FROM usuarios WHERE username = ? AND password = ?',
        (username, password)
    ).fetchone()
    conn.close()

    if usuario:
        # Retornamos el ID de usuario para guardarlo en localStorage en el frontend
        return jsonify({
            'message': 'Inicio de sesión exitoso',
            'user': {'id': usuario['id'], 'username': usuario['username']}
        }), 200
    else:
        return jsonify({'error': 'Credenciales inválidas'}), 401


@app.route('/api/mascotas', methods=['GET'])
def get_mascotas():
    conn = get_db_connection()
    cursor = conn.cursor()
    mascotas = cursor.execute('''
        SELECT m.*, u.username as autor 
        FROM mascotas m 
        LEFT JOIN usuarios u ON m.usuario_id = u.id
        ORDER BY m.fecha_publicacion DESC
    ''').fetchall()
    conn.close()
    
    mascotas_list = [dict(ix) for ix in mascotas]
    return jsonify(mascotas_list), 200

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/mascotas', methods=['POST'])
def create_mascota():
    # Usar request.form porque enviamos multipart/form-data
    nombre = request.form.get('nombre')
    descripcion = request.form.get('descripcion')
    ubicacion = request.form.get('ubicacion')
    lat = request.form.get('lat')
    lng = request.form.get('lng')
    usuario_id = request.form.get('usuario_id')
    
    foto_url = ""
    # Manejar el archivo de imagen
    if 'foto' in request.files:
        file = request.files['foto']
        if file and file.filename != '':
            filename = secure_filename(file.filename)
            # Añadir timestamp para evitar sobreescribir archivos con el mismo nombre
            import time
            filename = f"{int(time.time())}_{filename}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            # Guardamos la ruta relativa que el frontend puede usar
            foto_url = f"http://localhost:5000/uploads/{filename}"

    if not nombre or not descripcion or not ubicacion or not usuario_id:
        return jsonify({'error': 'Faltan datos requeridos'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO mascotas (nombre, descripcion, ubicacion, lat, lng, foto_url, usuario_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (nombre, descripcion, ubicacion, lat, lng, foto_url, usuario_id)
    )
    conn.commit()
    conn.close()

    return jsonify({'message': 'Aviso de mascota creado exitosamente'}), 201

@app.route('/api/mascotas/<int:id>/estado', methods=['PUT'])
def update_mascota_estado(id):
    data = request.json
    nuevo_estado = data.get('estado')
    usuario_id = data.get('usuario_id')

    if not nuevo_estado or not usuario_id:
        return jsonify({'error': 'Faltan datos requeridos'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar que la mascota existe y pertenece al usuario
    mascota = cursor.execute('SELECT * FROM mascotas WHERE id = ?', (id,)).fetchone()
    if not mascota:
        conn.close()
        return jsonify({'error': 'Mascota no encontrada'}), 404
    if mascota['usuario_id'] != usuario_id:
        conn.close()
        return jsonify({'error': 'No tienes permiso para modificar este aviso'}), 403

    cursor.execute('UPDATE mascotas SET estado = ? WHERE id = ?', (nuevo_estado, id))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Estado actualizado exitosamente'}), 200

@app.route('/api/mascotas/<int:id>', methods=['DELETE'])
def delete_mascota(id):
    usuario_id = request.args.get('usuario_id', type=int)

    if not usuario_id:
        return jsonify({'error': 'Faltan datos requeridos'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    
    mascota = cursor.execute('SELECT * FROM mascotas WHERE id = ?', (id,)).fetchone()
    if not mascota:
        conn.close()
        return jsonify({'error': 'Mascota no encontrada'}), 404
    if mascota['usuario_id'] != usuario_id:
        conn.close()
        return jsonify({'error': 'No tienes permiso para eliminar este aviso'}), 403

    cursor.execute('DELETE FROM mascotas WHERE id = ?', (id,))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Aviso eliminado exitosamente'}), 200

# --- Rutas de Comentarios ---

@app.route('/api/mascotas/<int:id>/comentarios', methods=['GET'])
def get_comentarios(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    comentarios = cursor.execute('''
        SELECT c.*, u.username as autor 
        FROM comentarios c
        JOIN usuarios u ON c.usuario_id = u.id
        WHERE c.mascota_id = ?
        ORDER BY c.fecha ASC
    ''', (id,)).fetchall()
    conn.close()
    
    return jsonify([dict(c) for c in comentarios]), 200

@app.route('/api/mascotas/<int:id>/comentarios', methods=['POST'])
def create_comentario(id):
    data = request.json
    texto = data.get('texto')
    usuario_id = data.get('usuario_id')

    if not texto or not usuario_id:
        return jsonify({'error': 'Faltan datos'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO comentarios (mascota_id, usuario_id, texto) VALUES (?, ?, ?)',
        (id, usuario_id, texto)
    )
    conn.commit()
    conn.close()

    return jsonify({'message': 'Comentario añadido'}), 201

if __name__ == '__main__':
    # Ejecuta la aplicación en el puerto 5000
    app.run(debug=True, port=5000)
