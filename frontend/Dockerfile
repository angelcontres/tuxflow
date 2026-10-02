# Stage 1: Build React Application
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# nginx:alpine ejecuta los scripts de /docker-entrypoint.d/ antes de arrancar.
# Este ajusta el resolver del upstream al DNS real del runtime (docker o podman).
COPY docker-entrypoint-resolver.sh /docker-entrypoint.d/15-resolver.sh
RUN chmod +x /docker-entrypoint.d/15-resolver.sh
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
