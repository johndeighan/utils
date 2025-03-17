"use strict";
// datatypes.test.civet

import {
	hash, array,
	undef, defined, notdefined,
	isString, isNonEmptyString, isBoolean, isNumber, isInteger,
	isArray, isArrayOfStrings, isHash, isObject, isRegExp,
	isEmpty, nonEmpty,
	} from '../src/lib/datatypes.ts'
import {getCmdArgs, DBG} from '../src/lib/utils.ts'
import {
	truthy, falsy,
	} from '../src/lib/unit-test.ts'

const hArgs = getCmdArgs()

// ---------------------------------------------------------------------------

DBG("type hash")

const h: hash = {
	a: 1,
	b: 2
	}
truthy(isHash(h))

DBG("const undef")

truthy((undef === undefined))
falsy( defined(undef))
truthy(notdefined(undef))

DBG("defined(x)")

truthy(defined(42))
truthy(defined('abc'))
truthy(defined([1,2]))
truthy(defined({a: 13}))
truthy(!defined(undefined))

DBG("notdefined(x)")

truthy(notdefined(null))
truthy(notdefined(undef))
falsy( notdefined(42))
falsy( notdefined('abc'))

DBG("isString(x)")

truthy(isString('abc'))
truthy(isString(''))
falsy(isString(42))
falsy(isString(undef))
falsy(isString([1,2]))
falsy(isString({a:1, b:2}))
falsy(isString(/\s/))

DBG("isNonEmptyString(x)")

truthy(isNonEmptyString('a'))
falsy( isNonEmptyString(''))
falsy( isNonEmptyString(undef))
falsy( isNonEmptyString(42))

DBG("isBoolean(x)")

truthy(isBoolean(true))
falsy( isBoolean(42))

DBG("isNumber(x)")

truthy(isNumber(42))
truthy(isNumber(new Number(42)))
falsy(isNumber('abc'))
truthy(isNumber(3.14159))

DBG("isInteger(x)")

truthy(isInteger(42))
falsy( isInteger(3.14159))
falsy( isInteger('42'))

DBG("isArray(x)")

truthy(isArray([1,2]))
falsy( isArray('abc'))
falsy( isArray(42))

DBG("isArrayOfStrings(x)")

truthy(isArrayOfStrings(['abc','def']))
falsy( isArrayOfStrings(42))
falsy( isArrayOfStrings([1,2]))
falsy( isArrayOfStrings(['abc',2]))

DBG("isHash(x)")

truthy(isHash({a:1, b:2}))
falsy( isHash(42))
falsy( isHash([1, 2]))

DBG("isObject(x)")

truthy(isObject({}))
falsy( isObject(42))
truthy(isObject({a:1, b:2}))
truthy(isObject([1, 2]))

DBG("isRegExp(x)")

truthy(isRegExp(/^abc$/))
falsy( isRegExp('abc'))

DBG("isEmpty(x)")

truthy(isEmpty(undefined))
truthy(isEmpty(null))
truthy(isEmpty(''))
truthy(isEmpty('   '))
truthy(isEmpty('\t\t'))
truthy(isEmpty([]))
truthy(isEmpty({}))
falsy( isEmpty('abc'))
falsy( isEmpty([1,2]))
falsy( isEmpty({a:1}))

DBG("nonEmpty(x)")

