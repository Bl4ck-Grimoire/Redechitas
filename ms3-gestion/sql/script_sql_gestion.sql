-- Crear base de datos
CREATE DATABASE IF NOT EXISTS residencias_gestion
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE residencias_gestion;

-- -----------------------------------------------------
-- Tabla: gestion_propiedades
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS gestion_propiedades (
  id INT NOT NULL AUTO_INCREMENT,
  usuario_id INT NOT NULL,
  apartamento_id INT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  
  UNIQUE KEY uq_apto_activa (apartamento_id)

) ENGINE=InnoDB;


-- -----------------------------------------------------
-- Tabla: pago_administracion
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS pago_administracion (
  id INT NOT NULL AUTO_INCREMENT,
  monto INT NOT NULL,
  
  mes_facturacion ENUM(
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre'
  ) NOT NULL,
  
  anio_facturacion INT NOT NULL,
  
  estado ENUM('vencido','pendiente','pagado') NOT NULL,
  
  fecha_pago DATE DEFAULT NULL,
  
  gestion_propiedades_id INT NOT NULL,

  PRIMARY KEY (id),

  INDEX fk_pago_administracion_gestion_propiedades_idx (gestion_propiedades_id),

  CONSTRAINT fk_pago_administracion_gestion_propiedades
    FOREIGN KEY (gestion_propiedades_id)
    REFERENCES gestion_propiedades(id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION

) ENGINE=InnoDB;

-- Ejecutar en la BD residencias_gestion
-- Agrega las columnas para almacenar datos enriquecidos de MS1 y MS2 directamente

USE residencias_gestion;

ALTER TABLE gestion_propiedades
  ADD COLUMN nombre_usuario     VARCHAR(100) NULL AFTER apartamento_id,
  ADD COLUMN email_usuario      VARCHAR(100) NULL AFTER nombre_usuario,
  ADD COLUMN rol_usuario        VARCHAR(50)  NULL AFTER email_usuario,
  ADD COLUMN numero_apartamento VARCHAR(20)  NULL AFTER rol_usuario,
  ADD COLUMN piso_apartamento   INT          NULL AFTER numero_apartamento,
  ADD COLUMN estado_apartamento VARCHAR(20)  NULL AFTER piso_apartamento;
