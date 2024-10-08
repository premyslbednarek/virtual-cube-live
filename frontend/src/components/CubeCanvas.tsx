import React, { useEffect, useMemo, useRef } from "react";
import Cube from "../cube/cube";

export default function CubeCanvas({cube, fullscreen} : {cube: Cube, fullscreen?:boolean}) {
    // component, which shows render of the passed cube
    const containerRef = useRef(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // add cube canvas to the div
        cube.mount(container);

        return () => {
            // remove cube canvas from div
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
    // show rotating cube, can be used as a background
    const c = useMemo(() => new Cube(5), [])
    c.orbitCamera.enabled = false;
    c.setSpeedMode(false);
    c.orbitCamera.autoRotate = true;
    c.orbitCamera.autoRotateSpeed = 3
    c.renderer.setClearColor(0x000000, 0)


    useEffect(() => {
        const onResize = () => {
            c.resizeCanvas();
        }

        let render = true;
        function animate() {
            if (render) requestAnimationFrame( animate );
            c.orbitCamera.update();
            c.render();
        }
        animate()

        window.addEventListener("resize", onResize);

        return () => {
            window.removeEventListener("resize", onResize);
            render = false;
        }
    }, [c])

    return <CubeCanvas cube={c} />
}