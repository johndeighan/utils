// data-type-tests.civet

const defined = (x) => { return (x !== undefined) && (x !== null) }

// ---------------------------------------------------------------------------

export const isString = (item) => {

	return (typeof item === 'string') || (item instanceof String)
}

// ---------------------------------------------------------------------------

export const isNonEmptyString = (str) => {

	return isString(str) && (str.length > 0)
}

// ---------------------------------------------------------------------------

export const isBoolean = (item) => {

	return (typeof item === 'boolean') || (item instanceof Boolean)
}

// ---------------------------------------------------------------------------

export const isNumber = (x) => {

	const type = typeof x
	return (type === 'bigint') || (type === 'number') || (x instanceof Number)
}

// ---------------------------------------------------------------------------

export const isInteger = (x, hOptions={}) => {

	// --- test if it's a number or integer
	if (!isNumber(x) || !Number.isInteger(x.valueOf())) {
		return false
	}

	// --- possible range check
	const {min, max} = hOptions
	if (defined(min) && (x < min)) {
		return false
	}
	if (defined(max) && (x > max)) {
		return false
	}
	return true
}

// ---------------------------------------------------------------------------

export const isArray = (item) => {

	return Array.isArray(item)
}

// ---------------------------------------------------------------------------

export const isArrayOfStrings = (lItems) => {

	if (!isArray(lItems)) {
		return false
	}
	for (const item of lItems) {
		if (!isString(item)) {
			return false
		}
	}
	return true
}

// ---------------------------------------------------------------------------

export const isHash = (item) => {

	return (typeof item === 'object') && !isArray(item)
}

// ---------------------------------------------------------------------------

export const isObject = (item) => {

	return (typeof item === 'object')
}

