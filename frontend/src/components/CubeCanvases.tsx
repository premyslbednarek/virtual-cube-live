import { useEffect, useRef } from "react";
import Cube from "../cube/cube";

export function RenderedCube({cube} : {cube: Cube}) {
    const containerRef = useRef(null);

    useEffect(() => {
        console.log("Mounting")
        const container = containerRef.current;
        if (!container) return;
        cube.mount(container);

        const onResize = () => {
            cube.resizeCanvas();
        }

        window.addEventListener("resize", onResize);
        return () => {
            window.removeEventListener("resize", onResize);
            console.log("Unmounting")
            cube.unmount(container);
        }
    }, [cube])

    return (
        <div ref={containerRef} style={{width: "100%", height: "100%"}}></div>
    );
}