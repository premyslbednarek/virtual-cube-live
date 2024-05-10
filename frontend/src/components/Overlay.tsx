import React from "react";

type Position = "top" | "bottom" | "left" | "right";

function getOverlayStyle(position: Position) : React.CSSProperties {
    switch (position) {
        case "top": return {width: "100%"};
        case "bottom": return {bottom: 0, width: "100%"};
        case "left": return {left: 0, top: 0, height: "100%"};
        case "right": return {right: 0, top: 0, height: "100%"};
    }
}

export function Overlay({position, children, style} : {position: Position, children: React.ReactNode, style?: React.CSSProperties}) {
    // div with absolute position located along page side
    return (
        <div style={{position: "absolute", padding: 10, ...getOverlayStyle(position), ...style}}>
            {children}
        </div>
    );
}