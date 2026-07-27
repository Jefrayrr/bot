<?php

declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';

use App\Services\BotApiClient;

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->safeLoad();

$client = new BotApiClient();
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

switch ($uri) {
    case '/':
    case '/dashboard':
        $state = $client->getState();
        $stats = $client->getStats();
        require __DIR__ . '/views/dashboard.php';
        break;

    case '/api/state':
        header('Content-Type: application/json');
        echo json_encode($client->getState());
        break;

    case '/api/jobs':
        header('Content-Type: application/json');
        echo json_encode($client->getJobs());
        break;

    case '/api/timeline':
        header('Content-Type: application/json');
        echo json_encode($client->getTimeline());
        break;

    case '/api/stats':
        header('Content-Type: application/json');
        echo json_encode($client->getStats());
        break;

    default:
        http_response_code(404);
        echo 'Not Found';
        break;
}
