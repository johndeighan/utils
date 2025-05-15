"use strict";
// llutils.lib.civet

type AutoPromise<T> = Promise<Awaited<T>>;
import {sprintf} from "@std/fmt/printf"
import {relative} from '@std/path'

import {
	undef, defined, notdefined, assert,
	isHash, isArray, isNonEmptyString, isArrayOfStrings,
	isEmpty, nonEmpty, isString, isObject,
	integer, hash, array, voidFunc, FilterFunc, stringify,
	isNonPrimitive,
	} from './datatypes.lib.ts'

/**
 * @module llutils - low level utilities
 */

const llutilsLoadTime: integer = Date.now()

// ---------------------------------------------------------------------------

export const sinceLoad = (datetime: integer=Date.now()) => {

	return (datetime - llutilsLoadTime)
}

// ---------------------------------------------------------------------------

export const sinceLoadStr = (datetime: (integer | undefined)=undef) => {

	return sprintf("%6d", sinceLoad(datetime))
}

// ---------------------------------------------------------------------------

/**
 * throws an exception with the provided message
 */

export const croak = (msg: string): never => {

	throw new Error(msg)
}

// ---------------------------------------------------------------------------

/**
 * Asserts that `cond` is true. If it isn't, an exception is
 * thrown with the given `msg`
 */

export const throwsError = (func: voidFunc, msg: string="Unexpected success"): void => {

	try {
		func()
		throw new Error(msg)
	}
	catch (err) {
		return
	}
}    // ignore error - it was expected

// ---------------------------------------------------------------------------

/**
 * Calling pass() does nothing
 */

export const pass = (): void => {}    // do nothing

// ---------------------------------------------------------------------------

export const deeplyEquals = (a: any, b: any): boolean => {

	if (a === b) {
		return true
	}

	if ((typeof a !== 'object') || (a === null) || (typeof b !== 'object') || (b === null)) {
		return false
	}

	const keysA = Object.keys(a)
	const keysB = Object.keys(b)

	if (keysA.length !== keysB.length) {
		return false
	}

	for (const key of keysA) {
		if (!b.hasOwnProperty(key) || !deeplyEquals(a[key], b[key])) {
			return false
		}
	}
	return true
}

// ---------------------------------------------------------------------------

/**
 * JSON stringifies x on one line
 * but displays both undefined and null as 'undef'
 */

export const OL = (x: any): string => {

	if (x === undef) {
		return 'undef'
	}
	else if (x === null) {
		return 'null'
	}
	else if (typeof x === 'function') {
		return x.toString().replaceAll('\n', ' ')
	}
	else {
		const str = JSON.stringify(x, (k,v) => defined(v) ? v : '__undef__')
		return str.replaceAll('"__undef__"', 'undef')
	}
}

// ---------------------------------------------------------------------------

export const ML = (x: any): string => {

	if (x === undef) {
		return 'undef'
	}
	else if (x === null) {
		return 'null'
	}
	else if (typeof x === 'function') {
		return x.toString()
	}
	else {
		const str = JSON.stringify(x, (k,v) => defined(v) ? v : '__undef__', 3)
		if (defined(str)) {
			return str.replaceAll('"__undef__"', 'undef')
		}
		else {
			console.log(x)
			return "JSON.stringify returned undef!!!"
		}
	}
}

// ---------------------------------------------------------------------------

/**
 * Converts the given string to a hash
 * <word> becomes a key with a true value
 * !<word> becomes a keys with a false value
 * <word>=<string> becomes a key with value <string>
 *    - <string> must be quoted if it contains whitespace
 */

export const strToHash = (str: string): hash => {

	if (isEmpty(str)) {
		return {}
	}
	const h: hash = {}
	for (const word of str.trim().split(/\s+/)) {
		let ref: string[] | null;if ((ref = word.match(/^(\!)?([A-Za-z][A-Za-z_0-9]*)(?:(=)(.*))?$/))) {const lMatches: string[] | null = ref;
			const [_, neg, ident, eqSign, str] = lMatches
			if (isNonEmptyString(eqSign)) {
				assert(notdefined(neg) || (neg === ''),
						"negation with string value")

				// --- check if str is a valid number
				if (str.match(/^-?\d+(\.\d+)?$/)) {
					const num = parseFloat(str)
					if (Number.isNaN(num)) {
						// --- TO DO: interpret backslash escapes
						h[ident] = str
					}
					else {
						h[ident] = num
					}
				}
				else {
					h[ident] = str
				}
			}
			else if (neg) {
				h[ident] = false
			}
			else {
				h[ident] = true
			}
		}
		else {
			croak(`Invalid word ${OL(word)}`)
		}
	}
	return h
}

// ---------------------------------------------------------------------------

export const o = (lStrings: TemplateStringsArray): hash => {

	return strToHash(lStrings[0])
}

// ---------------------------------------------------------------------------

/**
 * Adds any keys in hDefaults that are missing in hOptions
 * to hOptions with their given values
 */

export const addDefaults = (hOptions: hash, hDefaults: hash): hash => {

	assert(isObject(hOptions), `hOptions not an object: ${OL(hOptions)}`)
	assert(isObject(hDefaults), `hDefaults not an object: ${OL(hDefaults)}`)

	// --- Fill in defaults for missing values
	for (const key of Object.keys(hDefaults)) {
		const value = hDefaults[key]
		if (!hOptions.hasOwnProperty(key) && defined(value)) {
			hOptions[key] = value
		}
	}
	return hOptions
}

// ---------------------------------------------------------------------------

/**
 * returns a hash of options with their values, using options
 * if it's a hash, or parsing options using strToHash() if
 * it's a string - adding any default values from hDefaults
 * if they're missing in the resulting hash
 */

export const getOptions = (hOptions: hash={}, hDefaults: hash={}): hash => {

	return addDefaults(hOptions, hDefaults)
}

// ---------------------------------------------------------------------------

/**
 * remove all keys from a hash that have either an empty name
 * or an empty value
 */

export const removeEmptyKeys = (h: hash): hash => {

	const hResult: hash = {}
	for (const key of keys(h)) {
		if (nonEmpty(key) && nonEmpty(h[key])) {
			hResult[key] = h[key]
		}
	}
	return hResult
}

// ---------------------------------------------------------------------------

/**
 * return an array of all own keys in a hash
 */

export const keys = (obj: hash, hOptions: hash={}): string[] => {

	const h = getOptions(hOptions, {
		except: []
		})

	let except = h.except

	if (isString(except)) {
		except = [except]
	}
	const lKeys: string[] = []
	for (const key of Object.keys(obj)) {
		if (!except.includes(key)) {
			lKeys.push(key)
		}
	}
	return lKeys
}

// ---------------------------------------------------------------------------

/**
 * returns true if either `h` is not defined, or if `h` is
 * a hash that includes all the keys provided
 */

export const hasKey = (h: hash, ...lKeys: string[]): boolean => {

	if (notdefined(h)) {
		return false
	}
	assert(isHash(h), `h not a hash: ${OL(h)}`)
	for (const key of lKeys) {
		assert(isString(key), `key not a string: ${OL(key)}`)
		if (!h.hasOwnProperty(key)) {
			return false
		}
	}
	return true
}

export const hasKeys = hasKey

// ---------------------------------------------------------------------------

export const missingKeys = (h: hash, ...lKeys: string[]): string[] => {

	if (notdefined(h)) {
		return lKeys
	}
	assert(isHash(h), `h not a hash: ${OL(h)}`)
	const lMissing: string[] = []
	for (const key of lKeys) {
		if (!h.hasOwnProperty(key)) {
			lMissing.push(key)
		}
	}
	return lMissing
}

// ---------------------------------------------------------------------------

/**
 * merges the provided objects into a new object
 * NOTE: none of the provided arguments are modified
 */

export const merge = (...lObjects: hash[]): hash => {

	return Object.assign({}, ...lObjects)
}

// ---------------------------------------------------------------------------

export const hit = (pct: number = 50): boolean => {

	return (100 * Math.random() < pct)
}

// ---------------------------------------------------------------------------
// --- ASYNC !

