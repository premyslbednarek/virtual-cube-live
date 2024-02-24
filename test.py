import unittest
from cube import parse_move


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


if __name__ == '__main__':
    unittest.main()
