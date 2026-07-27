<?php

declare(strict_types=1);

namespace App\Services;

use GuzzleHttp\Client;
use App\Config;

class BotApiClient
{
    private Client $client;

    public function __construct()
    {
        $config = Config::getInstance();
        $this->client = new Client([
            'base_uri' => $config->nodeApiUrl,
            'timeout' => 10,
        ]);
    }

    public function getState(): ?array
    {
        return $this->get('/api/state');
    }

    public function getJobs(): ?array
    {
        return $this->get('/api/jobs');
    }

    public function getJob(string $id): ?array
    {
        return $this->get("/api/jobs/{$id}");
    }

    public function getTimeline(): ?array
    {
        return $this->get('/api/timeline');
    }

    public function getDecision(): ?array
    {
        return $this->get('/api/decision');
    }

    public function getStats(): ?array
    {
        return $this->get('/api/stats');
    }

    public function getReports(): ?array
    {
        return $this->get('/api/reports');
    }

    private function get(string $uri): ?array
    {
        try {
            $response = $this->client->get($uri);
            $body = (string) $response->getBody();
            $data = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
            return is_array($data) ? $data : null;
        } catch (\Exception) {
            return null;
        }
    }
}
