"use strict";
// exec-utils.test.civet

import {
	mkstr, getCmdLine, getProcOpt, getFinalResult,
	execCmd, execCmdSync, cmdSucceeds,
	} from '../src/lib/exec-utils.ts'
import type {
	execCmdResult,
	} from '../src/lib/exec-utils.ts'
import {
	equal, like, unlike, succeeds, fails, truthy, falsy,
	} from '@jdeighan/utils/unit-test'

// ---------------------------------------------------------------------------

// --- mkstr(x)
const buffer = new ArrayBuffer(3)
const view = new Int8Array(buffer)

view[0] = 97
view[1] = 98
view[2] = 99

equal(mkstr('abc'), 'abc')
equal(mkstr(buffer), 'abc')
equal(mkstr(view), 'abc')

// --- getCmdLine()
equal(getCmdLine('dothis', ['-a', 'willy']), 'dothis -a willy')

// --- getProcOpt()
like(getProcOpt(['-h'], true), {
	args: ['-h'],
	stdout: 'piped',
	stderr: 'piped'
	})

like(getProcOpt(['-h'], false), {
	stdout: 'inherit',
	stderr: 'inherit'
	});

// --- getFinalResult()
//     no unit tests yet

// --- execCmd()
(async () => {
	const hResult = await execCmd('echo', ["Hello"], 'collect')
	equal(hResult.code, 0)
	equal(hResult.stdout, "Hello\n")
}
	)()

// --- execCmdSync()
equal(execCmdSync("echo", ["Hello"]).code, 0);

(() => {
	const hResult = execCmdSync('echo', ["Hello"], 'collect')
	equal(hResult.code, 0)
	equal(hResult.stdout, "Hello\n")
}
	)()

// --- cmdSucceeds(cmdName, lArgs, hOptions)
//     no unit tests yet


