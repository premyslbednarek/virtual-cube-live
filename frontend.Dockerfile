FROM node:20-alpine as build-step
WORKDIR /app

COPY frontend/package.json ./
COPY frontend/package-lock.json ./
RUN npm install

COPY frontend ./
RUN yarn build

FROM nginx:stable-alpine
COPY --from=build-step /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf