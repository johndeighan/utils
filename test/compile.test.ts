"use strict";
// compile.test.civet

import * as lib from '@jdeighan/utils'
Object.assign(globalThis, lib)
import * as lib2 from '@jdeighan/utils/unit-test.js'
Object.assign(globalThis, lib2)

// ---------------------------------------------------------------------------

equal(2+2, 4)

const hResult = execCmdSync('compile', ['-h'], 'collect')
LOG(ML(hResult))

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC9jb21waWxlLnRlc3QuY2l2ZXQudHN4Iiwic291cmNlcyI6WyJ0ZXN0L2NvbXBpbGUudGVzdC5jaXZldCJdLCJtYXBwaW5ncyI6IjtBQUFBLHFCQUFvQjtBQUNwQixBQUFBO0FBQ0EsQUFBQSxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGlCQUFpQjtBQUN0QyxBQUFBLEFBQUEsTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUM7QUFDOUIsQUFBQSxBQUFBLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsOEJBQThCO0FBQ3BELEFBQUEsQUFBQSxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUMvQixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxLQUFLLENBQUEsQUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ1osQUFBQTtBQUNBLEFBQUEsQUFBTyxNQUFQLE9BQU8sQ0FBQyxDQUFFLENBQUMsV0FBVyxDQUFBLEFBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQTtBQUNuRCxBQUFBLEFBQUEsR0FBRyxDQUFBLEFBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFBO0FBQ2YiLCJuYW1lcyI6W10sInNvdXJjZXNDb250ZW50IjpbIiMgY29tcGlsZS50ZXN0LmNpdmV0XG5cbmltcG9ydCAqIGFzIGxpYiBmcm9tICdAamRlaWdoYW4vdXRpbHMnXG5PYmplY3QuYXNzaWduKGdsb2JhbFRoaXMsIGxpYilcbmltcG9ydCAqIGFzIGxpYjIgZnJvbSAnQGpkZWlnaGFuL3V0aWxzL3VuaXQtdGVzdC5qcydcbk9iamVjdC5hc3NpZ24oZ2xvYmFsVGhpcywgbGliMilcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXF1YWwgMisyLCA0XG5cbmhSZXN1bHQgOj0gZXhlY0NtZFN5bmMgJ2NvbXBpbGUnLCBbJy1oJ10sICdjb2xsZWN0J1xuTE9HIE1MKGhSZXN1bHQpXG4iXX0=