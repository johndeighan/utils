// v8-stack.civet

import pathLib from 'path'
import fs from 'fs'
import sms from 'source-map-support'
import {sprintf} from '@std/fmt/printf'

import {
	undef, defined, notdefined, isEmpty, nonEmpty,
	assert, croak, hasKey, OL, ML, getOptions,
	isString, isNonEmptyString, isInteger, rpad, centered,
	isFile, mkpath, fileExt, withExt, normalizePath, relpath,
	DBG, LOG, WARN, ERR, INDENT, UNDENT,
	} from '@jdeighan/utils/llutils.js'

sms.install()
const mapSourcePosition = sms.mapSourcePosition
const width = 40

// ---------------------------------------------------------------------------
// Stack Frames have keys:
//    type         - eval | native | constructor | method | function | script
//    source
//    line
//    column
//    name          - name of function or method
//    isConstructor - true if a constructor function
//    isAsync       - true if an async function/method
//    objTye        - if type == 'method'

// ---------------------------------------------------------------------------

export var getV8Stack = () => {
	// --- ignores any stack frames from this module
	//     *.js files will be mapped to original source files
	//        if a source map is available

	try {
		const oldLimit = Error.stackTraceLimit
		const oldPreparer = Error.prepareStackTrace

		Error.stackTraceLimit = Infinity
		Error.prepareStackTrace = (error, lFrames) => {
			const lResultFrames = []
			DBG(`getV8Stack(): ${lFrames.length} stack frames`)
			let i1 = 0;for (const frame of lFrames) {const i = i1++;

				DBG(`FRAME ${i}`, INDENT)

				// --- Call functions on the frame
				const fileName      = frame.getFileName()
				const functionName  = frame.getFunctionName()
				const functionObj   = frame.getFunction()
				const methodName    = frame.getMethodName()
				const line          = frame.getLineNumber()
				const column        = frame.getColumnNumber()
				const isTopLevel    = frame.isToplevel()
				const isAsync       = frame.isAsync()
				const isEval        = frame.isEval()
				const isNative      = frame.isNative()
				const isConstructor = frame.isConstructor()
				const typeName      = frame.getTypeName()

				DBG(centered('from V8', width, '-'))
				DBG(`fileName = ${OL(fileName)}`)
				DBG(`functionName = ${OL(functionName)}`)
				DBG(`defined(functionObj) = ${OL(defined(functionObj))}`)
				DBG(`methodName = ${OL(methodName)}`)
				DBG(`line = ${OL(line)}`)
				DBG(`column = ${OL(column)}`)
				DBG(`isTopLevel = ${OL(isTopLevel)}`)
				DBG(`isAsync = ${OL(isAsync)}`)
				DBG(`isEval = ${OL(isEval)}`)
				DBG(`isNative = ${OL(isNative)}`)
				DBG(`isConstructor = ${OL(isConstructor)}`)
				DBG(`typeName = ${OL(typeName)}`)
				DBG('-'.repeat(width))

				const source = fileName
				if (defined(source) && (source.indexOf('v8-stack.js')  >= 0)) {
					DBG(`SKIP: source = '${source}'`, UNDENT)
					continue
				}

				const h = {
					source,
					line,
					column
					}

				if (defined(functionName)) {
					h.name = functionName
				}
				else if (defined(functionObj)) {
					h.name = '<anonymous>'
				}

				if (defined(methodName)) {
					h.name = methodName
				}

				// --- Set type
				h.type = (
					  isEval                  ? 'eval'
					: isNative                ? 'native'
					: isConstructor           ? 'constructor'
					: defined(methodName)   ? 'method'
					: defined(functionName) ? 'function'
					: isTopLevel              ? 'script'
					:                           croak('Unknown frame type')
					)

				if (isConstructor) {
					h.isConstructor = true
				}

				if (isAsync) {
					h.isAsync = true
				}

				if (h.type === 'method') {
					h.objType = typeName
				}

				// --- fix a bug in the V8 engine where calls inside a
				//     top level anonymous function is reported as
				//     being from the top level, i.e. type 'script'

				if (lResultFrames.length > 0) {
					const tos = lResultFrames.at(-1)    // --- i.e. previous frame
					if ((h.type === 'script') && (tos.type === 'script')) {
						DBG(`Patch current TOS (currently ${lResultFrames.length} frames)`)
						tos.type = 'function'
						tos.name = '<anonymous>'
					}
				}

				DBG(centered('return frame', width, '-'))
				DBG(ML(h))
				DBG('-'.repeat(width))

				// --- Ignore this entry and any before it
				if (h.objType === 'ModuleJob') {
					DBG("objType is 'ModuleJob' - stop processing")
					break
				}

				lResultFrames.push(h)
				DBG(UNDENT)
			}

			DBG('-'.repeat(width))
			return lResultFrames
		}

		const errObj = new Error()
		const lStack = errObj.stack

		// --- reset to previous values
		Error.stackTraceLimit = oldLimit
		Error.prepareStackTrace = oldPreparer

		for (const h of lStack) {
			DBG(`before mapping, h = ${ML(h)}`)
			const {source, line, column, name, type} = h
			const hNew = mapSourcePosition({
				source,
				line,
				column
				})
			const newExt = fileExt(hNew.source)
			if (newExt === fileExt(h.source)) {
				DBG("Not mapped - returning original position")
				h.source = relpath(h.source)
			}
			else {
				DBG(`got, hNew = ${ML(hNew)}`)
				h.source = relpath(withExt(h.source, newExt))
				h.line = hNew.line
				h.column = hNew.column
				DBG(`after mapping, h = ${ML(h)}`)
			}
		}

		return lStack
	}
	catch (e) {
		ERR(e.message)
		return []
	}
}

