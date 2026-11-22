# Portable API image (Railway, Fly.io, VPS, Render Docker).
# Build from the repository root so the shared/ folder is included:
#   docker build -t ramachandra-api .
#   docker run -p 5000:5000 --env-file Website/backend/.env ramachandra-api
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Shared code is imported as @shared/* and lives one level above the backend.
COPY shared ./shared
COPY Website/backend/package.json Website/backend/package-lock.json ./Website/backend/

WORKDIR /app/Website/backend
# tsx is a production dependency, so the API can run the TypeScript sources.
RUN npm ci --omit=dev && npm cache clean --force

COPY Website/backend/tsconfig.json ./
COPY Website/backend/src ./src

EXPOSE 5000
CMD ["npm", "start"]
