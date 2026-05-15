<?php
header('Content-Type: application/json');

$version = [
    'screen_version' => 77, // Increment this to reload JS + page content
];
echo json_encode($version, JSON_PRETTY_PRINT);