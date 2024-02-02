class Timer {
    constructor(domElement) {
        this.domElement = domElement;
        this.startTime;
        this.started = false;
        this.inspection = false;
    }
    
    start() {
        if (this.inspection) {
            this.startTime = performance.now();
            this.started = true;
            this.inspection = false;
            this.update();
        }
    }
    async update() {
        if (!this.started) return;

        const timeElapsed = performance.now() - this.startTime;
        this.domElement.innerHTML = Math.floor(timeElapsed / 1000) + "s";

        setTimeout(() => this.update(), 1000);
    }
    stop(write=true) {
        const timeElapsed = performance.now() - this.startTime;
        const timeString = Math.floor(timeElapsed / 1000) + "s";
        this.started = false;
        if (write) {
            const timeListElement = document.getElementById("times");
            timeListElement.innerHTML += `<br> ${timeString}`;
        }
    }

    startInspection() {
        this.domElement.innerHTML = "inspection";
        this.inspection = true;
    }

    resetDom() {
        this.innerHTML = "timer stopped";
    }
}

const timerElement = document.getElementById("timer");
const timer = new Timer(timerElement);
const startTimer = () => { timer.start(); };
const stopTimer = () => { timer.stop(); };
const isStarted = () => { return timer.startTime != undefined; }

export {
    Timer,
    startTimer,
    stopTimer,
    isStarted
}