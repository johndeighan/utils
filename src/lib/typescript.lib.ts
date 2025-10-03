"use strict";
// typescript.lib.civet

import {cyan, blue} from "@std/fmt/colors"
import {existsSync} from '@std/fs'
import {statSync} from 'node:fs'
import {
	SourceFile, Node, ScriptTarget, SyntaxKind, ModuleKind,
	NewLineKind, EmitHint, CompilerOptions, ModuleResolutionKind,
	createSourceFile, createPrinter, createProgram, transpileModule,
	getPreEmitDiagnostics, flattenDiagnosticMessageText,
	getLineAndCharacterOfPosition, forEachChild,
	} from "npm:typescript"

import {sep} from 'base-utils'
import {
	undef, defined, notdefined, integer, TStringGenerator,
	hash, hashof, isHash, TFilterFunc, isString,
	isEmpty, nonEmpty, TConstructor, assert, croak,
	} from 'datatypes'
import {
	truncStr, getOptions, spaces, o, words, hasKey,
	stringify, CStringSetMap, keys, blockify,
	} from 'llutils'
import {
	extract, TPathItem, getString, getNumber, getArray,
	} from 'extract'
import {indented, TBlockDesc, Blockify} from 'indent'
import {
	LOG, DBG, LOGVALUE, INDENT, UNDENT, DBGVALUE,
	} from 'logger'
import {slurp, barf, barfTempFile, fileExt} from 'fsys'
import {OL, toNice, TMapFunc} from 'to-nice'
import {getCmdOutputSync} from 'exec'
import {stripSrcMap} from 'source-map'
import {getNeededImportStmts} from 'symbols'
import {Walker, TVisitKind} from 'walker'
import {CScopeStack} from 'scope-stack'

const decoder = new TextDecoder("utf-8")

// ---------------------------------------------------------------------------

export const kindStr = (i: number): string => {

	return SyntaxKind[i]
}

// ---------------------------------------------------------------------------

export const ts2ast = (
		tsCode: string,
		hOptions: hash = {}
		): Node => {

	type opt = {
		fileName: string
		}
	const {fileName} = getOptions<opt>(hOptions, {
		fileName: 'temp.ts'
		})

	tsCode = stripSrcMap(tsCode)[0]
	const hAst = createSourceFile(fileName, tsCode, ScriptTarget.Latest)
	const filter: TFilterFunc = (x: unknown) => {
		return (
			   (typeof x === 'object')
			&& (x !== null)
			&& ('kind' in x)
			&& (typeof x.kind === 'number')
			)
	}
	return hAst
}

// ---------------------------------------------------------------------------

export const ast2ts = (node: Node): string => {

	assert((node.kind === 308), "Not a SourceFile node")
	const printer = createPrinter({newLine: NewLineKind.LineFeed})
	return printer.printNode(EmitHint.Unspecified, node, node as SourceFile)
}

// ---------------------------------------------------------------------------

