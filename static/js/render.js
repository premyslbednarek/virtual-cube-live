const to_render = new Set()
import * as TWEEN from './libs/tween.module.js';

function addForRender(cube) {
    to_render.add(cube);
}

function removeForRender(cube) {
    to_render.delete(cube)
}

let renderRequested = false;
function renderAll() {
    renderRequested = false;
    TWEEN.update();
    for (const cube of to_render) {
        cube.render();
    }

    requestRenderIfNotRequested();
}

function requestRenderIfNotRequested() {
    if (!renderRequested && to_render.size) {
        renderRequested = true;
        requestAnimationFrame(renderAll);
    }
}

export {
    addForRender,
    removeForRender,
    requestRenderIfNotRequested
}