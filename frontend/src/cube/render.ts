import * as TWEEN from '@tweenjs/tween.js'
import Cube from './cube'

const to_render: Set<Cube> = new Set()
function addForRender(cube: Cube) {
    to_render.add(cube);
}

function removeForRender(cube: Cube) {
    to_render.delete(cube)
}

let renderRequested = false;
function renderAll() {
    console.log("rendered woken up")
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