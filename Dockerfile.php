FROM php:8.2-fpm

RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    libzip-dev \
    unzip \
    && docker-php-ext-install curl zip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY web/composer.json .
RUN composer install --no-dev --optimize-autoloader

COPY web/ .

RUN chown -R www-data:www-data /var/www/html

RUN echo 'server {\n\
    listen 80;\n\
    server_name localhost;\n\
    root /var/www/html/public;\n\
    index index.php;\n\
    location / { try_files $uri $uri/ /index.php?$query_string; }\n\
    location ~ \\.php$ {\n\
        fastcgi_pass 127.0.0.1:9000;\n\
        fastcgi_index index.php;\n\
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;\n\
        include fastcgi_params;\n\
    }\n\
    location ~ /css/ { expires 1h; add_header Cache-Control "public, immutable"; }\n\
    location ~ /js/ { expires 1h; add_header Cache-Control "public, immutable"; }\n\
}' > /etc/nginx/sites-available/default

CMD ["bash", "-c", "php-fpm -D && nginx -g 'daemon off;'"]
