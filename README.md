# Health Lens

Health Lens (MedInsight in the UI) is a MERN application for uploading medical reports, extracting text from PDFs and images, and asking questions using Gemini and a medical knowledge base.

## Run with Docker

Requirements: Docker Desktop with its engine running, and a Gemini API key.

```sh
cp .env.example .env
```

Edit the root `.env`: enter your Gemini key and a long random JWT secret. Generate a secret with `openssl rand -hex 32`.

```sh
docker compose up --build -d
docker compose ps
docker compose logs -f app
```

Open <http://localhost:5003>. The image builds React and serves it alongside the Express API, so authentication and uploads work at the same address. MongoDB starts first and is not exposed on the host. Database records, uploads, and the knowledge cache use named volumes.

Check database readiness at <http://localhost:5003/api/health>. Knowledge indexing runs in the background; knowledge questions may return 503 until indexing completes. Confirm successful indexing in the app logs. AI features require valid Gemini credentials and models available to your account.

```sh
docker compose down
```

This stops the application and preserves data. `docker compose down -v` also deletes the saved data.

## Publish a live demo on Render

The repository includes `render.yaml`, which creates one Docker web service for the frontend and API. Deployment follows Render's [Docker guide](https://render.com/docs/docker) and [Blueprint specification](https://render.com/docs/blueprint-spec).

1. Push these changes to the GitHub repository you want to deploy, such as `aranjali1/health-lens`.
2. Create a MongoDB Atlas database and database user. Copy its application connection string, including the database name. Allow your Render service's outbound IP ranges in Atlas Network Access.
3. In the [Render dashboard](https://dashboard.render.com), choose **New → Blueprint**, connect your GitHub repository, and select this Blueprint.
4. Supply `MONGO_URI` and `GEMINI_API_KEY` in Render. The Blueprint generates `JWT_SECRET`. Store credentials in Render, never in GitHub or frontend variables.
5. Deploy. Once the service is healthy, open the HTTPS URL shown by Render. Register a test account, upload a synthetic report, confirm analysis and chat work, then sign out and sign back in to verify saved history.
6. Add the verified live URL to this README and your résumé after those checks pass.

The included demo configuration selects Render's free plan. Its filesystem is ephemeral: MongoDB records remain in Atlas, but uploaded files and the local RAG cache are lost on restarts or redeploys. The cache rebuilds on startup. For durable file retention, add object storage or a supported persistent disk before using this deployment beyond a demo. See [Render free-service limitations](https://render.com/docs/free).

The Docker image excludes local `.env` files, existing uploaded reports, and generated documents. The existing repository already tracks files in `backend/uploads`; `.gitignore` does not remove tracked files or their history. Review those files before publishing the repository.

## Local development without Docker

Use Node.js 24 and a running MongoDB instance. Copy `backend/.env.example` to `backend/.env` and fill in its values.

In one terminal:

```sh
cd backend
npm ci
npm run dev
```

In another:

```sh
cd frontend
npm ci
npm run dev
```

Open the Vite URL. Vite forwards `/api` calls to port 5003. If you change the backend port, update the proxy in `frontend/vite.config.js`.

Production uses the same origin by default. For separate frontend hosting, set `VITE_API_BASE_URL` to the backend HTTPS origin **before building** the frontend and set `CLIENT_ORIGIN` on the backend to the frontend origin. Never put secrets in `VITE_*` variables.

## Verification

```sh
cd frontend
npm run build
npm run lint
cd ../backend
npm test
```

Build the frontend before running the deployment tests. Tests check SPA routing, API 404 responses, authentication protection, and database health reporting without contacting Gemini or MongoDB. Existing evaluation tests also run. GitHub Actions repeats the build and tests, then builds the Docker image on pushes and pull requests. AI evaluation instructions are in [backend/evaluation/README.md](backend/evaluation/README.md).

## Deployment status

Deployment configuration is included. A public demo URL has not yet been provisioned or verified.
