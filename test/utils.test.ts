"use strict";
// utils.test.civet

import {
	undef, defined, notdefined,
	curLogLevel, DBG,
	wsSplit, words, range, normalizeStr, spaces, tabs,
	getNExtra, rpad, lpad, centered, alignString, zpad,
	blockToArray, toArray, arrayToBlock, toBlock,
	removeLines, escapeStr, escapeBlock,
	relpath, getPattern,
	getCmdArgs,
	} from '../src/lib/utils.ts'
import {
	equal, like, succeeds, fails, truthy, falsy,
	} from '../src/lib/unit-test.ts'

const hArgs = getCmdArgs()

// ---------------------------------------------------------------------------

DBG("wsSplit()")

equal(wsSplit("abc def"), ["abc", "def"])
equal(wsSplit("abc"), ["abc"])
equal(wsSplit(""), [])
equal(wsSplit("  "), [])
equal(wsSplit("\t"), [])
equal(wsSplit("  abc  def\t\t"), ["abc", "def"])

DBG("words()")

equal(words("abc def"), ["abc", "def"])
equal(words("abc"), ["abc"])
equal(words(""), [])
equal(words("  "), [])
equal(words("\t"), [])
equal(words("  abc  def\t\t"), ["abc", "def"])
equal(words(" abc  def", "ghi j "), [
	"abc",
	"def",
	"ghi",
	"j"
	])

DBG("range()")

equal(Array.from(range(3)), [0, 1, 2])
equal(Array.from(range(5)), [0, 1, 2, 3, 4])

DBG("normalizeStr()")

equal(normalizeStr("abc\r\ndef\r\n"), "abc\ndef")
equal(normalizeStr("  abc\r\ndef  "), "abc\ndef")

DBG("spaces()")

equal(spaces(3), '   ')

DBG("tabs()")

equal(tabs(3), '\t\t\t')

DBG("getNExtra()")

equal(getNExtra('abcd', 10), 6)
equal(getNExtra('abcd', 2), 0)

DBG("rpad()")

equal(rpad('abcd', 10, '-'), 'abcd------')

DBG("lpad()")

equal(lpad('abcd', 10, '-'), '------abcd')

DBG("centered()")

equal(centered('abcd', 12, '-'), '--  abcd  --')

DBG("alignString()")

equal(alignString('abc', 5, 'left'), 'abc  ')
equal(alignString('abc', 5, 'center'), ' abc ')
equal(alignString('abc', 5, 'right'), '  abc')
equal(alignString('abc', 5, 'l'), 'abc  ')
equal(alignString('abc', 5, 'c'), ' abc ')
equal(alignString('abc', 5, 'r'), '  abc')

DBG("zpad()")

equal(zpad(23, 5), '00023')

DBG("blockToArray()")

equal(blockToArray('abc\ndef'), ['abc','def'])

DBG("toArray()")

equal(toArray('abc\ndef'), ['abc','def'])
equal(toArray(['abc','def']), ['abc','def'])

DBG("arrayToBlock()")

equal(arrayToBlock(['abc','def']), 'abc\ndef')

DBG("toBlock()")

equal(toBlock(['abc','def']), 'abc\ndef')
equal(toBlock('abc\ndef'), 'abc\ndef')

DBG("removeLines()")

equal(removeLines('abc\ndef', 'def'), 'abc')
equal(removeLines('abc\ndef', 'abc'), 'def');

(() => {
	const block = `D =====  test/temp.txt  =====
D debug
I info
D =====  test/temp2.txt  =====
D debug
I info`
	equal(removeLines(block, /^[A-Z] =====.*=====$/), `D debug
I info
D debug
I info`)
}
	)()

DBG("escapeStr()")

equal(escapeStr('abc'), 'abc')
equal(escapeStr('   abc'), '˳˳˳abc')
equal(escapeStr('\t\t\tabc'), '→→→abc')
equal(escapeStr('abc\r\ndef'), 'abc←↓def')

DBG("escapeBlock()")

equal(escapeBlock('abc'), 'abc')
equal(escapeBlock('   abc'), '˳˳˳abc')
equal(escapeBlock('\t\t\tabc'), '→→→abc')
equal(escapeBlock('abc\r\ndef'), `abc←
def`)
equal(escapeBlock('abc\ndef'), `abc
def`)
equal(escapeBlock('abc\ndef'), `abc
def`)
equal(escapeBlock('   abc\n\t\t\tdef'), `˳˳˳abc
→→→def`)

equal(getPattern(), "**/*{.dot,.cielo,.civet}")

// --- getCmdArgs() without hDesc

equal(getCmdArgs(undef, ['-abc']), {
	_: [],
	a: true,
	b: true,
	c: true
	})

equal(getCmdArgs(undef, ['-abc=xyz']), {
	_: [],
	abc: 'xyz'
	})

equal(getCmdArgs(undef, ['-abc=xyz', 'table']), {
	_: ['table'],
	abc: 'xyz'
	})

equal(getCmdArgs(undef, ['-Df']), {
	_: [],
	f: true,
	D: true
	})

// -------------------------------------------------------------

DBG("getCmdArgs()")

equal(getCmdArgs(undef, ['-D']), {
	_: [],
	D: true
	})
equal(curLogLevel(), 'debug')

equal(getCmdArgs(undef, ['-P']), {
	_: [],
	P: true
	})
equal(curLogLevel(), 'profile')

equal(getCmdArgs(undef, ['-I']), {
	_: [],
	I: true
	})
