"use strict";
// parser.lib.test.civet

import {
	undef, hash, getCmdArgs, DBG, o,
	} from '../src/lib/utils.lib.ts'
// import {
// 	KeppelGrammar,
// 	} from './parser/keppel.grammar.ts'
import {
	State, StringMatcher, RegexMatcher,
	All, Any, Plus, Optional, Star,
	getParser, getLineAndColumn,
	} from '../src/lib/parser.lib.ts'
import {
	equal, same, like, succeeds, fails, truthy, falsy,
	matches, isType, notType, objListLike,
	} from '../src/lib/unit-test.lib.ts'

getCmdArgs()
//  htmlParse := getParser<hash>(KeppelGrammar)

// ---------------------------------------------------------------------------
// --- test getLineAndColumn()

equal(getLineAndColumn('abc\ndef\nghi', 5), [2, 2])
equal(getLineAndColumn('abcd\nefgh\nijkl', 5), [2, 1])

// ---------------------------------------------------------------------------
// --- test class State

like(new State('abc'), {
	text: 'abc',
	pos: 0
	})

like(new State('abc', 2), {
	text: 'abc',
	pos: 2
	});

// ---------------------------------------------------------------------------
// --- test StringMatcher()

(() => {
	const rule = StringMatcher('abc')
	like(rule.next(new State('abcdef')), {pos: 3})
	fails(() => rule.next(new State('abcdef', 3)))
}
	)();

(() => {
	const rule = StringMatcher('def')
	like(rule.next(new State('abcdef')), {pos: 0})
	like(rule.next(new State('abcdef', 3)), {pos: 6})

	// --- On failure to match, should return undef
	const $ = new State('abcdef')
	equal(rule.next($), undef)
}
	)();

// ---------------------------------------------------------------------------
// --- test RegexMatcher()

