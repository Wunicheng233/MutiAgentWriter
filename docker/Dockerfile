# Multi-stage build for MultiAgentWriter
# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Backend + Python dependencies
FROM python:3.10-slim AS backend

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Expose port
EXPOSE 8000

# Default command: start uvicorn
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
