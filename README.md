# Redechitas - Sistema de Gestión de Conjuntos Residenciales

Aplicación basada en **microservicios REST** empaquetada en contenedores Docker y desplegada sobre un clúster **Docker Swarm**, con procesamiento de datos a gran escala mediante **Apache Spark** y un dashboard analítico integrado.

---

## Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Microservicios](#microservicios)
4. [Requisitos Previos](#requisitos-previos)
5. [Estructura del Repositorio](#estructura-del-repositorio)
6. [Paso a Paso para Reproducir el Despliegue](#paso-a-paso-para-reproducir-el-despliegue)
7. [Puertos y Endpoints](#puertos-y-endpoints)
8. [Dataset y Análisis con Apache Spark](#dataset-y-análisis-con-apache-spark)
9. [Balanceo de Carga y Escalabilidad](#balanceo-de-carga-y-escalabilidad)
10. [Tecnologías Utilizadas](#tecnologías-utilizadas)

---

## Descripción General

El sistema permite gestionar conjuntos residenciales (torres, apartamentos, parqueaderos, usuarios y pagos) a través de una arquitectura de microservicios. Cada microservicio tiene su propia base de datos MySQL, se comunica por una red overlay privada de Docker Swarm y es accesible desde el frontend a través de HAProxy como proxy inverso y balanceador de carga.

El microservicio número 4 integra un clúster de Apache Spark para el procesamiento distribuido de datasets abiertos (CSV), generando reportes estadísticos que se visualizan en el dashboard del panel operacional.

---

## Arquitectura del Sistema

```
imagen imagenosa

Flujo de una petición del usuario:
  Browser -> Nginx Frontend (:80) -> api -> HAProxy (:8080)
          -> MS1 | MS2 | MS3 -> MySQL
          -> MS4 -> Spark Master -> Spark Workers -> JSON results -> Dashboard

Flujo del procesamiento Spark:
  CSVs (csv_data vol.) -> spark_processor.py (spark-submit)
    -> Spark Workers (cómputo distribuido)
    -> JSON resultados (spark_results vol.)
    -> MS4 FastAPI sirve los reportes al Dashboard
```

**Red:** `red_microservicios` — overlay Docker, compartida entre todos los nodos del Swarm.

---

## Microservicios

| Servicio | Tecnología | Puerto interno | Base de datos | Imagen Docker |
|---|---|---|---|---|
| **MS1** – Usuarios | Node.js 20 / Express | 3000 | `usuarios_db` (MySQL 8) | `emmanuelescobar2007/ms1-usuarios` |
| **MS2** – Propiedades | Node.js 20 / Express | 3001 | `propiedades_db` (MySQL 8) | `emmanuelescobar2007/ms2-propiedades` |
| **MS3** – Gestión y Pagos | Node.js 20 / Express | 3002 | `residencias_gestion` (MySQL 8) | `emmanuelescobar2007/ms3-gestion` |
| **MS4** – Analytics | Python 3.11 / FastAPI + PySpark | 3003 | — (CSVs en volumen compartido) | `emmanuelescobar2007/ms4-analytics` |
| **HAProxy** | HAProxy 2.9 Alpine | 80 / 8404 | — | `haproxy:2.9-alpine` |
| **Frontend** | Nginx + HTML/JS | 80 | — | `emmanuelescobar2007/mv2-frontend` |
| **Spark Master** | Apache Spark 3.5.1 | 7077 / 8081 | — | `apache/spark:3.5.1` |
| **Spark Worker** | Apache Spark 3.5.1 | — | — | `apache/spark:3.5.1` (×2 réplicas) |

### MS1 – Gestión de Usuarios
Maneja el ciclo de vida de usuarios (administrador, arrendatario, arrendador). Incluye autenticación por JWT, cambio de contraseña obligatorio en el primer inicio de sesión y creación automática del superadmin al arrancar via `entrypoint.sh`.

**Rutas principales:** `POST /api/login`, `GET|POST|PUT|DELETE /api/usuarios`

### MS2 – Gestión de Propiedades
Administra la jerarquía física del conjunto: conjuntos -> torres -> apartamentos -> parqueaderos.

**Rutas principales:** `/api/conjuntos`, `/api/torres`, `/api/apartamentos`, `/api/parqueaderos`

### MS3 – Gestión y Pagos
Controla las asignaciones de apartamentos a residentes y el registro de pagos de administración. Consume internamente MS1 y MS2.

**Rutas principales:** `/api/gestiones`, `/api/pagos`

### MS4 – Analytics Service (Spark-powered)
Servicio FastAPI que coordina el clúster de Spark para procesar datasets CSV y servir resultados pre-computados al dashboard. Soporta consultas on-demand (tendencia, correlación, cruce de variables).

**Rutas principales:**

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/analytics/spark/run` | Lanza el job PySpark en background |
| GET | `/api/analytics/spark/status` | Estado del último job |
| GET | `/api/analytics/datasets` | Lista CSVs disponibles |
| GET | `/api/analytics/datasets/{file}/preview` | Preview del dataset |
| GET | `/api/analytics/reports/resumen` | Resumen general de todos los datasets |
| GET | `/api/analytics/reports/estadisticas/{file}` | Estadísticas descriptivas |
| GET | `/api/analytics/reports/frecuencias/{file}/{col}` | Frecuencias por columna |
| GET | `/api/analytics/reports/nulos/{file}` | Análisis de valores nulos |
| GET | `/api/analytics/reports/tendencia/{file}` | Tendencia temporal |
| GET | `/api/analytics/reports/correlacion/{file}` | Matriz de correlación |
| GET | `/api/analytics/reports/cruce` | Cruce entre dos columnas |

---

## Requisitos Previos

- **Docker Engine** ≥ 24.x instalado en todos los nodos
- **Docker Swarm** inicializado (mínimo 1 manager + 1 worker)
- Acceso a **Docker Hub** (para pull de imágenes públicas)
- Puertos **80, 8080, 8081, 8404** disponibles en el nodo manager
- Puerto **80** disponible en el nodo worker (frontend)

---

## Estructura del Repositorio

```
proyecto_final_infraestructura_v100/
│
├── docker-compose.yml              # Definición completa del stack Swarm
│
├── haproxy/
│   └── haproxy.cfg                 # Configuración de rutas y backends HAProxy
│
├── ms1-usuarios/                   # Microservicio de Usuarios
│   ├── Dockerfile
│   ├── entrypoint.sh               # Espera DB + crea superadmin + arranca app
│   ├── package.json
│   ├── setup_superadmin.js
│   ├── sql/script_sql_usuario.sql  # DDL + triggers de validación de rol
│   └── src/
│       ├── index.js
│       ├── controllers/usuarios_controllers.js
│       └── models/usuarios_model.js
│
├── ms2-propiedades/                # Microservicio de Propiedades
│   ├── Dockerfile
│   ├── package.json
│   ├── sql/script_sql_propiedades.sql
│   └── src/
│       ├── index.js
│       ├── controllers/            # conjunto, torre, apartamento, parqueadero
│       └── models/
│
├── ms3-gestion/                    # Microservicio de Gestión y Pagos
│   ├── Dockerfile
│   ├── package.json
│   ├── sql/script_sql_gestion.sql
│   └── src/
│       ├── index.js
│       ├── controllers/            # gestionController, pagosController
│       └── models/                 # gestionModel, pagosModel
│
├── ms4-analytics/                  # Microservicio Analytics + Spark
│   ├── Dockerfile                  # Python 3.11 + OpenJDK 21 + PySpark
│   ├── requirements.txt            # fastapi, uvicorn, pandas, pyspark==3.5.1
│   ├── app.py                      # FastAPI con todos los endpoints analytics
│   └── spark_processor.py          # Job PySpark 
│
└── MV2_frontend/                   # Interfaz Web
    ├── Dockerfile
    ├── nginx.conf                  # Proxy /api/* -> HAProxy
    └── html/
        ├── index.html              # Página principal
        ├── login.html
        ├── auth.js                 # Manejo de sesión 
        ├── cambiar_password.html
        ├── capasFront-ms1/         # Páginas CRUD de Usuarios
        ├── capasFront-ms2/         # Páginas CRUD de Propiedades
        ├── capasFront-ms3/         # Páginas CRUD de Gestión y Pagos
        └── capasFront-ms4/
            └── dashboard.html      # Panel operacional con gráficas 
```

---

## Paso a Paso para Reproducir el Despliegue

### 1. Iniciar e ingresar a las maquinas virtuales

```bash
vagrant up
vagrant ssh servidorUbuntu1
```

```bash
vagrant ssh servidorUbuntu2
```

### 2. Clonar el repositorio

Dentro de servidorUbuntu1
```bash
git clone https://github.com/Bl4ck-Grimoire/Redechitas.git
```

### 3. Inicializar Docker Swarm

En el servidorUbuntu1:

```bash
docker swarm init --advertise-addr 192.168.100.2
```

Se obtiene el token para unir los workers:

```bash
docker swarm join-token worker
```

En servidorUbuntu2 ejecutar:

```bash
docker swarm join --token <TOKEN> 192.168.100.3:2377
```

Verificar que el clúster está activo:

```bash
docker node ls
```

### 4. Cargar los CSVs del dataset en el volumen de Spark

Antes de desplegar el stack, crea el volumen y copia los archivos CSV del dataset:

```bash
# Crear el volumen manualmente en el manager
docker volume create microservicios-docker_csv_data

# Copiar los CSVs al volumen usando un contenedor auxiliar
docker run --rm \
  -v microservicios-docker_csv_data:/data/csvs \
  -v $(pwd)/dataset:/source \
  alpine sh -c "cp /source/*.csv /data/csvs/"
```

> 💡 Coloca tus archivos CSV en una carpeta `dataset/` en la raíz del proyecto antes de ejecutar este paso.

### 5. Desplegar el stack en Docker Swarm

```bash
cd Redechitas
docker stack deploy -c docker-compose.yml microservicios-docker
```

### 6. Verificar el estado de los servicios

```bash
# Ver todos los servicios del stack
docker service ls

# Ver el estado detallado de cada tarea
docker stack ps microservicios-docker
```

Espera a que todos los servicios estén en estado `Running`. Las bases de datos MySQL pueden tardar hasta 3 minutos en inicializarse por primera vez (el `healthcheck` controla esto).

### 8. Acceder a la aplicación

| Interfaz | URL |
|---|---|
| **Frontend (aplicación)** | `http://192.168.100.3:80` |
| **API Gateway (HAProxy)** | `http://192.168.100.2:8080` |
| **HAProxy Stats** | `http://192.168.100.3:8404/stats` |
| **Spark Master UI** | `http://192.168.100.3:8081` |

### 9. Credenciales iniciales

Al arrancar MS1, el `entrypoint.sh` crea automáticamente un usuario superadmin para la gestion completa de la aplicación. Revisa los logs para obtener las credenciales generadas:

```bash
docker service logs microservicios-docker_MS1
```

---

## Puertos y Endpoints

### Enrutamiento HAProxy

HAProxy escucha en el puerto `8080` y distribuye las peticiones según el prefijo de la ruta:

| Prefijo de ruta | Backend | Servicio |
|---|---|---|
| `/api/login`, `/api/usuarios` | `ms1_back` | MS1 – Usuarios |
| `/api/conjuntos`, `/api/torres`, `/api/apartamentos`, `/api/parqueaderos` | `ms2_back` | MS2 – Propiedades |
| `/api/gestiones`, `/api/pagos` | `ms3_back` | MS3 – Gestión |
| `/api/analytics` | `ms4_back` | MS4 – Analytics |

---

## Dataset y Análisis con Apache Spark

### Flujo de procesamiento

```
CSVs en volumen csv_data
        │
        ▼
spark_processor.py 
  -> Lee cada CSV con PySpark
  -> Calcula: estadísticas, frecuencias, nulos, tendencia temporal, correlaciones
  -> Guarda resultados como JSON en volumen spark_results
        │
        ▼
MS4 FastAPI
  -> Lee los JSON 
        │
        ▼
Dashboard 
  -> Visualización de los reportes
```

### Clúster de Spark

| Componente | Configuración |
|---|---|
| Spark Master | 1 réplica, nodo manager, UI en `:8081`, protocolo en `:7077` |
| Spark Worker | 2 réplicas, nodos worker, 1 GB RAM / 2 cores c/u |
| Versión | Apache Spark 3.5.1 |
| Shuffle partitions | 4 (optimizado para clúster pequeño) |

### Escalar workers de Spark

Para aumentar la capacidad de procesamiento:

```bash
docker service scale microservicios-docker_spark-worker=4
# cambiar el "=4" por la cantidad necesaria
```

---

## Balanceo de Carga y Escalabilidad

El sistema usa Docker Swarm con modo `dnsrr` para los microservicios backend, y HAProxy como punto de entrada único con balanceo `roundrobin`.

### Escalar un microservicio

```bash
# Escalar MS1 a 3 replicas
docker service scale microservicios-docker_MS1=3

# Escalar MS2 a 2 replicas
docker service scale microservicios-docker_MS2=2
```

HAProxy detecta automáticamente las nuevas réplicas mediante el resolver DNS interno de Docker (`127.0.0.11:53`) y comienza a distribuir tráfico hacia ellas sin necesidad de reiniciar nada.

### Health checks de HAProxy

- **Intervalo de chequeo:** 10 segundos (15s para MS4)
- **Marcar como disponible:** 2 chequeos exitosos consecutivos (`rise 2`)
- **Marcar como caído:** 3 chequeos fallidos consecutivos (`fall 3`)
- **Timeout extendido MS4:** 300s 

---


## Tecnologías Utilizadas

| Categoría | Tecnología |
|---|---|
| Orquestación de contenedores | Docker Swarm |
| Proxy inverso / Load Balancer | HAProxy 2.9 |
| Servidor web / Frontend | Nginx + HTML5 / JavaScript |
| Microservicios backend | Node.js 20 + Express |
| Microservicio analytics | Python 3.11 + FastAPI + Uvicorn |
| Motor de base de datos | MySQL 8.0 |
| Procesamiento distribuido | Apache Spark 3.5.1 (PySpark) |
| Visualización de datos | Chart.js 4.4 |
| Autenticación | JWT (JSON Web Tokens) |
| JDK (para Spark en MS4) | OpenJDK 21 |
