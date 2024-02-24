import numpy as np
from typing import List

colors = {
    "W": u"\u001b[48;5;15m",
    "G": u"\u001b[48;5;2m",
    "R": u"\u001b[48;5;196m",
    "B": u"\u001b[48;5;4m",
    "O": u"\u001b[48;5;166m",
    "Y": u"\u001b[48;5;220m"
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

    def get_axis(self):
        if self.face in "xyz":
            return self.face
        if self.face in "RML":
            return "x"
        if self.face in "UED":
            return "y"
        # self.face in "FSB"
        return "z"

    def get_index(self, n: int):
        """
        Params:
            n: cube dimension
        Retuns:
            int: 0-indexed layer index along the axis
        """
        if (self.face in MIDDLE_LAYERS):
            # is possible only on odd-layered cube
            assert n % 2 == 1
            return (n - 1) // 2

        index = self.index - 1
        if (self.face in MINUS_LAYERS):
            index = n - 1 - index
        return index


def parse_move(move: str):
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
    def __init__(self, n):
        self.n = n

        # for each sticker, create a array element
        # this flat array will be used for serialization of the cube state
        self.flat = np.chararray(n*n*6, unicode=True)

        # self.faces is a numpy view, that means any changes in self.faces
        # will reflected in self.flat and vice versa
        # self.faces will be used for indexing the cube
        # self.faces[i] is nxn array
        self.faces = self.flat.reshape(6, n, n)

        for i, color in enumerate(colors.keys()):
            self.faces[i] = color

    def pprint(self):
        """
        Pretty print the cube in the following format:

         U
        LFRB
         D

        where each face is a nxn grid of color letter with corresponding
        colored background.
        """
        n = self.n
        print_table = np.chararray((3*self.n, 4*self.n), unicode=True)
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
                print(f"{colors[elem]}{elem}{BG_RESET}" if elem != ''
                      else " ", end='')
            print()

    def rotate_face(self, face, dir):
        """
        dir= 1 for clockwise face rotation
        dir=-1 for anticlockwise face rotation

        rot90 with k=1 rotates anticlockwise
        k = 3 results in anticlockwise rotation by 270 degrees, which equals
        90 degrees clockwise
        """
        k = 3 if dir == CW else 1
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
    def cycle_views(views):
        """
        Given a list of numpy views, assign the content of views[1]
        to views[0], views[2] to views[1], ..., views[0] to views[-1]
        """
        temp = views[0].copy()
        for i in range(len(views) - 1):
            views[i][:] = views[i + 1]

        views[-1][:] = temp

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
        if (face not in MINUS_LAYERS and dir == CW) \
                or (face in MINUS_LAYERS and dir == CCW):
            views.reverse()

        self.cycle_views(views)
        if double:
            self.cycle_views(views)

        if (index == 0 or index == self.n - 1):
            # outer layer
            self.rotate_face(face_to_int[face], dir)
            if double:
                self.rotate_face(face_to_int[face], dir)

    def is_solved(self):
        for face in self.faces:
            # check whether all stickers on the face are of the same color
            if not (face == face[0][0]).all():
                return False
        return True

    def handle_rotation(self, move: Move):
        f = self.faces
        if move.face == "x":
            views = [f[U], np.rot90(f[B], 2), f[D], f[F]]
            if move.dir == CW:
                views.reverse()
            self.cycle_views(views)
            self.rotate_face(R, move.dir)
            self.rotate_face(L, move.dir * -1)

        if move.face == "y":
            views = [f[F], f[L], f[B], f[R]]
            if move.dir == CW:
                views.reverse()
            self.cycle_views(views)
            self.rotate_face(U, move.dir)
            self.rotate_face(D, move.dir * -1)

        if move.face == "z":
            views = [f[U], np.rot90(f[R], 1), f[D][::-1, ::-1], np.rot90(f[L], 3)]
            if move.dir == CW:
                views.reverse()
            self.cycle_views(views)
            self.rotate_face(F, move.dir)
            self.rotate_face(B, move.dir * -1)
        return self


    def move(self, moves_str: str):
        moves: List[str] = moves_str.split()
        for move_str in moves:
            move: Move = parse_move(move_str)

            if move.face in "xyz":
                self.handle_rotation(move)
                continue

            self.rotate_layer(
                move.get_axis(),
                move.get_index(self.n),
                move.dir,
                move.face,
                move.double
            )
        return self


if __name__ == "__main__":
    # Cube(10).pprint()

    # cube3 = Cube(6)

    # print("Initial")
    # cube3.pprint()
    # cube3.rotate_layer('y', 0, 1)
    # print("after U")
    # cube3.rotate_face(U, 1)
    # cube3.pprint()

    # print("after R")
    # cube3.rotate_layer('x', 0, 1)
    # cube3.rotate_face(R, 1)
    # cube3.pprint()

    # print("after L")
    # cube3.rotate_layer('x', cube3.n-1, -1)
    # cube3.rotate_face(L, 1)
    # cube3.pprint()

    # print("after F")
    # cube3.rotate_layer('z', 0, 1)
    # cube3.rotate_face(F, 1)
    # cube3.pprint()

    # print(cube3.is_solved())

    # cube4 = Cube(4)
    # for i in range(4):
    #     cube3.rotate_layer('z', 0, 1)
    #     cube3.rotate_face(F, 1)

    # print(cube4.is_solved())
    pass
