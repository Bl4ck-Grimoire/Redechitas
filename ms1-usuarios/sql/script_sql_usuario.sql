CREATE DATABASE IF NOT EXISTS usuarios_db;
USE usuarios_db;

CREATE TABLE IF NOT EXISTS usuario (
  id INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  telefono VARCHAR(10) NOT NULL,
  email VARCHAR(100) NOT NULL,
  username VARCHAR(50) NULL,
  password_hash VARCHAR(255) NULL,
  rol ENUM('administrador','arrendatario','arrendador') NOT NULL,
  conjunto_id INT NULL,
  password_changed TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY email (email),
  UNIQUE KEY username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- IMPORTANTE: necesario para triggers
DELIMITER $$

-- ─────────────────────────────────────────────
-- INSERT: validación de rol admin
-- ─────────────────────────────────────────────
CREATE TRIGGER validar_rol_admin
BEFORE INSERT ON usuario
FOR EACH ROW
BEGIN
  IF NEW.rol <> 'administrador'
     AND (NEW.username IS NOT NULL OR NEW.password_hash IS NOT NULL) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Solo los administradores pueden tener username y password';
  END IF;
END$$

-- ─────────────────────────────────────────────
-- INSERT: admin obligatorio con credenciales
-- ─────────────────────────────────────────────
CREATE TRIGGER validar_datos_admin
BEFORE INSERT ON usuario
FOR EACH ROW
BEGIN
  IF NEW.rol = 'administrador'
     AND (NEW.username IS NULL OR NEW.password_hash IS NULL) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El administrador debe tener username y password';
  END IF;
END$$

-- ─────────────────────────────────────────────
-- UPDATE: validación de rol admin
-- ─────────────────────────────────────────────
CREATE TRIGGER validar_rol_admin_updt
BEFORE UPDATE ON usuario
FOR EACH ROW
BEGIN
  IF NEW.rol <> 'administrador'
     AND (NEW.username IS NOT NULL OR NEW.password_hash IS NOT NULL) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Solo los administradores pueden tener username y password';
  END IF;
END$$

-- ─────────────────────────────────────────────
-- UPDATE: admin obligatorio con credenciales
-- ─────────────────────────────────────────────
CREATE TRIGGER validar_datos_admin_updt
BEFORE UPDATE ON usuario
FOR EACH ROW
BEGIN
  IF NEW.rol = 'administrador'
     AND (NEW.username IS NULL OR NEW.password_hash IS NULL) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El administrador debe tener username y password';
  END IF;
END$$

DELIMITER ;