// ---------------------------------------------------------------------------

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9kYXRhLXR5cGUtdGVzdHMuY2l2ZXQudHN4Iiwic291cmNlcyI6WyJzcmMvbGliL2RhdGEtdHlwZS10ZXN0cy5jaXZldCJdLCJtYXBwaW5ncyI6IkFBQUEsd0JBQXVCO0FBQ3ZCLEFBQUE7QUFDQSxBQUFPLE1BQVAsT0FBTyxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRSxDQUFDLElBQUksQ0FBQyxDQUFBLENBQUE7QUFDeEQsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFTLE1BQVIsUUFBUSxDQUFDLENBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQSxDQUFBO0FBQzVCLEFBQUE7QUFDQSxBQUFBLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEM7QUFBQyxDQUFBO0FBQzdELEFBQUE7QUFDQSxBQUFBLDhFQUE2RTtBQUM3RSxBQUFBO0FBQ0EsQUFBQSxBQUFBLE1BQU0sQ0FBaUIsTUFBaEIsZ0JBQWdCLENBQUMsQ0FBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDbkMsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQztBQUFDLENBQUE7QUFDekMsQUFBQTtBQUNBLEFBQUEsOEVBQTZFO0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFVLE1BQVQsU0FB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QUFHLENBQUMsQ0FBQSxNQUFBLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFBLENBQUEsQ0FBQTtBQUNuQixBQUFBLEVBQUUsR0FBRyxDQUFBLENBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFBLENBQUEsQ0FBQTtBQUN2QixBQUFBLEdBQUcsTUFBTSxDQUFDLEs7RUFBSyxDO0NBQUEsQ0FBQTtBQUNmLEFBQUEsQ0FBQyxNQUFNLENBQUMsSTtBQUFJLENBQUE7QUFDWixBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQU8sTUFBTixNQUFNLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDMUIsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBSSxPQUFPLENBQUMsSUFBSSxDO0FBQUMsQ0FBQTtBQUN0RCxBQUFBO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UsQUFBQTtBQUNBLEFBQUEsQUFBQSxNQUFNLENBQVMsTUFBUixRQUFRLENBQUMsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFBLENBQUE7QUFDNUIsQUFBQTtBQUNBLEFBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUUsQ0FBQyxRQUFRLEM7QUFBQyxDQUFBO0FBQ2pDO0FBQ0EsQUFBQSw4RUFBNkU7QUFDN0UiLCJuYW1lcyI6W10sInNvdXJjZXNDb250ZW50IjpbIiMgZGF0YS10eXBlLXRlc3RzLmNpdmV0XG5cbmRlZmluZWQgOj0gKHgpID0+IHJldHVybiAoeCAhPSB1bmRlZmluZWQpICYmICh4ICE9IG51bGwpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBpc1N0cmluZyA6PSAoaXRlbSkgPT5cblxuXHRyZXR1cm4gKHR5cGVvZiBpdGVtID09ICdzdHJpbmcnKSB8fCAoaXRlbSBpbnN0YW5jZW9mIFN0cmluZylcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGlzTm9uRW1wdHlTdHJpbmcgOj0gKHN0cikgPT5cblxuXHRyZXR1cm4gaXNTdHJpbmcoc3RyKSAmJiAoc3RyLmxlbmd0aCA+IDApXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBpc0Jvb2xlYW4gOj0gKGl0ZW0pID0+XG5cblx0cmV0dXJuICh0eXBlb2YgaXRlbSA9PSAnYm9vbGVhbicpIHx8IChpdGVtIGluc3RhbmNlb2YgQm9vbGVhbilcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGlzTnVtYmVyIDo9ICh4KSA9PlxuXG5cdHR5cGUgOj0gdHlwZW9mIHhcblx0cmV0dXJuICh0eXBlID09ICdiaWdpbnQnKSB8fCAodHlwZSA9PSAnbnVtYmVyJykgfHwgKHggaW5zdGFuY2VvZiBOdW1iZXIpXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBpc0ludGVnZXIgOj0gKHgsIGhPcHRpb25zPXt9KSA9PlxuXG5cdCMgLS0tIHRlc3QgaWYgaXQncyBhIG51bWJlciBvciBpbnRlZ2VyXG5cdGlmIG5vdCBpc051bWJlcih4KSB8fCBub3QgTnVtYmVyLmlzSW50ZWdlcih4LnZhbHVlT2YoKSlcblx0XHRyZXR1cm4gZmFsc2VcblxuXHQjIC0tLSBwb3NzaWJsZSByYW5nZSBjaGVja1xuXHR7bWluLCBtYXh9IDo9IGhPcHRpb25zXG5cdGlmIGRlZmluZWQobWluKSAmJiAoeCA8IG1pbilcblx0XHRyZXR1cm4gZmFsc2Vcblx0aWYgZGVmaW5lZChtYXgpICYmICh4ID4gbWF4KVxuXHRcdHJldHVybiBmYWxzZVxuXHRyZXR1cm4gdHJ1ZVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgaXNBcnJheSA6PSAoaXRlbSkgPT5cblxuXHRyZXR1cm4gQXJyYXkuaXNBcnJheShpdGVtKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgaXNBcnJheU9mU3RyaW5ncyA6PSAobEl0ZW1zKSA9PlxuXG5cdGlmIG5vdCBpc0FycmF5KGxJdGVtcylcblx0XHRyZXR1cm4gZmFsc2Vcblx0Zm9yIGl0ZW0gb2YgbEl0ZW1zXG5cdFx0aWYgbm90IGlzU3RyaW5nKGl0ZW0pXG5cdFx0XHRyZXR1cm4gZmFsc2Vcblx0cmV0dXJuIHRydWVcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGlzSGFzaCA6PSAoaXRlbSkgPT5cblxuXHRyZXR1cm4gKHR5cGVvZiBpdGVtID09ICdvYmplY3QnKSAmJiBub3QgaXNBcnJheShpdGVtKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgaXNPYmplY3QgOj0gKGl0ZW0pID0+XG5cblx0cmV0dXJuICh0eXBlb2YgaXRlbSA9PSAnb2JqZWN0JylcblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiJdfQ==