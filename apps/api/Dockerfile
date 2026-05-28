FROM php:8.2-fpm-alpine

RUN apk add --no-cache nginx supervisor curl zip unzip git \
    && docker-php-ext-install pdo pdo_mysql bcmath pcntl

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html
COPY apps/api /var/www/html
RUN composer install --no-dev --optimize-autoloader --no-interaction 2>/dev/null || true

RUN mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

COPY apps/api/docker/nginx.conf /etc/nginx/http.d/default.conf
COPY apps/api/docker/supervisord.conf /etc/supervisord.conf

EXPOSE 80
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
