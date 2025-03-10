"use strict";
// llutils.civet

type AutoPromise<T> = Promise<Awaited<T>>;
import {sprintf} from "@std/fmt/printf"

import {
	undef, defined, notdefined,
	isHash, isArray, isNonEmptyString,
	isEmpty, nonEmpty, isString, isObject,
	integer, hash, voidFunc, optionspec,
	} from './datatypes.ts'

const llutilsLoadTime: integer = Date.now()

// ---------------------------------------------------------------------------

export const sinceLoad = () => {

	return Date.now() - llutilsLoadTime
}

// ---------------------------------------------------------------------------

export const sinceLoadStr = () => {

	return sprintf("%5d", sinceLoad())
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

export const assert = (cond: boolean, msg: string): void => {

	if (!cond) {
		croak(msg)
	}
	return
}

// ---------------------------------------------------------------------------

/**
 * Calling pass() does nothing
 */

export var pass = (): void => {}    // do nothing

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
	else {
		return JSON.stringify(x)
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
	else {
		return JSON.stringify(x, null, 3)
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

	assert(isNonEmptyString(str), `Bad string: ${OL(str)}`)
	const h: hash = {}
	for (const word of str.split(/\s+/)) {
		let ref: string[] | null;if ((ref = word.match(/^(\!)?([A-Za-z][A-Za-z_0-9]*)(?:(=)(.*))?$/))) {const lMatches: string[] | null = ref;
			const [_, neg, ident, eqSign, str] = lMatches
			if (isNonEmptyString(eqSign)) {
				assert(notdefined(neg) || (neg === ''),
						"negation with string value")

				// --- check if str is a valid number
				const num = parseFloat(str)
				if (Number.isNaN(num)) {
					// --- TO DO: interpret backslash escapes
					h[ident] = str
				}
				else {
					h[ident] = num
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

export const getOptions = (options: optionspec={}, hDefaults: hash={}): hash => {

	const hOptions: hash = isString(options) ? strToHash(options) : options
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

export const keys = (obj: hash, hOptions: optionspec={}): string[] => {

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

export var spaces = (n: number): string => {

	return " ".repeat(n)
}

// ---------------------------------------------------------------------------

/**
 * returns a string consisting of the given number
 * of TAB characters
 */

export var tabs = (n: number): string => {

	return "\t".repeat(n)
}

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9sbHV0aWxzLmNpdmV0LnRzeCIsInNvdXJjZXMiOlsic3JjL2xpYi9sbHV0aWxzLmNpdmV0Il0sIm1hcHBpbmdzIjoiO0FBQUEsZ0JBQWU7QUFDZixBQUFBO0FBQ0EsSyxXLHlCO0FBQUEsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLGlCQUFpQjtBQUN2QyxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUM7QUFDNUIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQztBQUNuQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUN2QyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFVBQVUsQ0FBQztBQUNyQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCO0FBQ3hCLEFBQUE7QUFDQSxBQUFBLEFBQXdCLE1BQXhCLGVBQWUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3RDLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBVSxNQUFULFNBQVMsQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDekIsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGU7QUFBZSxDQUFBO0FBQ3BDLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBYSxNQUFaLFlBQVksQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDNUIsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEM7QUFBQyxDQUFBO0FBQ25DLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3ZDLEFBQUE7QUFDQSxBQUFBLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDO0FBQUMsQ0FBQTtBQUNyQixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFPLE1BQU4sTUFBTSxDQUFDLENBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3RELEFBQUE7QUFDQSxBQUFBLENBQUMsR0FBRyxDQUFBLENBQUMsSUFBSSxDQUFBLENBQUEsQ0FBQTtBQUNULEFBQUEsRUFBRSxLQUFLLENBQUEsQUFBQyxHQUFHLEM7Q0FBQSxDQUFBO0FBQ1gsQUFBQSxDQUFDLE07QUFBTSxDQUFBO0FBQ1AsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsSUFBQSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFBLENBQUEsSUFBSSxhQUFZO0FBQ3pDLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUcsTUFBRixFQUFFLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDaEMsQUFBQTtBQUNBLEFBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQSxDQUFBO0FBQ2hCLEFBQUEsRUFBRSxNQUFNLENBQUMsTztDQUFPLENBQUE7QUFDaEIsQUFBQSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQSxDQUFBO0FBQ3BCLEFBQUEsRUFBRSxNQUFNLENBQUMsTTtDQUFNLENBQUE7QUFDZixBQUFBLENBQUMsSUFBSSxDQUFBLENBQUE7QUFDTCxBQUFBLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDO0NBQUMsQztBQUFBLENBQUE7QUFDMUIsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFHLE1BQUYsRUFBRSxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ2hDLEFBQUE7QUFDQSxBQUFBLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFFLENBQUMsS0FBSyxDQUFDLENBQUEsQ0FBQTtBQUNoQixBQUFBLEVBQUUsTUFBTSxDQUFDLE87Q0FBTyxDQUFBO0FBQ2hCLEFBQUEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFFLENBQUMsSUFBSSxDQUFDLENBQUEsQ0FBQTtBQUNwQixBQUFBLEVBQUUsTUFBTSxDQUFDLE07Q0FBTSxDQUFBO0FBQ2YsQUFBQSxDQUFDLElBQUksQ0FBQSxDQUFBO0FBQ0wsQUFBQSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQztDQUFDLEM7QUFBQSxDQUFBO0FBQ25DLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVUsTUFBVCxTQUFTLENBQUMsQ0FBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDMUMsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDdkQsQUFBQSxDQUFRLE1BQVAsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUM7QUFDZCxBQUFBLENBQUMsR0FBRyxDQUFDLENBQUEsTUFBQSxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQzdCLEFBQUEsRSxJLEdBQWEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEksQ0FBeEIsR0FBRyxDLEMsR0FBeUIsQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFHLENBQUMsQUFDN0MsQ0FBQyxFQUFFLEVBQUUsQUFBb0IsQUFBYyxBQUN2QyxDQUFDLFFBQVEsWUFBWSxFQUFFLEFBQUUsQUFBWSxBQUNyQyxHQUFHLEFBQ0YsR0FBRyxBQUNILElBQUksQUFDSixFQUFFLEFBQ0gsQ0FBQyxDQUFHLEMsQ0FBQyxDQUFBLENBQUEsQ0FQcUIsTUFBekIsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSSxHLEcsQ0FPakI7QUFDVCxBQUFBLEdBQStCLE1BQTVCLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBRSxDQUFDLFFBQVE7QUFDM0MsQUFBQSxHQUFHLEdBQUcsQ0FBQSxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDOUIsQUFBQSxJQUFJLE1BQU0sQ0FBQSxBQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQzFDLEFBQUEsTUFBTSw0QkFBNEIsQ0FBQTtBQUNsQyxBQUFBO0FBQ0EsQUFBQSxJQUFJLHFDQUFvQztBQUN4QyxBQUFBLElBQU8sTUFBSCxHQUFHLENBQUMsQ0FBRSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUM7QUFDMUIsQUFBQSxJQUFJLEdBQUcsQ0FBQSxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUN4QixBQUFBLEtBQUsseUNBQXdDO0FBQzdDLEFBQUEsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLEMsQ0FBRSxDQUFDLEc7SUFBRyxDQUFBO0FBQ25CLEFBQUEsSUFBSSxJQUFJLENBQUEsQ0FBQTtBQUNSLEFBQUEsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLEMsQ0FBRSxDQUFDLEc7SUFBRyxDO0dBQUEsQ0FBQTtBQUNuQixBQUFBLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQSxHQUFHLENBQUEsQ0FBQSxDQUFBO0FBQ2QsQUFBQSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQyxDQUFFLENBQUMsSztHQUFLLENBQUE7QUFDcEIsQUFBQSxHQUFHLElBQUksQ0FBQSxDQUFBO0FBQ1AsQUFBQSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQyxDQUFFLENBQUMsSTtHQUFJLEM7RUFBQSxDQUFBO0FBQ25CLEFBQUEsRUFBRSxJQUFJLENBQUEsQ0FBQTtBQUNOLEFBQUEsR0FBRyxLQUFLLENBQUEsQUFBQyxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDO0VBQUEsQztDQUFBLENBQUE7QUFDbkMsQUFBQSxDQUFDLE1BQU0sQ0FBQyxDO0FBQUMsQ0FBQTtBQUNULEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVksTUFBWCxXQUFXLENBQUMsQ0FBRSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDaEUsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLHdCQUF3QixFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDckUsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMseUJBQXlCLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUN4RSxBQUFBO0FBQ0EsQUFBQSxDQUFDLDBDQUF5QztBQUMxQyxBQUFBLENBQUMsR0FBRyxDQUFDLENBQUEsTUFBQSxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ2xDLEFBQUEsRUFBTyxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQztBQUN6QixBQUFBLEVBQUUsR0FBRyxDQUFBLENBQUksUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUN2RCxBQUFBLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDLENBQUUsQ0FBQyxLO0VBQUssQztDQUFBLENBQUE7QUFDeEIsQUFBQSxDQUFDLE1BQU0sQ0FBQyxRO0FBQVEsQ0FBQTtBQUNoQixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBVyxNQUFWLFVBQVUsQ0FBQyxDQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUMxRSxBQUFBO0FBQ0EsQUFBQSxDQUFlLE1BQWQsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUUsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTztBQUNuRSxBQUFBLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQSxBQUFDLFFBQVEsQ0FBQyxDQUFDLFNBQVMsQztBQUFBLENBQUE7QUFDdkMsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBZ0IsTUFBZixlQUFlLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDNUMsQUFBQTtBQUNBLEFBQUEsQ0FBYyxNQUFiLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3BCLEFBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQSxNQUFBLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNuQixBQUFBLEVBQUUsR0FBRyxDQUFBLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUN0QyxBQUFBLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDLENBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDO0VBQUMsQztDQUFBLENBQUE7QUFDeEIsQUFBQSxDQUFDLE1BQU0sQ0FBQyxPO0FBQU8sQ0FBQTtBQUNmLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFLLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNoRSxBQUFBO0FBQ0EsQUFBQSxDQUFFLE1BQUQsQ0FBQyxDQUFDLENBQUUsQ0FBQyxVQUFVLENBQUEsQUFBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQzVCLEFBQUEsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDWixFQUFFLENBQUMsQ0FBQTtBQUNILEFBQUE7QUFDQSxBQUFBLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU07QUFDdEIsQUFBQTtBQUNBLEFBQUEsQ0FBQyxHQUFHLENBQUEsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNwQixBQUFBLEVBQUUsTUFBTSxDLENBQUUsQ0FBQyxDQUFDLE1BQU0sQztDQUFDLENBQUE7QUFDbkIsQUFBQSxDQUFnQixNQUFmLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQztBQUN0QixBQUFBLENBQUMsR0FBRyxDQUFDLENBQUEsTUFBQSxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQzVCLEFBQUEsRUFBRSxHQUFHLENBQUEsQ0FBSSxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUM3QixBQUFBLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQSxBQUFDLEdBQUcsQztFQUFBLEM7Q0FBQSxDQUFBO0FBQ2pCLEFBQUEsQ0FBQyxNQUFNLENBQUMsSztBQUFLLENBQUE7QUFDYixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFPLE1BQU4sTUFBTSxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzFELEFBQUE7QUFDQSxBQUFBLENBQUMsR0FBRyxDQUFBLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDakIsQUFBQSxFQUFFLE1BQU0sQ0FBQyxLO0NBQUssQ0FBQTtBQUNkLEFBQUEsQ0FBQyxNQUFNLENBQUEsQUFBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzNDLEFBQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQSxNQUFBLEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFBLENBQUEsQ0FBQTtBQUNqQixBQUFBLEVBQUUsTUFBTSxDQUFBLEFBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3RELEFBQUEsRUFBRSxHQUFHLENBQUEsQ0FBSSxDQUFDLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUM5QixBQUFBLEdBQUcsTUFBTSxDQUFDLEs7RUFBSyxDO0NBQUEsQ0FBQTtBQUNmLEFBQUEsQ0FBQyxNQUFNLENBQUMsSTtBQUFJLENBQUE7QUFDWixBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBUSxNQUFQLE9BQU8sQ0FBQyxDQUFFLENBQUMsTUFBTTtBQUN4QixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFNLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzlDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBUyxHQUFSLFFBQVcsQztBQUFDLENBQUE7QUFDdEMsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFJLE1BQUgsR0FBRyxDQUFDLENBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDNUMsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEM7QUFBQyxDQUFBO0FBQ25DLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBLGNBQWE7QUFDYixBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLEMsTUFBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDLEMsVyxDQUFDLEFBQUMsSSxDQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDdEMsQUFBQTtBQUNBLEFBQUEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNwRCxBQUFBLENBQUMsTTtBQUFNLENBQUE7QUFDUCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFDLElBQUEsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3RDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDO0FBQUMsQ0FBQTtBQUNyQixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFDLElBQUEsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3BDLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDO0FBQUMsQ0FBQTtBQUN0QiIsIm5hbWVzIjpbXSwic291cmNlc0NvbnRlbnQiOlsiIyBsbHV0aWxzLmNpdmV0XG5cbmltcG9ydCB7c3ByaW50Zn0gZnJvbSBcIkBzdGQvZm10L3ByaW50ZlwiXG5cbmltcG9ydCB7XG5cdHVuZGVmLCBkZWZpbmVkLCBub3RkZWZpbmVkLFxuXHRpc0hhc2gsIGlzQXJyYXksIGlzTm9uRW1wdHlTdHJpbmcsXG5cdGlzRW1wdHksIG5vbkVtcHR5LCBpc1N0cmluZywgaXNPYmplY3QsXG5cdGludGVnZXIsIGhhc2gsIHZvaWRGdW5jLCBvcHRpb25zcGVjLFxuXHR9IGZyb20gJy4vZGF0YXR5cGVzLnRzJ1xuXG5sbHV0aWxzTG9hZFRpbWU6IGludGVnZXIgOj0gRGF0ZS5ub3coKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgc2luY2VMb2FkIDo9ICgpID0+XG5cblx0cmV0dXJuIERhdGUubm93KCkgLSBsbHV0aWxzTG9hZFRpbWVcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IHNpbmNlTG9hZFN0ciA6PSAoKSA9PlxuXG5cdHJldHVybiBzcHJpbnRmKFwiJTVkXCIsIHNpbmNlTG9hZCgpKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHRocm93cyBhbiBleGNlcHRpb24gd2l0aCB0aGUgcHJvdmlkZWQgbWVzc2FnZVxuICovXG5cbmV4cG9ydCBjcm9hayA6PSAobXNnOiBzdHJpbmcpOiBuZXZlciA9PlxuXG5cdHRocm93IG5ldyBFcnJvcihtc2cpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogQXNzZXJ0cyB0aGF0IGBjb25kYCBpcyB0cnVlLiBJZiBpdCBpc24ndCwgYW4gZXhjZXB0aW9uIGlzXG4gKiB0aHJvd24gd2l0aCB0aGUgZ2l2ZW4gYG1zZ2BcbiAqL1xuXG5leHBvcnQgYXNzZXJ0IDo9IChjb25kOiBib29sZWFuLCBtc2c6IHN0cmluZyk6IHZvaWQgPT5cblxuXHRpZiAhY29uZFxuXHRcdGNyb2FrIG1zZ1xuXHRyZXR1cm5cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBDYWxsaW5nIHBhc3MoKSBkb2VzIG5vdGhpbmdcbiAqL1xuXG5leHBvcnQgcGFzcyA9ICgpOiB2b2lkID0+ICAgICMgZG8gbm90aGluZ1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIEpTT04gc3RyaW5naWZpZXMgeCBvbiBvbmUgbGluZVxuICogYnV0IGRpc3BsYXlzIGJvdGggdW5kZWZpbmVkIGFuZCBudWxsIGFzICd1bmRlZidcbiAqL1xuXG5leHBvcnQgT0wgOj0gKHg6IGFueSk6IHN0cmluZyA9PlxuXG5cdGlmICh4ID09IHVuZGVmKVxuXHRcdHJldHVybiAndW5kZWYnXG5cdGVsc2UgaWYgKHggPT0gbnVsbClcblx0XHRyZXR1cm4gJ251bGwnXG5cdGVsc2Vcblx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoeClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IE1MIDo9ICh4OiBhbnkpOiBzdHJpbmcgPT5cblxuXHRpZiAoeCA9PSB1bmRlZilcblx0XHRyZXR1cm4gJ3VuZGVmJ1xuXHRlbHNlIGlmICh4ID09IG51bGwpXG5cdFx0cmV0dXJuICdudWxsJ1xuXHRlbHNlXG5cdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KHgsIG51bGwsIDMpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogQ29udmVydHMgdGhlIGdpdmVuIHN0cmluZyB0byBhIGhhc2hcbiAqIDx3b3JkPiBiZWNvbWVzIGEga2V5IHdpdGggYSB0cnVlIHZhbHVlXG4gKiAhPHdvcmQ+IGJlY29tZXMgYSBrZXlzIHdpdGggYSBmYWxzZSB2YWx1ZVxuICogPHdvcmQ+PTxzdHJpbmc+IGJlY29tZXMgYSBrZXkgd2l0aCB2YWx1ZSA8c3RyaW5nPlxuICogICAgLSA8c3RyaW5nPiBtdXN0IGJlIHF1b3RlZCBpZiBpdCBjb250YWlucyB3aGl0ZXNwYWNlXG4gKi9cblxuZXhwb3J0IHN0clRvSGFzaCA6PSAoc3RyOiBzdHJpbmcpOiBoYXNoID0+XG5cblx0YXNzZXJ0IGlzTm9uRW1wdHlTdHJpbmcoc3RyKSwgXCJCYWQgc3RyaW5nOiAje09MKHN0cil9XCJcblx0aDogaGFzaCA6PSB7fVxuXHRmb3Igd29yZCBvZiBzdHIuc3BsaXQoL1xccysvKVxuXHRcdGlmIGxNYXRjaGVzOiBzdHJpbmdbXSB8IG51bGwgOj0gd29yZC5tYXRjaCgvLy9eXG5cdFx0XHRcdChcXCEpPyAgICAgICAgICAgICAgICAgICAgIyBuZWdhdGUgdmFsdWVcblx0XHRcdFx0KFtBLVphLXpdW0EtWmEtel8wLTldKikgICMgaWRlbnRpZmllclxuXHRcdFx0XHQoPzpcblx0XHRcdFx0XHQoPSlcblx0XHRcdFx0XHQoLiopXG5cdFx0XHRcdFx0KT9cblx0XHRcdFx0JC8vLylcblx0XHRcdFtfLCBuZWcsIGlkZW50LCBlcVNpZ24sIHN0cl0gOj0gbE1hdGNoZXNcblx0XHRcdGlmIGlzTm9uRW1wdHlTdHJpbmcoZXFTaWduKVxuXHRcdFx0XHRhc3NlcnQgbm90ZGVmaW5lZChuZWcpIHx8IChuZWcgPT0gJycpLFxuXHRcdFx0XHRcdFx0XCJuZWdhdGlvbiB3aXRoIHN0cmluZyB2YWx1ZVwiXG5cblx0XHRcdFx0IyAtLS0gY2hlY2sgaWYgc3RyIGlzIGEgdmFsaWQgbnVtYmVyXG5cdFx0XHRcdG51bSA6PSBwYXJzZUZsb2F0KHN0cilcblx0XHRcdFx0aWYgTnVtYmVyLmlzTmFOKG51bSlcblx0XHRcdFx0XHQjIC0tLSBUTyBETzogaW50ZXJwcmV0IGJhY2tzbGFzaCBlc2NhcGVzXG5cdFx0XHRcdFx0aFtpZGVudF0gPSBzdHJcblx0XHRcdFx0ZWxzZVxuXHRcdFx0XHRcdGhbaWRlbnRdID0gbnVtXG5cdFx0XHRlbHNlIGlmIG5lZ1xuXHRcdFx0XHRoW2lkZW50XSA9IGZhbHNlXG5cdFx0XHRlbHNlXG5cdFx0XHRcdGhbaWRlbnRdID0gdHJ1ZVxuXHRcdGVsc2Vcblx0XHRcdGNyb2FrIFwiSW52YWxpZCB3b3JkICN7T0wod29yZCl9XCJcblx0cmV0dXJuIGhcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBBZGRzIGFueSBrZXlzIGluIGhEZWZhdWx0cyB0aGF0IGFyZSBtaXNzaW5nIGluIGhPcHRpb25zXG4gKiB0byBoT3B0aW9ucyB3aXRoIHRoZWlyIGdpdmVuIHZhbHVlc1xuICovXG5cbmV4cG9ydCBhZGREZWZhdWx0cyA6PSAoaE9wdGlvbnM6IGhhc2gsIGhEZWZhdWx0czogaGFzaCk6IGhhc2ggPT5cblxuXHRhc3NlcnQgaXNPYmplY3QoaE9wdGlvbnMpLCBcImhPcHRpb25zIG5vdCBhbiBvYmplY3Q6ICN7T0woaE9wdGlvbnMpfVwiXG5cdGFzc2VydCBpc09iamVjdChoRGVmYXVsdHMpLCBcImhEZWZhdWx0cyBub3QgYW4gb2JqZWN0OiAje09MKGhEZWZhdWx0cyl9XCJcblxuXHQjIC0tLSBGaWxsIGluIGRlZmF1bHRzIGZvciBtaXNzaW5nIHZhbHVlc1xuXHRmb3Iga2V5IG9mIE9iamVjdC5rZXlzKGhEZWZhdWx0cylcblx0XHR2YWx1ZSA6PSBoRGVmYXVsdHNba2V5XVxuXHRcdGlmIG5vdCBoT3B0aW9ucy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIGRlZmluZWQodmFsdWUpXG5cdFx0XHRoT3B0aW9uc1trZXldID0gdmFsdWVcblx0cmV0dXJuIGhPcHRpb25zXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyBhIGhhc2ggb2Ygb3B0aW9ucyB3aXRoIHRoZWlyIHZhbHVlcywgdXNpbmcgb3B0aW9uc1xuICogaWYgaXQncyBhIGhhc2gsIG9yIHBhcnNpbmcgb3B0aW9ucyB1c2luZyBzdHJUb0hhc2goKSBpZlxuICogaXQncyBhIHN0cmluZyAtIGFkZGluZyBhbnkgZGVmYXVsdCB2YWx1ZXMgZnJvbSBoRGVmYXVsdHNcbiAqIGlmIHRoZXkncmUgbWlzc2luZyBpbiB0aGUgcmVzdWx0aW5nIGhhc2hcbiAqL1xuXG5leHBvcnQgZ2V0T3B0aW9ucyA6PSAob3B0aW9uczogb3B0aW9uc3BlYz17fSwgaERlZmF1bHRzOiBoYXNoPXt9KTogaGFzaCA9PlxuXG5cdGhPcHRpb25zOiBoYXNoIDo9IGlzU3RyaW5nKG9wdGlvbnMpID8gc3RyVG9IYXNoKG9wdGlvbnMpIDogb3B0aW9uc1xuXHRyZXR1cm4gYWRkRGVmYXVsdHMgaE9wdGlvbnMsIGhEZWZhdWx0c1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHJlbW92ZSBhbGwga2V5cyBmcm9tIGEgaGFzaCB0aGF0IGhhdmUgZWl0aGVyIGFuIGVtcHR5IG5hbWVcbiAqIG9yIGFuIGVtcHR5IHZhbHVlXG4gKi9cblxuZXhwb3J0IHJlbW92ZUVtcHR5S2V5cyA6PSAoaDogaGFzaCk6IGhhc2ggPT5cblxuXHRoUmVzdWx0OiBoYXNoIDo9IHt9XG5cdGZvciBrZXkgb2Yga2V5cyhoKVxuXHRcdGlmIG5vbkVtcHR5KGtleSkgJiYgbm9uRW1wdHkoaFtrZXldKVxuXHRcdFx0aFJlc3VsdFtrZXldID0gaFtrZXldXG5cdHJldHVybiBoUmVzdWx0XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJuIGFuIGFycmF5IG9mIGFsbCBvd24ga2V5cyBpbiBhIGhhc2hcbiAqL1xuXG5leHBvcnQga2V5cyA6PSAob2JqOiBoYXNoLCBoT3B0aW9uczogb3B0aW9uc3BlYz17fSk6IHN0cmluZ1tdID0+XG5cblx0aCA6PSBnZXRPcHRpb25zIGhPcHRpb25zLCB7XG5cdFx0ZXhjZXB0OiBbXVxuXHRcdH1cblxuXHRsZXQgZXhjZXB0ID0gaC5leGNlcHRcblxuXHRpZiBpc1N0cmluZyhleGNlcHQpXG5cdFx0ZXhjZXB0ID0gW2V4Y2VwdF1cblx0bEtleXM6IHN0cmluZ1tdIDo9IFtdXG5cdGZvciBrZXkgb2YgT2JqZWN0LmtleXMob2JqKVxuXHRcdGlmIG5vdCBleGNlcHQuaW5jbHVkZXMoa2V5KVxuXHRcdFx0bEtleXMucHVzaCBrZXlcblx0cmV0dXJuIGxLZXlzXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyB0cnVlIGlmIGVpdGhlciBgaGAgaXMgbm90IGRlZmluZWQsIG9yIGlmIGBoYCBpc1xuICogYSBoYXNoIHRoYXQgaW5jbHVkZXMgYWxsIHRoZSBrZXlzIHByb3ZpZGVkXG4gKi9cblxuZXhwb3J0IGhhc0tleSA6PSAoaDogaGFzaCwgLi4ubEtleXM6IHN0cmluZ1tdKTogYm9vbGVhbiA9PlxuXG5cdGlmIG5vdGRlZmluZWQoaClcblx0XHRyZXR1cm4gZmFsc2Vcblx0YXNzZXJ0IGlzSGFzaChoKSwgXCJoIG5vdCBhIGhhc2g6ICN7T0woaCl9XCJcblx0Zm9yIGtleSBvZiBsS2V5c1xuXHRcdGFzc2VydCBpc1N0cmluZyhrZXkpLCBcImtleSBub3QgYSBzdHJpbmc6ICN7T0woa2V5KX1cIlxuXHRcdGlmIG5vdCBoLmhhc093blByb3BlcnR5KGtleSlcblx0XHRcdHJldHVybiBmYWxzZVxuXHRyZXR1cm4gdHJ1ZVxuXG5leHBvcnQgaGFzS2V5cyA6PSBoYXNLZXlcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBtZXJnZXMgdGhlIHByb3ZpZGVkIG9iamVjdHMgaW50byBhIG5ldyBvYmplY3RcbiAqIE5PVEU6IG5vbmUgb2YgdGhlIHByb3ZpZGVkIGFyZ3VtZW50cyBhcmUgbW9kaWZpZWRcbiAqL1xuXG5leHBvcnQgbWVyZ2UgOj0gKC4uLmxPYmplY3RzOiBoYXNoW10pOiBoYXNoID0+XG5cblx0cmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIGxPYmplY3RzLi4uKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgaGl0IDo9IChwY3Q6IG51bWJlciA9IDUwKTogYm9vbGVhbiA9PlxuXG5cdHJldHVybiAoMTAwICogTWF0aC5yYW5kb20oKSA8IHBjdClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgLS0tIEFTWU5DICFcblxuZXhwb3J0IHNsZWVwIDo9IChzZWM6IG51bWJlcik6IHZvaWQgPT5cblxuXHRhd2FpdCBuZXcgUHJvbWlzZSgocikgPT4gc2V0VGltZW91dChyLCAxMDAwICogc2VjKSlcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogcmV0dXJucyBhIHN0cmluZyBjb25zaXN0aW5nIG9mIHRoZSBnaXZlbiBudW1iZXJcbiAqIG9mIHNwYWNlIGNoYXJhY3RlcnNcbiAqL1xuXG5leHBvcnQgc3BhY2VzID0gKG46IG51bWJlcik6IHN0cmluZyA9PlxuXG5cdHJldHVybiBcIiBcIi5yZXBlYXQobilcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiByZXR1cm5zIGEgc3RyaW5nIGNvbnNpc3Rpbmcgb2YgdGhlIGdpdmVuIG51bWJlclxuICogb2YgVEFCIGNoYXJhY3RlcnNcbiAqL1xuXG5leHBvcnQgdGFicyA9IChuOiBudW1iZXIpOiBzdHJpbmcgPT5cblxuXHRyZXR1cm4gXCJcXHRcIi5yZXBlYXQobilcbiJdfQ==