FROM nginx

RUN apt-get update && apt-get install -y curl && apt-get clean
COPY nginx.conf /etc/nginx/nginx.conf

HEALTHCHECK --interval=5m --timeout=3s \
  CMD curl -f http://localhost/health || exit 1
