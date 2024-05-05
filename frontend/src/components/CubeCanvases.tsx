import React, { useEffect, useRef } from "react";
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