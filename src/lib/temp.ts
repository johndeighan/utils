"use strict";
export const hDefaultConfig: configHash = {

	hCompilers: {
		// --- keys are file extensions
		//     NOTE: compilers must be synchronous!!!

		'.dot': {
			outExt: '.svg',
			tester: (): boolean => {
				return cmdSucceeds('dot', ['--version'], 'quiet')
			},
			compiler: (path: string): void => {
				const svgPath = withExt(path, '.svg')
				rmFile(svgPath)
				execCmdSync('dot', ['-Tsvg', path])
				return
			},
		},

		'.cielo': {
			outExt: '.ts',
			tester: (): boolean => {
				return true
			},
			compiler: (path: string): void => {
				const civetPath = withExt(path, '.temp.civet')
				rmFile(civetPath)
				cielo2civet(path, civetPath)
				civet2ts(civetPath, withExt(path, '.ts'))
				return
			},
		},

		'.civet': {
			outExt: '.ts',
			tester: (): boolean => {
				return cmdSucceeds('civet', ['--version'], 'quiet')
			},
			compiler: (path: string): void => {
				civet2ts(path, withExt(path, '.ts'))
				return
			}
		}

		},

	hPostProcessors: {
		// --- Keys are dirspecs

		testDir: {
			dir: 'test',    // --- no post processing
			postProcessor: (stub: string): void => {
				return
			},
		},

		libDir: {
			dir: 'src/lib',
			postProcessor: (stub: string): void => {
				const h = findSourceFile('testDir', stub, 'test')
				if (notdefined(h)) {
					return
				}
				const {path} = h
				if (notdefined(path)) {
					return
				}
				// --- will also run unit test if it exists
				const {status} = compileFile(path)
				DBG(`Compile of ${stub}: status = ${status}`)
				return
			},
		},

		binDir: {
			dir: 'src/bin',
			postProcessor: (stub: string): void => {
				LOG(`- installing command ${stub}`)
				installDenoExe(stub)
				return
			}
		}
		}
	}


