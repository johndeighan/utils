"use strict";
// unit-test.civet

import {
	assert, assertEquals, assertNotEquals, assertObjectMatch,
	assertStringIncludes, assertMatch, assertArrayIncludes,
	} from 'jsr:@std/assert'

import {
	undef, defined, notdefined, isArray, isHash, isString, hash,
	} from './datatypes.ts'
import {
	pushLogLevel, popLogLevel, DBG,
	} from './logger.ts'
import {getMyOutsideCaller} from './v8-stack.ts'

/**
 * unit-test - provides functions for use in unit tests
 * available tests:
 *    equal
 *    truthy
 *    falsy
 *    fails
 *    succeeds
 *    matches
 *    like
 *    listLike
 *    includes
 *    includesAll
 *
 * @module
 */

// ---------------------------------------------------------------------------

/**
 * Generate a test name using the source line number
 */

export const getTestName = (): string => {

	pushLogLevel('silent')
	const frame = getMyOutsideCaller()
	const line = (frame === undef) ? 0 : frame.line
	popLogLevel()
	return `line ${line}`
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, checks if  value is deeply equal to
 * the expected value. Reports line number of the test.
 *
 * @param {any} value - any JavaScript value
 * @param {any} expected - any JavaScript value
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * equal 2+2, 4
 * ```
 * This test will pass.
 */

export const equal = (value: any, expected: any) : void => {

	const name = getTestName()
	DBG(`equal ?, ${JSON.stringify(expected)} (${name})`)
	Deno.test(name, () => assertEquals(value, expected))
	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests if value is truthy
 * Reports line number of the test.

 * @param {any} value - any JavaScript value
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * truthy isString('abc')
 * ```
 * This test will pass.
 */

export const truthy = (value: any): void => {

	const name = getTestName()
	DBG(`truthy ${JSON.stringify(value)} (${name})`)
	Deno.test(name, () => assert(value))
	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests if value is falsy
 * Reports line number of the test.
 *
 * @param {any} value - any JavaScript value
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * falsy isString(42)
 * ```
 * This test will pass.
 */

export const falsy = (value: any): void => {

	const name = getTestName()
	DBG(`falsy ${JSON.stringify(value)} (${name})`)
	Deno.test(name, () => assert((!value)))
	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests if calling the provided function
 * throws an exception. Reports line number of the test.
 *
 * @param {any => any} func - any JavaScript function
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * fails () => throw new Error('bad')
 * ```
 * This test will pass.
 */

export const fails = (func: () => void): void => {

	assert((typeof func === 'function'), "test fails() passed non-function")
	pushLogLevel('silent')
	const name = getTestName()
	DBG(`fails <func> (${name})`)
	Deno.test(name, () => assert(llthrows(func)))
	popLogLevel()
	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests if calling the provided function
 * runs without throwing an exception.
 * Reports line number of the test.
 *
 * @param {any => any} func - any JavaScript function
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * succeeds () => return 42
 * ```
 * This test will pass.
 */

export const succeeds = (func: () => void): void => {

	assert((typeof func === 'function'), "test succeeds() passed non-function")
	const name = getTestName()
	DBG(`succeeds <func> (${name})`)
	Deno.test(name, () => assert(!llthrows(func)))
	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests a value, which must be a string,
 * matches either a substring or a regular expression.
 * Reports line number of the test.
 *
 * @param {any} value - any JavaScript value
 * @param {any} expected - any JavaScript value
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * matches 'abcde', 'bce'
 * ```
 * This test will pass.
 *
 * @example
 * ```js
 * matches 'aabbcc', /a+b+c+/
 * ```
 * This test will pass.
 */

export const matches = (value: any, expected: any) => {

	assert(isString(value), `Not a string: ${value}`)
	const name = getTestName()
	DBG(`matches ?, ${JSON.stringify(expected)} (${name})`)
	if (isString(expected)) {
		Deno.test(name, () => assertStringIncludes(value, expected))
	}
	else if (expected instanceof RegExp) {
		Deno.test(name, () => assertMatch(value, expected))
	}
	else {
		Deno.test(name, () => assert(false))
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests if one hash matches another hash.
 * the first hash must have all the properties in the second hash,
 * but extra properties are allowed.
 * Reports line number of the test.
 *
 * @param {hash} value - any JavaScript object
 * @param {hash} expected - any JavaScript object
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * like {a:1, b:2, c:3}, {a:1, c:3}
 * ```
 * This test will pass.
 */

export const like = (value: (hash | undefined), expected: hash): void => {

	// @ts-ignore
	const name = getTestName()
	DBG(`like ?, ${JSON.stringify(expected)} (${name})`)
	if (notdefined(value)) {
		Deno.test(name, () => assertEquals(value, undef))
	}
	else {
		Deno.test(name, () => assertObjectMatch(value, expected))
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests a value, which must be an array or object,
 * matches another array or object. For objects, the value must
 * have all the properties in the expected value, but extra
 * properties are allowed. For arrays, the value must have
 * at least the length of the expected array, and each item in
 * the value array must be an object that has at least all of the
 * properties that the object in the expected array at the
 * same position has.
 * Reports line number of the test.
 *
 * @param {array | object} value - any JavaScript value
 * @param {array | object} expected - any JavaScript value
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * like {a:1, b:2, c:3}, {a:1, c:3}
 * ```
 * This test will pass.
 *
 * @example
 * ```js
 * like [{a:1, b:2, c:3}, {a:3, b:5, c:23}], [{a:1, b:2}]
 * ```
 * This test will pass.
 */

export const listLike = (value: hash[], expected: hash[]): void => {

	const name = getTestName()
	DBG(`listLike ?, ${JSON.stringify(expected)} (${name})`)

	const len = value.length
	Deno.test(`${name}/len`, () => assertEquals(len, expected.length))
	for (let end = len-1, i1 = 0, asc = 0 <= end; asc ? i1 <= end : i1 >= end; asc ? ++i1 : --i1) {const i = i1;
		// @ts-ignore
		Deno.test(`${name}/${i}`, () => assertObjectMatch(value[i], expected[i]))
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests a value, which must be an array,
 * includes the expected value.
 * Reports line number of the test
 *
 * @param {Array<any>} value - an array
 * @param {any} expected - any JavaScript value
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * includes ['a', 'b', 'c'], 'b'
 * ```
 * This test will pass.
 */

export const includes = (value: any, expected: any) => {

	assert(Array.isArray(value), `not an array: ${value}`)
	const name = getTestName()
	DBG(`includes ?, ${JSON.stringify(expected)} (${name})`)
	Deno.test(name, () => assertArrayIncludes(value, [expected]))
	return
}

// ---------------------------------------------------------------------------

/**
 * In a unit test, tests a value, which must be an array,
 * includes all of the items in the expected array.
 * Reports line number of the test
 *
 * @param {Array<any>} value - an array
 * @param {Array<any>} expected - an array
 * @returns {void} - nothing
 *
 * @example
 * ```js
 * includesAll ['a', 'b', 'c'], ['b', 'c']
 * ```
 * This test will pass.
 */

export const includesAll = (value: any, expected: any) => {

	assert(Array.isArray(value), `not an array: ${value}`)
	assert(Array.isArray(expected), `not an array: ${expected}`)
	const name = getTestName()
	DBG(`includesAll ?, ${JSON.stringify(expected)} (${name})`)
	Deno.test(name, () => assertArrayIncludes(value, expected))
	return
}

// ---------------------------------------------------------------------------

export const llthrows = (func: () => any): boolean => {

	try {
		func()
		return false
	}
	catch (err) {
		return true
	}
}

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi91bml0LXRlc3QuY2l2ZXQudHN4Iiwic291cmNlcyI6WyJzcmMvbGliL3VuaXQtdGVzdC5jaXZldCJdLCJtYXBwaW5ncyI6IjtBQUFBLGtCQUFpQjtBQUNqQixBQUFBO0FBQ0EsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsZUFBZSxDQUFDLENBQUMsaUJBQWlCLENBQUM7QUFDMUQsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLG1CQUFtQixDQUFDO0FBQ3hELENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUI7QUFDekIsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQzdELENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0I7QUFDeEIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxZQUFZLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxHQUFHLENBQUM7QUFDaEMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWE7QUFDckIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWU7QUFDaEQsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFZLE1BQVgsV0FBVyxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNuQyxBQUFBO0FBQ0EsQUFBQSxDQUFDLFlBQVksQ0FBQSxBQUFDLFFBQVEsQ0FBQTtBQUN0QixBQUFBLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLGtCQUFrQixDQUFDLENBQUM7QUFDOUIsQUFBQSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUk7QUFDMUMsQUFBQSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ2QsQUFBQSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQztBQUFDLENBQUE7QUFDdEIsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDckQsQUFBQTtBQUNBLEFBQUEsQ0FBSyxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDdEIsQUFBQSxDQUFDLEdBQUcsQ0FBQSxBQUFDLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNyRCxBQUFBLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQSxBQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FB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QSxDQUFBO0FBQ0wsQUFBQSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUEsQUFBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFBLEFBQUMsS0FBSyxDQUFBLEM7Q0FBQSxDQUFBO0FBQ3BDLEFBQUEsQ0FBQyxNO0FBQU0sQ0FBQTtBQUNQLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUssTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLENBQUMsS0FBSyxDLEMsQ0FBQyxBQUFDLEksWSxDQUFLLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN0RCxBQUFBO0FBQ0EsQUFBQSxDQUFDLGFBQVk7QUFDYixBQUFBLENBQUssTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ3RCLEFBQUEsQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDcEQsQUFBQSxDQUFDLEdBQUcsQ0FBQSxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ3JCLEFBQUEsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFBLEFBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQSxBQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQSxDO0NBQUEsQ0FBQTtBQUNqRCxBQUFBLENBQUMsSUFBSSxDQUFBLENBQUE7QUFDTCxBQUFBLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQSxBQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQSxBQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsQ0FBQSxDO0NBQUEsQ0FBQTtBQUN6RCxBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBUyxNQUFSLFFBQVEsQ0FBQyxDQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzdELEFBQUE7QUFDQSxBQUFBLENBQUssTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ3RCLEFBQUEsQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDeEQsQUFBQTtBQUNBLEFBQUEsQ0FBSSxNQUFILEdBQUcsQ0FBQyxDQUFFLENBQUMsS0FBSyxDQUFDLE1BQU07QUFDcEIsQUFBQSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUEsQUFBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQSxBQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUEsQ0FBQTtB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QUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQzNELEFBQUEsQ0FBQyxNO0FBQU0sQ0FBQTtBQUNQLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBUyxNQUFSLFFBQVEsQ0FBQyxDQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDaEQsQUFBQTtBQUNBLEFBQUEsQ0FBQyxHQUFHLENBQUEsQ0FBQTtBQUNKLEFBQUEsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNSLEFBQUEsRUFBRSxNQUFNLENBQUMsSztDQUFLLENBQUE7QUFDZCxBQUFBLENBQUMsS0FBSyxDQUFDLENBQUEsR0FBRyxDQUFBLENBQUEsQ0FBQTtBQUNWLEFBQUEsRUFBRSxNQUFNLENBQUMsSTtDQUFJLEM7QUFBQSxDQUFBO0FBQ2IiLCJuYW1lcyI6W10sInNvdXJjZXNDb250ZW50IjpbIiMgdW5pdC10ZXN0LmNpdmV0XHJcblxyXG5pbXBvcnQge1xyXG5cdGFzc2VydCwgYXNzZXJ0RXF1YWxzLCBhc3NlcnROb3RFcXVhbHMsIGFzc2VydE9iamVjdE1hdGNoLFxyXG5cdGFzc2VydFN0cmluZ0luY2x1ZGVzLCBhc3NlcnRNYXRjaCwgYXNzZXJ0QXJyYXlJbmNsdWRlcyxcclxuXHR9IGZyb20gJ2pzcjpAc3RkL2Fzc2VydCdcclxuXHJcbmltcG9ydCB7XHJcblx0dW5kZWYsIGRlZmluZWQsIG5vdGRlZmluZWQsIGlzQXJyYXksIGlzSGFzaCwgaXNTdHJpbmcsIGhhc2gsXHJcblx0fSBmcm9tICcuL2RhdGF0eXBlcy50cydcclxuaW1wb3J0IHtcclxuXHRwdXNoTG9nTGV2ZWwsIHBvcExvZ0xldmVsLCBEQkcsXHJcblx0fSBmcm9tICcuL2xvZ2dlci50cydcclxuaW1wb3J0IHtnZXRNeU91dHNpZGVDYWxsZXJ9IGZyb20gJy4vdjgtc3RhY2sudHMnXHJcblxyXG4vKipcclxuICogdW5pdC10ZXN0IC0gcHJvdmlkZXMgZnVuY3Rpb25zIGZvciB1c2UgaW4gdW5pdCB0ZXN0c1xyXG4gKiBhdmFpbGFibGUgdGVzdHM6XHJcbiAqICAgIGVxdWFsXHJcbiAqICAgIHRydXRoeVxyXG4gKiAgICBmYWxzeVxyXG4gKiAgICBmYWlsc1xyXG4gKiAgICBzdWNjZWVkc1xyXG4gKiAgICBtYXRjaGVzXHJcbiAqICAgIGxpa2VcclxuICogICAgbGlzdExpa2VcclxuICogICAgaW5jbHVkZXNcclxuICogICAgaW5jbHVkZXNBbGxcclxuICpcclxuICogQG1vZHVsZVxyXG4gKi9cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogR2VuZXJhdGUgYSB0ZXN0IG5hbWUgdXNpbmcgdGhlIHNvdXJjZSBsaW5lIG51bWJlclxyXG4gKi9cclxuXHJcbmV4cG9ydCBnZXRUZXN0TmFtZSA6PSAoKTogc3RyaW5nID0+XHJcblxyXG5cdHB1c2hMb2dMZXZlbCAnc2lsZW50J1xyXG5cdGZyYW1lIDo9IGdldE15T3V0c2lkZUNhbGxlcigpXHJcblx0bGluZSA6PSAoZnJhbWUgPT0gdW5kZWYpID8gMCA6IGZyYW1lLmxpbmVcclxuXHRwb3BMb2dMZXZlbCgpXHJcblx0cmV0dXJuIFwibGluZSAje2xpbmV9XCJcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogSW4gYSB1bml0IHRlc3QsIGNoZWNrcyBpZiAgdmFsdWUgaXMgZGVlcGx5IGVxdWFsIHRvXHJcbiAqIHRoZSBleHBlY3RlZCB2YWx1ZS4gUmVwb3J0cyBsaW5lIG51bWJlciBvZiB0aGUgdGVzdC5cclxuICpcclxuICogQHBhcmFtIHthbnl9IHZhbHVlIC0gYW55IEphdmFTY3JpcHQgdmFsdWVcclxuICogQHBhcmFtIHthbnl9IGV4cGVjdGVkIC0gYW55IEphdmFTY3JpcHQgdmFsdWVcclxuICogQHJldHVybnMge3ZvaWR9IC0gbm90aGluZ1xyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBgYGBqc1xyXG4gKiBlcXVhbCAyKzIsIDRcclxuICogYGBgXHJcbiAqIFRoaXMgdGVzdCB3aWxsIHBhc3MuXHJcbiAqL1xyXG5cclxuZXhwb3J0IGVxdWFsIDo9ICh2YWx1ZTogYW55LCBleHBlY3RlZDogYW55KSA6IHZvaWQgPT5cclxuXHJcblx0bmFtZSA6PSBnZXRUZXN0TmFtZSgpXHJcblx0REJHIFwiZXF1YWwgPywgI3tKU09OLnN0cmluZ2lmeShleHBlY3RlZCl9ICgje25hbWV9KVwiXHJcblx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydEVxdWFscyh2YWx1ZSwgZXhwZWN0ZWQpXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIEluIGEgdW5pdCB0ZXN0LCB0ZXN0cyBpZiB2YWx1ZSBpcyB0cnV0aHlcclxuICogUmVwb3J0cyBsaW5lIG51bWJlciBvZiB0aGUgdGVzdC5cclxuXHJcbiAqIEBwYXJhbSB7YW55fSB2YWx1ZSAtIGFueSBKYXZhU2NyaXB0IHZhbHVlXHJcbiAqIEByZXR1cm5zIHt2b2lkfSAtIG5vdGhpbmdcclxuICpcclxuICogQGV4YW1wbGVcclxuICogYGBganNcclxuICogdHJ1dGh5IGlzU3RyaW5nKCdhYmMnKVxyXG4gKiBgYGBcclxuICogVGhpcyB0ZXN0IHdpbGwgcGFzcy5cclxuICovXHJcblxyXG5leHBvcnQgdHJ1dGh5IDo9ICh2YWx1ZTogYW55KTogdm9pZCA9PlxyXG5cclxuXHRuYW1lIDo9IGdldFRlc3ROYW1lKClcclxuXHREQkcgXCJ0cnV0aHkgI3tKU09OLnN0cmluZ2lmeSh2YWx1ZSl9ICgje25hbWV9KVwiXHJcblx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydCB2YWx1ZVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBJbiBhIHVuaXQgdGVzdCwgdGVzdHMgaWYgdmFsdWUgaXMgZmFsc3lcclxuICogUmVwb3J0cyBsaW5lIG51bWJlciBvZiB0aGUgdGVzdC5cclxuICpcclxuICogQHBhcmFtIHthbnl9IHZhbHVlIC0gYW55IEphdmFTY3JpcHQgdmFsdWVcclxuICogQHJldHVybnMge3ZvaWR9IC0gbm90aGluZ1xyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBgYGBqc1xyXG4gKiBmYWxzeSBpc1N0cmluZyg0MilcclxuICogYGBgXHJcbiAqIFRoaXMgdGVzdCB3aWxsIHBhc3MuXHJcbiAqL1xyXG5cclxuZXhwb3J0IGZhbHN5IDo9ICh2YWx1ZTogYW55KTogdm9pZCA9PlxyXG5cclxuXHRuYW1lIDo9IGdldFRlc3ROYW1lKClcclxuXHREQkcgXCJmYWxzeSAje0pTT04uc3RyaW5naWZ5KHZhbHVlKX0gKCN7bmFtZX0pXCJcclxuXHREZW5vLnRlc3QgbmFtZSwgKCkgPT4gYXNzZXJ0IChub3QgdmFsdWUpXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIEluIGEgdW5pdCB0ZXN0LCB0ZXN0cyBpZiBjYWxsaW5nIHRoZSBwcm92aWRlZCBmdW5jdGlvblxyXG4gKiB0aHJvd3MgYW4gZXhjZXB0aW9uLiBSZXBvcnRzIGxpbmUgbnVtYmVyIG9mIHRoZSB0ZXN0LlxyXG4gKlxyXG4gKiBAcGFyYW0ge2FueSA9PiBhbnl9IGZ1bmMgLSBhbnkgSmF2YVNjcmlwdCBmdW5jdGlvblxyXG4gKiBAcmV0dXJucyB7dm9pZH0gLSBub3RoaW5nXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYGpzXHJcbiAqIGZhaWxzICgpID0+IHRocm93IG5ldyBFcnJvcignYmFkJylcclxuICogYGBgXHJcbiAqIFRoaXMgdGVzdCB3aWxsIHBhc3MuXHJcbiAqL1xyXG5cclxuZXhwb3J0IGZhaWxzIDo9IChmdW5jOiAoKSA9PiB2b2lkKTogdm9pZCA9PlxyXG5cclxuXHRhc3NlcnQgKHR5cGVvZiBmdW5jID09ICdmdW5jdGlvbicpLCBcInRlc3QgZmFpbHMoKSBwYXNzZWQgbm9uLWZ1bmN0aW9uXCJcclxuXHRwdXNoTG9nTGV2ZWwgJ3NpbGVudCdcclxuXHRuYW1lIDo9IGdldFRlc3ROYW1lKClcclxuXHREQkcgXCJmYWlscyA8ZnVuYz4gKCN7bmFtZX0pXCJcclxuXHREZW5vLnRlc3QgbmFtZSwgKCkgPT4gYXNzZXJ0KGxsdGhyb3dzKGZ1bmMpKVxyXG5cdHBvcExvZ0xldmVsKClcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogSW4gYSB1bml0IHRlc3QsIHRlc3RzIGlmIGNhbGxpbmcgdGhlIHByb3ZpZGVkIGZ1bmN0aW9uXHJcbiAqIHJ1bnMgd2l0aG91dCB0aHJvd2luZyBhbiBleGNlcHRpb24uXHJcbiAqIFJlcG9ydHMgbGluZSBudW1iZXIgb2YgdGhlIHRlc3QuXHJcbiAqXHJcbiAqIEBwYXJhbSB7YW55ID0+IGFueX0gZnVuYyAtIGFueSBKYXZhU2NyaXB0IGZ1bmN0aW9uXHJcbiAqIEByZXR1cm5zIHt2b2lkfSAtIG5vdGhpbmdcclxuICpcclxuICogQGV4YW1wbGVcclxuICogYGBganNcclxuICogc3VjY2VlZHMgKCkgPT4gcmV0dXJuIDQyXHJcbiAqIGBgYFxyXG4gKiBUaGlzIHRlc3Qgd2lsbCBwYXNzLlxyXG4gKi9cclxuXHJcbmV4cG9ydCBzdWNjZWVkcyA6PSAoZnVuYzogKCkgPT4gdm9pZCk6IHZvaWQgPT5cclxuXHJcblx0YXNzZXJ0ICh0eXBlb2YgZnVuYyA9PSAnZnVuY3Rpb24nKSwgXCJ0ZXN0IHN1Y2NlZWRzKCkgcGFzc2VkIG5vbi1mdW5jdGlvblwiXHJcblx0bmFtZSA6PSBnZXRUZXN0TmFtZSgpXHJcblx0REJHIFwic3VjY2VlZHMgPGZ1bmM+ICgje25hbWV9KVwiXHJcblx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydCBub3QgbGx0aHJvd3MoZnVuYylcclxuXHRyZXR1cm5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogSW4gYSB1bml0IHRlc3QsIHRlc3RzIGEgdmFsdWUsIHdoaWNoIG11c3QgYmUgYSBzdHJpbmcsXHJcbiAqIG1hdGNoZXMgZWl0aGVyIGEgc3Vic3RyaW5nIG9yIGEgcmVndWxhciBleHByZXNzaW9uLlxyXG4gKiBSZXBvcnRzIGxpbmUgbnVtYmVyIG9mIHRoZSB0ZXN0LlxyXG4gKlxyXG4gKiBAcGFyYW0ge2FueX0gdmFsdWUgLSBhbnkgSmF2YVNjcmlwdCB2YWx1ZVxyXG4gKiBAcGFyYW0ge2FueX0gZXhwZWN0ZWQgLSBhbnkgSmF2YVNjcmlwdCB2YWx1ZVxyXG4gKiBAcmV0dXJucyB7dm9pZH0gLSBub3RoaW5nXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYGpzXHJcbiAqIG1hdGNoZXMgJ2FiY2RlJywgJ2JjZSdcclxuICogYGBgXHJcbiAqIFRoaXMgdGVzdCB3aWxsIHBhc3MuXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYGpzXHJcbiAqIG1hdGNoZXMgJ2FhYmJjYycsIC9hK2IrYysvXHJcbiAqIGBgYFxyXG4gKiBUaGlzIHRlc3Qgd2lsbCBwYXNzLlxyXG4gKi9cclxuXHJcbmV4cG9ydCBtYXRjaGVzIDo9ICh2YWx1ZTogYW55LCBleHBlY3RlZDogYW55KSA9PlxyXG5cclxuXHRhc3NlcnQgaXNTdHJpbmcodmFsdWUpLCBcIk5vdCBhIHN0cmluZzogI3t2YWx1ZX1cIlxyXG5cdG5hbWUgOj0gZ2V0VGVzdE5hbWUoKVxyXG5cdERCRyBcIm1hdGNoZXMgPywgI3tKU09OLnN0cmluZ2lmeShleHBlY3RlZCl9ICgje25hbWV9KVwiXHJcblx0aWYgaXNTdHJpbmcoZXhwZWN0ZWQpXHJcblx0XHREZW5vLnRlc3QgbmFtZSwgKCkgPT4gYXNzZXJ0U3RyaW5nSW5jbHVkZXMgdmFsdWUsIGV4cGVjdGVkXHJcblx0ZWxzZSBpZiAoZXhwZWN0ZWQgaW5zdGFuY2VvZiBSZWdFeHApXHJcblx0XHREZW5vLnRlc3QgbmFtZSwgKCkgPT4gYXNzZXJ0TWF0Y2ggdmFsdWUsIGV4cGVjdGVkXHJcblx0ZWxzZVxyXG5cdFx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydCBmYWxzZVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBJbiBhIHVuaXQgdGVzdCwgdGVzdHMgaWYgb25lIGhhc2ggbWF0Y2hlcyBhbm90aGVyIGhhc2guXHJcbiAqIHRoZSBmaXJzdCBoYXNoIG11c3QgaGF2ZSBhbGwgdGhlIHByb3BlcnRpZXMgaW4gdGhlIHNlY29uZCBoYXNoLFxyXG4gKiBidXQgZXh0cmEgcHJvcGVydGllcyBhcmUgYWxsb3dlZC5cclxuICogUmVwb3J0cyBsaW5lIG51bWJlciBvZiB0aGUgdGVzdC5cclxuICpcclxuICogQHBhcmFtIHtoYXNofSB2YWx1ZSAtIGFueSBKYXZhU2NyaXB0IG9iamVjdFxyXG4gKiBAcGFyYW0ge2hhc2h9IGV4cGVjdGVkIC0gYW55IEphdmFTY3JpcHQgb2JqZWN0XHJcbiAqIEByZXR1cm5zIHt2b2lkfSAtIG5vdGhpbmdcclxuICpcclxuICogQGV4YW1wbGVcclxuICogYGBganNcclxuICogbGlrZSB7YToxLCBiOjIsIGM6M30sIHthOjEsIGM6M31cclxuICogYGBgXHJcbiAqIFRoaXMgdGVzdCB3aWxsIHBhc3MuXHJcbiAqL1xyXG5cclxuZXhwb3J0IGxpa2UgOj0gKHZhbHVlOiBoYXNoPywgZXhwZWN0ZWQ6IGhhc2gpOiB2b2lkID0+XHJcblxyXG5cdCMgQHRzLWlnbm9yZVxyXG5cdG5hbWUgOj0gZ2V0VGVzdE5hbWUoKVxyXG5cdERCRyBcImxpa2UgPywgI3tKU09OLnN0cmluZ2lmeShleHBlY3RlZCl9ICgje25hbWV9KVwiXHJcblx0aWYgbm90ZGVmaW5lZCh2YWx1ZSlcclxuXHRcdERlbm8udGVzdCBuYW1lLCAoKSA9PiBhc3NlcnRFcXVhbHMgdmFsdWUsIHVuZGVmXHJcblx0ZWxzZVxyXG5cdFx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydE9iamVjdE1hdGNoIHZhbHVlLCBleHBlY3RlZFxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBJbiBhIHVuaXQgdGVzdCwgdGVzdHMgYSB2YWx1ZSwgd2hpY2ggbXVzdCBiZSBhbiBhcnJheSBvciBvYmplY3QsXHJcbiAqIG1hdGNoZXMgYW5vdGhlciBhcnJheSBvciBvYmplY3QuIEZvciBvYmplY3RzLCB0aGUgdmFsdWUgbXVzdFxyXG4gKiBoYXZlIGFsbCB0aGUgcHJvcGVydGllcyBpbiB0aGUgZXhwZWN0ZWQgdmFsdWUsIGJ1dCBleHRyYVxyXG4gKiBwcm9wZXJ0aWVzIGFyZSBhbGxvd2VkLiBGb3IgYXJyYXlzLCB0aGUgdmFsdWUgbXVzdCBoYXZlXHJcbiAqIGF0IGxlYXN0IHRoZSBsZW5ndGggb2YgdGhlIGV4cGVjdGVkIGFycmF5LCBhbmQgZWFjaCBpdGVtIGluXHJcbiAqIHRoZSB2YWx1ZSBhcnJheSBtdXN0IGJlIGFuIG9iamVjdCB0aGF0IGhhcyBhdCBsZWFzdCBhbGwgb2YgdGhlXHJcbiAqIHByb3BlcnRpZXMgdGhhdCB0aGUgb2JqZWN0IGluIHRoZSBleHBlY3RlZCBhcnJheSBhdCB0aGVcclxuICogc2FtZSBwb3NpdGlvbiBoYXMuXHJcbiAqIFJlcG9ydHMgbGluZSBudW1iZXIgb2YgdGhlIHRlc3QuXHJcbiAqXHJcbiAqIEBwYXJhbSB7YXJyYXkgfCBvYmplY3R9IHZhbHVlIC0gYW55IEphdmFTY3JpcHQgdmFsdWVcclxuICogQHBhcmFtIHthcnJheSB8IG9iamVjdH0gZXhwZWN0ZWQgLSBhbnkgSmF2YVNjcmlwdCB2YWx1ZVxyXG4gKiBAcmV0dXJucyB7dm9pZH0gLSBub3RoaW5nXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYGpzXHJcbiAqIGxpa2Uge2E6MSwgYjoyLCBjOjN9LCB7YToxLCBjOjN9XHJcbiAqIGBgYFxyXG4gKiBUaGlzIHRlc3Qgd2lsbCBwYXNzLlxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBgYGBqc1xyXG4gKiBsaWtlIFt7YToxLCBiOjIsIGM6M30sIHthOjMsIGI6NSwgYzoyM31dLCBbe2E6MSwgYjoyfV1cclxuICogYGBgXHJcbiAqIFRoaXMgdGVzdCB3aWxsIHBhc3MuXHJcbiAqL1xyXG5cclxuZXhwb3J0IGxpc3RMaWtlIDo9ICh2YWx1ZTogaGFzaFtdLCBleHBlY3RlZDogaGFzaFtdKTogdm9pZCA9PlxyXG5cclxuXHRuYW1lIDo9IGdldFRlc3ROYW1lKClcclxuXHREQkcgXCJsaXN0TGlrZSA/LCAje0pTT04uc3RyaW5naWZ5KGV4cGVjdGVkKX0gKCN7bmFtZX0pXCJcclxuXHJcblx0bGVuIDo9IHZhbHVlLmxlbmd0aFxyXG5cdERlbm8udGVzdCBcIiN7bmFtZX0vbGVuXCIsICgpID0+IGFzc2VydEVxdWFscyBsZW4sIGV4cGVjdGVkLmxlbmd0aFxyXG5cdGZvciBpIG9mIFswLi5sZW4tMV1cclxuXHRcdCMgQHRzLWlnbm9yZVxyXG5cdFx0RGVuby50ZXN0IFwiI3tuYW1lfS8je2l9XCIsICgpID0+IGFzc2VydE9iamVjdE1hdGNoIHZhbHVlW2ldLCBleHBlY3RlZFtpXVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBJbiBhIHVuaXQgdGVzdCwgdGVzdHMgYSB2YWx1ZSwgd2hpY2ggbXVzdCBiZSBhbiBhcnJheSxcclxuICogaW5jbHVkZXMgdGhlIGV4cGVjdGVkIHZhbHVlLlxyXG4gKiBSZXBvcnRzIGxpbmUgbnVtYmVyIG9mIHRoZSB0ZXN0XHJcbiAqXHJcbiAqIEBwYXJhbSB7QXJyYXk8YW55Pn0gdmFsdWUgLSBhbiBhcnJheVxyXG4gKiBAcGFyYW0ge2FueX0gZXhwZWN0ZWQgLSBhbnkgSmF2YVNjcmlwdCB2YWx1ZVxyXG4gKiBAcmV0dXJucyB7dm9pZH0gLSBub3RoaW5nXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYGpzXHJcbiAqIGluY2x1ZGVzIFsnYScsICdiJywgJ2MnXSwgJ2InXHJcbiAqIGBgYFxyXG4gKiBUaGlzIHRlc3Qgd2lsbCBwYXNzLlxyXG4gKi9cclxuXHJcbmV4cG9ydCBpbmNsdWRlcyA6PSAodmFsdWU6IGFueSwgZXhwZWN0ZWQ6IGFueSkgPT5cclxuXHJcblx0YXNzZXJ0IEFycmF5LmlzQXJyYXkodmFsdWUpLCBcIm5vdCBhbiBhcnJheTogI3t2YWx1ZX1cIlxyXG5cdG5hbWUgOj0gZ2V0VGVzdE5hbWUoKVxyXG5cdERCRyBcImluY2x1ZGVzID8sICN7SlNPTi5zdHJpbmdpZnkoZXhwZWN0ZWQpfSAoI3tuYW1lfSlcIlxyXG5cdERlbm8udGVzdCBuYW1lLCAoKSA9PiBhc3NlcnRBcnJheUluY2x1ZGVzKHZhbHVlLCBbZXhwZWN0ZWRdKVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBJbiBhIHVuaXQgdGVzdCwgdGVzdHMgYSB2YWx1ZSwgd2hpY2ggbXVzdCBiZSBhbiBhcnJheSxcclxuICogaW5jbHVkZXMgYWxsIG9mIHRoZSBpdGVtcyBpbiB0aGUgZXhwZWN0ZWQgYXJyYXkuXHJcbiAqIFJlcG9ydHMgbGluZSBudW1iZXIgb2YgdGhlIHRlc3RcclxuICpcclxuICogQHBhcmFtIHtBcnJheTxhbnk+fSB2YWx1ZSAtIGFuIGFycmF5XHJcbiAqIEBwYXJhbSB7QXJyYXk8YW55Pn0gZXhwZWN0ZWQgLSBhbiBhcnJheVxyXG4gKiBAcmV0dXJucyB7dm9pZH0gLSBub3RoaW5nXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqIGBgYGpzXHJcbiAqIGluY2x1ZGVzQWxsIFsnYScsICdiJywgJ2MnXSwgWydiJywgJ2MnXVxyXG4gKiBgYGBcclxuICogVGhpcyB0ZXN0IHdpbGwgcGFzcy5cclxuICovXHJcblxyXG5leHBvcnQgaW5jbHVkZXNBbGwgOj0gKHZhbHVlOiBhbnksIGV4cGVjdGVkOiBhbnkpID0+XHJcblxyXG5cdGFzc2VydCBBcnJheS5pc0FycmF5KHZhbHVlKSwgXCJub3QgYW4gYXJyYXk6ICN7dmFsdWV9XCJcclxuXHRhc3NlcnQgQXJyYXkuaXNBcnJheShleHBlY3RlZCksIFwibm90IGFuIGFycmF5OiAje2V4cGVjdGVkfVwiXHJcblx0bmFtZSA6PSBnZXRUZXN0TmFtZSgpXHJcblx0REJHIFwiaW5jbHVkZXNBbGwgPywgI3tKU09OLnN0cmluZ2lmeShleHBlY3RlZCl9ICgje25hbWV9KVwiXHJcblx0RGVuby50ZXN0IG5hbWUsICgpID0+IGFzc2VydEFycmF5SW5jbHVkZXModmFsdWUsIGV4cGVjdGVkKVxyXG5cdHJldHVyblxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBsbHRocm93cyA6PSAoZnVuYzogKCkgPT4gYW55KTogYm9vbGVhbiA9PlxyXG5cclxuXHR0cnlcclxuXHRcdGZ1bmMoKVxyXG5cdFx0cmV0dXJuIGZhbHNlXHJcblx0Y2F0Y2ggZXJyXHJcblx0XHRyZXR1cm4gdHJ1ZVxyXG4iXX0=