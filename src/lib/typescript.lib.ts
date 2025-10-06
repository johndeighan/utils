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
import {CMainScope, CScope} from 'scope'

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
	mExports: Map<string,string> = new Map<string,string>()

	mainScope: CMainScope = new CMainScope()
	curScope: CScope
	finished: boolean = false

	// ..........................................................

	constructor() {

		this.curScope = this.mainScope
	}

	// ..........................................................

	define(name: string): void {

		this.curScope.define(name)
		return
	}

	// ..........................................................

	use(name: string): void {

		if (!hasKey(globalThis, name)) {
			this.curScope.use(name)
		}
		return
	}

	// ..........................................................

	addImport(lib: string, name: string): void {

		this.mImports.add(lib, name)
		this.define(name)
		return
	}

	// ..........................................................

	addExport(name: string, type: string): void {

		this.mExports.set(name, type)
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

		return Array.from(this.mExports.keys())
	}

	// ..........................................................

	newScope(name: (string | undefined), lArgs: string[]): void {

		this.curScope = this.mainScope.newScope(name, lArgs)
		return
	}

	// ..........................................................

	endScope(): void {

		const scope = this.mainScope.endScope(this.curScope)
		if (defined(scope)) {
			this.curScope = scope
		}
		else {
			this.finished = true
		}
		return
	}

	// ..........................................................

	getMissing(): string[] {

		const walker = new Walker<CScope>()
		walker.isNode = (x: unknown) => { return (x instanceof CScope) }

		// --- Find all names that are used, but not defined
		const sNames = new Set<string>()
		for (const scope of walker.walk(this.mainScope)) {
			for (const name of scope.allUsed()) {
				if (!scope.isDefined(name)) {
					sNames.add(name)
				}
			}
		}
		return Array.from(sNames.values())
	}

	// ..........................................................

	getExtra(): string[] {

		const walker = new Walker<CScope>()
		walker.isNode = (x: unknown) => { return (x instanceof CScope) }

		// --- Find all names that are defined, but never used or exported
		const sNames = new Set<string>()
		for (const scope of walker.walk(this.mainScope)) {
			for (const name of scope.allDefined()) {
				if (!scope.isUsed(name) && !this.mExports.has(name)) {
					sNames.add(name)
				}
			}
		}
		return Array.from(sNames.values())
	}

	// ..........................................................

	asString(width: integer = 64): string {

		const h: TBlockDesc = {
			IMPORTS:  this.getImports(),
			EXPORTS:  this.getExports(),
			MISSING:  this.getMissing(),
			EXTRA:    this.getExtra()
			}
		if (isEmpty(h.IMPORTS)) {
			delete h.IMPORTS
		}
		if (isEmpty(h.EXPORTS)) {
			delete h.EXPORTS
		}
		if (isEmpty(h.MISSING)) {
			delete h.MISSING
		}
		if (isEmpty(h.EXTRA)) {
			delete h.EXTRA
		}
		return Blockify(h)
	}
}

