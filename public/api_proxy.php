<?php
// Proxy PHP pour le pont HTTPS (Ionos) -> HTTP (Backend distant)
$backend_base_url = 'http://82.165.150.150:3500/api';
$path = isset($_GET['path']) ? $_GET['path'] : '';

// Reconstruire la query string (en excluant 'path')
$queryParams = $_GET;
unset($queryParams['path']);
$queryString = http_build_query($queryParams);
$queryFinal = $queryString ? '?' . $queryString : '';

$url = $backend_base_url . '/' . $path . $queryFinal;

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);

// Transmettre le corps de la requête pour POST/PUT
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents('php://input'));
}

// Transmettre les headers (sauf Host)
$headers = [];
foreach (getallheaders() as $name => $value) {
    if ($name !== 'Host') $headers[] = "$name: $value";
}
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$response = curl_exec($ch);
$header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$header = substr($response, 0, $header_size);
$body = substr($response, $header_size);
curl_close($ch);

// Renvoyer les headers du backend
$header_lines = explode("\r\n", $header);
foreach ($header_lines as $h) {
    if (!empty($h) && !str_starts_with($h, 'Transfer-Encoding')) {
        header($h);
    }
}
echo $body;
?>
