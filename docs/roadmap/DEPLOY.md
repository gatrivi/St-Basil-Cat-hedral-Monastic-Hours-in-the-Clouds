# Deploy a Producción 24/7

## Arquitectura

```
Vercel (frontend gratis, CDN global)
    ↓ HTTPS
Backend TTS (Piper + Express, siempre activo)
    ↓ localhost
Piper ONNX → WAV
```

## 1. Backend TTS

El backend está en `/reactjs/tts/`. Tiene Dockerfile listo.

### Opción A: Render (más fácil)

1. Crear cuenta en [render.com](https://render.com)
2. New → Web Service → Connect tu repo de GitHub
3. Root Directory: `tts`
4. Render detecta el `Dockerfile` automáticamente
5. Environment: `PORT=3001`
6. Plan: **Starter** ($7/mes) — el free tier se duerme, no es 24/7
7. Deploy → obtendrás una URL pública: `https://cathedral-tts-xxx.onrender.com`

### Opción B: Hetzner VPS (más barato, €3.79/mes)

1. Crear VPS **CX11** en [hetzner.com](https://hetzner.com) (Ubuntu 22.04)
2. SSH al servidor:
   ```bash
   ssh root@<ip-del-vps>
   ```
3. Instalar Docker:
   ```bash
   apt update && apt install -y docker.io docker-compose
   ```
4. Clonar repo y levantar:
   ```bash
   git clone <tu-repo> /opt/cathedral
   cd /opt/cathedral/tts
   docker-compose up -d --build
   ```
5. HTTPS con Caddy (automático):
   ```bash
   apt install -y debian-keyring debian-archive-keyring apt-transport-https
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
   apt update && apt install -y caddy
   ```
   Crear `/etc/caddy/Caddyfile`:
   ```
   tts.tudominio.com {
       reverse_proxy localhost:3001
   }
   ```
   ```bash
   systemctl restart caddy
   ```
6. Apuntar un subdominio (ej: `tts.gatrivi.com`) al VPS

---

## 2. Frontend

### Variable de entorno

Antes de build, setear la URL del backend TTS en producción:

```bash
# Local (default)
VITE_TTS_SERVER_URL=http://localhost:3001

# Producción
VITE_TTS_SERVER_URL=https://tts.gatrivi.com
```

En Vercel, agregá la env var en Settings → Environment Variables.

### Deploy en Vercel

1. Push el repo a GitHub
2. Importar proyecto en [vercel.com](https://vercel.com)
3. Framework Preset: Vite
4. Agregar env var: `VITE_TTS_SERVER_URL=https://tu-backend-tts.com`
5. Deploy

---

## 3. Verificación

```bash
# Healthcheck del backend
curl https://tts.tudominio.com/health
# → {"status":"ok","model":"es_AR-daniela-high.onnx"}

# Test de audio
curl -X POST https://tts.tudominio.com/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Dios te salve, María."}' \
  --output test.wav
```

---

## Archivos creados/modificados

| Archivo | Qué hace |
|---------|----------|
| `tts/Dockerfile` | Imagen Docker con Node + Piper Linux + modelo |
| `tts/docker-compose.yml` | Orquesta el contenedor |
| `tts/.dockerignore` | Excluye binarios de Windows del contexto de build |
| `tts/index.js` | Express server con env vars, healthcheck, escucha en `0.0.0.0` |
| `src/services/gemini.ts` | Lee `VITE_TTS_SERVER_URL` en vez de hardcodear localhost |
| `.env.example` | Documenta la nueva variable |
