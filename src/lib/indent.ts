"use strict";
// indent.civet

import {
	undef, defined, notdefined,
	isString, isArray, isHash, isInteger,
	} from './datatypes.ts'
import {
	pass, OL, ML, rtrim, countChars,
	blockToArray, arrayToBlock, toArray, toBlock,
	assert, croak, escapeStr,
	} from './llutils.ts'
import {DBG} from './logger.ts'

export let oneIndent: (string | undefined) = undef

// ---------------------------------------------------------------------------

/**
 * Reset the text for one indent level
 */

export const resetOneIndent = (str: (string | undefined)=undef): void => {

	DBG(`Resetting oneIndent to ${str}`)
	oneIndent = str
	return
}

// ---------------------------------------------------------------------------

/**
 * indentLevel - determine indent level of a string
 *               it's OK if the string is ONLY indentation
 */

export const indentLevel = (line: string): number => {

	// --- This will always match, and it's greedy
	//     (but TypeScript doesn't know that)
	const [prefix] = line.match(/^\s*/) || ['']

	if (prefix.length === 0) {
		return 0
	}

	// --- Check if we're using TABs or spaces
	const numTABs = countChars(prefix, "\t")
	const numSpaces = countChars(prefix, " ")
	assert((numTABs===0) || (numSpaces===0),
		`Invalid mix of TABs and spaces in ${escapeStr(line)}`)

	// --- oneIndent must be one of:
	//        undef
	//        a single TAB character
	//        some number of space characters

	// --- Set variables oneIndent & level
	switch(oneIndent) {
		case undef: {
			if (numTABs > 0) {
				oneIndent = "\t"
				return numTABs
			}
			else {
				oneIndent = ' '.repeat(numSpaces)
				return 1
			}
		}
		case "\t": {
			assert((numSpaces===0), "Expecting TABs, found spaces")
			return numTABs
		}
		default: {
			// --- using some number of spaces
			assert((numTABs === 0), "Expecting spaces, found TABs")
			assert((numSpaces % oneIndent.length === 0), `Invalid num spaces: ${numSpaces},
oneIndent = ${escapeStr(oneIndent)}`)
			return numSpaces / oneIndent.length
		}
	}
}

// ---------------------------------------------------------------------------

/**
 * splitLine - separate a line into [level, line]
 */

export type lineDesc = [
	level: number,
	text: string
	]

export const splitLine = (line: string): lineDesc => {

	const [_, prefix, str] = line.match(/^(\s*)(.*)$/) || ['', '', '']
	return [indentLevel(prefix), str.trim()]
}

// ---------------------------------------------------------------------------

/**
 * indented - add indentation to each string in a block or array
 *          - returns the same type as input, i.e. array or string
 */

export const indented = (
		input: string | string[],
		level: number=1
		): string | string[] => {

	assert(isInteger(level), `Invalid level: ${OL(level)}`)
	assert((level >= 0), `Invalid level: ${OL(level)}`)
	if (level === 0) {
		return input
	}
	if (notdefined(oneIndent)) {
		oneIndent = "\t"
	}
	const toAdd = oneIndent.repeat(level)

	// --- input must be either a string or array of strings
	const lLines = toArray(input)

	// --- NOTE: don't add indentation to empty lines
	const lNewLines = lLines.map((line) => {
		line = rtrim(line)
		return (line === '') ? '' : `${toAdd}${line}`
	}
		)

	return isArray(input) ? lNewLines : arrayToBlock(lNewLines)
}

// ---------------------------------------------------------------------------

/**
 * undented - string with 1st line indentation removed for each line
 *          - returns same type as input, i.e. either string or array
 */

