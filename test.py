import unittest
from cube import parse_move


class TestClass(unittest.TestCase):
    def test_wide(self):
        self.assertTrue(parse_move("1212Uw2'")["wide"])
        self.assertFalse(parse_move("1212U2'")["wide"])

    def test_cw(self):
        self.assertEqual(parse_move("1212Uw2")["dir"], 1)
        self.assertEqual(parse_move("1212Uw2'")["dir"], -1)

    def test_index(self):
        self.assertEqual(parse_move("1212Uw2")["index"], 1212)
        self.assertEqual(parse_move("Uw2")["index"], 1)
        self.assertEqual(parse_move("2'")["index"], 2)

    def test_double(self):
        self.assertTrue(parse_move("1212Uw2")["double"])
        self.assertFalse(parse_move("Uw")["double"])

    def test_full(self):
        out = parse_move("17Rw2'")
        exp = {
            "index": 17,
            "face": "R",
            "wide": True,
            "double": True,
            "dir": -1
        }
        self.assertEqual(out, exp)


if __name__ == '__main__':
    unittest.main()
