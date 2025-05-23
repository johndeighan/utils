"use strict";
// cielo.lib.test.civet

import {getCmdArgs, DBG} from '../src/lib/utils.lib.ts'
import {
	cielo2civet, cielo2civetFile,
	} from '../src/lib/cielo.lib.ts'
import {
	equal, like, succeeds, fails, truthy, falsy,
	} from '../src/lib/unit-test.lib.ts'

const hArgs = getCmdArgs()

// ---------------------------------------------------------------------------

DBG("cielo2civet(code)", "cielo2civetFile()")

equal(cielo2civet('abc'), 'abc')

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC9jaWVsby5saWIudGVzdC5jaXZldC50c3giLCJzb3VyY2VzIjpbInRlc3QvY2llbG8ubGliLnRlc3QuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSx1QkFBc0I7QUFDdEIsQUFBQTtBQUNBLEFBQUEsTUFBTSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLHlCQUF5QjtBQUN2RCxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLFdBQVcsQ0FBQyxDQUFDLGVBQWUsQ0FBQztBQUM5QixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMseUJBQXlCO0FBQ2pDLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQzdDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyw2QkFBNkI7QUFDckMsQUFBQTtBQUNBLEFBQUEsQUFBSyxNQUFMLEtBQUssQ0FBQyxDQUFFLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDckIsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsR0FBRyxDQUFBLEFBQUMsbUJBQW1CLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQTtBQUM1QyxBQUFBO0FBQ0EsQUFBQSxBQUFBLEtBQUssQ0FBQSxBQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQTtBQUMvQiIsIm5hbWVzIjpbXSwic291cmNlc0NvbnRlbnQiOlsiIyBjaWVsby5saWIudGVzdC5jaXZldFxuXG5pbXBvcnQge2dldENtZEFyZ3MsIERCR30gZnJvbSAnLi4vc3JjL2xpYi91dGlscy5saWIudHMnXG5pbXBvcnQge1xuXHRjaWVsbzJjaXZldCwgY2llbG8yY2l2ZXRGaWxlLFxuXHR9IGZyb20gJy4uL3NyYy9saWIvY2llbG8ubGliLnRzJ1xuaW1wb3J0IHtcblx0ZXF1YWwsIGxpa2UsIHN1Y2NlZWRzLCBmYWlscywgdHJ1dGh5LCBmYWxzeSxcblx0fSBmcm9tICcuLi9zcmMvbGliL3VuaXQtdGVzdC5saWIudHMnXG5cbmhBcmdzIDo9IGdldENtZEFyZ3MoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5EQkcgXCJjaWVsbzJjaXZldChjb2RlKVwiLCBcImNpZWxvMmNpdmV0RmlsZSgpXCJcblxuZXF1YWwgY2llbG8yY2l2ZXQoJ2FiYycpLCAnYWJjJ1xuIl19