equal(curLogLevel(), 'info');

// -------------------------------------------------------------
// --- getCmdArgs() with hDesc

(() => {
	// --- commmand 'compile' allows the following options:
	//        -f  - force compilation
	//        -w  - watch for file changes
	//        -n  - suppress post processing
	//        -dirspec=<spec>  - 'binDir' or 'libDir'
	//     plus any number of non-options
	//     (but we pretend it must be 1, 2 or 3)

	const hDesc = {
		f: {type: 'boolean'},
		w: {type: 'boolean'},
		n: {type: 'boolean'},
		d: {type: 'boolean'},
		dirspec: {type: ['libDir','binDir']},
		_: {range: [1, 3]}
		}

	// --- There is no flag named 'f'
	fails(() => getCmdArgs(hDesc, ['-daf', 'file1']))

	// --- option 'dirspec' must be 'libDir' or 'binDir'
	fails(() => getCmdArgs(hDesc, ['-dirspec=42', 'file1']))
	fails(() => getCmdArgs(hDesc, ['-dirspec=blib', 'file1']))

	// --- There must be at least one non-option, and no more than 3
	fails( () => getCmdArgs(hDesc, ['-gf']))
	fails( () => getCmdArgs(hDesc, ['-gf', 'a', 'b', 'c', 'd']))
}
	)();

(() => {
	const hDesc = {
		file: {type: 'string'},
		f: {type: 'boolean'},
		n: {type: 'boolean'},
		w: {type: 'boolean'},
		d: {type: 'boolean'}
		}

	equal(getCmdArgs(hDesc, ['-wd']), {
		_: [],
		d: true,
		f: false,
		n: false,
		w: true
		})
	equal(getCmdArgs(hDesc, ['-wd', 'temp.txt']), {
		_: ['temp.txt'],
		d: true,
		f: false,
		n: false,
		w: true
		})
	equal(getCmdArgs(hDesc, ['-wd', '-file=temp.txt']), {
		_: [],
		d: true,
		f: false,
		n: false,
		w: true,
		file: 'temp.txt'
		})
}
	)();

(() => {
	const hDesc = {
		file: {type: 'string'},
		f: {type: 'boolean'},
		n: {type: 'boolean'},
		w: {type: 'boolean'}
		}
	const lArgs = ['temp.txt', '-fw', 'temp2.txt', '-file=abc.txt']

	const {_, file, f: force, n: nopp, w: watch} = getCmdArgs(hDesc, lArgs)
	equal(_, ['temp.txt', 'temp2.txt'])
	equal(file, 'abc.txt')
	equal(force, true)
	equal(nopp, false)
	equal(watch, true)
}
	)();

(() => {
	const hDesc = {
		file: {type: 'string'},
		f: {},
		n: {},
		w: {}
		}
	const lArgs = ['temp.txt', '-fw', 'temp2.txt', '-file=abc.txt']

	const {_, file, f: force, n: nopp, w: watch} = getCmdArgs(hDesc, lArgs)
	equal(_, ['temp.txt', 'temp2.txt'])
	equal(file, 'abc.txt')
	equal(force, true)
	equal(nopp, false)
	equal(watch, true)
}
	)();

