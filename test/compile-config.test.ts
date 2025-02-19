"use strict";
// compile-config.test.civet

import {
	undef, defined, notdefined,
	isArray,
	} from '../src/lib/datatypes.ts'
import {
	relpath,
	} from '../src/lib/fs.ts'
import {
	isConfigHash, installDenoExe, isStub, isDirSpec,
	findSourceFile,
	isFileSpec, getSrcInfo, getCompiler, compileFile,
	hDefaultConfig, userConfigPath, hCompilerConfig,
	} from '../src/lib/compile-config.ts'
import type {
	configHash, foundSource, srcInfo, compileResult,
	} from '../src/lib/compile-config.ts'
import {
	equal, like, unlike, succeeds, fails, truthy, falsy,
	} from '@jdeighan/utils/unit-test'

// ---------------------------------------------------------------------------

// --- isConfigHash()
truthy(isConfigHash({
	hCompilers: {
		'.dot': {
			outExt: '.js',
			tester: () => true,
			compiler: () => 'result'
			},
		'.cielo': {
			outExt: '.js',
			tester: () => true,
			compiler: () => 'result'
			},
		'.civet': {
			outExt: '.js',
			tester: () => true,
			compiler: () => 'result'
			}
		},
	hPostProcessors: {
		'testDir': {},
		'libDir': {},
		'binDir': {}
		}
	}))

truthy(isConfigHash(hCompilerConfig))
truthy(isConfigHash(hDefaultConfig))

// --- installDenoExe()
//     No unit test yet

// --- isStub()
truthy(isStub('abc'))
falsy( isStub('.js'))
falsy( isStub('abc/deno'))
falsy( isStub('abc\\deno'))

// --- isDirSpec()
truthy(isDirSpec('testDir'))
truthy(isDirSpec('libDir'))
truthy(isDirSpec('binDir'))
falsy( isDirSpec('abc'))

// --- findSourceFile()
const hInfo = findSourceFile('libDir', 'llutils')
truthy(defined(hInfo))
if (hInfo !== undef) {
	equal(relpath(hInfo.path), 'src/lib/llutils.civet')
}

// --- isFileSpec()
truthy(isFileSpec(['abc', 'stub']))
falsy( isFileSpec(undef))
falsy( isFileSpec(42))
falsy( isFileSpec('abc'))
falsy( isFileSpec(['abc']))
falsy( isFileSpec(['abc', 'def', 'ghi']))

// --- getSrcInfo()
like(getSrcInfo(['libDir', 'llutils']), {
	relPath: 'src/lib/llutils.civet',
	dirspec: 'libDir',
	stub: 'llutils',
	purpose: undef,
	ext: '.civet'
	})

like(getSrcInfo('src/lib/llutils.civet'), {
	relPath: 'src/lib/llutils.civet',
	dirspec: 'libDir',
	stub: 'llutils',
	purpose: undef,
	ext: '.civet'
	});

// --- getCompiler()
(() => {
	const lInfo = getCompiler('.civet')
	truthy(defined(lInfo))
	truthy(isArray(lInfo))
	equal(lInfo.length, 2)
}
	)();

// --- compileFile()
//     no unit tests yet

