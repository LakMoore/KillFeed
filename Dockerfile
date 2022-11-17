FROM node:16 as base

WORKDIR /home/node/app

COPY package*.json ./

RUN npm i

COPY . .

CMD [ "npm", "run", "start"]