//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi90ZW1wLmNpdmV0LnRzeCIsInNvdXJjZXMiOlsic3JjL2xpYi90ZW1wLmNpdmV0Il0sIm1hcHBpbmdzIjoiO0FBQUEsTUFBTSxDQUEyQixNQUExQixjQUFjLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBRSxDQUFDLENBQUM7QUFDdEMsQUFBQTtBQUNBLEFBQUEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0FBQ2QsQUFBQSxFQUFFLCtCQUE4QjtBQUNoQyxBQUFBLEVBQUUsNkNBQTRDO0FBQzlDLEFBQUE7QUFDQSxBQUFBLEVBQUUsTUFBTSxDQUFDLENBQUEsQ0FBQTtBQUNULEFBQUEsR0FBRyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUE7QUFDakIsQUFBQSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3pCLEFBQUEsSUFBSSxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxPQUFPLEM7R0FBQyxDQUFBLENBQUE7QUFDckQsQUFBQSxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDcEMsQUFBQSxJQUFXLE1BQVAsT0FBTyxDQUFDLENBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDO0FBQ3BDLEFBQUEsSUFBSSxNQUFNLENBQUEsQUFBQyxPQUFPLENBQUE7QUFDbEIsQUFBQSxJQUFJLFdBQVcsQ0FBQSxBQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDdEMsQUFBQSxJQUFJLE07R0FBTSxDQUFBLEM7RUFBQSxDQUFBLENBQUE7QUFDVixBQUFBO0FBQ0EsQUFBQSxFQUFFLFFBQVEsQ0FBQyxDQUFBLENBQUE7QUFDWCxBQUFBLEdBQUcsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFBO0FBQ2hCLEFBQUEsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN6QixBQUFBLElBQUksTUFBTSxDQUFDLEk7R0FBSSxDQUFBLENBQUE7QUFDZixBQUFBLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNwQyxBQUFBLElBQWEsTUFBVCxTQUFTLENBQUMsQ0FBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxhQUFhLENBQUM7QUFDN0MsQUFBQSxJQUFJLE1BQU0sQ0FBQSxBQUFDLFNBQVMsQ0FBQTtBQUNwQixBQUFBLElBQUksV0FBVyxDQUFBLEFBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxDQUFBO0FBQy9CLEFBQUEsSUFBSSxRQUFRLENBQUEsQUFBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUE7QUFDNUMsQUFBQSxJQUFJLE07R0FBTSxDQUFBLEM7RUFBQSxDQUFBLENBQUE7QUFDVixBQUFBO0FBQ0EsQUFBQSxFQUFFLFFBQVEsQ0FBQyxDQUFBLENBQUE7QUFDWCxBQUFBLEdBQUcsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFBO0FBQ2hCLEFBQUEsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN6QixBQUFBLElBQUksTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDO0dBQUMsQ0FBQSxDQUFBO0FBQ3ZELEFBQUEsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3BDLEFBQUEsSUFBSSxRQUFRLENBQUEsQUFBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUE7QUFDdkMsQUFBQSxJQUFJLE07R0FBTSxDO0VBQUEsQ0FBQTtBQUNWO0FBQ0EsRUFBRSxDQUFDLENBQUE7QUFDSCxBQUFBO0FBQ0EsQUFBQSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7QUFDbkIsQUFBQSxFQUFFLHdCQUF1QjtBQUN6QixBQUFBO0FBQ0EsQUFBQSxFQUFFLE9BQU8sQ0FBQyxDQUFBLENBQUE7QUFDVixBQUFBLEdBQUcsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFBLElBQUkseUJBQXdCO0FBQzFDLEFBQUEsR0FBRyxhQUFhLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3pDLEFBQUEsSUFBSSxNO0dBQU0sQ0FBQSxDO0VBQUEsQ0FBQSxDQUFBO0FBQ1YsQUFBQTtBQUNBLEFBQUEsRUFBRSxNQUFNLENBQUMsQ0FBQSxDQUFBO0FBQ1QsQUFBQSxHQUFHLEdBQUcsQ0FBQyxDQUFDLFNBQVMsQ0FBQTtBQUNqQixBQUFBLEdBQUcsYUFBYSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUN6QyxBQUFBLElBQUssTUFBRCxDQUFDLENBQUMsQ0FBRSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDaEQsQUFBQSxJQUFJLEdBQUcsQ0FBQSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQ3BCLEFBQUEsS0FBSyxNO0lBQU0sQ0FBQTtBQUNYLEFBQUEsSUFBVSxNQUFOLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBRSxDQUFDLENBQUM7QUFDZixBQUFBLElBQUksR0FBRyxDQUFBLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQSxDQUFBLENBQUE7QUFDdkIsQUFBQSxLQUFLLE07SUFBTSxDQUFBO0FBQ1gsQUFBQSxJQUFJLDJDQUEwQztBQUM5QyxBQUFBLElBQVksTUFBUixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO0FBQ2pDLEFBQUEsSUFBSSxHQUFHLENBQUEsQUFBQyxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUE7QUFDaEQsQUFBQSxJQUFJLE07R0FBTSxDQUFBLEM7RUFBQSxDQUFBLENBQUE7QUFDVixBQUFBO0FBQ0EsQUFBQSxFQUFFLE1BQU0sQ0FBQyxDQUFBLENBQUE7QUFDVCxBQUFBLEdBQUcsR0FBRyxDQUFDLENBQUMsU0FBUyxDQUFBO0FBQ2pCLEFBQUEsR0FBRyxhQUFhLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQ3pDLEFBQUEsSUFBSSxHQUFHLENBQUEsQUFBQyxDQUFDLHFCQUFxQixFQUFFLElBQUksQ0FBQyxDQUFDLENBQUE7QUFDdEMsQUFBQSxJQUFJLGNBQWMsQ0FBQSxBQUFDLElBQUksQ0FBQTtBQUN2QixBQUFBLElBQUksTTtHQUFNLEM7RUFBQSxDQUFBO0FBQ1YsRUFBRSxDQUFDO0FBQ0gsQ0FBQyxDQUFDO0FBQ0Y7QUFDQSIsIm5hbWVzIjpbXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGhEZWZhdWx0Q29uZmlnOiBjb25maWdIYXNoIDo9IHtcblxuXHRoQ29tcGlsZXJzOiB7XG5cdFx0IyAtLS0ga2V5cyBhcmUgZmlsZSBleHRlbnNpb25zXG5cdFx0IyAgICAgTk9URTogY29tcGlsZXJzIG11c3QgYmUgc3luY2hyb25vdXMhISFcblxuXHRcdCcuZG90Jzpcblx0XHRcdG91dEV4dDogJy5zdmcnXG5cdFx0XHR0ZXN0ZXI6ICgpOiBib29sZWFuID0+XG5cdFx0XHRcdHJldHVybiBjbWRTdWNjZWVkcygnZG90JywgWyctLXZlcnNpb24nXSwgJ3F1aWV0Jylcblx0XHRcdGNvbXBpbGVyOiAocGF0aDogc3RyaW5nKTogdm9pZCA9PlxuXHRcdFx0XHRzdmdQYXRoIDo9IHdpdGhFeHQocGF0aCwgJy5zdmcnKVxuXHRcdFx0XHRybUZpbGUgc3ZnUGF0aFxuXHRcdFx0XHRleGVjQ21kU3luYyAnZG90JywgWyctVHN2ZycsIHBhdGhdXG5cdFx0XHRcdHJldHVyblxuXG5cdFx0Jy5jaWVsbyc6XG5cdFx0XHRvdXRFeHQ6ICcudHMnXG5cdFx0XHR0ZXN0ZXI6ICgpOiBib29sZWFuID0+XG5cdFx0XHRcdHJldHVybiB0cnVlXG5cdFx0XHRjb21waWxlcjogKHBhdGg6IHN0cmluZyk6IHZvaWQgPT5cblx0XHRcdFx0Y2l2ZXRQYXRoIDo9IHdpdGhFeHQocGF0aCwgJy50ZW1wLmNpdmV0Jylcblx0XHRcdFx0cm1GaWxlIGNpdmV0UGF0aFxuXHRcdFx0XHRjaWVsbzJjaXZldCBwYXRoLCBjaXZldFBhdGhcblx0XHRcdFx0Y2l2ZXQydHMgY2l2ZXRQYXRoLCB3aXRoRXh0KHBhdGgsICcudHMnKVxuXHRcdFx0XHRyZXR1cm5cblxuXHRcdCcuY2l2ZXQnOlxuXHRcdFx0b3V0RXh0OiAnLnRzJ1xuXHRcdFx0dGVzdGVyOiAoKTogYm9vbGVhbiA9PlxuXHRcdFx0XHRyZXR1cm4gY21kU3VjY2VlZHMoJ2NpdmV0JywgWyctLXZlcnNpb24nXSwgJ3F1aWV0Jylcblx0XHRcdGNvbXBpbGVyOiAocGF0aDogc3RyaW5nKTogdm9pZCA9PlxuXHRcdFx0XHRjaXZldDJ0cyBwYXRoLCB3aXRoRXh0KHBhdGgsICcudHMnKVxuXHRcdFx0XHRyZXR1cm5cblxuXHRcdH1cblxuXHRoUG9zdFByb2Nlc3NvcnM6IHtcblx0XHQjIC0tLSBLZXlzIGFyZSBkaXJzcGVjc1xuXG5cdFx0dGVzdERpcjpcblx0XHRcdGRpcjogJ3Rlc3QnICAgICMgLS0tIG5vIHBvc3QgcHJvY2Vzc2luZ1xuXHRcdFx0cG9zdFByb2Nlc3NvcjogKHN0dWI6IHN0cmluZyk6IHZvaWQgPT5cblx0XHRcdFx0cmV0dXJuXG5cblx0XHRsaWJEaXI6XG5cdFx0XHRkaXI6ICdzcmMvbGliJ1xuXHRcdFx0cG9zdFByb2Nlc3NvcjogKHN0dWI6IHN0cmluZyk6IHZvaWQgPT5cblx0XHRcdFx0aCA6PSBmaW5kU291cmNlRmlsZSgndGVzdERpcicsIHN0dWIsICd0ZXN0Jylcblx0XHRcdFx0aWYgbm90ZGVmaW5lZChoKVxuXHRcdFx0XHRcdHJldHVyblxuXHRcdFx0XHR7cGF0aH0gOj0gaFxuXHRcdFx0XHRpZiBub3RkZWZpbmVkKHBhdGgpXG5cdFx0XHRcdFx0cmV0dXJuXG5cdFx0XHRcdCMgLS0tIHdpbGwgYWxzbyBydW4gdW5pdCB0ZXN0IGlmIGl0IGV4aXN0c1xuXHRcdFx0XHR7c3RhdHVzfSA6PSBjb21waWxlRmlsZShwYXRoKVxuXHRcdFx0XHREQkcgXCJDb21waWxlIG9mICN7c3R1Yn06IHN0YXR1cyA9ICN7c3RhdHVzfVwiXG5cdFx0XHRcdHJldHVyblxuXG5cdFx0YmluRGlyOlxuXHRcdFx0ZGlyOiAnc3JjL2Jpbidcblx0XHRcdHBvc3RQcm9jZXNzb3I6IChzdHViOiBzdHJpbmcpOiB2b2lkID0+XG5cdFx0XHRcdExPRyBcIi0gaW5zdGFsbGluZyBjb21tYW5kICN7c3R1Yn1cIlxuXHRcdFx0XHRpbnN0YWxsRGVub0V4ZSBzdHViXG5cdFx0XHRcdHJldHVyblxuXHRcdH1cblx0fVxuXG4iXX0=