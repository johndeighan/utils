"use strict";
// v8-stack.test.civet

import {
	undef, defined, notdefined, assert, croak,
	compileAllFiles, relpath,
	} from '@jdeighan/utils'
import {
	getV8Stack, getMyCaller,
	getMyOutsideCaller, getV8StackStr,
	stackFrame,
	} from '@jdeighan/utils/v8-stack'
import {
	equal, like,
	} from '@jdeighan/utils/unit-test'

import {getBoth} from './v8-stack/v8-module.ts';

// ---------------------------------------------------------------------------

(function() {
	let stack1: stackFrame[] = []
	let stack2: stackFrame[] = []

	const main = function() {
		func1()
		func2()
	}

	const func1 = function() {
		stack1 = getV8Stack()
		return
	}

	const func2 = function() {
		stack2 = getV8Stack()
		return
	}

	main()
	like(stack1, [
		{
			type: 'function',
			name: 'func1',
			source: 'test/v8-stack.test.civet',
			line: 29
			},
		{
			type: 'function',
			name: 'main',
			source: 'test/v8-stack.test.civet',
			line: 25
			},
		{
			type: 'function',
			name: '<anonymous>',
			source: 'test/v8-stack.test.civet',
			line: 36
			},
		{
			type: 'script',
			source: 'test/v8-stack.test.civet',
			line: 87
			}
		])
	like(stack2, [
		{
			type: 'function',
			name: 'func2',
			source: 'test/v8-stack.test.civet',
			line: 33
			},
		{
			type: 'function',
			name: 'main',
			source: 'test/v8-stack.test.civet',
			line: 26
			},
		{
			type: 'function',
			name: '<anonymous>',
			source: 'test/v8-stack.test.civet',
			line: 36
			},
		{
			type: 'script',
			source: 'test/v8-stack.test.civet',
			line: 87
			}
		])
}
	)();

// ---------------------------------------------------------------------------

(function() {
	let caller1: (stackFrame | undefined) = undef
	let caller2: (stackFrame | undefined) = undef

	const main = function() {
		func1()
		func2()
	}

	const func1 = function() {
		caller1 = getMyCaller()
	}

	const func2 = function() {
		caller2 = getMyCaller()
		return
	}

	main()
	like(caller1, {
		type: 'function',
		name: 'main',
		source: 'test/v8-stack.test.civet'
		})
	like(caller2, {
		type: 'function',
		name: 'main',
		source: 'test/v8-stack.test.civet'
		})
}
	)();

// ---------------------------------------------------------------------------

(function() {
	let hCaller: (stackFrame | undefined) = undef

	const main = function() {
		func1()
		func2()
	}

	const func1 = function() {
		return
	}

	const func2 = function() {
		hCaller = getMyCaller()
		return
	}

	// ------------------------------------------------------------------------

	main()

	like(hCaller, {
		type: 'function',
		name: 'main',
		source: 'test/v8-stack.test.civet'
		})
}

	)();

// ---------------------------------------------------------------------------

(function() {
	let lCallers1: (stackFrame | undefined)[] = []
	let lCallers2: (stackFrame | undefined)[] = []

	const main = function() {
		func1()
		func2()
	}

	const func1 = function() {
		lCallers1 = getBoth()
	}

	const func2 = function() {
		lCallers2 = getBoth()
		return
	}

	main()
	like(lCallers1[0], {
		type: 'function',
		name: 'secondFunc',
		source: 'test/v8-stack/v8-module.civet'
		})
	like(lCallers1[1], {
		type: 'function',
		name: 'secondFunc',
		source: 'test/v8-stack/v8-module.civet'
		})
	like(lCallers2[0], {
		type: 'function',
		name: 'secondFunc',
		source: 'test/v8-stack/v8-module.civet'
		})
	like(lCallers2[1], {
		type: 'function',
		name: 'secondFunc',
		source: 'test/v8-stack/v8-module.civet'
		})
}

	)();

// ---------------------------------------------------------------------------

(async () => {
	const func1 = async () => {
		return await func2()
	}

	const func2 = async () => {
		return await getV8StackStr()
	}

	equal(await func1(), `[function   ] test/v8-stack.test.civet:195:15
[function   ] test/v8-stack.test.civet:192:15
[function   ] test/v8-stack.test.civet:197:13
[script     ] test/v8-stack.test.civet:204:2`)
}

	)();

