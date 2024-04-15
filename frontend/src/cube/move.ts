const CW = 1
const CCW = -1

function getAxis(face: string) {
    // return axis for a given face
    if ("RLM".includes(face)) return "x";
    if ("UED".includes(face)) return "y";
    if ("FSB".includes(face)) return "z";
    // throw new Error("Parameter is not a valid face!");
}

function isFlipped(face: string) {
    // return whether rotations of given face are inverted
    if ("RUFSE".includes(face)) return false;
    if ("LDBM".includes(face)) return true;
    // return new Error("Parameter is not a valid face!")
}

class Move {
    axis: string
    dir: number
    double: boolean

    constructor(axis: string, dir: number, double: boolean) {
        this.axis = axis;
        this.dir = dir;
        this.double = double;
    }

    reverse() {
        this.dir *= -1;
    }
}

class LayerMove extends Move {
    face: string
    index: number
    wide: boolean
    flipped: boolean
    isMiddle: boolean

    constructor(face: string, axis: string, flipped: boolean, index: number, dir: number, wide: boolean, double: boolean) {
        super(axis, dir, double);
        this.face = face;
        this.index = index;
        this.wide = wide;
        this.flipped = flipped;
        this.isMiddle = MIDDLE_LAYERS.includes(this.face);
    }

    toString() {
        let string = "";
        if (this.index > 1) string += this.index;
        string += this.face;
        if (this.wide) string += "w";
        if (this.double) string += "2";

        if (this.dir === -1) {
                string += "'"
        };

        return string;
    }

    changeAxis(newAxis: string, negateAxis: boolean) {
        this.axis = newAxis;

        if (negateAxis) {
            this.flipped = !this.flipped;
            // this.dir = this.dir * -1;
        }

        this.face = getFace(this.axis, this.flipped, this.isMiddle);
        // this.flipped = isFlipped(this.face);
    }

    get_indices(n: number) : Array<number> {
        if (this.isMiddle) {
            const indices = [];
            for (let i = 1; i < n - 1; ++i) {
                indices.push(i);
            }
            return indices;
        }

        let indices = []
        indices.push(this.index - 1)

        if (this.wide) {
            if (this.index === 1) {
                indices = [0, 1];
            } else {
                indices = []
                for (let i = 0; i < this.index; ++i) {
                    indices.push(i);
                }
            }
        }

        if (!isFlipped(this.face)) {
            for (let i = 0; i < indices.length; ++i) {
                indices[i] = n - 1 - indices[i];
            }
        }

        return indices
    }
}

const MIDDLE_LAYERS = "MSE"
// const MINUS_LAYERS = "DBLM"
// const ROTATIONS = "xyz"

function getFace(axis: string, flipped: boolean, isMiddle: boolean) {
    if (isMiddle) {
        switch (axis) {
            case "x": return "M";
            case "y": return "E";
            case "z": return "S";
        }
    }

    if (!flipped) {
        switch (axis) {
            case "x": return "R";
            case "y": return "U";
            case "z": return "F";
        }
    }

    switch (axis) {
        case "x": return "L";
        case "y": return "D";
        case "z": return "B";
    }

    throw Error("err")
}



class Rotation extends Move {
    flipped: boolean
    constructor(axis: string, dir: number, double=false) {
        super(axis, dir, double);
        this.flipped = false;
    }

    toString() {
        let string = this.axis;
        if (this.double) {
            string += "2";
        }
        if (this.dir === -1) {
            string += "'";
        }
        return string;
    }

    changeAxis(newAxis: string, negateAxis: boolean) {
        this.axis = newAxis;
        if (negateAxis) {
            this.dir *= -1;
        }
    }

    get_indices(n: number) : Array<number> {
        const indices = []
        for (let i = 0; i < n; ++i) {
            indices.push(i);
        }
        return indices;
    }
}

function parse_move(move: string) {
    let i = 0
    let layer_index = 0
    while ('0' < move[i] && move[i] <= '9') {
        layer_index *= 10;
        layer_index += move[i].charCodeAt(0) - '0'.charCodeAt(0);
        ++i;
    }

    if (layer_index === 0) {
        layer_index = 1
    }

    let face = move[i];
    i += 1;

    const isRotation = "xyz".includes(face);

    let wide = i < move.length && move[i] === "w"
    if (wide) {
        i += 1
    }

    if ('a' <= face && face <= 'z' && !isRotation) {
        wide = true;
        face = face.toUpperCase();
    }

    let double = i < move.length && move[i] === "2";
    if (double) {
        i += 1
    }

    let dir = CW
    if (i < move.length && move[i] === "'") {
        dir = CCW
    }

    if (isRotation) {
        return new Rotation(face, dir, double);
    }

    const axis = getAxis(face);
    const flipped = isFlipped(face);

    return new LayerMove(face, axis as any, flipped as any, layer_index, dir, wide, double);
}

export {
    parse_move,
    getFace,
    LayerMove,
    Rotation
}