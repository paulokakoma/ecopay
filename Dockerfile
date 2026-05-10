FROM node:20-alpine

WORKDIR /usr/src/app

COPY backend/package*.json backend/
RUN cd backend && npm install --omit=dev

COPY backend/ backend/
COPY public/ public/

EXPOSE 3001

WORKDIR /usr/src/app/backend
CMD ["node", "app.js"]
