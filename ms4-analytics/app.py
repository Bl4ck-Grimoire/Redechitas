"""
MS4 – Analytics Service  v2.0  (Spark-powered)
===============================================
FastAPI que sirve los resultados pre-computados por el clúster de Spark.

Flujo:
  1. spark_processor.py (spark-submit) lee los CSVs y guarda JSON en RESULTS_DIR
  2. Los endpoints de esta API leen esos JSON pre-computados  →  respuesta inmediata
  3. Para queries dinámicos (tendencia ad-hoc, cruce, correlación) se usa
     PySpark on-demand con una sesión persistente (lazy)
  4. POST /api/analytics/spark/run    →  lanza el job de Spark en background
  5. GET  /api/analytics/spark/status →  estado del último job
"""

import os
import glob
import json
import math
import subprocess
import threading
from pathlib import Path
from datetime import datetime

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

# ── Config ─────────────────────────────────────────────────────────────────

DATA_DIR       = os.getenv("DATA_DIR",    "/data/csvs")
RESULTS_DIR    = os.getenv("RESULTS_DIR", "/data/results")
SPARK_MASTER   = os.getenv("SPARK_MASTER","spark://spark-master:7077")
DASHBOARD_HTML = Path(__file__).parent / "dashboard.html"
PROCESSOR_PATH = Path(__file__).parent / "spark_processor.py"

Path(RESULTS_DIR).mkdir(parents=True, exist_ok=True)

app = FastAPI(title="MS4 – Analytics Service", version="2.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"]
)

# ── SparkSession singleton (para queries on-demand) ─────────────────────────

_spark_session = None
_spark_lock    = threading.Lock()

def get_spark():
    """Devuelve (o crea) una SparkSession persistente para queries ad-hoc."""
    global _spark_session
    if _spark_session is not None:
        return _spark_session
    with _spark_lock:
        if _spark_session is None:
            from pyspark.sql import SparkSession
            _spark_session = (
                SparkSession.builder
                .appName("MS4-Analytics-API")
                .master(SPARK_MASTER)
                .config("spark.sql.shuffle.partitions", "4")
                .config("spark.driver.memory", "512m")
                .config("spark.executor.memory", "512m")
                .getOrCreate()
            )
            _spark_session.sparkContext.setLogLevel("WARN")
    return _spark_session

# ── Spark Job state ─────────────────────────────────────────────────────────

_job: dict = {
    "estado":   "no_iniciado",   # no_iniciado | corriendo | completado | error
    "inicio":   None,
    "fin":      None,
    "mensaje":  "El job de Spark no se ha ejecutado aún.",
    "resultados_generados": 0,
}
_job_lock = threading.Lock()

def _spark_submit_path() -> str:
    """Localiza spark-submit en el entorno (pip-installed PySpark o sistema)."""
    import pyspark
    candidate = Path(pyspark.__file__).parent / "bin" / "spark-submit"
    if candidate.exists():
        return str(candidate)
    return "spark-submit"   # fallback: en PATH del sistema

def _run_spark_job_thread():
    global _job
    with _job_lock:
        _job.update(estado="corriendo", inicio=datetime.now().isoformat(),
                    fin=None, mensaje="Job en ejecución…", resultados_generados=0)
    try:
        result = subprocess.run(
            [
                _spark_submit_path(),
                "--master", SPARK_MASTER,
                "--conf",   "spark.sql.shuffle.partitions=4",
                "--conf",   "spark.driver.memory=512m",
                "--conf",   "spark.executor.memory=512m",
                str(PROCESSOR_PATH),
            ],
            capture_output=True, text=True, timeout=600,
            env={
                **os.environ,
                "DATA_DIR":    DATA_DIR,
                "RESULTS_DIR": RESULTS_DIR,
                "SPARK_MASTER": SPARK_MASTER,
            },
        )
        n = len(list(Path(RESULTS_DIR).glob("*.json")))
        with _job_lock:
            if result.returncode == 0:
                _job.update(estado="completado",
                            mensaje="Procesamiento Spark completado exitosamente.",
                            resultados_generados=n)
            else:
                stderr_tail = (result.stderr or "")[-2000:]
                _job.update(estado="error",
                            mensaje=stderr_tail or "Error desconocido en spark-submit")
    except subprocess.TimeoutExpired:
        with _job_lock:
            _job.update(estado="error", mensaje="El job superó el tiempo límite (10 min).")
    except Exception as exc:
        with _job_lock:
            _job.update(estado="error", mensaje=str(exc))
    finally:
        with _job_lock:
            _job["fin"] = datetime.now().isoformat()


