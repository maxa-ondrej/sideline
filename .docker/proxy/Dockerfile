FROM nginx

RUN apt-get update && apt-get install -y curl && apt-get clean
COPY 10-variables.conf /etc/nginx/templates/10-variables.conf.template
COPY nginx.conf /etc/nginx/nginx.conf

ENV PORT=80
ENV HEALTH_PORT=9000
ENV SERVER_PORT=80
ENV WEB_PORT=80
ENV ADMINER_PORT=8080
