FROM nginx

RUN apt-get update && apt-get install -y curl && apt-get clean
COPY nginx.conf /etc/nginx/nginx.conf