# ── Helpers de resultados pre-computados ────────────────────────────────────

def _result_path(filename: str) -> Path:
    p = Path(RESULTS_DIR) / filename
    if not p.exists():
        raise HTTPException(
            503,
            detail=(
                f"Resultados no disponibles: '{filename}'. "
                "Ejecuta primero el job de Spark: "
                "POST /api/analytics/spark/run"
            ),
        )
    return p

def _load(filename: str) -> dict:
    return json.loads(_result_path(filename).read_text(encoding="utf-8"))

def _safe(v):
    if v is None:
        return None
    try:
        if math.isnan(float(v)) or math.isinf(float(v)):
            return None
    except (TypeError, ValueError):
        pass
    return v


# ── Dashboard ────────────────────────────────────────────────────────────────

@app.get("/api/analytics/dashboard", response_class=HTMLResponse)
def dashboard():
    if not DASHBOARD_HTML.exists():
        raise HTTPException(404, detail="dashboard.html no encontrado")
    return HTMLResponse(content=DASHBOARD_HTML.read_text(encoding="utf-8"))

# ── Status / root ─────────────────────────────────────────────────────────────

@app.get("/api/analytics/")
def root():
    return {
        "servicio":    "MS4-Analytics",
        "version":     "2.0.0 (Spark-powered)",
        "estado":      "activo",
        "spark_master": SPARK_MASTER,
        "data_dir":    DATA_DIR,
        "results_dir": RESULTS_DIR,
        "dashboard":   "/api/analytics/dashboard",
    }

@app.get("/api/analytics/health")
def health():
    csvs    = len(glob.glob(os.path.join(DATA_DIR,    "*.csv")))
    results = len(glob.glob(os.path.join(RESULTS_DIR, "*.json")))
    return {
        "status":                "ok",
        "spark":                 "3.5.1",
        "spark_master":          SPARK_MASTER,
        "datasets_disponibles":  csvs,
        "resultados_disponibles": results,
        "spark_job_estado":      _job["estado"],
        "spark_job_ultimo":      _job["fin"],
    }

# ── Spark Job Control ─────────────────────────────────────────────────────────

@app.post("/api/analytics/spark/run")
def run_spark_job():
    """
    Lanza el job de PySpark (spark_processor.py) en segundo plano.
    El job lee todos los CSVs, calcula analytics y guarda JSON en RESULTS_DIR.
    """
    with _job_lock:
        if _job["estado"] == "corriendo":
            return {"mensaje": "El job ya está en ejecución.", "estado": "corriendo"}

    t = threading.Thread(target=_run_spark_job_thread, daemon=True)
    t.start()
    return {"mensaje": "Job de Spark iniciado en background.", "estado": "corriendo"}

@app.get("/api/analytics/spark/status")
def spark_status():
    """Estado del último job de Spark."""
    return {**_job, "spark_master": SPARK_MASTER}

# ── Datasets ──────────────────────────────────────────────────────────────────

@app.get("/api/analytics/datasets")
def listar_datasets():
    csvs = sorted(glob.glob(os.path.join(DATA_DIR, "*.csv")))
    return {
        "datasets": [
            {
                "archivo":    os.path.basename(p),
                "tamaño_kb":  round(os.path.getsize(p) / 1024, 2),
            }
            for p in csvs
        ],
        "total": len(csvs),
    }

@app.get("/api/analytics/datasets/{filename}/schema")
def schema_dataset(filename: str):
    resumen = _load("resumen.json")
    ds = next((d for d in resumen["datasets"] if d["archivo"] == filename), None)
    if not ds:
        raise HTTPException(404, detail=f"Dataset '{filename}' no encontrado en resultados")
    return {
        "archivo":      filename,
        "columnas":     [{"nombre": c, "tipo": "string"} for c in ds["columnas"]],
        "filas_aprox":  ds["filas"],
    }

