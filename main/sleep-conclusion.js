(() => {
    const panel = document.getElementById('detail-panel');
    const dialog = document.getElementById('conclusion-screen');
    const back = document.getElementById('conclusion-back');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let openedAt = 0;
    let closing = false;
    function open() {
        if (dialog.open) return;
        openedAt = performance.now();
        SleepNetwork.stop();
        dialog.showModal();
        dialog.scrollTop = 0;
    }
    async function close() {
        if (closing || !dialog.open) return;
        closing = true;
        if (!reduced.matches) {
            await dialog.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(24px)'}],
                {duration:320,easing:'ease',fill:'forwards'}).finished;
        }
        dialog.close();
        dialog.getAnimations().forEach(animation => animation.cancel());
        closing = false;
    }
    document.getElementById('conclusion-open').addEventListener('click', open);
    back.addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('wheel', event => {
        if (event.deltaY < 0 && dialog.scrollTop <= 0 && performance.now() - openedAt > 700) {
            event.preventDefault();
            close();
        }
    }, {passive:false});
    dialog.addEventListener('close', () => {
        window.dispatchEvent(new CustomEvent('sleepdetailready'));
    });
})();
