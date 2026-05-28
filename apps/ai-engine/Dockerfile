FROM python:3.12-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

COPY apps/ai-engine/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY packages/import-parsers /packages/import-parsers
RUN pip install -e /packages/import-parsers

COPY apps/ai-engine /app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
