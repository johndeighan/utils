"use strict";
// pll.lib.test.civet

import {
	undef, DBG, allLinesInBlock,
	TPLLToken, TTokenGenerator,
	allTokensIn, allTokensInBlock, tokenTable,
	} from '../src/lib/utils.lib.ts'
import {
	equal, iterEqual, iterLike, isType,
	} from '../src/lib/unit-test.lib.ts'

// ---------------------------------------------------------------------------

DBG("type TPLLToken")

isType('TPLLToken', {kind: 'xxx', str: 'yyy'})
isType('TPLLToken', {kind: 'xxx', str: 'yyy', value: undef})
isType('TPLLToken', {kind: 'xxx', str: 'yyy', value: 42})

DBG("type TTokenGenerator");

(() => {
	const identGen = function*(line: string) {
		yield {kind: 'line', str: line}
		return
	}
	isType('TTokenGenerator', identGen)
}
	)();

(() => {
	const charGen = function*(line: string) {
		for (const ch of line) {
			yield {kind: 'char', str: ch}
		}
		return
	}
	isType('TTokenGenerator', charGen)
}
	)()

DBG("allTokensIn()")

iterLike(allTokensIn(allLinesInBlock("abc\ndef")), [
	{kind: 'line', str: 'abc'},
	{kind: 'line', str: 'def'}
	])

iterEqual(allTokensIn(allLinesInBlock('abc\ndef')), [
	{kind: 'line', str: 'abc'},
	{kind: 'line', str: 'def'}
	])

DBG("allTokensInBlock(str)")

iterEqual(allTokensInBlock('abc\ndef'), [
	{kind: 'line', str: 'abc'},
	{kind: 'line', str: 'def'}
	])

iterLike(allTokensInBlock(`abc
def`), [
	{kind: 'line', str: 'abc'},
	{kind: 'line', str: 'def'}
	])

iterLike(allTokensInBlock("abc\n\tdef"), [
	{kind: 'line', str: 'abc'},
	{kind: 'indent'},
	{kind: 'line', str: 'def'},
	{kind: 'undent'}
	])

iterLike(allTokensInBlock(`abc
	def
	ghi
jkl
	mno
		pqr`), [
	{kind: 'line', str: 'abc'},
	{kind: 'indent'},
	{kind: 'line', str: 'def'},
	{kind: 'line', str: 'ghi'},
	{kind: 'undent'},
	{kind: 'line', str: 'jkl'},
	{kind: 'indent'},
	{kind: 'line', str: 'mno'},
	{kind: 'indent'},
	{kind: 'line', str: 'pqr'},
	{kind: 'undent'},
	{kind: 'undent'}
	])

iterLike(allTokensInBlock(`abc
	def
	ghi
jkl
	mno
		pqr
`), [
	{kind: 'line', str: 'abc'},
	{kind: 'indent'},
	{kind: 'line', str: 'def'},
	{kind: 'line', str: 'ghi'},
	{kind: 'undent'},
	{kind: 'line', str: 'jkl'},
	{kind: 'indent'},
	{kind: 'line', str: 'mno'},
	{kind: 'indent'},
	{kind: 'line', str: 'pqr'},
	{kind: 'undent'},
	{kind: 'undent'}
	])

// --- by default, empty lines return no tokens

iterLike(allTokensInBlock(`abc
	def
	ghi

jkl
	mno
		pqr`), [
	{kind: 'line',  str: 'abc'},
	{kind: 'indent'},
	{kind: 'line',  str: 'def'},
	{kind: 'line',  str: 'ghi'},
	{kind: 'undent'},
	{kind: 'line',  str: 'jkl'},
	{kind: 'indent'},
	{kind: 'line',  str: 'mno'},
	{kind: 'indent'},
	{kind: 'line',  str: 'pqr'},
	{kind: 'undent'},
	{kind: 'undent'}
	]);

// --- Test allTokensInBlock() with a custom token generator

(() => {
	const charGenerator: TTokenGenerator = function*(line: string) {
		for (const ch of line) {
			yield {kind: 'char', str: ch}
		}
		return
	}

	iterLike(allTokensInBlock(`abc
	def`, charGenerator), [
		{ kind: "char", str: "a" },
		{ kind: "char", str: "b" },
		{ kind: "char", str: "c" },
		{ kind: "indent"},
		{ kind: "char", str: "d" },
		{ kind: "char", str: "e" },
		{ kind: "char", str: "f" },
		{ kind: "undent"}
		])
}
	)();

