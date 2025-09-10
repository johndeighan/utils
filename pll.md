Using pll lib
=============

**pll** stands for "Python-like language", i.e.
a language where program structure is indicated
by indentation, not **{** and **}**.

For example, parsing:

```text
abc
	def
		ghi
```

results in the tokens:

|  kind  |  str  |
| ------ | ----- |
| line   | 'abc' |
| indent | ''    |
| line   | 'def' |
| indent | ''    |
| line   | 'ghi' |
| undent | ''    |
| undent | ''    |
| eof    | ''    |

Note that indents and undents are always balanced,
even if there isn't an explicit negative indentation
in the file.

