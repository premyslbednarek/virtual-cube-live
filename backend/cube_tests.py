import unittest
from cube import parse_move, Cube
import numpy as np

# reconstruction of
# 1:47.87 WR 7x7 solve by Max Park at West Coast Cubing Tour - Fresno 2018
# source:
# https://www.speedsolving.com/threads/max-park-7x7-1-47-89-single-1-57-10-mean.70316/#post-1296768
wr7x7scramble = "L' b L2 R' 3f f2 F2 3d u F' L 3f B2 3d R2 D2 3r' b2 D' f' D2 f' D2 3l' b F B l2 3f' 3d2 L R2 3d2 3b2 B2 L' d' b' R2 B l' L' F' U' 3u2 d2 b' 3l2 R U' 3b f 3f' d D' U2 f2 R2 L2 D 3r U 3f2 3b 3r' d U' B2 F2 f l R u' R L' d2 u2 3u2 f2 R d b2 f U2 L 3f r' 3u' D' r D2 U 3f2 L2 U2 3b 3u r B' R"
solve = """
z y2 // inspection
 // centres
 // blue
r U' r' 4r 3r' // line
(z y) x' U 4r 3r' U 4r' 3r 3r2' r2 // line
U 5r U (x' z') U' 5r' 4r u' // line
x U x U' 3r x' 5r2' 4r2 (x' z') U 4r' // line
y 4r' 3r l' U l x' (y x) U' x U r' U 5l D' (r' 5l') // blue
 // green
U 5l U r' 3r' r U' 3r r' U // line
x r' U r U 3r' r U' 3r r' (x' z') U' 4r' 3r U' 3r' r z 3l' U U 3l // line
z' F U' U' 4l U' r' U U x' 4r x' U' (x z) u u r U' U' r' // line
(z x') F 5r' F 4r' U' x r2' z' U' U' r U' U' r' // line
(z x') 5r U 5r' x' 3r' r x U 5r' 4r z' U' 3r r' U2 3r' r // green
 // white
z r U' U' x x' D' (3r 4l) U' r' // line
F' U' 4r' U' U' x 3r' r U l // line
U 3r r' U' 3r' r U 3r r' U' U' x' U' U x' (r' 5l') F r2 5r' 4r // line
U' 3r U' U' 3r' 3r2' r2 U' 3r2' r2 // line
3r' r U 3r r' U' U' x' U U' x U 3r r' U' 3r' r U' U' r F r U' r2' // white
 // red
F U U 4l' U' x' 3r // line
U l' U l // line
U r U' r' 5r 4r' U l' 3l U' 5r 4r' U' 5r' 4r // line
3l U 4r' 4r U' U' 4r' x r U' r' U r U r' // line
U' x' U' 5l' U U 5l U x 4r' 3r 3r' r U 4r 3r' 3r r' 3r r' U2 3r' r // red
 // yellow / orange
(U x') F U' r' F r // line
U' U' U r r' U' r U r' r U' 4r 3r' U2 4r' 3r U 5l' // line
3r' r U U 4l r' // line
3r U' 3r' U U' r U' U' r' U r U r' U 3r U' U' 3r' // line
r r' U r U r' U' r U' U' r' //
U 5l' U' 3r' r U r U' 3r r' //
5r' 4r U r' U' 5r 4r' U r // yellow / orange
 // edges
 // F8E
U' z' U' R U' R' u R U R' F R' F' R 3u' d U' L' U L 3d d' R U R' F R' F' R u' // WG
U R U' R' u z' 4r' 3r z' R U R' F R' F' R z' 4r' 3r z 3d' d F R' F' R u // WR
L' U L d (U' y) U' R U' R' u F R' F' R 3u u' R U' R' U' 5u' // WB
U R U' z' U' 3r' r z' d R U R' F R' F' R u d' R U' R' z' 3r' r // WO
z u u' U U U' L' U L u R U R' F R' F' R u' 6d' F R' F' R 4u' U y R U' R' d' // RB
U' L' U L u u U F R' F' R (x' y') 3r r' z R U R' F R' F' R u F R' R R' F' R z' x 4r' 3r // OB
z R U' R' z2' U R U' R' d (y z') 4r' 3r 4r' 3r // YB
z' U' 6d' L' U L (x y') 4r2' (4r 3r) 4r' 3r 4r' z' R U R' F R' F' R u' U y 5u' // YR
 // L4E
U R U' R' z' 4r 3r2' r2 // fix centres
x' U2 (3r 4l) z R U R' F R' F' R z' 3r2' //
r' z' R U R' F R' F' R u // YG
z' x' 3r' r z' R U R' F R' F' R z 3r r' //
U2 U U' 5r' z' R U R' F R' F' R d // GO
z' 3r' z' R U R' F R' F' R 3u //
5d R U R' F R' F' R u' // YO
y z' 3r U' U' 3r x U U 3r U' U' 4r' U U 3l U' U' 3r' U U 3r U' U' 3r' U U 4l' // GR
 // 3x3x3
U' 6r' D x' D R D F F D // yellow cross
y R U' R2' U R // yRB
y' R' R2 U' R2' U R2 // yGR
U R' U R U' R' // uGO
L' U U L U' L' U L // yOB
U' R' U' R U' R' U R U x' R U' R' U // OLL
x 6l' U R' D D R U' R' D D R2 x' U // PLL
"""