export const sleep = async (sec: number): AutoPromise<void> => {

	await new Promise((r) => setTimeout(r, 1000 * sec))
	return
}

// ---------------------------------------------------------------------------

/**
 * returns a string consisting of the given number
 * of space characters
 */

export const spaces = (n: number): string => {

	return " ".repeat(n)
}

// ---------------------------------------------------------------------------

/**
 * returns a string consisting of the given number
 * of TAB characters
 */

export const tabs = (n: number): string => {

	return "\t".repeat(n)
}

// ---------------------------------------------------------------------------

/**
 * rtrim - strip trailing whitespace
 */

export const rtrim = (line: string): string => {

	assert(isString(line), `not a string: ${typeof line}`)
	const lMatches = line.match(/^(.*?)\s+$/)
	return (lMatches === null) ? line : lMatches[1]
}

// ---------------------------------------------------------------------------

/**
 * Count the number of a specific character in a string
 */

export const countChars = (str: string, ch: string): number => {

	let count = 0
	let pos = -1
	while ((pos = str.indexOf(ch, pos+1)) !== -1) {
		count += 1
	}
	return count
}

// ---------------------------------------------------------------------------

/**
 * convert a multi-line string to an array
 * of single line strings
 */

export const blockToArray = (block: string): string[] => {

	if (isEmpty(block)) {
		return []
	}
	else {
		return block.split(/\r?\n/)
	}
}

// ---------------------------------------------------------------------------

