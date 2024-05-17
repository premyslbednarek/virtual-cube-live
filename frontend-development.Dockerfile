FROM node:20-alpine as build-step
WORKDIR /app

COPY frontend/package.json .
COPY frontend/package-lock.json .
RUN npm install

COPY frontend .
CMD ["npm", "start"]