//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC9leGVjLXV0aWxzLnRlc3QuY2l2ZXQudHN4Iiwic291cmNlcyI6WyJ0ZXN0L2V4ZWMtdXRpbHMudGVzdC5jaXZldCJdLCJtYXBwaW5ncyI6IjtBQUFBLHdCQUF1QjtBQUN2QixBQUFBO0FBQ0EsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsS0FBSyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsY0FBYyxDQUFDO0FBQy9DLENBQUMsT0FBTyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsV0FBVyxDQUFDO0FBQ25DLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQywwQkFBMEI7QUFDbEMsQUFBQSxBQUFBLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNiLENBQUMsYUFBYSxDQUFDO0FBQ2YsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLDBCQUEwQjtBQUNsQyxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUNyRCxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsMkJBQTJCO0FBQ25DLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxlQUFjO0FBQ2QsQUFBQSxBQUFNLE1BQU4sTUFBTSxDQUFDLENBQUUsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztBQUM1QixBQUFBLEFBQUksTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO0FBQzdCLEFBQUE7QUFDQSxBQUFBLEFBQUEsSUFBSSxDQUFDLENBQUMsQ0FBQyxDLENBQUUsQ0FBQyxFQUFFO0FBQ1osQUFBQSxBQUFBLElBQUksQ0FBQyxDQUFDLENBQUMsQyxDQUFFLENBQUMsRUFBRTtBQUNaLEFBQUEsQUFBQSxJQUFJLENBQUMsQ0FBQyxDQUFDLEMsQ0FBRSxDQUFDLEVBQUU7QUFDWixBQUFBO0FBQ0EsQUFBQSxBQUFBLEtBQUssQ0FBQSxBQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQTtBQUN6QixBQUFBLEFBQUEsS0FBSyxDQUFBLEFBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFBO0FBQzFCLEFBQUEsQUFBQSxLQUFLLENBQUEsQUFBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDeEIsQUFBQTtBQUNBLEFBQUEsbUJBQWtCO0FBQ2xCLEFBQUEsQUFBQSxLQUFLLENBQUEsQUFBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUE7QUFDOUQsQUFBQTtBQUNBLEFBQUEsbUJBQWtCO0FBQ2xCLEFBQUEsQUFBQSxJQUFJLENBQUEsQUFBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoQyxBQUFBLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUNiLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUE7QUFDaEIsQUFBQSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU87QUFDaEIsQ0FBQyxDQUFDLENBQUE7QUFDRixBQUFBO0FBQ0EsQUFBQSxBQUFBLElBQUksQ0FBQSxBQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2pDLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxTQUFTLENBQUE7QUFDbEIsQUFBQSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFNBQVM7QUFDbEIsQ0FBQyxDQUFDLEMsQ0FBQTtBQUNGLEFBQUE7QUFDQSxBQUFBLHVCQUFzQjtBQUN0QixBQUFBLHdCQUF1QjtBQUN2QixBQUFBO0FBQ0EsQUFBQSxnQkFBZTtBQUNmLEFBQUEsQUFBQSxDLE1BQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDTixBQUFBLENBQVEsTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUN2RCxBQUFBLENBQUMsS0FBSyxDQUFBLEFBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUN0QixBQUFBLENBQUMsS0FBSyxDQUFBLEFBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFNBQVMsQztBQUFBLENBQUE7QUFDaEMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNKLEFBQUE7QUFDQSxBQUFBLG9CQUFtQjtBQUNuQixBQUFBLEFBQUEsS0FBSyxDQUFBLEFBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEMsQ0FBQTtBQUM1QyxBQUFBO0FBQ0EsQUFBQSxBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDTixBQUFBLENBQVEsTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQ3JELEFBQUEsQ0FBQyxLQUFLLENBQUEsQUFBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3RCLEFBQUEsQ0FBQyxLQUFLLENBQUEsQUFBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsU0FBUyxDO0FBQUEsQ0FBQTtBQUNoQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ0o7QUFDQSxBQUFBLDRDQUEyQztBQUMzQyxBQUFBLHdCQUF1QjtBQUN2QjtBQUNBIiwibmFtZXMiOltdLCJzb3VyY2VzQ29udGVudCI6WyIjIGV4ZWMtdXRpbHMudGVzdC5jaXZldFxuXG5pbXBvcnQge1xuXHRta3N0ciwgZ2V0Q21kTGluZSwgZ2V0UHJvY09wdCwgZ2V0RmluYWxSZXN1bHQsXG5cdGV4ZWNDbWQsIGV4ZWNDbWRTeW5jLCBjbWRTdWNjZWVkcyxcblx0fSBmcm9tICcuLi9zcmMvbGliL2V4ZWMtdXRpbHMudHMnXG5pbXBvcnQgdHlwZSB7XG5cdGV4ZWNDbWRSZXN1bHQsXG5cdH0gZnJvbSAnLi4vc3JjL2xpYi9leGVjLXV0aWxzLnRzJ1xuaW1wb3J0IHtcblx0ZXF1YWwsIGxpa2UsIHVubGlrZSwgc3VjY2VlZHMsIGZhaWxzLCB0cnV0aHksIGZhbHN5LFxuXHR9IGZyb20gJ0BqZGVpZ2hhbi91dGlscy91bml0LXRlc3QnXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiMgLS0tIG1rc3RyKHgpXG5idWZmZXIgOj0gbmV3IEFycmF5QnVmZmVyKDMpXG52aWV3IDo9IG5ldyBJbnQ4QXJyYXkoYnVmZmVyKVxuXG52aWV3WzBdID0gOTdcbnZpZXdbMV0gPSA5OFxudmlld1syXSA9IDk5XG5cbmVxdWFsIG1rc3RyKCdhYmMnKSwgJ2FiYydcbmVxdWFsIG1rc3RyKGJ1ZmZlciksICdhYmMnXG5lcXVhbCBta3N0cih2aWV3KSwgJ2FiYydcblxuIyAtLS0gZ2V0Q21kTGluZSgpXG5lcXVhbCBnZXRDbWRMaW5lKCdkb3RoaXMnLCBbJy1hJywgJ3dpbGx5J10pLCAnZG90aGlzIC1hIHdpbGx5J1xuXG4jIC0tLSBnZXRQcm9jT3B0KClcbmxpa2UgZ2V0UHJvY09wdChbJy1oJ10sIHRydWUpLCB7XG5cdGFyZ3M6IFsnLWgnXVxuXHRzdGRvdXQ6ICdwaXBlZCdcblx0c3RkZXJyOiAncGlwZWQnXG5cdH1cblxubGlrZSBnZXRQcm9jT3B0KFsnLWgnXSwgZmFsc2UpLCB7XG5cdHN0ZG91dDogJ2luaGVyaXQnXG5cdHN0ZGVycjogJ2luaGVyaXQnXG5cdH1cblxuIyAtLS0gZ2V0RmluYWxSZXN1bHQoKVxuIyAgICAgbm8gdW5pdCB0ZXN0cyB5ZXRcblxuIyAtLS0gZXhlY0NtZCgpXG4oKCkgPT5cblx0aFJlc3VsdCA6PSBhd2FpdCBleGVjQ21kKCdlY2hvJywgW1wiSGVsbG9cIl0sICdjb2xsZWN0Jylcblx0ZXF1YWwgaFJlc3VsdC5jb2RlLCAwXG5cdGVxdWFsIGhSZXN1bHQuc3Rkb3V0LCBcIkhlbGxvXFxuXCJcblx0KSgpXG5cbiMgLS0tIGV4ZWNDbWRTeW5jKClcbmVxdWFsIGV4ZWNDbWRTeW5jKFwiZWNob1wiLCBbXCJIZWxsb1wiXSkuY29kZSwgMFxuXG4oKCkgPT5cblx0aFJlc3VsdCA6PSBleGVjQ21kU3luYygnZWNobycsIFtcIkhlbGxvXCJdLCAnY29sbGVjdCcpXG5cdGVxdWFsIGhSZXN1bHQuY29kZSwgMFxuXHRlcXVhbCBoUmVzdWx0LnN0ZG91dCwgXCJIZWxsb1xcblwiXG5cdCkoKVxuXG4jIC0tLSBjbWRTdWNjZWVkcyhjbWROYW1lLCBsQXJncywgaE9wdGlvbnMpXG4jICAgICBubyB1bml0IHRlc3RzIHlldFxuXG4iXX0=