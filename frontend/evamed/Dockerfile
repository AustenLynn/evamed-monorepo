FROM node:18.19.1-alpine

WORKDIR /app

COPY package.json package-lock.json /app/
RUN npm ci

COPY . /app/
RUN npm run build -- --configuration production

EXPOSE 8080

CMD ["node", "server.js"]
