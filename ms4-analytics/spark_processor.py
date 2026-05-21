"""
MS4 – Spark Processor
=====================
Job PySpark que procesa todos los CSVs del directorio DATA_DIR y guarda
los resultados como archivos JSON en RESULTS_DIR.

Este script se ejecuta vía spark-submit (lanzado por la FastAPI al recibir
POST /api/analytics/spark/run) o manualmente:

  spark-submit --master spark://spark-master:7077 spark_processor.py

Variables de entorno:
  DATA_DIR     – directorio con los CSVs         (default: /data/csvs)
  RESULTS_DIR  – directorio de salida JSON        (default: /data/results)
  SPARK_MASTER – URL del master del clúster       (default: spark://spark-master:7077)
"""

import os
import json
import math
import sys
from pathlib import Path
from datetime import datetime

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import (
    NumericType, LongType, IntegerType, DoubleType, FloatType, DecimalType
)

# ── Configuración ─────────────────────────────────────────────────────────────

DATA_DIR     = os.getenv("DATA_DIR",     "/data/csvs")
RESULTS_DIR  = os.getenv("RESULTS_DIR",  "/data/results")
SPARK_MASTER = os.getenv("SPARK_MASTER", "spark://spark-master:7077")

# ── Helpers ───────────────────────────────────────────────────────────────────

def safe(v):
    """Convierte NaN/Inf/None a None para JSON válido."""
    if v is None:
        return None
    try:
        if math.isnan(float(v)) or math.isinf(float(v)):
            return None
    except (TypeError, ValueError):
        pass
    return v

def save_json(path: str, data: dict):
    Path(path).write_text(
        json.dumps(data, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8"
    )

def is_numeric(field) -> bool:
    return isinstance(field.dataType, (
        NumericType, LongType, IntegerType, DoubleType, FloatType, DecimalType
    ))

def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)

# ── Procesamiento principal ───────────────────────────────────────────────────

def process_all(spark: SparkSession):
    Path(RESULTS_DIR).mkdir(parents=True, exist_ok=True)

    csvs = sorted(Path(DATA_DIR).glob("*.csv"))
    if not csvs:
        log("⚠  No se encontraron CSVs en " + DATA_DIR)
        save_json(f"{RESULTS_DIR}/resumen.json",
                  {"datasets": [], "total_archivos": 0,
                   "procesado_en": datetime.now().isoformat()})
        return

    resumen_list = []

    for csv_path in csvs:
        filename = csv_path.name
        stem     = csv_path.stem
        log(f"▶  Procesando: {filename}")

        df = spark.read.csv(str(csv_path), header=True, inferSchema=True)
        total = df.count()

        all_cols  = df.columns
        num_cols  = [f.name for f in df.schema.fields if is_numeric(f)]
        str_cols  = [c for c in all_cols if c not in num_cols]

        # ── 1. Contribución al resumen global ─────────────────────────────────
        resumen_list.append({
            "archivo":            filename,
            "filas":              total,
            "columnas_total":     len(all_cols),
            "columnas_numericas": len(num_cols),
            "columnas_texto":     len(str_cols),
            "columnas":           all_cols,
        })

        # ── 2. Estadísticas de columnas numéricas ─────────────────────────────
        stats = []
        for col in num_cols:
            row = df.agg(
                F.count(col).alias("n"),
                F.min(col).alias("mn"),
                F.max(col).alias("mx"),
                F.mean(col).alias("avg"),
                F.stddev(col).alias("std"),
            ).collect()[0]
            stats.append({
                "columna":  col,
                "count":    int(row["n"])              if row["n"]   is not None else 0,
                "min":      safe(float(row["mn"]))     if row["mn"]  is not None else None,
                "max":      safe(float(row["mx"]))     if row["mx"]  is not None else None,
                "promedio": safe(float(row["avg"]))    if row["avg"] is not None else None,
                "desv_std": safe(float(row["std"]))    if row["std"] is not None else None,
            })

        save_json(
            f"{RESULTS_DIR}/{stem}_estadisticas.json",
            {
                "archivo":      filename,
                "estadisticas": stats,
                "aviso":        None if stats else "No se detectaron columnas numéricas",
                "procesado_en": datetime.now().isoformat(),
            }
        )

        # ── 3. Frecuencias de todas las columnas (top 200) ────────────────────
        for col in all_cols:
            rows = (
                df.groupBy(col)
                  .count()
                  .orderBy(F.desc("count"))
                  .limit(200)
                  .collect()
            )
            frecuencias = [
                {col: (str(r[col]) if r[col] is not None else None), "count": int(r["count"])}
                for r in rows
            ]
            save_json(
                f"{RESULTS_DIR}/{stem}_{col}_frecuencias.json",
                {
                    "archivo":      filename,
                    "columna":      col,
                    "frecuencias":  frecuencias,
                    "procesado_en": datetime.now().isoformat(),
                }
            )

        # ── 4. Calidad / nulos ────────────────────────────────────────────────
        calidad = []
        if total > 0:
            for col in all_cols:
                nulos = int(df.filter(F.col(col).isNull() | (F.col(col) == "")).count())
                calidad.append({
                    "columna":   col,
                    "nulos":     nulos,
                    "pct_nulos": round(nulos / total * 100, 2),
                    "completos": total - nulos,
                })
            calidad.sort(key=lambda x: x["pct_nulos"], reverse=True)

        save_json(
            f"{RESULTS_DIR}/{stem}_nulos.json",
            {
                "archivo":          filename,
                "total_filas":      total,
                "calidad_columnas": calidad,
                "procesado_en":     datetime.now().isoformat(),
            }
        )

        log(f"✓  {filename}  ({total:,} filas, {len(all_cols)} columnas)")

    # ── 5. Resumen global ──────────────────────────────────────────────────────
    save_json(
        f"{RESULTS_DIR}/resumen.json",
        {
            "datasets":        resumen_list,
            "total_archivos":  len(resumen_list),
            "procesado_en":    datetime.now().isoformat(),
        }
    )

    # ── 6. Tendencias pre-computadas (las que usa el dashboard) ───────────────
    _compute_tendencias(spark, [
        ("pagos.csv",      "fecha_pago",   "monto",  "mes"),
        ("pagos.csv",      "fecha_pago",   "monto",  "dia"),
        ("gestiones.csv",  "fecha_inicio", "monto",  "mes"),
    ])

    log("✅  Procesamiento Spark completado")


