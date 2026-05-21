#!/bin/sh
# Espera a que MySQL esté disponible, luego crea superadmin y arranca la app

echo "Esperando a que db_ms1 esté lista..."
until node -e "
  const mysql = require('mysql2/promise');
  mysql.createConnection({
    host: process.env.DB_HOST || 'db_ms1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Josue2311\$\$',
    database: process.env.DB_NAME || 'usuarios_db'
  }).then(c => { c.end(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  echo "   db_ms1 no lista, reintentando en 3s..."
  sleep 3
done

echo "Base de datos lista."
echo "Ejecutando setup_superadmin..."
node /app/setup_superadmin.js

echo "Iniciando microservicio MS1..."
exec node src/index.js
