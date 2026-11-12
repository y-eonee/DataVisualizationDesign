(() => {
    const visual = document.getElementById('detail-visual');
    const panel = document.getElementById('detail-panel');
    const screen = document.getElementById('detail-screen');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');

    window.addEventListener('sleepdetailready', () => {
        if (document.body.dataset.entry !== 'globe' || document.documentElement.classList.contains('personal-globe-entry') || reduced.matches || !panel.animate) return;

        const globe = visual.getBoundingClientRect();
        const layout = visual.parentElement.getBoundingClientRect();
        if (!globe.width || !globe.height || !layout.width || !layout.height) return;

        const from = {
            x: layout.left + layout.width / 2,
            y: layout.top + layout.height / 2,
            scale: Math.min(layout.width, layout.height) * .425
        };
        const to = {
            x: globe.left + globe.width / 2,
            y: globe.top + globe.height / 2,
            scale: Math.min(globe.width, globe.height) * .295
        };
        const camera = {...from};
        const duration = 1050;
        let frame;

        panel.inert = true;
        SleepNetwork.setIntroCamera(camera);
        screen.classList.add('is-globe-intro');
        AtlasTransition.syncSurface();
        const panelMotion = panel.animate([
            {opacity: 0},
            {opacity: 1}
        ], {duration, easing:'cubic-bezier(.35,.1,.3,1)', fill:'both'});

        function finish() {
            if (!screen.classList.contains('is-globe-intro')) return;
            cancelAnimationFrame(frame);
            screen.classList.remove('is-globe-intro');
            window.removeEventListener('resize', finish);
            panelMotion.cancel();
            SleepNetwork.setIntroCamera(null);
            AtlasTransition.syncSurface();
            panel.inert = false;
            render();
        }
        const started = performance.now();
        function move(now) {
            const progress = Math.min(1, Math.max(0, (now - started) / duration));
            if (progress === 1) { finish(); return; }
            const ease = 1 - (1 - progress) ** 3;
            camera.x = from.x + (to.x - from.x) * ease;
            camera.y = from.y + (to.y - from.y) * ease;
            camera.scale = from.scale + (to.scale - from.scale) * ease;
            frame = requestAnimationFrame(move);
        }
        render();
        frame = requestAnimationFrame(move);
        window.addEventListener('resize', finish, {once:true});
    }, {once:true});
})();
