import sqlite3
import os

DATABASE = 'huellasegura.db'

def get_db_connection():
    # Asegura que la base de datos se guarda en la carpeta backend
    db_path = os.path.join(os.path.dirname(__file__), DATABASE)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Tabla Usuarios
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')

    # Tabla Mascotas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS mascotas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            descripcion TEXT NOT NULL,
            ubicacion TEXT NOT NULL,
            lat REAL,
            lng REAL,
            foto_url TEXT,
            estado TEXT DEFAULT 'Perdido',
            usuario_id INTEGER,
            fecha_publicacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    ''')

    # Tabla Comentarios
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS comentarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mascota_id INTEGER NOT NULL,
            usuario_id INTEGER NOT NULL,
            texto TEXT NOT NULL,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (mascota_id) REFERENCES mascotas(id) ON DELETE CASCADE,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    ''')

    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Base de datos inicializada correctamente.")
