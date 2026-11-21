// The first screen while the app checks who is signed in. The page itself paints the boot screen
// (#boot in resources/views/app.blade.php), so there is no white flash before the JS arrives. In the
// installed app it continues Android's maroon splash. This file decides when it fades away.
import { useEffect, useState } from 'react';

// How many BootScreens are mounted. The page's boot screen stays while any one is.
let holds = 0;

function release() {
    // Wait a frame, so a screen that takes over in the same update counts first.
    requestAnimationFrame(() => {
        if (holds > 0) return;
        const boot = document.getElementById('boot');
        if (!boot || boot.dataset.leaving) return;
        boot.dataset.leaving = 'true';
        const remove = () => boot.remove();
        boot.addEventListener('transitionend', remove, { once: true });
        window.setTimeout(remove, 400);
    });
}

// Mounted once beside the router. Fades the boot screen out on the first screen that is not loading.
export function BootRelease() {
    useEffect(() => release(), []);
    return null;
}

// Shown while the signed-in check runs. On the first load it keeps the page's boot screen up. Later
// (after signing in again, say) it draws the same light screen itself.
export function BootScreen() {
    const [pageBoot] = useState(() => document.getElementById('boot') !== null);

    useEffect(() => {
        holds += 1;
        return () => {
            holds -= 1;
            release();
        };
    }, []);

    if (pageBoot) return null;

    return (
        <div className="boot" role="status" aria-label="Loading DRRMO EAMS">
            <img
                className="boot-logo"
                src="/images/brand/drrmo-logo.webp"
                alt=""
                width={288}
                height={320}
            />
            <div className="boot-bar" aria-hidden="true">
                <span />
            </div>
        </div>
    );
}
