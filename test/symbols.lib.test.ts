"use strict";
// symbols.lib.test.civet

import {
	undef, LOG, DBG, loadSymbols,
	sourceLib, libsAndSymbols, getNeededImportStmts,
	} from '../src/lib/utils.lib.ts'
import {
	equal, succeeds,
	} from '../src/lib/unit-test.lib.ts'


// ---------------------------------------------------------------------------

DBG("loadSymbols()");

(() => {
	const myMap = loadSymbols(`datatypes.lib.ts
	undef defined
indent.lib.ts
	splitLine`)

	equal(sourceLib('undef', myMap), 'datatypes.lib.ts')
	equal(sourceLib('defined', myMap), 'datatypes.lib.ts')
	equal(sourceLib('splitLine', myMap), 'indent.lib.ts')
	equal(sourceLib('dummy', myMap), undef)
}
	)()

DBG("sourceLib()");

(() => {
	const myMap = new Map([['x', 'temp.ts'],['y', 'dummy.ts']])
	equal(sourceLib('x', myMap), 'temp.ts')
	equal(sourceLib('y', myMap), 'dummy.ts')
}
	)()

equal(sourceLib('defined'), 'src/lib/datatypes.lib.ts')
equal(sourceLib('isArray'), 'src/lib/datatypes.lib.ts')

equal(sourceLib('array'), 'src/lib/datatypes.lib.ts')
equal(sourceLib('hash'), 'src/lib/datatypes.lib.ts')

DBG("libsAndSymbols()")

equal(libsAndSymbols(['defined','array']), {
	'src/lib/datatypes.lib.ts': ['defined','array']
	})
equal(libsAndSymbols(['defined','splitLine']), {
	'src/lib/datatypes.lib.ts': ['defined'],
	'src/lib/indent.lib.ts': ['splitLine']
	})

DBG("getNeededImportStmts()")

equal(getNeededImportStmts(['defined','array']), [
	"import {defined, array} from './src/lib/datatypes.lib.ts';"
	])
