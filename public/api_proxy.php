<?php
// PHP Proxy pour requêtes API (Pont HTTPS -> HTTP)
$backend_url = 'http://82.165.150.150:3500';

// 1. Récupération du chemin et de la query string
$path = isset($_GET['path']) ? $_GET['path'] : '';
$query = $_SERVER['QUERY_STRING'] ? '?' . $_SERVER['QUERY_STRING'] : '';

// Nettoyer la query string pour ne pas avoir 'path=...'
parse_str($_SERVER['QUERY_STRING'], $queryParams);
unset($queryParams['path']);
$queryString = http_build_query($queryParams);
$queryFinal = $queryString ? '?' . $queryString : '';

$url = $backend_url . '/api/' . $path . $queryFinal;

// 2. Initialisation cURL
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);

// 3. Transmission des headers
$headers = [];
foreach (getallheaders() as $name => $value) {
    if ($name !== 'Host' && $name !== 'Content-Length') {
        $headers[] = "$name: $value";
    }
}
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

// 4. Transmission du corps (pour POST/PUT/PATCH)
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents('php://input'));
}

// 5. Exécution
$response = curl_exec($ch);
if (curl_errno($ch)) {
    http_response_code(502);
    echo 'Proxy Error: ' . curl_error($ch);
    exit;
}

$header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$header = substr($response, 0, $header_size);
$body = substr($response, $header_size);
curl_close($ch);

// 6. Renvoyer les headers du backend au navigateur
$header_lines = explode("\r\n", $header);
foreach ($header_lines as $h) {
    if (!empty($h) && !str_starts_with($h, 'Transfer-Encoding')) {
        header($h);
    }
}

echo $body;
?>
