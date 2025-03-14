"use strict";
// unit-test.test.civet

import {
	equal, truthy, falsy, fails, succeeds, like, listLike,
	matches, includes, includesAll,
	} from '../src/lib/unit-test.ts'

// ---------------------------------------------------------------------------

equal(   2+2, 4)
equal(   'abc'+'def', 'abcdef')
equal(   'abc   '.trim(), 'abc')
equal(   {a:1, b:2}, {b:2, a:1})

truthy(  42)
truthy(  'abc')
truthy(  '   ')

falsy(   false)
falsy(   undefined)
falsy(   null)
falsy(   '')

fails(   () => { throw new Error("bad") })

succeeds(() => { return 'me' })

like(    {a:1, b:2, c:3}, {a:1, c:3})
listLike([{a:1, b:2, c:3}], [{a:1, c:3}])

matches( "this is a long sentence", "long")
matches( "another 42 lines", /\d+/)
matches( "abcdef", "abc")

includes(['a','b','c'], 'b')

includesAll(['a','b','c'], ['a', 'c'])

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC91bml0LXRlc3QudGVzdC5jaXZldC50c3giLCJzb3VyY2VzIjpbInRlc3QvdW5pdC10ZXN0LnRlc3QuY2l2ZXQiXSwibWFwcGluZ3MiOiI7QUFBQSx1QkFBc0I7QUFDdEIsQUFBQTtBQUNBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUN2RCxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLFdBQVcsQ0FBQztBQUNoQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMseUJBQXlCO0FBQ2pDLEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLEtBQUssQ0FBQSxHQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDZixBQUFBLEFBQUEsS0FBSyxDQUFBLEdBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsQ0FBQTtBQUM5QixBQUFBLEFBQUEsS0FBSyxDQUFBLEdBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDL0IsQUFBQSxBQUFBLEtBQUssQ0FBQSxHQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUMvQixBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBQSxFQUFHLEVBQUUsQ0FBQTtBQUNYLEFBQUEsQUFBQSxNQUFNLENBQUEsRUFBRyxLQUFLLENBQUE7QUFDZCxBQUFBLEFBQUEsTUFBTSxDQUFBLEVBQUcsS0FBSyxDQUFBO0FBQ2QsQUFBQTtBQUNBLEFBQUEsQUFBQSxLQUFLLENBQUEsR0FBSSxLQUFLLENBQUE7QUFDZCxBQUFBLEFBQUEsS0FBSyxDQUFBLEdBQUksU0FBUyxDQUFBO0FBQ2xCLEFBQUEsQUFBQSxLQUFLLENBQUEsR0FBSSxJQUFJLENBQUE7QUFDYixBQUFBLEFBQUEsS0FBSyxDQUFBLEdBQUksRUFBRSxDQUFBO0FBQ1gsQUFBQTtBQUNBLEFBQUEsQUFBQSxLQUFLLENBQUEsR0FBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUEsQ0FBQSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUNyQyxBQUFBO0FBQ0EsQUFBQSxBQUFBLFFBQVEsQ0FBQSxBQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQSxDQUFBLENBQUE7QUFDMUIsQUFBQTtBQUNBLEFBQUEsQUFBQSxJQUFJLENBQUEsSUFBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3BDLEFBQUEsQUFBQSxRQUFRLENBQUEsQUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDeEMsQUFBQTtBQUNBLEFBQUEsQUFBQSxPQUFPLENBQUEsQ0FBRSx5QkFBeUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQTtBQUMxQyxBQUFBLEFBQUEsT0FBTyxDQUFBLENBQUUsa0JBQWtCLENBQUMsQ0FBQyxLQUFLLENBQUE7QUFDbEMsQUFBQSxBQUFBLE9BQU8sQ0FBQSxDQUFFLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQTtBQUN4QixBQUFBO0FBQ0EsQUFBQSxBQUFBLFFBQVEsQ0FBQSxBQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQTtBQUMzQixBQUFBO0FBQ0EsQUFBQSxBQUFBLFdBQVcsQ0FBQSxBQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDckMiLCJuYW1lcyI6W10sInNvdXJjZXNDb250ZW50IjpbIiMgdW5pdC10ZXN0LnRlc3QuY2l2ZXRcblxuaW1wb3J0IHtcblx0ZXF1YWwsIHRydXRoeSwgZmFsc3ksIGZhaWxzLCBzdWNjZWVkcywgbGlrZSwgbGlzdExpa2UsXG5cdG1hdGNoZXMsIGluY2x1ZGVzLCBpbmNsdWRlc0FsbCxcblx0fSBmcm9tICcuLi9zcmMvbGliL3VuaXQtdGVzdC50cydcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXF1YWwgICAgMisyLCA0XG5lcXVhbCAgICAnYWJjJysnZGVmJywgJ2FiY2RlZidcbmVxdWFsICAgICdhYmMgICAnLnRyaW0oKSwgJ2FiYydcbmVxdWFsICAgIHthOjEsIGI6Mn0sIHtiOjIsIGE6MX1cblxudHJ1dGh5ICAgNDJcbnRydXRoeSAgICdhYmMnXG50cnV0aHkgICAnICAgJ1xuXG5mYWxzeSAgICBmYWxzZVxuZmFsc3kgICAgdW5kZWZpbmVkXG5mYWxzeSAgICBudWxsXG5mYWxzeSAgICAnJ1xuXG5mYWlscyAgICAoKSA9PiB0aHJvdyBuZXcgRXJyb3IoXCJiYWRcIilcblxuc3VjY2VlZHMgKCkgPT4gcmV0dXJuICdtZSdcblxubGlrZSAgICAge2E6MSwgYjoyLCBjOjN9LCB7YToxLCBjOjN9XG5saXN0TGlrZSBbe2E6MSwgYjoyLCBjOjN9XSwgW3thOjEsIGM6M31dXG5cbm1hdGNoZXMgIFwidGhpcyBpcyBhIGxvbmcgc2VudGVuY2VcIiwgXCJsb25nXCJcbm1hdGNoZXMgIFwiYW5vdGhlciA0MiBsaW5lc1wiLCAvXFxkKy9cbm1hdGNoZXMgIFwiYWJjZGVmXCIsIFwiYWJjXCJcblxuaW5jbHVkZXMgWydhJywnYicsJ2MnXSwgJ2InXG5cbmluY2x1ZGVzQWxsIFsnYScsJ2InLCdjJ10sIFsnYScsICdjJ11cbiJdfQ==