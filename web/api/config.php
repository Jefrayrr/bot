<?php

declare(strict_types=1);

namespace App;

class Config
{
    private static ?self $instance = null;

    public readonly string $nodeApiUrl;
    public readonly string $nodeWsUrl;

    private function __construct()
    {
        $this->nodeApiUrl = getenv('NODE_API_URL') ?: 'http://node:3002';
        $this->nodeWsUrl = getenv('NODE_WS_URL') ?: 'ws://node:3001';
    }

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
}