// --- userConfigPath()
(() => {
	const dir = Deno.cwd().replaceAll('\\','/')
	equal(userConfigPath, `${dir}/compile.config.ts`)
}
	)()

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC9jb21waWxlLWNvbmZpZy50ZXN0LmNpdmV0LnRzeCIsInNvdXJjZXMiOlsidGVzdC9jb21waWxlLWNvbmZpZy50ZXN0LmNpdmV0Il0sIm1hcHBpbmdzIjoiO0FBQUEsNEJBQTJCO0FBQzNCLEFBQUE7QUFDQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUM7QUFDNUIsQ0FBQyxPQUFPLENBQUM7QUFDVCxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMseUJBQXlCO0FBQ2pDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsT0FBTyxDQUFDO0FBQ1QsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQjtBQUMxQixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLFlBQVksQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUNqRCxDQUFDLGNBQWMsQ0FBQztBQUNoQixDQUFDLFVBQVUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLFdBQVcsQ0FBQztBQUNsRCxDQUFDLGNBQWMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLGVBQWUsQ0FBQztBQUNqRCxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsOEJBQThCO0FBQ3RDLEFBQUEsQUFBQSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDYixDQUFDLFVBQVUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLGFBQWEsQ0FBQztBQUNqRCxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsOEJBQThCO0FBQ3RDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFD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Q0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNOLEFBQUEsQ0FBSSxNQUFILEdBQUcsQ0FBQyxDQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7QUFDdkMsQUFBQSxDQUFDLEtBQUssQ0FBQSxBQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsa0JBQWtCLENBQUMsQztBQUFBLENBQUE7QUFDakQsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNKIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIGNvbXBpbGUtY29uZmlnLnRlc3QuY2l2ZXRcblxuaW1wb3J0IHtcblx0dW5kZWYsIGRlZmluZWQsIG5vdGRlZmluZWQsXG5cdGlzQXJyYXksXG5cdH0gZnJvbSAnLi4vc3JjL2xpYi9kYXRhdHlwZXMudHMnXG5pbXBvcnQge1xuXHRyZWxwYXRoLFxuXHR9IGZyb20gJy4uL3NyYy9saWIvZnMudHMnXG5pbXBvcnQge1xuXHRpc0NvbmZpZ0hhc2gsIGluc3RhbGxEZW5vRXhlLCBpc1N0dWIsIGlzRGlyU3BlYyxcblx0ZmluZFNvdXJjZUZpbGUsXG5cdGlzRmlsZVNwZWMsIGdldFNyY0luZm8sIGdldENvbXBpbGVyLCBjb21waWxlRmlsZSxcblx0aERlZmF1bHRDb25maWcsIHVzZXJDb25maWdQYXRoLCBoQ29tcGlsZXJDb25maWcsXG5cdH0gZnJvbSAnLi4vc3JjL2xpYi9jb21waWxlLWNvbmZpZy50cydcbmltcG9ydCB0eXBlIHtcblx0Y29uZmlnSGFzaCwgZm91bmRTb3VyY2UsIHNyY0luZm8sIGNvbXBpbGVSZXN1bHQsXG5cdH0gZnJvbSAnLi4vc3JjL2xpYi9jb21waWxlLWNvbmZpZy50cydcbmltcG9ydCB7XG5cdGVxdWFsLCBsaWtlLCB1bmxpa2UsIHN1Y2NlZWRzLCBmYWlscywgdHJ1dGh5LCBmYWxzeSxcblx0fSBmcm9tICdAamRlaWdoYW4vdXRpbHMvdW5pdC10ZXN0J1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4jIC0tLSBpc0NvbmZpZ0hhc2goKVxudHJ1dGh5IGlzQ29uZmlnSGFzaCh7XG5cdGhDb21waWxlcnM6IHtcblx0XHQnLmRvdCc6IHtcblx0XHRcdG91dEV4dDogJy5qcydcblx0XHRcdHRlc3RlcjogKCkgPT4gdHJ1ZVxuXHRcdFx0Y29tcGlsZXI6ICgpID0+ICdyZXN1bHQnXG5cdFx0XHR9XG5cdFx0Jy5jaWVsbyc6IHtcblx0XHRcdG91dEV4dDogJy5qcydcblx0XHRcdHRlc3RlcjogKCkgPT4gdHJ1ZVxuXHRcdFx0Y29tcGlsZXI6ICgpID0+ICdyZXN1bHQnXG5cdFx0XHR9XG5cdFx0Jy5jaXZldCc6IHtcblx0XHRcdG91dEV4dDogJy5qcydcblx0XHRcdHRlc3RlcjogKCkgPT4gdHJ1ZVxuXHRcdFx0Y29tcGlsZXI6ICgpID0+ICdyZXN1bHQnXG5cdFx0XHR9XG5cdFx0fVxuXHRoUG9zdFByb2Nlc3NvcnM6IHtcblx0XHQndGVzdERpcic6IHt9XG5cdFx0J2xpYkRpcic6IHt9XG5cdFx0J2JpbkRpcic6IHt9XG5cdFx0fVxuXHR9KVxuXG50cnV0aHkgaXNDb25maWdIYXNoKGhDb21waWxlckNvbmZpZylcbnRydXRoeSBpc0NvbmZpZ0hhc2goaERlZmF1bHRDb25maWcpXG5cbiMgLS0tIGluc3RhbGxEZW5vRXhlKClcbiMgICAgIE5vIHVuaXQgdGVzdCB5ZXRcblxuIyAtLS0gaXNTdHViKClcbnRydXRoeSBpc1N0dWIoJ2FiYycpXG5mYWxzeSAgaXNTdHViKCcuanMnKVxuZmFsc3kgIGlzU3R1YignYWJjL2Rlbm8nKVxuZmFsc3kgIGlzU3R1YignYWJjXFxcXGRlbm8nKVxuXG4jIC0tLSBpc0RpclNwZWMoKVxudHJ1dGh5IGlzRGlyU3BlYygndGVzdERpcicpXG50cnV0aHkgaXNEaXJTcGVjKCdsaWJEaXInKVxudHJ1dGh5IGlzRGlyU3BlYygnYmluRGlyJylcbmZhbHN5ICBpc0RpclNwZWMoJ2FiYycpXG5cbiMgLS0tIGZpbmRTb3VyY2VGaWxlKClcbmhJbmZvIDo9IGZpbmRTb3VyY2VGaWxlKCdsaWJEaXInLCAnbGx1dGlscycpXG50cnV0aHkgZGVmaW5lZChoSW5mbylcbmlmIChoSW5mbyAhPSB1bmRlZilcblx0ZXF1YWwgcmVscGF0aChoSW5mby5wYXRoKSwgJ3NyYy9saWIvbGx1dGlscy5jaXZldCdcblxuIyAtLS0gaXNGaWxlU3BlYygpXG50cnV0aHkgaXNGaWxlU3BlYyhbJ2FiYycsICdzdHViJ10pXG5mYWxzeSAgaXNGaWxlU3BlYyh1bmRlZilcbmZhbHN5ICBpc0ZpbGVTcGVjKDQyKVxuZmFsc3kgIGlzRmlsZVNwZWMoJ2FiYycpXG5mYWxzeSAgaXNGaWxlU3BlYyhbJ2FiYyddKVxuZmFsc3kgIGlzRmlsZVNwZWMoWydhYmMnLCAnZGVmJywgJ2doaSddKVxuXG4jIC0tLSBnZXRTcmNJbmZvKClcbmxpa2UgZ2V0U3JjSW5mbyhbJ2xpYkRpcicsICdsbHV0aWxzJ10pLCB7XG5cdHJlbFBhdGg6ICdzcmMvbGliL2xsdXRpbHMuY2l2ZXQnXG5cdGRpcnNwZWM6ICdsaWJEaXInXG5cdHN0dWI6ICdsbHV0aWxzJ1xuXHRwdXJwb3NlOiB1bmRlZlxuXHRleHQ6ICcuY2l2ZXQnXG5cdH1cblxubGlrZSBnZXRTcmNJbmZvKCdzcmMvbGliL2xsdXRpbHMuY2l2ZXQnKSwge1xuXHRyZWxQYXRoOiAnc3JjL2xpYi9sbHV0aWxzLmNpdmV0J1xuXHRkaXJzcGVjOiAnbGliRGlyJ1xuXHRzdHViOiAnbGx1dGlscydcblx0cHVycG9zZTogdW5kZWZcblx0ZXh0OiAnLmNpdmV0J1xuXHR9XG5cbiMgLS0tIGdldENvbXBpbGVyKClcbigoKSA9PlxuXHRsSW5mbyA6PSBnZXRDb21waWxlcignLmNpdmV0Jylcblx0dHJ1dGh5IGRlZmluZWQobEluZm8pXG5cdHRydXRoeSBpc0FycmF5KGxJbmZvKVxuXHRlcXVhbCBsSW5mby5sZW5ndGgsIDJcblx0KSgpXG5cbiMgLS0tIGNvbXBpbGVGaWxlKClcbiMgICAgIG5vIHVuaXQgdGVzdHMgeWV0XG5cbiMgLS0tIHVzZXJDb25maWdQYXRoKClcbigoKSA9PlxuXHRkaXIgOj0gRGVuby5jd2QoKS5yZXBsYWNlQWxsKCdcXFxcJywnLycpXG5cdGVxdWFsIHVzZXJDb25maWdQYXRoLCBcIiN7ZGlyfS9jb21waWxlLmNvbmZpZy50c1wiXG5cdCkoKVxuIl19