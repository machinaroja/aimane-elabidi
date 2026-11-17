# Image de production : interface (React) + passerelle d'API (Node). Contexte de construction : le dossier plateforme/.
# Construire :  docker build -t as-lieusaint .      Lancer : voir DEPLOIEMENT.md (variables d'environnement obligatoires).
FROM node:22-slim AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci --omit=dev && npm cache clean --force
COPY server/ server/
RUN rm -rf server/test
COPY --from=web /app/web/dist web/dist
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.mjs"]
