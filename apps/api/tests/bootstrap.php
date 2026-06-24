<?php

require __DIR__.'/../vendor/autoload.php';

spl_autoload_register(static function (string $class): void {
    if (! str_starts_with($class, 'Tests\\')) {
        return;
    }

    $relative = str_replace('\\', '/', substr($class, strlen('Tests\\')));
    $path = __DIR__.'/'.$relative.'.php';

    if (is_file($path)) {
        require $path;
    }
});
