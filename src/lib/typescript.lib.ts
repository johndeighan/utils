"use strict";
// typescript.lib.civet

import {
	CompilerOptions, createProgram, createSourceFile,
	getPreEmitDiagnostics, createPrinter, EmitHint,
	getLineAndCharacterOfPosition, flattenDiagnosticMessageText,
	ScriptTarget, ModuleKind, SourceFile, Diagnostic,
	Node, SyntaxKind, forEachChild, NewLineKind,
	} from "typescript"

import {
	undef, defined, notdefined, assert, hash,
	isString, isNumber, isBoolean, isPrimitive, isArray,
	stringify,
	} from './datatypes.lib.ts'
import {
	croak, pass, keys, hasKey, hasKeys, truncStr, OL, spaces,
	NodeGenerator, getOptions, o,
	} from './llutils.lib.ts'
import {
	DBG, LOG, WARN, ERR, DBGVALUE, LOGVALUE,
	pushLogLevel, popLogLevel,
	} from './logger.lib.ts'
import {
	isFile, fileExt, withExt, slurp, barf,
	} from './fs.lib.ts'
import {
	execCmdSync,
	} from './exec.lib.ts'
import {hDefConfig} from './ts.config.ts'

// ---------------------------------------------------------------------------

/**
 * ts2ast() - convert TypeScript code to an AST
 */

export const ts2ast = (tsCode: string): SourceFile => {

	return createSourceFile("x.ts", tsCode, ScriptTarget.Latest)
}

// ---------------------------------------------------------------------------

export const ast2ts = (node: SourceFile): string => {

	const printer = createPrinter({newLine: NewLineKind.LineFeed})
	const result = printer.printNode(EmitHint.Unspecified, node, node)
	return result
}

// ---------------------------------------------------------------------------

export const typeCheckFiles = (
	lFileNames: string | string[],
	hOptions: CompilerOptions = hDefConfig
	): string[] => {

	DBGVALUE('lFileNames', lFileNames)
	DBGVALUE('hOptions', hOptions)

	if (isString(lFileNames)) {
		lFileNames = [lFileNames]
	}
	const program = createProgram(lFileNames, hOptions)
	const emitResult = program.emit()

	const lMsgs: string[] = []
	getPreEmitDiagnostics(program).forEach((diag) => {
		const {file, start, messageText} = diag
		const msg = flattenDiagnosticMessageText(messageText, "\n")
		if (file) {
			const {fileName} = file
			const {line, character} = getLineAndCharacterOfPosition(file, start!)
			lMsgs.push(`${fileName}:(${line+1}:${character+1}): ${msg}`)
		}
		else {
			lMsgs.push(msg)
		}
	})
	return lMsgs
}

export var typeCheckFile = typeCheckFiles   // --- synonym

// ---------------------------------------------------------------------------

export const pprintNode = (
		source: SourceFile,
		node: Node,
		depth: number
		) => {

	const kind = SyntaxKind[node.kind]
	const text = node.getText(source).replaceAll('\n', '\\n')
	const pre = spaces(3 * depth)
	return `${pre}${kind} - '${truncStr(text, 32)}'`
}

// ---------------------------------------------------------------------------

