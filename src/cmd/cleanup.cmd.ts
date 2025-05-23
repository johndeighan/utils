"use strict";
// cleanup.cmd.civet

import {expandGlobSync} from '@std/fs/expand-glob'
import pathLib from 'path'
import {existsSync} from '@std/fs'

// ---------------------------------------------------------------------------

const relpath = (path: string) => {

	return pathLib.relative('', path).replaceAll('\\', '/')
}

// ---------------------------------------------------------------------------

const rootDir: (string | undefined) = Deno.env.get('PROJECT_ROOT_DIR')
if (rootDir === undefined) {
	console.log("Please set env var PROJECT_ROOT_DIR")
	Deno.exit()
}

const listOnly = (Deno.args[0] !== undefined)

const lFiles: string[] = []
for (const pattern of [
		'**/*.js',
		'compile.config.ts',
		'src/**/*.ts',
		'src/**/*.temp.*',
		'test/**/*.ts',
		'test/**/*.temp.*',
		'logs/logs.txt'
		]) {
	const hGlobOptions = {
		exclude: [
			'node_modules/**',
			'.git/**',
			'src/cmd/cleanup.cmd.ts',
			'test/temp.ts'
			],
		includeDirs: false
		}

	for (const {path} of expandGlobSync(pattern, hGlobOptions)) {
		lFiles.push(path)
	}
}

