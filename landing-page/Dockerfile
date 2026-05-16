FROM nginx:alpine
COPY landing-page/nginx.conf /etc/nginx/conf.d/default.conf
COPY landing-page/ /usr/share/nginx/html
# Remove config/dockerfile from served files
RUN rm -f /usr/share/nginx/html/Dockerfile /usr/share/nginx/html/nginx.conf
EXPOSE 80