export const pprintAST = (source: SourceFile, pprint=pprintNode): string => {

	const lLines: string[] = []

	const traverse = (node: Node, depth=0): void => {
		lLines.push(pprint(source, node, depth))
		forEachChild(node, (childNode) => traverse(childNode, depth + 1))
		return
	}

	traverse(source)
	return lLines.join('\n')
}

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi90eXBlc2NyaXB0LmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9saWIvdHlwZXNjcmlwdC5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSx1QkFBc0I7QUFDdEIsQUFBQTtBQUNBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLGVBQWUsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLGdCQUFnQixDQUFDO0FBQ2xELENBQUMscUJBQXFCLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxRQUFRLENBQUM7QUFDaEQsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLDRCQUE0QixDQUFDO0FBQzdELENBQUMsWUFBWSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsVUFBVSxDQUFDO0FBQ2xELENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsV0FBVyxDQUFDO0FBQzdDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZO0FBQ3BCLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQztBQUMxQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLE9BQU8sQ0FBQztBQUNyRCxDQUFDLFNBQVMsQ0FBQztBQUNYLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxvQkFBb0I7QUFDNUIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDMUQsQ0FBQyxh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QUFVLE1BQVQsU0FBUyxDQUFDLENBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN0RSxBQUFBO0FBQ0EsQUFBQSxDQUFpQixNQUFoQixNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdkIsQUFBQTtBQUNBLEFBQUEsQ0FBUyxNQUFSLFFBQVEsQ0FBQyxDQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDM0MsQUFBQSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUEsQUFBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUE7QUFDekMsQUFBQSxFQUFFLFlBQVksQ0FBQSxBQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xFLEFBQUEsRUFBRSxNO0NBQU0sQ0FBQTtBQUNSLEFBQUE7QUFDQSxBQUFBLENBQUMsUUFBUSxDQUFBLEFBQUMsTUFBTSxDQUFBO0FBQ2hCLEFBQUEsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEM7QUFBQyxDQUFBO0FBQ3pCIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIHR5cGVzY3JpcHQubGliLmNpdmV0XG5cbmltcG9ydCB7XG5cdENvbXBpbGVyT3B0aW9ucywgY3JlYXRlUHJvZ3JhbSwgY3JlYXRlU291cmNlRmlsZSxcblx0Z2V0UHJlRW1pdERpYWdub3N0aWNzLCBjcmVhdGVQcmludGVyLCBFbWl0SGludCxcblx0Z2V0TGluZUFuZENoYXJhY3Rlck9mUG9zaXRpb24sIGZsYXR0ZW5EaWFnbm9zdGljTWVzc2FnZVRleHQsXG5cdFNjcmlwdFRhcmdldCwgTW9kdWxlS2luZCwgU291cmNlRmlsZSwgRGlhZ25vc3RpYyxcblx0Tm9kZSwgU3ludGF4S2luZCwgZm9yRWFjaENoaWxkLCBOZXdMaW5lS2luZCxcblx0fSBmcm9tIFwidHlwZXNjcmlwdFwiXG5cbmltcG9ydCB7XG5cdHVuZGVmLCBkZWZpbmVkLCBub3RkZWZpbmVkLCBhc3NlcnQsIGhhc2gsXG5cdGlzU3RyaW5nLCBpc051bWJlciwgaXNCb29sZWFuLCBpc1ByaW1pdGl2ZSwgaXNBcnJheSxcblx0c3RyaW5naWZ5LFxuXHR9IGZyb20gJy4vZGF0YXR5cGVzLmxpYi50cydcbmltcG9ydCB7XG5cdGNyb2FrLCBwYXNzLCBrZXlzLCBoYXNLZXksIGhhc0tleXMsIHRydW5jU3RyLCBPTCwgc3BhY2VzLFxuXHROb2RlR2VuZXJhdG9yLCBnZXRPcHRpb25zLCBvLFxuXHR9IGZyb20gJy4vbGx1dGlscy5saWIudHMnXG5pbXBvcnQge1xuXHREQkcsIExPRywgV0FSTiwgRVJSLCBEQkdWQUxVRSwgTE9HVkFMVUUsXG5cdHB1c2hMb2dMZXZlbCwgcG9wTG9nTGV2ZWwsXG5cdH0gZnJvbSAnLi9sb2dnZXIubGliLnRzJ1xuaW1wb3J0IHtcblx0aXNGaWxlLCBmaWxlRXh0LCB3aXRoRXh0LCBzbHVycCwgYmFyZixcblx0fSBmcm9tICcuL2ZzLmxpYi50cydcbmltcG9ydCB7XG5cdGV4ZWNDbWRTeW5jLFxuXHR9IGZyb20gJy4vZXhlYy5saWIudHMnXG5pbXBvcnQge2hEZWZDb25maWd9IGZyb20gJy4vdHMuY29uZmlnLnRzJ1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIHRzMmFzdCgpIC0gY29udmVydCBUeXBlU2NyaXB0IGNvZGUgdG8gYW4gQVNUXG4gKi9cblxuZXhwb3J0IHRzMmFzdCA6PSAodHNDb2RlOiBzdHJpbmcpOiBTb3VyY2VGaWxlID0+XG5cblx0cmV0dXJuIGNyZWF0ZVNvdXJjZUZpbGUoXCJ4LnRzXCIsIHRzQ29kZSwgU2NyaXB0VGFyZ2V0LkxhdGVzdClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGFzdDJ0cyA6PSAobm9kZTogU291cmNlRmlsZSk6IHN0cmluZyA9PlxuXG5cdHByaW50ZXIgOj0gY3JlYXRlUHJpbnRlciB7bmV3TGluZTogTmV3TGluZUtpbmQuTGluZUZlZWR9XG5cdHJlc3VsdCA6PSBwcmludGVyLnByaW50Tm9kZSBFbWl0SGludC5VbnNwZWNpZmllZCwgbm9kZSwgbm9kZVxuXHRyZXR1cm4gcmVzdWx0XG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCB0eXBlQ2hlY2tGaWxlcyA6PSAoXG5cdGxGaWxlTmFtZXM6IHN0cmluZyB8IHN0cmluZ1tdLFxuXHRoT3B0aW9uczogQ29tcGlsZXJPcHRpb25zID0gaERlZkNvbmZpZ1xuXHQpOiBzdHJpbmdbXSA9PlxuXG5cdERCR1ZBTFVFICdsRmlsZU5hbWVzJywgbEZpbGVOYW1lc1xuXHREQkdWQUxVRSAnaE9wdGlvbnMnLCBoT3B0aW9uc1xuXG5cdGlmIGlzU3RyaW5nKGxGaWxlTmFtZXMpXG5cdFx0bEZpbGVOYW1lcyA9IFtsRmlsZU5hbWVzXVxuXHRwcm9ncmFtIDo9IGNyZWF0ZVByb2dyYW0obEZpbGVOYW1lcywgaE9wdGlvbnMpXG5cdGVtaXRSZXN1bHQgOj0gcHJvZ3JhbS5lbWl0KClcblxuXHRsTXNnczogc3RyaW5nW10gOj0gW11cblx0Z2V0UHJlRW1pdERpYWdub3N0aWNzKHByb2dyYW0pLmZvckVhY2ggKGRpYWcpID0+XG5cdFx0e2ZpbGUsIHN0YXJ0LCBtZXNzYWdlVGV4dH0gOj0gZGlhZ1xuXHRcdG1zZyA6PSBmbGF0dGVuRGlhZ25vc3RpY01lc3NhZ2VUZXh0IG1lc3NhZ2VUZXh0LCBcIlxcblwiXG5cdFx0aWYgKGZpbGUpXG5cdFx0XHR7ZmlsZU5hbWV9IDo9IGZpbGVcblx0XHRcdHtsaW5lLCBjaGFyYWN0ZXJ9IDo9IGdldExpbmVBbmRDaGFyYWN0ZXJPZlBvc2l0aW9uIGZpbGUsIHN0YXJ0IVxuXHRcdFx0bE1zZ3MucHVzaCBcIiN7ZmlsZU5hbWV9Oigje2xpbmUrMX06I3tjaGFyYWN0ZXIrMX0pOiAje21zZ31cIlxuXHRcdGVsc2Vcblx0XHRcdGxNc2dzLnB1c2ggbXNnXG5cdHJldHVybiBsTXNnc1xuXG5leHBvcnQgdHlwZUNoZWNrRmlsZSA9IHR5cGVDaGVja0ZpbGVzICAgIyAtLS0gc3lub255bVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgcHByaW50Tm9kZSA6PSAoXG5cdFx0c291cmNlOiBTb3VyY2VGaWxlLFxuXHRcdG5vZGU6IE5vZGUsXG5cdFx0ZGVwdGg6IG51bWJlclxuXHRcdCkgPT5cblxuXHRraW5kIDo9IFN5bnRheEtpbmRbbm9kZS5raW5kXVxuXHR0ZXh0IDo9IG5vZGUuZ2V0VGV4dChzb3VyY2UpLnJlcGxhY2VBbGwoJ1xcbicsICdcXFxcbicpXG5cdHByZSA6PSBzcGFjZXMoMyAqIGRlcHRoKVxuXHRyZXR1cm4gXCIje3ByZX0je2tpbmR9IC0gJyN7dHJ1bmNTdHIodGV4dCwgMzIpfSdcIlxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgcHByaW50QVNUIDo9IChzb3VyY2U6IFNvdXJjZUZpbGUsIHBwcmludD1wcHJpbnROb2RlKTogc3RyaW5nID0+XG5cblx0bExpbmVzOiBzdHJpbmdbXSA6PSBbXVxuXG5cdHRyYXZlcnNlIDo9IChub2RlOiBOb2RlLCBkZXB0aD0wKTogdm9pZCA9PlxuXHRcdGxMaW5lcy5wdXNoIHBwcmludChzb3VyY2UsIG5vZGUsIGRlcHRoKVxuXHRcdGZvckVhY2hDaGlsZCBub2RlLCAoY2hpbGROb2RlKSA9PiB0cmF2ZXJzZShjaGlsZE5vZGUsIGRlcHRoICsgMSlcblx0XHRyZXR1cm5cblxuXHR0cmF2ZXJzZSBzb3VyY2Vcblx0cmV0dXJuIGxMaW5lcy5qb2luKCdcXG4nKVxuIl19