if (lFiles.length === 0) {
	console.log("No files to remove")
}
else {
	for (const path of lFiles) {
		if (listOnly || path.match(/cleanup\.cmd\.ts/)) {
			console.log(`WOULD REMOVE: '${path}'`)
		}
		else if (existsSync(path)) {
			console.log(`REMOVE: '${path}'`)
			Deno.removeSync(path)
		}
	}
	console.log(`${lFiles.length} files removed`)
}

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2NtZC9jbGVhbnVwLmNtZC5jaXZldC50c3giLCJzb3VyY2VzIjpbInNyYy9jbWQvY2xlYW51cC5jbWQuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSxvQkFBbUI7QUFDbkIsQUFBQTtBQUNBLEFBQUEsTUFBTSxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsSUFBSSxDQUFDLHFCQUFxQjtBQUNsRCxBQUFBLEFBQUEsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTTtBQUMxQixBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDbEMsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQU8sTUFBUCxPQUFPLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDNUIsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDO0FBQUMsQ0FBQTtBQUN4RCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBZ0IsTUFBaEIsT0FBTyxDLEMsQ0FBQyxBQUFDLE0sWSxDQUFPLENBQUMsQ0FBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDO0FBQ3BELEFBQUEsQUFBQSxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQSxDQUFBO0FBQ3pCLEFBQUEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFBLEFBQUMscUNBQXFDLENBQUE7QUFDbEQsQUFBQSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQztBQUFDLENBQUE7QUFDWixBQUFBO0FBQ0EsQUFBQSxBQUFRLE1BQVIsUUFBUSxDQUFDLENBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRSxDQUFDLFNBQVMsQ0FBQztBQUN2QyxBQUFBO0FBQ0EsQUFBQSxBQUFnQixNQUFoQixNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdEIsQUFBQSxBQUFBLEdBQUcsQ0FBQyxDQUFBLE1BQUEsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ2hCLEFBQUEsRUFBRSxTQUFTLENBQUE7QUFDWCxBQUFBLEVBQUUsbUJBQW1CLENBQUE7QUFDckIsQUFBQSxFQUFFLGFBQWEsQ0FBQTtBQUNmLEFBQUEsRUFBRSxpQkFBaUIsQ0FBQTtBQUNuQixBQUFBLEVBQUUsY0FBYyxDQUFBO0FBQ2hCLEFBQUEsRUFBRSxrQkFBa0IsQ0FBQTtBQUNwQixBQUFBLEVBQUUsZUFBZTtBQUNqQixBQUFBLEVBQUUsQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNILEFBQUEsQ0FBYSxNQUFaLFlBQVksQ0FBQyxDQUFFLENBQUMsQ0FBQztBQUNsQixBQUFBLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUNaLEFBQUEsR0FBRyxpQkFBaUIsQ0FBQTtBQUNwQixBQUFBLEdBQUcsU0FBUyxDQUFBO0FBQ1osQUFBQSxHQUFHLHdCQUF3QixDQUFBO0FBQzNCLEFBQUEsR0FBRyxjQUFjO0FBQ2pCLEFBQUEsR0FBRyxDQUFDLENBQUE7QUFDSixBQUFBLEVBQUUsV0FBVyxDQUFDLENBQUMsS0FBSztBQUNwQixFQUFFLENBQUM7QUFDSCxBQUFBO0FBQ0EsQUFBQSxDQUFDLEdBQUcsQ0FBQyxDQUFBLE1BQUEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNwRCxBQUFBLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQSxBQUFDLElBQUksQztDQUFBLEM7QUFBQSxDQUFBO0FBQ2xCLEFBQUE7QUFDQSxBQUFBLEFBQUEsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUE7QUFDdkIsQUFBQSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUEsQUFBQyxvQkFBb0IsQztBQUFBLENBQUE7QUFDakMsQUFBQSxBQUFBLElBQUksQ0FBQSxDQUFBO0FBQ0osQUFBQSxDQUFDLEdBQUcsQ0FBQyxDQUFBLE1BQUEsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUEsQ0FBQSxDQUFBO0FBQ25CLEFBQUEsRUFBRSxHQUFHLENBQUEsUUFBUSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQy9DLEFBQUEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFBLEFBQUMsQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDO0VBQUEsQ0FBQTtBQUN4QyxBQUFBLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUEsQ0FBQSxDQUFBO0FBQzFCLEFBQUEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFBLEFBQUMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xDLEFBQUEsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFBLEFBQUMsSUFBSSxDO0VBQUEsQztDQUFBLENBQUE7QUFDdkIsQUFBQSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUEsQUFBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsQztBQUFBLENBQUE7QUFDN0MiLCJuYW1lcyI6W10sInNvdXJjZXNDb250ZW50IjpbIiMgY2xlYW51cC5jbWQuY2l2ZXRcblxuaW1wb3J0IHtleHBhbmRHbG9iU3luY30gZnJvbSAnQHN0ZC9mcy9leHBhbmQtZ2xvYidcbmltcG9ydCBwYXRoTGliIGZyb20gJ3BhdGgnXG5pbXBvcnQge2V4aXN0c1N5bmN9IGZyb20gJ0BzdGQvZnMnXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbnJlbHBhdGggOj0gKHBhdGg6IHN0cmluZykgPT5cblxuXHRyZXR1cm4gcGF0aExpYi5yZWxhdGl2ZSgnJywgcGF0aCkucmVwbGFjZUFsbCgnXFxcXCcsICcvJylcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxucm9vdERpcjogc3RyaW5nPyA6PSBEZW5vLmVudi5nZXQoJ1BST0pFQ1RfUk9PVF9ESVInKVxuaWYgKHJvb3REaXIgPT0gdW5kZWZpbmVkKVxuXHRjb25zb2xlLmxvZyBcIlBsZWFzZSBzZXQgZW52IHZhciBQUk9KRUNUX1JPT1RfRElSXCJcblx0RGVuby5leGl0KClcblxubGlzdE9ubHkgOj0gKERlbm8uYXJnc1swXSAhPSB1bmRlZmluZWQpXG5cbmxGaWxlczogc3RyaW5nW10gOj0gW11cbmZvciBwYXR0ZXJuIG9mIFtcblx0XHQnKiovKi5qcydcblx0XHQnY29tcGlsZS5jb25maWcudHMnXG5cdFx0J3NyYy8qKi8qLnRzJ1xuXHRcdCdzcmMvKiovKi50ZW1wLionXG5cdFx0J3Rlc3QvKiovKi50cydcblx0XHQndGVzdC8qKi8qLnRlbXAuKidcblx0XHQnbG9ncy9sb2dzLnR4dCdcblx0XHRdXG5cdGhHbG9iT3B0aW9ucyA6PSB7XG5cdFx0ZXhjbHVkZTogW1xuXHRcdFx0J25vZGVfbW9kdWxlcy8qKidcblx0XHRcdCcuZ2l0LyoqJ1xuXHRcdFx0J3NyYy9jbWQvY2xlYW51cC5jbWQudHMnXG5cdFx0XHQndGVzdC90ZW1wLnRzJ1xuXHRcdFx0XVxuXHRcdGluY2x1ZGVEaXJzOiBmYWxzZVxuXHRcdH1cblxuXHRmb3Ige3BhdGh9IG9mIGV4cGFuZEdsb2JTeW5jKHBhdHRlcm4sIGhHbG9iT3B0aW9ucylcblx0XHRsRmlsZXMucHVzaCBwYXRoXG5cbmlmIChsRmlsZXMubGVuZ3RoID09IDApXG5cdGNvbnNvbGUubG9nIFwiTm8gZmlsZXMgdG8gcmVtb3ZlXCJcbmVsc2Vcblx0Zm9yIHBhdGggb2YgbEZpbGVzXG5cdFx0aWYgbGlzdE9ubHkgfHwgcGF0aC5tYXRjaCgvY2xlYW51cFxcLmNtZFxcLnRzLylcblx0XHRcdGNvbnNvbGUubG9nIFwiV09VTEQgUkVNT1ZFOiAnI3twYXRofSdcIlxuXHRcdGVsc2UgaWYgZXhpc3RzU3luYyhwYXRoKVxuXHRcdFx0Y29uc29sZS5sb2cgXCJSRU1PVkU6ICcje3BhdGh9J1wiXG5cdFx0XHREZW5vLnJlbW92ZVN5bmMgcGF0aFxuXHRjb25zb2xlLmxvZyBcIiN7bEZpbGVzLmxlbmd0aH0gZmlsZXMgcmVtb3ZlZFwiXG4iXX0=