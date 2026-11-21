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
    {{-- Boot screen. Plain CSS in the page so it paints before the app's CSS and JS arrive.
         The installed app (standalone) continues Android's maroon splash; a browser tab gets a light one.
         The app fades it out once it knows who is signed in (resources/js/app/BootScreen.tsx). --}}
    <style>
        html { background: #fafaf9; }
        .boot { position: fixed; inset: 0; z-index: 100; background: #fafaf9; color: #1c1917;
            font-family: 'Public Sans Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            transition: opacity .28s ease; }
        .boot[data-leaving] { opacity: 0; pointer-events: none; }
        .boot-logo { position: absolute; left: 50%; top: 50%; width: 108px; height: 120px; margin: -60px 0 0 -54px; object-fit: contain; }
        .boot-bar { position: absolute; left: 50%; top: calc(50% + 92px); width: 72px; height: 3px; margin-left: -36px;
            overflow: hidden; border-radius: 9999px; background: #e7e5e4; opacity: 0; animation: boot-in .3s ease .35s forwards; }
        .boot-bar span { display: block; width: 40%; height: 100%; border-radius: inherit; background: #7d1d23;
            animation: boot-slide 1.1s cubic-bezier(.45,0,.55,1) infinite; }
        .boot-foot { position: absolute; inset: auto 24px calc(40px + env(safe-area-inset-bottom)); text-align: center;
            opacity: 0; animation: boot-in .3s ease .35s forwards; }
        .boot-name { margin: 0; font-size: 15px; font-weight: 650; letter-spacing: .02em; }
        .boot-org { margin: 4px 0 0; font-size: 12px; color: #78716c; }
        .boot-slow { margin: 0 0 16px; font-size: 13px; color: #57534e; opacity: 0; animation: boot-in .3s ease 10s forwards; }
        .boot-slow a { color: #7d1d23; font-weight: 600; }
        @media (display-mode: standalone) {
            html:has(#boot) { background: #661419; }
            #boot { background: #661419; color: #fff; }
            #boot .boot-bar { background: rgb(255 255 255 / .18); }
            #boot .boot-bar span { background: #fff; }
            #boot .boot-org { color: rgb(255 255 255 / .65); }
            #boot .boot-slow { color: rgb(255 255 255 / .8); }
            #boot .boot-slow a { color: #fff; }
        }
        @keyframes boot-in { to { opacity: 1; } }
        @keyframes boot-slide { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
        @media (prefers-reduced-motion: reduce) {
            .boot-bar span { width: 100%; opacity: .5; animation: none; }
        }
    </style>
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app/main.tsx'])
</head>
<body class="bg-stone-50 text-stone-900 antialiased">
    <div id="boot" class="boot" role="status" aria-label="Loading DRRMO EAMS">
        <img class="boot-logo" src="/images/brand/drrmo-logo.webp" alt="" width="288" height="320" fetchpriority="high">
        <div class="boot-bar" aria-hidden="true"><span></span></div>
        <div class="boot-foot">
            <p class="boot-slow">Taking longer than usual. <a href="">Reload</a></p>
            <p class="boot-name">DRRMO EAMS</p>
            <p class="boot-org">ZPPSU Disaster Risk Reduction and Management Office</p>
        </div>
    </div>
    <div id="app"></div>
</body>
</html>
