FROM node:24.20.0-alpine3.24

WORKDIR /etc/buildtheearth/plotsystem-api

COPY . ./

RUN npm ci

RUN npm run build

ENV NODE_ENV production

CMD ["node", "dist/index.js"]