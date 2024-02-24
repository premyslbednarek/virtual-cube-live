import unittest
from cube import parse_move, Cube


class TestClass(unittest.TestCase):
    def test_wide(self):
        self.assertTrue(parse_move("1212Uw2'").wide)
        self.assertFalse(parse_move("1212U2'").wide)

    def test_cw(self):
        self.assertEqual(parse_move("1212Uw2").dir, 1)
        self.assertEqual(parse_move("1212Uw2'").dir, -1)

    def test_index(self):
        self.assertEqual(parse_move("1212Uw2").index, 1212)
        self.assertEqual(parse_move("Uw2").index, 1)
        self.assertEqual(parse_move("2'").index, 2)

    def test_double(self):
        self.assertTrue(parse_move("1212Uw2").double)
        self.assertFalse(parse_move("Uw").double)

    def test_full(self):
        out = parse_move("17Rw2'")
        self.assertEqual(out.index, 17)
        self.assertEqual(out.face, "R")
        self.assertTrue(out.wide)
        self.assertTrue(out.double)
        self.assertEqual(out.dir, -1)

    def test_full2(self):
        out = parse_move("L")
        self.assertEqual(out.index, 1)
        self.assertEqual(out.face, "L")
        self.assertFalse(out.wide)
        self.assertFalse(out.double)
        self.assertEqual(out.dir, 1)

    def test_index2(self):
        move = parse_move("U")
        self.assertEqual(move.get_index(3), 0)
        self.assertEqual(move.get_index(5), 0)
        move = parse_move("3U")
        self.assertEqual(move.get_index(9), 2)
        move = parse_move("2U")
        self.assertEqual(move.get_index(9), 1)

    def test_index3(self):
        for layer in "LDB":
            move = parse_move(layer)
            self.assertEqual(move.get_index(3), 2)
            self.assertEqual(move.get_index(5), 4)
            move = parse_move(str(3) + layer)
            self.assertEqual(move.get_index(11), 8)

    def test_middle(self):
        for layer in "MSE":
            move = parse_move(layer)
            self.assertEqual(move.get_index(3), 1)
            self.assertEqual(move.get_index(5), 2)
            self.assertEqual(move.get_index(7), 3)

    def test_move_basic(self):
        c = Cube(3)
        # order of an algoritm is the number of times we have to perform it
        # before the cube comes to the original state
        # algorithm can be viewed as a permutation
        alg = "U D L' U' F B' F' R D' L R' D' B"

        # order calculated with https://mzrg.com/rubik/ordercalc.shtml
        # beware: the calculator uses SiGN notation
        order = 120
        c.move(alg)
        for i in range(order - 1):
            self.assertFalse(c.is_solved())
            c.move(alg)
        self.assertTrue(c.is_solved())

    def test_solve(self):
        c = Cube(3)
        solve = "D F D' F U' R U F' L L' F' B' B' L' B L L B D U L L' D B R y' x' z' z' y' y' x' x' x' y' R' U' U' F' F' U' R' F R D' y' U R' U R R U R' y' U U y' R' U R y' R' U' R U U y' R' U' R U' y' L U L' U' R U R' U' U' R U' U' R' U y' R' U' R y' y' y' F R U R' U' F' U U' L' U' U' L U L' U L U U U U R U R' F' R U R' U' R' F R R U' R' U U U R R U R U R' U' R' U' R' U R' U' U' "
        c.move(solve)
        self.assertTrue(c.is_solved())



if __name__ == '__main__':
    unittest.main()
