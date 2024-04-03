const MS_IN_SECOND = 1000;
const SEC_IN_MINUTE = 60;

class Timer_ {
    constructor(domElement) {
        this.domElement = domElement;
        this.running = false;
    }

    stop() {
        if (!this.running) return;

        this.running = false;
        this.updateDom();
    }

    updateDom() {
        if (this.domElement == undefined) return;

        this.domElement.innerHTML = this.pretty();
    }

    pretty() {
        const timeMs = this.getTimeMS();
        const ms = timeMs % MS_IN_SECOND;

        const timeSec = Math.floor(timeMs / MS_IN_SECOND);
        const sec = timeSec % SEC_IN_MINUTE;

        const minutes = Math.floor(timeSec / SEC_IN_MINUTE)

        return ((minutes > 0) ? minutes + ":" : "") +
            sec.toString().padStart(2, '0') + ":" +
            ms.toString().padStart(3, '0');
    }

    async update() {
        if (!this.running) return;

        this.updateDom();

        setTimeout(() => this.update(), 50);
    }
}

export class Timer extends Timer_ {
    start() {
        this.startTime = performance.now();
        this.running = true;
        this.update();
    }

    getTimeMS() {
        return performance.now() - this.startTime;
    }
}

export class CountdownTimer extends Timer_ {
    start(targetTime) {
        this.targetTime = targetTime;
        this.running = true;
        this.update();
    }

    getTimeMS() {
        return this.targetTime - Date.now();
    }

    onTarget(callback) {
        if (this.onTargetCallbacks == undefined) {
            this.onTargetCallbacks = [];
        }
        this.onTargetCallbacks.push(callback);
    }

    update() {
        if (this.getTimeMS() < 0) {
            this.domElement.innerHTML = "Time's up!"
            for (const callback of this.onTargetCallbacks) {
                callback();
            }
            return;
        };

        super.update();
    }
}