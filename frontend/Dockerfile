FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

# O build estático (dist/) virá do volume montado em runtime (./frontend/dist:/usr/share/nginx/html)
EXPOSE 80
