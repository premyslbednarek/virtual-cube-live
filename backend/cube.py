import numpy as np
from typing import List
from math import floor
from random import choices
from pyTwistyScrambler import scrambler333, scrambler444, scrambler555, scrambler666, scrambler777, scrambler222
from enum import Enum

class Face(Enum):
    U = 0 # up
    F = 1 # front
    R = 2 # right
    B = 3 # back
    L = 4 # left
    D = 5 # down


class Direction(Enum):
    CW = 1 # clockwise
    CCW = -1 # counter-clockwise
    DOUBLE = 2 # double

    def reverse(self) -> "Direction":
        if self == Direction.CW:
            return Direction.CCW

        if self == Direction.CCW:
            return Direction.CW

        return Direction.DOUBLE

    def to_string(self) -> str:
        if self == Direction.CW:
            return ""

        if self == Direction.CCW:
            return "'"

        return "2"

colors = {
    b'W': "15m",
    b'G': "2m",
    b'R': "196m",
    b'B': "4m",
    b'O': "166m",
    b'Y': "220m"
}

def get_terminal_color(color: bytes) -> str:
    """Returns terminal escape sequence for given color.

    Args:
        color (bytes): Color string (WGRBOY).

    Returns:
        str: Terminal escape sequence.
    """
    assert len(color) == 1

    assert color in colors.keys(), f"{color} is not a valid color"

    return u"\u001b[48;5;" + colors[color]

INVERTED_DIRECTION_LAYERS = "DBLM"

class Move:
    def __init__(self, face: str, index: int, wide: bool, dir: Direction):
        """Initializes the object.

        Args:
            face (str): Move face. One of U,F,R,B,L,D,M,S,E or x, y, z for
                rotations
            index (int): The distance from outer layer. Layer with index = 1
                is the outer layer, the second layer has index = 2, etc.
            wide (bool): Whether the move is wide or not.
            dir (Direction): Move direction.
        """
        self.face = face
        self.index = index
        self.wide = wide
        self.dir = dir
        self.is_rotation = face in "xyz"
        self.is_middle = self.face in "MSE"

    def reverse(self) -> None:
        """Reverses move direction.
        """
        self.dir = self.dir.reverse()

    def get_axis(self) -> str:
        """Returns axis of rotation.

        Returns:
            str: Axis of rotation, one of x, y, z
        """
        if self.face in "xyz":
            return self.face
        if self.face in "RML":
            return "x"
        if self.face in "UED":
            return "y"
        # self.face in "FSB"
        return "z"

    def get_layer_indices(self, n: int) -> List[int]:
        """Returns layer indices of this move.

        Args:
            n (int): cube dimension

        Returns:
            List[int]: List of 0-indexed layer indices along the axis
        """
        if (self.is_middle):
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
        if (self.face in INVERTED_DIRECTION_LAYERS):
            indices = list(map(lambda index: n - 1 - index, indices))
        return indices

    @staticmethod
    def from_string(move: str) -> "Move":
        """Initialize the move from a string.

        Args:
            move (str): Move string in Rubik's cube notation.

        Returns:
            Move: A Move object.
        """
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

        if i < len(move) and move[i] == '2':
            dir = Direction.DOUBLE
        elif i < len(move) and move[i] == "'":
            dir = Direction.CCW
        else:
            dir = Direction.CW

        return Move(
            face=face,
            index=layer_index,
            wide=wide,
            dir=dir
        )