lines = list(map(lambda x: x.split("/", 1)[0], solve.splitlines()))

for i in range(len(lines)):
    lines[i] = "".join(list(filter(lambda x: x not in "()", lines[i])))

wr7x7solve = " ".join(lines)

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
        self.assertEqual(move.get_indices(3), [0])
        self.assertEqual(move.get_indices(5), [0])
        move = parse_move("3U")
        self.assertEqual(move.get_indices(9), [2])
        move = parse_move("2U")
        self.assertEqual(move.get_indices(9), [1])

    def test_index3(self):
        for layer in "LDB":
            move = parse_move(layer)
            self.assertEqual(move.get_indices(3), [2])
            self.assertEqual(move.get_indices(5), [4])
            move = parse_move(str(3) + layer)
            self.assertEqual(move.get_indices(11), [8])

    def test_middle(self):
        for layer in "mse":
            move = parse_move(layer)
            self.assertEqual(move.get_indices(3), [1])
            self.assertEqual(move.get_indices(5), [1, 2, 3])
            self.assertEqual(move.get_indices(7), [1, 2, 3, 4, 5])
        for layer in "MSE":
            move = parse_move(layer)
            self.assertEqual(move.get_indices(3), [1])
            self.assertEqual(move.get_indices(5), [2])
            self.assertEqual(move.get_indices(7), [3])

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

    def test_cycle_pos(self):
        a = np.arange(12).reshape(4, 3)
        views = [a[0], a[1], a[2], a[3]]
        Cube.cycle_views(views, 1)
        exp = np.roll(np.arange(12), 3).reshape(4, 3)
        self.assertTrue(np.array_equiv(a, exp))

    def test_cycle_neg(self):
        a = np.arange(12).reshape(4, 3)
        views = [a[0], a[1], a[2], a[3]]
        Cube.cycle_views(views, -1)
        exp = np.roll(np.arange(12), -3).reshape(4, 3)
        self.assertTrue(np.array_equiv(a, exp))

    def test_cycle_double(self):
        a = np.arange(12).reshape(4, 3)
        views = [a[0], a[1], a[2], a[3]]
        Cube.cycle_views(views, 1, True)
        exp = np.roll(np.arange(12), 6).reshape(4, 3)
        self.assertTrue(np.array_equiv(a, exp))

    def test_double_(self):
        c = Cube(3)
        # order of an algoritm is the number of times we have to perform it
        # before the cube comes to the original state
        # algorithm can be viewed as a permutation
        alg = "R2 U2 L2"

        # order calculated with https://mzrg.com/rubik/ordercalc.shtml
        # beware: the calculator uses SiGN notation
        order = 4
        c.move(alg)
        for i in range(order - 1):
            self.assertFalse(c.is_solved())
            c.move(alg)
        self.assertTrue(c.is_solved())

    def test_wide_(self):
        c = Cube(7)
        c.move("4Rw 3Lw'")
        c2 = Cube(7)
        c2.move("x")
        self.assertTrue(np.array_equal(c.flat, c2.flat))

    def test_wide_small_(self):
        c = Cube(3).move("r R' M")
        self.assertTrue(c.is_solved())

    def test_big(self):
        c = Cube(7)
        c.move(wr7x7scramble)
        c.move(wr7x7solve)
        self.assertTrue(c.is_solved())



if __name__ == '__main__':
    unittest.main()
