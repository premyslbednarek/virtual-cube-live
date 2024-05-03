import React from "react";

export function Panel({position, children} : {position: string, children: React.ReactNode}) {
    const extraStyle = position === "left" ? {left: 0, height: "100%"}
        : position === "right" ? {right: 0, height: "100%"}
        : position === "bottom" ? {bottom: 0, width: "100%"}
        : {width: "100%"}
    return (
        <div style={{position: "absolute", padding: 10, ...extraStyle}}>
            {children}
        </div>
    );
}