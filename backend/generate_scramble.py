from math import floor
from random import choices
from typing import List

from pyTwistyScrambler import scrambler222, scrambler333, scrambler444, scrambler555, scrambler666, scrambler777

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