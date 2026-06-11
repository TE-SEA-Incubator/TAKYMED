<?php
// PHP Proxy for API requests
// This acts as a bridge between the frontend and the remote backend.

$backend_url = 'http://82.165.150.150:3500'; // Your remote backend address

// Get the requested API path
$path = $_SERVER['REQUEST_URI'];
$url = $backend_url . $path;

// Initialize cURL
$ch = curl_init($url);

// Configure cURL to transfer method, headers, and body
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);

// Forward headers
$headers = [];
foreach (getallheaders() as $name => $value) {
    if ($name !== 'Host') {
        $headers[] = "$name: $value";
    }
}
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

// Forward body for POST/PUT/PATCH
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents('php://input'));
}

// Execute
$response = curl_exec($ch);
$header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$header = substr($response, 0, $header_size);
$body = substr($response, $header_size);

// Forward backend headers to the browser
$header_lines = explode("\r\n", $header);
foreach ($header_lines as $h) {
    if (!empty($h) && !str_starts_with($h, 'Transfer-Encoding')) {
        header($h);
    }
}

echo $body;
curl_close($ch);
?>