export const undented = (input: string | string[]): string | string[] => {

	// --- input must be either a string or array of strings
	const lLines = toArray(input)

	// --- NOTE: leave empty lines empty

	let toRemove: (string | undefined)  = undef
	let nToRemove: number = 0
	const lNewLines = lLines.map((line) => {
		line = rtrim(line)
		if (line === '') {
			return ''
		}
		else if (notdefined(toRemove)) {
			const [_, prefix, rest] = line.match(/^(\s*)(.*)$/) || ['','','']
			if (prefix.length === 0) {
				return line
			}
			else {
				toRemove = prefix
				nToRemove = prefix.length
				return rest
			}
		}
		else {
			assert((line.indexOf(toRemove)===0),
				`can't remove ${OL(toRemove)} from ${OL(line)}`)
			return line.substr(nToRemove)
		}
	}
		)

	return isString(input) ? arrayToBlock(lNewLines) : lNewLines
}

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9pbmRlbnQuY2l2ZXQudHN4Iiwic291cmNlcyI6WyJzcmMvbGliL2luZGVudC5jaXZldCJdLCJtYXBwaW5ncyI6IjtBQUFBLGVBQWM7QUFDZCxBQUFBO0FBQ0EsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDO0FBQzVCLENBQUMsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQ3RDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0I7QUFDeEIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxVQUFVLENBQUM7QUFDakMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFDOUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDMUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWM7QUFDdEIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhO0FBQy9CLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEMsQyxDQUFDLEFBQUMsTSxZLENBQU8sQ0FBQyxDQUFDLENBQUMsS0FBSztBQUNyQyxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUE7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBZSxNQUFkLGNBQWMsQ0FBQyxDQUFFLENBQUMsQ0FBQyxHQUFHLEMsQyxDQUFDLEFBQUMsTSxZLENBQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUks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LENBQUMsQztBQUFDLENBQUE7QUFDekMsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBUyxNQUFSLFFBQVEsQ0FBQyxDQUFFLENBQUMsQ0FBQztBQUNwQixBQUFBLEVBQUUsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQzNCLEFBQUEsRUFBRSxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNqQixFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN6QixBQUFBO0FBQ0EsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsZUFBZSxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDdkQsQUFBQSxDQUFDLE1BQU0sQ0FBQSxBQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsZUFBZSxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDbkQsQUFBQSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUE7QUFDaEIsQUFBQSxFQUFFLE1BQU0sQ0FBQyxLO0NBQUssQ0FBQTtBQUNkLEFBQUEsQ0FBQyxHQUFHLENBQUEsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUN6QixBQUFBLEVBQUUsU0FBUyxDLENBQUUsQ0FBQyxJO0NBQUksQ0FBQTtBQUNsQixBQUFBLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO0FBQ2pDLEFBQUE7QUFDQSxBQUFBLENB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LEk7R0FBSSxDO0VBQUEsQ0FBQTtBQUNmLEFBQUEsRUFBRSxJQUFJLENBQUEsQ0FBQTtBQUNOLEFBQUEsR0FBRyxNQUFNLENBQUEsQUFBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEdBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdEMsQUFBQSxJQUFJLENBQUMsYUFBYSxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNuRCxBQUFBLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDO0VBQUMsQztDQUFBLENBQUE7QUFDaEMsRUFBRSxDQUFDO0FBQ0gsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFM7QUFBUyxDQUFBO0FBQzdEIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIGluZGVudC5jaXZldFxyXG5cclxuaW1wb3J0IHtcclxuXHR1bmRlZiwgZGVmaW5lZCwgbm90ZGVmaW5lZCxcclxuXHRpc1N0cmluZywgaXNBcnJheSwgaXNIYXNoLCBpc0ludGVnZXIsXHJcblx0fSBmcm9tICcuL2RhdGF0eXBlcy50cydcclxuaW1wb3J0IHtcclxuXHRwYXNzLCBPTCwgTUwsIHJ0cmltLCBjb3VudENoYXJzLFxyXG5cdGJsb2NrVG9BcnJheSwgYXJyYXlUb0Jsb2NrLCB0b0FycmF5LCB0b0Jsb2NrLFxyXG5cdGFzc2VydCwgY3JvYWssIGVzY2FwZVN0cixcclxuXHR9IGZyb20gJy4vbGx1dGlscy50cydcclxuaW1wb3J0IHtEQkd9IGZyb20gJy4vbG9nZ2VyLnRzJ1xyXG5cclxuZXhwb3J0IGxldCBvbmVJbmRlbnQ6IHN0cmluZz8gPSB1bmRlZlxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBSZXNldCB0aGUgdGV4dCBmb3Igb25lIGluZGVudCBsZXZlbFxyXG4gKi9cclxuXHJcbmV4cG9ydCByZXNldE9uZUluZGVudCA6PSAoc3RyOiBzdHJpbmc/PXVuZGVmKTogdm9pZCA9PlxyXG5cclxuXHREQkcgXCJSZXNldHRpbmcgb25lSW5kZW50IHRvICN7c3RyfVwiXHJcblx0b25lSW5kZW50ID0gc3RyXHJcblx0cmV0dXJuXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIGluZGVudExldmVsIC0gZGV0ZXJtaW5lIGluZGVudCBsZXZlbCBvZiBhIHN0cmluZ1xyXG4gKiAgICAgICAgICAgICAgIGl0J3MgT0sgaWYgdGhlIHN0cmluZyBpcyBPTkxZIGluZGVudGF0aW9uXHJcbiAqL1xyXG5cclxuZXhwb3J0IGluZGVudExldmVsIDo9IChsaW5lOiBzdHJpbmcpOiBudW1iZXIgPT5cclxuXHJcblx0IyAtLS0gVGhpcyB3aWxsIGFsd2F5cyBtYXRjaCwgYW5kIGl0J3MgZ3JlZWR5XHJcblx0IyAgICAgKGJ1dCBUeXBlU2NyaXB0IGRvZXNuJ3Qga25vdyB0aGF0KVxyXG5cdFtwcmVmaXhdIDo9IGxpbmUubWF0Y2goL15cXHMqLykgfHwgWycnXVxyXG5cclxuXHRpZiAocHJlZml4Lmxlbmd0aCA9PSAwKVxyXG5cdFx0cmV0dXJuIDBcclxuXHJcblx0IyAtLS0gQ2hlY2sgaWYgd2UncmUgdXNpbmcgVEFCcyBvciBzcGFjZXNcclxuXHRudW1UQUJzIDo9IGNvdW50Q2hhcnMocHJlZml4LCBcIlxcdFwiKVxyXG5cdG51bVNwYWNlcyA6PSBjb3VudENoYXJzKHByZWZpeCwgXCIgXCIpXHJcblx0YXNzZXJ0IChudW1UQUJzPT0wKSB8fCAobnVtU3BhY2VzPT0wKSxcclxuXHRcdFwiSW52YWxpZCBtaXggb2YgVEFCcyBhbmQgc3BhY2VzIGluICN7ZXNjYXBlU3RyKGxpbmUpfVwiXHJcblxyXG5cdCMgLS0tIG9uZUluZGVudCBtdXN0IGJlIG9uZSBvZjpcclxuXHQjICAgICAgICB1bmRlZlxyXG5cdCMgICAgICAgIGEgc2luZ2xlIFRBQiBjaGFyYWN0ZXJcclxuXHQjICAgICAgICBzb21lIG51bWJlciBvZiBzcGFjZSBjaGFyYWN0ZXJzXHJcblxyXG5cdCMgLS0tIFNldCB2YXJpYWJsZXMgb25lSW5kZW50ICYgbGV2ZWxcclxuXHRzd2l0Y2ggb25lSW5kZW50XHJcblx0XHR3aGVuIHVuZGVmXHJcblx0XHRcdGlmIChudW1UQUJzID4gMClcclxuXHRcdFx0XHRvbmVJbmRlbnQgPSBcIlxcdFwiXHJcblx0XHRcdFx0cmV0dXJuIG51bVRBQnNcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdG9uZUluZGVudCA9ICcgJy5yZXBlYXQobnVtU3BhY2VzKVxyXG5cdFx0XHRcdHJldHVybiAxXHJcblx0XHR3aGVuIFwiXFx0XCJcclxuXHRcdFx0YXNzZXJ0IChudW1TcGFjZXM9PTApLCBcIkV4cGVjdGluZyBUQUJzLCBmb3VuZCBzcGFjZXNcIlxyXG5cdFx0XHRyZXR1cm4gbnVtVEFCc1xyXG5cdFx0ZWxzZVxyXG5cdFx0XHQjIC0tLSB1c2luZyBzb21lIG51bWJlciBvZiBzcGFjZXNcclxuXHRcdFx0YXNzZXJ0IChudW1UQUJzID09IDApLCBcIkV4cGVjdGluZyBzcGFjZXMsIGZvdW5kIFRBQnNcIlxyXG5cdFx0XHRhc3NlcnQgKG51bVNwYWNlcyAlIG9uZUluZGVudC5sZW5ndGggPT0gMCksIFwiXCJcIlxyXG5cdFx0XHRcdFx0SW52YWxpZCBudW0gc3BhY2VzOiAje251bVNwYWNlc30sXHJcblx0XHRcdFx0XHRvbmVJbmRlbnQgPSAje2VzY2FwZVN0cihvbmVJbmRlbnQpfVxyXG5cdFx0XHRcdFx0XCJcIlwiXHJcblx0XHRcdHJldHVybiBudW1TcGFjZXMgLyBvbmVJbmRlbnQubGVuZ3RoXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHNwbGl0TGluZSAtIHNlcGFyYXRlIGEgbGluZSBpbnRvIFtsZXZlbCwgbGluZV1cclxuICovXHJcblxyXG5leHBvcnQgdHlwZSBsaW5lRGVzYyA9IFtcclxuXHRsZXZlbDogbnVtYmVyXHJcblx0dGV4dDogc3RyaW5nXHJcblx0XVxyXG5cclxuZXhwb3J0IHNwbGl0TGluZSA6PSAobGluZTogc3RyaW5nKTogbGluZURlc2MgPT5cclxuXHJcblx0W18sIHByZWZpeCwgc3RyXSA6PSBsaW5lLm1hdGNoKC9eKFxccyopKC4qKSQvKSB8fCBbJycsICcnLCAnJ11cclxuXHRyZXR1cm4gW2luZGVudExldmVsKHByZWZpeCksIHN0ci50cmltKCldXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIGluZGVudGVkIC0gYWRkIGluZGVudGF0aW9uIHRvIGVhY2ggc3RyaW5nIGluIGEgYmxvY2sgb3IgYXJyYXlcclxuICogICAgICAgICAgLSByZXR1cm5zIHRoZSBzYW1lIHR5cGUgYXMgaW5wdXQsIGkuZS4gYXJyYXkgb3Igc3RyaW5nXHJcbiAqL1xyXG5cclxuZXhwb3J0IGluZGVudGVkIDo9IChcclxuXHRcdGlucHV0OiBzdHJpbmcgfCBzdHJpbmdbXSxcclxuXHRcdGxldmVsOiBudW1iZXI9MVxyXG5cdFx0KTogc3RyaW5nIHwgc3RyaW5nW10gPT5cclxuXHJcblx0YXNzZXJ0IGlzSW50ZWdlcihsZXZlbCksIFwiSW52YWxpZCBsZXZlbDogI3tPTChsZXZlbCl9XCJcclxuXHRhc3NlcnQgKGxldmVsID49IDApLCBcIkludmFsaWQgbGV2ZWw6ICN7T0wobGV2ZWwpfVwiXHJcblx0aWYgKGxldmVsID09IDApXHJcblx0XHRyZXR1cm4gaW5wdXRcclxuXHRpZiBub3RkZWZpbmVkKG9uZUluZGVudClcclxuXHRcdG9uZUluZGVudCA9IFwiXFx0XCJcclxuXHR0b0FkZCA6PSBvbmVJbmRlbnQucmVwZWF0KGxldmVsKVxyXG5cclxuXHQjIC0tLSBpbnB1dCBtdXN0IGJlIGVpdGhlciBhIHN0cmluZyBvciBhcnJheSBvZiBzdHJpbmdzXHJcblx0bExpbmVzIDo9IHRvQXJyYXkoaW5wdXQpXHJcblxyXG5cdCMgLS0tIE5PVEU6IGRvbid0IGFkZCBpbmRlbnRhdGlvbiB0byBlbXB0eSBsaW5lc1xyXG5cdGxOZXdMaW5lcyA6PSBsTGluZXMubWFwKChsaW5lKSA9PlxyXG5cdFx0bGluZSA9IHJ0cmltKGxpbmUpXHJcblx0XHRyZXR1cm4gKGxpbmUgPT0gJycpID8gJycgOiBcIiN7dG9BZGR9I3tsaW5lfVwiXHJcblx0XHQpXHJcblxyXG5cdHJldHVybiBpc0FycmF5KGlucHV0KSA/IGxOZXdMaW5lcyA6IGFycmF5VG9CbG9jayhsTmV3TGluZXMpXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIHVuZGVudGVkIC0gc3RyaW5nIHdpdGggMXN0IGxpbmUgaW5kZW50YXRpb24gcmVtb3ZlZCBmb3IgZWFjaCBsaW5lXHJcbiAqICAgICAgICAgIC0gcmV0dXJucyBzYW1lIHR5cGUgYXMgaW5wdXQsIGkuZS4gZWl0aGVyIHN0cmluZyBvciBhcnJheVxyXG4gKi9cclxuXHJcbmV4cG9ydCB1bmRlbnRlZCA6PSAoaW5wdXQ6IHN0cmluZyB8IHN0cmluZ1tdKTogc3RyaW5nIHwgc3RyaW5nW10gPT5cclxuXHJcblx0IyAtLS0gaW5wdXQgbXVzdCBiZSBlaXRoZXIgYSBzdHJpbmcgb3IgYXJyYXkgb2Ygc3RyaW5nc1xyXG5cdGxMaW5lcyA6PSB0b0FycmF5KGlucHV0KVxyXG5cclxuXHQjIC0tLSBOT1RFOiBsZWF2ZSBlbXB0eSBsaW5lcyBlbXB0eVxyXG5cclxuXHRsZXQgdG9SZW1vdmU6IHN0cmluZz8gID0gdW5kZWZcclxuXHRsZXQgblRvUmVtb3ZlOiBudW1iZXIgPSAwXHJcblx0bE5ld0xpbmVzIDo9IGxMaW5lcy5tYXAoKGxpbmUpID0+XHJcblx0XHRsaW5lID0gcnRyaW0obGluZSlcclxuXHRcdGlmIChsaW5lID09ICcnKVxyXG5cdFx0XHRyZXR1cm4gJydcclxuXHRcdGVsc2UgaWYgbm90ZGVmaW5lZCh0b1JlbW92ZSlcclxuXHRcdFx0W18sIHByZWZpeCwgcmVzdF0gOj0gbGluZS5tYXRjaCgvXihcXHMqKSguKikkLykgfHwgWycnLCcnLCcnXVxyXG5cdFx0XHRpZiAocHJlZml4Lmxlbmd0aCA9PSAwKVxyXG5cdFx0XHRcdHJldHVybiBsaW5lXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHR0b1JlbW92ZSA9IHByZWZpeFxyXG5cdFx0XHRcdG5Ub1JlbW92ZSA9IHByZWZpeC5sZW5ndGhcclxuXHRcdFx0XHRyZXR1cm4gcmVzdFxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRhc3NlcnQgKGxpbmUuaW5kZXhPZih0b1JlbW92ZSk9PTApLFxyXG5cdFx0XHRcdFwiY2FuJ3QgcmVtb3ZlICN7T0wodG9SZW1vdmUpfSBmcm9tICN7T0wobGluZSl9XCJcclxuXHRcdFx0cmV0dXJuIGxpbmUuc3Vic3RyKG5Ub1JlbW92ZSlcclxuXHRcdClcclxuXHJcblx0cmV0dXJuIGlzU3RyaW5nKGlucHV0KSA/IGFycmF5VG9CbG9jayhsTmV3TGluZXMpIDogbE5ld0xpbmVzXHJcbiJdfQ==