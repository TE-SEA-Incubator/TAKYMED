<?php
// Proxy amélioré pour le débogage
$backend_url = 'http://82.165.150.150:3500';

// 1. Récupération du chemin passé par .htaccess
$path = isset($_GET['path']) ? $_GET['path'] : '';
$query = $_SERVER['QUERY_STRING'] ? '?' . $_SERVER['QUERY_STRING'] : '';
// On doit reconstruire le query string pour supprimer 'path='
parse_str($_SERVER['QUERY_STRING'], $queryParams);
unset($queryParams['path']);
$queryString = http_build_query($queryParams);
$queryFinal = $queryString ? '?' . $queryString : '';

$url = $backend_url . '/api/' . $path . $queryFinal;

// Log pour débogage
file_put_contents('proxy_debug.log', date('Y-m-d H:i:s') . " - Target: $url\n", FILE_APPEND);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents('php://input'));
}

$response = curl_exec($ch);
$err = curl_error($ch);
$header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$body = substr($response, $header_size);
curl_close($ch);

if ($err) {
    file_put_contents('proxy_debug.log', "Error: $err\n", FILE_APPEND);
    http_response_code(502);
    echo "Proxy Error: $err";
} else {
    echo $body;
}
?>
