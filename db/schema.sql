-- Esquema de BiciSegura Lima (PostgreSQL 16). Idempotente: se aplica en cada arranque.
CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(80)  NOT NULL,
  email         VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS distritos (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL UNIQUE,
  lat    NUMERIC(9,6) NOT NULL,
  lng    NUMERIC(9,6) NOT NULL
);

-- Un evento reportado por un ciclista (incluye estacionamientos seguros)
CREATE TABLE IF NOT EXISTS eventos (
  id                     SERIAL PRIMARY KEY,
  tipo                   VARCHAR(30) NOT NULL CHECK (tipo IN ('robo','accidente','mal_estado','vehiculo_ciclovia',
                           'calle_enrejada','ciclovia_interrumpida','estacionamiento')),
  lat                    NUMERIC(9,6) NOT NULL CHECK (lat BETWEEN -12.55 AND -11.57),
  lng                    NUMERIC(9,6) NOT NULL CHECK (lng BETWEEN -77.20 AND -76.62),
  calle                  VARCHAR(120) NOT NULL,
  distrito_id            INT NOT NULL REFERENCES distritos(id),
  descripcion            VARCHAR(280),
  autor_id               INT NOT NULL REFERENCES usuarios(id),
  creado_en              TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultima_confirmacion_en TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_eventos_creado ON eventos (creado_en);
CREATE INDEX IF NOT EXISTS idx_eventos_distrito ON eventos (distrito_id);
CREATE INDEX IF NOT EXISTS idx_eventos_autor_fecha ON eventos (autor_id, creado_en);

-- Validación comunitaria: un voto (confirma / desmiente) por persona por evento
CREATE TABLE IF NOT EXISTS votos (
  evento_id  INT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  usuario_id INT NOT NULL REFERENCES usuarios(id),
  voto       VARCHAR(10) NOT NULL CHECK (voto IN ('confirma','desmiente')),
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (evento_id, usuario_id)
);

-- Votos de "ya no está" para cerrar eventos persistentes: uno por persona por evento
CREATE TABLE IF NOT EXISTS cierres (
  evento_id  INT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  usuario_id INT NOT NULL REFERENCES usuarios(id),
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (evento_id, usuario_id)
);
