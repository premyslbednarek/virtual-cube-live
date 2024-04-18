const MS_IN_SECOND = 1000;
const SEC_IN_MINUTE = 60;

export function print_time(time_in_ms: number) {
    time_in_ms = Math.round(time_in_ms);
    const ms = time_in_ms % MS_IN_SECOND;

    const timeSec = Math.floor(time_in_ms / MS_IN_SECOND);
    const sec = timeSec % SEC_IN_MINUTE;

    const minutes = Math.floor(timeSec / SEC_IN_MINUTE)

    return ((minutes > 0) ? minutes + ":" : "") +
        sec.toString().padStart(2, '0') + ":" +
        ms.toString().padStart(3, '0');

}

export abstract class Timer_ {
    domElement: HTMLElement | undefined
    running: boolean

    constructor() {
        this.running = false;
    }

    mount(domElement: HTMLElement | null) {
        if (domElement == null) return;
        this.domElement = domElement;
    }

    stop() {
        if (!this.running) return;

        this.running = false;
        this.updateDom();
    }

    updateDom() {
        if (this.domElement === undefined) return;
        this.domElement.innerHTML = print_time(this.getTimeMS());
    }

    abstract getTimeMS() : number;

    update() {
        if (!this.running) return;

        this.updateDom();

        setTimeout(() => this.update(), 50);
    }
}

export class Timer extends Timer_ {
    startTime!: number

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
    targetTime!: Date
    onTargetCallbacks!: Array<() => void>

    start(targetTime: Date) {
        this.targetTime = targetTime;
        this.running = true;
        this.update();
    }

    getTimeMS() {
        return this.targetTime.getTime() - Date.now();
    }

    onTarget(callback: () => void) {
        if (this.onTargetCallbacks === undefined) {
            this.onTargetCallbacks = [];
        }
        this.onTargetCallbacks.push(callback);
    }

    update() {
        if (this.getTimeMS() < 0) {
            if (this.domElement) {
                this.domElement.innerHTML = "Time's up!"
                for (const callback of this.onTargetCallbacks) {
                    callback();
                }
                return;
            }
        };

        super.update();
    }
}