FROM nginx

RUN apt-get update && apt-get install -y curl nginx-module-njs && apt-get clean
COPY applications/proxy/preview_redirect.js /etc/nginx/preview_redirect.js
COPY applications/proxy/templates /etc/nginx/templates
COPY applications/proxy/nginx.conf /etc/nginx/nginx.conf

ENV PORT=80
ENV HEALTH_PORT=9000
ENV SERVER_PORT=80
ENV WEB_PORT=80
ENV DOCS_PORT=80
ENV ADMINER_PORT=8080
ENV MAX_BODY_SIZE=0
