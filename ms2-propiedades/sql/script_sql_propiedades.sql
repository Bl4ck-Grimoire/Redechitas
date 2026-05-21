CREATE DATABASE IF NOT EXISTS propiedades_db;
USE propiedades_db;

CREATE TABLE IF NOT EXISTS conjunto (
  `id`              INT NOT NULL AUTO_INCREMENT,
  `nombre_conjunto` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS torre (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `nombre`      VARCHAR(50) NOT NULL,
  `num_pisos`   INT NOT NULL,
  `conjunto_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_torre_conjunto1`
    FOREIGN KEY (`conjunto_id`) REFERENCES conjunto (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS apartamento (
  `id`       INT NOT NULL AUTO_INCREMENT,
  `numero`   VARCHAR(20) NOT NULL,
  `piso`     INT NOT NULL,
  `torre_id` INT NOT NULL,
  `estado`   ENUM('disponible','ocupado') NULL DEFAULT 'disponible',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_apto_torre` (`numero`, `torre_id`),
  CONSTRAINT `fk_apto_torre`
    FOREIGN KEY (`torre_id`) REFERENCES torre (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parqueadero (
  `id`             INT NOT NULL AUTO_INCREMENT,
  `numero`         VARCHAR(20) NOT NULL,
  `tipo`           ENUM('privado','publico') NOT NULL,
  `apartamento_id` INT NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `numero` (`numero`),
  CONSTRAINT `fk_parq_apto`
    FOREIGN KEY (`apartamento_id`) REFERENCES apartamento (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TRIGGER trg_parq_publico_no_id_apto
BEFORE INSERT ON parqueadero FOR EACH ROW
BEGIN
  IF NEW.tipo = 'publico' AND NEW.apartamento_id IS NOT NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Parqueadero público no puede tener apartamento asociado';
  END IF;
END;

CREATE TRIGGER trg_parq_publico_no_id_apto_up
BEFORE UPDATE ON parqueadero FOR EACH ROW
BEGIN
  IF NEW.tipo = 'publico' AND NEW.apartamento_id IS NOT NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Parqueadero público no puede tener apartamento asociado';
  END IF;
END;

CREATE TRIGGER trg_torre_apto_pisos_no_negativo
BEFORE INSERT ON torre FOR EACH ROW
BEGIN
  IF NEW.num_pisos < 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Número de pisos de torre no puede ser negativo';
  END IF;
END;

CREATE TRIGGER trg_torre_pisos_no_neg_up
BEFORE UPDATE ON torre FOR EACH ROW
BEGIN
  IF NEW.num_pisos < 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Número de pisos de torre no puede ser negativo';
  END IF;
END;

CREATE TRIGGER trg_apto_piso_rango
BEFORE INSERT ON apartamento FOR EACH ROW
BEGIN
  DECLARE v_pisos_torre INT;
  SELECT num_pisos INTO v_pisos_torre FROM torre WHERE id = NEW.torre_id;
  IF v_pisos_torre IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La torre no existe';
  END IF;
  IF NEW.piso < 1 OR NEW.piso > v_pisos_torre THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El piso del apartamento debe estar dentro del rango de pisos de la torre';
  END IF;
END;

CREATE TRIGGER trg_apto_piso_rango_up
BEFORE UPDATE ON apartamento FOR EACH ROW
BEGIN
  DECLARE v_pisos_torre INT;
  SELECT num_pisos INTO v_pisos_torre FROM torre WHERE id = NEW.torre_id;
  IF v_pisos_torre IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La torre no existe';
  END IF;
  IF NEW.piso < 1 OR NEW.piso > v_pisos_torre THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El piso del apartamento debe estar dentro del rango de pisos de la torre';
  END IF;
END;