falsy( nonEmpty(undefined))
falsy( nonEmpty(null))
falsy( nonEmpty(''))
falsy( nonEmpty('   '))
falsy( nonEmpty('\t\t'))
falsy( nonEmpty([]))
falsy( nonEmpty({}))
truthy(nonEmpty('abc'))
truthy(nonEmpty([1,2]))
truthy(nonEmpty({a:1}))

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC9kYXRhdHlwZXMudGVzdC5jaXZldC50c3giLCJzb3VyY2VzIjpbInRlc3QvZGF0YXR5cGVzLnRlc3QuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSx1QkFBc0I7QUFDdEIsQUFBQTtBQUNBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUNiLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDO0FBQzVCLENBQUMsUUFBUSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDNUQsQ0FBQyxPQUFPLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUN2RCxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUNuQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMseUJBQXlCO0FBQ2pDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMscUJBQXFCO0FBQ25ELEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ2YsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLHlCQUF5QjtBQUNqQyxBQUFBO0FBQ0EsQUFBQSxBQUFLLE1BQUwsS0FBSyxDQUFDLENBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNyQixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxHQUFHLENBQUEsQUFBQyxXQUFXLENBQUE7QUFDZixBQUFBO0FBQ0EsQUFBQSxBQUFPLE1BQVAsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDO0FBQ1osQUFBQSxDQUFDLENBQUMsQ0FBQyxD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XG5cbmltcG9ydCB7XG5cdGhhc2gsIGFycmF5LFxuXHR1bmRlZiwgZGVmaW5lZCwgbm90ZGVmaW5lZCxcblx0aXNTdHJpbmcsIGlzTm9uRW1wdHlTdHJpbmcsIGlzQm9vbGVhbiwgaXNOdW1iZXIsIGlzSW50ZWdlcixcblx0aXNBcnJheSwgaXNBcnJheU9mU3RyaW5ncywgaXNIYXNoLCBpc09iamVjdCwgaXNSZWdFeHAsXG5cdGlzRW1wdHksIG5vbkVtcHR5LFxuXHR9IGZyb20gJy4uL3NyYy9saWIvZGF0YXR5cGVzLnRzJ1xuaW1wb3J0IHtnZXRDbWRBcmdzLCBEQkd9IGZyb20gJy4uL3NyYy9saWIvdXRpbHMudHMnXG5pbXBvcnQge1xuXHR0cnV0aHksIGZhbHN5LFxuXHR9IGZyb20gJy4uL3NyYy9saWIvdW5pdC10ZXN0LnRzJ1xuXG5oQXJncyA6PSBnZXRDbWRBcmdzKClcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuREJHIFwidHlwZSBoYXNoXCJcblxuaDogaGFzaCA6PSB7XG5cdGE6IDFcblx0YjogMlxuXHR9XG50cnV0aHkgaXNIYXNoKGgpXG5cbkRCRyBcImNvbnN0IHVuZGVmXCJcblxudHJ1dGh5ICh1bmRlZiA9PSB1bmRlZmluZWQpXG5mYWxzeSAgZGVmaW5lZCh1bmRlZilcbnRydXRoeSBub3RkZWZpbmVkKHVuZGVmKVxuXG5EQkcgXCJkZWZpbmVkKHgpXCJcblxudHJ1dGh5IGRlZmluZWQoNDIpXG50cnV0aHkgZGVmaW5lZCgnYWJjJylcbnRydXRoeSBkZWZpbmVkKFsxLDJdKVxudHJ1dGh5IGRlZmluZWQoe2E6IDEzfSlcbnRydXRoeSBub3QgZGVmaW5lZCh1bmRlZmluZWQpXG5cbkRCRyBcIm5vdGRlZmluZWQoeClcIlxuXG50cnV0aHkgbm90ZGVmaW5lZChudWxsKVxudHJ1dGh5IG5vdGRlZmluZWQodW5kZWYpXG5mYWxzeSAgbm90ZGVmaW5lZCg0MilcbmZhbHN5ICBub3RkZWZpbmVkKCdhYmMnKVxuXG5EQkcgXCJpc1N0cmluZyh4KVwiXG5cbnRydXRoeSBpc1N0cmluZygnYWJjJylcbnRydXRoeSBpc1N0cmluZygnJylcbmZhbHN5IGlzU3RyaW5nKDQyKVxuZmFsc3kgaXNTdHJpbmcodW5kZWYpXG5mYWxzeSBpc1N0cmluZyhbMSwyXSlcbmZhbHN5IGlzU3RyaW5nKHthOjEsIGI6Mn0pXG5mYWxzeSBpc1N0cmluZygvXFxzLylcblxuREJHIFwiaXNOb25FbXB0eVN0cmluZyh4KVwiXG5cbnRydXRoeSBpc05vbkVtcHR5U3RyaW5nKCdhJylcbmZhbHN5ICBpc05vbkVtcHR5U3RyaW5nKCcnKVxuZmFsc3kgIGlzTm9uRW1wdHlTdHJpbmcodW5kZWYpXG5mYWxzeSAgaXNOb25FbXB0eVN0cmluZyg0MilcblxuREJHIFwiaXNCb29sZWFuKHgpXCJcblxudHJ1dGh5IGlzQm9vbGVhbih0cnVlKVxuZmFsc3kgIGlzQm9vbGVhbig0MilcblxuREJHIFwiaXNOdW1iZXIoeClcIlxuXG50cnV0aHkgaXNOdW1iZXIoNDIpXG50cnV0aHkgaXNOdW1iZXIobmV3IE51bWJlcig0MikpXG5mYWxzeSBpc051bWJlcignYWJjJylcbnRydXRoeSBpc051bWJlcigzLjE0MTU5KVxuXG5EQkcgXCJpc0ludGVnZXIoeClcIlxuXG50cnV0aHkgaXNJbnRlZ2VyKDQyKVxuZmFsc3kgIGlzSW50ZWdlcigzLjE0MTU5KVxuZmFsc3kgIGlzSW50ZWdlcignNDInKVxuXG5EQkcgXCJpc0FycmF5KHgpXCJcblxudHJ1dGh5IGlzQXJyYXkoWzEsMl0pXG5mYWxzeSAgaXNBcnJheSgnYWJjJylcbmZhbHN5ICBpc0FycmF5KDQyKVxuXG5EQkcgXCJpc0FycmF5T2ZTdHJpbmdzKHgpXCJcblxudHJ1dGh5IGlzQXJyYXlPZlN0cmluZ3MoWydhYmMnLCdkZWYnXSlcbmZhbHN5ICBpc0FycmF5T2ZTdHJpbmdzKDQyKVxuZmFsc3kgIGlzQXJyYXlPZlN0cmluZ3MoWzEsMl0pXG5mYWxzeSAgaXNBcnJheU9mU3RyaW5ncyhbJ2FiYycsMl0pXG5cbkRCRyBcImlzSGFzaCh4KVwiXG5cbnRydXRoeSBpc0hhc2goe2E6MSwgYjoyfSlcbmZhbHN5ICBpc0hhc2goNDIpXG5mYWxzeSAgaXNIYXNoKFsxLCAyXSlcblxuREJHIFwiaXNPYmplY3QoeClcIlxuXG50cnV0aHkgaXNPYmplY3Qoe30pXG5mYWxzeSAgaXNPYmplY3QoNDIpXG50cnV0aHkgaXNPYmplY3Qoe2E6MSwgYjoyfSlcbnRydXRoeSBpc09iamVjdChbMSwgMl0pXG5cbkRCRyBcImlzUmVnRXhwKHgpXCJcblxudHJ1dGh5IGlzUmVnRXhwKC9eYWJjJC8pXG5mYWxzeSAgaXNSZWdFeHAoJ2FiYycpXG5cbkRCRyBcImlzRW1wdHkoeClcIlxuXG50cnV0aHkgaXNFbXB0eSh1bmRlZmluZWQpXG50cnV0aHkgaXNFbXB0eShudWxsKVxudHJ1dGh5IGlzRW1wdHkoJycpXG50cnV0aHkgaXNFbXB0eSgnICAgJylcbnRydXRoeSBpc0VtcHR5KCdcXHRcXHQnKVxudHJ1dGh5IGlzRW1wdHkoW10pXG50cnV0aHkgaXNFbXB0eSh7fSlcbmZhbHN5ICBpc0VtcHR5KCdhYmMnKVxuZmFsc3kgIGlzRW1wdHkoWzEsMl0pXG5mYWxzeSAgaXNFbXB0eSh7YToxfSlcblxuREJHIFwibm9uRW1wdHkoeClcIlxuXG5mYWxzeSAgbm9uRW1wdHkodW5kZWZpbmVkKVxuZmFsc3kgIG5vbkVtcHR5KG51bGwpXG5mYWxzeSAgbm9uRW1wdHkoJycpXG5mYWxzeSAgbm9uRW1wdHkoJyAgICcpXG5mYWxzeSAgbm9uRW1wdHkoJ1xcdFxcdCcpXG5mYWxzeSAgbm9uRW1wdHkoW10pXG5mYWxzeSAgbm9uRW1wdHkoe30pXG50cnV0aHkgbm9uRW1wdHkoJ2FiYycpXG50cnV0aHkgbm9uRW1wdHkoWzEsMl0pXG50cnV0aHkgbm9uRW1wdHkoe2E6MX0pXG4iXX0=