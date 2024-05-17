FROM node:20 as build-step
WORKDIR /app

RUN npm install -g create-react-app

COPY frontend/package.json .
COPY frontend/package-lock.json .


RUN npm install --legacy-peer-deps
ENV PATH /app/node_modules/.bin:$PATH

COPY frontend/ .
CMD ["yarn", "start"]