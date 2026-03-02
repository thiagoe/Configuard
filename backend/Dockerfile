FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-client \
    telnet \
    putty-tools \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia apenas requirements para cache de camada de build
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código-fonte virá do volume montado em runtime (./backend:/app)
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
