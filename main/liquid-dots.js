// Local, analytic metaball connections. No blur, pixel filters or displaced centers.
window.LiquidDots = (() => {
    // Only immediate grid neighbors may form small outer-shell necks.
    const offsets = [
        [1, 0],
        [0, 1],
        [1, 1],
        [-1, 1]
    ];
    const clamp = value => Math.max(0, Math.min(1, value));
    const smooth = value => {
        const t = clamp(value);
        return t * t * (3 - 2 * t);
    };
    const point = (node, radius, angle) => ({
        x: node.x + radius * Math.cos(angle),
        y: node.y + radius * Math.sin(angle)
    });

    function bridge(ctx, a, b, r1, r2, strength) {
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        const sum = r1 + r2,
            maxDistance = sum + Math.min(r1, r2) * .82;
        if (d >= maxDistance || d <= Math.abs(r1 - r2) || strength <= 0) return;
        const v = .50 * smooth(strength) * smooth((maxDistance - d) / (Math.min(r1, r2) * .9));
        if (v < .001) return;
        let u1 = 0,
            u2 = 0;
        if (d < sum) {
            u1 = Math.acos(Math.max(-1, Math.min(1, (r1 * r1 + d * d - r2 * r2) / (2 * r1 * d))));
            u2 = Math.acos(Math.max(-1, Math.min(1, (r2 * r2 + d * d - r1 * r1) / (2 * r2 * d))));
        }
        const axis = Math.atan2(b.y - a.y, b.x - a.x);
        const tangent = Math.acos(Math.max(-1, Math.min(1, (r1 - r2) / d)));
        const aa = axis + u1 + (tangent - u1) * v,
            ab = axis - u1 - (tangent - u1) * v;
        const ba = axis + Math.PI - u2 - (Math.PI - u2 - tangent) * v;
        const bb = axis - Math.PI + u2 + (Math.PI - u2 - tangent) * v;
        const p1 = point(a, r1, aa),
            p2 = point(b, r2, ba),
            p3 = point(b, r2, bb),
            p4 = point(a, r1, ab);
        const handle = Math.min(v * 2.4, Math.hypot(p2.x - p1.x, p2.y - p1.y) / sum) * Math.min(1, 2 * d / sum);
        const h1 = r1 * handle,
            h2 = r2 * handle;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.bezierCurveTo(p1.x + Math.cos(aa - Math.PI / 2) * h1, p1.y + Math.sin(aa - Math.PI / 2) * h1,
            p2.x + Math.cos(ba + Math.PI / 2) * h2, p2.y + Math.sin(ba + Math.PI / 2) * h2, p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.bezierCurveTo(p3.x + Math.cos(bb - Math.PI / 2) * h2, p3.y + Math.sin(bb - Math.PI / 2) * h2,
            p4.x + Math.cos(ab + Math.PI / 2) * h1, p4.y + Math.sin(ab + Math.PI / 2) * h1, p4.x, p4.y);
        ctx.closePath();
        ctx.fill();
    }

    function draw(ctx, nodes, colors, alpha) {
        if (!nodes.length) return;
        const grid = new Map(nodes.map(node => [node.cell.col + ',' + node.cell.row, node]));
        const pairs = [];
        for (const a of nodes)
            for (const [dx, dy] of offsets) {
                const b = grid.get((a.cell.col + dx) + ',' + (a.cell.row + dy));
                if (!b || a.cell.regionId !== b.cell.regionId) continue;
                const strength = clamp((Math.min(a.factor, b.factor) - 1.08) / .8);
                if (strength > 0) pairs.push({
                    a,
                    b,
                    strength
                });
            }
        // Paint outer shells before inner colors, so a neighbor's shell cannot hide a core.
        for (let layer = 0; layer < 3; layer++) {
            for (const node of nodes) {
                const ring = node.cell.rings[layer];
                if (!ring) continue;
                ctx.globalAlpha = alpha(node.cell);
                ctx.fillStyle = colors[ring.day];
                ctx.beginPath();
                // Inner colors remain separate round cores, with only restrained enlargement.
                const radius = layer === 0 ? node.radius :
                    (node.radius / node.factor) * Math.min(node.factor, 1.12) * ring.ratio;
                ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
                ctx.fill();
            }
            if (layer !== 0) continue;
            for (const {
                    a,
                    b,
                    strength
                }
                of pairs) {
                const ar = a.cell.rings[layer],
                    br = b.cell.rings[layer];
                // Join matching colors only; no muddy mixing or connections between regions.
                if (!ar || !br || ar.day !== br.day) continue;
                ctx.globalAlpha = Math.min(alpha(a.cell), alpha(b.cell));
                ctx.fillStyle = colors[ar.day];
                bridge(ctx, a, b, a.radius * ar.ratio, b.radius * br.ratio, strength);
            }
        }
    }
    return {
        draw
    };
})();
