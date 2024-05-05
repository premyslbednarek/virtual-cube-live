import numpy as np
from typing import List
from math import floor
from random import choices

colors = {
    b'W': u"\u001b[48;5;15m",
    b'G': u"\u001b[48;5;2m",
    b'R': u"\u001b[48;5;196m",
    b'B': u"\u001b[48;5;4m",
    b'O': u"\u001b[48;5;166m",
    b'Y': u"\u001b[48;5;220m"
}
BG_RESET = u"\u001b[0m"
CW = 1
CCW = -1
U = 0
F = 1
R = 2
B = 3
L = 4
D = 5
face_to_int = {
    "U": U,
    "R": R,
    "L": L,
    "D": D,
    "F": F,
    "B": B
}

MIDDLE_LAYERS = "MSE"
MINUS_LAYERS = "DBLM"


class Move:
    def __init__(self, face: str, index: int, wide: bool,
                 double: bool, dir: int):
        self.face = face
        self.index = index
        self.wide = wide
        self.double = double
        self.dir = dir

    def reverse(self) -> None:
        self.dir *= -1

    def get_axis(self) -> str:
        if self.face in "xyz":
            return self.face
        if self.face in "RML":
            return "x"
        if self.face in "UED":
            return "y"
        # self.face in "FSB"
        return "z"

    def get_indices(self, n: int) -> List[int]:
        """
        Params:
            n: cube dimension
        Retuns:
            int: 0-indexed layer index along the axis
        """
        if (self.face in MIDDLE_LAYERS):
            # all inner layers
            if (self.wide):
                return list(range(1, n - 1))

            return [n // 2]

        indices = []
        indices.append(self.index - 1)

        if (self.wide):
            if (self.index == 1):
                indices = [0, 1]
            else:
                indices = list(range(self.index))
        if (self.face in MINUS_LAYERS):
            indices = list(map(lambda index: n - 1 - index, indices))
        return indices



def parse_move(move: str) -> Move:
    i = 0
    layer_index = 0
    while move[i].isdigit():
        layer_index *= 10
        layer_index += int(move[i])
        i += 1

    # first layer index is implicit
    if (layer_index == 0):
        layer_index = 1

    face = move[i]
    i += 1

    wide = i < len(move) and move[i] == 'w'
    if (wide):
        i += 1

    if face.islower() and face not in "xyz":
        wide = True
        face = face.upper()

    double = i < len(move) and move[i] == '2'
    if (double):
        i += 1

    dir = CW
    if i < len(move) and move[i] == "'":
        dir = CCW

    return Move(
        face=face,
        index=layer_index,
        wide=wide,
        double=double,
        dir=dir
    )


class Cube:
    def __init__(self, n, bytes=None):
        self.n = n

        # for each sticker, create a array element
        # this flat array will be used for serialization of the cube state
        if bytes is None:
            self.flat = np.zeros(n*n*6, dtype=np.dtype("S1"))
        else:
            self.flat = np.frombuffer(bytes, np.dtype("S1")).copy()

        # self.faces is a numpy view, that means any changes in self.faces
        # will reflected in self.flat and vice versa
        # self.faces will be used for indexing the cube
        # self.faces[i] is nxn array
        self.faces = self.flat.reshape(6, n, n)
        if bytes is None:
            for i, color in enumerate(colors.keys()):
                self.faces[i] = color

    def serialize(self) -> bytes:
        return self.flat.tobytes()

    def deserialize(self, buffer: bytes) -> None:
        arr = np.frombuffer(buffer, np.dtype("S1"))
        self.flat[:] = arr.copy()

    def pprint(self) -> None:
        """
        Pretty print the cube in the following format:

         U
        LFRB
         D

        where each face is a nxn grid of color letter with corresponding
        colored background.
        """
        n = self.n
        print_table: np.chararray = np.chararray((3*self.n, 4*self.n))
        print_table[:] = ''
        np.set_printoptions(linewidth=200)

        def fill(x, y, face):
            print_table[x:x+n, y:y+n] = self.faces[face]

        # fill the print_table with corresponding stickers
        fill(0, n, 0)
        fill(n, n, 1)
        fill(n, 2*n, 2)
        fill(n, 0, 4)
        fill(n, 3*n, 3)
        fill(2*n, n, 5)

        for line in print_table:
            for elem in line:
                print(f"{colors[elem]}{elem.decode('UTF-8')}{BG_RESET}" if elem != ''
                      else " ", end='')
            print()

    def rotate_face(self, face, dir, double=False) -> None:
        """
        dir= 1 for clockwise face rotation
        dir=-1 for anticlockwise face rotation

        rot90 with k=1 rotates anticlockwise
        k = 3 results in anticlockwise rotation by 270 degrees, which equals
        90 degrees clockwise
        """
        k = 3 if dir == CW else 1
        if double:
            k = 2
        self.faces[face][:] = np.rot90(self.faces[face], k)

    def yaxis(self, i):
        return [
            self.faces[F][i],
            self.faces[L][i],
            self.faces[B][i],
            self.faces[R][i]
        ]

    def zaxis(self, i):
        return [
            self.faces[U][self.n-1-i],
            self.faces[R][:, i],
            self.faces[D][i][::-1],
            self.faces[L][:, self.n-1-i][::-1]
        ]

    def xaxis(self, i):
        return [
            self.faces[U][:, self.n-1-i][::-1],
            self.faces[B][:, i],
            self.faces[D][:, self.n-1-i][::-1],
            self.faces[F][:, self.n-1-i][::-1],
        ]

    @staticmethod
    def cycle_views(views, dir, double=False):
        """
        Given a list of numpy views, assign the content of views[1]
        to views[0], views[2] to views[1], ..., views[0] to views[-1]
        """
        temp = views[0].copy()
        last = views[0]
        r = range(1, len(views)) if dir == -1 else range(1, len(views))[::-1]
        for i in r:
            last[:] = views[i]
            last = views[i]

        last[:] = temp
        if (double):
            Cube.cycle_views(views, dir, False)

    def rotate_layer(self, axis: str, index: int, dir: int, face: str,
                     double: bool):
        """
        Rotate cube layer.
        """
        fun = {
            'x': Cube.xaxis,
            'y': Cube.yaxis,
            'z': Cube.zaxis,
        }

        views = fun[axis](self, index)
        layer_dir = dir
        if face in MINUS_LAYERS:
            layer_dir *= -1

        self.cycle_views(views, layer_dir, double)

        # outer layer? move also the stickers of the face
        if (index == 0 or index == self.n - 1):
            self.rotate_face(face_to_int[face], dir, double)

    def is_solved(self):
        for face in self.faces:
            # check whether all stickers on the face are of the same color
            if not (face == face[0][0]).all():
                return False
        return True

    def handle_rotation(self, move: Move):
        f = self.faces
        if move.face == "x":
            views = [
                f[U],
                np.rot90(f[B], 2),
                f[D],
                f[F]
            ]
            f1 = R
            f2 = L

        if move.face == "y":
            views = [
                f[F],
                f[L],
                f[B],
                f[R]
            ]
            f1 = U
            f2 = D

        if move.face == "z":
            views = [
                f[U],
                np.rot90(f[R], 1),
                f[D][::-1, ::-1],
                np.rot90(f[L], 3)
            ]
            f1 = F
            f2 = B

        self.cycle_views(views, move.dir, move.double)
        self.rotate_face(f1, move.dir, move.double)
        self.rotate_face(f2, move.dir * -1, move.double)

        return self


    def move(self, moves_str: str):
        moves: List[str] = moves_str.split()
        for move_str in moves:
            move: Move = parse_move(move_str)

            if move.face in "xyz":
                self.handle_rotation(move)
                continue

            for index in move.get_indices(self.n):
                self.rotate_layer(
                    move.get_axis(),
                    index,
                    move.dir,
                    move.face,
                    move.double
                )
        return self


def get_big_cube_scramble(size: str) -> str:
    # generate moves that are possible on a size x size cube
    # note that the list will not contain all the possible moves, but this is
    # not necessary for this usage
    possible_moves: List[str] = []

    for face in "UFRBLD":
        for layer_index in range(1, floor(size / 2) + 1):
            for dir in ["", "'", "2"]:
                index = layer_index if layer_index > 1 else ""
                possible_moves.append(f"{index}{face}{dir}")

    scramble_size = 120
    scramble_moves = choices(possible_moves, k=scramble_size)
    return ' '.join(scramble_moves)