(() => {
	const niceGenerator: TTokenGenerator = function*(line: string) {
		let ref;if ((ref = line.match(/^-\s+(.*)$/))) {let lMatches = ref;
			yield {
				kind: 'list-item',
				str: line,
				value: lMatches[1]
				}
		}
		else {
			yield {
				kind: 'line',
				str: line
				}
		}
		return
	}

	iterLike(allTokensInBlock(`- a
- b`, niceGenerator), [
		{ kind: "list-item", str: "- a", value: "a" },
		{ kind: "list-item", str: "- b", value: "b" }
		])
}
	)()

DBG("tokenTable()")

equal(tokenTable([
	{kind: 'line',   str: 'abc'},
	{kind: 'indent', str: ''},
	{kind: 'line',   str: 'def'},
	{kind: 'undent', str: ''}
	]), `==========
  Tokens
==========
 kind  str
------ ---
line   abc
indent
line   def
undent
==========`)


//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC9wbGwubGliLnRlc3QuY2l2ZXQudHN4Iiwic291cmNlcyI6WyJ0ZXN0L3BsbC5saWIudGVzdC5jaXZldCJdLCJtYXBwaW5ncyI6IjtBQUFBLHFCQUFvQjtBQUNwQixBQUFBO0FBQ0EsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsZUFBZSxDQUFDO0FBQzdCLENBQUMsU0FBUyxDQUFDLENBQUMsZUFBZSxDQUFDO0FBQzVCLENBQUMsV0FBVyxDQUFDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxVQUFVLENBQUM7QUFDM0MsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLHlCQUF5QjtBQUNqQyxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLEtBQUssQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQztBQUNwQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsNkJBQTZCO0FBQ3JDLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLEdBQUcsQ0FBQSxBQUFDLGdCQUFnQixDQUFBO0FBQ3BCLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFBLEFBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUM3QyxBQUFBLEFBQUEsTUFBTSxDQUFBLEFBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUMzRCxBQUFBLEFBQUEsTUFBTSxDQUFBLEFBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQTtBQUN4RCxBQUFBO0FBQ0EsQUFBQSxBQUFBLEdBQUcsQ0FBQSxBQUFDLHNCQUFzQixDLENBQUE7QUFDMUIsQUFBQTtBQUNBLEFBQUEsQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ04sQUFBQSxDQUFTLE1BQVIsUUFBUSxDQUFDLENBQUUsQ0FBZ0IsUSxDQUFmLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFJLENBQUEsQ0FBQTtBQUM5QixBQUFBLEVBQUUsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQ2pDLEFBQUEsRUFBRSxNO0NBQU0sQ0FBQTtBQUNSLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxpQkFBaUIsQ0FBQyxDQUFDLFFBQVEsQztBQUFBLENBQUE7QUFDbkMsQ0FBQyxDQUFDLENBQUMsQyxDQUFDO0FBQ0osQUFBQTtBQUNBLEFBQUEsQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ04sQUFBQSxDQUFRLE1BQVAsT0FBTyxDQUFDLENBQUUsQ0FBZ0IsUSxDQUFmLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFJLENBQUEsQ0FBQTtBQUM3QixBQUFBLEVBQUUsR0FBRyxDQUFDLENBQUEsTUFBQSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQSxDQUFBLENBQUE7QUFDaEIsQUFBQSxHQUFHLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQztFQUFDLENBQUE7QUFDaEMsQUFBQSxFQUFFLE07Q0FBTSxDQUFBO0FBQ1IsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLGlCQUFpQixDQUFDLENBQUMsT0FBTyxDO0FBQUEsQ0FBQTtBQUNsQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ0osQUFBQTtBQUNBLEFBQUEsQUFBQSxHQUFHLENBQUEsQUFBQyxlQUFlLENBQUE7QUFDbkIsQUFBQTtBQUNBLEFBQUEsQUFBQSxRQUFRLENBQUEsQUFBQyxXQUFXLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BELEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQzNCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUMzQixBQUFBLENBQUMsQ0FBQyxDQUFBO0FBQ0YsQUFBQTtBQUNBLEFBQUEsQUFBQSxTQUFTLENBQUEsQUFBQyxXQUFXLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JELEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQzNCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUMzQixBQUFBLENBQUMsQ0FBQyxDQUFBO0FBQ0YsQUFBQTtBQUNBLEFBQUEsQUFBQSxHQUFHLENBQUEsQUFBQyx1QkFBdUIsQ0FBQTtBQUMzQixBQUFBO0FBQ0EsQUFBQSxBQUFBLFNBQVMsQ0FBQSxBQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN6QyxBQUFBLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUMzQixBQUFBLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDM0IsQUFBQSxDQUFDLENBQUMsQ0FBQTtBQUNGLEFBQUE7QUFDQSxBQUFBLEFBQUEsUUFBUSxDQUFBLEFBQUMsZ0JBQWdCLENBQUMsQ0FBRztBQUM3QixHQUVDLENBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNSLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQzNCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUMzQixBQUFBLENBQUMsQ0FBQyxDQUFBO0FBQ0YsQUFBQTtBQUNBLEFBQUEsQUFBQSxRQUFRLENBQUEsQUFBQyxnQkFBZ0IsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDMUMsQUFBQSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUE7QUFDM0IsQUFBQSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUE7QUFDakIsQUFBQSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUE7QUFDM0IsQUFBQSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ2pCLEFBQUEsQ0FBQyxDQUFDLENBQUE7QUFDRixBQUFBO0FBQ0EsQUFBQSxBQUFBLFFBQVEsQ0FBQSxBQUFDLGdCQUFnQixDQUFDLENBQUc7QUFDN0I7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUVDLENBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNSLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQzNCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ2pCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQzNCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQzNCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ2pCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQzNCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ2pCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQzNCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ2pCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQzNCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ2pCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUNqQixBQUFBLENBQUMsQ0FBQyxDQUFBO0FBQ0YsQUFBQTtBQUNBLEFBQUEsQUFBQSxRQUFRLENBQUEsQUFBQyxnQkFBZ0IsQ0FBQyxDQUFHO0FBQzdCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxBQUVDLENBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNSLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQzNCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ2pCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQzNCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQzNCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ2pCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQzNCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ2pCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQzNCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ2pCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQzNCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ2pCLEFBQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUNqQixBQUFBLENBQUMsQ0FBQyxDQUFBO0FBQ0YsQUFBQTtBQUNBLEFBQUEsK0NBQThDO0FBQzlDLEFBQUE7QUFDQSxBQUFBLEFBQUEsUUFBUSxDQUFBLEFBQUMsZ0JBQWdCLENBQUMsQ0FBRztBQUM3QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FFQyxDQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDUixBQUFBLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUM1QixBQUFBLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQTtBQUNqQixBQUFBLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUM1QixBQUFBLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUM1QixBQUFBLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQTtBQUNqQixBQUFBLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUM1QixBQUFBLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQTtBQUNqQixBQUFBLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUM1QixBQUFBLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQTtBQUNqQixBQUFBLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUM1QixBQUFBLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQTtBQUNqQixBQUFBLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUM7QUFDakIsQUFBQSxDQUFDLENBQUMsQyxDQUFBO0FBQ0YsQUFBQTtBQUNBLEFBQUEsNERBQTJEO0FBQzNELEFBQUE7QUFDQSxBQUFBLEFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNOLEFBQUEsQ0FBK0IsTUFBOUIsYUFBYSxDQUFDLENBQUMsZUFBZSxDQUFDLENBQUUsQ0FBZ0IsUSxD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QUFDSjtBQUNBIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIHBsbC5saWIudGVzdC5jaXZldFxuXG5pbXBvcnQge1xuXHR1bmRlZiwgREJHLCBhbGxMaW5lc0luQmxvY2ssXG5cdFRQTExUb2tlbiwgVFRva2VuR2VuZXJhdG9yLFxuXHRhbGxUb2tlbnNJbiwgYWxsVG9rZW5zSW5CbG9jaywgdG9rZW5UYWJsZSxcblx0fSBmcm9tICcuLi9zcmMvbGliL3V0aWxzLmxpYi50cydcbmltcG9ydCB7XG5cdGVxdWFsLCBpdGVyRXF1YWwsIGl0ZXJMaWtlLCBpc1R5cGUsXG5cdH0gZnJvbSAnLi4vc3JjL2xpYi91bml0LXRlc3QubGliLnRzJ1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5EQkcgXCJ0eXBlIFRQTExUb2tlblwiXG5cbmlzVHlwZSAnVFBMTFRva2VuJywge2tpbmQ6ICd4eHgnLCBzdHI6ICd5eXknfVxuaXNUeXBlICdUUExMVG9rZW4nLCB7a2luZDogJ3h4eCcsIHN0cjogJ3l5eScsIHZhbHVlOiB1bmRlZn1cbmlzVHlwZSAnVFBMTFRva2VuJywge2tpbmQ6ICd4eHgnLCBzdHI6ICd5eXknLCB2YWx1ZTogNDJ9XG5cbkRCRyBcInR5cGUgVFRva2VuR2VuZXJhdG9yXCJcblxuKCgpID0+XG5cdGlkZW50R2VuIDo9IChsaW5lOiBzdHJpbmcpIC0+XG5cdFx0eWllbGQge2tpbmQ6ICdsaW5lJywgc3RyOiBsaW5lfVxuXHRcdHJldHVyblxuXHRpc1R5cGUgJ1RUb2tlbkdlbmVyYXRvcicsIGlkZW50R2VuXG5cdCkoKVxuXG4oKCkgPT5cblx0Y2hhckdlbiA6PSAobGluZTogc3RyaW5nKSAtPlxuXHRcdGZvciBjaCBvZiBsaW5lXG5cdFx0XHR5aWVsZCB7a2luZDogJ2NoYXInLCBzdHI6IGNofVxuXHRcdHJldHVyblxuXHRpc1R5cGUgJ1RUb2tlbkdlbmVyYXRvcicsIGNoYXJHZW5cblx0KSgpXG5cbkRCRyBcImFsbFRva2Vuc0luKClcIlxuXG5pdGVyTGlrZSBhbGxUb2tlbnNJbihhbGxMaW5lc0luQmxvY2soXCJhYmNcXG5kZWZcIikpLCBbXG5cdHtraW5kOiAnbGluZScsIHN0cjogJ2FiYyd9XG5cdHtraW5kOiAnbGluZScsIHN0cjogJ2RlZid9XG5cdF1cblxuaXRlckVxdWFsIGFsbFRva2Vuc0luKGFsbExpbmVzSW5CbG9jaygnYWJjXFxuZGVmJykpLCBbXG5cdHtraW5kOiAnbGluZScsIHN0cjogJ2FiYyd9XG5cdHtraW5kOiAnbGluZScsIHN0cjogJ2RlZid9XG5cdF1cblxuREJHIFwiYWxsVG9rZW5zSW5CbG9jayhzdHIpXCJcblxuaXRlckVxdWFsIGFsbFRva2Vuc0luQmxvY2soJ2FiY1xcbmRlZicpLCBbXG5cdHtraW5kOiAnbGluZScsIHN0cjogJ2FiYyd9XG5cdHtraW5kOiAnbGluZScsIHN0cjogJ2RlZid9XG5cdF1cblxuaXRlckxpa2UgYWxsVG9rZW5zSW5CbG9jayhcIlwiXCJcblx0YWJjXG5cdGRlZlxuXHRcIlwiXCIpLCBbXG5cdHtraW5kOiAnbGluZScsIHN0cjogJ2FiYyd9XG5cdHtraW5kOiAnbGluZScsIHN0cjogJ2RlZid9XG5cdF1cblxuaXRlckxpa2UgYWxsVG9rZW5zSW5CbG9jayhcImFiY1xcblxcdGRlZlwiKSwgW1xuXHR7a2luZDogJ2xpbmUnLCBzdHI6ICdhYmMnfVxuXHR7a2luZDogJ2luZGVudCd9XG5cdHtraW5kOiAnbGluZScsIHN0cjogJ2RlZid9XG5cdHtraW5kOiAndW5kZW50J31cblx0XVxuXG5pdGVyTGlrZSBhbGxUb2tlbnNJbkJsb2NrKFwiXCJcIlxuXHRhYmNcblx0XHRkZWZcblx0XHRnaGlcblx0amtsXG5cdFx0bW5vXG5cdFx0XHRwcXJcblx0XCJcIlwiKSwgW1xuXHR7a2luZDogJ2xpbmUnLCBzdHI6ICdhYmMnfVxuXHR7a2luZDogJ2luZGVudCd9XG5cdHtraW5kOiAnbGluZScsIHN0cjogJ2RlZid9XG5cdHtraW5kOiAnbGluZScsIHN0cjogJ2doaSd9XG5cdHtraW5kOiAndW5kZW50J31cblx0e2tpbmQ6ICdsaW5lJywgc3RyOiAnamtsJ31cblx0e2tpbmQ6ICdpbmRlbnQnfVxuXHR7a2luZDogJ2xpbmUnLCBzdHI6ICdtbm8nfVxuXHR7a2luZDogJ2luZGVudCd9XG5cdHtraW5kOiAnbGluZScsIHN0cjogJ3Bxcid9XG5cdHtraW5kOiAndW5kZW50J31cblx0e2tpbmQ6ICd1bmRlbnQnfVxuXHRdXG5cbml0ZXJMaWtlIGFsbFRva2Vuc0luQmxvY2soXCJcIlwiXG5cdGFiY1xuXHRcdGRlZlxuXHRcdGdoaVxuXHRqa2xcblx0XHRtbm9cblx0XHRcdHBxclxuXG5cdFwiXCJcIiksIFtcblx0e2tpbmQ6ICdsaW5lJywgc3RyOiAnYWJjJ31cblx0e2tpbmQ6ICdpbmRlbnQnfVxuXHR7a2luZDogJ2xpbmUnLCBzdHI6ICdkZWYnfVxuXHR7a2luZDogJ2xpbmUnLCBzdHI6ICdnaGknfVxuXHR7a2luZDogJ3VuZGVudCd9XG5cdHtraW5kOiAnbGluZScsIHN0cjogJ2prbCd9XG5cdHtraW5kOiAnaW5kZW50J31cblx0e2tpbmQ6ICdsaW5lJywgc3RyOiAnbW5vJ31cblx0e2tpbmQ6ICdpbmRlbnQnfVxuXHR7a2luZDogJ2xpbmUnLCBzdHI6ICdwcXInfVxuXHR7a2luZDogJ3VuZGVudCd9XG5cdHtraW5kOiAndW5kZW50J31cblx0XVxuXG4jIC0tLSBieSBkZWZhdWx0LCBlbXB0eSBsaW5lcyByZXR1cm4gbm8gdG9rZW5zXG5cbml0ZXJMaWtlIGFsbFRva2Vuc0luQmxvY2soXCJcIlwiXG5cdGFiY1xuXHRcdGRlZlxuXHRcdGdoaVxuXG5cdGprbFxuXHRcdG1ub1xuXHRcdFx0cHFyXG5cdFwiXCJcIiksIFtcblx0e2tpbmQ6ICdsaW5lJywgIHN0cjogJ2FiYyd9XG5cdHtraW5kOiAnaW5kZW50J31cblx0e2tpbmQ6ICdsaW5lJywgIHN0cjogJ2RlZid9XG5cdHtraW5kOiAnbGluZScsICBzdHI6ICdnaGknfVxuXHR7a2luZDogJ3VuZGVudCd9XG5cdHtraW5kOiAnbGluZScsICBzdHI6ICdqa2wnfVxuXHR7a2luZDogJ2luZGVudCd9XG5cdHtraW5kOiAnbGluZScsICBzdHI6ICdtbm8nfVxuXHR7a2luZDogJ2luZGVudCd9XG5cdHtraW5kOiAnbGluZScsICBzdHI6ICdwcXInfVxuXHR7a2luZDogJ3VuZGVudCd9XG5cdHtraW5kOiAndW5kZW50J31cblx0XVxuXG4jIC0tLSBUZXN0IGFsbFRva2Vuc0luQmxvY2soKSB3aXRoIGEgY3VzdG9tIHRva2VuIGdlbmVyYXRvclxuXG4oKCkgPT5cblx0Y2hhckdlbmVyYXRvcjogVFRva2VuR2VuZXJhdG9yIDo9IChsaW5lOiBzdHJpbmcpIC0+XG5cdFx0Zm9yIGNoIG9mIGxpbmVcblx0XHRcdHlpZWxkIHtraW5kOiAnY2hhcicsIHN0cjogY2h9XG5cdFx0cmV0dXJuXG5cblx0aXRlckxpa2UgYWxsVG9rZW5zSW5CbG9jayhcIlwiXCJcblx0XHRhYmNcblx0XHRcdGRlZlxuXHRcdFwiXCJcIiwgY2hhckdlbmVyYXRvciksIFtcblx0XHR7IGtpbmQ6IFwiY2hhclwiLCBzdHI6IFwiYVwiIH1cblx0XHR7IGtpbmQ6IFwiY2hhclwiLCBzdHI6IFwiYlwiIH1cblx0XHR7IGtpbmQ6IFwiY2hhclwiLCBzdHI6IFwiY1wiIH1cblx0XHR7IGtpbmQ6IFwiaW5kZW50XCJ9XG5cdFx0eyBraW5kOiBcImNoYXJcIiwgc3RyOiBcImRcIiB9XG5cdFx0eyBraW5kOiBcImNoYXJcIiwgc3RyOiBcImVcIiB9XG5cdFx0eyBraW5kOiBcImNoYXJcIiwgc3RyOiBcImZcIiB9XG5cdFx0eyBraW5kOiBcInVuZGVudFwifVxuXHRcdF1cblx0KSgpXG5cbigoKSA9PlxuXHRuaWNlR2VuZXJhdG9yOiBUVG9rZW5HZW5lcmF0b3IgOj0gKGxpbmU6IHN0cmluZykgLT5cblx0XHRpZiBsZXQgbE1hdGNoZXMgPSBsaW5lLm1hdGNoKC8vL15cblx0XHRcdFx0LVxuXHRcdFx0XHRcXHMrXG5cdFx0XHRcdCguKilcblx0XHRcdFx0JC8vLylcblx0XHRcdHlpZWxkIHtcblx0XHRcdFx0a2luZDogJ2xpc3QtaXRlbSdcblx0XHRcdFx0c3RyOiBsaW5lXG5cdFx0XHRcdHZhbHVlOiBsTWF0Y2hlc1sxXVxuXHRcdFx0XHR9XG5cdFx0ZWxzZVxuXHRcdFx0eWllbGQge1xuXHRcdFx0XHRraW5kOiAnbGluZSdcblx0XHRcdFx0c3RyOiBsaW5lXG5cdFx0XHRcdH1cblx0XHRyZXR1cm5cblxuXHRpdGVyTGlrZSBhbGxUb2tlbnNJbkJsb2NrKFwiXCJcIlxuXHRcdC0gYVxuXHRcdC0gYlxuXHRcdFwiXCJcIiwgbmljZUdlbmVyYXRvciksIFtcblx0XHR7IGtpbmQ6IFwibGlzdC1pdGVtXCIsIHN0cjogXCItIGFcIiwgdmFsdWU6IFwiYVwiIH1cblx0XHR7IGtpbmQ6IFwibGlzdC1pdGVtXCIsIHN0cjogXCItIGJcIiwgdmFsdWU6IFwiYlwiIH1cblx0XHRdXG5cdCkoKVxuXG5EQkcgXCJ0b2tlblRhYmxlKClcIlxuXG5lcXVhbCB0b2tlblRhYmxlKFtcblx0e2tpbmQ6ICdsaW5lJywgICBzdHI6ICdhYmMnfVxuXHR7a2luZDogJ2luZGVudCcsIHN0cjogJyd9XG5cdHtraW5kOiAnbGluZScsICAgc3RyOiAnZGVmJ31cblx0e2tpbmQ6ICd1bmRlbnQnLCBzdHI6ICcnfVxuXHRdKSwgXCJcIlwiXG5cdD09PT09PT09PT1cblx0ICBUb2tlbnNcblx0PT09PT09PT09PVxuXHQga2luZCAgc3RyXG5cdC0tLS0tLSAtLS1cblx0bGluZSAgIGFiY1xuXHRpbmRlbnRcblx0bGluZSAgIGRlZlxuXHR1bmRlbnRcblx0PT09PT09PT09PVxuXHRcIlwiXCJcblxuIl19