export const allLinesInBlock = function*(
		block: string
		): Generator<string, void, void> {

	let start = 0
	let end = block.indexOf('\n')
	while (end !== -1) {
		yield block.substring(start, end)
		start = end + 1
		end = block.indexOf('\n', start)
	}
	if (start < block.length) {
		yield block.substring(start)
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * A string or string array
 */

export type blockSpec = string | string[]

export const isBlockSpec = (x: any): x is blockSpec => {

	return isString(x) || isArrayOfStrings(x)
}

// ---------------------------------------------------------------------------

/**
 * return an array as is, convert a multi-line string
 * to an array of single line strings
 */

export const toArray = (strOrArray: blockSpec): string[] => {

	if (Array.isArray(strOrArray)) {
		return strOrArray
	}
	else {
		return blockToArray(strOrArray)
	}
}

// ---------------------------------------------------------------------------

/**
 * convert an array of strings to a single multi-line string
 */

export const arrayToBlock = (lLines: string[]): string => {

	assert(isArray(lLines), `lLines is not an array: ${OL(lLines)}`)
	return lLines.filter((line) => defined(line)).join("\n")
}

// ---------------------------------------------------------------------------

/**
 * return a string as is, convert an array of strings
 * to a single multi-line string
 */

export const toBlock = (strOrArray: blockSpec): string => {

	if (isString(strOrArray)) {
		return strOrArray
	}
	else {
		return arrayToBlock(strOrArray)
	}
}

// ---------------------------------------------------------------------------

/**
 * replace these characters with single unicode chars:
 *    carriage return
 *    newline
 *    TAB
 *    space
 * Optionally, add a character to indicate a particular
 * position in the string
 * Valid options:
 *    offset - indicate position of offset
 *    poschar - char to use to indicate position
 */

export const escapeStr = (
	str: (string | undefined),
	hReplace: hash = {
		"\r": '←',
		"\n": '↓',
		"\t": '→',
		" ": '˳'
		},
	hOptions: hash = {}
	): string => {

	if (notdefined(str)) {
		return '<undefined>'
	}
	const {offset, poschar} = getOptions(hOptions, {
		offset: undef,
		poschar: '┊'
		})

	const lParts = []
	let i1 = 0;for (const ch of str.split('')) {const i = i1++;
		if (defined(offset) && (i === offset)) {
			lParts.push(poschar)
		}
		const newch = hReplace[ch]
		if (defined(newch)) {
			lParts.push(newch)
		}
		else {
			lParts.push(ch)
		}
	}
	if (offset === str.length) {
		lParts.push(poschar)
	}
	return lParts.join('')
}

// ---------------------------------------------------------------------------

/**
 * replace these characters with single unicode chars:
 *    carriage return
 *    TAB
 *    space
 * Optionally, add a character to indicate a particular
 * position in the string
 */

export const escapeBlock = (
	block: string,
	hReplace: hash = {
		"\r": '←',
		"\t": '→',
		" ": '˳'
		},
	hOptions: hash = {}
	): string => {

	return escapeStr(block, hReplace, hOptions)
}

// ---------------------------------------------------------------------------

export const relpath = (path: string): string => {

	return relative(Deno.cwd(), path).replaceAll('\\', '/')
}

// ---------------------------------------------------------------------------

/**
 * Splits a string on whitespace into an array,
 * ignoring any leading or trailing whitespace
 */

export const wsSplit = (str: string): string[] => {

	const newstr = str.trim()
	if (newstr === '') {
		return []
	}
	else {
		return newstr.split(/\s+/)
	}
}

// ---------------------------------------------------------------------------

/**
 * splits each string on whitespace ignoring any leading
 * or trailing whitespace, and returns an array of
 * all substrings obtained
 */

export const words = (...lStrings: string[]): string[] => {

	let lWords = []
	for (const str of lStrings) {
		for (const word of wsSplit(str)) {
			lWords.push(word)
		}
	}
	return lWords
}

// ---------------------------------------------------------------------------

/**
 * calculates the number of extra characters needed to
 * make the given string have the given length.
 * If not possible, returns 0
 */

export const getNExtra = (str: string, len: number): number => {

	const extra = len - str.length
	return (extra > 0) ? extra : 0
}

// ---------------------------------------------------------------------------

/**
 * pads the given string on the right with
 * the given character, to the given length
 */

export const rpad = (str: string, len: number, ch: string=' '): string => {

	assert((ch.length === 1), "Not a char")
	const extra = getNExtra(str, len)
	return str + ch.repeat(extra)
}

// ---------------------------------------------------------------------------

/**
 * pads the given string on the left with
 * the given character, to the given length
 */

export const lpad = (str: string, len: number, ch: string=' '): string => {

	assert((ch.length === 1), "Not a char")
	const extra = getNExtra(str, len)
	return ch.repeat(extra) + str
}

// ---------------------------------------------------------------------------
// --- valid options:
//        char - char to use on left and right
//        buffer - num spaces around text when char <> ' '

/**
 * pads the given string on both the left and right
 * with the given character, to the given length
 * but with the given number of buffer chars surrounding
 * the text
 */

export const centered = (
	text: string,
	width: number,
	char: string = ' ',
	numBuffer: number = 2
	): string => {

	const totSpaces = width - text.length
	if (totSpaces <= 0) {
		return text
	}
	const numLeft = Math.floor(totSpaces / 2)
	const numRight = totSpaces - numLeft
	if (char === ' ') {
		return spaces(numLeft) + text + spaces(numRight)
	}
	else {
		const buf = ' '.repeat(numBuffer)
		const left = char.repeat(numLeft - numBuffer)
		const right = char.repeat(numRight - numBuffer)
		return left + buf + text + buf + right
	}
}

// ---------------------------------------------------------------------------

/**
 * pad a string on the left, right, or both
 * to the given width
 */

export type alignment = 'l'|'c'|'r'|'left'|'center'|'right'

export const isAlignment = (x: any): x is alignment => {

	return ['l','c','r','left','center','right'].includes(x)
}

export const alignString = function(
	str: string,
	width: number,
	align: alignment
	): string {

	switch(align) {
		case 'left':case 'l': {
			return rpad(str, width)
		}
		case 'center':case 'c': {
			return centered(str, width)
		}
		case 'right':case 'r': {
			return lpad(str, width)
		}
	}
}

// ---------------------------------------------------------------------------

/**
 * converts the given number to a string, then pads on the left
 * with zeros to achieve the given length
 */

export const zpad = (n: number, len: number): string => {

	return lpad(n.toString(), len, '0')
}

// ---------------------------------------------------------------------------
// GENERATOR

export const allMatches = function*(str: string, re: RegExp): Generator<string[], void, void> {

	// --- Ensure the regex has the global flag (g) set
	const newre = new RegExp(re, re.flags + (re.flags.includes('g') ? '' : 'g'))
	let lMatches: string[] | null = null
	while (defined(lMatches = newre.exec(str))) {
  		yield lMatches
	}
	return
}

// ---------------------------------------------------------------------------
// GENERATOR

export type TNodeInfo = {
	node: any
	level: integer
	}

export class NodeGenerator {

	filter
	setYielded = new WeakSet<any>()

	constructor(filter1: FilterFunc = isNonPrimitive){this.filter = filter1;}

	*allNodes(
			obj: any,
			objLevel: integer = 0
			): Generator<TNodeInfo, void, void> {

		if (this.setYielded.has(obj)) {
			return
		}
		if (this.filter(obj)) {
			yield {
				node: obj,
				level: objLevel
				}
			this.setYielded.add(obj)
		}
		if (isArray(obj)) {
			for (const item of obj) {
				for (const {node, level} of this.allNodes(item, objLevel+1)) {
					yield {node, level}
					this.setYielded.add(node)
				}
			}
		}
		else if (isHash(obj)) {
			for (const key of Object.keys(obj)) {
				const value = obj[key]
				for (const {node, level} of this.allNodes(value, objLevel+1)) {
					yield {node, level}
					this.setYielded.add(node)
				}
			}
		}
		return
	}
}

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9sbHV0aWxzLmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvbGx1dGlscy5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxvQkFBbUI7QUFDbkIsQUFBQTtBQUNBLEssVyx5QjtBQUFBLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUI7QUFDdkMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXO0FBQ2xDLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLE1BQU0sQ0FBQztBQUNwQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLGdCQUFnQixDQUFDLENBQUMsZ0JBQWdCLENBQUM7QUFDckQsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLENBQUM7QUFDdkMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDdkQsQ0FBQyxjQUFjLENBQUM7QUFDaEIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLG9CQUFvQjtBQUM1QixBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQXdCLE1BQXhCLGVBQWUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3RDLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBVSxNQUFULFNBQVMsQ0FBQyxDQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFB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QUFBLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFFLENBQUMsS0FBSyxDQUFDLENBQUEsQ0FBQTtBQUNoQixBQUFBLEVBQUUsTUFBTSxDQUFDLE87Q0FBTyxDQUFBO0FBQ2hCLEFBQUEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFFLENBQUMsSUFBSSxDQUFDLENBQUEsQ0FBQTtBQUNwQixBQUFBLEVBQUUsTUFBTSxDQUFDLE07Q0FBTSxDQUFBO0FBQ2YsQUFBQSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFFLENBQUMsVUFBVSxDQUFDLENBQUEsQ0FBQTtBQUNqQyxBQUFBLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEM7Q0FBQyxDQUFBO0FBQzNDLEFBQUEsQ0FBQyxJQUFJLENBQUEsQ0FBQTtBQUNMLEFBQUEsRUFBSyxNQUFILEdBQUcsQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQztBQUNqRSxBQUFBLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLENBQUMsT0FBTyxDO0NBQUMsQztBQUFBLENBQUE7QUFDL0MsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFHLE1BQUYsRUFBRSxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ2hDLEFBQUE7QUFDQSxBQUFBLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFFLENBQUMs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QUksQ0FBQyxDQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDcEUsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFBO0FBQ3RDLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQztBQUM3QixBQUFBLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEM7QUFBQyxDQUFBO0FBQzlCLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUssTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3BFLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFBLEFBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQTtBQUN0QyxBQUFBLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUM7QUFDN0IsQUFBQSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMs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Q0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ3JELEFBQUEsS0FBSyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDeEIsQUFBQSxLQUFLLEksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFBLEFBQUMsSUFBSSxDO0lBQUEsQztHQUFBLEM7RUFBQSxDQUFBO0FBQ3pCLEFBQUEsRUFBRSxNO0NBQU0sQztBQUFBLENBQUE7QUFDUiIsIm5hbWVzIjpbXSwic291cmNlc0NvbnRlbnQiOlsiIyBsbHV0aWxzLmxpYi5jaXZldFxuXG5pbXBvcnQge3NwcmludGZ9IGZyb20gXCJAc3RkL2ZtdC9wcmludGZcIlxuaW1wb3J0IHtyZWxhdGl2ZX0gZnJvbSAnQHN0ZC9wYXRoJ1xuXG5pbXBvcnQge1xuXHR1bmRlZiwgZGVmaW5lZCwgbm90ZGVmaW5lZCwgYXNzZXJ0LFxuXHRpc0hhc2gsIGlzQXJyYXksIGlzTm9uRW1wdHlTdHJpbmcsIGlzQXJyYXlPZlN0cmluZ3MsXG5cdGlzRW1wdHksIG5vbkVtcHR5LCBpc1N0cmluZywgaXNPYmplY3QsXG5cdGludGVnZXIsIGhhc2gsIGFycmF5LCB2b2lkRnVuYywgRmlsdGVyRnVuYywgc3RyaW5naWZ5LFxuXHRpc05vblByaW1pdGl2ZSxcblx0fSBmcm9tICcuL2RhdGF0eXBlcy5saWIudHMnXG5cbi8qKlxuICogQG1vZHVsZSBsbHV0aWxzIC0gbG93IGxldmVsIHV0aWxpdGllc1xuICovXG5cbmxsdXRpbHNMb2FkVGltZTogaW50ZWdlciA6PSBEYXRlLm5vdygpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBzaW5jZUxvYWQgOj0gKGRhdGV0aW1lOiBpbnRlZ2VyPURhdGUubm93KCkpID0+XG5cblx0cmV0dXJuIChkYXRldGltZSAtIGxsdXRpbHNMb2FkVGltZSlcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHNpbmNlTG9hZFN0ciA6PSAoZGF0ZXRpbWU6IGludGVnZXI/PXVuZGVmKSA9PlxuXG5cdHJldHVybiBzcHJpbnRmKFwiJTZkXCIsIHNpbmNlTG9hZChkYXRldGltZSkpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogdGhyb3dzIGFuIGV4Y2VwdGlvbiB3aXRoIHRoZSBwcm92aWRlZCBtZXNzYWdlXG4gKi9cblxuZXhwb3J0IGNyb2FrIDo9IChtc2c6IHN0cmluZyk6IG5ldmVyID0+XG5cblx0dGhyb3cgbmV3IEVycm9yKG1zZylcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBBc3NlcnRzIHRoYXQgYGNvbmRgIGlzIHRydWUuIElmIGl0IGlzbid0LCBhbiBleGNlcHRpb24gaXNcbiAqIHRocm93biB3aXRoIHRoZSBnaXZlbiBgbXNnYFxuICovXG5cbmV4cG9ydCB0aHJvd3NFcnJvciA6PSAoZnVuYzogdm9pZEZ1bmMsIG1zZzogc3RyaW5nPVwiVW5leHBlY3RlZCBzdWNjZXNzXCIpOiB2b2lkID0+XG5cblx0dHJ5XG5cdFx0ZnVuYygpXG5cdFx0dGhyb3cgbmV3IEVycm9yKG1zZylcblx0Y2F0Y2ggZXJyXG5cdFx0cmV0dXJuICAgICMgaWdub3JlIGVycm9yIC0gaXQgd2FzIGV4cGVjdGVkXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogQ2FsbGluZyBwYXNzKCkgZG9lcyBub3RoaW5nXG4gKi9cblxuZXhwb3J0IHBhc3MgOj0gKCk6IHZvaWQgPT4gICAgIyBkbyBub3RoaW5nXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBkZWVwbHlFcXVhbHMgOj0gKGE6IGFueSwgYjogYW55KTogYm9vbGVhbiA9PlxuXG5cdGlmIChhID09IGIpXG5cdFx0cmV0dXJuIHRydWVcblxuXHRpZiAodHlwZW9mIGEgIT0gJ29iamVjdCcpIHx8IChhID09IG51bGwpIHx8ICh0eXBlb2YgYiAhPSAnb2JqZWN0JykgfHwgKGIgPT0gbnVsbClcblx0XHRyZXR1cm4gZmFsc2VcblxuXHRrZXlzQSA6PSBPYmplY3Qua2V5cyhhKVxuXHRrZXlzQiA6PSBPYmplY3Qua2V5cyhiKVxuXG5cdGlmIChrZXlzQS5sZW5ndGggIT0ga2V5c0IubGVuZ3RoKVxuXHRcdHJldHVybiBmYWxzZVxuXG5cdGZvciAoa2V5IG9mIGtleXNBKVxuXHRcdGlmIG5vdCBiLmhhc093blByb3BlcnR5KGtleSkgfHwgbm90IGRlZXBseUVxdWFscyhhW2tleV0sIGJba2V5XSlcblx0XHRcdHJldHVybiBmYWxzZVxuXHRyZXR1cm4gdHJ1ZVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIEpTT04gc3RyaW5naWZpZXMgeCBvbiBvbmUgbGluZVxuICogYnV0IGRpc3BsYXlzIGJvdGggdW5kZWZpbmVkIGFuZCBudWxsIGFzICd1bmRlZidcbiAqL1xuXG5leHBvcnQgT0wgOj0gKHg6IGFueSk6IHN0cmluZyA9PlxuXG5cdGlmICh4ID09IHVuZGVmKVxuXHRcdHJldHVybiAndW5kZWYnXG5cdGVsc2UgaWYgKHggPT0gbnVsbClcblx0XHRyZXR1cm4gJ251bGwnXG5cdGVsc2UgaWYgKHR5cGVvZiB4ID09ICdmdW5jdGlvbicpXG5cdFx0cmV0dXJuIHgudG9TdHJpbmcoKS5yZXBsYWNlQWxsKCdcXG4nLCAnICcpXG5cdGVsc2Vcblx0XHRzdHIgOj0gSlNPTi5zdHJpbmdpZnkoeCwgKGssdikgPT4gZGVmaW5lZCh2KSA/IHYgOiAnX191bmRlZl9fJylcblx0XHRyZXR1cm4gc3RyLnJlcGxhY2VBbGwoJ1wiX191bmRlZl9fXCInLCAndW5kZWYnKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgTUwgOj0gKHg6IGFueSk6IHN0cmluZyA9PlxuXG5cdGlmICh4ID09IHVuZGVmKVxuXHRcdHJldHVybiAndW5kZWYnXG5cdGVsc2UgaWYgKHggPT0gbnVsbClcblx0XHRyZXR1cm4gJ251bGwnXG5cdGVsc2UgaWYgKHR5cGVvZiB4ID09ICdmdW5jdGlvbicpXG5cdFx0cmV0dXJuIHgudG9TdHJpbmcoKVxuXHRlbHNlXG5cdFx0c3RyIDo9IEpTT04uc3RyaW5naWZ5KHgsIChrLHYpID0+IGRlZmluZWQodikgPyB2IDogJ19fdW5kZWZfXycsIDMpXG5cdFx0aWYgZGVmaW5lZChzdHIpXG5cdFx0XHRyZXR1cm4gc3RyLnJlcGxhY2VBbGwoJ1wiX191bmRlZl9fXCInLCAndW5kZWYnKVxuXHRcdGVsc2Vcblx0XHRcdGNvbnNvbGUubG9nIHhcblx0XHRcdHJldHVybiBcIkpTT04uc3RyaW5naWZ5IHJldHVybmVkIHVuZGVmISEhXCJcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBDb252ZXJ0cyB0aGUgZ2l2ZW4gc3RyaW5nIHRvIGEgaGFzaFxuICogPHdvcmQ+IGJlY29tZXMgYSBrZXkgd2l0aCBhIHRydWUgdmFsdWVcbiAqICE8d29yZD4gYmVjb21lcyBhIGtleXMgd2l0aCBhIGZhbHNlIHZhbHVlXG4gKiA8d29yZD49PHN0cmluZz4gYmVjb21lcyBhIGtleSB3aXRoIHZhbHVlIDxzdHJpbmc+XG4gKiAgICAtIDxzdHJpbmc+IG11c3QgYmUgcXVvdGVkIGlmIGl0IGNvbnRhaW5zIHdoaXRlc3BhY2VcbiAqL1xuXG5leHBvcnQgc3RyVG9IYXNoIDo9IChzdHI6IHN0cmluZyk6IGhhc2ggPT5cblxuXHRpZiBpc0VtcHR5KHN0cilcblx0XHRyZXR1cm4ge31cblx0aDogaGFzaCA6PSB7fVxuXHRmb3Igd29yZCBvZiBzdHIudHJpbSgpLnNwbGl0KC9cXHMrLylcblx0XHRpZiBsTWF0Y2hlczogc3RyaW5nW10gfCBudWxsIDo9IHdvcmQubWF0Y2goLy8vXlxuXHRcdFx0XHQoXFwhKT8gICAgICAgICAgICAgICAgICAgICMgbmVnYXRlIHZhbHVlXG5cdFx0XHRcdChbQS1aYS16XVtBLVphLXpfMC05XSopICAjIGlkZW50aWZpZXJcblx0XHRcdFx0KD86XG5cdFx0XHRcdFx0KD0pXG5cdFx0XHRcdFx0KC4qKVxuXHRcdFx0XHRcdCk/XG5cdFx0XHRcdCQvLy8pXG5cdFx0XHRbXywgbmVnLCBpZGVudCwgZXFTaWduLCBzdHJdIDo9IGxNYXRjaGVzXG5cdFx0XHRpZiBpc05vbkVtcHR5U3RyaW5nKGVxU2lnbilcblx0XHRcdFx0YXNzZXJ0IG5vdGRlZmluZWQobmVnKSB8fCAobmVnID09ICcnKSxcblx0XHRcdFx0XHRcdFwibmVnYXRpb24gd2l0aCBzdHJpbmcgdmFsdWVcIlxuXG5cdFx0XHRcdCMgLS0tIGNoZWNrIGlmIHN0ciBpcyBhIHZhbGlkIG51bWJlclxuXHRcdFx0XHRpZiBzdHIubWF0Y2goL14tP1xcZCsoXFwuXFxkKyk/JC8pXG5cdFx0XHRcdFx0bnVtIDo9IHBhcnNlRmxvYXQoc3RyKVxuXHRcdFx0XHRcdGlmIE51bWJlci5pc05hTihudW0pXG5cdFx0XHRcdFx0XHQjIC0tLSBUTyBETzogaW50ZXJwcmV0IGJhY2tzbGFzaCBlc2NhcGVzXG5cdFx0XHRcdFx0XHRoW2lkZW50XSA9IHN0clxuXHRcdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHRcdGhbaWRlbnRdID0gbnVtXG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHRoW2lkZW50XSA9IHN0clxuXHRcdFx0ZWxzZSBpZiBuZWdcblx0XHRcdFx0aFtpZGVudF0gPSBmYWxzZVxuXHRcdFx0ZWxzZVxuXHRcdFx0XHRoW2lkZW50XSA9IHRydWVcblx0XHRlbHNlXG5cdFx0XHRjcm9hayBcIkludmFsaWQgd29yZCAje09MKHdvcmQpfVwiXG5cdHJldHVybiBoXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBvIDo9IChsU3RyaW5nczogVGVtcGxhdGVTdHJpbmdzQXJyYXkpOiBoYXNoID0+XG5cblx0cmV0dXJuIHN0clRvSGFzaChsU3RyaW5nc1swXSlcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBBZGRzIGFueSBrZXlzIGluIGhEZWZhdWx0cyB0aGF0IGFyZSBtaXNzaW5nIGluIGhPcHRpb25zXG4gKiB0byBoT3B0aW9ucyB3aXRoIHRoZWlyIGdpdmVuIHZhbHVlc1xuICovXG5cbmV4cG9ydCBhZGREZWZhdWx0cyA6PSAoaE9wdGlvbnM6IGhhc2gsIGhEZWZhdWx0czogaGFzaCk6IGhhc2ggPT5cblxuXHRhc3NlcnQgaXNPYmplY3QoaE9wdGlvbnMpLCBcImhPcHRpb25zIG5vdCBhbiBvYmplY3Q6ICN7T0woaE9wdGlvbnMpfVwiXG5cdGFzc2VydCBpc09iamVjdChoRGVmYXVsdHMpLCBcImhEZWZhdWx0cyBub3QgYW4gb2JqZWN0OiAje09MKGhEZWZhdWx0cyl9XCJcblxuXHQjIC0tLSBGaWxsIGluIGRlZmF1bHRzIGZvciBtaXNzaW5nIHZhbHVlc1xuXHRmb3Iga2V5IG9mIE9iamVjdC5rZXlzKGhEZWZhdWx0cylcblx0XHR2YWx1ZSA6PSBoRGVmYXVsdHNba2V5XVxuXHRcdGlmIG5vdCBoT3B0aW9ucy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIGRlZmluZWQodmFsdWUpXG5cdFx0XHRoT3B0aW9uc1trZXldID0gdmFsdWVcblx0cmV0dXJuIGhPcHRpb25zXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyBhIGhhc2ggb2Ygb3B0aW9ucyB3aXRoIHRoZWlyIHZhbHVlcywgdXNpbmcgb3B0aW9uc1xuICogaWYgaXQncyBhIGhhc2gsIG9yIHBhcnNpbmcgb3B0aW9ucyB1c2luZyBzdHJUb0hhc2goKSBpZlxuICogaXQncyBhIHN0cmluZyAtIGFkZGluZyBhbnkgZGVmYXVsdCB2YWx1ZXMgZnJvbSBoRGVmYXVsdHNcbiAqIGlmIHRoZXkncmUgbWlzc2luZyBpbiB0aGUgcmVzdWx0aW5nIGhhc2hcbiAqL1xuXG5leHBvcnQgZ2V0T3B0aW9ucyA6PSAoaE9wdGlvbnM6IGhhc2g9e30sIGhEZWZhdWx0czogaGFzaD17fSk6IGhhc2ggPT5cblxuXHRyZXR1cm4gYWRkRGVmYXVsdHMgaE9wdGlvbnMsIGhEZWZhdWx0c1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJlbW92ZSBhbGwga2V5cyBmcm9tIGEgaGFzaCB0aGF0IGhhdmUgZWl0aGVyIGFuIGVtcHR5IG5hbWVcbiAqIG9yIGFuIGVtcHR5IHZhbHVlXG4gKi9cblxuZXhwb3J0IHJlbW92ZUVtcHR5S2V5cyA6PSAoaDogaGFzaCk6IGhhc2ggPT5cblxuXHRoUmVzdWx0OiBoYXNoIDo9IHt9XG5cdGZvciBrZXkgb2Yga2V5cyhoKVxuXHRcdGlmIG5vbkVtcHR5KGtleSkgJiYgbm9uRW1wdHkoaFtrZXldKVxuXHRcdFx0aFJlc3VsdFtrZXldID0gaFtrZXldXG5cdHJldHVybiBoUmVzdWx0XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJuIGFuIGFycmF5IG9mIGFsbCBvd24ga2V5cyBpbiBhIGhhc2hcbiAqL1xuXG5leHBvcnQga2V5cyA6PSAob2JqOiBoYXNoLCBoT3B0aW9uczogaGFzaD17fSk6IHN0cmluZ1tdID0+XG5cblx0aCA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0ZXhjZXB0OiBbXVxuXHRcdH1cblxuXHRsZXQgZXhjZXB0ID0gaC5leGNlcHRcblxuXHRpZiBpc1N0cmluZyhleGNlcHQpXG5cdFx0ZXhjZXB0ID0gW2V4Y2VwdF1cblx0bEtleXM6IHN0cmluZ1tdIDo9IFtdXG5cdGZvciBrZXkgb2YgT2JqZWN0LmtleXMob2JqKVxuXHRcdGlmIG5vdCBleGNlcHQuaW5jbHVkZXMoa2V5KVxuXHRcdFx0bEtleXMucHVzaCBrZXlcblx0cmV0dXJuIGxLZXlzXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyB0cnVlIGlmIGVpdGhlciBgaGAgaXMgbm90IGRlZmluZWQsIG9yIGlmIGBoYCBpc1xuICogYSBoYXNoIHRoYXQgaW5jbHVkZXMgYWxsIHRoZSBrZXlzIHByb3ZpZGVkXG4gKi9cblxuZXhwb3J0IGhhc0tleSA6PSAoaDogaGFzaCwgLi4ubEtleXM6IHN0cmluZ1tdKTogYm9vbGVhbiA9PlxuXG5cdGlmIG5vdGRlZmluZWQoaClcblx0XHRyZXR1cm4gZmFsc2Vcblx0YXNzZXJ0IGlzSGFzaChoKSwgXCJoIG5vdCBhIGhhc2g6ICN7T0woaCl9XCJcblx0Zm9yIGtleSBvZiBsS2V5c1xuXHRcdGFzc2VydCBpc1N0cmluZyhrZXkpLCBcImtleSBub3QgYSBzdHJpbmc6ICN7T0woa2V5KX1cIlxuXHRcdGlmIG5vdCBoLmhhc093blByb3BlcnR5KGtleSlcblx0XHRcdHJldHVybiBmYWxzZVxuXHRyZXR1cm4gdHJ1ZVxuXG5leHBvcnQgaGFzS2V5cyA6PSBoYXNLZXlcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IG1pc3NpbmdLZXlzIDo9IChoOiBoYXNoLCAuLi5sS2V5czogc3RyaW5nW10pOiBzdHJpbmdbXSA9PlxuXG5cdGlmIG5vdGRlZmluZWQoaClcblx0XHRyZXR1cm4gbEtleXNcblx0YXNzZXJ0IGlzSGFzaChoKSwgXCJoIG5vdCBhIGhhc2g6ICN7T0woaCl9XCJcblx0bE1pc3Npbmc6IHN0cmluZ1tdIDo9IFtdXG5cdGZvciBrZXkgb2YgbEtleXNcblx0XHRpZiBub3QgaC5oYXNPd25Qcm9wZXJ0eShrZXkpXG5cdFx0XHRsTWlzc2luZy5wdXNoIGtleVxuXHRyZXR1cm4gbE1pc3NpbmdcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBtZXJnZXMgdGhlIHByb3ZpZGVkIG9iamVjdHMgaW50byBhIG5ldyBvYmplY3RcbiAqIE5PVEU6IG5vbmUgb2YgdGhlIHByb3ZpZGVkIGFyZ3VtZW50cyBhcmUgbW9kaWZpZWRcbiAqL1xuXG5leHBvcnQgbWVyZ2UgOj0gKC4uLmxPYmplY3RzOiBoYXNoW10pOiBoYXNoID0+XG5cblx0cmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIGxPYmplY3RzLi4uKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgaGl0IDo9IChwY3Q6IG51bWJlciA9IDUwKTogYm9vbGVhbiA9PlxuXG5cdHJldHVybiAoMTAwICogTWF0aC5yYW5kb20oKSA8IHBjdClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIEFTWU5DICFcblxuZXhwb3J0IHNsZWVwIDo9IChzZWM6IG51bWJlcik6IHZvaWQgPT5cblxuXHRhd2FpdCBuZXcgUHJvbWlzZSgocikgPT4gc2V0VGltZW91dChyLCAxMDAwICogc2VjKSlcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyBhIHN0cmluZyBjb25zaXN0aW5nIG9mIHRoZSBnaXZlbiBudW1iZXJcbiAqIG9mIHNwYWNlIGNoYXJhY3RlcnNcbiAqL1xuXG5leHBvcnQgc3BhY2VzIDo9IChuOiBudW1iZXIpOiBzdHJpbmcgPT5cblxuXHRyZXR1cm4gXCIgXCIucmVwZWF0KG4pXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyBhIHN0cmluZyBjb25zaXN0aW5nIG9mIHRoZSBnaXZlbiBudW1iZXJcbiAqIG9mIFRBQiBjaGFyYWN0ZXJzXG4gKi9cblxuZXhwb3J0IHRhYnMgOj0gKG46IG51bWJlcik6IHN0cmluZyA9PlxuXG5cdHJldHVybiBcIlxcdFwiLnJlcGVhdChuKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJ0cmltIC0gc3RyaXAgdHJhaWxpbmcgd2hpdGVzcGFjZVxuICovXG5cbmV4cG9ydCBydHJpbSA6PSAobGluZTogc3RyaW5nKTogc3RyaW5nID0+XG5cblx0YXNzZXJ0IGlzU3RyaW5nKGxpbmUpLCBcIm5vdCBhIHN0cmluZzogI3t0eXBlb2YgbGluZX1cIlxuXHRsTWF0Y2hlcyA6PSBsaW5lLm1hdGNoKC9eKC4qPylcXHMrJC8pXG5cdHJldHVybiAobE1hdGNoZXMgPT0gbnVsbCkgPyBsaW5lIDogbE1hdGNoZXNbMV1cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBDb3VudCB0aGUgbnVtYmVyIG9mIGEgc3BlY2lmaWMgY2hhcmFjdGVyIGluIGEgc3RyaW5nXG4gKi9cblxuZXhwb3J0IGNvdW50Q2hhcnMgOj0gKHN0cjogc3RyaW5nLCBjaDogc3RyaW5nKTogbnVtYmVyID0+XG5cblx0bGV0IGNvdW50ID0gMFxuXHRsZXQgcG9zID0gLTFcblx0d2hpbGUgKHBvcyA9IHN0ci5pbmRleE9mKGNoLCBwb3MrMSkpICE9IC0xXG5cdFx0Y291bnQgKz0gMVxuXHRyZXR1cm4gY291bnRcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBjb252ZXJ0IGEgbXVsdGktbGluZSBzdHJpbmcgdG8gYW4gYXJyYXlcbiAqIG9mIHNpbmdsZSBsaW5lIHN0cmluZ3NcbiAqL1xuXG5leHBvcnQgYmxvY2tUb0FycmF5IDo9IChibG9jazogc3RyaW5nKTogc3RyaW5nW10gPT5cblxuXHRpZiBpc0VtcHR5KGJsb2NrKVxuXHRcdHJldHVybiBbXVxuXHRlbHNlXG5cdFx0cmV0dXJuIGJsb2NrLnNwbGl0KC9cXHI/XFxuLylcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGFsbExpbmVzSW5CbG9jayA6PSAoXG5cdFx0YmxvY2s6IHN0cmluZ1xuXHRcdCk6IEdlbmVyYXRvcjxzdHJpbmcsIHZvaWQsIHZvaWQ+IC0+XG5cblx0bGV0IHN0YXJ0ID0gMFxuXHRsZXQgZW5kID0gYmxvY2suaW5kZXhPZignXFxuJylcblx0d2hpbGUgKGVuZCAhPSAtMSlcblx0XHR5aWVsZCBibG9jay5zdWJzdHJpbmcoc3RhcnQsIGVuZClcblx0XHRzdGFydCA9IGVuZCArIDFcblx0XHRlbmQgPSBibG9jay5pbmRleE9mKCdcXG4nLCBzdGFydClcblx0aWYgKHN0YXJ0IDwgYmxvY2subGVuZ3RoKVxuXHRcdHlpZWxkIGJsb2NrLnN1YnN0cmluZyhzdGFydClcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogQSBzdHJpbmcgb3Igc3RyaW5nIGFycmF5XG4gKi9cblxuZXhwb3J0IHR5cGUgYmxvY2tTcGVjID0gc3RyaW5nIHwgc3RyaW5nW11cblxuZXhwb3J0IGlzQmxvY2tTcGVjIDo9ICh4OiBhbnkpOiB4IGlzIGJsb2NrU3BlYyA9PlxuXG5cdHJldHVybiBpc1N0cmluZyh4KSB8fCBpc0FycmF5T2ZTdHJpbmdzKHgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJuIGFuIGFycmF5IGFzIGlzLCBjb252ZXJ0IGEgbXVsdGktbGluZSBzdHJpbmdcbiAqIHRvIGFuIGFycmF5IG9mIHNpbmdsZSBsaW5lIHN0cmluZ3NcbiAqL1xuXG5leHBvcnQgdG9BcnJheSA6PSAoc3RyT3JBcnJheTogYmxvY2tTcGVjKTogc3RyaW5nW10gPT5cblxuXHRpZiBBcnJheS5pc0FycmF5KHN0ck9yQXJyYXkpXG5cdFx0cmV0dXJuIHN0ck9yQXJyYXlcblx0ZWxzZVxuXHRcdHJldHVybiBibG9ja1RvQXJyYXkoc3RyT3JBcnJheSlcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBjb252ZXJ0IGFuIGFycmF5IG9mIHN0cmluZ3MgdG8gYSBzaW5nbGUgbXVsdGktbGluZSBzdHJpbmdcbiAqL1xuXG5leHBvcnQgYXJyYXlUb0Jsb2NrIDo9IChsTGluZXM6IHN0cmluZ1tdKTogc3RyaW5nID0+XG5cblx0YXNzZXJ0IGlzQXJyYXkobExpbmVzKSwgXCJsTGluZXMgaXMgbm90IGFuIGFycmF5OiAje09MKGxMaW5lcyl9XCJcblx0cmV0dXJuIGxMaW5lcy5maWx0ZXIoKGxpbmUpID0+IGRlZmluZWQobGluZSkpLmpvaW4oXCJcXG5cIilcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm4gYSBzdHJpbmcgYXMgaXMsIGNvbnZlcnQgYW4gYXJyYXkgb2Ygc3RyaW5nc1xuICogdG8gYSBzaW5nbGUgbXVsdGktbGluZSBzdHJpbmdcbiAqL1xuXG5leHBvcnQgdG9CbG9jayA6PSAoc3RyT3JBcnJheTogYmxvY2tTcGVjKTogc3RyaW5nID0+XG5cblx0aWYgaXNTdHJpbmcoc3RyT3JBcnJheSlcblx0XHRyZXR1cm4gc3RyT3JBcnJheVxuXHRlbHNlXG5cdFx0cmV0dXJuIGFycmF5VG9CbG9jayhzdHJPckFycmF5KVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJlcGxhY2UgdGhlc2UgY2hhcmFjdGVycyB3aXRoIHNpbmdsZSB1bmljb2RlIGNoYXJzOlxuICogICAgY2FycmlhZ2UgcmV0dXJuXG4gKiAgICBuZXdsaW5lXG4gKiAgICBUQUJcbiAqICAgIHNwYWNlXG4gKiBPcHRpb25hbGx5LCBhZGQgYSBjaGFyYWN0ZXIgdG8gaW5kaWNhdGUgYSBwYXJ0aWN1bGFyXG4gKiBwb3NpdGlvbiBpbiB0aGUgc3RyaW5nXG4gKiBWYWxpZCBvcHRpb25zOlxuICogICAgb2Zmc2V0IC0gaW5kaWNhdGUgcG9zaXRpb24gb2Ygb2Zmc2V0XG4gKiAgICBwb3NjaGFyIC0gY2hhciB0byB1c2UgdG8gaW5kaWNhdGUgcG9zaXRpb25cbiAqL1xuXG5leHBvcnQgZXNjYXBlU3RyIDo9IChcblx0c3RyOiBzdHJpbmc/LFxuXHRoUmVwbGFjZTogaGFzaCA9IHtcblx0XHRcIlxcclwiOiAn4oaQJ1xuXHRcdFwiXFxuXCI6ICfihpMnXG5cdFx0XCJcXHRcIjogJ+KGkidcblx0XHRcIiBcIjogJ8uzJ1xuXHRcdH0sXG5cdGhPcHRpb25zOiBoYXNoID0ge31cblx0KTogc3RyaW5nID0+XG5cblx0aWYgbm90ZGVmaW5lZChzdHIpXG5cdFx0cmV0dXJuICc8dW5kZWZpbmVkPidcblx0e29mZnNldCwgcG9zY2hhcn0gOj0gZ2V0T3B0aW9ucyBoT3B0aW9ucywge1xuXHRcdG9mZnNldDogdW5kZWZcblx0XHRwb3NjaGFyOiAn4pSKJ1xuXHRcdH1cblxuXHRsUGFydHMgOj0gW11cblx0Zm9yIGNoLGkgb2Ygc3RyLnNwbGl0KCcnKVxuXHRcdGlmIGRlZmluZWQob2Zmc2V0KSAmJiAoaSA9PSBvZmZzZXQpXG5cdFx0XHRsUGFydHMucHVzaCBwb3NjaGFyXG5cdFx0bmV3Y2ggOj0gaFJlcGxhY2VbY2hdXG5cdFx0aWYgZGVmaW5lZChuZXdjaClcblx0XHRcdGxQYXJ0cy5wdXNoIG5ld2NoXG5cdFx0ZWxzZVxuXHRcdFx0bFBhcnRzLnB1c2ggY2hcblx0aWYgKG9mZnNldCA9PSBzdHIubGVuZ3RoKVxuXHRcdGxQYXJ0cy5wdXNoIHBvc2NoYXJcblx0cmV0dXJuIGxQYXJ0cy5qb2luKCcnKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJlcGxhY2UgdGhlc2UgY2hhcmFjdGVycyB3aXRoIHNpbmdsZSB1bmljb2RlIGNoYXJzOlxuICogICAgY2FycmlhZ2UgcmV0dXJuXG4gKiAgICBUQUJcbiAqICAgIHNwYWNlXG4gKiBPcHRpb25hbGx5LCBhZGQgYSBjaGFyYWN0ZXIgdG8gaW5kaWNhdGUgYSBwYXJ0aWN1bGFyXG4gKiBwb3NpdGlvbiBpbiB0aGUgc3RyaW5nXG4gKi9cblxuZXhwb3J0IGVzY2FwZUJsb2NrIDo9IChcblx0YmxvY2s6IHN0cmluZyxcblx0aFJlcGxhY2U6IGhhc2ggPSB7XG5cdFx0XCJcXHJcIjogJ+KGkCdcblx0XHRcIlxcdFwiOiAn4oaSJ1xuXHRcdFwiIFwiOiAny7MnXG5cdFx0fSxcblx0aE9wdGlvbnM6IGhhc2ggPSB7fVxuXHQpOiBzdHJpbmcgPT5cblxuXHRyZXR1cm4gZXNjYXBlU3RyKGJsb2NrLCBoUmVwbGFjZSwgaE9wdGlvbnMpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCByZWxwYXRoIDo9IChwYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT5cblxuXHRyZXR1cm4gcmVsYXRpdmUoRGVuby5jd2QoKSwgcGF0aCkucmVwbGFjZUFsbCgnXFxcXCcsICcvJylcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBTcGxpdHMgYSBzdHJpbmcgb24gd2hpdGVzcGFjZSBpbnRvIGFuIGFycmF5LFxuICogaWdub3JpbmcgYW55IGxlYWRpbmcgb3IgdHJhaWxpbmcgd2hpdGVzcGFjZVxuICovXG5cbmV4cG9ydCB3c1NwbGl0IDo9IChzdHI6IHN0cmluZyk6IHN0cmluZ1tdID0+XG5cblx0bmV3c3RyIDo9IHN0ci50cmltKClcblx0aWYgKG5ld3N0ciA9PSAnJylcblx0XHRyZXR1cm4gW11cblx0ZWxzZVxuXHRcdHJldHVybiBuZXdzdHIuc3BsaXQoL1xccysvKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHNwbGl0cyBlYWNoIHN0cmluZyBvbiB3aGl0ZXNwYWNlIGlnbm9yaW5nIGFueSBsZWFkaW5nXG4gKiBvciB0cmFpbGluZyB3aGl0ZXNwYWNlLCBhbmQgcmV0dXJucyBhbiBhcnJheSBvZlxuICogYWxsIHN1YnN0cmluZ3Mgb2J0YWluZWRcbiAqL1xuXG5leHBvcnQgd29yZHMgOj0gKC4uLmxTdHJpbmdzOiBzdHJpbmdbXSk6IHN0cmluZ1tdID0+XG5cblx0bGV0IGxXb3JkcyA9IFtdXG5cdGZvciBzdHIgb2YgbFN0cmluZ3Ncblx0XHRmb3Igd29yZCBvZiB3c1NwbGl0KHN0cilcblx0XHRcdGxXb3Jkcy5wdXNoIHdvcmRcblx0cmV0dXJuIGxXb3Jkc1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIGNhbGN1bGF0ZXMgdGhlIG51bWJlciBvZiBleHRyYSBjaGFyYWN0ZXJzIG5lZWRlZCB0b1xuICogbWFrZSB0aGUgZ2l2ZW4gc3RyaW5nIGhhdmUgdGhlIGdpdmVuIGxlbmd0aC5cbiAqIElmIG5vdCBwb3NzaWJsZSwgcmV0dXJucyAwXG4gKi9cblxuZXhwb3J0IGdldE5FeHRyYSA6PSAoc3RyOiBzdHJpbmcsIGxlbjogbnVtYmVyKTogbnVtYmVyID0+XG5cblx0ZXh0cmEgOj0gbGVuIC0gc3RyLmxlbmd0aFxuXHRyZXR1cm4gKGV4dHJhID4gMCkgPyBleHRyYSA6IDBcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBwYWRzIHRoZSBnaXZlbiBzdHJpbmcgb24gdGhlIHJpZ2h0IHdpdGhcbiAqIHRoZSBnaXZlbiBjaGFyYWN0ZXIsIHRvIHRoZSBnaXZlbiBsZW5ndGhcbiAqL1xuXG5leHBvcnQgcnBhZCA6PSAoc3RyOiBzdHJpbmcsIGxlbjogbnVtYmVyLCBjaDogc3RyaW5nPScgJyk6IHN0cmluZyA9PlxuXG5cdGFzc2VydCAoY2gubGVuZ3RoID09IDEpLCBcIk5vdCBhIGNoYXJcIlxuXHRleHRyYSA6PSBnZXRORXh0cmEoc3RyLCBsZW4pXG5cdHJldHVybiBzdHIgKyBjaC5yZXBlYXQoZXh0cmEpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcGFkcyB0aGUgZ2l2ZW4gc3RyaW5nIG9uIHRoZSBsZWZ0IHdpdGhcbiAqIHRoZSBnaXZlbiBjaGFyYWN0ZXIsIHRvIHRoZSBnaXZlbiBsZW5ndGhcbiAqL1xuXG5leHBvcnQgbHBhZCA6PSAoc3RyOiBzdHJpbmcsIGxlbjogbnVtYmVyLCBjaDogc3RyaW5nPScgJyk6IHN0cmluZyA9PlxuXG5cdGFzc2VydCAoY2gubGVuZ3RoID09IDEpLCBcIk5vdCBhIGNoYXJcIlxuXHRleHRyYSA6PSBnZXRORXh0cmEoc3RyLCBsZW4pXG5cdHJldHVybiBjaC5yZXBlYXQoZXh0cmEpICsgc3RyXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jIC0tLSB2YWxpZCBvcHRpb25zOlxuIyAgICAgICAgY2hhciAtIGNoYXIgdG8gdXNlIG9uIGxlZnQgYW5kIHJpZ2h0XG4jICAgICAgICBidWZmZXIgLSBudW0gc3BhY2VzIGFyb3VuZCB0ZXh0IHdoZW4gY2hhciA8PiAnICdcblxuLyoqXG4gKiBwYWRzIHRoZSBnaXZlbiBzdHJpbmcgb24gYm90aCB0aGUgbGVmdCBhbmQgcmlnaHRcbiAqIHdpdGggdGhlIGdpdmVuIGNoYXJhY3RlciwgdG8gdGhlIGdpdmVuIGxlbmd0aFxuICogYnV0IHdpdGggdGhlIGdpdmVuIG51bWJlciBvZiBidWZmZXIgY2hhcnMgc3Vycm91bmRpbmdcbiAqIHRoZSB0ZXh0XG4gKi9cblxuZXhwb3J0IGNlbnRlcmVkIDo9IChcblx0dGV4dDogc3RyaW5nLFxuXHR3aWR0aDogbnVtYmVyLFxuXHRjaGFyOiBzdHJpbmcgPSAnICcsXG5cdG51bUJ1ZmZlcjogbnVtYmVyID0gMlxuXHQpOiBzdHJpbmcgPT5cblxuXHR0b3RTcGFjZXMgOj0gd2lkdGggLSB0ZXh0Lmxlbmd0aFxuXHRpZiAodG90U3BhY2VzIDw9IDApXG5cdFx0cmV0dXJuIHRleHRcblx0bnVtTGVmdCA6PSBNYXRoLmZsb29yKHRvdFNwYWNlcyAvIDIpXG5cdG51bVJpZ2h0IDo9IHRvdFNwYWNlcyAtIG51bUxlZnRcblx0aWYgKGNoYXIgPT0gJyAnKVxuXHRcdHJldHVybiBzcGFjZXMobnVtTGVmdCkgKyB0ZXh0ICsgc3BhY2VzKG51bVJpZ2h0KVxuXHRlbHNlXG5cdFx0YnVmIDo9ICcgJy5yZXBlYXQobnVtQnVmZmVyKVxuXHRcdGxlZnQgOj0gY2hhci5yZXBlYXQobnVtTGVmdCAtIG51bUJ1ZmZlcilcblx0XHRyaWdodCA6PSBjaGFyLnJlcGVhdChudW1SaWdodCAtIG51bUJ1ZmZlcilcblx0XHRyZXR1cm4gbGVmdCArIGJ1ZiArIHRleHQgKyBidWYgKyByaWdodFxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHBhZCBhIHN0cmluZyBvbiB0aGUgbGVmdCwgcmlnaHQsIG9yIGJvdGhcbiAqIHRvIHRoZSBnaXZlbiB3aWR0aFxuICovXG5cbmV4cG9ydCB0eXBlIGFsaWdubWVudCA9ICdsJ3wnYyd8J3InfCdsZWZ0J3wnY2VudGVyJ3wncmlnaHQnXG5cbmV4cG9ydCBpc0FsaWdubWVudCA6PSAoeDogYW55KTogeCBpcyBhbGlnbm1lbnQgPT5cblxuXHRyZXR1cm4gWydsJywnYycsJ3InLCdsZWZ0JywnY2VudGVyJywncmlnaHQnXS5pbmNsdWRlcyh4KVxuXG5leHBvcnQgYWxpZ25TdHJpbmcgOj0gKFxuXHRzdHI6IHN0cmluZyxcblx0d2lkdGg6IG51bWJlcixcblx0YWxpZ246IGFsaWdubWVudFxuXHQpOiBzdHJpbmcgLT5cblxuXHRzd2l0Y2ggYWxpZ25cblx0XHR3aGVuICdsZWZ0JywgJ2wnXG5cdFx0XHRyZXR1cm4gcnBhZChzdHIsIHdpZHRoKVxuXHRcdHdoZW4gJ2NlbnRlcicsICdjJ1xuXHRcdFx0cmV0dXJuIGNlbnRlcmVkKHN0ciwgd2lkdGgpXG5cdFx0d2hlbiAncmlnaHQnLCAncidcblx0XHRcdHJldHVybiBscGFkKHN0ciwgd2lkdGgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogY29udmVydHMgdGhlIGdpdmVuIG51bWJlciB0byBhIHN0cmluZywgdGhlbiBwYWRzIG9uIHRoZSBsZWZ0XG4gKiB3aXRoIHplcm9zIHRvIGFjaGlldmUgdGhlIGdpdmVuIGxlbmd0aFxuICovXG5cbmV4cG9ydCB6cGFkIDo9IChuOiBudW1iZXIsIGxlbjogbnVtYmVyKTogc3RyaW5nID0+XG5cblx0cmV0dXJuIGxwYWQobi50b1N0cmluZygpLCBsZW4sICcwJylcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgR0VORVJBVE9SXG5cbmV4cG9ydCBhbGxNYXRjaGVzIDo9IChzdHI6IHN0cmluZywgcmU6IFJlZ0V4cCk6IEdlbmVyYXRvcjxzdHJpbmdbXSwgdm9pZCwgdm9pZD4gLT5cblxuXHQjIC0tLSBFbnN1cmUgdGhlIHJlZ2V4IGhhcyB0aGUgZ2xvYmFsIGZsYWcgKGcpIHNldFxuXHRuZXdyZSA6PSBuZXcgUmVnRXhwKHJlLCByZS5mbGFncyArIChyZS5mbGFncy5pbmNsdWRlcygnZycpID8gJycgOiAnZycpKVxuXHRsZXQgbE1hdGNoZXM6IHN0cmluZ1tdIHwgbnVsbCA9IG51bGxcblx0d2hpbGUgZGVmaW5lZChsTWF0Y2hlcyA9IG5ld3JlLmV4ZWMoc3RyKSlcbiAgXHRcdHlpZWxkIGxNYXRjaGVzXG5cdHJldHVyblxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyBHRU5FUkFUT1JcblxuZXhwb3J0IHR5cGUgVE5vZGVJbmZvID0ge1xuXHRub2RlOiBhbnlcblx0bGV2ZWw6IGludGVnZXJcblx0fVxuXG5leHBvcnQgY2xhc3MgTm9kZUdlbmVyYXRvclxuXG5cdGZpbHRlclxuXHRzZXRZaWVsZGVkID0gbmV3IFdlYWtTZXQ8YW55PigpXG5cblx0Y29uc3RydWN0b3IoQGZpbHRlcjogRmlsdGVyRnVuYyA9IGlzTm9uUHJpbWl0aXZlKVxuXG5cdGFsbE5vZGVzKFxuXHRcdFx0b2JqOiBhbnlcblx0XHRcdG9iakxldmVsOiBpbnRlZ2VyID0gMFxuXHRcdFx0KTogR2VuZXJhdG9yPFROb2RlSW5mbywgdm9pZCwgdm9pZD5cblxuXHRcdGlmIEBzZXRZaWVsZGVkLmhhcyhvYmopXG5cdFx0XHRyZXR1cm5cblx0XHRpZiBAZmlsdGVyKG9iailcblx0XHRcdHlpZWxkIHtcblx0XHRcdFx0bm9kZTogb2JqLFxuXHRcdFx0XHRsZXZlbDogb2JqTGV2ZWxcblx0XHRcdFx0fVxuXHRcdFx0QHNldFlpZWxkZWQuYWRkIG9ialxuXHRcdGlmIGlzQXJyYXkob2JqKVxuXHRcdFx0Zm9yIGl0ZW0gb2Ygb2JqXG5cdFx0XHRcdGZvciB7bm9kZSwgbGV2ZWx9IG9mIEBhbGxOb2RlcyhpdGVtLCBvYmpMZXZlbCsxKVxuXHRcdFx0XHRcdHlpZWxkIHtub2RlLCBsZXZlbH1cblx0XHRcdFx0XHRAc2V0WWllbGRlZC5hZGQgbm9kZVxuXHRcdGVsc2UgaWYgaXNIYXNoKG9iailcblx0XHRcdGZvciBrZXkgb2YgT2JqZWN0LmtleXMob2JqKVxuXHRcdFx0XHR2YWx1ZSA6PSBvYmpba2V5XVxuXHRcdFx0XHRmb3Ige25vZGUsIGxldmVsfSBvZiBAYWxsTm9kZXModmFsdWUsIG9iakxldmVsKzEpXG5cdFx0XHRcdFx0eWllbGQge25vZGUsIGxldmVsfVxuXHRcdFx0XHRcdEBzZXRZaWVsZGVkLmFkZCBub2RlXG5cdFx0cmV0dXJuXG4iXX0=