export const typeCheckFiles = (
		lFileNames: string | string[],
		hOptions: CompilerOptions = hDefConfig
		): string[] => {

	if (typeof lFileNames === 'string') {
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

export const tsMapFunc: TMapFunc = (
		key: string,
		value: unknown,
		hParent: hash
		): unknown => {

	if ((key === 'kind') && (typeof value === 'number')) {
		const desc = cyan(' (' + kindStr(value) + ')')
		return value.toString() + desc
	}
	return undef
}

// ---------------------------------------------------------------------------

export const astAsString = (
		hAst: Node,
		hOptions: hash = {}
		): string => {

	return toNice(hAst, {
		ignoreEmptyValues: true,
		mapFunc: tsMapFunc,
		lInclude: hOptions.lInclude,
		lExclude: words(
			'pos end id flags modifierFlagsCache',
			'transformFlags hasExtendedUnicodeEscape',
			'numericLiteralFlags setExternalModuleIndicator',
			'languageVersion languageVariant jsDocParsingMode',
			'hasNoDefaultLib'
			)
		})
}

// ---------------------------------------------------------------------------

export const typeCheckCode = (
		tsCode: string
		): ((string[]) | undefined) => {

	// --- We must place the TypeScript file at the project root
	//     so that paths gotten from .symbols resolve correctly

	const path = "./_typecheck_.ts"
	barf(path, tsCode)
	const hResult = getCmdOutputSync('deno', [
			'check',
			'--import-map', 'import_map.jsonc',
			path
			])
	const {success, code, stdout, stderr} = hResult
	if (success && (code === 0)) {
		return []
	}
	else if (defined(stderr)) {
		return [stderr]
	}
	else {
		return ['Unknown error']
	}
}

// ---------------------------------------------------------------------------

export const checkType = (
		value: unknown,
		typeStr: string,
		expectSuccess: boolean = true
		): string[] => {

	DBG("CALL checkType():", INDENT)

	const tsCode = getTsCode(typeStr, stringify(value))
	DBGVALUE('tsCode', tsCode)

	// --- check if we need to import the type
	const importCode = getImportCode(typeStr)
	DBGVALUE('importCode', importCode)

	const code = `${importCode}\n${tsCode}`
	const lDiagnostics = typeCheckCode(code)
	if (expectSuccess && nonEmpty(lDiagnostics)) {
		LOG("typeCheckCode FAILED:")
		LOG("CODE:")
		LOG(code)
		LOGVALUE('lDiagnostics', lDiagnostics)
	}
	else if (!expectSuccess && isEmpty(lDiagnostics)) {
		LOG("typeCheckCode SUCCEEDED:")
		LOG("CODE:")
		LOG(code)
	}
	DBG(UNDENT)
	return lDiagnostics || []
}

// ---------------------------------------------------------------------------
// --- We need to add ':unknown' to any function parameters
//     that don't have an explicit type

export const getTsCode = (
		typeStr: string,
		valueStr: string
		): string => {

	DBGVALUE('typeStr', typeStr)
	DBGVALUE('valueStr', valueStr)
	const result = splitFuncStr(valueStr)
	if (defined(result)) {
		const [lParms, body] = result
		const addType = (parm: string) => {
			if (parm.indexOf(':') >= 0) {
				return parm
			}
			else {
				return `${parm}: unknown`
			}
		}
		const parmStr = lParms.map(addType).join(', ')
		return `const x: ${typeStr} = (${parmStr}) => ${body}`
	}
	else {
		return `const x: ${typeStr} = ${valueStr}`
	}
}

// ---------------------------------------------------------------------------

type splitResult = [string[], string]

export const splitFuncStr = (
		valueStr: string
		): (splitResult | undefined) => {

	let ref;if ((ref = valueStr.match(/^\(([^\)]*)\)\s*[\=\-]\>\s*(.*)$/))) {const lMatches = ref;
		const [_, strParms, strBody] = lMatches
		if (isEmpty(strParms)) {
			return [[], strBody]
		}
		else {
			return [
				strParms.split(',').map((x) => x.trim()),
				strBody
				]
		}
	}
	else {
		return undef
	}
}

// ---------------------------------------------------------------------------

export const getImportCode = (
		typeStr: string
		): string => {

	DBG("CALL getImportCode()")
	const lSymbols = getSymbolsFromType(typeStr)
	DBGVALUE('lSymbols', lSymbols)
	if (nonEmpty(lSymbols)) {
		const lStmts = getNeededImportStmts(lSymbols)
		DBGVALUE('lStmts', lStmts)
		return lStmts.join('\n')
	}
	else {
		return ''
	}
}

// ---------------------------------------------------------------------------

export const getSymbolsFromType = (typeStr: string): string[] => {

	let ref1;let ref2;if ((ref1 = typeStr.match(/^([A-Za-z][A-Za-z0-9+]*)(?:\<([A-Za-z][A-Za-z0-9+]*)\>)?$/))) {const lMatches = ref1;
		const [_, type, subtype] = lMatches
		return nonEmpty(subtype) ? [type, subtype] : [type]
	}
	else if ((ref2 = typeStr.match(/^\(\)\s*\=\>\s*([A-Za-z][A-Za-z0-9+]*)$/))) {const lMatches = ref2;
		return [lMatches[1]]
	}
	else {
		return []
	}
}

// ---------------------------------------------------------------------------

const hDefConfig: CompilerOptions = {
	"allowJs": false,
	"allowUmdGlobalAccess": false,
	"allowUnreachableCode": false,
	"allowUnusedLabels": false,
	"alwaysStrict": true,
	"assumeChangesOnlyAffectDirectDependencies": false,
	"checkJs": false,
	"composite": false,
	"declaration": false,
	"declarationDir": undefined,
	"declarationMap": false,
	"emitBOM": false,
	"emitDeclarationOnly": false,
	"exactOptionalPropertyTypes": false,
	"experimentalDecorators": false,
	"forceConsistentCasingInFileNames": true,
	"generateCpuProfile": null,
	"generateTrace": null,
	"ignoreDeprecations": "5.0",
	"importHelpers": false,
	"inlineSourceMap": false,
	"inlineSources": false,
	"isolatedModules": false,
//	"jsx": "react-jsx",
//	"jsxFactory": "React.createElement",
//	"jsxFragmentFactory": "React.Fragment",
//	"jsxImportSource": "react",
	"lib": [
		"esnext",
		"dom",
		"dom.iterable"
	],
	"mapRoot": undefined,
	"maxNodeModuleJsDepth": 0,
	"module": ModuleKind.ESNext,
	"moduleDetection": undefined,
	"moduleResolution": ModuleResolutionKind.NodeNext,
	"newLine": NewLineKind.LineFeed,
	"noEmit": true,
	"noEmitHelpers": false,
	"noEmitOnError": false,
	"noErrorTruncation": false,
	"noFallthroughCasesInSwitch": true,
	"noImplicitAny": true,
	"noImplicitOverride": true,
	"noImplicitReturns": true,
	"noImplicitThis": true,
	"noPropertyAccessFromIndexSignature": true,
	"noUncheckedIndexedAccess": true,
	"noUnusedLocals": true,
	"noUnusedParameters": true,
	"outDir": undefined,
	"outFile": undefined,
	"paths": {},
	"preserveConstEnums": false,
	"preserveSymlinks": false,
	"preserveValueImports": false,
	"reactNamespace": "React",
	"removeComments": false,
	"resolveJsonModule": true,
	"rootDir": undefined,
	"rootDirs": [],
	"skipDefaultLibCheck": false,
	"skipLibCheck": false,
	"sourceMap": false,
	"sourceRoot": undefined,
	"strict": true,
	"strictBindCallApply": true,
	"strictFunctionTypes": true,
	"strictNullChecks": true,
	"strictPropertyInitialization": true,
	"stripInternal": false,
	"suppressExcessPropertyErrors": false,
	"suppressImplicitAnyIndexErrors": false,
	"target": ScriptTarget.ES2022,
	"traceResolution": false,
	"tsBuildInfoFile": undefined,
	"typeRoots": [],
	"useDefineForClassFields": true,
	"useUnknownInCatchVariables": true
	}

// ---------------------------------------------------------------------------

type TAstFilterFunc = (node: Node) => boolean

export class AstWalker extends Walker<Node> {

	filterFunc: (TAstFilterFunc | undefined)
	hOptions: hash

	// ..........................................................

	constructor(
			filterFunc1: (TAstFilterFunc | undefined) = undef,
			hOptions1 = {}
			) {

		super()

		this.filterFunc = filterFunc1;

		this.hOptions = hOptions1;
	}

	// ..........................................................

	dbg(op: 'push' | 'pop', node: Node): void {

		const prefix = '   '
		const kind = node.kind
		console.log(`${prefix}${op.toUpperCase()}: ${kind} [${this.stackDesc()}]`)
		return
	}

	// ..........................................................

	stackDesc(): string {

		const results=[];for (const node of this.lNodeStack) {
			results.push(node.kind.toString())
		};const lStack =results
		return lStack.join(',')
	}

	// ..........................................................

	override pushNode(node: Node): void {

		super.pushNode(node)
		if (this.hOptions.trace) {
			this.dbg('push', node)
		}
		return
	}

	// ..........................................................

	override popNode(): (Node | undefined) {

		const node = super.popNode()
		if (this.hOptions.trace) {
			if (defined(node)) {
				this.dbg('pop', node)
			}
			else {
				console.log("STACK EMPTY")
			}
		}
		return node
	}

	// ..........................................................

	override isNode(x: object): x is Node {

		return Object.hasOwn(x, 'kind')
	}

	// ..........................................................

	override filter(node: Node): boolean {

		return defined(this.filterFunc) ? this.filterFunc(node) : true
	}
}

// ---------------------------------------------------------------------------

export class CAnalysis {

	mImports: CStringSetMap = new CStringSetMap()
	hExports: hashof<string> = {}
	sNeeded: Set<string> = new Set<string>()
	ss: CScopeStack = new CScopeStack()

	// ..........................................................

	constructor() {

		for (const name of words('console string number ')) {
			this.ss.addDefined(name)
		}
	}

	// ..........................................................

	addImport(name: string, lib: string): void {

		this.mImports.add(lib, name)
		return
	}

	// ..........................................................

	addExport(name: string, kind: string): void {

		this.hExports[name]  = kind
		return
	}

	// ..........................................................

	addNeeds(name: string): void {

		if (!this.ss.isDefined(name) && !this.mImports.hasValue(name)) {
			this.sNeeded.add(name)
		}
		return
	}

	// ..........................................................

	getImports(): TBlockDesc {

		const hImports: hashof<string[]> = {}
		for (const [lib, sNames] of this.mImports.entries()) {
			hImports[lib] = Array.from(sNames.values())
		}
		return hImports
	}

	// ..........................................................

	getExports(): TBlockDesc {

		return keys(this.hExports)
	}

	// ..........................................................

	getNeeds(): TBlockDesc {

		return Array.from(this.sNeeded.values())
	}

	// ..........................................................

	asString(width: integer = 64): string {

		const h: TBlockDesc = {
			IMPORTS: this.getImports(),
			EXPORTS: this.getExports(),
			NEEDS:  this.getNeeds()
			}
		if (isEmpty(h.IMPORTS)) {
			delete h.IMPORTS
		}
		if (isEmpty(h.EXPORTS)) {
			delete h.EXPORTS
		}
		if (isEmpty(h.NEEDS)) {
			delete h.NEEDS
		}
		return Blockify(h)
	}
}

// ---------------------------------------------------------------------------

export const assertIsNode: (x: unknown) => asserts x is Node = (
		x: unknown
		): asserts x is Node => {

	assert(hasKey(x, 'kind'), `Not a Node: ${typeof x}`)
}

// ---------------------------------------------------------------------------

export const getNode = (
		x: unknown,
		dspath: string | TPathItem[]
		): Node => {

	const val = extract(x, dspath)
	assertIsNode(val)
	return val
}

// ---------------------------------------------------------------------------

export const analyze = (
		tsCode: string,
		hOptions: hash = {}
		): CAnalysis => {

	type opt = {
		fileName: (string | undefined)
		dump: boolean
		trace: boolean
		}
	const {fileName, dump, trace} = getOptions<opt>(hOptions, {
		fileName: undef,
		dump: false,
		trace: false
		})

	const analysis = new CAnalysis()
	const ss = new CScopeStack()

	const walker = new AstWalker()
	const hAst = ts2ast(tsCode)
	if (dump) {
		LOG(sep('AST', '='))
		LOG(astAsString(hAst))
		LOG(sep(undef, '='))
	}

	// ..........................................................

	const checkNode = (
			node: unknown,
			dspath: (string | undefined) = undef
			): void => {

		assertIsNode(node)
		if (defined(dspath)) {
			node = getNode(node, dspath)
			assertIsNode(node)
		}

		if (node.kind === 80) {
			analysis.addNeeds(getString(node, '.escapedText'))
		}
		return
	}

	// ..........................................................

	for (const [vkind, node] of walker.walkEx(hAst)) {
		const {kind} = node
		if (trace) {
			LOG(`NODE KIND: ${kind} (${kindStr(kind)})`)
		}
		if (vkind === 'exit') {
			switch(kind) {
				case 220:case 263: {   // --- ArrowFunction, FunctionDeclaration
					analysis.ss.endScope();break;
				}
			}
		}

		else if (vkind === 'enter') {
			switch(kind) {

				case 220: {   // --- ArrowFunction

					analysis.ss.newScope()
					for (const parm of getArray(node, '.parameters')) {
						const name = getString(parm, '.name.escapedText')
						analysis.ss.addDefined(name)
					};break;
				}

				case 261: {   // --- Variable Declaration

					try {
						const varName = getString(node, '.name.escapedText')
						analysis.ss.addDefined(varName)
					} catch(e) {};break;
				}

				case 263: {   // --- FunctionDeclaration

					const funcName = getString(node, '.name.escapedText')
					analysis.ss.addDefined(funcName)
					analysis.ss.newScope()
					for (const parm of getArray(node, '.parameters')) {
						const name = getString(parm, '.name.escapedText')
						analysis.ss.addDefined(name)
					};break;
				}

				case 227: {   // --- BinaryExpression

					checkNode(node, '.left')
					checkNode(node, '.right');break;
				}

				case 214: {   // --- CallExpression

					checkNode(node, '.expression')
					for (const arg of getArray(node, '.arguments')) {
						checkNode(arg)
					};break;
				}

				case 273: {   // --- ImportDeclaration

					const lib = getString(node, '.moduleSpecifier.text')
					for (const h of getArray(node, '.importClause.namedBindings.elements')) {
						const name = getString(h, '.name.escapedText')
						if (trace) {
							console.log(`NAME: '${name}' in '${lib}'`)
						}
						analysis.addImport(name, lib)
					};break;
				}

				case 280: {   // --- NamedExports

					for (const elem of getArray(node, '.elements')) {
						const name = getString(elem, '.name.escapedText')
						analysis.addExport(name, 're-export')
					};break;
				}

				case 95: {    // --- ExportKeyword

					const parent = walker.parent()
					switch(getNumber(parent, '.kind')) {
						case 244: {
							for (const decl of getArray(parent, '.declarationList.declarations')) {
								switch(getNumber(decl, '.kind')) {
									case 261: {   // --- VariableDeclaration
										const name = getString(decl, '.name.escapedText')

										// --- Check initializer to find the type
										const initKind = getNumber(decl, '.initializer.kind')
										switch(initKind) {
											case 220: {   // --- ArrowFunction
												analysis.addExport(name, 'function');break;
											}
											case 261:case 9: {   // --- VariableDeclaration
												analysis.addExport(name, 'const');break;
											}
											default: {
												analysis.addExport(name, 'unknown')
											}
										};break;
									}
								}
							};break;
						}
						case 263: {   // --- FunctionDeclaration
							const name = getString(parent, '.name.escapedText')
							analysis.addExport(name, 'function');break;
						}
						case 264: {   // --- ClassDeclaration
							const name = getString(parent, '.name.escapedText')
							analysis.addExport(name, 'class');break;
						}
						case 266: {   // --- TypeAliasDeclaration
							const name = getString(parent, '.name.escapedText')
							analysis.addExport(name, 'type');break;
						}
						default:
							croak(`Unexpected subtype of 95: ${parent.kind}`)
					};break;
				}
				default:
					if (trace) {
						LOG("   ...ignored")
					}
			}
		}
	}
	return analysis
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQzovVXNlcnMvam9obmQvdXRpbHMvc3JjL2xpYi90eXBlc2NyaXB0LmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbIkM6L1VzZXJzL2pvaG5kL3V0aWxzL3NyYy9saWIvdHlwZXNjcmlwdC5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSx1QkFBc0I7QUFDdEIsQUFBQTtBQUNBLEFBQUEsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLGlCQUFpQjtBQUMxQyxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDbEMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTO0FBQ2hDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsVUFBVSxDQUFDO0FBQ3hELENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsZUFBZSxDQUFDLENBQUMsb0JBQW9CLENBQUM7QUFDOUQsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLGVBQWUsQ0FBQztBQUNqRSxDQUFDLHFCQUFxQixDQUFDLENBQUMsNEJBQTRCLENBQUM7QUFDckQsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLFlBQVksQ0FBQztBQUM3QyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCO0FBQ3hCLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVk7QUFDOUIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMs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QUEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5QixBQUFBLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDekMsQUFBQSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ3BDLEFBQUE7QUFDQSxBQUFBLENBQUMsNkRBQTREO0FBQzdELEFBQUE7QUFDQSxBQUFBLEMsV0FBWSxDQUFDLENBQUMsQ0FBQSxDQUFBO0FBQ2QsQUFBQTtBQUNBLEFBQUEsRUFBRSxHQUFHLENBQUMsQ0FBQSxNQUFBLElBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLHdCQUF3QixDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQzdDLEFBQUEsR0FBRyxJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQSxBQUFDLElBQUksQztFQUFBLEM7Q0FBQSxDQUFBO0FBQ3RCLEFBQUE7QUFDQSxBQUFBLENBQUMsNkRBQTREO0FBQzdELEFBQUE7QUFDQSxBQUFBLEMsU0FBVSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFBLENBQUE7QUFDM0MsQUFBQTtBQUNBLEFBQUEsRUFBRSxJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQSxBQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQTtBQUN6QixBQUFBLEVBQUUsTTtDQUFNLENBQUE7QUFDUixBQUFBO0FBQ0EsQUFBQSxDQUFDLDZEQUE0RDtBQUM3RCxBQUFBO0FBQ0EsQUFBQSxDLFNBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQSxDQUFBO0FBQzVDLEFBQUE7QUFDQSxBQUFBLEVBQUUsSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRSxDQUFHLENBQUMsSUFBSTtBQUN6QixBQUFBLEVBQUUsTTtDQUFNLENBQUE7QUFDUixBQUFBO0FBQ0EsQUFBQSxDQUFDLDZEQUE0RDtBQUM3RCxBQUFBO0FBQ0EsQUFBQSxDLFFBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQSxDQUFBO0FBQzdCLEFBQUE7QUFDQSxBQUFBLEVBQUUsR0FBRyxDQUFBLENBQUksSSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUksSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQzVELEFBQUEsR0FBRyxJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQSxBQUFDLElBQUksQztFQUFBLENBQUE7QUFDcEIsQUFBQSxFQUFFLE07Q0FBTSxDQUFBO0FBQ1IsQUFBQTtBQUNBLEFBQUEsQ0FBQyw2REFBNEQ7QUFDN0QsQUFBQTtBQUNBLEFBQUEsQyxVQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFBLENBQUE7QUFDekIsQUFBQTtBQUNBLEFBQUEsRUFBNEIsTUFBMUIsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ2xDLEFBQUEsRUFBRSxHQUFHLENBQUMsQ0FBQSxNQUFBLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDMUMsQUFBQSxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsQyxDQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQztFQUFDLENBQUE7QUFDOUMs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Q0FBRSxDQUFDLFNBQVMsQ0FBQSxBQUFDLE1BQU0sQ0FBQyxDQUFDLG1CQUFtQixDQUFBO0FBQ3BELEFBQUEsT0FBTyxRQUFRLENBQUMsU0FBUyxDQUFBLEFBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFBLE87TUFBQSxDQUFBO0FBQ3ZDLEFBQUEsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFBLENBQUEsQ0FBQSxHQUFHLDJCQUEwQjtBQUMzQyxBQUFBLE9BQVcsTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLFNBQVMsQ0FBQSxBQUFDLE1BQU0sQ0FBQyxDQUFDLG1CQUFtQixDQUFBO0FBQ3BELEFBQUEsT0FBTyxRQUFRLENBQUMsU0FBUyxDQUFBLEFBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFBLE87TUFBQSxDQUFBO0FBQ3RDLEFBQUEsTUFBTSxPQUFPLENBQUE7QUFDYixBQUFBLE9BQU8sS0FBSyxDQUFBLEFBQUMsQ0FBQywwQkFBMEIsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQztLQUFBLENBQUEsTztJQUFBLENBQUE7QUFDdkQsQUFBQSxJQUFJLE9BQU8sQ0FBQTtBQUNYLEFBQUEsS0FBSyxHQUFHLENBQUEsS0FBSyxDQUFBLENBQUEsQ0FBQTtBQUNiLEFBQUEsTUFBTSxHQUFHLENBQUEsQUFBQyxlQUFlLEM7S0FBQSxDO0dBQUEsQztFQUFBLEM7Q0FBQSxDQUFBO0FBQ3pCLEFBQUEsQ0FBQyxNQUFNLENBQUMsUTtBQUFRLENBQUE7QUFDaEIiLCJuYW1lcyI6W10sInNvdXJjZXNDb250ZW50IjpbIiMgdHlwZXNjcmlwdC5saWIuY2l2ZXRcclxuXHJcbmltcG9ydCB7Y3lhbiwgYmx1ZX0gZnJvbSBcIkBzdGQvZm10L2NvbG9yc1wiXHJcbmltcG9ydCB7ZXhpc3RzU3luY30gZnJvbSAnQHN0ZC9mcydcclxuaW1wb3J0IHtzdGF0U3luY30gZnJvbSAnbm9kZTpmcydcclxuaW1wb3J0IHtcclxuXHRTb3VyY2VGaWxlLCBOb2RlLCBTY3JpcHRUYXJnZXQsIFN5bnRheEtpbmQsIE1vZHVsZUtpbmQsXHJcblx0TmV3TGluZUtpbmQsIEVtaXRIaW50LCBDb21waWxlck9wdGlvbnMsIE1vZHVsZVJlc29sdXRpb25LaW5kLFxyXG5cdGNyZWF0ZVNvdXJjZUZpbGUsIGNyZWF0ZVByaW50ZXIsIGNyZWF0ZVByb2dyYW0sIHRyYW5zcGlsZU1vZHVsZSxcclxuXHRnZXRQcmVFbWl0RGlhZ25vc3RpY3MsIGZsYXR0ZW5EaWFnbm9zdGljTWVzc2FnZVRleHQsXHJcblx0Z2V0TGluZUFuZENoYXJhY3Rlck9mUG9zaXRpb24sIGZvckVhY2hDaGlsZCxcclxuXHR9IGZyb20gXCJucG06dHlwZXNjcmlwdFwiXHJcblxyXG5pbXBvcnQge3NlcH0gZnJvbSAnYmFzZS11dGlscydcclxuaW1wb3J0IHtcclxuXHR1bmRlZiwgZGVmaW5lZCwgbm90ZGVmaW5lZCwgaW50ZWdlciwgVFN0cmluZ0dlbmVyYXRvcixcclxuXHRoYXNoLCBoYXNob2YsIGlzSGFzaCwgVEZpbHRlckZ1bmMsIGlzU3RyaW5nLFxyXG5cdGlzRW1wdHksIG5vbkVtcHR5LCBUQ29uc3RydWN0b3IsIGFzc2VydCwgY3JvYWssXHJcblx0fSBmcm9tICdkYXRhdHlwZXMnXHJcbmltcG9ydCB7XHJcblx0dHJ1bmNTdHIsIGdldE9wdGlvbnMsIHNwYWNlcywgbywgd29yZHMsIGhhc0tleSxcclxuXHRzdHJpbmdpZnksIENTdHJpbmdTZXRNYXAsIGtleXMsIGJsb2NraWZ5LFxyXG5cdH0gZnJvbSAnbGx1dGlscydcclxuaW1wb3J0IHtcclxuXHRleHRyYWN0LCBUUGF0aEl0ZW0sIGdldFN0cmluZywgZ2V0TnVtYmVyLCBnZXRBcnJheSxcclxuXHR9IGZyb20gJ2V4dHJhY3QnXHJcbmltcG9ydCB7aW5kZW50ZWQsIFRCbG9ja0Rlc2MsIEJsb2NraWZ5fSBmcm9tICdpbmRlbnQnXHJcbmltcG9ydCB7XHJcblx0TE9HLCBEQkcsIExPR1ZBTFVFLCBJTkRFTlQsIFVOREVOVCwgREJHVkFMVUUsXHJcblx0fSBmcm9tICdsb2dnZXInXHJcbmltcG9ydCB7c2x1cnAsIGJhcmYsIGJhcmZUZW1wRmlsZSwgZmlsZUV4dH0gZnJvbSAnZnN5cydcclxuaW1wb3J0IHtPTCwgdG9OaWNlLCBUTWFwRnVuY30gZnJvbSAndG8tbmljZSdcclxuaW1wb3J0IHtnZXRDbWRPdXRwdXRTeW5jfSBmcm9tICdleGVjJ1xyXG5pbXBvcnQge3N0cmlwU3JjTWFwfSBmcm9tICdzb3VyY2UtbWFwJ1xyXG5pbXBvcnQge2dldE5lZWRlZEltcG9ydFN0bXRzfSBmcm9tICdzeW1ib2xzJ1xyXG5pbXBvcnQge1dhbGtlciwgVFZpc2l0S2luZH0gZnJvbSAnd2Fsa2VyJ1xyXG5pbXBvcnQge0NTY29wZVN0YWNrfSBmcm9tICdzY29wZS1zdGFjaydcclxuXHJcbmRlY29kZXIgOj0gbmV3IFRleHREZWNvZGVyKFwidXRmLThcIilcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQga2luZFN0ciA6PSAoaTogbnVtYmVyKTogc3RyaW5nID0+XHJcblxyXG5cdHJldHVybiBTeW50YXhLaW5kW2ldXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHRzMmFzdCA6PSAoXHJcblx0XHR0c0NvZGU6IHN0cmluZyxcclxuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cclxuXHRcdCk6IE5vZGUgPT5cclxuXHJcblx0dHlwZSBvcHQgPSB7XHJcblx0XHRmaWxlTmFtZTogc3RyaW5nXHJcblx0XHR9XHJcblx0e2ZpbGVOYW1lfSA6PSBnZXRPcHRpb25zPG9wdD4gaE9wdGlvbnMsIHtcclxuXHRcdGZpbGVOYW1lOiAndGVtcC50cydcclxuXHRcdH1cclxuXHJcblx0dHNDb2RlID0gc3RyaXBTcmNNYXAodHNDb2RlKVswXVxyXG5cdGhBc3QgOj0gY3JlYXRlU291cmNlRmlsZShmaWxlTmFtZSwgdHNDb2RlLCBTY3JpcHRUYXJnZXQuTGF0ZXN0KVxyXG5cdGZpbHRlcjogVEZpbHRlckZ1bmMgOj0gKHg6IHVua25vd24pID0+XHJcblx0XHRyZXR1cm4gKFxyXG5cdFx0XHQgICAodHlwZW9mIHggPT0gJ29iamVjdCcpXHJcblx0XHRcdCYmICh4ICE9IG51bGwpXHJcblx0XHRcdCYmICgna2luZCcgaW4geClcclxuXHRcdFx0JiYgKHR5cGVvZiB4LmtpbmQgPT0gJ251bWJlcicpXHJcblx0XHRcdClcclxuXHRyZXR1cm4gaEFzdFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBhc3QydHMgOj0gKG5vZGU6IE5vZGUpOiBzdHJpbmcgPT5cclxuXHJcblx0YXNzZXJ0IChub2RlLmtpbmQgPT0gMzA4KSwgXCJOb3QgYSBTb3VyY2VGaWxlIG5vZGVcIlxyXG5cdHByaW50ZXIgOj0gY3JlYXRlUHJpbnRlciB7bmV3TGluZTogTmV3TGluZUtpbmQuTGluZUZlZWR9XHJcblx0cmV0dXJuIHByaW50ZXIucHJpbnROb2RlIEVtaXRIaW50LlVuc3BlY2lmaWVkLCBub2RlLCBub2RlIGFzIFNvdXJjZUZpbGVcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgdHlwZUNoZWNrRmlsZXMgOj0gKFxyXG5cdFx0bEZpbGVOYW1lczogc3RyaW5nIHwgc3RyaW5nW10sXHJcblx0XHRoT3B0aW9uczogQ29tcGlsZXJPcHRpb25zID0gaERlZkNvbmZpZ1xyXG5cdFx0KTogc3RyaW5nW10gPT5cclxuXHJcblx0aWYgKHR5cGVvZiBsRmlsZU5hbWVzID09ICdzdHJpbmcnKVxyXG5cdFx0bEZpbGVOYW1lcyA9IFtsRmlsZU5hbWVzXVxyXG5cdHByb2dyYW0gOj0gY3JlYXRlUHJvZ3JhbShsRmlsZU5hbWVzLCBoT3B0aW9ucylcclxuXHRlbWl0UmVzdWx0IDo9IHByb2dyYW0uZW1pdCgpXHJcblxyXG5cdGxNc2dzOiBzdHJpbmdbXSA6PSBbXVxyXG5cdGdldFByZUVtaXREaWFnbm9zdGljcyhwcm9ncmFtKS5mb3JFYWNoIChkaWFnKSA9PlxyXG5cdFx0e2ZpbGUsIHN0YXJ0LCBtZXNzYWdlVGV4dH0gOj0gZGlhZ1xyXG5cdFx0bXNnIDo9IGZsYXR0ZW5EaWFnbm9zdGljTWVzc2FnZVRleHQgbWVzc2FnZVRleHQsIFwiXFxuXCJcclxuXHRcdGlmIChmaWxlKVxyXG5cdFx0XHR7ZmlsZU5hbWV9IDo9IGZpbGVcclxuXHRcdFx0e2xpbmUsIGNoYXJhY3Rlcn0gOj0gZ2V0TGluZUFuZENoYXJhY3Rlck9mUG9zaXRpb24gZmlsZSwgc3RhcnQhXHJcblx0XHRcdGxNc2dzLnB1c2ggXCIje2ZpbGVOYW1lfTooI3tsaW5lKzF9OiN7Y2hhcmFjdGVyKzF9KTogI3ttc2d9XCJcclxuXHRcdGVsc2VcclxuXHRcdFx0bE1zZ3MucHVzaCBtc2dcclxuXHRyZXR1cm4gbE1zZ3NcclxuXHJcbmV4cG9ydCB0eXBlQ2hlY2tGaWxlID0gdHlwZUNoZWNrRmlsZXMgICAjIC0tLSBzeW5vbnltXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHRzTWFwRnVuYzogVE1hcEZ1bmMgOj0gKFxyXG5cdFx0a2V5OiBzdHJpbmdcclxuXHRcdHZhbHVlOiB1bmtub3duXHJcblx0XHRoUGFyZW50OiBoYXNoXHJcblx0XHQpOiB1bmtub3duID0+XHJcblxyXG5cdGlmIChrZXkgPT0gJ2tpbmQnKSAmJiAodHlwZW9mIHZhbHVlID09ICdudW1iZXInKVxyXG5cdFx0ZGVzYyA6PSBjeWFuKCcgKCcgKyBraW5kU3RyKHZhbHVlKSArICcpJylcclxuXHRcdHJldHVybiB2YWx1ZS50b1N0cmluZygpICsgZGVzY1xyXG5cdHJldHVybiB1bmRlZlxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBhc3RBc1N0cmluZyA6PSAoXHJcblx0XHRoQXN0OiBOb2RlXHJcblx0XHRoT3B0aW9uczogaGFzaCA9IHt9XHJcblx0XHQpOiBzdHJpbmcgPT5cclxuXHJcblx0cmV0dXJuIHRvTmljZSBoQXN0LCB7XHJcblx0XHRpZ25vcmVFbXB0eVZhbHVlczogdHJ1ZVxyXG5cdFx0bWFwRnVuYzogdHNNYXBGdW5jXHJcblx0XHRsSW5jbHVkZTogaE9wdGlvbnMubEluY2x1ZGVcclxuXHRcdGxFeGNsdWRlOiB3b3JkcyhcclxuXHRcdFx0J3BvcyBlbmQgaWQgZmxhZ3MgbW9kaWZpZXJGbGFnc0NhY2hlJ1xyXG5cdFx0XHQndHJhbnNmb3JtRmxhZ3MgaGFzRXh0ZW5kZWRVbmljb2RlRXNjYXBlJ1xyXG5cdFx0XHQnbnVtZXJpY0xpdGVyYWxGbGFncyBzZXRFeHRlcm5hbE1vZHVsZUluZGljYXRvcidcclxuXHRcdFx0J2xhbmd1YWdlVmVyc2lvbiBsYW5ndWFnZVZhcmlhbnQganNEb2NQYXJzaW5nTW9kZSdcclxuXHRcdFx0J2hhc05vRGVmYXVsdExpYidcclxuXHRcdFx0KVxyXG5cdFx0fVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCB0eXBlQ2hlY2tDb2RlIDo9IChcclxuXHRcdHRzQ29kZTogc3RyaW5nXHJcblx0XHQpOiBzdHJpbmdbXT8gPT5cclxuXHJcblx0IyAtLS0gV2UgbXVzdCBwbGFjZSB0aGUgVHlwZVNjcmlwdCBmaWxlIGF0IHRoZSBwcm9qZWN0IHJvb3RcclxuXHQjICAgICBzbyB0aGF0IHBhdGhzIGdvdHRlbiBmcm9tIC5zeW1ib2xzIHJlc29sdmUgY29ycmVjdGx5XHJcblxyXG5cdHBhdGggOj0gXCIuL190eXBlY2hlY2tfLnRzXCJcclxuXHRiYXJmIHBhdGgsIHRzQ29kZVxyXG5cdGhSZXN1bHQgOj0gZ2V0Q21kT3V0cHV0U3luYyAnZGVubycsIFtcclxuXHRcdFx0J2NoZWNrJyxcclxuXHRcdFx0Jy0taW1wb3J0LW1hcCcsICdpbXBvcnRfbWFwLmpzb25jJyxcclxuXHRcdFx0cGF0aFxyXG5cdFx0XHRdXHJcblx0e3N1Y2Nlc3MsIGNvZGUsIHN0ZG91dCwgc3RkZXJyfSA6PSBoUmVzdWx0XHJcblx0aWYgc3VjY2VzcyAmJiAoY29kZSA9PSAwKVxyXG5cdFx0cmV0dXJuIFtdXHJcblx0ZWxzZSBpZiBkZWZpbmVkKHN0ZGVycilcclxuXHRcdHJldHVybiBbc3RkZXJyXVxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBbJ1Vua25vd24gZXJyb3InXVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBjaGVja1R5cGUgOj0gKFxyXG5cdFx0dmFsdWU6IHVua25vd25cclxuXHRcdHR5cGVTdHI6IHN0cmluZ1xyXG5cdFx0ZXhwZWN0U3VjY2VzczogYm9vbGVhbiA9IHRydWVcclxuXHRcdCk6IHN0cmluZ1tdID0+XHJcblxyXG5cdERCRyBcIkNBTEwgY2hlY2tUeXBlKCk6XCIsIElOREVOVFxyXG5cclxuXHR0c0NvZGUgOj0gZ2V0VHNDb2RlIHR5cGVTdHIsIHN0cmluZ2lmeSh2YWx1ZSlcclxuXHREQkdWQUxVRSAndHNDb2RlJywgdHNDb2RlXHJcblxyXG5cdCMgLS0tIGNoZWNrIGlmIHdlIG5lZWQgdG8gaW1wb3J0IHRoZSB0eXBlXHJcblx0aW1wb3J0Q29kZSA6PSBnZXRJbXBvcnRDb2RlKHR5cGVTdHIpXHJcblx0REJHVkFMVUUgJ2ltcG9ydENvZGUnLCBpbXBvcnRDb2RlXHJcblxyXG5cdGNvZGUgOj0gXCIje2ltcG9ydENvZGV9XFxuI3t0c0NvZGV9XCJcclxuXHRsRGlhZ25vc3RpY3MgOj0gdHlwZUNoZWNrQ29kZShjb2RlKVxyXG5cdGlmIGV4cGVjdFN1Y2Nlc3MgJiYgbm9uRW1wdHkobERpYWdub3N0aWNzKVxyXG5cdFx0TE9HIFwidHlwZUNoZWNrQ29kZSBGQUlMRUQ6XCJcclxuXHRcdExPRyBcIkNPREU6XCJcclxuXHRcdExPRyBjb2RlXHJcblx0XHRMT0dWQUxVRSAnbERpYWdub3N0aWNzJywgbERpYWdub3N0aWNzXHJcblx0ZWxzZSBpZiBub3QgZXhwZWN0U3VjY2VzcyAmJiBpc0VtcHR5KGxEaWFnbm9zdGljcylcclxuXHRcdExPRyBcInR5cGVDaGVja0NvZGUgU1VDQ0VFREVEOlwiXHJcblx0XHRMT0cgXCJDT0RFOlwiXHJcblx0XHRMT0cgY29kZVxyXG5cdERCRyBVTkRFTlRcclxuXHRyZXR1cm4gbERpYWdub3N0aWNzIHx8IFtdXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIC0tLSBXZSBuZWVkIHRvIGFkZCAnOnVua25vd24nIHRvIGFueSBmdW5jdGlvbiBwYXJhbWV0ZXJzXHJcbiMgICAgIHRoYXQgZG9uJ3QgaGF2ZSBhbiBleHBsaWNpdCB0eXBlXHJcblxyXG5leHBvcnQgZ2V0VHNDb2RlIDo9IChcclxuXHRcdHR5cGVTdHI6IHN0cmluZ1xyXG5cdFx0dmFsdWVTdHI6IHN0cmluZ1xyXG5cdFx0KTogc3RyaW5nID0+XHJcblxyXG5cdERCR1ZBTFVFICd0eXBlU3RyJywgdHlwZVN0clxyXG5cdERCR1ZBTFVFICd2YWx1ZVN0cicsIHZhbHVlU3RyXHJcblx0cmVzdWx0IDo9IHNwbGl0RnVuY1N0cih2YWx1ZVN0cilcclxuXHRpZiBkZWZpbmVkKHJlc3VsdClcclxuXHRcdFtsUGFybXMsIGJvZHldIDo9IHJlc3VsdFxyXG5cdFx0YWRkVHlwZSA6PSAocGFybTogc3RyaW5nKSA9PlxyXG5cdFx0XHRpZiAocGFybS5pbmRleE9mKCc6JykgPj0gMClcclxuXHRcdFx0XHRyZXR1cm4gcGFybVxyXG5cdFx0XHRlbHNlXHJcblx0XHRcdFx0cmV0dXJuIFwiI3twYXJtfTogdW5rbm93blwiXHJcblx0XHRwYXJtU3RyIDo9IGxQYXJtcy5tYXAoYWRkVHlwZSkuam9pbignLCAnKVxyXG5cdFx0cmV0dXJuIFwiY29uc3QgeDogI3t0eXBlU3RyfSA9ICgje3Bhcm1TdHJ9KSA9PiAje2JvZHl9XCJcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gXCJjb25zdCB4OiAje3R5cGVTdHJ9ID0gI3t2YWx1ZVN0cn1cIlxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbnR5cGUgc3BsaXRSZXN1bHQgPSBbc3RyaW5nW10sIHN0cmluZ11cclxuXHJcbmV4cG9ydCBzcGxpdEZ1bmNTdHIgOj0gKFxyXG5cdFx0dmFsdWVTdHI6IHN0cmluZ1xyXG5cdFx0KTogc3BsaXRSZXN1bHQ/ID0+XHJcblxyXG5cdGlmIGxNYXRjaGVzIDo9IHZhbHVlU3RyLm1hdGNoKC8vL15cclxuXHRcdFx0XFwoXHJcblx0XHRcdChbXlxcKV0qKVxyXG5cdFx0XHRcXCkgXFxzKiBbXFw9XFwtXVxcPlxyXG5cdFx0XHRcXHMqXHJcblx0XHRcdCguKilcclxuXHRcdFx0JC8vLylcclxuXHRcdFtfLCBzdHJQYXJtcywgc3RyQm9keV0gOj0gbE1hdGNoZXNcclxuXHRcdGlmIGlzRW1wdHkoc3RyUGFybXMpXHJcblx0XHRcdHJldHVybiBbW10sIHN0ckJvZHldXHJcblx0XHRlbHNlXHJcblx0XHRcdHJldHVybiBbXHJcblx0XHRcdFx0c3RyUGFybXMuc3BsaXQoJywnKS5tYXAoKHgpID0+IHgudHJpbSgpKVxyXG5cdFx0XHRcdHN0ckJvZHlcclxuXHRcdFx0XHRdXHJcblx0ZWxzZVxyXG5cdFx0cmV0dXJuIHVuZGVmXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGdldEltcG9ydENvZGUgOj0gKFxyXG5cdFx0dHlwZVN0cjogc3RyaW5nXHJcblx0XHQpOiBzdHJpbmcgPT5cclxuXHJcblx0REJHIFwiQ0FMTCBnZXRJbXBvcnRDb2RlKClcIlxyXG5cdGxTeW1ib2xzIDo9IGdldFN5bWJvbHNGcm9tVHlwZSh0eXBlU3RyKVxyXG5cdERCR1ZBTFVFICdsU3ltYm9scycsIGxTeW1ib2xzXHJcblx0aWYgbm9uRW1wdHkobFN5bWJvbHMpXHJcblx0XHRsU3RtdHMgOj0gZ2V0TmVlZGVkSW1wb3J0U3RtdHMobFN5bWJvbHMpXHJcblx0XHREQkdWQUxVRSAnbFN0bXRzJywgbFN0bXRzXHJcblx0XHRyZXR1cm4gbFN0bXRzLmpvaW4oJ1xcbicpXHJcblx0ZWxzZVxyXG5cdFx0cmV0dXJuICcnXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGdldFN5bWJvbHNGcm9tVHlwZSA6PSAodHlwZVN0cjogc3RyaW5nKTogc3RyaW5nW10gPT5cclxuXHJcblx0aWYgbE1hdGNoZXMgOj0gdHlwZVN0ci5tYXRjaCgvLy9eXHJcblx0XHRcdChbQS1aYS16XVtBLVphLXowLTkrXSopXHJcblx0XHRcdCg/OlxyXG5cdFx0XHRcdFxcPFxyXG5cdFx0XHRcdChbQS1aYS16XVtBLVphLXowLTkrXSopXHJcblx0XHRcdFx0XFw+XHJcblx0XHRcdFx0KT9cclxuXHRcdFx0JC8vLylcclxuXHRcdFtfLCB0eXBlLCBzdWJ0eXBlXSA6PSBsTWF0Y2hlc1xyXG5cdFx0cmV0dXJuIG5vbkVtcHR5KHN1YnR5cGUpID8gW3R5cGUsIHN1YnR5cGVdIDogW3R5cGVdXHJcblx0ZWxzZSBpZiBsTWF0Y2hlcyA6PSB0eXBlU3RyLm1hdGNoKC8vL15cclxuXHRcdFx0XFwoIFxcKSAgICAgICAgICAgICAgICAgICAgICAgICAjICgpXHJcblx0XHRcdFxccypcclxuXHRcdFx0XFw9IFxcPiAgICAgICAgICAgICAgICAgICAgICAgICAjID0+XHJcblx0XHRcdFxccypcclxuXHRcdFx0KFtBLVphLXpdW0EtWmEtejAtOStdKikgICAgICAgIyBhbiBpZGVudGlmaWVyXHJcblx0XHRcdCQvLy8pXHJcblx0XHRyZXR1cm4gW2xNYXRjaGVzWzFdXVxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBbXVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmhEZWZDb25maWc6IENvbXBpbGVyT3B0aW9ucyA6PSB7XHJcblx0XCJhbGxvd0pzXCI6IGZhbHNlLFxyXG5cdFwiYWxsb3dVbWRHbG9iYWxBY2Nlc3NcIjogZmFsc2UsXHJcblx0XCJhbGxvd1VucmVhY2hhYmxlQ29kZVwiOiBmYWxzZSxcclxuXHRcImFsbG93VW51c2VkTGFiZWxzXCI6IGZhbHNlLFxyXG5cdFwiYWx3YXlzU3RyaWN0XCI6IHRydWUsXHJcblx0XCJhc3N1bWVDaGFuZ2VzT25seUFmZmVjdERpcmVjdERlcGVuZGVuY2llc1wiOiBmYWxzZSxcclxuXHRcImNoZWNrSnNcIjogZmFsc2UsXHJcblx0XCJjb21wb3NpdGVcIjogZmFsc2UsXHJcblx0XCJkZWNsYXJhdGlvblwiOiBmYWxzZSxcclxuXHRcImRlY2xhcmF0aW9uRGlyXCI6IHVuZGVmaW5lZCxcclxuXHRcImRlY2xhcmF0aW9uTWFwXCI6IGZhbHNlLFxyXG5cdFwiZW1pdEJPTVwiOiBmYWxzZSxcclxuXHRcImVtaXREZWNsYXJhdGlvbk9ubHlcIjogZmFsc2UsXHJcblx0XCJleGFjdE9wdGlvbmFsUHJvcGVydHlUeXBlc1wiOiBmYWxzZSxcclxuXHRcImV4cGVyaW1lbnRhbERlY29yYXRvcnNcIjogZmFsc2UsXHJcblx0XCJmb3JjZUNvbnNpc3RlbnRDYXNpbmdJbkZpbGVOYW1lc1wiOiB0cnVlLFxyXG5cdFwiZ2VuZXJhdGVDcHVQcm9maWxlXCI6IG51bGwsXHJcblx0XCJnZW5lcmF0ZVRyYWNlXCI6IG51bGwsXHJcblx0XCJpZ25vcmVEZXByZWNhdGlvbnNcIjogXCI1LjBcIixcclxuXHRcImltcG9ydEhlbHBlcnNcIjogZmFsc2UsXHJcblx0XCJpbmxpbmVTb3VyY2VNYXBcIjogZmFsc2UsXHJcblx0XCJpbmxpbmVTb3VyY2VzXCI6IGZhbHNlLFxyXG5cdFwiaXNvbGF0ZWRNb2R1bGVzXCI6IGZhbHNlLFxyXG4jXHRcImpzeFwiOiBcInJlYWN0LWpzeFwiLFxyXG4jXHRcImpzeEZhY3RvcnlcIjogXCJSZWFjdC5jcmVhdGVFbGVtZW50XCIsXHJcbiNcdFwianN4RnJhZ21lbnRGYWN0b3J5XCI6IFwiUmVhY3QuRnJhZ21lbnRcIixcclxuI1x0XCJqc3hJbXBvcnRTb3VyY2VcIjogXCJyZWFjdFwiLFxyXG5cdFwibGliXCI6IFtcclxuXHRcdFwiZXNuZXh0XCIsXHJcblx0XHRcImRvbVwiLFxyXG5cdFx0XCJkb20uaXRlcmFibGVcIlxyXG5cdF0sXHJcblx0XCJtYXBSb290XCI6IHVuZGVmaW5lZCxcclxuXHRcIm1heE5vZGVNb2R1bGVKc0RlcHRoXCI6IDAsXHJcblx0XCJtb2R1bGVcIjogTW9kdWxlS2luZC5FU05leHQsXHJcblx0XCJtb2R1bGVEZXRlY3Rpb25cIjogdW5kZWZpbmVkLFxyXG5cdFwibW9kdWxlUmVzb2x1dGlvblwiOiBNb2R1bGVSZXNvbHV0aW9uS2luZC5Ob2RlTmV4dCxcclxuXHRcIm5ld0xpbmVcIjogTmV3TGluZUtpbmQuTGluZUZlZWQsXHJcblx0XCJub0VtaXRcIjogdHJ1ZSxcclxuXHRcIm5vRW1pdEhlbHBlcnNcIjogZmFsc2UsXHJcblx0XCJub0VtaXRPbkVycm9yXCI6IGZhbHNlLFxyXG5cdFwibm9FcnJvclRydW5jYXRpb25cIjogZmFsc2UsXHJcblx0XCJub0ZhbGx0aHJvdWdoQ2FzZXNJblN3aXRjaFwiOiB0cnVlLFxyXG5cdFwibm9JbXBsaWNpdEFueVwiOiB0cnVlLFxyXG5cdFwibm9JbXBsaWNpdE92ZXJyaWRlXCI6IHRydWUsXHJcblx0XCJub0ltcGxpY2l0UmV0dXJuc1wiOiB0cnVlLFxyXG5cdFwibm9JbXBsaWNpdFRoaXNcIjogdHJ1ZSxcclxuXHRcIm5vUHJvcGVydHlBY2Nlc3NGcm9tSW5kZXhTaWduYXR1cmVcIjogdHJ1ZSxcclxuXHRcIm5vVW5jaGVja2VkSW5kZXhlZEFjY2Vzc1wiOiB0cnVlLFxyXG5cdFwibm9VbnVzZWRMb2NhbHNcIjogdHJ1ZSxcclxuXHRcIm5vVW51c2VkUGFyYW1ldGVyc1wiOiB0cnVlLFxyXG5cdFwib3V0RGlyXCI6IHVuZGVmaW5lZCxcclxuXHRcIm91dEZpbGVcIjogdW5kZWZpbmVkLFxyXG5cdFwicGF0aHNcIjoge30sXHJcblx0XCJwcmVzZXJ2ZUNvbnN0RW51bXNcIjogZmFsc2UsXHJcblx0XCJwcmVzZXJ2ZVN5bWxpbmtzXCI6IGZhbHNlLFxyXG5cdFwicHJlc2VydmVWYWx1ZUltcG9ydHNcIjogZmFsc2UsXHJcblx0XCJyZWFjdE5hbWVzcGFjZVwiOiBcIlJlYWN0XCIsXHJcblx0XCJyZW1vdmVDb21tZW50c1wiOiBmYWxzZSxcclxuXHRcInJlc29sdmVKc29uTW9kdWxlXCI6IHRydWUsXHJcblx0XCJyb290RGlyXCI6IHVuZGVmaW5lZCxcclxuXHRcInJvb3REaXJzXCI6IFtdLFxyXG5cdFwic2tpcERlZmF1bHRMaWJDaGVja1wiOiBmYWxzZSxcclxuXHRcInNraXBMaWJDaGVja1wiOiBmYWxzZSxcclxuXHRcInNvdXJjZU1hcFwiOiBmYWxzZSxcclxuXHRcInNvdXJjZVJvb3RcIjogdW5kZWZpbmVkLFxyXG5cdFwic3RyaWN0XCI6IHRydWUsXHJcblx0XCJzdHJpY3RCaW5kQ2FsbEFwcGx5XCI6IHRydWUsXHJcblx0XCJzdHJpY3RGdW5jdGlvblR5cGVzXCI6IHRydWUsXHJcblx0XCJzdHJpY3ROdWxsQ2hlY2tzXCI6IHRydWUsXHJcblx0XCJzdHJpY3RQcm9wZXJ0eUluaXRpYWxpemF0aW9uXCI6IHRydWUsXHJcblx0XCJzdHJpcEludGVybmFsXCI6IGZhbHNlLFxyXG5cdFwic3VwcHJlc3NFeGNlc3NQcm9wZXJ0eUVycm9yc1wiOiBmYWxzZSxcclxuXHRcInN1cHByZXNzSW1wbGljaXRBbnlJbmRleEVycm9yc1wiOiBmYWxzZSxcclxuXHRcInRhcmdldFwiOiBTY3JpcHRUYXJnZXQuRVMyMDIyLFxyXG5cdFwidHJhY2VSZXNvbHV0aW9uXCI6IGZhbHNlLFxyXG5cdFwidHNCdWlsZEluZm9GaWxlXCI6IHVuZGVmaW5lZCxcclxuXHRcInR5cGVSb290c1wiOiBbXSxcclxuXHRcInVzZURlZmluZUZvckNsYXNzRmllbGRzXCI6IHRydWUsXHJcblx0XCJ1c2VVbmtub3duSW5DYXRjaFZhcmlhYmxlc1wiOiB0cnVlXHJcblx0fVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbnR5cGUgVEFzdEZpbHRlckZ1bmMgPSAobm9kZTogTm9kZSkgPT4gYm9vbGVhblxyXG5cclxuZXhwb3J0IGNsYXNzIEFzdFdhbGtlciBleHRlbmRzIFdhbGtlcjxOb2RlPlxyXG5cclxuXHRmaWx0ZXJGdW5jOiBUQXN0RmlsdGVyRnVuYz9cclxuXHRoT3B0aW9uczogaGFzaFxyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0Y29uc3RydWN0b3IoXHJcblx0XHRcdEBmaWx0ZXJGdW5jOiBUQXN0RmlsdGVyRnVuYz8gPSB1bmRlZlxyXG5cdFx0XHRAaE9wdGlvbnMgPSB7fVxyXG5cdFx0XHQpXHJcblxyXG5cdFx0c3VwZXIoKVxyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0ZGJnKG9wOiAncHVzaCcgfCAncG9wJywgbm9kZTogTm9kZSk6IHZvaWRcclxuXHJcblx0XHRwcmVmaXggOj0gJyAgICdcclxuXHRcdGtpbmQgOj0gbm9kZS5raW5kXHJcblx0XHRjb25zb2xlLmxvZyBcIiN7cHJlZml4fSN7b3AudG9VcHBlckNhc2UoKX06ICN7a2luZH0gWyN7QHN0YWNrRGVzYygpfV1cIlxyXG5cdFx0cmV0dXJuXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRzdGFja0Rlc2MoKTogc3RyaW5nXHJcblxyXG5cdFx0bFN0YWNrIDo9IGZvciBub2RlIG9mIEBsTm9kZVN0YWNrXHJcblx0XHRcdG5vZGUua2luZC50b1N0cmluZygpXHJcblx0XHRyZXR1cm4gbFN0YWNrLmpvaW4oJywnKVxyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0b3ZlcnJpZGUgcHVzaE5vZGUobm9kZTogTm9kZSk6IHZvaWRcclxuXHJcblx0XHRzdXBlci5wdXNoTm9kZShub2RlKVxyXG5cdFx0aWYgQGhPcHRpb25zLnRyYWNlXHJcblx0XHRcdEBkYmcgJ3B1c2gnLCBub2RlXHJcblx0XHRyZXR1cm5cclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblxyXG5cdG92ZXJyaWRlIHBvcE5vZGUoKTogTm9kZT9cclxuXHJcblx0XHRub2RlIDo9IHN1cGVyLnBvcE5vZGUoKVxyXG5cdFx0aWYgQGhPcHRpb25zLnRyYWNlXHJcblx0XHRcdGlmIGRlZmluZWQobm9kZSlcclxuXHRcdFx0XHRAZGJnICdwb3AnLCBub2RlXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRjb25zb2xlLmxvZyBcIlNUQUNLIEVNUFRZXCJcclxuXHRcdHJldHVybiBub2RlXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRvdmVycmlkZSBpc05vZGUoeDogb2JqZWN0KTogeCBpcyBOb2RlXHJcblxyXG5cdFx0cmV0dXJuIE9iamVjdC5oYXNPd24geCwgJ2tpbmQnXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRvdmVycmlkZSBmaWx0ZXIobm9kZTogTm9kZSk6IGJvb2xlYW5cclxuXHJcblx0XHRyZXR1cm4gZGVmaW5lZChAZmlsdGVyRnVuYykgPyBAZmlsdGVyRnVuYyhub2RlKSA6IHRydWVcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgY2xhc3MgQ0FuYWx5c2lzXHJcblxyXG5cdG1JbXBvcnRzOiBDU3RyaW5nU2V0TWFwID0gbmV3IENTdHJpbmdTZXRNYXAoKVxyXG5cdGhFeHBvcnRzOiBoYXNob2Y8c3RyaW5nPiA9IHt9XHJcblx0c05lZWRlZDogU2V0PHN0cmluZz4gPSBuZXcgU2V0PHN0cmluZz4oKVxyXG5cdHNzOiBDU2NvcGVTdGFjayA9IG5ldyBDU2NvcGVTdGFjaygpXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRjb25zdHJ1Y3RvcigpXHJcblxyXG5cdFx0Zm9yIG5hbWUgb2Ygd29yZHMoJ2NvbnNvbGUgc3RyaW5nIG51bWJlciAnKVxyXG5cdFx0XHRAc3MuYWRkRGVmaW5lZCBuYW1lXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRhZGRJbXBvcnQobmFtZTogc3RyaW5nLCBsaWI6IHN0cmluZyk6IHZvaWRcclxuXHJcblx0XHRAbUltcG9ydHMuYWRkIGxpYiwgbmFtZVxyXG5cdFx0cmV0dXJuXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRhZGRFeHBvcnQobmFtZTogc3RyaW5nLCBraW5kOiBzdHJpbmcpOiB2b2lkXHJcblxyXG5cdFx0QGhFeHBvcnRzW25hbWVdICA9IGtpbmRcclxuXHRcdHJldHVyblxyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0YWRkTmVlZHMobmFtZTogc3RyaW5nKTogdm9pZFxyXG5cclxuXHRcdGlmIG5vdCBAc3MuaXNEZWZpbmVkKG5hbWUpICYmIG5vdCBAbUltcG9ydHMuaGFzVmFsdWUobmFtZSlcclxuXHRcdFx0QHNOZWVkZWQuYWRkIG5hbWVcclxuXHRcdHJldHVyblxyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0Z2V0SW1wb3J0cygpOiBUQmxvY2tEZXNjXHJcblxyXG5cdFx0aEltcG9ydHM6IGhhc2hvZjxzdHJpbmdbXT4gOj0ge31cclxuXHRcdGZvciBbbGliLCBzTmFtZXNdIG9mIEBtSW1wb3J0cy5lbnRyaWVzKClcclxuXHRcdFx0aEltcG9ydHNbbGliXSA9IEFycmF5LmZyb20oc05hbWVzLnZhbHVlcygpKVxyXG5cdFx0cmV0dXJuIGhJbXBvcnRzXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRnZXRFeHBvcnRzKCk6IFRCbG9ja0Rlc2NcclxuXHJcblx0XHRyZXR1cm4ga2V5cyhAaEV4cG9ydHMpXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRnZXROZWVkcygpOiBUQmxvY2tEZXNjXHJcblxyXG5cdFx0cmV0dXJuIEFycmF5LmZyb20oQHNOZWVkZWQudmFsdWVzKCkpXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRhc1N0cmluZyh3aWR0aDogaW50ZWdlciA9IDY0KTogc3RyaW5nXHJcblxyXG5cdFx0aDogVEJsb2NrRGVzYyA6PSB7XHJcblx0XHRcdElNUE9SVFM6IEBnZXRJbXBvcnRzKClcclxuXHRcdFx0RVhQT1JUUzogQGdldEV4cG9ydHMoKVxyXG5cdFx0XHRORUVEUzogIEBnZXROZWVkcygpXHJcblx0XHRcdH1cclxuXHRcdGlmIGlzRW1wdHkgaC5JTVBPUlRTXHJcblx0XHRcdGRlbGV0ZSBoLklNUE9SVFNcclxuXHRcdGlmIGlzRW1wdHkgaC5FWFBPUlRTXHJcblx0XHRcdGRlbGV0ZSBoLkVYUE9SVFNcclxuXHRcdGlmIGlzRW1wdHkgaC5ORUVEU1xyXG5cdFx0XHRkZWxldGUgaC5ORUVEU1xyXG5cdFx0cmV0dXJuIEJsb2NraWZ5IGhcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgYXNzZXJ0SXNOb2RlOiAoeDogdW5rbm93bikgPT4gYXNzZXJ0cyB4IGlzIE5vZGUgOj0gKFxyXG5cdFx0eDogdW5rbm93blxyXG5cdFx0KTogYXNzZXJ0cyB4IGlzIE5vZGUgPT5cclxuXHJcblx0YXNzZXJ0IGhhc0tleSh4LCAna2luZCcpLCBcIk5vdCBhIE5vZGU6ICN7dHlwZW9mIHh9XCJcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZ2V0Tm9kZSA6PSAoXHJcblx0XHR4OiB1bmtub3duLFxyXG5cdFx0ZHNwYXRoOiBzdHJpbmcgfCBUUGF0aEl0ZW1bXVxyXG5cdFx0KTogTm9kZSA9PlxyXG5cclxuXHR2YWwgOj0gZXh0cmFjdCh4LCBkc3BhdGgpXHJcblx0YXNzZXJ0SXNOb2RlKHZhbClcclxuXHRyZXR1cm4gdmFsXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGFuYWx5emUgOj0gKFxyXG5cdFx0dHNDb2RlOiBzdHJpbmdcclxuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cclxuXHRcdCk6IENBbmFseXNpcyA9PlxyXG5cclxuXHR0eXBlIG9wdCA9IHtcclxuXHRcdGZpbGVOYW1lOiBzdHJpbmc/XHJcblx0XHRkdW1wOiBib29sZWFuXHJcblx0XHR0cmFjZTogYm9vbGVhblxyXG5cdFx0fVxyXG5cdHtmaWxlTmFtZSwgZHVtcCwgdHJhY2V9IDo9IGdldE9wdGlvbnM8b3B0PiBoT3B0aW9ucywge1xyXG5cdFx0ZmlsZU5hbWU6IHVuZGVmXHJcblx0XHRkdW1wOiBmYWxzZVxyXG5cdFx0dHJhY2U6IGZhbHNlXHJcblx0XHR9XHJcblxyXG5cdGFuYWx5c2lzIDo9IG5ldyBDQW5hbHlzaXMoKVxyXG5cdHNzIDo9IG5ldyBDU2NvcGVTdGFjaygpXHJcblxyXG5cdHdhbGtlciA6PSBuZXcgQXN0V2Fsa2VyKClcclxuXHRoQXN0IDo9IHRzMmFzdCB0c0NvZGVcclxuXHRpZiBkdW1wXHJcblx0XHRMT0cgc2VwICdBU1QnLCAnPSdcclxuXHRcdExPRyBhc3RBc1N0cmluZyhoQXN0KVxyXG5cdFx0TE9HIHNlcCB1bmRlZiwgJz0nXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRjaGVja05vZGUgOj0gKFxyXG5cdFx0XHRub2RlOiB1bmtub3duLFxyXG5cdFx0XHRkc3BhdGg6IHN0cmluZz8gPSB1bmRlZlxyXG5cdFx0XHQpOiB2b2lkID0+XHJcblxyXG5cdFx0YXNzZXJ0SXNOb2RlIG5vZGVcclxuXHRcdGlmIGRlZmluZWQoZHNwYXRoKVxyXG5cdFx0XHRub2RlID0gZ2V0Tm9kZSBub2RlLCBkc3BhdGhcclxuXHRcdFx0YXNzZXJ0SXNOb2RlIG5vZGVcclxuXHJcblx0XHRpZiAobm9kZS5raW5kID09IDgwKVxyXG5cdFx0XHRhbmFseXNpcy5hZGROZWVkcyBnZXRTdHJpbmcobm9kZSwgJy5lc2NhcGVkVGV4dCcpXHJcblx0XHRyZXR1cm5cclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblxyXG5cdGZvciBbdmtpbmQsIG5vZGVdIG9mIHdhbGtlci53YWxrRXggaEFzdFxyXG5cdFx0e2tpbmR9IDo9IG5vZGVcclxuXHRcdGlmIHRyYWNlXHJcblx0XHRcdExPRyBcIk5PREUgS0lORDogI3traW5kfSAoI3traW5kU3RyKGtpbmQpfSlcIlxyXG5cdFx0aWYgKHZraW5kID09ICdleGl0JylcclxuXHRcdFx0c3dpdGNoIGtpbmRcclxuXHRcdFx0XHR3aGVuIDIyMCwgMjYzICAgIyAtLS0gQXJyb3dGdW5jdGlvbiwgRnVuY3Rpb25EZWNsYXJhdGlvblxyXG5cdFx0XHRcdFx0YW5hbHlzaXMuc3MuZW5kU2NvcGUoKVxyXG5cclxuXHRcdGVsc2UgaWYgKHZraW5kID09ICdlbnRlcicpXHJcblx0XHRcdHN3aXRjaCBraW5kXHJcblxyXG5cdFx0XHRcdHdoZW4gMjIwICAgIyAtLS0gQXJyb3dGdW5jdGlvblxyXG5cclxuXHRcdFx0XHRcdGFuYWx5c2lzLnNzLm5ld1Njb3BlKClcclxuXHRcdFx0XHRcdGZvciBwYXJtIG9mIGdldEFycmF5IG5vZGUsICcucGFyYW1ldGVycydcclxuXHRcdFx0XHRcdFx0bmFtZSA6PSBnZXRTdHJpbmcgcGFybSwgJy5uYW1lLmVzY2FwZWRUZXh0J1xyXG5cdFx0XHRcdFx0XHRhbmFseXNpcy5zcy5hZGREZWZpbmVkIG5hbWVcclxuXHJcblx0XHRcdFx0d2hlbiAyNjEgICAjIC0tLSBWYXJpYWJsZSBEZWNsYXJhdGlvblxyXG5cclxuXHRcdFx0XHRcdHRyeVxyXG5cdFx0XHRcdFx0XHR2YXJOYW1lIDo9IGdldFN0cmluZyBub2RlLCAnLm5hbWUuZXNjYXBlZFRleHQnXHJcblx0XHRcdFx0XHRcdGFuYWx5c2lzLnNzLmFkZERlZmluZWQgdmFyTmFtZVxyXG5cclxuXHRcdFx0XHR3aGVuIDI2MyAgICMgLS0tIEZ1bmN0aW9uRGVjbGFyYXRpb25cclxuXHJcblx0XHRcdFx0XHRmdW5jTmFtZSA6PSBnZXRTdHJpbmcgbm9kZSwgJy5uYW1lLmVzY2FwZWRUZXh0J1xyXG5cdFx0XHRcdFx0YW5hbHlzaXMuc3MuYWRkRGVmaW5lZCBmdW5jTmFtZVxyXG5cdFx0XHRcdFx0YW5hbHlzaXMuc3MubmV3U2NvcGUoKVxyXG5cdFx0XHRcdFx0Zm9yIHBhcm0gb2YgZ2V0QXJyYXkgbm9kZSwgJy5wYXJhbWV0ZXJzJ1xyXG5cdFx0XHRcdFx0XHRuYW1lIDo9IGdldFN0cmluZyBwYXJtLCAnLm5hbWUuZXNjYXBlZFRleHQnXHJcblx0XHRcdFx0XHRcdGFuYWx5c2lzLnNzLmFkZERlZmluZWQgbmFtZVxyXG5cclxuXHRcdFx0XHR3aGVuIDIyNyAgICMgLS0tIEJpbmFyeUV4cHJlc3Npb25cclxuXHJcblx0XHRcdFx0XHRjaGVja05vZGUgbm9kZSwgJy5sZWZ0J1xyXG5cdFx0XHRcdFx0Y2hlY2tOb2RlIG5vZGUsICcucmlnaHQnXHJcblxyXG5cdFx0XHRcdHdoZW4gMjE0ICAgIyAtLS0gQ2FsbEV4cHJlc3Npb25cclxuXHJcblx0XHRcdFx0XHRjaGVja05vZGUgbm9kZSwgJy5leHByZXNzaW9uJ1xyXG5cdFx0XHRcdFx0Zm9yIGFyZyBvZiBnZXRBcnJheSBub2RlLCAnLmFyZ3VtZW50cydcclxuXHRcdFx0XHRcdFx0Y2hlY2tOb2RlIGFyZ1xyXG5cclxuXHRcdFx0XHR3aGVuIDI3MyAgICMgLS0tIEltcG9ydERlY2xhcmF0aW9uXHJcblxyXG5cdFx0XHRcdFx0bGliIDo9IGdldFN0cmluZyBub2RlLCAnLm1vZHVsZVNwZWNpZmllci50ZXh0J1xyXG5cdFx0XHRcdFx0Zm9yIGggb2YgZ2V0QXJyYXkgbm9kZSwgJy5pbXBvcnRDbGF1c2UubmFtZWRCaW5kaW5ncy5lbGVtZW50cydcclxuXHRcdFx0XHRcdFx0bmFtZSA6PSBnZXRTdHJpbmcgaCwgJy5uYW1lLmVzY2FwZWRUZXh0J1xyXG5cdFx0XHRcdFx0XHRpZiB0cmFjZVxyXG5cdFx0XHRcdFx0XHRcdGNvbnNvbGUubG9nIFwiTkFNRTogJyN7bmFtZX0nIGluICcje2xpYn0nXCJcclxuXHRcdFx0XHRcdFx0YW5hbHlzaXMuYWRkSW1wb3J0IG5hbWUsIGxpYlxyXG5cclxuXHRcdFx0XHR3aGVuIDI4MCAgICMgLS0tIE5hbWVkRXhwb3J0c1xyXG5cclxuXHRcdFx0XHRcdGZvciBlbGVtIG9mIGdldEFycmF5IG5vZGUsICcuZWxlbWVudHMnXHJcblx0XHRcdFx0XHRcdG5hbWUgOj0gZ2V0U3RyaW5nIGVsZW0sICcubmFtZS5lc2NhcGVkVGV4dCdcclxuXHRcdFx0XHRcdFx0YW5hbHlzaXMuYWRkRXhwb3J0IG5hbWUsICdyZS1leHBvcnQnXHJcblxyXG5cdFx0XHRcdHdoZW4gOTUgICAgIyAtLS0gRXhwb3J0S2V5d29yZFxyXG5cclxuXHRcdFx0XHRcdHBhcmVudCA6PSB3YWxrZXIucGFyZW50KClcclxuXHRcdFx0XHRcdHN3aXRjaCBnZXROdW1iZXIgcGFyZW50LCAnLmtpbmQnXHJcblx0XHRcdFx0XHRcdHdoZW4gMjQ0XHJcblx0XHRcdFx0XHRcdFx0Zm9yIGRlY2wgb2YgZ2V0QXJyYXkgcGFyZW50LCAnLmRlY2xhcmF0aW9uTGlzdC5kZWNsYXJhdGlvbnMnXHJcblx0XHRcdFx0XHRcdFx0XHRzd2l0Y2ggZ2V0TnVtYmVyIGRlY2wsICcua2luZCdcclxuXHRcdFx0XHRcdFx0XHRcdFx0d2hlbiAyNjEgICAjIC0tLSBWYXJpYWJsZURlY2xhcmF0aW9uXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZSA6PSBnZXRTdHJpbmcgZGVjbCwgJy5uYW1lLmVzY2FwZWRUZXh0J1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQjIC0tLSBDaGVjayBpbml0aWFsaXplciB0byBmaW5kIHRoZSB0eXBlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0aW5pdEtpbmQgOj0gZ2V0TnVtYmVyIGRlY2wsICcuaW5pdGlhbGl6ZXIua2luZCdcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRzd2l0Y2ggaW5pdEtpbmRcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHdoZW4gMjIwICAgIyAtLS0gQXJyb3dGdW5jdGlvblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRhbmFseXNpcy5hZGRFeHBvcnQgbmFtZSwgJ2Z1bmN0aW9uJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0d2hlbiAyNjEsOSAgICMgLS0tIFZhcmlhYmxlRGVjbGFyYXRpb25cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0YW5hbHlzaXMuYWRkRXhwb3J0IG5hbWUsICdjb25zdCdcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0YW5hbHlzaXMuYWRkRXhwb3J0IG5hbWUsICd1bmtub3duJ1xyXG5cdFx0XHRcdFx0XHR3aGVuIDI2MyAgICMgLS0tIEZ1bmN0aW9uRGVjbGFyYXRpb25cclxuXHRcdFx0XHRcdFx0XHRuYW1lIDo9IGdldFN0cmluZyBwYXJlbnQsICcubmFtZS5lc2NhcGVkVGV4dCdcclxuXHRcdFx0XHRcdFx0XHRhbmFseXNpcy5hZGRFeHBvcnQgbmFtZSwgJ2Z1bmN0aW9uJ1xyXG5cdFx0XHRcdFx0XHR3aGVuIDI2NCAgICMgLS0tIENsYXNzRGVjbGFyYXRpb25cclxuXHRcdFx0XHRcdFx0XHRuYW1lIDo9IGdldFN0cmluZyBwYXJlbnQsICcubmFtZS5lc2NhcGVkVGV4dCdcclxuXHRcdFx0XHRcdFx0XHRhbmFseXNpcy5hZGRFeHBvcnQgbmFtZSwgJ2NsYXNzJ1xyXG5cdFx0XHRcdFx0XHR3aGVuIDI2NiAgICMgLS0tIFR5cGVBbGlhc0RlY2xhcmF0aW9uXHJcblx0XHRcdFx0XHRcdFx0bmFtZSA6PSBnZXRTdHJpbmcgcGFyZW50LCAnLm5hbWUuZXNjYXBlZFRleHQnXHJcblx0XHRcdFx0XHRcdFx0YW5hbHlzaXMuYWRkRXhwb3J0IG5hbWUsICd0eXBlJ1xyXG5cdFx0XHRcdFx0XHRkZWZhdWx0XHJcblx0XHRcdFx0XHRcdFx0Y3JvYWsgXCJVbmV4cGVjdGVkIHN1YnR5cGUgb2YgOTU6ICN7cGFyZW50LmtpbmR9XCJcclxuXHRcdFx0XHRkZWZhdWx0XHJcblx0XHRcdFx0XHRpZiB0cmFjZVxyXG5cdFx0XHRcdFx0XHRMT0cgXCIgICAuLi5pZ25vcmVkXCJcclxuXHRyZXR1cm4gYW5hbHlzaXNcclxuIl19