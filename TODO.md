to do

Document all libraries (unit-test has docs)

rtf doesn't seem to run the temp file !!!!!

mkstr() in llutils.civet doesn't always handle
	stdout and stderr correctly
	output looks like hash, but has keys 0, 1, etc.



command 'compile' should log post-processing
abbreviated version of runUnitTest()
implement -w options (esp. on compile command)

https://docs.deno.com/examples/watching_files/

Produce an async iterable:

watcher := Deno.watchFs("./");

for await event of watcher
	console.log(">>>> event", event)

watcher.close();


import { debounce } from "jsr:@std/async/debounce";
const log = debounce((event: Deno.FsEvent) => {
  console.log("[%s] %s", event.kind, event.paths[0]);
}, 200);

watcher = Deno.watchFs("./");

for await (const event of watcher) {
  log(event);
}