(() => {
	const rule = RegexMatcher(/^[\.\#]\s/)
	like(rule.next(new State('. abc')), {pos: 2})
	fails(() => rule.next(new State('. abc', 1)))
}
	)();

(() => {
	const rule = RegexMatcher(/^[\.\#]\s/)
	like(rule.next(new State('abc . def')), {pos: 0})
	like(rule.next(new State('abc . def', 4)), {pos: 6})

	// --- On failure to match, should return undef
	const $ = new State('abc . abc')
	equal(rule.next($), undef)
}
	)()

// ---------------------------------------------------------------------------
// Build and test some very simple rules

const reIdent = /^([a-zA-Z_$][a-zA-Z0-9_$]*)/
reIdent.toString = () => 'reIdent'

const reNumber = /^((?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][-+]?[0-9]+)?)\b/
reNumber.toString = () => 'reNumber'

const reOp = /[+\-*\/]/
reOp.toString = () => 'reOp'

// --- Define the grammer productions

const value = Any([reIdent, reNumber])
value.toString = () => 'value'

const stmt = Any([
	[reIdent, '=', value],
	[value, reOp, value]
	])
stmt.toString = () => 'stmt'

const program = [
	stmt,
	Star([';', stmt])
	]
program.toString = () => 'program';

(() => {
	const parse = getParser(reIdent)
	succeeds(() => parse('abc'))
	succeeds(() => parse(' abc  '))  // --- whitespace skipped
	fails(   () => parse('1abc'))
	fails(   () => parse('abc def'))
	succeeds(() => getParser(reIdent, o`partial`)('abc def'))
}
	)();

(() => {
	const parse = getParser(reOp)
	succeeds(() => parse('+'))
	succeeds(() => parse('  -  '))
	succeeds(() => parse('*'))
	succeeds(() => parse('  /  '))
	fails(   () => parse('!'))
}
	)();

(() => {
	const parse = getParser(value)
	succeeds(() => parse('n'))
	succeeds(() => parse('  n  '))
	succeeds(() => parse('42'))
	succeeds(() => parse('  42  '))
	fails(   () => parse('!'))
}
	)();

(() => {
	const parse = getParser(stmt)
	succeeds(() => parse('n = 42'))
	succeeds(() => parse('  n=42  '))
	succeeds(() => parse('a=b'))
	succeeds(() => parse('  a = b  '))
	fails(   () => parse('!'))
}
	)();

(() => {
	const parse = getParser(reNumber)
	succeeds(() => parse('42'))
	succeeds(() => parse('  42  '))
	succeeds(() => parse('3.14'))
	succeeds(() => parse('  3.14  '))
	succeeds(() => parse('3.14e5'))
	succeeds(() => parse('  3.14E5  '))
	fails(   () => parse('!'))
}
	)();

(() => {
	const parse = getParser(program)
	succeeds(() => parse('x = 42; y = 33; x*y'))
	succeeds(() => parse(`x = 42;
y = 33;
x * y`))
}
	)()


//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC9wYXJzZXIubGliLnRlc3QuY2l2ZXQudHN4Iiwic291cmNlcyI6WyJ0ZXN0L3BhcnNlci5saWIudGVzdC5jaXZldCJdLCJtYXBwaW5ncyI6IjtBQUFBLHdCQUF1QjtBQUN2QixBQUFBO0FBQ0EsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2pDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyx5QkFBeUI7QUFDakMsQUFBQSxXQUFVO0FBQ1YsQUFBQSxrQkFBaUI7QUFDakIsQUFBQSx1Q0FBc0M7QUFDdEMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxZQUFZLENBQUM7QUFDcEMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDaEMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQztBQUM3QixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsMEJBQTBCO0FBQ2xDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ25ELENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsV0FBVyxDQUFDO0FBQ3ZDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyw2QkFBNkI7QUFDckMsQUFBQTtBQUNBLEFBQUEsQUFBQSxVQUFVLENBQUMsQ0FBQztBQUNaLEFBQUEsK0NBQThDO0FBQzlDLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBLDhCQUE2QjtBQUM3QixBQUFBO0FBQ0EsQUFBQSxBQUFBLEtBQUssQ0FBQSxBQUFDLGdCQUFnQixDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNsRCxBQUFBLEFBQUEsS0FBSyxDQUFBLEFBQUMsZ0JBQWdCLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDckQsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUEsdUJBQXNCO0FBQ3RCLEFBQUE7QUFDQSxBQUFBLEFBQUEsSUFBSSxDQUFBLEFBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDeEIsQUFBQSxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQTtBQUNaLEFBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyxDQUFDLENBQUE7QUFDRixBQUFBO0FBQ0EsQUFBQSxBQUFBLElBQUksQ0FBQSxBQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzNCLEFBQUEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDWixBQUFBLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUMsQ0FBQyxDLENBQUE7QUFDRixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQSwyQkFBMEI7QUFDMUIsQUFBQTtBQUNBLEFBQUEsQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ04sQUFBQSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDO0FBQzdCLEFBQUEsQ0FBQyxJQUFJLENBQUEsQUFBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDOUMsQUFBQSxDQUFDLEtBQUssQ0FBQSxBQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQztBQUFBLENBQUE7QUFDOUMsQ0FBQyxDQUFDLENBQUMsQyxDQUFDO0FBQ0osQUFBQTtBQUNBLEFBQUEsQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ04sQUFBQSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDO0FBQzdCLEFBQUEsQ0FBQyxJQUFJLENBQUEsQUFBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDOUMsQUFBQSxDQUFDLElBQUksQ0FBQSxBQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNqRCxBQUFBO0FBQ0EsQUFBQSxDQUFDLCtDQUE4QztBQUMvQyxBQUFBLENBQUUsTUFBRCxDQUFDLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDO0FBQ3pCLEFBQUEsQ0FBQyxLQUFLLENBQUEsQUFBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDO0FBQUEsQ0FBQTtBQUMxQixDQUFDLENBQUMsQ0FBQyxDLENBQUM7QUFDSixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQSwwQkFBeUI7QUFDekIsQUFBQTtBQUNBLEFBQUEsQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ04sQUFBQSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDO0FBQ2xDLEFBQUEsQ0FBQyxJQUFJLENBQUEsQUFBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDN0MsQUFBQSxDQUFDLEtBQUssQ0FBQSxBQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQztBQUFBLENBQUE7QUFDN0MsQ0FBQyxDQUFDLENBQUMsQyxDQUFDO0FBQ0osQUFBQTtBQUNBLEFBQUEsQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ04sQUFBQSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDO0FBQ2xDLEFBQUEsQ0FBQyxJQUFJLENBQUEsQUFBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDakQsQUFBQSxDQUFDLElBQUksQ0FBQSxBQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNwRCxBQUFBO0FBQ0EsQUFBQSxDQUFDLCtDQUE4QztBQUMvQyxBQUFBLENBQUUsTUFBRCxDQUFDLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDO0FBQzVCLEFBQUEsQ0FBQyxLQUFLLENBQUEsQUFBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDO0FBQUEsQ0FBQTtBQUMxQixDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ0osQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUEsd0NBQXVDO0FBQ3ZDLEFBQUE7QUFDQSxBQUFBLEFBQU8sTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLENBQUcsRUFBRSxBQUFDLFVBQVUsQUFBQyxhQUFhLENBQUMsQUFBQyxDQUFDLEFBQUMsQ0FBRztBQUNoRCxBQUFBLEFBQUEsT0FBTyxDQUFDLFFBQVEsQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVM7QUFDbEMsQUFBQTtBQUNBLEFBQUEsQUFBUSxNQUFSLFFBQVEsQ0FBQyxDQUFFLENBQUMsQ0FBRyxDQUFDLEFBQ2YsQ0FBQyxBQUNBLEdBQUcsQUFDRixLQUFLLENBQUMsQUFBQyxFQUFFLENBQUMsQUFBQyxLQUFLLENBQUMsQUFBQyxDQUFDLEFBQUMsRUFBRSxBQUFDLEtBQUssQ0FBQyxBQUM3QixDQUFDLEFBQ0YsR0FBRyxBQUNGLElBQUksQUFBQyxJQUFJLENBQUMsQUFBQyxLQUFLLENBQUMsQUFDakIsRUFBRSxBQUNILENBQUMsRUFBRSxBQUNKLENBQUc7QUFDSixBQUFBLEFBQUEsUUFBUSxDQUFDLFFBQVEsQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFVBQVU7QUFDcEMsQUFBQTtBQUNBLEFBQUEsQUFBSSxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsVUFBVTtBQUNsQixBQUFBLEFBQUEsSUFBSSxDQUFDLFFBQVEsQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU07QUFDNUIsQUFBQTtBQUNBLEFBQUEscUNBQW9DO0FBQ3BDLEFBQUE7QUFDQSxBQUFBLEFBQUssTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQSxBQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUE7QUFDaEMsQUFBQSxBQUFBLEtBQUssQ0FBQyxRQUFRLEMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPO0FBQzlCLEFBQUE7QUFDQSxBQUFBLEFBQUksTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQSxBQUFDLENBQUM7QUFDYixBQUFBLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUN0QixBQUFBLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDckIsQUFBQSxDQUFDLENBQUMsQ0FBQTtBQUNGLEFBQUEsQUFBQSxJQUFJLENBQUMsUUFBUSxDLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTTtBQUM1QixBQUFBO0FBQ0EsQUFBQSxBQUFPLE1BQVAsT0FBTyxDQUFDLENBQUUsQ0FBQyxDQUFDO0FBQ1osQUFBQSxDQUFDLElBQUksQ0FBQTtBQUNMLEFBQUEsQ0FBZ0IsSSxDQUFmLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDLENBQVM7QUFDcEIsQUFBQSxDQUFDLENBQUM7QUFDRixBQUFBLEFBQUEsT0FBTyxDQUFDLFFBQVEsQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFMsQ0FBUztBQUNsQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDTixBQUFBLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUM7QUFDNUIsQUFBQSxDQUFDLFFBQVEsQ0FBQSxBQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUEsQUFBQyxLQUFLLENBQUEsQ0FBQTtBQUMzQixBQUFBLENBQUMsUUFBUSxDQUFBLEFBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQSxBQUFDLFFBQVEsQ0FBQSxDQUFBLEVBQUUseUJBQXdCO0FBQ3hELEFBQUEsQ0FBQyxLQUFLLENBQUEsR0FBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFBLEFBQUMsTUFBTSxDQUFBLENBQUE7QUFDNUIsQUFBQSxDQUFDLEtBQUssQ0FBQSxHQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUEsQUFBQyxTQUFTLENBQUEsQ0FBQTtBQUMvQixBQUFBLENBQUMsUUFBUSxDQUFBLEFBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDLFNBQVUsQ0FBQyxDQUFBLEFBQUMsU0FBUyxDQUFBLEM7QUFBQSxDQUFBO0FBQ3hELENBQUMsQ0FBQyxDQUFDLEMsQ0FBQztBQUNKLEFBQUE7QUFDQSxBQUFBLEFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNOLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztBQUN6QixBQUFBLENBQUMsUUFBUSxDQUFBLEFBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQSxBQUFDLEdBQUcsQ0FBQSxDQUFBO0FBQ3pCLEFBQUEsQ0FBQyxRQUFRLENBQUEsQUFBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFBLEFBQUMsT0FBTyxDQUFBLENBQUE7QUFDN0IsQUFBQSxDQUFDLFFBQVEsQ0FBQSxBQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUEsQUFBQyxHQUFHLENBQUEsQ0FBQTtBQUN6QixBQUFBLENBQUMsUUFBUSxDQUFBLEFBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQSxBQUFDLE9BQU8sQ0FBQSxDQUFBO0FBQzdCLEFBQUEsQ0FBQyxLQUFLLENBQUEsR0FBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFBLEFBQUMsR0FBRyxDQUFBLEM7QUFBQSxDQUFBO0FBQ3pCLENBQUMsQ0FBQyxDQUFDLEMsQ0FBQztBQUNKLEFBQUE7QUFDQSxBQUFBLEFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNOLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQztBQUMxQixBQUFBLENBQUMsUUFBUSxDQUFBLEFBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQSxBQUFDLEdBQUcsQ0FBQSxDQUFBO0FBQ3pCLEFBQUEsQ0FBQyxRQUFRLENBQUEsQUFBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFBLEFBQUMsT0FBTyxDQUFBLENBQUE7QUFDN0IsQUFBQSxDQUFDLFFBQVEsQ0FBQSxBQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUEsQUFBQyxJQUFJLENBQUEsQ0FBQTtBQUMxQixBQUFBLENBQUMsUUFBUSxDQUFBLEFBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQSxBQUFDLFFBQVEsQ0FBQSxDQUFBO0FBQzlCLEFBQUEsQ0FBQyxLQUFLLENBQUEsR0FBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFBLEFBQUMsR0FBRyxDQUFBLEM7QUFBQSxDQUFBO0FBQ3pCLENBQUMsQ0FBQyxDQUFDLEMsQ0FBQztBQUNKLEFBQUE7QUFDQSxBQUFBLEFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNOLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztBQUN6QixBQUFBLENBQUMsUUFBUSxDQUFBLEFBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQSxBQUFDLFFBQVEsQ0FBQSxDQUFBO0FBQzlCLEFBQUEsQ0FBQyxRQUFRLENBQUEsQUFBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFBLEFBQUMsVUFBVSxDQUFBLENBQUE7QUFDaEMsQUFBQSxDQUFDLFFBQVEsQ0FBQSxBQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUEsQUFBQyxLQUFLLENBQUEsQ0FBQTtBQUMzQixBQUFBLENBQUMsUUFBUSxDQUFBLEFBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQSxBQUFDLFdBQVcsQ0FBQSxDQUFBO0FBQ2pDLEFBQUEsQ0FBQyxLQUFLLENBQUEsR0FBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFBLEFBQUMsR0FBRyxDQUFBLEM7QUFBQSxDQUFBO0FBQ3pCLENBQUMsQ0FBQyxDQUFDLEMsQ0FBQztBQUNKLEFBQUE7QUFDQSxBQUFBLEFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNOLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQztBQUM3QixBQUFBLENBQUMsUUFBUSxDQUFBLEFBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQSxBQUFDLElBQUksQ0FBQSxDQUFBO0FBQzFCLEFBQUEsQ0FBQyxRQUFRLENBQUEsQUFBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFBLEFBQUMsUUFBUSxDQUFBLENBQUE7QUFDOUIsQUFBQSxDQUFDLFFBQVEsQ0FBQSxBQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUEsQUFBQyxNQUFNLENBQUEsQ0FBQTtBQUM1QixBQUFBLENBQUMsUUFBUSxDQUFBLEFBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQSxBQUFDLFVBQVUsQ0FBQSxDQUFBO0FBQ2hDLEFBQUEsQ0FBQyxRQUFRLENBQUEsQUFBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFBLEFBQUMsUUFBUSxDQUFBLENBQUE7QUFDOUIsQUFBQSxDQUFDLFFBQVEsQ0FBQSxBQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUEsQUFBQyxZQUFZLENBQUEsQ0FBQTtBQUNsQyxBQUFBLENBQUMsS0FBSyxDQUFBLEdBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQSxBQUFDLEdBQUcsQ0FBQSxDO0FBQUEsQ0FBQTtBQUN6QixDQUFDLENBQUMsQ0FBQyxDLENBQUM7QUFDSixBQUFBO0FBQ0EsQUFBQSxBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDTixBQUFBLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUM7QUFDNUIsQUFBQSxDQUFDLFFBQVEsQ0FBQSxBQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUEsQUFBQyxxQkFBcUIsQ0FBQSxDQUFBO0FBQzNDLEFBQUEsQ0FBQyxRQUFRLENBQUEsQUFBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFBLEFBQUMsQ0FBRztBQUN6QjtBQUNBLEtBRUUsQ0FBRyxDQUFBLEM7QUFBQSxDQUFBO0FBQ0wsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNKO0FBQ0EiLCJuYW1lcyI6W10sInNvdXJjZXNDb250ZW50IjpbIiMgcGFyc2VyLmxpYi50ZXN0LmNpdmV0XHJcblxyXG5pbXBvcnQge1xyXG5cdHVuZGVmLCBoYXNoLCBnZXRDbWRBcmdzLCBEQkcsIG8sXHJcblx0fSBmcm9tICcuLi9zcmMvbGliL3V0aWxzLmxpYi50cydcclxuIyBpbXBvcnQge1xyXG4jIFx0S2VwcGVsR3JhbW1hcixcclxuIyBcdH0gZnJvbSAnLi9wYXJzZXIva2VwcGVsLmdyYW1tYXIudHMnXHJcbmltcG9ydCB7XHJcblx0U3RhdGUsIFN0cmluZ01hdGNoZXIsIFJlZ2V4TWF0Y2hlcixcclxuXHRBbGwsIEFueSwgUGx1cywgT3B0aW9uYWwsIFN0YXIsXHJcblx0Z2V0UGFyc2VyLCBnZXRMaW5lQW5kQ29sdW1uLFxyXG5cdH0gZnJvbSAnLi4vc3JjL2xpYi9wYXJzZXIubGliLnRzJ1xyXG5pbXBvcnQge1xyXG5cdGVxdWFsLCBzYW1lLCBsaWtlLCBzdWNjZWVkcywgZmFpbHMsIHRydXRoeSwgZmFsc3ksXHJcblx0bWF0Y2hlcywgaXNUeXBlLCBub3RUeXBlLCBvYmpMaXN0TGlrZSxcclxuXHR9IGZyb20gJy4uL3NyYy9saWIvdW5pdC10ZXN0LmxpYi50cydcclxuXHJcbmdldENtZEFyZ3MoKVxyXG4jICBodG1sUGFyc2UgOj0gZ2V0UGFyc2VyPGhhc2g+KEtlcHBlbEdyYW1tYXIpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIC0tLSB0ZXN0IGdldExpbmVBbmRDb2x1bW4oKVxyXG5cclxuZXF1YWwgZ2V0TGluZUFuZENvbHVtbignYWJjXFxuZGVmXFxuZ2hpJywgNSksIFsyLCAyXVxyXG5lcXVhbCBnZXRMaW5lQW5kQ29sdW1uKCdhYmNkXFxuZWZnaFxcbmlqa2wnLCA1KSwgWzIsIDFdXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIC0tLSB0ZXN0IGNsYXNzIFN0YXRlXHJcblxyXG5saWtlIG5ldyBTdGF0ZSgnYWJjJyksIHtcclxuXHR0ZXh0OiAnYWJjJ1xyXG5cdHBvczogMFxyXG5cdH1cclxuXHJcbmxpa2UgbmV3IFN0YXRlKCdhYmMnLCAyKSwge1xyXG5cdHRleHQ6ICdhYmMnXHJcblx0cG9zOiAyXHJcblx0fVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyAtLS0gdGVzdCBTdHJpbmdNYXRjaGVyKClcclxuXHJcbigoKSA9PlxyXG5cdHJ1bGUgOj0gU3RyaW5nTWF0Y2hlcignYWJjJylcclxuXHRsaWtlIHJ1bGUubmV4dChuZXcgU3RhdGUoJ2FiY2RlZicpKSwge3BvczogM31cclxuXHRmYWlscyAoKSA9PiBydWxlLm5leHQobmV3IFN0YXRlKCdhYmNkZWYnLCAzKSlcclxuXHQpKClcclxuXHJcbigoKSA9PlxyXG5cdHJ1bGUgOj0gU3RyaW5nTWF0Y2hlcignZGVmJylcclxuXHRsaWtlIHJ1bGUubmV4dChuZXcgU3RhdGUoJ2FiY2RlZicpKSwge3BvczogMH1cclxuXHRsaWtlIHJ1bGUubmV4dChuZXcgU3RhdGUoJ2FiY2RlZicsIDMpKSwge3BvczogNn1cclxuXHJcblx0IyAtLS0gT24gZmFpbHVyZSB0byBtYXRjaCwgc2hvdWxkIHJldHVybiB1bmRlZlxyXG5cdCQgOj0gbmV3IFN0YXRlKCdhYmNkZWYnKVxyXG5cdGVxdWFsIHJ1bGUubmV4dCgkKSwgdW5kZWZcclxuXHQpKClcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgLS0tIHRlc3QgUmVnZXhNYXRjaGVyKClcclxuXHJcbigoKSA9PlxyXG5cdHJ1bGUgOj0gUmVnZXhNYXRjaGVyKC9eW1xcLlxcI11cXHMvKVxyXG5cdGxpa2UgcnVsZS5uZXh0KG5ldyBTdGF0ZSgnLiBhYmMnKSksIHtwb3M6IDJ9XHJcblx0ZmFpbHMgKCkgPT4gcnVsZS5uZXh0KG5ldyBTdGF0ZSgnLiBhYmMnLCAxKSlcclxuXHQpKClcclxuXHJcbigoKSA9PlxyXG5cdHJ1bGUgOj0gUmVnZXhNYXRjaGVyKC9eW1xcLlxcI11cXHMvKVxyXG5cdGxpa2UgcnVsZS5uZXh0KG5ldyBTdGF0ZSgnYWJjIC4gZGVmJykpLCB7cG9zOiAwfVxyXG5cdGxpa2UgcnVsZS5uZXh0KG5ldyBTdGF0ZSgnYWJjIC4gZGVmJywgNCkpLCB7cG9zOiA2fVxyXG5cclxuXHQjIC0tLSBPbiBmYWlsdXJlIHRvIG1hdGNoLCBzaG91bGQgcmV0dXJuIHVuZGVmXHJcblx0JCA6PSBuZXcgU3RhdGUoJ2FiYyAuIGFiYycpXHJcblx0ZXF1YWwgcnVsZS5uZXh0KCQpLCB1bmRlZlxyXG5cdCkoKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuIyBCdWlsZCBhbmQgdGVzdCBzb21lIHZlcnkgc2ltcGxlIHJ1bGVzXHJcblxyXG5yZUlkZW50IDo9IC8vL14oIFthLXpBLVpfJF0gW2EtekEtWjAtOV8kXSogKSAvLy9cclxucmVJZGVudC50b1N0cmluZyA9ICgpID0+ICdyZUlkZW50J1xyXG5cclxucmVOdW1iZXIgOj0gLy8vXlxyXG5cdChcclxuXHRcdCg/OlxyXG5cdFx0XHRbMC05XSsgXFwuPyBbMC05XSogfCBcXC4gWzAtOV0rXHJcblx0XHRcdClcclxuXHRcdCg/OlxyXG5cdFx0XHRbZUVdIFstK10/IFswLTldK1xyXG5cdFx0XHQpP1xyXG5cdFx0KVxcYlxyXG5cdC8vL1xyXG5yZU51bWJlci50b1N0cmluZyA9ICgpID0+ICdyZU51bWJlcidcclxuXHJcbnJlT3AgOj0gL1srXFwtKlxcL10vXHJcbnJlT3AudG9TdHJpbmcgPSAoKSA9PiAncmVPcCdcclxuXHJcbiMgLS0tIERlZmluZSB0aGUgZ3JhbW1lciBwcm9kdWN0aW9uc1xyXG5cclxudmFsdWUgOj0gQW55IFtyZUlkZW50LCByZU51bWJlcl1cclxudmFsdWUudG9TdHJpbmcgPSAoKSA9PiAndmFsdWUnXHJcblxyXG5zdG10IDo9IEFueSBbXHJcblx0W3JlSWRlbnQsICc9JywgdmFsdWVdXHJcblx0W3ZhbHVlLCByZU9wLCB2YWx1ZV1cclxuXHRdXHJcbnN0bXQudG9TdHJpbmcgPSAoKSA9PiAnc3RtdCdcclxuXHJcbnByb2dyYW0gOj0gW1xyXG5cdHN0bXRcclxuXHRbJzsnLCBzdG10XSB8PiBTdGFyXHJcblx0XVxyXG5wcm9ncmFtLnRvU3RyaW5nID0gKCkgPT4gJ3Byb2dyYW0nXHJcblxyXG4oKCkgPT5cclxuXHRwYXJzZSA6PSBnZXRQYXJzZXIocmVJZGVudClcclxuXHRzdWNjZWVkcyAoKSA9PiBwYXJzZSAnYWJjJ1xyXG5cdHN1Y2NlZWRzICgpID0+IHBhcnNlICcgYWJjICAnICAjIC0tLSB3aGl0ZXNwYWNlIHNraXBwZWRcclxuXHRmYWlscyAgICAoKSA9PiBwYXJzZSAnMWFiYydcclxuXHRmYWlscyAgICAoKSA9PiBwYXJzZSAnYWJjIGRlZidcclxuXHRzdWNjZWVkcyAoKSA9PiBnZXRQYXJzZXIocmVJZGVudCwgbydwYXJ0aWFsJykgJ2FiYyBkZWYnXHJcblx0KSgpXHJcblxyXG4oKCkgPT5cclxuXHRwYXJzZSA6PSBnZXRQYXJzZXIocmVPcClcclxuXHRzdWNjZWVkcyAoKSA9PiBwYXJzZSAnKydcclxuXHRzdWNjZWVkcyAoKSA9PiBwYXJzZSAnICAtICAnXHJcblx0c3VjY2VlZHMgKCkgPT4gcGFyc2UgJyonXHJcblx0c3VjY2VlZHMgKCkgPT4gcGFyc2UgJyAgLyAgJ1xyXG5cdGZhaWxzICAgICgpID0+IHBhcnNlICchJ1xyXG5cdCkoKVxyXG5cclxuKCgpID0+XHJcblx0cGFyc2UgOj0gZ2V0UGFyc2VyKHZhbHVlKVxyXG5cdHN1Y2NlZWRzICgpID0+IHBhcnNlICduJ1xyXG5cdHN1Y2NlZWRzICgpID0+IHBhcnNlICcgIG4gICdcclxuXHRzdWNjZWVkcyAoKSA9PiBwYXJzZSAnNDInXHJcblx0c3VjY2VlZHMgKCkgPT4gcGFyc2UgJyAgNDIgICdcclxuXHRmYWlscyAgICAoKSA9PiBwYXJzZSAnISdcclxuXHQpKClcclxuXHJcbigoKSA9PlxyXG5cdHBhcnNlIDo9IGdldFBhcnNlcihzdG10KVxyXG5cdHN1Y2NlZWRzICgpID0+IHBhcnNlICduID0gNDInXHJcblx0c3VjY2VlZHMgKCkgPT4gcGFyc2UgJyAgbj00MiAgJ1xyXG5cdHN1Y2NlZWRzICgpID0+IHBhcnNlICdhPWInXHJcblx0c3VjY2VlZHMgKCkgPT4gcGFyc2UgJyAgYSA9IGIgICdcclxuXHRmYWlscyAgICAoKSA9PiBwYXJzZSAnISdcclxuXHQpKClcclxuXHJcbigoKSA9PlxyXG5cdHBhcnNlIDo9IGdldFBhcnNlcihyZU51bWJlcilcclxuXHRzdWNjZWVkcyAoKSA9PiBwYXJzZSAnNDInXHJcblx0c3VjY2VlZHMgKCkgPT4gcGFyc2UgJyAgNDIgICdcclxuXHRzdWNjZWVkcyAoKSA9PiBwYXJzZSAnMy4xNCdcclxuXHRzdWNjZWVkcyAoKSA9PiBwYXJzZSAnICAzLjE0ICAnXHJcblx0c3VjY2VlZHMgKCkgPT4gcGFyc2UgJzMuMTRlNSdcclxuXHRzdWNjZWVkcyAoKSA9PiBwYXJzZSAnICAzLjE0RTUgICdcclxuXHRmYWlscyAgICAoKSA9PiBwYXJzZSAnISdcclxuXHQpKClcclxuXHJcbigoKSA9PlxyXG5cdHBhcnNlIDo9IGdldFBhcnNlcihwcm9ncmFtKVxyXG5cdHN1Y2NlZWRzICgpID0+IHBhcnNlICd4ID0gNDI7IHkgPSAzMzsgeCp5J1xyXG5cdHN1Y2NlZWRzICgpID0+IHBhcnNlIFwiXCJcIlxyXG5cdFx0eCA9IDQyO1xyXG5cdFx0eSA9IDMzO1xyXG5cdFx0eCAqIHlcclxuXHRcdFwiXCJcIlxyXG5cdCkoKVxyXG5cclxuIl19