equal(getNeededImportStmts(['arrayof','integer']), [
	"import {arrayof, integer} from './src/lib/datatypes.lib.ts';"
	])

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC9zeW1ib2xzLmxpYi50ZXN0LmNpdmV0LnRzeCIsInNvdXJjZXMiOlsidGVzdC9zeW1ib2xzLmxpYi50ZXN0LmNpdmV0Il0sIm1hcHBpbmdzIjoiO0FBQUEseUJBQXdCO0FBQ3hCLEFBQUE7QUFDQSxBQUFBLE1BQU0sQ0FBQyxDQUFDO0FBQ1IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxXQUFXLENBQUM7QUFDOUIsQ0FBQyxTQUFTLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQztBQUNqRCxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMseUJBQXlCO0FBQ2pDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ2pCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyw2QkFBNkI7QUFDckMsQUFBQTtBQUNBLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLEdBQUcsQ0FBQSxBQUFDLGVBQWUsQyxDQUFBO0FBQ25CLEFBQUE7QUFDQSxBQUFBLEFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQTtBQUNOLEFBQUEsQ0FBTSxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsV0FBVyxDQUFDLENBQUc7QUFDekI7QUFDQTtBQUNBLFVBRUUsQ0FBRyxDQUFDO0FBQ04sQUFBQTtBQUNBLEFBQUEsQ0FBQyxLQUFLLENBQUEsQUFBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQTtBQUNwRCxBQUFBLENBQUMsS0FBSyxDQUFBLEFBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUE7QUFDdEQsQUFBQSxDQUFDLEtBQUssQ0FBQSxBQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQTtBQUNyRCxBQUFBLENBQUMsS0FBSyxDQUFBLEFBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDO0FBQUEsQ0FBQTtBQUN2QyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ0osQUFBQTtBQUNBLEFBQUEsQUFBQSxHQUFHLENBQUEsQUFBQyxhQUFhLEMsQ0FBQTtBQUNqQixBQUFBO0FBQ0EsQUFBQSxBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDTixBQUFBLENBQU0sTUFBTCxLQUFLLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztBQUN2RCxBQUFBLENBQUMsS0FBSyxDQUFBLEFBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFBO0FBQ3ZDLEFBQUEsQ0FBQyxLQUFLLENBQUEsQUFBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxVQUFVLEM7QUFBQSxDQUFBO0FBQ3hDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDSixBQUFBO0FBQ0EsQUFBQSxBQUFBLEtBQUssQ0FBQSxBQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLDBCQUEwQixDQUFBO0FBQ3RELEFBQUEsQUFBQSxLQUFLLENBQUEsQUFBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQywwQkFBMEIsQ0FBQTtBQUN0RCxBQUFBO0FBQ0EsQUFBQSxBQUFBLEtBQUssQ0FBQSxBQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLDBCQUEwQixDQUFBO0FBQ3BELEFBQUEsQUFBQSxLQUFLLENBQUEsQUFBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQywwQkFBMEIsQ0FBQTtBQUNuRCxBQUFBO0FBQ0EsQUFBQSxBQUFBLEdBQUcsQ0FBQSxBQUFDLGtCQUFrQixDQUFBO0FBQ3RCLEFBQUE7QUFDQSxBQUFBLEFBQUEsS0FBSyxDQUFBLEFBQUMsY0FBYyxDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzVDLEFBQUEsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQztBQUNoRCxDQUFDLENBQUMsQ0FBQTtBQUNGLEFBQUEsQUFBQSxLQUFLLENBQUEsQUFBQyxjQUFjLENBQUMsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEQsQUFBQSxDQUFDLDBCQUEwQixDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQTtBQUN4QyxBQUFBLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQztBQUN2QyxDQUFDLENBQUMsQ0FBQTtBQUNGLEFBQUE7QUFDQSxBQUFBLEFBQUEsR0FBRyxDQUFBLEFBQUMsd0JBQXdCLENBQUE7QUFDNUIsQUFBQTtBQUNBLEFBQUEsQUFBQSxLQUFLLENBQUEsQUFBQyxvQkFBb0IsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNsRCxBQUFBLENBQUMsNERBQTREO0FBQzdELEFBQUEsQ0FBQyxDQUFDLENBQUE7QUFDRixBQUFBLEFBQUEsS0FBSyxDQUFBLEFBQUMsb0JBQW9CLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEQsQUFBQSxDQUFDLDhEQUE4RDtBQUMvRCxBQUFBLENBQUMsQ0FBQyxDQUFBO0FBQ0YiLCJuYW1lcyI6W10sInNvdXJjZXNDb250ZW50IjpbIiMgc3ltYm9scy5saWIudGVzdC5jaXZldFxyXG5cclxuaW1wb3J0IHtcclxuXHR1bmRlZiwgTE9HLCBEQkcsIGxvYWRTeW1ib2xzLFxyXG5cdHNvdXJjZUxpYiwgbGlic0FuZFN5bWJvbHMsIGdldE5lZWRlZEltcG9ydFN0bXRzLFxyXG5cdH0gZnJvbSAnLi4vc3JjL2xpYi91dGlscy5saWIudHMnXHJcbmltcG9ydCB7XHJcblx0ZXF1YWwsIHN1Y2NlZWRzLFxyXG5cdH0gZnJvbSAnLi4vc3JjL2xpYi91bml0LXRlc3QubGliLnRzJ1xyXG5cclxuXHJcbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5EQkcgXCJsb2FkU3ltYm9scygpXCJcclxuXHJcbigoKSA9PlxyXG5cdG15TWFwIDo9IGxvYWRTeW1ib2xzKFwiXCJcIlxyXG5cdFx0ZGF0YXR5cGVzLmxpYi50c1xyXG5cdFx0XHR1bmRlZiBkZWZpbmVkXHJcblx0XHRpbmRlbnQubGliLnRzXHJcblx0XHRcdHNwbGl0TGluZVxyXG5cdFx0XCJcIlwiKVxyXG5cclxuXHRlcXVhbCBzb3VyY2VMaWIoJ3VuZGVmJywgbXlNYXApLCAnZGF0YXR5cGVzLmxpYi50cydcclxuXHRlcXVhbCBzb3VyY2VMaWIoJ2RlZmluZWQnLCBteU1hcCksICdkYXRhdHlwZXMubGliLnRzJ1xyXG5cdGVxdWFsIHNvdXJjZUxpYignc3BsaXRMaW5lJywgbXlNYXApLCAnaW5kZW50LmxpYi50cydcclxuXHRlcXVhbCBzb3VyY2VMaWIoJ2R1bW15JywgbXlNYXApLCB1bmRlZlxyXG5cdCkoKVxyXG5cclxuREJHIFwic291cmNlTGliKClcIlxyXG5cclxuKCgpID0+XHJcblx0bXlNYXAgOj0gbmV3IE1hcChbWyd4JywgJ3RlbXAudHMnXSxbJ3knLCAnZHVtbXkudHMnXV0pXHJcblx0ZXF1YWwgc291cmNlTGliKCd4JywgbXlNYXApLCAndGVtcC50cydcclxuXHRlcXVhbCBzb3VyY2VMaWIoJ3knLCBteU1hcCksICdkdW1teS50cydcclxuXHQpKClcclxuXHJcbmVxdWFsIHNvdXJjZUxpYignZGVmaW5lZCcpLCAnc3JjL2xpYi9kYXRhdHlwZXMubGliLnRzJ1xyXG5lcXVhbCBzb3VyY2VMaWIoJ2lzQXJyYXknKSwgJ3NyYy9saWIvZGF0YXR5cGVzLmxpYi50cydcclxuXHJcbmVxdWFsIHNvdXJjZUxpYignYXJyYXknKSwgJ3NyYy9saWIvZGF0YXR5cGVzLmxpYi50cydcclxuZXF1YWwgc291cmNlTGliKCdoYXNoJyksICdzcmMvbGliL2RhdGF0eXBlcy5saWIudHMnXHJcblxyXG5EQkcgXCJsaWJzQW5kU3ltYm9scygpXCJcclxuXHJcbmVxdWFsIGxpYnNBbmRTeW1ib2xzKFsnZGVmaW5lZCcsJ2FycmF5J10pLCB7XHJcblx0J3NyYy9saWIvZGF0YXR5cGVzLmxpYi50cyc6IFsnZGVmaW5lZCcsJ2FycmF5J11cclxuXHR9XHJcbmVxdWFsIGxpYnNBbmRTeW1ib2xzKFsnZGVmaW5lZCcsJ3NwbGl0TGluZSddKSwge1xyXG5cdCdzcmMvbGliL2RhdGF0eXBlcy5saWIudHMnOiBbJ2RlZmluZWQnXVxyXG5cdCdzcmMvbGliL2luZGVudC5saWIudHMnOiBbJ3NwbGl0TGluZSddXHJcblx0fVxyXG5cclxuREJHIFwiZ2V0TmVlZGVkSW1wb3J0U3RtdHMoKVwiXHJcblxyXG5lcXVhbCBnZXROZWVkZWRJbXBvcnRTdG10cyhbJ2RlZmluZWQnLCdhcnJheSddKSwgW1xyXG5cdFwiaW1wb3J0IHtkZWZpbmVkLCBhcnJheX0gZnJvbSAnLi9zcmMvbGliL2RhdGF0eXBlcy5saWIudHMnO1wiXHJcblx0XVxyXG5lcXVhbCBnZXROZWVkZWRJbXBvcnRTdG10cyhbJ2FycmF5b2YnLCdpbnRlZ2VyJ10pLCBbXHJcblx0XCJpbXBvcnQge2FycmF5b2YsIGludGVnZXJ9IGZyb20gJy4vc3JjL2xpYi9kYXRhdHlwZXMubGliLnRzJztcIlxyXG5cdF1cclxuIl19