// ---------------------------------------------------------------------------

export const getV8StackStr = (hOptions={}) => {
	// --- ignores any stack frames from this module
	//     *.js files will be mapped to original source files
	//        if a source map is available

	const lLines = getV8Stack().map((h) => {
		const typeStr = sprintf("%-11s", h.type)
		return `[${typeStr}] ${h.source}:${h.line}:${h.column}`
	}
		)
	return lLines.join('\n')
}

// ---------------------------------------------------------------------------

export const getMyCaller = () => {

	try {
		const lStack = getV8Stack()
		return lStack[1]
	}
	catch (err) {
		console.log(`ERROR in getV8Stack(): ${err.message}`)
		return undef
	}
}

// ---------------------------------------------------------------------------

export const getMyOutsideCaller = () => {

	try {
		const lStack = getV8Stack()
		DBG(`Call stack has ${lStack.length} items`)
		const source = lStack[0].source
		DBG(`source = ${source}`)
		let i2 = 0;for (const frame of lStack) {const i = i2++;
			DBG(`frame[${i}].source = ${frame.source}`)
			if (frame.source !== source) {
				return frame
			}
		}
		return undef
	}
	catch (err) {
		console.log(`ERROR in getV8Stack(): ${err.message}`)
		return undef
	}
}

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi92OC1zdGFjay5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvdjgtc3RhY2suY2l2ZXQiXSwibWFwcGluZ3MiOiJBQUFBLGlCQUFnQjtBQUNoQixBQUFBO0FBQ0EsQUFBQSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNO0FBQzFCLEFBQUEsQUFBQSxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJO0FBQ25CLEFBQUEsQUFBQSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxvQkFBb0I7QUFDcEMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUI7QUFDdkMsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQy9DLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDO0FBQzNDLENBQUMsUUFBUSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUM7QUFDdkQsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFDMUQsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDckMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLDRCQUE0QjtBQUNwQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLEdBQUcsQ0FBQyxP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Q0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNO0FBQzVCLEFBQUEsRUFBRSxHQUFHLENBQUEsQUFBQyxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFBO0FBQzFCLEFBQUEsRSxJLEUsSSxDQUFFLEdBQUcsQ0FBQyxDQUFBLE1BQUEsS0FBTyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUEsQ0FBQSxDQUFYLE1BQUEsQyxHLEUsRSxDQUFXO0FBQ3ZCLEFBQUEsR0FBRyxHQUFHLENBQUEsQUFBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFBO0FBQzdDLEFBQUEsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFFLENBQUMsTUFBTSxDQUFDLENBQUEsQ0FBQTtBQUM5QixBQUFBLElBQUksTUFBTSxDQUFDLEs7R0FBSyxDO0VBQUEsQ0FBQTtBQUNoQixBQUFBLEVBQUUsTUFBTSxDQUFDLEs7Q0FBSyxDQUFBO0FBQ2QsQUFBQSxDQUFDLEtBQUssQ0FBQyxDQUFBLEdBQUcsQ0FBQSxDQUFBLENBQUE7QUFDVixBQUFBLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQSxBQUFDLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUE7QUFDckQsQUFBQSxFQUFFLE1BQU0sQ0FBQyxLO0NBQUssQztBQUFBLENBQUE7QUFDZCIsIm5hbWVzIjpbXSwic291cmNlc0NvbnRlbnQiOlsiIyB2OC1zdGFjay5jaXZldFxyXG5cclxuaW1wb3J0IHBhdGhMaWIgZnJvbSAncGF0aCdcclxuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xyXG5pbXBvcnQgc21zIGZyb20gJ3NvdXJjZS1tYXAtc3VwcG9ydCdcclxuaW1wb3J0IHtzcHJpbnRmfSBmcm9tICdAc3RkL2ZtdC9wcmludGYnXHJcblxyXG5pbXBvcnQge1xyXG5cdHVuZGVmLCBkZWZpbmVkLCBub3RkZWZpbmVkLCBpc0VtcHR5LCBub25FbXB0eSxcclxuXHRhc3NlcnQsIGNyb2FrLCBoYXNLZXksIE9MLCBNTCwgZ2V0T3B0aW9ucyxcclxuXHRpc1N0cmluZywgaXNOb25FbXB0eVN0cmluZywgaXNJbnRlZ2VyLCBycGFkLCBjZW50ZXJlZCxcclxuXHRpc0ZpbGUsIG1rcGF0aCwgZmlsZUV4dCwgd2l0aEV4dCwgbm9ybWFsaXplUGF0aCwgcmVscGF0aCxcclxuXHREQkcsIExPRywgV0FSTiwgRVJSLCBJTkRFTlQsIFVOREVOVCxcclxuXHR9IGZyb20gJ0BqZGVpZ2hhbi91dGlscy9sbHV0aWxzLmpzJ1xyXG5cclxuc21zLmluc3RhbGwoKVxyXG5tYXBTb3VyY2VQb3NpdGlvbiA6PSBzbXMubWFwU291cmNlUG9zaXRpb25cclxud2lkdGggOj0gNDBcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgU3RhY2sgRnJhbWVzIGhhdmUga2V5czpcclxuIyAgICB0eXBlICAgICAgICAgLSBldmFsIHwgbmF0aXZlIHwgY29uc3RydWN0b3IgfCBtZXRob2QgfCBmdW5jdGlvbiB8IHNjcmlwdFxyXG4jICAgIHNvdXJjZVxyXG4jICAgIGxpbmVcclxuIyAgICBjb2x1bW5cclxuIyAgICBuYW1lICAgICAgICAgIC0gbmFtZSBvZiBmdW5jdGlvbiBvciBtZXRob2RcclxuIyAgICBpc0NvbnN0cnVjdG9yIC0gdHJ1ZSBpZiBhIGNvbnN0cnVjdG9yIGZ1bmN0aW9uXHJcbiMgICAgaXNBc3luYyAgICAgICAtIHRydWUgaWYgYW4gYXN5bmMgZnVuY3Rpb24vbWV0aG9kXHJcbiMgICAgb2JqVHllICAgICAgICAtIGlmIHR5cGUgPT0gJ21ldGhvZCdcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZ2V0VjhTdGFjayA9ICgpID0+XHJcblx0IyAtLS0gaWdub3JlcyBhbnkgc3RhY2sgZnJhbWVzIGZyb20gdGhpcyBtb2R1bGVcclxuXHQjICAgICAqLmpzIGZpbGVzIHdpbGwgYmUgbWFwcGVkIHRvIG9yaWdpbmFsIHNvdXJjZSBmaWxlc1xyXG5cdCMgICAgICAgIGlmIGEgc291cmNlIG1hcCBpcyBhdmFpbGFibGVcclxuXHJcblx0dHJ5XHJcblx0XHRvbGRMaW1pdCA6PSBFcnJvci5zdGFja1RyYWNlTGltaXRcclxuXHRcdG9sZFByZXBhcmVyIDo9IEVycm9yLnByZXBhcmVTdGFja1RyYWNlXHJcblxyXG5cdFx0RXJyb3Iuc3RhY2tUcmFjZUxpbWl0ID0gSW5maW5pdHlcclxuXHRcdEVycm9yLnByZXBhcmVTdGFja1RyYWNlID0gKGVycm9yLCBsRnJhbWVzKSA9PlxyXG5cdFx0XHRsUmVzdWx0RnJhbWVzIDo9IFtdXHJcblx0XHRcdERCRyBcImdldFY4U3RhY2soKTogI3tsRnJhbWVzLmxlbmd0aH0gc3RhY2sgZnJhbWVzXCJcclxuXHRcdFx0Zm9yIGZyYW1lLGkgb2YgbEZyYW1lc1xyXG5cclxuXHRcdFx0XHREQkcgXCJGUkFNRSAje2l9XCIsIElOREVOVFxyXG5cclxuXHRcdFx0XHQjIC0tLSBDYWxsIGZ1bmN0aW9ucyBvbiB0aGUgZnJhbWVcclxuXHRcdFx0XHRmaWxlTmFtZSAgICAgIDo9IGZyYW1lLmdldEZpbGVOYW1lKClcclxuXHRcdFx0XHRmdW5jdGlvbk5hbWUgIDo9IGZyYW1lLmdldEZ1bmN0aW9uTmFtZSgpXHJcblx0XHRcdFx0ZnVuY3Rpb25PYmogICA6PSBmcmFtZS5nZXRGdW5jdGlvbigpXHJcblx0XHRcdFx0bWV0aG9kTmFtZSAgICA6PSBmcmFtZS5nZXRNZXRob2ROYW1lKClcclxuXHRcdFx0XHRsaW5lICAgICAgICAgIDo9IGZyYW1lLmdldExpbmVOdW1iZXIoKVxyXG5cdFx0XHRcdGNvbHVtbiAgICAgICAgOj0gZnJhbWUuZ2V0Q29sdW1uTnVtYmVyKClcclxuXHRcdFx0XHRpc1RvcExldmVsICAgIDo9IGZyYW1lLmlzVG9wbGV2ZWwoKVxyXG5cdFx0XHRcdGlzQXN5bmMgICAgICAgOj0gZnJhbWUuaXNBc3luYygpXHJcblx0XHRcdFx0aXNFdmFsICAgICAgICA6PSBmcmFtZS5pc0V2YWwoKVxyXG5cdFx0XHRcdGlzTmF0aXZlICAgICAgOj0gZnJhbWUuaXNOYXRpdmUoKVxyXG5cdFx0XHRcdGlzQ29uc3RydWN0b3IgOj0gZnJhbWUuaXNDb25zdHJ1Y3RvcigpXHJcblx0XHRcdFx0dHlwZU5hbWUgICAgICA6PSBmcmFtZS5nZXRUeXBlTmFtZSgpXHJcblxyXG5cdFx0XHRcdERCRyBjZW50ZXJlZCgnZnJvbSBWOCcsIHdpZHRoLCAnLScpXHJcblx0XHRcdFx0REJHIFwiZmlsZU5hbWUgPSAje09MKGZpbGVOYW1lKX1cIlxyXG5cdFx0XHRcdERCRyBcImZ1bmN0aW9uTmFtZSA9ICN7T0woZnVuY3Rpb25OYW1lKX1cIlxyXG5cdFx0XHRcdERCRyBcImRlZmluZWQoZnVuY3Rpb25PYmopID0gI3tPTChkZWZpbmVkKGZ1bmN0aW9uT2JqKSl9XCJcclxuXHRcdFx0XHREQkcgXCJtZXRob2ROYW1lID0gI3tPTChtZXRob2ROYW1lKX1cIlxyXG5cdFx0XHRcdERCRyBcImxpbmUgPSAje09MKGxpbmUpfVwiXHJcblx0XHRcdFx0REJHIFwiY29sdW1uID0gI3tPTChjb2x1bW4pfVwiXHJcblx0XHRcdFx0REJHIFwiaXNUb3BMZXZlbCA9ICN7T0woaXNUb3BMZXZlbCl9XCJcclxuXHRcdFx0XHREQkcgXCJpc0FzeW5jID0gI3tPTChpc0FzeW5jKX1cIlxyXG5cdFx0XHRcdERCRyBcImlzRXZhbCA9ICN7T0woaXNFdmFsKX1cIlxyXG5cdFx0XHRcdERCRyBcImlzTmF0aXZlID0gI3tPTChpc05hdGl2ZSl9XCJcclxuXHRcdFx0XHREQkcgXCJpc0NvbnN0cnVjdG9yID0gI3tPTChpc0NvbnN0cnVjdG9yKX1cIlxyXG5cdFx0XHRcdERCRyBcInR5cGVOYW1lID0gI3tPTCh0eXBlTmFtZSl9XCJcclxuXHRcdFx0XHREQkcgJy0nLnJlcGVhdCh3aWR0aClcclxuXHJcblx0XHRcdFx0c291cmNlIDo9IGZpbGVOYW1lXHJcblx0XHRcdFx0aWYgZGVmaW5lZChzb3VyY2UpICYmIChzb3VyY2UuaW5kZXhPZigndjgtc3RhY2suanMnKSAgPj0gMClcclxuXHRcdFx0XHRcdERCRyBcIlNLSVA6IHNvdXJjZSA9ICcje3NvdXJjZX0nXCIsIFVOREVOVFxyXG5cdFx0XHRcdFx0Y29udGludWVcclxuXHJcblx0XHRcdFx0aCA6PSB7XHJcblx0XHRcdFx0XHRzb3VyY2VcclxuXHRcdFx0XHRcdGxpbmVcclxuXHRcdFx0XHRcdGNvbHVtblxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiBkZWZpbmVkKGZ1bmN0aW9uTmFtZSlcclxuXHRcdFx0XHRcdGgubmFtZSA9IGZ1bmN0aW9uTmFtZVxyXG5cdFx0XHRcdGVsc2UgaWYgZGVmaW5lZChmdW5jdGlvbk9iailcclxuXHRcdFx0XHRcdGgubmFtZSA9ICc8YW5vbnltb3VzPidcclxuXHJcblx0XHRcdFx0aWYgZGVmaW5lZChtZXRob2ROYW1lKVxyXG5cdFx0XHRcdFx0aC5uYW1lID0gbWV0aG9kTmFtZVxyXG5cclxuXHRcdFx0XHQjIC0tLSBTZXQgdHlwZVxyXG5cdFx0XHRcdGgudHlwZSA9IChcclxuXHRcdFx0XHRcdCAgaXNFdmFsICAgICAgICAgICAgICAgICAgPyAnZXZhbCdcclxuXHRcdFx0XHRcdDogaXNOYXRpdmUgICAgICAgICAgICAgICAgPyAnbmF0aXZlJ1xyXG5cdFx0XHRcdFx0OiBpc0NvbnN0cnVjdG9yICAgICAgICAgICA/ICdjb25zdHJ1Y3RvcidcclxuXHRcdFx0XHRcdDogZGVmaW5lZChtZXRob2ROYW1lKSAgID8gJ21ldGhvZCdcclxuXHRcdFx0XHRcdDogZGVmaW5lZChmdW5jdGlvbk5hbWUpID8gJ2Z1bmN0aW9uJ1xyXG5cdFx0XHRcdFx0OiBpc1RvcExldmVsICAgICAgICAgICAgICA/ICdzY3JpcHQnXHJcblx0XHRcdFx0XHQ6ICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JvYWsoJ1Vua25vd24gZnJhbWUgdHlwZScpXHJcblx0XHRcdFx0XHQpXHJcblxyXG5cdFx0XHRcdGlmIGlzQ29uc3RydWN0b3JcclxuXHRcdFx0XHRcdGguaXNDb25zdHJ1Y3RvciA9IHRydWVcclxuXHJcblx0XHRcdFx0aWYgaXNBc3luY1xyXG5cdFx0XHRcdFx0aC5pc0FzeW5jID0gdHJ1ZVxyXG5cclxuXHRcdFx0XHRpZiAoaC50eXBlID09ICdtZXRob2QnKVxyXG5cdFx0XHRcdFx0aC5vYmpUeXBlID0gdHlwZU5hbWVcclxuXHJcblx0XHRcdFx0IyAtLS0gZml4IGEgYnVnIGluIHRoZSBWOCBlbmdpbmUgd2hlcmUgY2FsbHMgaW5zaWRlIGFcclxuXHRcdFx0XHQjICAgICB0b3AgbGV2ZWwgYW5vbnltb3VzIGZ1bmN0aW9uIGlzIHJlcG9ydGVkIGFzXHJcblx0XHRcdFx0IyAgICAgYmVpbmcgZnJvbSB0aGUgdG9wIGxldmVsLCBpLmUuIHR5cGUgJ3NjcmlwdCdcclxuXHJcblx0XHRcdFx0aWYgKGxSZXN1bHRGcmFtZXMubGVuZ3RoID4gMClcclxuXHRcdFx0XHRcdHRvcyA6PSBsUmVzdWx0RnJhbWVzLmF0KC0xKSAgICAjIC0tLSBpLmUuIHByZXZpb3VzIGZyYW1lXHJcblx0XHRcdFx0XHRpZiAoaC50eXBlID09ICdzY3JpcHQnKSAmJiAodG9zLnR5cGUgPT0gJ3NjcmlwdCcpXHJcblx0XHRcdFx0XHRcdERCRyBcIlBhdGNoIGN1cnJlbnQgVE9TIChjdXJyZW50bHkgI3tsUmVzdWx0RnJhbWVzLmxlbmd0aH0gZnJhbWVzKVwiXHJcblx0XHRcdFx0XHRcdHRvcy50eXBlID0gJ2Z1bmN0aW9uJ1xyXG5cdFx0XHRcdFx0XHR0b3MubmFtZSA9ICc8YW5vbnltb3VzPidcclxuXHJcblx0XHRcdFx0REJHIGNlbnRlcmVkKCdyZXR1cm4gZnJhbWUnLCB3aWR0aCwgJy0nKVxyXG5cdFx0XHRcdERCRyBNTChoKVxyXG5cdFx0XHRcdERCRyAnLScucmVwZWF0KHdpZHRoKVxyXG5cclxuXHRcdFx0XHQjIC0tLSBJZ25vcmUgdGhpcyBlbnRyeSBhbmQgYW55IGJlZm9yZSBpdFxyXG5cdFx0XHRcdGlmIChoLm9ialR5cGUgPT0gJ01vZHVsZUpvYicpXHJcblx0XHRcdFx0XHREQkcgXCJvYmpUeXBlIGlzICdNb2R1bGVKb2InIC0gc3RvcCBwcm9jZXNzaW5nXCJcclxuXHRcdFx0XHRcdGJyZWFrXHJcblxyXG5cdFx0XHRcdGxSZXN1bHRGcmFtZXMucHVzaCBoXHJcblx0XHRcdFx0REJHIFVOREVOVFxyXG5cclxuXHRcdFx0REJHICctJy5yZXBlYXQod2lkdGgpXHJcblx0XHRcdHJldHVybiBsUmVzdWx0RnJhbWVzXHJcblxyXG5cdFx0ZXJyT2JqIDo9IG5ldyBFcnJvcigpXHJcblx0XHRsU3RhY2sgOj0gZXJyT2JqLnN0YWNrXHJcblxyXG5cdFx0IyAtLS0gcmVzZXQgdG8gcHJldmlvdXMgdmFsdWVzXHJcblx0XHRFcnJvci5zdGFja1RyYWNlTGltaXQgPSBvbGRMaW1pdFxyXG5cdFx0RXJyb3IucHJlcGFyZVN0YWNrVHJhY2UgPSBvbGRQcmVwYXJlclxyXG5cclxuXHRcdGZvciBoIG9mIGxTdGFja1xyXG5cdFx0XHREQkcgXCJiZWZvcmUgbWFwcGluZywgaCA9ICN7TUwoaCl9XCJcclxuXHRcdFx0e3NvdXJjZSwgbGluZSwgY29sdW1uLCBuYW1lLCB0eXBlfSA6PSBoXHJcblx0XHRcdGhOZXcgOj0gbWFwU291cmNlUG9zaXRpb24ge1xyXG5cdFx0XHRcdHNvdXJjZVxyXG5cdFx0XHRcdGxpbmVcclxuXHRcdFx0XHRjb2x1bW5cclxuXHRcdFx0XHR9XHJcblx0XHRcdG5ld0V4dCA6PSBmaWxlRXh0KGhOZXcuc291cmNlKVxyXG5cdFx0XHRpZiAobmV3RXh0ID09IGZpbGVFeHQoaC5zb3VyY2UpKVxyXG5cdFx0XHRcdERCRyBcIk5vdCBtYXBwZWQgLSByZXR1cm5pbmcgb3JpZ2luYWwgcG9zaXRpb25cIlxyXG5cdFx0XHRcdGguc291cmNlID0gcmVscGF0aChoLnNvdXJjZSlcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdERCRyBcImdvdCwgaE5ldyA9ICN7TUwoaE5ldyl9XCJcclxuXHRcdFx0XHRoLnNvdXJjZSA9IHJlbHBhdGgod2l0aEV4dChoLnNvdXJjZSwgbmV3RXh0KSlcclxuXHRcdFx0XHRoLmxpbmUgPSBoTmV3LmxpbmVcclxuXHRcdFx0XHRoLmNvbHVtbiA9IGhOZXcuY29sdW1uXHJcblx0XHRcdFx0REJHIFwiYWZ0ZXIgbWFwcGluZywgaCA9ICN7TUwoaCl9XCJcclxuXHJcblx0XHRyZXR1cm4gbFN0YWNrXHJcblx0Y2F0Y2ggZVxyXG5cdFx0RVJSIGUubWVzc2FnZVxyXG5cdFx0cmV0dXJuIFtdXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGdldFY4U3RhY2tTdHIgOj0gKGhPcHRpb25zPXt9KSA9PlxyXG5cdCMgLS0tIGlnbm9yZXMgYW55IHN0YWNrIGZyYW1lcyBmcm9tIHRoaXMgbW9kdWxlXHJcblx0IyAgICAgKi5qcyBmaWxlcyB3aWxsIGJlIG1hcHBlZCB0byBvcmlnaW5hbCBzb3VyY2UgZmlsZXNcclxuXHQjICAgICAgICBpZiBhIHNvdXJjZSBtYXAgaXMgYXZhaWxhYmxlXHJcblxyXG5cdGxMaW5lcyA6PSBnZXRWOFN0YWNrKCkubWFwKChoKSA9PlxyXG5cdFx0dHlwZVN0ciA6PSBzcHJpbnRmKFwiJS0xMXNcIiwgaC50eXBlKVxyXG5cdFx0cmV0dXJuIFwiWyN7dHlwZVN0cn1dICN7aC5zb3VyY2V9OiN7aC5saW5lfToje2guY29sdW1ufVwiXHJcblx0XHQpXHJcblx0cmV0dXJuIGxMaW5lcy5qb2luKCdcXG4nKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBnZXRNeUNhbGxlciA6PSAoKSA9PlxyXG5cclxuXHR0cnlcclxuXHRcdGxTdGFjayA6PSBnZXRWOFN0YWNrKClcclxuXHRcdHJldHVybiBsU3RhY2tbMV1cclxuXHRjYXRjaCBlcnJcclxuXHRcdGNvbnNvbGUubG9nIFwiRVJST1IgaW4gZ2V0VjhTdGFjaygpOiAje2Vyci5tZXNzYWdlfVwiXHJcblx0XHRyZXR1cm4gdW5kZWZcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZ2V0TXlPdXRzaWRlQ2FsbGVyIDo9ICgpID0+XHJcblxyXG5cdHRyeVxyXG5cdFx0bFN0YWNrIDo9IGdldFY4U3RhY2soKVxyXG5cdFx0REJHIFwiQ2FsbCBzdGFjayBoYXMgI3tsU3RhY2subGVuZ3RofSBpdGVtc1wiXHJcblx0XHRzb3VyY2UgOj0gbFN0YWNrWzBdLnNvdXJjZVxyXG5cdFx0REJHIFwic291cmNlID0gI3tzb3VyY2V9XCJcclxuXHRcdGZvciBmcmFtZSxpIG9mIGxTdGFja1xyXG5cdFx0XHREQkcgXCJmcmFtZVsje2l9XS5zb3VyY2UgPSAje2ZyYW1lLnNvdXJjZX1cIlxyXG5cdFx0XHRpZiAoZnJhbWUuc291cmNlICE9IHNvdXJjZSlcclxuXHRcdFx0XHRyZXR1cm4gZnJhbWVcclxuXHRcdHJldHVybiB1bmRlZlxyXG5cdGNhdGNoIGVyclxyXG5cdFx0Y29uc29sZS5sb2cgXCJFUlJPUiBpbiBnZXRWOFN0YWNrKCk6ICN7ZXJyLm1lc3NhZ2V9XCJcclxuXHRcdHJldHVybiB1bmRlZlxyXG4iXX0=