import numpy as np

colors = {
    "W": u"\u001b[48;5;15m",
    "G": u"\u001b[48;5;2m",
    "R": u"\u001b[48;5;196m",
    "B": u"\u001b[48;5;4m",
    "O": u"\u001b[48;5;166m",
    "Y": u"\u001b[48;5;220m"
}
BG_RESET = u"\u001b[0m"


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


cube3 = Cube(3)
cube3.pprint()

cube4 = Cube(10)
cube4.pprint()
