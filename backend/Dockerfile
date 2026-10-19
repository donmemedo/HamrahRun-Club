FROM python:3.13.16-slim
RUN useradd --create-home --uid 10001 app
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --retries 10 --timeout 60 -r requirements.txt
COPY main.py .
ENV DB_PATH=/data/data.db PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN mkdir /data && chown app /data
VOLUME /data
USER app
EXPOSE 8000
HEALTHCHECK --interval=10s --retries=5 CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"]
# One worker on purpose: OTPs and rate limits live in process memory (see the ponytail notes in main.py)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
