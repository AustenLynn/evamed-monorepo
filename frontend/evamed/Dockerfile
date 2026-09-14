FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json /app/
RUN npm ci

COPY . /app/
# Deployments build the production config; docker-compose overrides this to
# "docker" so the local stack targets the local API (localhost:8000).
ARG NG_CONFIGURATION=production
RUN npm run build -- --configuration ${NG_CONFIGURATION}

EXPOSE 8080

CMD ["node", "server.js"]
