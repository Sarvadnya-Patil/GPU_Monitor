# Builds the client and serves it together with the API from one image.
# Run from the repo root: docker build -t gpu-monitor .

FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
# vite.config.ts outDir is "../server/static" relative to /app/client,
# so this lands at /app/server/static.
RUN npm run build

FROM python:3.12-slim
WORKDIR /app/server
COPY server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY server/ ./
COPY --from=client-build /app/server/static ./static

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
