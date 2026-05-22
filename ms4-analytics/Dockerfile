# ── MS4 Analytics  –  Python 3.11 + PySpark 3.5 + FastAPI ────────────────────

FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        openjdk-21-jre-headless \
        curl \
    && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App principal, dashboard y el job de Spark
COPY app.py .
COPY spark_processor.py .

# Directorios de datos y resultados
RUN mkdir -p /data/csvs /data/results

EXPOSE 3003

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "3003", "--workers", "1"]