// ---------------------------------------------------------------------------
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
			const name = getString(node, '.escapedText')
			analysis.use(name)
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
					analysis.endScope();break;
				}
			}
		}

		else if (vkind === 'enter') {
			switch(kind) {

				case 220: { {   // --- ArrowFunction

					const results1=[];for (const parm of getArray(node, '.parameters')) {
						results1.push(getString(parm, '.name.escapedText'))
					};const lParms =results1

					analysis.newScope(undef, lParms)};break;
				}

				case 261: {   // --- Variable Declaration

					try {
						const varName = getString(node, '.name.escapedText')
						analysis.define(varName)
					} catch(e) {};break;
				}

				case 263: { {   // --- FunctionDeclaration

					const funcName = getString(node, '.name.escapedText')
					const results2=[];for (const parm of getArray(node, '.parameters')) {
						results2.push(getString(parm, '.name.escapedText'))
					};const lParms =results2

					analysis.define(funcName)
					analysis.newScope(funcName, lParms)};break;
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
						analysis.addImport(lib, name)
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQzovVXNlcnMvam9obmQvdXRpbHMvc3JjL2xpYi90eXBlc2NyaXB0LmxpYi5jaXZldC50c3giLCJzb3VyY2VzIjpbIkM6L1VzZXJzL2pvaG5kL3V0aWxzL3NyYy9saWIvdHlwZXNjcmlwdC5saWIuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSx1QkFBc0I7QUFDdEIsQUFBQTtBQUNBLEFBQUEsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLGlCQUFpQjtBQUMxQyxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDbEMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTO0FBQ2hDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsVUFBVSxDQUFDO0FBQ3hELENBQUMsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsZUFBZSxDQUFDLENBQUMsb0JBQW9CLENBQUM7QUFDOUQsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLGVBQWUsQ0FBQztBQUNqRSxDQUFDLHFCQUFxQixDQUFDLENBQUMsNEJBQTRCLENBQUM7QUFDckQsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLFlBQVksQ0FBQztBQUM3QyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCO0FBQ3hCLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVk7QUFDOUIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMs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LFFBQVEsQ0FBQyxHQUFHLENBQUEsQUFBQyxJQUFJLEM7RUFBQSxDQUFBO0FBQ3JCLEFBQUEsRUFBRSxNO0NBQU0sQ0FBQTtBQUNSLEFBQUE7QUFDQSxBQUFBLENBQUMsNkRBQTREO0FBQzdELEFBQUE7QUFDQSxBQUFBLEMsU0FBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFBLENBQUE7QUFDM0MsQUFBQTtBQUNBLEFBQUEsRUFBRSxJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQSxBQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQTtBQUN6QixBQUFBLEVBQUUsSSxDQUFDLE1BQU0sQ0FBQSxBQUFDLElBQUksQ0FBQTtBQUNkLEFBQUEsRUFBRSxNO0NBQU0sQ0FBQTtBQUNSLEFBQUE7QUFDQSxBQUFBLENBQUMsNkRBQTREO0FBQzdELEFBQUE7QUFDQSxBQUFBLEMsU0FBVSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFBLENBQUE7QUFDNUMsQUFBQTtBQUNBLEFBQUEsRUFBRSxJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQSxBQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQTtBQUMxQixBQUFBLEVBQUUsTTtDQUFNLENBQUE7QUFDUixBQUFBO0FBQ0EsQUFBQSxDQUFDLDZEQUE0RDtBQUM3RCxBQUFBO0FBQ0EsQUFBQSxDLFVBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUEsQ0FBQTtBQUN6QixBQUFBO0FBQ0EsQUFBQSxFQUE0QixNQUExQixRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUM7QUFDbEMsQUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUFBLE1BQUEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUMxQyxBQUFBLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDLENBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDO0VBQUMsQ0FBQTtBQUM5QyxBQUFBLEVBQUUsTUFBTSxDQUFDLFE7Q0FBUSxDQUFBO0FBQ2pCLEFBQUE7QUFDQSxBQUFBLENBQUMsNkRBQTREO0FBQzdELEFBQUE7QUFDQSxBQUFBLEMsVUFBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQSxDQUFBO0FBQ3pCLEFBQUE7QUFDQSxBQUFBLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUEsQUFBQyxJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLEM7Q0FBQSxDQUFBO0FBQ3BDLEFBQUE7QUFDQSxBQUFBLENBQUMsNkRBQTREO0FBQzdELEFBQUE7QUFDQSxBQUFBLEMsUUFBUyxDQUFDLElBQUksQyxDLENBQUMsQUFBQyxNLFksQ0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFBLENBQUE7QUFDL0MsQUFBQTtBQUNBLEFBQUEsRUFBRSxJLENBQUMsUUFBUSxDLENBQUUsQ0FBQyxJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQSxBQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQTtBQUM3QyxBQUFBLEVBQUUsTTtDQUFNLENBQUE7QUFDUixBQUFBO0FBQ0EsQUFBQSxDQUFDLDZEQUE0RDtBQUM3RCxBQUFBO0FBQ0EsQUFBQSxDLFFBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUEsQ0FBQTtBQUNqQixBQUFBO0FBQ0EsQUFBQSxFQUFPLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQSxBQUFDLEksQ0FBQyxRQUFRLENBQUE7QUFDeEMs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QyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQ3ZELEFBQUEsRUFBRSxRQUFRLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDakIsQUFBQSxFQUFFLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQTtBQUNiLEFBQUEsRUFBRSxLQUFLLENBQUMsQ0FBQyxLQUFLO0FBQ2QsRUFBRSxDQUFDLENBQUE7QUFDSCxBQUFBO0FBQ0EsQUFBQSxDQUFTLE1BQVIsUUFBUSxDQUFDLENBQUUsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDNUIsQUFBQTtBQUNBLEFBQUEsQ0FBTyxNQUFOLE1BQU0sQ0FBQyxDQUFFLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQzFCLEFBQUEsQ0FBSyxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsTUFBTSxDQUFBLEFBQUMsTUFBTSxDQUFBO0FBQ3RCLEFBQUEsQ0FBQyxHQUFHLENBQUEsSUFBSSxDQUFBLENBQUEsQ0FBQTtBQUNSLEFBQUEsRUFBRSxHQUFHLENBQUEsQUFBQyxHQUFHLENBQUEsQUFBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUEsQ0FBQTtBQUNwQixBQUFBLEVBQUUsR0FBRyxDQUFBLEFBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQ3ZCLEFBQUEsRUFBRSxHQUFHLENBQUEsQUFBQyxHQUFHLENBQUEsQUFBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUEsQztDQUFBLENBQUE7QUFDcEIsQUFBQTtBQUNBLEFBQUEsQ0FBQyw2REFBNEQ7QUFDN0QsQUFBQTtBQUNBLEFBQUEsQ0FBVSxNQUFULFNBQVMsQ0FBQyxDQUFFLENBQUMsQ0FBQztBQUNmLEFBQUEsR0FBRyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFDakIsQUFBQSxHQUFHLE1BQU0sQyxDLENBQUMsQUFBQyxNLFksQ0FBTyxDQUFDLENBQUMsQ0FBQyxLQUFLO0FBQzFCLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ2IsQUFBQTtBQUNBLEFBQUEs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SSxDQUFDLENBQUUsQ0FBQyxTQUFTLENBQUEsQUFBQyxNQUFNLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQTtBQUNwRCxBQUFBLE9BQU8sUUFBUSxDQUFDLFNBQVMsQ0FBQSxBQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQSxPO01BQUEsQ0FBQTtBQUN2QyxBQUFBLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQSxDQUFBLENBQUEsR0FBRywyQkFBMEI7QUFDM0MsQUFBQSxPQUFXLE1BQUosSUFBSSxDQUFDLENBQUUsQ0FBQyxTQUFTLENBQUEsQUFBQyxNQUFNLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQTtBQUNwRCxBQUFBLE9BQU8sUUFBUSxDQUFDLFNBQVMsQ0FBQSxBQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQSxPO01BQUEsQ0FBQTtBQUN0QyxBQUFBLE1BQU0sT0FBTyxDQUFBO0FBQ2IsQUFBQSxPQUFPLEtBQUssQ0FBQSxBQUFDLENBQUMsMEJBQTBCLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEM7S0FBQSxDQUFBLE87SUFBQSxDQUFBO0FBQ3ZELEFBQUEsSUFBSSxPQUFPLENBQUE7QUFDWCxBQUFBLEtBQUssR0FBRyxDQUFBLEtBQUssQ0FBQSxDQUFBLENBQUE7QUFDYixBQUFBLE1BQU0sR0FBRyxDQUFBLEFBQUMsZUFBZSxDO0tBQUEsQztHQUFBLEM7RUFBQSxDO0NBQUEsQ0FBQTtBQUN6QixBQUFBLENBQUMsTUFBTSxDQUFDLFE7QUFBUSxDQUFBO0FBQ2hCIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIHR5cGVzY3JpcHQubGliLmNpdmV0XHJcblxyXG5pbXBvcnQge2N5YW4sIGJsdWV9IGZyb20gXCJAc3RkL2ZtdC9jb2xvcnNcIlxyXG5pbXBvcnQge2V4aXN0c1N5bmN9IGZyb20gJ0BzdGQvZnMnXHJcbmltcG9ydCB7c3RhdFN5bmN9IGZyb20gJ25vZGU6ZnMnXHJcbmltcG9ydCB7XHJcblx0U291cmNlRmlsZSwgTm9kZSwgU2NyaXB0VGFyZ2V0LCBTeW50YXhLaW5kLCBNb2R1bGVLaW5kLFxyXG5cdE5ld0xpbmVLaW5kLCBFbWl0SGludCwgQ29tcGlsZXJPcHRpb25zLCBNb2R1bGVSZXNvbHV0aW9uS2luZCxcclxuXHRjcmVhdGVTb3VyY2VGaWxlLCBjcmVhdGVQcmludGVyLCBjcmVhdGVQcm9ncmFtLCB0cmFuc3BpbGVNb2R1bGUsXHJcblx0Z2V0UHJlRW1pdERpYWdub3N0aWNzLCBmbGF0dGVuRGlhZ25vc3RpY01lc3NhZ2VUZXh0LFxyXG5cdGdldExpbmVBbmRDaGFyYWN0ZXJPZlBvc2l0aW9uLCBmb3JFYWNoQ2hpbGQsXHJcblx0fSBmcm9tIFwibnBtOnR5cGVzY3JpcHRcIlxyXG5cclxuaW1wb3J0IHtzZXB9IGZyb20gJ2Jhc2UtdXRpbHMnXHJcbmltcG9ydCB7XHJcblx0dW5kZWYsIGRlZmluZWQsIG5vdGRlZmluZWQsIGludGVnZXIsIFRTdHJpbmdHZW5lcmF0b3IsXHJcblx0aGFzaCwgaGFzaG9mLCBpc0hhc2gsIFRGaWx0ZXJGdW5jLCBpc1N0cmluZyxcclxuXHRpc0VtcHR5LCBub25FbXB0eSwgVENvbnN0cnVjdG9yLCBhc3NlcnQsIGNyb2FrLFxyXG5cdH0gZnJvbSAnZGF0YXR5cGVzJ1xyXG5pbXBvcnQge1xyXG5cdHRydW5jU3RyLCBnZXRPcHRpb25zLCBzcGFjZXMsIG8sIHdvcmRzLCBoYXNLZXksXHJcblx0c3RyaW5naWZ5LCBDU3RyaW5nU2V0TWFwLCBrZXlzLCBibG9ja2lmeSxcclxuXHR9IGZyb20gJ2xsdXRpbHMnXHJcbmltcG9ydCB7XHJcblx0ZXh0cmFjdCwgVFBhdGhJdGVtLCBnZXRTdHJpbmcsIGdldE51bWJlciwgZ2V0QXJyYXksXHJcblx0fSBmcm9tICdleHRyYWN0J1xyXG5pbXBvcnQge2luZGVudGVkLCBUQmxvY2tEZXNjLCBCbG9ja2lmeX0gZnJvbSAnaW5kZW50J1xyXG5pbXBvcnQge1xyXG5cdExPRywgREJHLCBMT0dWQUxVRSwgSU5ERU5ULCBVTkRFTlQsIERCR1ZBTFVFLFxyXG5cdH0gZnJvbSAnbG9nZ2VyJ1xyXG5pbXBvcnQge3NsdXJwLCBiYXJmLCBiYXJmVGVtcEZpbGUsIGZpbGVFeHR9IGZyb20gJ2ZzeXMnXHJcbmltcG9ydCB7T0wsIHRvTmljZSwgVE1hcEZ1bmN9IGZyb20gJ3RvLW5pY2UnXHJcbmltcG9ydCB7Z2V0Q21kT3V0cHV0U3luY30gZnJvbSAnZXhlYydcclxuaW1wb3J0IHtzdHJpcFNyY01hcH0gZnJvbSAnc291cmNlLW1hcCdcclxuaW1wb3J0IHtnZXROZWVkZWRJbXBvcnRTdG10c30gZnJvbSAnc3ltYm9scydcclxuaW1wb3J0IHtXYWxrZXIsIFRWaXNpdEtpbmR9IGZyb20gJ3dhbGtlcidcclxuaW1wb3J0IHtDTWFpblNjb3BlLCBDU2NvcGV9IGZyb20gJ3Njb3BlJ1xyXG5cclxuZGVjb2RlciA6PSBuZXcgVGV4dERlY29kZXIoXCJ1dGYtOFwiKVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBraW5kU3RyIDo9IChpOiBudW1iZXIpOiBzdHJpbmcgPT5cclxuXHJcblx0cmV0dXJuIFN5bnRheEtpbmRbaV1cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgdHMyYXN0IDo9IChcclxuXHRcdHRzQ29kZTogc3RyaW5nLFxyXG5cdFx0aE9wdGlvbnM6IGhhc2ggPSB7fVxyXG5cdFx0KTogTm9kZSA9PlxyXG5cclxuXHR0eXBlIG9wdCA9IHtcclxuXHRcdGZpbGVOYW1lOiBzdHJpbmdcclxuXHRcdH1cclxuXHR7ZmlsZU5hbWV9IDo9IGdldE9wdGlvbnM8b3B0PiBoT3B0aW9ucywge1xyXG5cdFx0ZmlsZU5hbWU6ICd0ZW1wLnRzJ1xyXG5cdFx0fVxyXG5cclxuXHR0c0NvZGUgPSBzdHJpcFNyY01hcCh0c0NvZGUpWzBdXHJcblx0aEFzdCA6PSBjcmVhdGVTb3VyY2VGaWxlKGZpbGVOYW1lLCB0c0NvZGUsIFNjcmlwdFRhcmdldC5MYXRlc3QpXHJcblx0ZmlsdGVyOiBURmlsdGVyRnVuYyA6PSAoeDogdW5rbm93bikgPT5cclxuXHRcdHJldHVybiAoXHJcblx0XHRcdCAgICh0eXBlb2YgeCA9PSAnb2JqZWN0JylcclxuXHRcdFx0JiYgKHggIT0gbnVsbClcclxuXHRcdFx0JiYgKCdraW5kJyBpbiB4KVxyXG5cdFx0XHQmJiAodHlwZW9mIHgua2luZCA9PSAnbnVtYmVyJylcclxuXHRcdFx0KVxyXG5cdHJldHVybiBoQXN0XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGFzdDJ0cyA6PSAobm9kZTogTm9kZSk6IHN0cmluZyA9PlxyXG5cclxuXHRhc3NlcnQgKG5vZGUua2luZCA9PSAzMDgpLCBcIk5vdCBhIFNvdXJjZUZpbGUgbm9kZVwiXHJcblx0cHJpbnRlciA6PSBjcmVhdGVQcmludGVyIHtuZXdMaW5lOiBOZXdMaW5lS2luZC5MaW5lRmVlZH1cclxuXHRyZXR1cm4gcHJpbnRlci5wcmludE5vZGUgRW1pdEhpbnQuVW5zcGVjaWZpZWQsIG5vZGUsIG5vZGUgYXMgU291cmNlRmlsZVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCB0eXBlQ2hlY2tGaWxlcyA6PSAoXHJcblx0XHRsRmlsZU5hbWVzOiBzdHJpbmcgfCBzdHJpbmdbXSxcclxuXHRcdGhPcHRpb25zOiBDb21waWxlck9wdGlvbnMgPSBoRGVmQ29uZmlnXHJcblx0XHQpOiBzdHJpbmdbXSA9PlxyXG5cclxuXHRpZiAodHlwZW9mIGxGaWxlTmFtZXMgPT0gJ3N0cmluZycpXHJcblx0XHRsRmlsZU5hbWVzID0gW2xGaWxlTmFtZXNdXHJcblx0cHJvZ3JhbSA6PSBjcmVhdGVQcm9ncmFtKGxGaWxlTmFtZXMsIGhPcHRpb25zKVxyXG5cdGVtaXRSZXN1bHQgOj0gcHJvZ3JhbS5lbWl0KClcclxuXHJcblx0bE1zZ3M6IHN0cmluZ1tdIDo9IFtdXHJcblx0Z2V0UHJlRW1pdERpYWdub3N0aWNzKHByb2dyYW0pLmZvckVhY2ggKGRpYWcpID0+XHJcblx0XHR7ZmlsZSwgc3RhcnQsIG1lc3NhZ2VUZXh0fSA6PSBkaWFnXHJcblx0XHRtc2cgOj0gZmxhdHRlbkRpYWdub3N0aWNNZXNzYWdlVGV4dCBtZXNzYWdlVGV4dCwgXCJcXG5cIlxyXG5cdFx0aWYgKGZpbGUpXHJcblx0XHRcdHtmaWxlTmFtZX0gOj0gZmlsZVxyXG5cdFx0XHR7bGluZSwgY2hhcmFjdGVyfSA6PSBnZXRMaW5lQW5kQ2hhcmFjdGVyT2ZQb3NpdGlvbiBmaWxlLCBzdGFydCFcclxuXHRcdFx0bE1zZ3MucHVzaCBcIiN7ZmlsZU5hbWV9Oigje2xpbmUrMX06I3tjaGFyYWN0ZXIrMX0pOiAje21zZ31cIlxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRsTXNncy5wdXNoIG1zZ1xyXG5cdHJldHVybiBsTXNnc1xyXG5cclxuZXhwb3J0IHR5cGVDaGVja0ZpbGUgPSB0eXBlQ2hlY2tGaWxlcyAgICMgLS0tIHN5bm9ueW1cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgdHNNYXBGdW5jOiBUTWFwRnVuYyA6PSAoXHJcblx0XHRrZXk6IHN0cmluZ1xyXG5cdFx0dmFsdWU6IHVua25vd25cclxuXHRcdGhQYXJlbnQ6IGhhc2hcclxuXHRcdCk6IHVua25vd24gPT5cclxuXHJcblx0aWYgKGtleSA9PSAna2luZCcpICYmICh0eXBlb2YgdmFsdWUgPT0gJ251bWJlcicpXHJcblx0XHRkZXNjIDo9IGN5YW4oJyAoJyArIGtpbmRTdHIodmFsdWUpICsgJyknKVxyXG5cdFx0cmV0dXJuIHZhbHVlLnRvU3RyaW5nKCkgKyBkZXNjXHJcblx0cmV0dXJuIHVuZGVmXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGFzdEFzU3RyaW5nIDo9IChcclxuXHRcdGhBc3Q6IE5vZGVcclxuXHRcdGhPcHRpb25zOiBoYXNoID0ge31cclxuXHRcdCk6IHN0cmluZyA9PlxyXG5cclxuXHRyZXR1cm4gdG9OaWNlIGhBc3QsIHtcclxuXHRcdGlnbm9yZUVtcHR5VmFsdWVzOiB0cnVlXHJcblx0XHRtYXBGdW5jOiB0c01hcEZ1bmNcclxuXHRcdGxJbmNsdWRlOiBoT3B0aW9ucy5sSW5jbHVkZVxyXG5cdFx0bEV4Y2x1ZGU6IHdvcmRzKFxyXG5cdFx0XHQncG9zIGVuZCBpZCBmbGFncyBtb2RpZmllckZsYWdzQ2FjaGUnXHJcblx0XHRcdCd0cmFuc2Zvcm1GbGFncyBoYXNFeHRlbmRlZFVuaWNvZGVFc2NhcGUnXHJcblx0XHRcdCdudW1lcmljTGl0ZXJhbEZsYWdzIHNldEV4dGVybmFsTW9kdWxlSW5kaWNhdG9yJ1xyXG5cdFx0XHQnbGFuZ3VhZ2VWZXJzaW9uIGxhbmd1YWdlVmFyaWFudCBqc0RvY1BhcnNpbmdNb2RlJ1xyXG5cdFx0XHQnaGFzTm9EZWZhdWx0TGliJ1xyXG5cdFx0XHQpXHJcblx0XHR9XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IHR5cGVDaGVja0NvZGUgOj0gKFxyXG5cdFx0dHNDb2RlOiBzdHJpbmdcclxuXHRcdCk6IHN0cmluZ1tdPyA9PlxyXG5cclxuXHQjIC0tLSBXZSBtdXN0IHBsYWNlIHRoZSBUeXBlU2NyaXB0IGZpbGUgYXQgdGhlIHByb2plY3Qgcm9vdFxyXG5cdCMgICAgIHNvIHRoYXQgcGF0aHMgZ290dGVuIGZyb20gLnN5bWJvbHMgcmVzb2x2ZSBjb3JyZWN0bHlcclxuXHJcblx0cGF0aCA6PSBcIi4vX3R5cGVjaGVja18udHNcIlxyXG5cdGJhcmYgcGF0aCwgdHNDb2RlXHJcblx0aFJlc3VsdCA6PSBnZXRDbWRPdXRwdXRTeW5jICdkZW5vJywgW1xyXG5cdFx0XHQnY2hlY2snLFxyXG5cdFx0XHQnLS1pbXBvcnQtbWFwJywgJ2ltcG9ydF9tYXAuanNvbmMnLFxyXG5cdFx0XHRwYXRoXHJcblx0XHRcdF1cclxuXHR7c3VjY2VzcywgY29kZSwgc3Rkb3V0LCBzdGRlcnJ9IDo9IGhSZXN1bHRcclxuXHRpZiBzdWNjZXNzICYmIChjb2RlID09IDApXHJcblx0XHRyZXR1cm4gW11cclxuXHRlbHNlIGlmIGRlZmluZWQoc3RkZXJyKVxyXG5cdFx0cmV0dXJuIFtzdGRlcnJdXHJcblx0ZWxzZVxyXG5cdFx0cmV0dXJuIFsnVW5rbm93biBlcnJvciddXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGNoZWNrVHlwZSA6PSAoXHJcblx0XHR2YWx1ZTogdW5rbm93blxyXG5cdFx0dHlwZVN0cjogc3RyaW5nXHJcblx0XHRleHBlY3RTdWNjZXNzOiBib29sZWFuID0gdHJ1ZVxyXG5cdFx0KTogc3RyaW5nW10gPT5cclxuXHJcblx0REJHIFwiQ0FMTCBjaGVja1R5cGUoKTpcIiwgSU5ERU5UXHJcblxyXG5cdHRzQ29kZSA6PSBnZXRUc0NvZGUgdHlwZVN0ciwgc3RyaW5naWZ5KHZhbHVlKVxyXG5cdERCR1ZBTFVFICd0c0NvZGUnLCB0c0NvZGVcclxuXHJcblx0IyAtLS0gY2hlY2sgaWYgd2UgbmVlZCB0byBpbXBvcnQgdGhlIHR5cGVcclxuXHRpbXBvcnRDb2RlIDo9IGdldEltcG9ydENvZGUodHlwZVN0cilcclxuXHREQkdWQUxVRSAnaW1wb3J0Q29kZScsIGltcG9ydENvZGVcclxuXHJcblx0Y29kZSA6PSBcIiN7aW1wb3J0Q29kZX1cXG4je3RzQ29kZX1cIlxyXG5cdGxEaWFnbm9zdGljcyA6PSB0eXBlQ2hlY2tDb2RlKGNvZGUpXHJcblx0aWYgZXhwZWN0U3VjY2VzcyAmJiBub25FbXB0eShsRGlhZ25vc3RpY3MpXHJcblx0XHRMT0cgXCJ0eXBlQ2hlY2tDb2RlIEZBSUxFRDpcIlxyXG5cdFx0TE9HIFwiQ09ERTpcIlxyXG5cdFx0TE9HIGNvZGVcclxuXHRcdExPR1ZBTFVFICdsRGlhZ25vc3RpY3MnLCBsRGlhZ25vc3RpY3NcclxuXHRlbHNlIGlmIG5vdCBleHBlY3RTdWNjZXNzICYmIGlzRW1wdHkobERpYWdub3N0aWNzKVxyXG5cdFx0TE9HIFwidHlwZUNoZWNrQ29kZSBTVUNDRUVERUQ6XCJcclxuXHRcdExPRyBcIkNPREU6XCJcclxuXHRcdExPRyBjb2RlXHJcblx0REJHIFVOREVOVFxyXG5cdHJldHVybiBsRGlhZ25vc3RpY3MgfHwgW11cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiMgLS0tIFdlIG5lZWQgdG8gYWRkICc6dW5rbm93bicgdG8gYW55IGZ1bmN0aW9uIHBhcmFtZXRlcnNcclxuIyAgICAgdGhhdCBkb24ndCBoYXZlIGFuIGV4cGxpY2l0IHR5cGVcclxuXHJcbmV4cG9ydCBnZXRUc0NvZGUgOj0gKFxyXG5cdFx0dHlwZVN0cjogc3RyaW5nXHJcblx0XHR2YWx1ZVN0cjogc3RyaW5nXHJcblx0XHQpOiBzdHJpbmcgPT5cclxuXHJcblx0REJHVkFMVUUgJ3R5cGVTdHInLCB0eXBlU3RyXHJcblx0REJHVkFMVUUgJ3ZhbHVlU3RyJywgdmFsdWVTdHJcclxuXHRyZXN1bHQgOj0gc3BsaXRGdW5jU3RyKHZhbHVlU3RyKVxyXG5cdGlmIGRlZmluZWQocmVzdWx0KVxyXG5cdFx0W2xQYXJtcywgYm9keV0gOj0gcmVzdWx0XHJcblx0XHRhZGRUeXBlIDo9IChwYXJtOiBzdHJpbmcpID0+XHJcblx0XHRcdGlmIChwYXJtLmluZGV4T2YoJzonKSA+PSAwKVxyXG5cdFx0XHRcdHJldHVybiBwYXJtXHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRyZXR1cm4gXCIje3Bhcm19OiB1bmtub3duXCJcclxuXHRcdHBhcm1TdHIgOj0gbFBhcm1zLm1hcChhZGRUeXBlKS5qb2luKCcsICcpXHJcblx0XHRyZXR1cm4gXCJjb25zdCB4OiAje3R5cGVTdHJ9ID0gKCN7cGFybVN0cn0pID0+ICN7Ym9keX1cIlxyXG5cdGVsc2VcclxuXHRcdHJldHVybiBcImNvbnN0IHg6ICN7dHlwZVN0cn0gPSAje3ZhbHVlU3RyfVwiXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxudHlwZSBzcGxpdFJlc3VsdCA9IFtzdHJpbmdbXSwgc3RyaW5nXVxyXG5cclxuZXhwb3J0IHNwbGl0RnVuY1N0ciA6PSAoXHJcblx0XHR2YWx1ZVN0cjogc3RyaW5nXHJcblx0XHQpOiBzcGxpdFJlc3VsdD8gPT5cclxuXHJcblx0aWYgbE1hdGNoZXMgOj0gdmFsdWVTdHIubWF0Y2goLy8vXlxyXG5cdFx0XHRcXChcclxuXHRcdFx0KFteXFwpXSopXHJcblx0XHRcdFxcKSBcXHMqIFtcXD1cXC1dXFw+XHJcblx0XHRcdFxccypcclxuXHRcdFx0KC4qKVxyXG5cdFx0XHQkLy8vKVxyXG5cdFx0W18sIHN0clBhcm1zLCBzdHJCb2R5XSA6PSBsTWF0Y2hlc1xyXG5cdFx0aWYgaXNFbXB0eShzdHJQYXJtcylcclxuXHRcdFx0cmV0dXJuIFtbXSwgc3RyQm9keV1cclxuXHRcdGVsc2VcclxuXHRcdFx0cmV0dXJuIFtcclxuXHRcdFx0XHRzdHJQYXJtcy5zcGxpdCgnLCcpLm1hcCgoeCkgPT4geC50cmltKCkpXHJcblx0XHRcdFx0c3RyQm9keVxyXG5cdFx0XHRcdF1cclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gdW5kZWZcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZ2V0SW1wb3J0Q29kZSA6PSAoXHJcblx0XHR0eXBlU3RyOiBzdHJpbmdcclxuXHRcdCk6IHN0cmluZyA9PlxyXG5cclxuXHREQkcgXCJDQUxMIGdldEltcG9ydENvZGUoKVwiXHJcblx0bFN5bWJvbHMgOj0gZ2V0U3ltYm9sc0Zyb21UeXBlKHR5cGVTdHIpXHJcblx0REJHVkFMVUUgJ2xTeW1ib2xzJywgbFN5bWJvbHNcclxuXHRpZiBub25FbXB0eShsU3ltYm9scylcclxuXHRcdGxTdG10cyA6PSBnZXROZWVkZWRJbXBvcnRTdG10cyhsU3ltYm9scylcclxuXHRcdERCR1ZBTFVFICdsU3RtdHMnLCBsU3RtdHNcclxuXHRcdHJldHVybiBsU3RtdHMuam9pbignXFxuJylcclxuXHRlbHNlXHJcblx0XHRyZXR1cm4gJydcclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5leHBvcnQgZ2V0U3ltYm9sc0Zyb21UeXBlIDo9ICh0eXBlU3RyOiBzdHJpbmcpOiBzdHJpbmdbXSA9PlxyXG5cclxuXHRpZiBsTWF0Y2hlcyA6PSB0eXBlU3RyLm1hdGNoKC8vL15cclxuXHRcdFx0KFtBLVphLXpdW0EtWmEtejAtOStdKilcclxuXHRcdFx0KD86XHJcblx0XHRcdFx0XFw8XHJcblx0XHRcdFx0KFtBLVphLXpdW0EtWmEtejAtOStdKilcclxuXHRcdFx0XHRcXD5cclxuXHRcdFx0XHQpP1xyXG5cdFx0XHQkLy8vKVxyXG5cdFx0W18sIHR5cGUsIHN1YnR5cGVdIDo9IGxNYXRjaGVzXHJcblx0XHRyZXR1cm4gbm9uRW1wdHkoc3VidHlwZSkgPyBbdHlwZSwgc3VidHlwZV0gOiBbdHlwZV1cclxuXHRlbHNlIGlmIGxNYXRjaGVzIDo9IHR5cGVTdHIubWF0Y2goLy8vXlxyXG5cdFx0XHRcXCggXFwpICAgICAgICAgICAgICAgICAgICAgICAgICMgKClcclxuXHRcdFx0XFxzKlxyXG5cdFx0XHRcXD0gXFw+ICAgICAgICAgICAgICAgICAgICAgICAgICMgPT5cclxuXHRcdFx0XFxzKlxyXG5cdFx0XHQoW0EtWmEtel1bQS1aYS16MC05K10qKSAgICAgICAjIGFuIGlkZW50aWZpZXJcclxuXHRcdFx0JC8vLylcclxuXHRcdHJldHVybiBbbE1hdGNoZXNbMV1dXHJcblx0ZWxzZVxyXG5cdFx0cmV0dXJuIFtdXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuaERlZkNvbmZpZzogQ29tcGlsZXJPcHRpb25zIDo9IHtcclxuXHRcImFsbG93SnNcIjogZmFsc2UsXHJcblx0XCJhbGxvd1VtZEdsb2JhbEFjY2Vzc1wiOiBmYWxzZSxcclxuXHRcImFsbG93VW5yZWFjaGFibGVDb2RlXCI6IGZhbHNlLFxyXG5cdFwiYWxsb3dVbnVzZWRMYWJlbHNcIjogZmFsc2UsXHJcblx0XCJhbHdheXNTdHJpY3RcIjogdHJ1ZSxcclxuXHRcImFzc3VtZUNoYW5nZXNPbmx5QWZmZWN0RGlyZWN0RGVwZW5kZW5jaWVzXCI6IGZhbHNlLFxyXG5cdFwiY2hlY2tKc1wiOiBmYWxzZSxcclxuXHRcImNvbXBvc2l0ZVwiOiBmYWxzZSxcclxuXHRcImRlY2xhcmF0aW9uXCI6IGZhbHNlLFxyXG5cdFwiZGVjbGFyYXRpb25EaXJcIjogdW5kZWZpbmVkLFxyXG5cdFwiZGVjbGFyYXRpb25NYXBcIjogZmFsc2UsXHJcblx0XCJlbWl0Qk9NXCI6IGZhbHNlLFxyXG5cdFwiZW1pdERlY2xhcmF0aW9uT25seVwiOiBmYWxzZSxcclxuXHRcImV4YWN0T3B0aW9uYWxQcm9wZXJ0eVR5cGVzXCI6IGZhbHNlLFxyXG5cdFwiZXhwZXJpbWVudGFsRGVjb3JhdG9yc1wiOiBmYWxzZSxcclxuXHRcImZvcmNlQ29uc2lzdGVudENhc2luZ0luRmlsZU5hbWVzXCI6IHRydWUsXHJcblx0XCJnZW5lcmF0ZUNwdVByb2ZpbGVcIjogbnVsbCxcclxuXHRcImdlbmVyYXRlVHJhY2VcIjogbnVsbCxcclxuXHRcImlnbm9yZURlcHJlY2F0aW9uc1wiOiBcIjUuMFwiLFxyXG5cdFwiaW1wb3J0SGVscGVyc1wiOiBmYWxzZSxcclxuXHRcImlubGluZVNvdXJjZU1hcFwiOiBmYWxzZSxcclxuXHRcImlubGluZVNvdXJjZXNcIjogZmFsc2UsXHJcblx0XCJpc29sYXRlZE1vZHVsZXNcIjogZmFsc2UsXHJcbiNcdFwianN4XCI6IFwicmVhY3QtanN4XCIsXHJcbiNcdFwianN4RmFjdG9yeVwiOiBcIlJlYWN0LmNyZWF0ZUVsZW1lbnRcIixcclxuI1x0XCJqc3hGcmFnbWVudEZhY3RvcnlcIjogXCJSZWFjdC5GcmFnbWVudFwiLFxyXG4jXHRcImpzeEltcG9ydFNvdXJjZVwiOiBcInJlYWN0XCIsXHJcblx0XCJsaWJcIjogW1xyXG5cdFx0XCJlc25leHRcIixcclxuXHRcdFwiZG9tXCIsXHJcblx0XHRcImRvbS5pdGVyYWJsZVwiXHJcblx0XSxcclxuXHRcIm1hcFJvb3RcIjogdW5kZWZpbmVkLFxyXG5cdFwibWF4Tm9kZU1vZHVsZUpzRGVwdGhcIjogMCxcclxuXHRcIm1vZHVsZVwiOiBNb2R1bGVLaW5kLkVTTmV4dCxcclxuXHRcIm1vZHVsZURldGVjdGlvblwiOiB1bmRlZmluZWQsXHJcblx0XCJtb2R1bGVSZXNvbHV0aW9uXCI6IE1vZHVsZVJlc29sdXRpb25LaW5kLk5vZGVOZXh0LFxyXG5cdFwibmV3TGluZVwiOiBOZXdMaW5lS2luZC5MaW5lRmVlZCxcclxuXHRcIm5vRW1pdFwiOiB0cnVlLFxyXG5cdFwibm9FbWl0SGVscGVyc1wiOiBmYWxzZSxcclxuXHRcIm5vRW1pdE9uRXJyb3JcIjogZmFsc2UsXHJcblx0XCJub0Vycm9yVHJ1bmNhdGlvblwiOiBmYWxzZSxcclxuXHRcIm5vRmFsbHRocm91Z2hDYXNlc0luU3dpdGNoXCI6IHRydWUsXHJcblx0XCJub0ltcGxpY2l0QW55XCI6IHRydWUsXHJcblx0XCJub0ltcGxpY2l0T3ZlcnJpZGVcIjogdHJ1ZSxcclxuXHRcIm5vSW1wbGljaXRSZXR1cm5zXCI6IHRydWUsXHJcblx0XCJub0ltcGxpY2l0VGhpc1wiOiB0cnVlLFxyXG5cdFwibm9Qcm9wZXJ0eUFjY2Vzc0Zyb21JbmRleFNpZ25hdHVyZVwiOiB0cnVlLFxyXG5cdFwibm9VbmNoZWNrZWRJbmRleGVkQWNjZXNzXCI6IHRydWUsXHJcblx0XCJub1VudXNlZExvY2Fsc1wiOiB0cnVlLFxyXG5cdFwibm9VbnVzZWRQYXJhbWV0ZXJzXCI6IHRydWUsXHJcblx0XCJvdXREaXJcIjogdW5kZWZpbmVkLFxyXG5cdFwib3V0RmlsZVwiOiB1bmRlZmluZWQsXHJcblx0XCJwYXRoc1wiOiB7fSxcclxuXHRcInByZXNlcnZlQ29uc3RFbnVtc1wiOiBmYWxzZSxcclxuXHRcInByZXNlcnZlU3ltbGlua3NcIjogZmFsc2UsXHJcblx0XCJwcmVzZXJ2ZVZhbHVlSW1wb3J0c1wiOiBmYWxzZSxcclxuXHRcInJlYWN0TmFtZXNwYWNlXCI6IFwiUmVhY3RcIixcclxuXHRcInJlbW92ZUNvbW1lbnRzXCI6IGZhbHNlLFxyXG5cdFwicmVzb2x2ZUpzb25Nb2R1bGVcIjogdHJ1ZSxcclxuXHRcInJvb3REaXJcIjogdW5kZWZpbmVkLFxyXG5cdFwicm9vdERpcnNcIjogW10sXHJcblx0XCJza2lwRGVmYXVsdExpYkNoZWNrXCI6IGZhbHNlLFxyXG5cdFwic2tpcExpYkNoZWNrXCI6IGZhbHNlLFxyXG5cdFwic291cmNlTWFwXCI6IGZhbHNlLFxyXG5cdFwic291cmNlUm9vdFwiOiB1bmRlZmluZWQsXHJcblx0XCJzdHJpY3RcIjogdHJ1ZSxcclxuXHRcInN0cmljdEJpbmRDYWxsQXBwbHlcIjogdHJ1ZSxcclxuXHRcInN0cmljdEZ1bmN0aW9uVHlwZXNcIjogdHJ1ZSxcclxuXHRcInN0cmljdE51bGxDaGVja3NcIjogdHJ1ZSxcclxuXHRcInN0cmljdFByb3BlcnR5SW5pdGlhbGl6YXRpb25cIjogdHJ1ZSxcclxuXHRcInN0cmlwSW50ZXJuYWxcIjogZmFsc2UsXHJcblx0XCJzdXBwcmVzc0V4Y2Vzc1Byb3BlcnR5RXJyb3JzXCI6IGZhbHNlLFxyXG5cdFwic3VwcHJlc3NJbXBsaWNpdEFueUluZGV4RXJyb3JzXCI6IGZhbHNlLFxyXG5cdFwidGFyZ2V0XCI6IFNjcmlwdFRhcmdldC5FUzIwMjIsXHJcblx0XCJ0cmFjZVJlc29sdXRpb25cIjogZmFsc2UsXHJcblx0XCJ0c0J1aWxkSW5mb0ZpbGVcIjogdW5kZWZpbmVkLFxyXG5cdFwidHlwZVJvb3RzXCI6IFtdLFxyXG5cdFwidXNlRGVmaW5lRm9yQ2xhc3NGaWVsZHNcIjogdHJ1ZSxcclxuXHRcInVzZVVua25vd25JbkNhdGNoVmFyaWFibGVzXCI6IHRydWVcclxuXHR9XHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxudHlwZSBUQXN0RmlsdGVyRnVuYyA9IChub2RlOiBOb2RlKSA9PiBib29sZWFuXHJcblxyXG5leHBvcnQgY2xhc3MgQXN0V2Fsa2VyIGV4dGVuZHMgV2Fsa2VyPE5vZGU+XHJcblxyXG5cdGZpbHRlckZ1bmM6IFRBc3RGaWx0ZXJGdW5jP1xyXG5cdGhPcHRpb25zOiBoYXNoXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRjb25zdHJ1Y3RvcihcclxuXHRcdFx0QGZpbHRlckZ1bmM6IFRBc3RGaWx0ZXJGdW5jPyA9IHVuZGVmXHJcblx0XHRcdEBoT3B0aW9ucyA9IHt9XHJcblx0XHRcdClcclxuXHJcblx0XHRzdXBlcigpXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRkYmcob3A6ICdwdXNoJyB8ICdwb3AnLCBub2RlOiBOb2RlKTogdm9pZFxyXG5cclxuXHRcdHByZWZpeCA6PSAnICAgJ1xyXG5cdFx0a2luZCA6PSBub2RlLmtpbmRcclxuXHRcdGNvbnNvbGUubG9nIFwiI3twcmVmaXh9I3tvcC50b1VwcGVyQ2FzZSgpfTogI3traW5kfSBbI3tAc3RhY2tEZXNjKCl9XVwiXHJcblx0XHRyZXR1cm5cclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblxyXG5cdHN0YWNrRGVzYygpOiBzdHJpbmdcclxuXHJcblx0XHRsU3RhY2sgOj0gZm9yIG5vZGUgb2YgQGxOb2RlU3RhY2tcclxuXHRcdFx0bm9kZS5raW5kLnRvU3RyaW5nKClcclxuXHRcdHJldHVybiBsU3RhY2suam9pbignLCcpXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRvdmVycmlkZSBwdXNoTm9kZShub2RlOiBOb2RlKTogdm9pZFxyXG5cclxuXHRcdHN1cGVyLnB1c2hOb2RlKG5vZGUpXHJcblx0XHRpZiBAaE9wdGlvbnMudHJhY2VcclxuXHRcdFx0QGRiZyAncHVzaCcsIG5vZGVcclxuXHRcdHJldHVyblxyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0b3ZlcnJpZGUgcG9wTm9kZSgpOiBOb2RlP1xyXG5cclxuXHRcdG5vZGUgOj0gc3VwZXIucG9wTm9kZSgpXHJcblx0XHRpZiBAaE9wdGlvbnMudHJhY2VcclxuXHRcdFx0aWYgZGVmaW5lZChub2RlKVxyXG5cdFx0XHRcdEBkYmcgJ3BvcCcsIG5vZGVcclxuXHRcdFx0ZWxzZVxyXG5cdFx0XHRcdGNvbnNvbGUubG9nIFwiU1RBQ0sgRU1QVFlcIlxyXG5cdFx0cmV0dXJuIG5vZGVcclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblxyXG5cdG92ZXJyaWRlIGlzTm9kZSh4OiBvYmplY3QpOiB4IGlzIE5vZGVcclxuXHJcblx0XHRyZXR1cm4gT2JqZWN0Lmhhc093biB4LCAna2luZCdcclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblxyXG5cdG92ZXJyaWRlIGZpbHRlcihub2RlOiBOb2RlKTogYm9vbGVhblxyXG5cclxuXHRcdHJldHVybiBkZWZpbmVkKEBmaWx0ZXJGdW5jKSA/IEBmaWx0ZXJGdW5jKG5vZGUpIDogdHJ1ZVxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBjbGFzcyBDQW5hbHlzaXNcclxuXHJcblx0bUltcG9ydHM6IENTdHJpbmdTZXRNYXAgPSBuZXcgQ1N0cmluZ1NldE1hcCgpXHJcblx0bUV4cG9ydHM6IE1hcDxzdHJpbmcsc3RyaW5nPiA9IG5ldyBNYXA8c3RyaW5nLHN0cmluZz4oKVxyXG5cclxuXHRtYWluU2NvcGU6IENNYWluU2NvcGUgPSBuZXcgQ01haW5TY29wZSgpXHJcblx0Y3VyU2NvcGU6IENTY29wZVxyXG5cdGZpbmlzaGVkOiBib29sZWFuID0gZmFsc2VcclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblxyXG5cdGNvbnN0cnVjdG9yKClcclxuXHJcblx0XHRAY3VyU2NvcGUgPSBAbWFpblNjb3BlXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRkZWZpbmUobmFtZTogc3RyaW5nKTogdm9pZFxyXG5cclxuXHRcdEBjdXJTY29wZS5kZWZpbmUgbmFtZVxyXG5cdFx0cmV0dXJuXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHR1c2UobmFtZTogc3RyaW5nKTogdm9pZFxyXG5cclxuXHRcdGlmIG5vdCBoYXNLZXkoZ2xvYmFsVGhpcywgbmFtZSlcclxuXHRcdFx0QGN1clNjb3BlLnVzZSBuYW1lXHJcblx0XHRyZXR1cm5cclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblxyXG5cdGFkZEltcG9ydChsaWI6IHN0cmluZywgbmFtZTogc3RyaW5nKTogdm9pZFxyXG5cclxuXHRcdEBtSW1wb3J0cy5hZGQgbGliLCBuYW1lXHJcblx0XHRAZGVmaW5lIG5hbWVcclxuXHRcdHJldHVyblxyXG5cclxuXHQjIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHJcblx0YWRkRXhwb3J0KG5hbWU6IHN0cmluZywgdHlwZTogc3RyaW5nKTogdm9pZFxyXG5cclxuXHRcdEBtRXhwb3J0cy5zZXQgbmFtZSwgdHlwZVxyXG5cdFx0cmV0dXJuXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRnZXRJbXBvcnRzKCk6IFRCbG9ja0Rlc2NcclxuXHJcblx0XHRoSW1wb3J0czogaGFzaG9mPHN0cmluZ1tdPiA6PSB7fVxyXG5cdFx0Zm9yIFtsaWIsIHNOYW1lc10gb2YgQG1JbXBvcnRzLmVudHJpZXMoKVxyXG5cdFx0XHRoSW1wb3J0c1tsaWJdID0gQXJyYXkuZnJvbShzTmFtZXMudmFsdWVzKCkpXHJcblx0XHRyZXR1cm4gaEltcG9ydHNcclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblxyXG5cdGdldEV4cG9ydHMoKTogVEJsb2NrRGVzY1xyXG5cclxuXHRcdHJldHVybiBBcnJheS5mcm9tIEBtRXhwb3J0cy5rZXlzKClcclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblxyXG5cdG5ld1Njb3BlKG5hbWU6IHN0cmluZz8sIGxBcmdzOiBzdHJpbmdbXSk6IHZvaWRcclxuXHJcblx0XHRAY3VyU2NvcGUgPSBAbWFpblNjb3BlLm5ld1Njb3BlIG5hbWUsIGxBcmdzXHJcblx0XHRyZXR1cm5cclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblxyXG5cdGVuZFNjb3BlKCk6IHZvaWRcclxuXHJcblx0XHRzY29wZSA6PSBAbWFpblNjb3BlLmVuZFNjb3BlIEBjdXJTY29wZVxyXG5cdFx0aWYgZGVmaW5lZCBzY29wZVxyXG5cdFx0XHRAY3VyU2NvcGUgPSBzY29wZVxyXG5cdFx0ZWxzZVxyXG5cdFx0XHRAZmluaXNoZWQgPSB0cnVlXHJcblx0XHRyZXR1cm5cclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblxyXG5cdGdldE1pc3NpbmcoKTogc3RyaW5nW11cclxuXHJcblx0XHR3YWxrZXIgOj0gbmV3IFdhbGtlcjxDU2NvcGU+KClcclxuXHRcdHdhbGtlci5pc05vZGUgPSAoeDogdW5rbm93bikgPT4gcmV0dXJuICh4IGluc3RhbmNlb2YgQ1Njb3BlKVxyXG5cclxuXHRcdCMgLS0tIEZpbmQgYWxsIG5hbWVzIHRoYXQgYXJlIHVzZWQsIGJ1dCBub3QgZGVmaW5lZFxyXG5cdFx0c05hbWVzIDo9IG5ldyBTZXQ8c3RyaW5nPigpXHJcblx0XHRmb3Igc2NvcGUgb2Ygd2Fsa2VyLndhbGsoQG1haW5TY29wZSlcclxuXHRcdFx0Zm9yIG5hbWUgb2Ygc2NvcGUuYWxsVXNlZCgpXHJcblx0XHRcdFx0aWYgbm90IHNjb3BlLmlzRGVmaW5lZCBuYW1lXHJcblx0XHRcdFx0XHRzTmFtZXMuYWRkIG5hbWVcclxuXHRcdHJldHVybiBBcnJheS5mcm9tKHNOYW1lcy52YWx1ZXMoKSlcclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblxyXG5cdGdldEV4dHJhKCk6IHN0cmluZ1tdXHJcblxyXG5cdFx0d2Fsa2VyIDo9IG5ldyBXYWxrZXI8Q1Njb3BlPigpXHJcblx0XHR3YWxrZXIuaXNOb2RlID0gKHg6IHVua25vd24pID0+IHJldHVybiAoeCBpbnN0YW5jZW9mIENTY29wZSlcclxuXHJcblx0XHQjIC0tLSBGaW5kIGFsbCBuYW1lcyB0aGF0IGFyZSBkZWZpbmVkLCBidXQgbmV2ZXIgdXNlZCBvciBleHBvcnRlZFxyXG5cdFx0c05hbWVzIDo9IG5ldyBTZXQ8c3RyaW5nPigpXHJcblx0XHRmb3Igc2NvcGUgb2Ygd2Fsa2VyLndhbGsoQG1haW5TY29wZSlcclxuXHRcdFx0Zm9yIG5hbWUgb2Ygc2NvcGUuYWxsRGVmaW5lZCgpXHJcblx0XHRcdFx0aWYgbm90IHNjb3BlLmlzVXNlZChuYW1lKSAmJiBub3QgQG1FeHBvcnRzLmhhcyhuYW1lKVxyXG5cdFx0XHRcdFx0c05hbWVzLmFkZCBuYW1lXHJcblx0XHRyZXR1cm4gQXJyYXkuZnJvbShzTmFtZXMudmFsdWVzKCkpXHJcblxyXG5cdCMgLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLlxyXG5cclxuXHRhc1N0cmluZyh3aWR0aDogaW50ZWdlciA9IDY0KTogc3RyaW5nXHJcblxyXG5cdFx0aDogVEJsb2NrRGVzYyA6PSB7XHJcblx0XHRcdElNUE9SVFM6ICBAZ2V0SW1wb3J0cygpXHJcblx0XHRcdEVYUE9SVFM6ICBAZ2V0RXhwb3J0cygpXHJcblx0XHRcdE1JU1NJTkc6ICBAZ2V0TWlzc2luZygpXHJcblx0XHRcdEVYVFJBOiAgICBAZ2V0RXh0cmEoKVxyXG5cdFx0XHR9XHJcblx0XHRpZiBpc0VtcHR5IGguSU1QT1JUU1xyXG5cdFx0XHRkZWxldGUgaC5JTVBPUlRTXHJcblx0XHRpZiBpc0VtcHR5IGguRVhQT1JUU1xyXG5cdFx0XHRkZWxldGUgaC5FWFBPUlRTXHJcblx0XHRpZiBpc0VtcHR5IGguTUlTU0lOR1xyXG5cdFx0XHRkZWxldGUgaC5NSVNTSU5HXHJcblx0XHRpZiBpc0VtcHR5IGguRVhUUkFcclxuXHRcdFx0ZGVsZXRlIGguRVhUUkFcclxuXHRcdHJldHVybiBCbG9ja2lmeSBoXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGFzc2VydElzTm9kZTogKHg6IHVua25vd24pID0+IGFzc2VydHMgeCBpcyBOb2RlIDo9IChcclxuXHRcdHg6IHVua25vd25cclxuXHRcdCk6IGFzc2VydHMgeCBpcyBOb2RlID0+XHJcblxyXG5cdGFzc2VydCBoYXNLZXkoeCwgJ2tpbmQnKSwgXCJOb3QgYSBOb2RlOiAje3R5cGVvZiB4fVwiXHJcblxyXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZXhwb3J0IGdldE5vZGUgOj0gKFxyXG5cdFx0eDogdW5rbm93bixcclxuXHRcdGRzcGF0aDogc3RyaW5nIHwgVFBhdGhJdGVtW11cclxuXHRcdCk6IE5vZGUgPT5cclxuXHJcblx0dmFsIDo9IGV4dHJhY3QoeCwgZHNwYXRoKVxyXG5cdGFzc2VydElzTm9kZSh2YWwpXHJcblx0cmV0dXJuIHZhbFxyXG5cclxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmV4cG9ydCBhbmFseXplIDo9IChcclxuXHRcdHRzQ29kZTogc3RyaW5nXHJcblx0XHRoT3B0aW9uczogaGFzaCA9IHt9XHJcblx0XHQpOiBDQW5hbHlzaXMgPT5cclxuXHJcblx0dHlwZSBvcHQgPSB7XHJcblx0XHRmaWxlTmFtZTogc3RyaW5nP1xyXG5cdFx0ZHVtcDogYm9vbGVhblxyXG5cdFx0dHJhY2U6IGJvb2xlYW5cclxuXHRcdH1cclxuXHR7ZmlsZU5hbWUsIGR1bXAsIHRyYWNlfSA6PSBnZXRPcHRpb25zPG9wdD4gaE9wdGlvbnMsIHtcclxuXHRcdGZpbGVOYW1lOiB1bmRlZlxyXG5cdFx0ZHVtcDogZmFsc2VcclxuXHRcdHRyYWNlOiBmYWxzZVxyXG5cdFx0fVxyXG5cclxuXHRhbmFseXNpcyA6PSBuZXcgQ0FuYWx5c2lzKClcclxuXHJcblx0d2Fsa2VyIDo9IG5ldyBBc3RXYWxrZXIoKVxyXG5cdGhBc3QgOj0gdHMyYXN0IHRzQ29kZVxyXG5cdGlmIGR1bXBcclxuXHRcdExPRyBzZXAgJ0FTVCcsICc9J1xyXG5cdFx0TE9HIGFzdEFzU3RyaW5nKGhBc3QpXHJcblx0XHRMT0cgc2VwIHVuZGVmLCAnPSdcclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblxyXG5cdGNoZWNrTm9kZSA6PSAoXHJcblx0XHRcdG5vZGU6IHVua25vd24sXHJcblx0XHRcdGRzcGF0aDogc3RyaW5nPyA9IHVuZGVmXHJcblx0XHRcdCk6IHZvaWQgPT5cclxuXHJcblx0XHRhc3NlcnRJc05vZGUgbm9kZVxyXG5cdFx0aWYgZGVmaW5lZChkc3BhdGgpXHJcblx0XHRcdG5vZGUgPSBnZXROb2RlIG5vZGUsIGRzcGF0aFxyXG5cdFx0XHRhc3NlcnRJc05vZGUgbm9kZVxyXG5cclxuXHRcdGlmIChub2RlLmtpbmQgPT0gODApXHJcblx0XHRcdG5hbWUgOj0gZ2V0U3RyaW5nIG5vZGUsICcuZXNjYXBlZFRleHQnXHJcblx0XHRcdGFuYWx5c2lzLnVzZSBuYW1lXHJcblx0XHRyZXR1cm5cclxuXHJcblx0IyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblxyXG5cdGZvciBbdmtpbmQsIG5vZGVdIG9mIHdhbGtlci53YWxrRXggaEFzdFxyXG5cdFx0e2tpbmR9IDo9IG5vZGVcclxuXHRcdGlmIHRyYWNlXHJcblx0XHRcdExPRyBcIk5PREUgS0lORDogI3traW5kfSAoI3traW5kU3RyKGtpbmQpfSlcIlxyXG5cdFx0aWYgKHZraW5kID09ICdleGl0JylcclxuXHRcdFx0c3dpdGNoIGtpbmRcclxuXHRcdFx0XHR3aGVuIDIyMCwgMjYzICAgIyAtLS0gQXJyb3dGdW5jdGlvbiwgRnVuY3Rpb25EZWNsYXJhdGlvblxyXG5cdFx0XHRcdFx0YW5hbHlzaXMuZW5kU2NvcGUoKVxyXG5cclxuXHRcdGVsc2UgaWYgKHZraW5kID09ICdlbnRlcicpXHJcblx0XHRcdHN3aXRjaCBraW5kXHJcblxyXG5cdFx0XHRcdHdoZW4gMjIwICAgIyAtLS0gQXJyb3dGdW5jdGlvblxyXG5cclxuXHRcdFx0XHRcdGxQYXJtcyA6PSBmb3IgcGFybSBvZiBnZXRBcnJheSBub2RlLCAnLnBhcmFtZXRlcnMnXHJcblx0XHRcdFx0XHRcdGdldFN0cmluZyBwYXJtLCAnLm5hbWUuZXNjYXBlZFRleHQnXHJcblxyXG5cdFx0XHRcdFx0YW5hbHlzaXMubmV3U2NvcGUodW5kZWYsIGxQYXJtcylcclxuXHJcblx0XHRcdFx0d2hlbiAyNjEgICAjIC0tLSBWYXJpYWJsZSBEZWNsYXJhdGlvblxyXG5cclxuXHRcdFx0XHRcdHRyeVxyXG5cdFx0XHRcdFx0XHR2YXJOYW1lIDo9IGdldFN0cmluZyBub2RlLCAnLm5hbWUuZXNjYXBlZFRleHQnXHJcblx0XHRcdFx0XHRcdGFuYWx5c2lzLmRlZmluZSB2YXJOYW1lXHJcblxyXG5cdFx0XHRcdHdoZW4gMjYzICAgIyAtLS0gRnVuY3Rpb25EZWNsYXJhdGlvblxyXG5cclxuXHRcdFx0XHRcdGZ1bmNOYW1lIDo9IGdldFN0cmluZyBub2RlLCAnLm5hbWUuZXNjYXBlZFRleHQnXHJcblx0XHRcdFx0XHRsUGFybXMgOj0gZm9yIHBhcm0gb2YgZ2V0QXJyYXkgbm9kZSwgJy5wYXJhbWV0ZXJzJ1xyXG5cdFx0XHRcdFx0XHRnZXRTdHJpbmcgcGFybSwgJy5uYW1lLmVzY2FwZWRUZXh0J1xyXG5cclxuXHRcdFx0XHRcdGFuYWx5c2lzLmRlZmluZSBmdW5jTmFtZVxyXG5cdFx0XHRcdFx0YW5hbHlzaXMubmV3U2NvcGUgZnVuY05hbWUsIGxQYXJtc1xyXG5cclxuXHRcdFx0XHR3aGVuIDIyNyAgICMgLS0tIEJpbmFyeUV4cHJlc3Npb25cclxuXHJcblx0XHRcdFx0XHRjaGVja05vZGUgbm9kZSwgJy5sZWZ0J1xyXG5cdFx0XHRcdFx0Y2hlY2tOb2RlIG5vZGUsICcucmlnaHQnXHJcblxyXG5cdFx0XHRcdHdoZW4gMjE0ICAgIyAtLS0gQ2FsbEV4cHJlc3Npb25cclxuXHJcblx0XHRcdFx0XHRjaGVja05vZGUgbm9kZSwgJy5leHByZXNzaW9uJ1xyXG5cdFx0XHRcdFx0Zm9yIGFyZyBvZiBnZXRBcnJheSBub2RlLCAnLmFyZ3VtZW50cydcclxuXHRcdFx0XHRcdFx0Y2hlY2tOb2RlIGFyZ1xyXG5cclxuXHRcdFx0XHR3aGVuIDI3MyAgICMgLS0tIEltcG9ydERlY2xhcmF0aW9uXHJcblxyXG5cdFx0XHRcdFx0bGliIDo9IGdldFN0cmluZyBub2RlLCAnLm1vZHVsZVNwZWNpZmllci50ZXh0J1xyXG5cdFx0XHRcdFx0Zm9yIGggb2YgZ2V0QXJyYXkgbm9kZSwgJy5pbXBvcnRDbGF1c2UubmFtZWRCaW5kaW5ncy5lbGVtZW50cydcclxuXHRcdFx0XHRcdFx0bmFtZSA6PSBnZXRTdHJpbmcgaCwgJy5uYW1lLmVzY2FwZWRUZXh0J1xyXG5cdFx0XHRcdFx0XHRpZiB0cmFjZVxyXG5cdFx0XHRcdFx0XHRcdGNvbnNvbGUubG9nIFwiTkFNRTogJyN7bmFtZX0nIGluICcje2xpYn0nXCJcclxuXHRcdFx0XHRcdFx0YW5hbHlzaXMuYWRkSW1wb3J0IGxpYiwgbmFtZVxyXG5cclxuXHRcdFx0XHR3aGVuIDI4MCAgICMgLS0tIE5hbWVkRXhwb3J0c1xyXG5cclxuXHRcdFx0XHRcdGZvciBlbGVtIG9mIGdldEFycmF5IG5vZGUsICcuZWxlbWVudHMnXHJcblx0XHRcdFx0XHRcdG5hbWUgOj0gZ2V0U3RyaW5nIGVsZW0sICcubmFtZS5lc2NhcGVkVGV4dCdcclxuXHRcdFx0XHRcdFx0YW5hbHlzaXMuYWRkRXhwb3J0IG5hbWUsICdyZS1leHBvcnQnXHJcblxyXG5cdFx0XHRcdHdoZW4gOTUgICAgIyAtLS0gRXhwb3J0S2V5d29yZFxyXG5cclxuXHRcdFx0XHRcdHBhcmVudCA6PSB3YWxrZXIucGFyZW50KClcclxuXHRcdFx0XHRcdHN3aXRjaCBnZXROdW1iZXIgcGFyZW50LCAnLmtpbmQnXHJcblx0XHRcdFx0XHRcdHdoZW4gMjQ0XHJcblx0XHRcdFx0XHRcdFx0Zm9yIGRlY2wgb2YgZ2V0QXJyYXkgcGFyZW50LCAnLmRlY2xhcmF0aW9uTGlzdC5kZWNsYXJhdGlvbnMnXHJcblx0XHRcdFx0XHRcdFx0XHRzd2l0Y2ggZ2V0TnVtYmVyIGRlY2wsICcua2luZCdcclxuXHRcdFx0XHRcdFx0XHRcdFx0d2hlbiAyNjEgICAjIC0tLSBWYXJpYWJsZURlY2xhcmF0aW9uXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZSA6PSBnZXRTdHJpbmcgZGVjbCwgJy5uYW1lLmVzY2FwZWRUZXh0J1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQjIC0tLSBDaGVjayBpbml0aWFsaXplciB0byBmaW5kIHRoZSB0eXBlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0aW5pdEtpbmQgOj0gZ2V0TnVtYmVyIGRlY2wsICcuaW5pdGlhbGl6ZXIua2luZCdcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRzd2l0Y2ggaW5pdEtpbmRcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHdoZW4gMjIwICAgIyAtLS0gQXJyb3dGdW5jdGlvblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRhbmFseXNpcy5hZGRFeHBvcnQgbmFtZSwgJ2Z1bmN0aW9uJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0d2hlbiAyNjEsOSAgICMgLS0tIFZhcmlhYmxlRGVjbGFyYXRpb25cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0YW5hbHlzaXMuYWRkRXhwb3J0IG5hbWUsICdjb25zdCdcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0YW5hbHlzaXMuYWRkRXhwb3J0IG5hbWUsICd1bmtub3duJ1xyXG5cdFx0XHRcdFx0XHR3aGVuIDI2MyAgICMgLS0tIEZ1bmN0aW9uRGVjbGFyYXRpb25cclxuXHRcdFx0XHRcdFx0XHRuYW1lIDo9IGdldFN0cmluZyBwYXJlbnQsICcubmFtZS5lc2NhcGVkVGV4dCdcclxuXHRcdFx0XHRcdFx0XHRhbmFseXNpcy5hZGRFeHBvcnQgbmFtZSwgJ2Z1bmN0aW9uJ1xyXG5cdFx0XHRcdFx0XHR3aGVuIDI2NCAgICMgLS0tIENsYXNzRGVjbGFyYXRpb25cclxuXHRcdFx0XHRcdFx0XHRuYW1lIDo9IGdldFN0cmluZyBwYXJlbnQsICcubmFtZS5lc2NhcGVkVGV4dCdcclxuXHRcdFx0XHRcdFx0XHRhbmFseXNpcy5hZGRFeHBvcnQgbmFtZSwgJ2NsYXNzJ1xyXG5cdFx0XHRcdFx0XHR3aGVuIDI2NiAgICMgLS0tIFR5cGVBbGlhc0RlY2xhcmF0aW9uXHJcblx0XHRcdFx0XHRcdFx0bmFtZSA6PSBnZXRTdHJpbmcgcGFyZW50LCAnLm5hbWUuZXNjYXBlZFRleHQnXHJcblx0XHRcdFx0XHRcdFx0YW5hbHlzaXMuYWRkRXhwb3J0IG5hbWUsICd0eXBlJ1xyXG5cdFx0XHRcdFx0XHRkZWZhdWx0XHJcblx0XHRcdFx0XHRcdFx0Y3JvYWsgXCJVbmV4cGVjdGVkIHN1YnR5cGUgb2YgOTU6ICN7cGFyZW50LmtpbmR9XCJcclxuXHRcdFx0XHRkZWZhdWx0XHJcblx0XHRcdFx0XHRpZiB0cmFjZVxyXG5cdFx0XHRcdFx0XHRMT0cgXCIgICAuLi5pZ25vcmVkXCJcclxuXHRyZXR1cm4gYW5hbHlzaXNcclxuIl19