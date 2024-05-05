import React, { useEffect, useMemo, useRef } from "react";
import Cube from "../cube/cube";

export function RenderedCube({cube, fullscreen} : {cube: Cube, fullscreen?:boolean}) {
    const containerRef = useRef(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        cube.mount(container);

        return () => {
            cube.unmount(container);
        }
    }, [cube])

    const style: React.CSSProperties = fullscreen
        ? {position: "absolute", height: "100vh", width: "100vw", zIndex: -1}
        : {width: "100%", height: "100%"};

    return (
        <div ref={containerRef} style={style}></div>
    );
}


export function RotatingCube() {
    const c = useMemo(() => new Cube(5), [])
    c.controls.enabled = false;
    c.setSpeedMode(false);
    c.controls.autoRotate = true;
    c.controls.autoRotateSpeed = 3
    c.renderer.setClearColor(0x000000, 0)


    useEffect(() => {
        const onResize = () => {
            c.resizeCanvas();
        }

        let render = true;
        function animate() {
            if (render) requestAnimationFrame( animate );
            c.controls.update();
            c.render();
        }
        animate()

        window.addEventListener("resize", onResize);

        return () => {
            window.removeEventListener("resize", onResize);
            render = false;
        }
    }, [c])

    return <RenderedCube cube={c} />
}