@app.get("/api/analytics/datasets/{filename}/preview")
def preview_dataset(filename: str, n: int = Query(10, ge=1, le=100)):
    """Preview rápido: lee solo N filas del CSV (sin Spark, sin overhead)."""
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, detail=f"Archivo no encontrado: {filename}")
    import pandas as pd
    df = pd.read_csv(path, nrows=n)
    return {"archivo": filename, "filas": df.to_dict(orient="records")}

# ── Reports – desde resultados pre-computados por Spark ──────────────────────

@app.get("/api/analytics/reports/resumen")
def reporte_resumen():
    """Resumen de todos los datasets (pre-computado por Spark)."""
    return _load("resumen.json")

@app.get("/api/analytics/reports/estadisticas/{filename}")
def reporte_estadisticas(filename: str):
    """Estadísticas de columnas numéricas (pre-computado por Spark)."""
    stem = Path(filename).stem
    return _load(f"{stem}_estadisticas.json")

@app.get("/api/analytics/reports/frecuencias/{filename}/{columna}")
def reporte_frecuencias(
    filename: str,
    columna:  str,
    top: int = Query(20, ge=1, le=200),
):
    """Frecuencias de una columna (pre-computado por Spark, top truncado aquí)."""
    stem = Path(filename).stem
    data = _load(f"{stem}_{columna}_frecuencias.json")
    # Truncar al top solicitado (el procesador guarda top-200)
    data["frecuencias"] = data["frecuencias"][:top]
    return data

@app.get("/api/analytics/reports/nulos/{filename}")
def reporte_nulos(filename: str):
    """Análisis de nulos / calidad (pre-computado por Spark)."""
    stem = Path(filename).stem
    return _load(f"{stem}_nulos.json")

# ── Reports dinámicos – calculados con PySpark on-demand ─────────────────────

