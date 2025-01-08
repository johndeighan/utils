// base.test.js

import fs from 'node:fs'
import {
	assert, assertEquals, assertNotEquals, assertObjectMatch,
	assertStringIncludes, assertMatch, assertArrayIncludes,
	} from 'jsr:@std/assert'
import {
	clearLog, getLog, DBG, LOG, WARN, ERR,
	} from '@jdeighan/utils/logger.js'
import {
	undef, defined, notdefined, escapeStr,
	} from '@jdeighan/utils/llutils.js'
import {
	equal, truthy,
	} from '@jdeighan/utils/unit-test.js'
import {
	isFile, isDir, slurp, barf,
	} from '@jdeighan/utils/fs.js'
import {
	getMyOutsideCaller,
	} from '@jdeighan/utils/v8-stack.js'

// --------------------------------------------------------------------------
// --- test base functionality
//     These libs should be compiled and working:
//        logger
//        llutils
//        unit-test
//        fs
//        v8-stack

Deno.test("line 36", () => {
	assert(isFile('src/lib/logger.js'));
	});

Deno.test("line 40", () => {
	assert(isFile('src/lib/llutils.js'));
	});

Deno.test("line 33", () => {
	assertEquals(escapeStr('a b\tc\r\n'), 'a˳b→c←↓');
	});

Deno.test("line 44", () => {
	assert(isFile('src/lib/unit-test.js'));
	});

Deno.test("line 48", () => {
	assert(isFile('src/lib/fs.js'));
	});

Deno.test("line 52", () => {
	assert(isFile('src/lib/v8-stack.js'));
	});

Deno.test("line 56", () => {
	clearLog();
	DBG("debug");
	LOG("info");
	WARN("warning");
	ERR("error");
	assertEquals(getLog(), 'I info\nW warning\nERROR: error')
	});
