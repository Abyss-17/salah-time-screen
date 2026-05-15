<?php
	session_start();
	header('Content-Type: text/html; charset=utf-8');
	setlocale(LC_ALL, 'UK');
    $path  = $_SERVER['DOCUMENT_ROOT'];
	include_once "$path/cache-control/caching.php"; // cache control

	$mosque_id = isset($_GET['mosque_id']) ? (int)$_GET['mosque_id'] : 0;

	if(empty($mosque_id)){
		header("Location: /");
		exit;
	}
	
	$tplbody     	= file_get_contents('index.html');
	$tplbody	 = str_replace('{mosque_id}', $mosque_id, $tplbody);
	$tplbody	 = str_replace('{cache_version}', '?v'.time(), $tplbody);
	$tplbody        = str_replace("{cache_version}", $mp_cache_version, $tplbody);

	if (isset($_GET['json'])) {
		header('Content-Type: application/json; charset=utf-8');
		echo json_encode(['html' => $tplbody], JSON_PRETTY_PRINT);
		exit;
	}

echo $tplbody;