// ---------------------------------------------------------------------------

(async () => {
	const func1 = async () => {
		func2()
		return await getV8StackStr()
	}

	const func2 = () => {
		return 2 * 2
	}

	equal(await func1(), `[function   ] test/v8-stack.test.civet:211:15
[function   ] test/v8-stack.test.civet:216:13
[script     ] test/v8-stack.test.civet:221:2`)
}
	)();

// ---------------------------------------------------------------------------

(function() {
	let caller1: (stackFrame | undefined) = undef
	let caller2: (stackFrame | undefined) = undef

	const main = function() {
		func1()
		func2()
	}

	const func1 = function() {
		caller1 = getMyCaller()
	}

	const func2 = function() {
		caller2 = getMyCaller()
		return
	}

	main()
	like(caller1, {
		type: 'function',
		name: 'main',
		source: 'test/v8-stack.test.civet'
		})
	like(caller2, {
		type: 'function',
		name: 'main',
		source: 'test/v8-stack.test.civet'
		})
}
	)()

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC92OC1zdGFjay50ZXN0LmNpdmV0LnRzeCIsInNvdXJjZXMiOlsidGVzdC92OC1zdGFjay50ZXN0LmNpdmV0Il0sIm1hcHBpbmdzIjoiO0FBQUEsc0JBQXFCO0FBQ3JCLEFBQUE7QUFDQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDM0MsQ0FBQyxlQUFlLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFDMUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGlCQUFpQjtBQUN6QixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLFVBQVUsQ0FBQyxDQUFDLFdBQVcsQ0FBQztBQUN6QixDQUFDLGtCQUFrQixDQUFDLENBQUMsYUFBYSxDQUFDO0FBQ25DLENBQUMsVUFBVSxDQUFDO0FBQ1osQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLDBCQUEwQjtBQUNsQyxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNiLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQywyQkFBMkI7QUFDbkMsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMseUIsQ0FBeUI7QUFDL0MsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsQ0FBSSxRQUFILENBQUMsQ0FBSSxDQUFBLENBQUE7QUFDTixBQUFBLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5QixBQUFBLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5QixBQUFB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LENBQUE7QUFDZixBQUFBLEVBQUUsT0FBTyxDLENBQUUsQ0FBQyxXQUFXLENBQUMsQztDQUFDLENBQUE7QUFDekIsQUFBQTtBQUNBLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUksUUFBSCxDQUFDLENBQUksQ0FBQSxDQUFBO0FBQ2YsQUFBQSxFQUFFLE9BQU8sQyxDQUFFLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDekIsQUFBQSxFQUFFLE07Q0FBTSxDQUFBO0FBQ1IsQUFBQTtBQUNBLEFBQUEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNQLEFBQUEsQ0FBQyxJQUFJLENBQUEsQUFBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQ2hCLEFBQUEsRUFBRSxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUE7QUFDbEIsQUFBQSxFQUFFLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQTtBQUNkLEFBQUEsRUFBRSxNQUFNLENBQUMsQ0FBQywwQkFBMEI7QUFDcEMsRUFBRSxDQUFDLENBQUE7QUFDSCxBQUFBLENBQUMsSUFBSSxDQUFBLEFBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUNoQixBQUFBLEVBQUUsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFBO0FBQ2xCLEFBQUEsRUFBRSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUE7QUFDZCxBQUFBLEVBQUUsTUFBTSxDQUFDLENBQUMsMEJBQTBCO0FBQ3BDLEVBQUUsQ0FBQyxDO0FBQUEsQ0FBQTtBQUNILENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDSiIsIm5hbWVzIjpbXSwic291cmNlc0NvbnRlbnQiOlsiIyB2OC1zdGFjay50ZXN0LmNpdmV0XG5cbmltcG9ydCB7XG5cdHVuZGVmLCBkZWZpbmVkLCBub3RkZWZpbmVkLCBhc3NlcnQsIGNyb2FrLFxuXHRjb21waWxlQWxsRmlsZXMsIHJlbHBhdGgsXG5cdH0gZnJvbSAnQGpkZWlnaGFuL3V0aWxzJ1xuaW1wb3J0IHtcblx0Z2V0VjhTdGFjaywgZ2V0TXlDYWxsZXIsXG5cdGdldE15T3V0c2lkZUNhbGxlciwgZ2V0VjhTdGFja1N0cixcblx0c3RhY2tGcmFtZSxcblx0fSBmcm9tICdAamRlaWdoYW4vdXRpbHMvdjgtc3RhY2snXG5pbXBvcnQge1xuXHRlcXVhbCwgbGlrZSxcblx0fSBmcm9tICdAamRlaWdoYW4vdXRpbHMvdW5pdC10ZXN0J1xuXG5pbXBvcnQge2dldEJvdGh9IGZyb20gJy4vdjgtc3RhY2svdjgtbW9kdWxlLnRzJ1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4oKCkgLT5cblx0bGV0IHN0YWNrMTogc3RhY2tGcmFtZVtdID0gW11cblx0bGV0IHN0YWNrMjogc3RhY2tGcmFtZVtdID0gW11cblxuXHRtYWluIDo9ICgpIC0+XG5cdFx0ZnVuYzEoKVxuXHRcdGZ1bmMyKClcblxuXHRmdW5jMSA6PSAoKSAtPlxuXHRcdHN0YWNrMSA9IGdldFY4U3RhY2soKVxuXHRcdHJldHVyblxuXG5cdGZ1bmMyIDo9ICgpIC0+XG5cdFx0c3RhY2syID0gZ2V0VjhTdGFjaygpXG5cdFx0cmV0dXJuXG5cblx0bWFpbigpXG5cdGxpa2Ugc3RhY2sxLCBbXG5cdFx0e1xuXHRcdFx0dHlwZTogJ2Z1bmN0aW9uJ1xuXHRcdFx0bmFtZTogJ2Z1bmMxJ1xuXHRcdFx0c291cmNlOiAndGVzdC92OC1zdGFjay50ZXN0LmNpdmV0J1xuXHRcdFx0bGluZTogMjlcblx0XHRcdH1cblx0XHR7XG5cdFx0XHR0eXBlOiAnZnVuY3Rpb24nXG5cdFx0XHRuYW1lOiAnbWFpbidcblx0XHRcdHNvdXJjZTogJ3Rlc3Qvdjgtc3RhY2sudGVzdC5jaXZldCdcblx0XHRcdGxpbmU6IDI1XG5cdFx0XHR9XG5cdFx0e1xuXHRcdFx0dHlwZTogJ2Z1bmN0aW9uJ1xuXHRcdFx0bmFtZTogJzxhbm9ueW1vdXM+J1xuXHRcdFx0c291cmNlOiAndGVzdC92OC1zdGFjay50ZXN0LmNpdmV0J1xuXHRcdFx0bGluZTogMzZcblx0XHRcdH1cblx0XHR7XG5cdFx0XHR0eXBlOiAnc2NyaXB0J1xuXHRcdFx0c291cmNlOiAndGVzdC92OC1zdGFjay50ZXN0LmNpdmV0J1xuXHRcdFx0bGluZTogODdcblx0XHRcdH1cblx0XHRdXG5cdGxpa2Ugc3RhY2syLCBbXG5cdFx0e1xuXHRcdFx0dHlwZTogJ2Z1bmN0aW9uJ1xuXHRcdFx0bmFtZTogJ2Z1bmMyJ1xuXHRcdFx0c291cmNlOiAndGVzdC92OC1zdGFjay50ZXN0LmNpdmV0J1xuXHRcdFx0bGluZTogMzNcblx0XHRcdH1cblx0XHR7XG5cdFx0XHR0eXBlOiAnZnVuY3Rpb24nXG5cdFx0XHRuYW1lOiAnbWFpbidcblx0XHRcdHNvdXJjZTogJ3Rlc3Qvdjgtc3RhY2sudGVzdC5jaXZldCdcblx0XHRcdGxpbmU6IDI2XG5cdFx0XHR9XG5cdFx0e1xuXHRcdFx0dHlwZTogJ2Z1bmN0aW9uJ1xuXHRcdFx0bmFtZTogJzxhbm9ueW1vdXM+J1xuXHRcdFx0c291cmNlOiAndGVzdC92OC1zdGFjay50ZXN0LmNpdmV0J1xuXHRcdFx0bGluZTogMzZcblx0XHRcdH1cblx0XHR7XG5cdFx0XHR0eXBlOiAnc2NyaXB0J1xuXHRcdFx0c291cmNlOiAndGVzdC92OC1zdGFjay50ZXN0LmNpdmV0J1xuXHRcdFx0bGluZTogODdcblx0XHRcdH1cblx0XHRdXG5cdCkoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4oKCkgLT5cblx0bGV0IGNhbGxlcjE6IHN0YWNrRnJhbWU/ID0gdW5kZWZcblx0bGV0IGNhbGxlcjI6IHN0YWNrRnJhbWU/ID0gdW5kZWZcblxuXHRtYWluIDo9ICgpIC0+XG5cdFx0ZnVuYzEoKVxuXHRcdGZ1bmMyKClcblxuXHRmdW5jMSA6PSAoKSAtPlxuXHRcdGNhbGxlcjEgPSBnZXRNeUNhbGxlcigpXG5cblx0ZnVuYzIgOj0gKCkgLT5cblx0XHRjYWxsZXIyID0gZ2V0TXlDYWxsZXIoKVxuXHRcdHJldHVyblxuXG5cdG1haW4oKVxuXHRsaWtlIGNhbGxlcjEsIHtcblx0XHR0eXBlOiAnZnVuY3Rpb24nXG5cdFx0bmFtZTogJ21haW4nXG5cdFx0c291cmNlOiAndGVzdC92OC1zdGFjay50ZXN0LmNpdmV0J1xuXHRcdH1cblx0bGlrZSBjYWxsZXIyLCB7XG5cdFx0dHlwZTogJ2Z1bmN0aW9uJ1xuXHRcdG5hbWU6ICdtYWluJ1xuXHRcdHNvdXJjZTogJ3Rlc3Qvdjgtc3RhY2sudGVzdC5jaXZldCdcblx0XHR9XG5cdCkoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4oKCkgLT5cblx0bGV0IGhDYWxsZXI6IHN0YWNrRnJhbWU/ID0gdW5kZWZcblxuXHRtYWluIDo9ICgpIC0+XG5cdFx0ZnVuYzEoKVxuXHRcdGZ1bmMyKClcblxuXHRmdW5jMSA6PSAoKSAtPlxuXHRcdHJldHVyblxuXG5cdGZ1bmMyIDo9ICgpIC0+XG5cdFx0aENhbGxlciA9IGdldE15Q2FsbGVyKClcblx0XHRyZXR1cm5cblxuXHQjIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5cdG1haW4oKVxuXG5cdGxpa2UgaENhbGxlciwge1xuXHRcdHR5cGU6ICdmdW5jdGlvbidcblx0XHRuYW1lOiAnbWFpbidcblx0XHRzb3VyY2U6ICd0ZXN0L3Y4LXN0YWNrLnRlc3QuY2l2ZXQnXG5cdFx0fVxuXG5cdCkoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4oKCkgLT5cblx0bGV0IGxDYWxsZXJzMTogc3RhY2tGcmFtZT9bXSA9IFtdXG5cdGxldCBsQ2FsbGVyczI6IHN0YWNrRnJhbWU/W10gPSBbXVxuXG5cdG1haW4gOj0gKCkgLT5cblx0XHRmdW5jMSgpXG5cdFx0ZnVuYzIoKVxuXG5cdGZ1bmMxIDo9ICgpIC0+XG5cdFx0bENhbGxlcnMxID0gZ2V0Qm90aCgpXG5cblx0ZnVuYzIgOj0gKCkgLT5cblx0XHRsQ2FsbGVyczIgPSBnZXRCb3RoKClcblx0XHRyZXR1cm5cblxuXHRtYWluKClcblx0bGlrZSBsQ2FsbGVyczFbMF0sIHtcblx0XHR0eXBlOiAnZnVuY3Rpb24nXG5cdFx0bmFtZTogJ3NlY29uZEZ1bmMnXG5cdFx0c291cmNlOiAndGVzdC92OC1zdGFjay92OC1tb2R1bGUuY2l2ZXQnXG5cdFx0fVxuXHRsaWtlIGxDYWxsZXJzMVsxXSwge1xuXHRcdHR5cGU6ICdmdW5jdGlvbidcblx0XHRuYW1lOiAnc2Vjb25kRnVuYydcblx0XHRzb3VyY2U6ICd0ZXN0L3Y4LXN0YWNrL3Y4LW1vZHVsZS5jaXZldCdcblx0XHR9XG5cdGxpa2UgbENhbGxlcnMyWzBdLCB7XG5cdFx0dHlwZTogJ2Z1bmN0aW9uJ1xuXHRcdG5hbWU6ICdzZWNvbmRGdW5jJ1xuXHRcdHNvdXJjZTogJ3Rlc3Qvdjgtc3RhY2svdjgtbW9kdWxlLmNpdmV0J1xuXHRcdH1cblx0bGlrZSBsQ2FsbGVyczJbMV0sIHtcblx0XHR0eXBlOiAnZnVuY3Rpb24nXG5cdFx0bmFtZTogJ3NlY29uZEZ1bmMnXG5cdFx0c291cmNlOiAndGVzdC92OC1zdGFjay92OC1tb2R1bGUuY2l2ZXQnXG5cdFx0fVxuXG5cdCkoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4oKCkgPT5cblx0ZnVuYzEgOj0gKCkgPT5cblx0XHRyZXR1cm4gYXdhaXQgZnVuYzIoKVxuXG5cdGZ1bmMyIDo9ICgpID0+XG5cdFx0cmV0dXJuIGF3YWl0IGdldFY4U3RhY2tTdHIoKVxuXG5cdGVxdWFsIGF3YWl0IGZ1bmMxKCksIFwiXCJcIlxuXHRcdFtmdW5jdGlvbiAgIF0gdGVzdC92OC1zdGFjay50ZXN0LmNpdmV0OjE5NToxNVxuXHRcdFtmdW5jdGlvbiAgIF0gdGVzdC92OC1zdGFjay50ZXN0LmNpdmV0OjE5MjoxNVxuXHRcdFtmdW5jdGlvbiAgIF0gdGVzdC92OC1zdGFjay50ZXN0LmNpdmV0OjE5NzoxM1xuXHRcdFtzY3JpcHQgICAgIF0gdGVzdC92OC1zdGFjay50ZXN0LmNpdmV0OjIwNDoyXG5cdFx0XCJcIlwiXG5cblx0KSgpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbigoKSA9PlxuXHRmdW5jMSA6PSAoKSA9PlxuXHRcdGZ1bmMyKClcblx0XHRyZXR1cm4gYXdhaXQgZ2V0VjhTdGFja1N0cigpXG5cblx0ZnVuYzIgOj0gKCkgPT5cblx0XHRyZXR1cm4gMiAqIDJcblxuXHRlcXVhbCBhd2FpdCBmdW5jMSgpLCBcIlwiXCJcblx0XHRbZnVuY3Rpb24gICBdIHRlc3Qvdjgtc3RhY2sudGVzdC5jaXZldDoyMTE6MTVcblx0XHRbZnVuY3Rpb24gICBdIHRlc3Qvdjgtc3RhY2sudGVzdC5jaXZldDoyMTY6MTNcblx0XHRbc2NyaXB0ICAgICBdIHRlc3Qvdjgtc3RhY2sudGVzdC5jaXZldDoyMjE6MlxuXHRcdFwiXCJcIlxuXHQpKClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuKCgpIC0+XG5cdGxldCBjYWxsZXIxOiBzdGFja0ZyYW1lPyA9IHVuZGVmXG5cdGxldCBjYWxsZXIyOiBzdGFja0ZyYW1lPyA9IHVuZGVmXG5cblx0bWFpbiA6PSAoKSAtPlxuXHRcdGZ1bmMxKClcblx0XHRmdW5jMigpXG5cblx0ZnVuYzEgOj0gKCkgLT5cblx0XHRjYWxsZXIxID0gZ2V0TXlDYWxsZXIoKVxuXG5cdGZ1bmMyIDo9ICgpIC0+XG5cdFx0Y2FsbGVyMiA9IGdldE15Q2FsbGVyKClcblx0XHRyZXR1cm5cblxuXHRtYWluKClcblx0bGlrZSBjYWxsZXIxLCB7XG5cdFx0dHlwZTogJ2Z1bmN0aW9uJ1xuXHRcdG5hbWU6ICdtYWluJ1xuXHRcdHNvdXJjZTogJ3Rlc3Qvdjgtc3RhY2sudGVzdC5jaXZldCdcblx0XHR9XG5cdGxpa2UgY2FsbGVyMiwge1xuXHRcdHR5cGU6ICdmdW5jdGlvbidcblx0XHRuYW1lOiAnbWFpbidcblx0XHRzb3VyY2U6ICd0ZXN0L3Y4LXN0YWNrLnRlc3QuY2l2ZXQnXG5cdFx0fVxuXHQpKClcbiJdfQ==