@app.get("/api/analytics/reports/tendencia/{filename}")
def reporte_tendencia(
    filename:     str,
    col_fecha:    str = Query(...),
    col_valor:    str = Query(...),
    granularidad: str = Query("mes"),
):
    """
    Tendencia temporal.
    Primero busca un resultado pre-computado; si no existe lo calcula
    on-demand con PySpark y lo guarda para la próxima consulta.
    """
    if granularidad not in ("dia", "mes", "año"):
        raise HTTPException(422, detail="granularidad debe ser: dia, mes o año")

    # Intentar desde caché pre-computado
    stem    = Path(filename).stem
    key     = f"{stem}_{col_fecha}_{col_valor}_{granularidad}"
    cached  = Path(RESULTS_DIR) / f"tendencia_{key}.json"
    if cached.exists():
        return json.loads(cached.read_text(encoding="utf-8"))

    # Calcular on-demand con Spark
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, detail=f"Archivo no encontrado: {filename}")

    from pyspark.sql import functions as F

    spark = get_spark()
    df = spark.read.csv(path, header=True, inferSchema=True)

    for c in (col_fecha, col_valor):
        if c not in df.columns:
            raise HTTPException(
                422,
                detail=f"Columna '{c}' no encontrada. Disponibles: {df.columns}"
            )

    fmt_map = {"dia": "yyyy-MM-dd", "mes": "yyyy-MM", "año": "yyyy"}
    df = (
        df
        .withColumn(col_fecha, F.to_timestamp(F.col(col_fecha)))
        .withColumn(col_valor, F.col(col_valor).cast("double"))
        .dropna(subset=[col_fecha, col_valor])
        .withColumn("periodo", F.date_format(F.col(col_fecha), fmt_map[granularidad]))
    )

    agg = (
        df.groupBy("periodo")
          .agg(
              F.sum(col_valor).alias("total"),
              F.mean(col_valor).alias("promedio"),
              F.count("*").alias("registros"),
          )
          .orderBy("periodo")
    )

    tendencia = [
        {
            "periodo":   r["periodo"],
            "total":     _safe(float(r["total"]))    if r["total"]    is not None else None,
            "promedio":  _safe(float(r["promedio"])) if r["promedio"] is not None else None,
            "registros": int(r["registros"]),
        }
        for r in agg.collect()
    ]

    result = {
        "archivo":      filename,
        "col_fecha":    col_fecha,
        "col_valor":    col_valor,
        "granularidad": granularidad,
        "tendencia":    tendencia,
        "procesado_en": datetime.now().isoformat(),
        "fuente":       "spark_on_demand",
    }

    # Guardar en caché para próximas consultas
    try:
        cached.write_text(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    except Exception:
        pass

    return result


@app.get("/api/analytics/reports/correlacion/{filename}")
def reporte_correlacion(filename: str):
    """Matriz de correlación calculada con PySpark on-demand."""
    from pyspark.sql.types import NumericType, LongType, IntegerType, DoubleType, FloatType
    from pyspark.ml.stat import Correlation
    from pyspark.ml.feature import VectorAssembler

    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, detail=f"Archivo no encontrado: {filename}")

    spark = get_spark()
    df = spark.read.csv(path, header=True, inferSchema=True)

    num_cols = [
        f.name for f in df.schema.fields
        if isinstance(f.dataType, (NumericType, LongType, IntegerType, DoubleType, FloatType))
    ]

    if len(num_cols) < 2:
        return {
            "archivo":    filename,
            "columnas":   num_cols,
            "correlacion": [],
            "aviso":      "Se necesitan al menos 2 columnas numéricas",
        }

    assembler = VectorAssembler(inputCols=num_cols, outputCol="features", handleInvalid="skip")
    df_vec    = assembler.transform(df.select(num_cols).dropna()).select("features")
    matrix    = Correlation.corr(df_vec, "features").collect()[0][0].toArray()

    return {
        "archivo":    filename,
        "columnas":   num_cols,
        "correlacion": [
            {
                "columna": c1,
                **{
                    c2: (None if math.isnan(v := float(matrix[i][j])) else round(v, 4))
                    for j, c2 in enumerate(num_cols)
                },
            }
            for i, c1 in enumerate(num_cols)
        ],
        "fuente": "spark_on_demand",
    }


@app.get("/api/analytics/reports/cruce")
def reporte_cruce(
    archivo1:  str = Query(...),
    archivo2:  str = Query(...),
    col_join1: str = Query(...),
    col_join2: str = Query(...),
    col_agg:   str = Query(...),
    top: int = Query(20, ge=1, le=200),
):
    """Cruce de dos datasets calculado con PySpark on-demand."""
    from pyspark.sql import functions as F

    p1 = os.path.join(DATA_DIR, archivo1)
    p2 = os.path.join(DATA_DIR, archivo2)
    for p, name in [(p1, archivo1), (p2, archivo2)]:
        if not os.path.exists(p):
            raise HTTPException(404, detail=f"Archivo no encontrado: {name}")

    spark = get_spark()
    df1   = spark.read.csv(p1, header=True, inferSchema=True)
    df2   = spark.read.csv(p2, header=True, inferSchema=True)

    merged = df1.join(df2, df1[col_join1] == df2[col_join2], "inner")

    if col_agg not in merged.columns:
        raise HTTPException(
            422, detail=f"Columna '{col_agg}' no encontrada tras el join"
        )

    result = (
        merged
        .withColumn(col_agg, F.col(col_agg).cast("double"))
        .groupBy(col_join1)
        .agg(F.sum(col_agg).alias("total"), F.count("*").alias("registros"))
        .orderBy(F.desc("total"))
        .limit(top)
    )

    rows = result.collect()
    return {
        "archivos":   [archivo1, archivo2],
        "join_keys":  [col_join1, col_join2],
        "col_agg":    col_agg,
        "resultado": [
            {
                col_join1:   r[col_join1],
                "total":     _safe(float(r["total"])) if r["total"] is not None else None,
                "registros": int(r["registros"]),
            }
            for r in rows
        ],
        "fuente": "spark_on_demand",
    }