def _compute_tendencias(spark: SparkSession, tareas: list):
    """Pre-computa tendencias temporales para las consultas más comunes."""
    fmt_map = {"dia": "yyyy-MM-dd", "mes": "yyyy-MM", "año": "yyyy"}

    for (filename, col_fecha, col_valor, granularidad) in tareas:
        path = Path(DATA_DIR) / filename
        if not path.exists():
            log(f"  ↷ Tendencia omitida (archivo no existe): {filename}")
            continue

        stem = path.stem
        log(f"  → Tendencia: {filename} / {col_fecha} / {col_valor} / {granularidad}")

        df = spark.read.csv(str(path), header=True, inferSchema=True)

        # Verificar que las columnas existen
        if col_fecha not in df.columns or col_valor not in df.columns:
            log(f"  ⚠ Columna no encontrada en {filename}, omitiendo")
            continue

        fmt = fmt_map.get(granularidad, "yyyy-MM")

        df = (
            df
            .withColumn(col_fecha, F.to_timestamp(F.col(col_fecha)))
            .withColumn(col_valor, F.col(col_valor).cast("double"))
            .dropna(subset=[col_fecha, col_valor])
            .withColumn("periodo", F.date_format(F.col(col_fecha), fmt))
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
                "total":     safe(float(r["total"]))    if r["total"]    is not None else None,
                "promedio":  safe(float(r["promedio"])) if r["promedio"] is not None else None,
                "registros": int(r["registros"]),
            }
            for r in agg.collect()
        ]

        key = f"{stem}_{col_fecha}_{col_valor}_{granularidad}"
        save_json(
            f"{RESULTS_DIR}/tendencia_{key}.json",
            {
                "archivo":      filename,
                "col_fecha":    col_fecha,
                "col_valor":    col_valor,
                "granularidad": granularidad,
                "tendencia":    tendencia,
                "procesado_en": datetime.now().isoformat(),
            }
        )
        log(f"  ✓ Tendencia guardada: tendencia_{key}.json")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    log(f"Iniciando Spark Processor")
    log(f"  SPARK_MASTER = {SPARK_MASTER}")
    log(f"  DATA_DIR     = {DATA_DIR}")
    log(f"  RESULTS_DIR  = {RESULTS_DIR}")

    spark = (
        SparkSession.builder
        .appName("MS4-Analytics-Processor")
        .master(SPARK_MASTER)
        .config("spark.sql.shuffle.partitions", "4")
        .config("spark.driver.memory", "512m")
        .config("spark.executor.memory", "512m")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")

    try:
        process_all(spark)
        sys.exit(0)
    except Exception as exc:
        log(f"❌ Error: {exc}")
        raise
    finally:
        spark.stop()