(() => {
	const hDesc = {
		file: {type: 'string'},
		f: undef,
		n: undef,
		w: undef
		}
	const lArgs = ['temp.txt', '-fw', 'temp2.txt', '-file=abc.txt']
	const {_, file, f: force, n: nopp, w: watch} = getCmdArgs(hDesc, lArgs)
	equal(_, ['temp.txt', 'temp2.txt'])
	equal(file, 'abc.txt')
	equal(force, true)
	equal(nopp, false)
	equal(watch, true)
}
	)()

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC91dGlscy50ZXN0LmNpdmV0LnRzeCIsInNvdXJjZXMiOlsidGVzdC91dGlscy50ZXN0LmNpdmV0Il0sIm1hcHBpbmdzIjoiO0FBQUEsbUJBQWtCO0FBQ2xCLEFBQUE7QUFDQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUM7QUFDNUIsQ0FBQyxXQUFXLENBQUMsQ0FBQyxHQUFHLENBQUM7QUFDbEIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDbkQsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDcEQsQ0FBQyxZQUFZLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFDOUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxXQUFXLENBQUM7QUFDckMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUM7QUFDckIsQ0FBQyxVQUFVLENBQUM7QUFDWixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMscUJBQXFCO0FBQzdCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQzdDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyx5QkFBeUI7QUFDakMsQUFBQTtBQUNBLEFBQUEsQUFBSyxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDckIsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsR0FBRyxDQUFBLEFBQUMsV0FBVyxDQUFBO0FBQ2YsQUFBQTtBQUNBLEFBQUEsQUFBQSxLQUFLLENBQUEsQUFBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQ3hDLEFBQUEsQUFBQSxLQUFLLENBQUEsQUFBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQzdCLEFBQUEsQUFBQSxLQUFLLENBQUEsQUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNyQixBQUFBLEFBQUEsS0FBSyxDQUFBLEFBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDdkIsQUFBQSxBQUFBLEtBQUssQ0FBQSxBQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3ZCLEFBQUEsQUFBQSxLQUFLLENBQUEsQUFBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUE7QUFDL0MsQUFBQTtBQUNBLEFBQUEsQUFBQSxHQUFHLENBQUEsQUFBQyxTQUFTLENBQUE7QUFDYixBQUFBO0FBQ0EsQUFBQSxBQUFBLEtBQUssQ0FBQSxBQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUE7QUFDdEMsQUFBQSxBQUFBLEtBQUssQ0FBQSxBQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUE7QUFDM0IsQUFBQSxBQUFBLEtBQUssQ0FBQSxBQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ25CLEFBQUEsQUFBQSxLQUFLLENBQUEsQUFBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNyQixBQUFBLEFBQUEsS0FBSyxDQUFBLEFBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDckIsQUFBQSxBQUFBLEtBQUssQ0FBQSxBQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUM3QyxBQUFBLEFBQUEsS0FBSyxDQUFBLEFBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNyQyxBQUFBLENBQUMsS0FBSyxDQUFBO0FBQ04sQUFBQSxDQUFDLEtBQUssQ0FBQTtBQUNOLEFBQUEsQ0FBQyxLQUFLLENBQUE7QUFDTixBQUFBLENBQUMsR0FBRztBQUNKLEFBQUEsQ0FBQyxDQUFDLENBQUE7QUFDRixBQUFBO0FBQ0EsQUFBQSxBQUFBLEdBQUcsQ0FBQSxBQUFDLFNBQVMsQ0FBQTtBQUNiLEFBQUE7QUFDQSxBQUFBLEFBQUEsS0FBSyxDQUFBLEFBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDckMsQUFBQSxBQUFBLEtBQUssQ0FBQSxBQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzNDLEFBQUE7QUFDQSxBQUFBLEFBQUEsR0FBRyxDQUFBLEFBQUMsZ0JBQWdCLENBQUE7QUFDcEIsQUFBQTtBQUNBLEFBQUEsQUFBQSxLQUFLLENBQUEsQUFBQyxZQUFZLENBQUMsZ0JBQWdCLENBQUMsQ0FB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R0FBRyxDQUFBLEFBQUMsZUFBZSxDQUFBO0FBQ25CLEFBQUE7QUFDQSxBQUFBLEFBQUEsS0FBSyxDQUFBLEFBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFBO0FBQzNDLEFBQUEsQUFBQSxLQUFLLENBQUEsQUFBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLEMsQ0FBQTtBQUMzQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDTixBQUFBLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLENBQUc7QUFDYjtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BRUUsQ0FBRztBQUNMLEFBQUEsQ0FBQyxLQUFLLENBQUEsQUFBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLENBQUc7QUFDdEQ7QUFDQTtBQUNBLE1BRUUsQ0FBRyxDO0FBQUEsQ0FBQTtBQUNMLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDSixBQUFBO0FBQ0EsQUFBQSxBQUFBLEdBQUcsQ0FBQSxBQUFDLGFBQWEsQ0FBQTtBQUNqQixBQUFBO0FBQ0EsQUFBQSxBQUFBLEtBQUssQ0FBQSxBQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQTtBQUM3QixBQUFBLEFBQUEsS0FBSyxDQUFBLEFBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFBO0FBQ25DLEFBQUEsQUFBQSxLQUFLLENBQUEsQUFBQyxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUE7QUFDdEMsQUFBQSxBQUFBLEtBQUssQ0FBQSxBQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQTtBQUN6QyxBQUFBO0FBQ0EsQUFBQSxBQUFBLEdBQUcsQ0FBQSxBQUFDLGVBQWUsQ0FBQTtBQUNuQixBQUFBO0FBQ0EsQUFBQSxBQUFBLEtBQUssQ0FBQSxBQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQTtBQUMvQixBQUFBLEFBQUEsS0FBSyxDQUFBLEFBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFBO0FBQ3JDLEFBQUEsQUFBQSxLQUFLLENBQUEsQUFBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUE7QUFDeEMsQUFBQSxBQUFBLEtBQUssQ0FBQSxBQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUc7QUFDcEMsR0FFQyxDQUFHLENBQUE7QUFDSixBQUFBLEFBQUEsS0FBSyxDQUFBLEFBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBRztBQUNsQyxHQUVDLENBQUcsQ0FBQTtBQUNKLEFBQUEsQUFBQSxLQUFLLENBQUEsQUFBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFHO0FBQ2xDLEdBRUMsQ0FBRyxDQUFBO0FBQ0osQUFBQSxBQUFBLEtBQUssQ0FBQSxBQUFDLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBRztBQUMzQyxNQUVDLENBQUcsQ0FBQTtBQUNKLEFBQUE7QUFDQSxBQUFBLEFBQUEsS0FBSyxDQUFBLEFBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLDBCQUEwQixDQUFBO0FBQzlDLEFBQUE7QUFDQSxBQUFBLGlDQUFnQztBQUNoQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLEtBQUssQ0FBQSxBQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BDLEFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNOLEFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUE7QUFDUixBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFBO0FBQ1IsQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUk7QUFDUixDQUFDLENBQUMsQ0FBQTtBQUNGLEFBQUE7QUFDQSxBQUFBLEFBQUEsS0FBSyxDQUFBLEFBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDeEMsQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ04sQUFBQSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUs7QUFDWCxDQUFDLENBQUMsQ0FBQTtBQUNGLEFBQUE7QUFDQSxBQUFBLEFBQUEsS0FBSyxDQUFBLEFBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDakQsQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUE7QUFDYixBQUFBLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSztBQUNYLENBQUMsQ0FBQyxDQUFBO0FBQ0YsQUFBQTtBQUNBLEFBQUEsQUFBQSxLQUFLLENBQUEsQUFBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNuQyxBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDTixBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFBO0FBQ1IsQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUk7QUFDUixDQUFDLENBQUMsQ0FBQTtBQUNGLEFBQUE7QUFDQSxBQUFBLGdFQUErRDtBQUMvRCxBQUFBO0FBQ0EsQUFBQSxBQUFBLEdBQUcsQ0FBQSxBQUFDLGNBQWMsQ0FBQTtBQUNsQixBQUFBO0FBQ0EsQUFBQSxBQUFBLEtBQUssQ0FBQSxBQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2xDLEFBQUEs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QUMsS0FBSyxDQUFBLEFBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEMsQUFBQSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ1AsQUFBQSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQTtBQUNULEFBQUEsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDVixBQUFBLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFBO0FBQ1YsQUFBQSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUk7QUFDVCxFQUFFLENBQUMsQ0FBQTtBQUNILEFBQUEsQ0FBQyxLQUFLLENBQUEsQUFBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoRCxBQUFBLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQTtBQUNqQixBQUFBLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFBO0FBQ1QsQUFBQSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQTtBQUNWLEFBQUEsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDVixBQUFBLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSTtBQUNULEVBQUUsQ0FBQyxDQUFBO0FBQ0gsQUFBQSxDQUFDLEtBQUssQ0FBQSxBQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEQsQUFBQSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ1AsQUFBQSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQTtBQUNULEFBQUEsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDVixBQUFBLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFBO0FBQ1YsQUFBQSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQTtBQUNULEFBQUEsRUFBRSxJQUFJLENBQUMsQ0FBQyxVQUFVO0FBQ2xCLEVBQUUsQ0FBQyxDO0FBQUEsQ0FBQTtBQUNILENBQUMsQ0FBQyxDQUFDLEMsQ0FBQztBQUNKLEFBQUE7QUFDQSxBQUFBLEFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNOLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsQ0FBQztBQUNYLEFBQUEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ3hCLEFBQUEsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFBO0FBQ3RCLEFBQUEsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFBO0FBQ3RCLEFBQUEsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUN0QixFQUFFLENBQUM7QUFDSCxBQUFBLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsZUFBZSxDQUFDO0FBQzNELEFBQUE7QUFDQSxBQUFBLENBQXVDLE1BQXRDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBRSxDQUFDLFVBQVUsQ0FBQSxBQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQTtBQUNsRSxBQUFBLENBQUMsS0FBSyxDQUFBLEFBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQTtBQUNuQyxBQUFBLENBQUMsS0FBSyxDQUFBLEFBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxDQUFBO0FBQ3RCLEFBQUEsQ0FBQyxLQUFLLENBQUEsQUFBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUE7QUFDbEIsQUFBQSxDQUFDLEtBQUssQ0FBQSxBQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQTtBQUNsQixBQUFBLENBQUMsS0FBSyxDQUFBLEFBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDO0FBQUEsQ0FBQTtBQUNsQixDQUFDLENBQUMsQ0FBQyxDLENBQUM7QUFDSixBQUFBO0FBQ0EsQUFBQSxBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDTixBQUFBLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLENBQUM7QUFDWCxBQUFBLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQTtBQUN4QixBQUFBLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDUCxBQUFBLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDUCxBQUFBLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1AsRUFBRSxDQUFDO0FBQ0gsQUFBQSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLGVBQWUsQ0FBQztBQUMzRCxBQUFBO0FBQ0EsQUFBQSxDQUF1QyxNQUF0QyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUUsQ0FBQyxVQUFVLENBQUEsQUFBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDbEUsQUFBQSxDQUFDLEtBQUssQ0FBQSxBQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUE7QUFDbkMsQUFBQSxDQUFDLEtBQUssQ0FBQSxBQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQTtBQUN0QixBQUFBLENBQUMsS0FBSyxDQUFBLEFBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFBO0FBQ2xCLEFBQUEsQ0FBQyxLQUFLLENBQUEsQUFBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDbEIsQUFBQSxDQUFDLEtBQUssQ0FBQSxBQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQztBQUFBLENBQUE7QUFDbEIsQ0FBQyxDQUFDLENBQUMsQyxDQUFDO0FBQ0osQUFBQTtBQUNBLEFBQUEsQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ04sQUFBQSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxDQUFDO0FBQ1gsQUFBQSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUE7QUFDeEIsQUFBQSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQTtBQUNWLEFBQUEsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDVixBQUFBLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSztBQUNWLEVBQUUsQ0FBQztBQUNILEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxlQUFlLENBQUM7QUFDM0QsQUFBQSxDQUF1QyxNQUF0QyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUUsQ0FBQyxVQUFVLENBQUEsQUFBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDbEUsQUFBQSxDQUFDLEtBQUssQ0FBQSxBQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUE7QUFDbkMsQUFBQSxDQUFDLEtBQUssQ0FBQSxBQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQTtBQUN0QixBQUFBLENBQUMsS0FBSyxDQUFBLEFBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFBO0FBQ2xCLEFBQUEsQ0FBQyxLQUFLLENBQUEsQUFBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDbEIsQUFBQSxDQUFDLEtBQUssQ0FBQSxBQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQztBQUFBLENBQUE7QUFDbEIsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNKIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIHV0aWxzLnRlc3QuY2l2ZXRcblxuaW1wb3J0IHtcblx0dW5kZWYsIGRlZmluZWQsIG5vdGRlZmluZWQsXG5cdGN1ckxvZ0xldmVsLCBEQkcsXG5cdHdzU3BsaXQsIHdvcmRzLCByYW5nZSwgbm9ybWFsaXplU3RyLCBzcGFjZXMsIHRhYnMsXG5cdGdldE5FeHRyYSwgcnBhZCwgbHBhZCwgY2VudGVyZWQsIGFsaWduU3RyaW5nLCB6cGFkLFxuXHRibG9ja1RvQXJyYXksIHRvQXJyYXksIGFycmF5VG9CbG9jaywgdG9CbG9jayxcblx0cmVtb3ZlTGluZXMsIGVzY2FwZVN0ciwgZXNjYXBlQmxvY2ssXG5cdHJlbHBhdGgsIGdldFBhdHRlcm4sXG5cdGdldENtZEFyZ3MsXG5cdH0gZnJvbSAnLi4vc3JjL2xpYi91dGlscy50cydcbmltcG9ydCB7XG5cdGVxdWFsLCBsaWtlLCBzdWNjZWVkcywgZmFpbHMsIHRydXRoeSwgZmFsc3ksXG5cdH0gZnJvbSAnLi4vc3JjL2xpYi91bml0LXRlc3QudHMnXG5cbmhBcmdzIDo9IGdldENtZEFyZ3MoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5EQkcgXCJ3c1NwbGl0KClcIlxuXG5lcXVhbCB3c1NwbGl0KFwiYWJjIGRlZlwiKSwgW1wiYWJjXCIsIFwiZGVmXCJdXG5lcXVhbCB3c1NwbGl0KFwiYWJjXCIpLCBbXCJhYmNcIl1cbmVxdWFsIHdzU3BsaXQoXCJcIiksIFtdXG5lcXVhbCB3c1NwbGl0KFwiICBcIiksIFtdXG5lcXVhbCB3c1NwbGl0KFwiXFx0XCIpLCBbXVxuZXF1YWwgd3NTcGxpdChcIiAgYWJjICBkZWZcXHRcXHRcIiksIFtcImFiY1wiLCBcImRlZlwiXVxuXG5EQkcgXCJ3b3JkcygpXCJcblxuZXF1YWwgd29yZHMoXCJhYmMgZGVmXCIpLCBbXCJhYmNcIiwgXCJkZWZcIl1cbmVxdWFsIHdvcmRzKFwiYWJjXCIpLCBbXCJhYmNcIl1cbmVxdWFsIHdvcmRzKFwiXCIpLCBbXVxuZXF1YWwgd29yZHMoXCIgIFwiKSwgW11cbmVxdWFsIHdvcmRzKFwiXFx0XCIpLCBbXVxuZXF1YWwgd29yZHMoXCIgIGFiYyAgZGVmXFx0XFx0XCIpLCBbXCJhYmNcIiwgXCJkZWZcIl1cbmVxdWFsIHdvcmRzKFwiIGFiYyAgZGVmXCIsIFwiZ2hpIGogXCIpLCBbXG5cdFwiYWJjXCJcblx0XCJkZWZcIlxuXHRcImdoaVwiXG5cdFwialwiXG5cdF1cblxuREJHIFwicmFuZ2UoKVwiXG5cbmVxdWFsIEFycmF5LmZyb20ocmFuZ2UoMykpLCBbMCwgMSwgMl1cbmVxdWFsIEFycmF5LmZyb20ocmFuZ2UoNSkpLCBbMCwgMSwgMiwgMywgNF1cblxuREJHIFwibm9ybWFsaXplU3RyKClcIlxuXG5lcXVhbCBub3JtYWxpemVTdHIoXCJhYmNcXHJcXG5kZWZcXHJcXG5cIiksIFwiYWJjXFxuZGVmXCJcbmVxdWFsIG5vcm1hbGl6ZVN0cihcIiAgYWJjXFxyXFxuZGVmICBcIiksIFwiYWJjXFxuZGVmXCJcblxuREJHIFwic3BhY2VzKClcIlxuXG5lcXVhbCBzcGFjZXMoMyksICcgICAnXG5cbkRCRyBcInRhYnMoKVwiXG5cbmVxdWFsIHRhYnMoMyksICdcXHRcXHRcXHQnXG5cbkRCRyBcImdldE5FeHRyYSgpXCJcblxuZXF1YWwgZ2V0TkV4dHJhKCdhYmNkJywgMTApLCA2XG5lcXVhbCBnZXRORXh0cmEoJ2FiY2QnLCAyKSwgMFxuXG5EQkcgXCJycGFkKClcIlxuXG5lcXVhbCBycGFkKCdhYmNkJywgMTAsICctJyksICdhYmNkLS0tLS0tJ1xuXG5EQkcgXCJscGFkKClcIlxuXG5lcXVhbCBscGFkKCdhYmNkJywgMTAsICctJyksICctLS0tLS1hYmNkJ1xuXG5EQkcgXCJjZW50ZXJlZCgpXCJcblxuZXF1YWwgY2VudGVyZWQoJ2FiY2QnLCAxMiwgJy0nKSwgJy0tICBhYmNkICAtLSdcblxuREJHIFwiYWxpZ25TdHJpbmcoKVwiXG5cbmVxdWFsIGFsaWduU3RyaW5nKCdhYmMnLCA1LCAnbGVmdCcpLCAnYWJjICAnXG5lcXVhbCBhbGlnblN0cmluZygnYWJjJywgNSwgJ2NlbnRlcicpLCAnIGFiYyAnXG5lcXVhbCBhbGlnblN0cmluZygnYWJjJywgNSwgJ3JpZ2h0JyksICcgIGFiYydcbmVxdWFsIGFsaWduU3RyaW5nKCdhYmMnLCA1LCAnbCcpLCAnYWJjICAnXG5lcXVhbCBhbGlnblN0cmluZygnYWJjJywgNSwgJ2MnKSwgJyBhYmMgJ1xuZXF1YWwgYWxpZ25TdHJpbmcoJ2FiYycsIDUsICdyJyksICcgIGFiYydcblxuREJHIFwienBhZCgpXCJcblxuZXF1YWwgenBhZCgyMywgNSksICcwMDAyMydcblxuREJHIFwiYmxvY2tUb0FycmF5KClcIlxuXG5lcXVhbCBibG9ja1RvQXJyYXkoJ2FiY1xcbmRlZicpLCBbJ2FiYycsJ2RlZiddXG5cbkRCRyBcInRvQXJyYXkoKVwiXG5cbmVxdWFsIHRvQXJyYXkoJ2FiY1xcbmRlZicpLCBbJ2FiYycsJ2RlZiddXG5lcXVhbCB0b0FycmF5KFsnYWJjJywnZGVmJ10pLCBbJ2FiYycsJ2RlZiddXG5cbkRCRyBcImFycmF5VG9CbG9jaygpXCJcblxuZXF1YWwgYXJyYXlUb0Jsb2NrKFsnYWJjJywnZGVmJ10pLCAnYWJjXFxuZGVmJ1xuXG5EQkcgXCJ0b0Jsb2NrKClcIlxuXG5lcXVhbCB0b0Jsb2NrKFsnYWJjJywnZGVmJ10pLCAnYWJjXFxuZGVmJ1xuZXF1YWwgdG9CbG9jaygnYWJjXFxuZGVmJyksICdhYmNcXG5kZWYnXG5cbkRCRyBcInJlbW92ZUxpbmVzKClcIlxuXG5lcXVhbCByZW1vdmVMaW5lcygnYWJjXFxuZGVmJywgJ2RlZicpLCAnYWJjJ1xuZXF1YWwgcmVtb3ZlTGluZXMoJ2FiY1xcbmRlZicsICdhYmMnKSwgJ2RlZidcblxuKCgpID0+XG5cdGJsb2NrIDo9IFwiXCJcIlxuXHRcdEQgPT09PT0gIHRlc3QvdGVtcC50eHQgID09PT09XG5cdFx0RCBkZWJ1Z1xuXHRcdEkgaW5mb1xuXHRcdEQgPT09PT0gIHRlc3QvdGVtcDIudHh0ICA9PT09PVxuXHRcdEQgZGVidWdcblx0XHRJIGluZm9cblx0XHRcIlwiXCJcblx0ZXF1YWwgcmVtb3ZlTGluZXMoYmxvY2ssIC9eW0EtWl0gPT09PT0uKj09PT09JC8pLCBcIlwiXCJcblx0XHREIGRlYnVnXG5cdFx0SSBpbmZvXG5cdFx0RCBkZWJ1Z1xuXHRcdEkgaW5mb1xuXHRcdFwiXCJcIlxuXHQpKClcblxuREJHIFwiZXNjYXBlU3RyKClcIlxuXG5lcXVhbCBlc2NhcGVTdHIoJ2FiYycpLCAnYWJjJ1xuZXF1YWwgZXNjYXBlU3RyKCcgICBhYmMnKSwgJ8uzy7PLs2FiYydcbmVxdWFsIGVzY2FwZVN0cignXFx0XFx0XFx0YWJjJyksICfihpLihpLihpJhYmMnXG5lcXVhbCBlc2NhcGVTdHIoJ2FiY1xcclxcbmRlZicpLCAnYWJj4oaQ4oaTZGVmJ1xuXG5EQkcgXCJlc2NhcGVCbG9jaygpXCJcblxuZXF1YWwgZXNjYXBlQmxvY2soJ2FiYycpLCAnYWJjJ1xuZXF1YWwgZXNjYXBlQmxvY2soJyAgIGFiYycpLCAny7PLs8uzYWJjJ1xuZXF1YWwgZXNjYXBlQmxvY2soJ1xcdFxcdFxcdGFiYycpLCAn4oaS4oaS4oaSYWJjJ1xuZXF1YWwgZXNjYXBlQmxvY2soJ2FiY1xcclxcbmRlZicpLCBcIlwiXCJcblx0YWJj4oaQXG5cdGRlZlxuXHRcIlwiXCJcbmVxdWFsIGVzY2FwZUJsb2NrKCdhYmNcXG5kZWYnKSwgXCJcIlwiXG5cdGFiY1xuXHRkZWZcblx0XCJcIlwiXG5lcXVhbCBlc2NhcGVCbG9jaygnYWJjXFxuZGVmJyksIFwiXCJcIlxuXHRhYmNcblx0ZGVmXG5cdFwiXCJcIlxuZXF1YWwgZXNjYXBlQmxvY2soJyAgIGFiY1xcblxcdFxcdFxcdGRlZicpLCBcIlwiXCJcblx0y7PLs8uzYWJjXG5cdOKGkuKGkuKGkmRlZlxuXHRcIlwiXCJcblxuZXF1YWwgZ2V0UGF0dGVybigpLCBcIioqLyp7LmRvdCwuY2llbG8sLmNpdmV0fVwiXG5cbiMgLS0tIGdldENtZEFyZ3MoKSB3aXRob3V0IGhEZXNjXG5cbmVxdWFsIGdldENtZEFyZ3ModW5kZWYsIFsnLWFiYyddKSwge1xuXHRfOiBbXVxuXHRhOiB0cnVlXG5cdGI6IHRydWVcblx0YzogdHJ1ZVxuXHR9XG5cbmVxdWFsIGdldENtZEFyZ3ModW5kZWYsIFsnLWFiYz14eXonXSksIHtcblx0XzogW11cblx0YWJjOiAneHl6J1xuXHR9XG5cbmVxdWFsIGdldENtZEFyZ3ModW5kZWYsIFsnLWFiYz14eXonLCAndGFibGUnXSksIHtcblx0XzogWyd0YWJsZSddXG5cdGFiYzogJ3h5eidcblx0fVxuXG5lcXVhbCBnZXRDbWRBcmdzKHVuZGVmLCBbJy1EZiddKSwge1xuXHRfOiBbXVxuXHRmOiB0cnVlXG5cdEQ6IHRydWVcblx0fVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuREJHIFwiZ2V0Q21kQXJncygpXCJcblxuZXF1YWwgZ2V0Q21kQXJncyh1bmRlZiwgWyctRCddKSwge1xuXHRfOiBbXVxuXHREOiB0cnVlXG5cdH1cbmVxdWFsIGN1ckxvZ0xldmVsKCksICdkZWJ1ZydcblxuZXF1YWwgZ2V0Q21kQXJncyh1bmRlZiwgWyctUCddKSwge1xuXHRfOiBbXVxuXHRQOiB0cnVlXG5cdH1cbmVxdWFsIGN1ckxvZ0xldmVsKCksICdwcm9maWxlJ1xuXG5lcXVhbCBnZXRDbWRBcmdzKHVuZGVmLCBbJy1JJ10pLCB7XG5cdF86IFtdXG5cdEk6IHRydWVcblx0fVxuZXF1YWwgY3VyTG9nTGV2ZWwoKSwgJ2luZm8nXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAtLS0gZ2V0Q21kQXJncygpIHdpdGggaERlc2NcblxuKCgpID0+XG5cdCMgLS0tIGNvbW1tYW5kICdjb21waWxlJyBhbGxvd3MgdGhlIGZvbGxvd2luZyBvcHRpb25zOlxuXHQjICAgICAgICAtZiAgLSBmb3JjZSBjb21waWxhdGlvblxuXHQjICAgICAgICAtdyAgLSB3YXRjaCBmb3IgZmlsZSBjaGFuZ2VzXG5cdCMgICAgICAgIC1uICAtIHN1cHByZXNzIHBvc3QgcHJvY2Vzc2luZ1xuXHQjICAgICAgICAtZGlyc3BlYz08c3BlYz4gIC0gJ2JpbkRpcicgb3IgJ2xpYkRpcidcblx0IyAgICAgcGx1cyBhbnkgbnVtYmVyIG9mIG5vbi1vcHRpb25zXG5cdCMgICAgIChidXQgd2UgcHJldGVuZCBpdCBtdXN0IGJlIDEsIDIgb3IgMylcblxuXHRoRGVzYyA6PSB7XG5cdFx0Zjoge3R5cGU6ICdib29sZWFuJ31cblx0XHR3OiB7dHlwZTogJ2Jvb2xlYW4nfVxuXHRcdG46IHt0eXBlOiAnYm9vbGVhbid9XG5cdFx0ZDoge3R5cGU6ICdib29sZWFuJ31cblx0XHRkaXJzcGVjOiB7dHlwZTogWydsaWJEaXInLCdiaW5EaXInXX1cblx0XHRfOiB7cmFuZ2U6IFsxLCAzXX1cblx0XHR9XG5cblx0IyAtLS0gVGhlcmUgaXMgbm8gZmxhZyBuYW1lZCAnZidcblx0ZmFpbHMgKCkgPT4gZ2V0Q21kQXJncyhoRGVzYywgWyctZGFmJywgJ2ZpbGUxJ10pXG5cblx0IyAtLS0gb3B0aW9uICdkaXJzcGVjJyBtdXN0IGJlICdsaWJEaXInIG9yICdiaW5EaXInXG5cdGZhaWxzICgpID0+IGdldENtZEFyZ3MoaERlc2MsIFsnLWRpcnNwZWM9NDInLCAnZmlsZTEnXSlcblx0ZmFpbHMgKCkgPT4gZ2V0Q21kQXJncyhoRGVzYywgWyctZGlyc3BlYz1ibGliJywgJ2ZpbGUxJ10pXG5cblx0IyAtLS0gVGhlcmUgbXVzdCBiZSBhdCBsZWFzdCBvbmUgbm9uLW9wdGlvbiwgYW5kIG5vIG1vcmUgdGhhbiAzXG5cdGZhaWxzICAoKSA9PiBnZXRDbWRBcmdzKGhEZXNjLCBbJy1nZiddKVxuXHRmYWlscyAgKCkgPT4gZ2V0Q21kQXJncyhoRGVzYywgWyctZ2YnLCAnYScsICdiJywgJ2MnLCAnZCddKVxuXHQpKClcblxuKCgpID0+XG5cdGhEZXNjIDo9IHtcblx0XHRmaWxlOiB7dHlwZTogJ3N0cmluZyd9XG5cdFx0Zjoge3R5cGU6ICdib29sZWFuJ31cblx0XHRuOiB7dHlwZTogJ2Jvb2xlYW4nfVxuXHRcdHc6IHt0eXBlOiAnYm9vbGVhbid9XG5cdFx0ZDoge3R5cGU6ICdib29sZWFuJ31cblx0XHR9XG5cblx0ZXF1YWwgZ2V0Q21kQXJncyhoRGVzYywgWyctd2QnXSksIHtcblx0XHRfOiBbXVxuXHRcdGQ6IHRydWVcblx0XHRmOiBmYWxzZVxuXHRcdG46IGZhbHNlXG5cdFx0dzogdHJ1ZVxuXHRcdH1cblx0ZXF1YWwgZ2V0Q21kQXJncyhoRGVzYywgWyctd2QnLCAndGVtcC50eHQnXSksIHtcblx0XHRfOiBbJ3RlbXAudHh0J11cblx0XHRkOiB0cnVlXG5cdFx0ZjogZmFsc2Vcblx0XHRuOiBmYWxzZVxuXHRcdHc6IHRydWVcblx0XHR9XG5cdGVxdWFsIGdldENtZEFyZ3MoaERlc2MsIFsnLXdkJywgJy1maWxlPXRlbXAudHh0J10pLCB7XG5cdFx0XzogW11cblx0XHRkOiB0cnVlXG5cdFx0ZjogZmFsc2Vcblx0XHRuOiBmYWxzZVxuXHRcdHc6IHRydWVcblx0XHRmaWxlOiAndGVtcC50eHQnXG5cdFx0fVxuXHQpKClcblxuKCgpID0+XG5cdGhEZXNjIDo9IHtcblx0XHRmaWxlOiB7dHlwZTogJ3N0cmluZyd9XG5cdFx0Zjoge3R5cGU6ICdib29sZWFuJ31cblx0XHRuOiB7dHlwZTogJ2Jvb2xlYW4nfVxuXHRcdHc6IHt0eXBlOiAnYm9vbGVhbid9XG5cdFx0fVxuXHRsQXJncyA6PSBbJ3RlbXAudHh0JywgJy1mdycsICd0ZW1wMi50eHQnLCAnLWZpbGU9YWJjLnR4dCddXG5cblx0e18sIGZpbGUsIGY6IGZvcmNlLCBuOiBub3BwLCB3OiB3YXRjaH0gOj0gZ2V0Q21kQXJncyBoRGVzYywgbEFyZ3Ncblx0ZXF1YWwgXywgWyd0ZW1wLnR4dCcsICd0ZW1wMi50eHQnXVxuXHRlcXVhbCBmaWxlLCAnYWJjLnR4dCdcblx0ZXF1YWwgZm9yY2UsIHRydWVcblx0ZXF1YWwgbm9wcCwgZmFsc2Vcblx0ZXF1YWwgd2F0Y2gsIHRydWVcblx0KSgpXG5cbigoKSA9PlxuXHRoRGVzYyA6PSB7XG5cdFx0ZmlsZToge3R5cGU6ICdzdHJpbmcnfVxuXHRcdGY6IHt9XG5cdFx0bjoge31cblx0XHR3OiB7fVxuXHRcdH1cblx0bEFyZ3MgOj0gWyd0ZW1wLnR4dCcsICctZncnLCAndGVtcDIudHh0JywgJy1maWxlPWFiYy50eHQnXVxuXG5cdHtfLCBmaWxlLCBmOiBmb3JjZSwgbjogbm9wcCwgdzogd2F0Y2h9IDo9IGdldENtZEFyZ3MgaERlc2MsIGxBcmdzXG5cdGVxdWFsIF8sIFsndGVtcC50eHQnLCAndGVtcDIudHh0J11cblx0ZXF1YWwgZmlsZSwgJ2FiYy50eHQnXG5cdGVxdWFsIGZvcmNlLCB0cnVlXG5cdGVxdWFsIG5vcHAsIGZhbHNlXG5cdGVxdWFsIHdhdGNoLCB0cnVlXG5cdCkoKVxuXG4oKCkgPT5cblx0aERlc2MgOj0ge1xuXHRcdGZpbGU6IHt0eXBlOiAnc3RyaW5nJ31cblx0XHRmOiB1bmRlZlxuXHRcdG46IHVuZGVmXG5cdFx0dzogdW5kZWZcblx0XHR9XG5cdGxBcmdzIDo9IFsndGVtcC50eHQnLCAnLWZ3JywgJ3RlbXAyLnR4dCcsICctZmlsZT1hYmMudHh0J11cblx0e18sIGZpbGUsIGY6IGZvcmNlLCBuOiBub3BwLCB3OiB3YXRjaH0gOj0gZ2V0Q21kQXJncyBoRGVzYywgbEFyZ3Ncblx0ZXF1YWwgXywgWyd0ZW1wLnR4dCcsICd0ZW1wMi50eHQnXVxuXHRlcXVhbCBmaWxlLCAnYWJjLnR4dCdcblx0ZXF1YWwgZm9yY2UsIHRydWVcblx0ZXF1YWwgbm9wcCwgZmFsc2Vcblx0ZXF1YWwgd2F0Y2gsIHRydWVcblx0KSgpXG4iXX0=