class Cube:
    def __init__(self, n: int, state: bytes=None):
        """Create a Cube object.

        Args:
            n (int): Cube size
            state (bytes, optional): Cube state obtained with the .serialize
                method. If no state is passed, a cube with default state will
                be created. Default state has the white color facing up
                and green facing front.
        """
        self.n = n

        # for each sticker, create a array element
        # this flat array will be used for serialization of the cube state
        if state is None:
            self.flat = np.zeros(n*n*6, dtype=np.dtype("S1"))
        else:
            self.flat = np.frombuffer(state, np.dtype("S1")).copy()

        # self.faces is a numpy view, that means any changes in self.faces
        # will reflected in self.flat and vice versa
        # self.faces will be used for indexing the cube
        # self.faces[i] is nxn array
        self.faces = self.flat.reshape(6, n, n)

        if state is None:
            for i, color in enumerate(colors.keys()):
                self.faces[i] = color

    def serialize(self) -> bytes:
        """Returns serialized inner cube state, which can be used to init
        this object (either in constructor or .deserialize method).

        Returns:
            bytes: Serialized cube state.
        """
        return self.flat.tobytes()

    def deserialize(self, buffer: bytes) -> None:
        """Initialize inner cube state from serialized state.

        Args:
            buffer (bytes): Cube state, which was obtained with the .serizalize
                method.
        """
        arr = np.frombuffer(buffer, np.dtype("S1"))
        self.flat[:] = arr.copy()

    def _get_face(self, face: Face) -> np.ndarray:
        """Gets cube face.

        Args:
            face (Face): Face object specifying the face.

        Returns:
            np.ndarray: ndarray of stickers with self.n * self.n dimensions
        """
        return self.faces[face.value]

    def pprint(self) -> None:
        """
        Pretty print the cube to stdout with colors.

        The cube is "unfolded" and printed in the following format:

              W W W
              W W W
              W W W
        O O O G G G R R R B B B
        O O O G G G R R R B B B
        O O O G G G R R R B B B
              Y Y Y
              Y Y Y
              Y Y Y
        """

        table_height = 3 * self.n
        table_width = 4 * self.n
        print_table: np.chararray = np.chararray((table_height, table_width))
        print_table[:] = ''

        # subdivide the print_table into 3x4 grid of n*n matrices
        def fill(row: int, col: int, face: Face):
            row_start = row * self.n
            col_start = col * self.n
            print_table[
                row_start : row_start + self.n,
                col_start : col_start + self.n
            ] = self._get_face(face)

        # fill the print_table with corresponding stickers
        fill(0, 1, Face.U)
        fill(1, 0, Face.L)
        fill(1, 1, Face.F)
        fill(1, 2, Face.R)
        fill(1, 3, Face.B)
        fill(2, 1, Face.D)

        for line in print_table:
            for elem in line:
                if elem == '':
                    print(" ", end='')
                    continue

                print(get_terminal_color(elem), end='') # color escape sequence
                print(elem.decode('UTF-8'), end='')     # color letter
                print(u"\u001b[0m", end='')             # reset terminal color

            print()

    def _rotate_face(self, face: Face, dir: Direction) -> None:
        """Rotate stickers on a face.

        This only affects stickers on the given face, thereby only self.n^2
        stickers are affected.

        Args:
            face (Face): A face that will be rotated.
            dir (Direction): Direction of rotation.
        """
        f = self._get_face(face)
        # passing dir = 1 to rot90 rotates anticlockwise, thus the reverse
        f[:] = np.rot90(f, dir.reverse().value)

    def _get_layer_stickers(self, axis: str, i: int) -> List[np.ndarray]:
        """Gets stickers on given layer.

        Args:
            axis (str): Axis on which we choose the layer.
            i (int): Index of the layer. For example, the left outer layer
                has index 0 and right outer layer has index of cube_size - 1

        Returns:
            List[np.ndarray]: List of views, each view includes stickers
                from one face.
        """
        assert axis in "xyz"
        if axis == "x":
            return [
                self._get_face(Face.U)[:, -1-i][::-1],
                self._get_face(Face.B)[:, i],
                self._get_face(Face.D)[:, -1-i][::-1],
                self._get_face(Face.F)[:, -1-i][::-1],
            ]
        if axis == "y":
            return [
                self._get_face(Face.F)[i],
                self._get_face(Face.L)[i],
                self._get_face(Face.B)[i],
                self._get_face(Face.R)[i]
            ]

        return [
            self._get_face(Face.U)[-1-i],
            self._get_face(Face.R)[:, i],
            self._get_face(Face.D)[i][::-1],
            self._get_face(Face.L)[:, -1-i][::-1]
        ]


    @staticmethod
    def _cycle_views(views: List[np.ndarray], dir: Direction):
        """Rotates a list of views (or simple ndararys) in specified direction.

        Args:
            views (List[np.ndarray]): List of ndarrays or views to rotated.
            dir (Direction): Rotation direction.
        """
        rotated = np.roll(views, dir.value, 0)
        for rotated, view in zip(rotated, views):
            view[:] = rotated


    def _rotate_layer(self, axis: str, index: int, dir: Direction, face: str):
        """Rotates one layer of the cube.

        Args:
            axis (str): An axis, around which we rotate.
            index (int): Distance of the rotated layer from the outer layer.
            dir (Direction): Direction of the rotation.
            face (str): A face, to which the layer belongs U/F/R/B/L/D/M/S/E
        """

        # the layer can move in other direction if the rotation is inverted
        # for example, CW clockwise of R and L face will result in the same
        # rotation of face stickers, but the stickers on other faces will
        # rotate in opposite directions
        layer_dir = dir
        if face in INVERTED_DIRECTION_LAYERS:
            layer_dir = layer_dir.reverse()
        self._cycle_views(self._get_layer_stickers(axis, index), layer_dir)

        # if the layer is an outer layer, move also the stickers of the face
        if (index == 0 or index == self.n - 1):
            self._rotate_face(Face[face], dir)

    def _perform_rotation(self, rotation: Move):
        """Performs a cube rotation - x, y, z moves.

        Args:
            rotation (Move): Move objects, that is a rotation.
        """
        assert rotation.is_rotation

        if rotation.face == "x":
            # stickers on these face swap places
            views = [
                self._get_face(Face.U),
                np.rot90(self._get_face(Face.B), 2),
                self._get_face(Face.D),
                self._get_face(Face.F)
            ]
            # f1, f2 only get rotated
            f1 = Face.R
            f2 = Face.L

        if rotation.face == "y":
            views = [
                self._get_face(Face.F),
                self._get_face(Face.L),
                self._get_face(Face.B),
                self._get_face(Face.R)
            ]
            f1 = Face.U
            f2 = Face.D

        if rotation.face == "z":
            views = [
                self._get_face(Face.U),
                np.rot90(self._get_face(Face.R), 1),
                self._get_face(Face.D)[::-1, ::-1],
                np.rot90(self._get_face(Face.L), 3)
            ]
            f1 = Face.F
            f2 = Face.B

        self._cycle_views(views, rotation.dir)
        self._rotate_face(f1, rotation.dir)
        self._rotate_face(f2, rotation.dir.reverse())

    def _single_move(self, move_str: str):
        """Performs a single move on the cube.

        Args:
            move_str (str): Move in Rubik's cube notation.
        """
        move: Move = Move.from_string(move_str)

        if move.is_rotation:
            self._perform_rotation(move)
            return

        for index in move.get_layer_indices(self.n):
            self._rotate_layer(
                move.get_axis(),
                index,
                move.dir,
                move.face,
            )

    def move(self, moves_str: str) -> "Cube":
        """Performs a move or sequence of moves on the cube.

        Args:
            moves_str (str): A single move a multiple moves in Rubik's cube
                notation separated by whitespace.

        Returns:
            Cube: self
        """
        moves: List[str] = moves_str.split()
        for move_str in moves:
            self._single_move(move_str)

        return self

    def is_solved(self) -> bool:
        """Checks whether the cube is solved.

        Returns:
            bool: true if the cube is solved, false otherwise.
        """
        for face in self.faces:
            # check whether all stickers on the face are of the same color
            if not (face == face[0][0]).all():
                return False
        return True


scrambler_dispatch = {
    2: scrambler222,
    3: scrambler333,
    4: scrambler444,
    5: scrambler555,
    6: scrambler666,
    7: scrambler777
}

def generate_scramble(size: int) -> str:
    """Generates scramble.

    Args:
        size (int): Cube size

    Returns:
        str: Scramble in Rubik's cube notation
    """
    if (size <= 7):
        return scrambler_dispatch[size].get_WCA_scramble()

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