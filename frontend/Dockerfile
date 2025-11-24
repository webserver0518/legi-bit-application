# build stage
FROM node:20-alpine AS build
WORKDIR /app

COPY app/package*.json ./
RUN npm ci --omit=dev --no-fund --no-audit || npm install --omit=dev --no-fund --no-audit

COPY app/ .
RUN npm run build

# runtime stage
FROM nginx:alpine

COPY nginx/conf/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
