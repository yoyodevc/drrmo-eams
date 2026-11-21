<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#661419">
    <meta name="description" content="ZPPSU DRRMO Personnel Event Assignment and Monitoring System">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="apple-touch-icon" href="/images/brand/apple-touch-icon.png">
    <link rel="manifest" href="/manifest.webmanifest">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="DRRMO EAMS">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <title>{{ config('app.name') }}</title>
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app/main.tsx'])
</head>
<body class="bg-stone-50 text-stone-900 antialiased">
    <div id="app"></div>
</body>
</html>
