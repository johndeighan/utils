"use strict";
// logger.civet

import {existsSync} from "jsr:@std/fs"
import {sprintf} from "jsr:@std/fmt/printf"
import {
	ConsoleHandler, FileHandler, setup, getLogger,
	LogRecord,
	} from "jsr:@std/log"

import {
	undef, defined, notdefined,
	hash, isString,
	} from './datatypes.ts'
import {
	assert, croak, pass, sinceLoadStr,
	} from './llutils.ts'
import {
	mkpath, relpath, isDir, isFile, mkDir,
	} from './fs.ts'

const Deno = globalThis.Deno
export const logFileName : string = "./logs/logs.txt"
export const sepdash : string = '-'.repeat(32)
export const sepeq : string   = '='.repeat(32)

// --- These are not exported
const isSep = (str : string): boolean => {
	return (str === sepdash) || (str === sepeq)
}

const getMainModule = (): string => {
	const path: string = new URL(Deno.mainModule).pathname
	return relpath(path.slice(1))
}

// --- There always needs to be a 'logs' folder in the current directory
// mkDir './logs'

let indent : number = 0
const prefix = () => '   '.repeat(indent)

const hFileLabel: hash = {
	DEBUG: 'D ',
	INFO:  'I ',
	WARN:  'W ',
	ERROR: 'ERROR: '
	}

const hConsoleLabel: hash = {
	DEBUG: '',
	INFO:  '',
	WARN:  '',
	ERROR: ''
	}

// ---------------------------------------------------------------------------

export const hLoggerConfig: hash = {
	handlers: {

		profile: new ConsoleHandler('DEBUG', {
			formatter: ((rec: LogRecord) => {
				const {datetime, msg, levelName} = rec
				const ts = sinceLoadStr()
				const label = hConsoleLabel[levelName]
				return `[${ts}] ${label}${prefix()}${msg}`
			}
				)
			}),

		pfile: new FileHandler('DEBUG', {
			filename: mkpath(logFileName),
			mode: 'a',
			formatter: (rec) => {
				const {datetime, msg, levelName} = rec
				const ts = sinceLoadStr()
				const label = hFileLabel[levelName]
				return `[${ts}] ${label}${prefix()}${msg}`
			}
			}),

		console: new ConsoleHandler('DEBUG', {
			formatter: ((rec) => {
				const {levelName, msg} = rec
				assert(isString(msg), `Not a string: ${msg}`)
				if (msg.startsWith('=====  ')) {
					return ''
				}
				const label = hConsoleLabel[levelName]
				assert(defined(label), `No label for ${levelName}`)
				return `${label}${prefix()}${msg}`
			}
				)
			}),

		file: new FileHandler('DEBUG', {
			filename: logFileName,
			mode: 'a',
			formatter: (rec) => {
				const {levelName, msg} = rec
				if (isSep(msg)) {
					return msg
				}
				else if (msg.startsWith('=====  ')) {
					return msg
				}
				else {
					const label = hFileLabel[levelName]
					assert(defined(label), `No label for ${levelName}`)
					return `${label}${prefix()}${msg}`
				}
			}
				}),
	},

	// --- assign handlers to loggers
	//     must include:
	//        'profile', 'debug', 'info', 'warn', 'error', 'file' and 'silent'
	loggers: {
		profile: {
			level: "DEBUG",
			num: 1,
			handlers: ["profile", "pfile"]
			},
		debug: {
			level: "DEBUG",
			num: 2,
			handlers: ["console", "file"]
			},
		info: {
			level: "INFO",
			num: 3,
			handlers: ["console", "file"]
			},
		warn: {
			level: "WARN",
			num: 4,
			handlers: ["console", "file"]
			},
		error: {
			level: "ERROR",
			num: 5,
			handlers: ["console", "file"]
			},
		file: {
			level: "DEBUG",
			num: 6,
			handlers: ["file"]
			},
		silent: {
			level: "ERROR",
			num: 7,
			handlers: []
			}
		}
	}

await setup(hLoggerConfig)

export const INDENT : string = 'MOKaHenzkyZNbNWmUYijCNoqmIrIemFh'
export const UNDENT : string = 'MXrveSEaCkCfQjEgPdMIaEDFMIWMtHqz'
export const CLEAR  : string = '2EYCEu1v7xs0i4L3o5rAV1ZNLFkQYNHh'

// ---------------------------------------------------------------------------
// levels: profile, debug, info, warn, error, file, silent

export class LoggerEx {

	defLevel: string       = Deno.env.get('DEFAULT_LOGGER') || 'info'
	lLoggerStack: string[] = [this.defLevel]
	hConfig: hash          = hLoggerConfig
	hLoggers: hash         = this.hConfig.loggers
	silent: boolean        = false
	mainModule: string     = getMainModule()

	constructor() {
		this.check(this.defLevel)
	}

	curLevel(): string {
		const result = this.lLoggerStack.at(-1)
		if (result === undef) {
			throw new Error("empty stack")
		}
		else {
			return result
		}
	}

	levelChanged(): void {
		return
	}

	setLevel(level: string): void {
		this.check(level)
		this.lLoggerStack[this.lLoggerStack.length-1] = level
		this.levelChanged()
		return
	}

	pushLevel(level: string): void {
		this.check(level)
		this.lLoggerStack.push(level)
		this.levelChanged()
		return
	}

	popLevel(): string {
		assert((this.lLoggerStack.length > 0), "Empty logger stack")
		const level = this.lLoggerStack.pop()
		if (level === undef) {
			throw new Error("empty stack")
		}
		this.levelChanged()
		return level
	}

	isActive(level: string): boolean {
		this.check(level)
		const curNum = this.hLoggers[this.curLevel()].num
		const lvlNum = this.hLoggers[level].num
		return (lvlNum >= curNum)
	}

	output(level: string, lItems: any[]): void {
		const main = getMainModule()
		if (main !== this.mainModule) {
			const logger = getLogger('debug')
			logger.debug(`=====  ${main}  =====`)
			this.mainModule = main
		}
		if (this.isActive(level)) {
			for (const item of lItems) {
				switch(item) {
					case INDENT: {
						indent += 1;break;
					}
					case UNDENT: {
						indent = (indent===0) ? 0 : indent-1;break;
					}
					case CLEAR: {
						this.clearLog();break;
					}
					default: {
						const str = isString(item) ? item : JSON.stringify(item)
						const logger = getLogger(this.curLevel())
						switch(level) {
//							when 'profile'
//								logger.profile str
							case 'debug': {
								logger.debug(str);break;
							}
							case 'info': {
								logger.info(str);break;
							}
							case 'warn': {
								logger.warn(str);break;
							}
							case 'error': {
								logger.error(str);break;
							}
//							when 'file'
//								logger.file str
							case 'silent': {
								pass();break;
							}
							default: {
								logger.debug(str)
							}
						}
					}
				}
			}
		}
		return
	}

	flush(): void {
		this.hConfig.handlers.file.flush()
		this.hConfig.handlers.pfile.flush()
		return
	}

	clearLog(): void {
		this.flush()
		Deno.writeTextFileSync(logFileName, '')
		return
	}

	getFullLog(): string {
		this.flush()
		const text = Deno.readTextFileSync(logFileName)
		return text ? text.trim() : ''
	}

	getLog(): string {
		const text = this.getFullLog()
		const lLines = text ? text.split('\n') : []
		const lNewLines = lLines.filter((x) => !x.match(/^=====\s\s/))
		const resultStr = lNewLines.join('\n')
		return resultStr
	}

	check(level: string): void {
		assert(this.hLoggers[level], `Bad logger level: '${level}'`)
		return
	}
}

export const logger: LoggerEx = new LoggerEx()

// ---------------------------------------------------------------------------

export const clearLog = (level: (string | undefined)=undef): void => {

	logger.clearLog()
	if (!notdefined(level)) {
		logger.setLevel(level)
	}
	return
}

// ---------------------------------------------------------------------------

export const DBG  = (...lItems: any[]): void => logger.output('debug', lItems)
export const LOG  = (...lItems: any[]): void => logger.output('info', lItems)
export const WARN = (...lItems: any[]): void => logger.output('warn', lItems)
export const ERR  = (...lItems: any[]): void => logger.output('error', lItems)

export const curLogLevel  = (): string => { return logger.curLevel() }
export const setLogLevel  = (level: string): void => logger.setLevel(level)
export const pushLogLevel = (level: string): void => logger.pushLevel(level)
export const popLogLevel  = (): string => { return logger.popLevel() }
export const getFullLog   = (): string => { return logger.getFullLog() }
export const getLog       = (): string => { return logger.getLog() }
export const flushLog     = (): void => logger.flush()

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjL2xpYi9sb2dnZXIuY2l2ZXQudHN4Iiwic291cmNlcyI6WyJzcmMvbGliL2xvZ2dlci5jaXZldCJdLCJtYXBwaW5ncyI6IjtBQUFBLGVBQWM7QUFDZCxBQUFBO0FBQ0EsQUFBQSxNQUFNLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYTtBQUN0QyxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLHFCQUFxQjtBQUMzQyxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLGNBQWMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUMvQyxDQUFDLFNBQVMsQ0FBQztBQUNYLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjO0FBQ3RCLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFDLENBQUM7QUFDUixDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQztBQUM1QixDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUNoQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCO0FBQ3hCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDO0FBQ25DLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjO0FBQ3RCLEFBQUEsQUFBQSxNQUFNLENBQUMsQ0FBQztBQUNSLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ3ZDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTO0FBQ2pCLEFBQUE7QUFDQSxBQUFBLEFBQUksTUFBSixJQUFJLENBQUMsQ0FBRSxDQUFDLFVBQVUsQ0FBQyxJQUFJO0FBQ3ZC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RUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQ1osQUFBQSxHQUFHLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQTtBQUNqQixBQUFBLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ1QsQUFBQSxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDO0FBQ2pDLEdBQUcsQ0FBQyxDQUFBO0FBQ0osQUFBQSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDVixBQUFBLEdBQUcsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFBO0FBQ2pCLEFBQUEsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDVCxBQUFBLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDaEMsR0FBRyxDQUFDLENBQUE7QUFDSixBQUFBLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUNULEFBQUEsR0FBRyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUE7QUFDaEIsQUFBQSxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNULEFBQUEsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztBQUNoQyxHQUFHLENBQUMsQ0FBQTtBQUNKLEFBQUEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ1QsQUFBQSxHQUFHLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQztBQUNqQixBQUFBLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ1QsQUFBQSxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsTUFBTSxDQUFDO0FBQ2hDLEdBQUcsQ0FBQyxDQUFBO0FBQ0osQUFBQSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDVixBQUFBLEdBQUcsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFBO0FBQ2pCLEFBQUEsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDVCxB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O0FBQzdFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFLLE1BQUosR0FBRyxFQUFFLENBQUUsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFBLEFBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFBO0FBQ3hFLEFBQUEsQUFBQSxNQUFNLENBQUssTUFBSixHQUFHLEVBQUUsQ0FBRSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUEsQUFBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUE7QUFDdkUsQUFBQSxBQUFBLE1BQU0sQ0FBSyxNQUFKLElBQUksQ0FBQyxDQUFFLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQSxBQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQTtBQUN2RSxBQUFBLEFBQUEsTUFBTSxDQUFLLE1BQUosR0FBRyxFQUFFLENBQUUsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFBLEFBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFBO0FBQ3hFLEFBQUE7QUFDQSxBQUFBLEFBQUEsTUFBTSxDQUFhLE1BQVosV0FBVyxFQUFFLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQSxDQUFBO0FBQzdELEFBQUEsQUFBQSxNQUFNLENBQWEsTUFBWixXQUFXLEVBQUUsQ0FBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDO0FBQ3RFLEFBQUEsQUFBQSxNQUFNLENBQWEsTUFBWixZQUFZLENBQUMsQ0FBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDO0FBQ3ZFLEFBQUEsQUFBQSxNQUFNLENBQWEsTUFBWixXQUFXLEVBQUUsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQSxDQUFBLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFBLENBQUE7QUFDN0QsQUFBQSxBQUFBLE1BQU0sQ0FBYSxNQUFaLFVBQVUsR0FBRyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFBLENBQUEsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUEsQ0FBQTtBQUMvRCxBQUFBLEFBQUEsTUFBTSxDQUFhLE1BQVosTUFBTSxPQUFPLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUEsQ0FBQSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQSxDQUFBO0FBQzNELEFBQUEsQUFBQSxNQUFNLENBQWEsTUFBWixRQUFRLEtBQUssQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDakQiLCJuYW1lcyI6W10sInNvdXJjZXNDb250ZW50IjpbIiMgbG9nZ2VyLmNpdmV0XG5cbmltcG9ydCB7ZXhpc3RzU3luY30gZnJvbSBcImpzcjpAc3RkL2ZzXCJcbmltcG9ydCB7c3ByaW50Zn0gZnJvbSBcImpzcjpAc3RkL2ZtdC9wcmludGZcIlxuaW1wb3J0IHtcblx0Q29uc29sZUhhbmRsZXIsIEZpbGVIYW5kbGVyLCBzZXR1cCwgZ2V0TG9nZ2VyLFxuXHRMb2dSZWNvcmQsXG5cdH0gZnJvbSBcImpzcjpAc3RkL2xvZ1wiXG5cbmltcG9ydCB7XG5cdHVuZGVmLCBkZWZpbmVkLCBub3RkZWZpbmVkLFxuXHRoYXNoLCBpc1N0cmluZyxcblx0fSBmcm9tICcuL2RhdGF0eXBlcy50cydcbmltcG9ydCB7XG5cdGFzc2VydCwgY3JvYWssIHBhc3MsIHNpbmNlTG9hZFN0cixcblx0fSBmcm9tICcuL2xsdXRpbHMudHMnXG5pbXBvcnQge1xuXHRta3BhdGgsIHJlbHBhdGgsIGlzRGlyLCBpc0ZpbGUsIG1rRGlyLFxuXHR9IGZyb20gJy4vZnMudHMnXG5cbkRlbm8gOj0gZ2xvYmFsVGhpcy5EZW5vXG5leHBvcnQgbG9nRmlsZU5hbWUgOiBzdHJpbmcgOj0gXCIuL2xvZ3MvbG9ncy50eHRcIlxuZXhwb3J0IHNlcGRhc2ggOiBzdHJpbmcgOj0gJy0nLnJlcGVhdCgzMilcbmV4cG9ydCBzZXBlcSA6IHN0cmluZyAgIDo9ICc9Jy5yZXBlYXQoMzIpXG5cbiMgLS0tIFRoZXNlIGFyZSBub3QgZXhwb3J0ZWRcbmlzU2VwIDo9IChzdHIgOiBzdHJpbmcpOiBib29sZWFuID0+XG5cdHJldHVybiAoc3RyID09IHNlcGRhc2gpIHx8IChzdHIgPT0gc2VwZXEpXG5cbmdldE1haW5Nb2R1bGUgOj0gKCk6IHN0cmluZyA9PlxuXHRwYXRoOiBzdHJpbmcgOj0gbmV3IFVSTChEZW5vLm1haW5Nb2R1bGUpLnBhdGhuYW1lXG5cdHJldHVybiByZWxwYXRoKHBhdGguc2xpY2UoMSkpXG5cbiMgLS0tIFRoZXJlIGFsd2F5cyBuZWVkcyB0byBiZSBhICdsb2dzJyBmb2xkZXIgaW4gdGhlIGN1cnJlbnQgZGlyZWN0b3J5XG4jIG1rRGlyICcuL2xvZ3MnXG5cbmxldCBpbmRlbnQgOiBudW1iZXIgPSAwXG5wcmVmaXggOj0gKCkgPT4gJyAgICcucmVwZWF0KGluZGVudClcblxuaEZpbGVMYWJlbDogaGFzaCA6PSB7XG5cdERFQlVHOiAnRCAnXG5cdElORk86ICAnSSAnXG5cdFdBUk46ICAnVyAnXG5cdEVSUk9SOiAnRVJST1I6ICdcblx0fVxuXG5oQ29uc29sZUxhYmVsOiBoYXNoIDo9IHtcblx0REVCVUc6ICcnXG5cdElORk86ICAnJ1xuXHRXQVJOOiAgJydcblx0RVJST1I6ICcnXG5cdH1cblxuIyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGhMb2dnZXJDb25maWc6IGhhc2ggOj0ge1xuXHRoYW5kbGVyczpcblxuXHRcdHByb2ZpbGU6IG5ldyBDb25zb2xlSGFuZGxlcignREVCVUcnLCB7XG5cdFx0XHRmb3JtYXR0ZXI6ICgocmVjOiBMb2dSZWNvcmQpID0+XG5cdFx0XHRcdHtkYXRldGltZSwgbXNnLCBsZXZlbE5hbWV9IDo9IHJlY1xuXHRcdFx0XHR0cyA6PSBzaW5jZUxvYWRTdHIoKVxuXHRcdFx0XHRsYWJlbCA6PSBoQ29uc29sZUxhYmVsW2xldmVsTmFtZV1cblx0XHRcdFx0cmV0dXJuIFwiWyN7dHN9XSAje2xhYmVsfSN7cHJlZml4KCl9I3ttc2d9XCJcblx0XHRcdFx0KVxuXHRcdFx0fSlcblxuXHRcdHBmaWxlOiBuZXcgRmlsZUhhbmRsZXIoJ0RFQlVHJywge1xuXHRcdFx0ZmlsZW5hbWU6IG1rcGF0aChsb2dGaWxlTmFtZSlcblx0XHRcdG1vZGU6ICdhJ1xuXHRcdFx0Zm9ybWF0dGVyOiAocmVjKSA9PlxuXHRcdFx0XHR7ZGF0ZXRpbWUsIG1zZywgbGV2ZWxOYW1lfSA6PSByZWNcblx0XHRcdFx0dHMgOj0gc2luY2VMb2FkU3RyKClcblx0XHRcdFx0bGFiZWwgOj0gaEZpbGVMYWJlbFtsZXZlbE5hbWVdXG5cdFx0XHRcdHJldHVybiBcIlsje3RzfV0gI3tsYWJlbH0je3ByZWZpeCgpfSN7bXNnfVwiXG5cdFx0XHR9KVxuXG5cdFx0Y29uc29sZTogbmV3IENvbnNvbGVIYW5kbGVyKCdERUJVRycsIHtcblx0XHRcdGZvcm1hdHRlcjogKChyZWMpID0+XG5cdFx0XHRcdHtsZXZlbE5hbWUsIG1zZ30gOj0gcmVjXG5cdFx0XHRcdGFzc2VydCBpc1N0cmluZyhtc2cpLCBcIk5vdCBhIHN0cmluZzogI3ttc2d9XCJcblx0XHRcdFx0aWYgbXNnLnN0YXJ0c1dpdGgoJz09PT09ICAnKVxuXHRcdFx0XHRcdHJldHVybiAnJ1xuXHRcdFx0XHRsYWJlbCA6PSBoQ29uc29sZUxhYmVsW2xldmVsTmFtZV1cblx0XHRcdFx0YXNzZXJ0IGRlZmluZWQobGFiZWwpLCBcIk5vIGxhYmVsIGZvciAje2xldmVsTmFtZX1cIlxuXHRcdFx0XHRyZXR1cm4gXCIje2xhYmVsfSN7cHJlZml4KCl9I3ttc2d9XCJcblx0XHRcdFx0KVxuXHRcdFx0fSlcblxuXHRcdGZpbGU6IG5ldyBGaWxlSGFuZGxlcignREVCVUcnLCB7XG5cdFx0XHRmaWxlbmFtZTogbG9nRmlsZU5hbWVcblx0XHRcdG1vZGU6ICdhJ1xuXHRcdFx0Zm9ybWF0dGVyOiAocmVjKSA9PlxuXHRcdFx0XHR7bGV2ZWxOYW1lLCBtc2d9IDo9IHJlY1xuXHRcdFx0XHRpZiBpc1NlcChtc2cpXG5cdFx0XHRcdFx0cmV0dXJuIG1zZ1xuXHRcdFx0XHRlbHNlIGlmIG1zZy5zdGFydHNXaXRoKCc9PT09PSAgJylcblx0XHRcdFx0XHRyZXR1cm4gbXNnXG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHRsYWJlbCA6PSBoRmlsZUxhYmVsW2xldmVsTmFtZV1cblx0XHRcdFx0XHRhc3NlcnQgZGVmaW5lZChsYWJlbCksIFwiTm8gbGFiZWwgZm9yICN7bGV2ZWxOYW1lfVwiXG5cdFx0XHRcdFx0cmV0dXJuIFwiI3tsYWJlbH0je3ByZWZpeCgpfSN7bXNnfVwiXG5cdFx0XHRcdH0pXG5cblx0IyAtLS0gYXNzaWduIGhhbmRsZXJzIHRvIGxvZ2dlcnNcblx0IyAgICAgbXVzdCBpbmNsdWRlOlxuXHQjICAgICAgICAncHJvZmlsZScsICdkZWJ1ZycsICdpbmZvJywgJ3dhcm4nLCAnZXJyb3InLCAnZmlsZScgYW5kICdzaWxlbnQnXG5cdGxvZ2dlcnM6IHtcblx0XHRwcm9maWxlOiB7XG5cdFx0XHRsZXZlbDogXCJERUJVR1wiXG5cdFx0XHRudW06IDFcblx0XHRcdGhhbmRsZXJzOiBbXCJwcm9maWxlXCIsIFwicGZpbGVcIl1cblx0XHRcdH1cblx0XHRkZWJ1Zzoge1xuXHRcdFx0bGV2ZWw6IFwiREVCVUdcIlxuXHRcdFx0bnVtOiAyXG5cdFx0XHRoYW5kbGVyczogW1wiY29uc29sZVwiLCBcImZpbGVcIl1cblx0XHRcdH1cblx0XHRpbmZvOiB7XG5cdFx0XHRsZXZlbDogXCJJTkZPXCJcblx0XHRcdG51bTogM1xuXHRcdFx0aGFuZGxlcnM6IFtcImNvbnNvbGVcIiwgXCJmaWxlXCJdXG5cdFx0XHR9XG5cdFx0d2Fybjoge1xuXHRcdFx0bGV2ZWw6IFwiV0FSTlwiLFxuXHRcdFx0bnVtOiA0XG5cdFx0XHRoYW5kbGVyczogW1wiY29uc29sZVwiLCBcImZpbGVcIl1cblx0XHRcdH1cblx0XHRlcnJvcjoge1xuXHRcdFx0bGV2ZWw6IFwiRVJST1JcIlxuXHRcdFx0bnVtOiA1XG5cdFx0XHRoYW5kbGVyczogW1wiY29uc29sZVwiLCBcImZpbGVcIl1cblx0XHRcdH1cblx0XHRmaWxlOiB7XG5cdFx0XHRsZXZlbDogXCJERUJVR1wiLFxuXHRcdFx0bnVtOiA2XG5cdFx0XHRoYW5kbGVyczogW1wiZmlsZVwiXVxuXHRcdFx0fVxuXHRcdHNpbGVudDoge1xuXHRcdFx0bGV2ZWw6IFwiRVJST1JcIlxuXHRcdFx0bnVtOiA3XG5cdFx0XHRoYW5kbGVyczogW11cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuYXdhaXQgc2V0dXAoaExvZ2dlckNvbmZpZylcblxuZXhwb3J0IElOREVOVCA6IHN0cmluZyA6PSAnTU9LYUhlbnpreVpOYk5XbVVZaWpDTm9xbUlySWVtRmgnXG5leHBvcnQgVU5ERU5UIDogc3RyaW5nIDo9ICdNWHJ2ZVNFYUNrQ2ZRakVnUGRNSWFFREZNSVdNdEhxeidcbmV4cG9ydCBDTEVBUiAgOiBzdHJpbmcgOj0gJzJFWUNFdTF2N3hzMGk0TDNvNXJBVjFaTkxGa1FZTkhoJ1xuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyBsZXZlbHM6IHByb2ZpbGUsIGRlYnVnLCBpbmZvLCB3YXJuLCBlcnJvciwgZmlsZSwgc2lsZW50XG5cbmV4cG9ydCBjbGFzcyBMb2dnZXJFeFxuXG5cdGRlZkxldmVsOiBzdHJpbmcgICAgICAgPSBEZW5vLmVudi5nZXQoJ0RFRkFVTFRfTE9HR0VSJykgfHwgJ2luZm8nXG5cdGxMb2dnZXJTdGFjazogc3RyaW5nW10gPSBbQGRlZkxldmVsXVxuXHRoQ29uZmlnOiBoYXNoICAgICAgICAgID0gaExvZ2dlckNvbmZpZ1xuXHRoTG9nZ2VyczogaGFzaCAgICAgICAgID0gQGhDb25maWcubG9nZ2Vyc1xuXHRzaWxlbnQ6IGJvb2xlYW4gICAgICAgID0gZmFsc2Vcblx0bWFpbk1vZHVsZTogc3RyaW5nICAgICA9IGdldE1haW5Nb2R1bGUoKVxuXG5cdGNvbnN0cnVjdG9yKClcblx0XHRAY2hlY2sgQGRlZkxldmVsXG5cblx0Y3VyTGV2ZWwoKTogc3RyaW5nXG5cdFx0cmVzdWx0IDo9IEBsTG9nZ2VyU3RhY2suYXQoLTEpXG5cdFx0aWYgKHJlc3VsdCA9PSB1bmRlZilcblx0XHRcdHRocm93IG5ldyBFcnJvcihcImVtcHR5IHN0YWNrXCIpXG5cdFx0ZWxzZVxuXHRcdFx0cmV0dXJuIHJlc3VsdFxuXG5cdGxldmVsQ2hhbmdlZCgpOiB2b2lkXG5cdFx0cmV0dXJuXG5cblx0c2V0TGV2ZWwobGV2ZWw6IHN0cmluZyk6IHZvaWRcblx0XHRAY2hlY2sgbGV2ZWxcblx0XHRAbExvZ2dlclN0YWNrW0BsTG9nZ2VyU3RhY2subGVuZ3RoLTFdID0gbGV2ZWxcblx0XHRAbGV2ZWxDaGFuZ2VkKClcblx0XHRyZXR1cm5cblxuXHRwdXNoTGV2ZWwobGV2ZWw6IHN0cmluZyk6IHZvaWRcblx0XHRAY2hlY2sgbGV2ZWxcblx0XHRAbExvZ2dlclN0YWNrLnB1c2ggbGV2ZWxcblx0XHRAbGV2ZWxDaGFuZ2VkKClcblx0XHRyZXR1cm5cblxuXHRwb3BMZXZlbCgpOiBzdHJpbmdcblx0XHRhc3NlcnQgKEBsTG9nZ2VyU3RhY2subGVuZ3RoID4gMCksIFwiRW1wdHkgbG9nZ2VyIHN0YWNrXCJcblx0XHRsZXZlbCA6PSBAbExvZ2dlclN0YWNrLnBvcCgpXG5cdFx0aWYgKGxldmVsID09IHVuZGVmKVxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW1wdHkgc3RhY2tcIilcblx0XHRAbGV2ZWxDaGFuZ2VkKClcblx0XHRyZXR1cm4gbGV2ZWxcblxuXHRpc0FjdGl2ZShsZXZlbDogc3RyaW5nKTogYm9vbGVhblxuXHRcdEBjaGVjayBsZXZlbFxuXHRcdGN1ck51bSA6PSBAaExvZ2dlcnNbQGN1ckxldmVsKCldLm51bVxuXHRcdGx2bE51bSA6PSBAaExvZ2dlcnNbbGV2ZWxdLm51bVxuXHRcdHJldHVybiAobHZsTnVtID49IGN1ck51bSlcblxuXHRvdXRwdXQobGV2ZWw6IHN0cmluZywgbEl0ZW1zOiBhbnlbXSk6IHZvaWRcblx0XHRtYWluIDo9IGdldE1haW5Nb2R1bGUoKVxuXHRcdGlmIChtYWluICE9IEBtYWluTW9kdWxlKVxuXHRcdFx0bG9nZ2VyIDo9IGdldExvZ2dlcignZGVidWcnKVxuXHRcdFx0bG9nZ2VyLmRlYnVnIFwiPT09PT0gICN7bWFpbn0gID09PT09XCJcblx0XHRcdEBtYWluTW9kdWxlID0gbWFpblxuXHRcdGlmIEBpc0FjdGl2ZShsZXZlbClcblx0XHRcdGZvciBpdGVtIG9mIGxJdGVtc1xuXHRcdFx0XHRzd2l0Y2ggaXRlbVxuXHRcdFx0XHRcdHdoZW4gSU5ERU5UXG5cdFx0XHRcdFx0XHRpbmRlbnQgKz0gMVxuXHRcdFx0XHRcdHdoZW4gVU5ERU5UXG5cdFx0XHRcdFx0XHRpbmRlbnQgPSAoaW5kZW50PT0wKSA/IDAgOiBpbmRlbnQtMVxuXHRcdFx0XHRcdHdoZW4gQ0xFQVJcblx0XHRcdFx0XHRcdEBjbGVhckxvZygpXG5cdFx0XHRcdFx0ZWxzZVxuXHRcdFx0XHRcdFx0c3RyIDo9IGlzU3RyaW5nKGl0ZW0pID8gaXRlbSA6IEpTT04uc3RyaW5naWZ5KGl0ZW0pXG5cdFx0XHRcdFx0XHRsb2dnZXIgOj0gZ2V0TG9nZ2VyKEBjdXJMZXZlbCgpKVxuXHRcdFx0XHRcdFx0c3dpdGNoIGxldmVsXG4jXHRcdFx0XHRcdFx0XHR3aGVuICdwcm9maWxlJ1xuI1x0XHRcdFx0XHRcdFx0XHRsb2dnZXIucHJvZmlsZSBzdHJcblx0XHRcdFx0XHRcdFx0d2hlbiAnZGVidWcnXG5cdFx0XHRcdFx0XHRcdFx0bG9nZ2VyLmRlYnVnIHN0clxuXHRcdFx0XHRcdFx0XHR3aGVuICdpbmZvJ1xuXHRcdFx0XHRcdFx0XHRcdGxvZ2dlci5pbmZvIHN0clxuXHRcdFx0XHRcdFx0XHR3aGVuICd3YXJuJ1xuXHRcdFx0XHRcdFx0XHRcdGxvZ2dlci53YXJuIHN0clxuXHRcdFx0XHRcdFx0XHR3aGVuICdlcnJvcidcblx0XHRcdFx0XHRcdFx0XHRsb2dnZXIuZXJyb3Igc3RyXG4jXHRcdFx0XHRcdFx0XHR3aGVuICdmaWxlJ1xuI1x0XHRcdFx0XHRcdFx0XHRsb2dnZXIuZmlsZSBzdHJcblx0XHRcdFx0XHRcdFx0d2hlbiAnc2lsZW50J1xuXHRcdFx0XHRcdFx0XHRcdHBhc3MoKVxuXHRcdFx0XHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0XHRcdFx0bG9nZ2VyLmRlYnVnIHN0clxuXHRcdHJldHVyblxuXG5cdGZsdXNoKCk6IHZvaWRcblx0XHRAaENvbmZpZy5oYW5kbGVycy5maWxlLmZsdXNoKClcblx0XHRAaENvbmZpZy5oYW5kbGVycy5wZmlsZS5mbHVzaCgpXG5cdFx0cmV0dXJuXG5cblx0Y2xlYXJMb2coKTogdm9pZFxuXHRcdEBmbHVzaCgpXG5cdFx0RGVuby53cml0ZVRleHRGaWxlU3luYyBsb2dGaWxlTmFtZSwgJydcblx0XHRyZXR1cm5cblxuXHRnZXRGdWxsTG9nKCk6IHN0cmluZ1xuXHRcdEBmbHVzaCgpXG5cdFx0dGV4dCA6PSBEZW5vLnJlYWRUZXh0RmlsZVN5bmMobG9nRmlsZU5hbWUpXG5cdFx0cmV0dXJuIHRleHQgPyB0ZXh0LnRyaW0oKSA6ICcnXG5cblx0Z2V0TG9nKCk6IHN0cmluZ1xuXHRcdHRleHQgOj0gQGdldEZ1bGxMb2coKVxuXHRcdGxMaW5lcyA6PSB0ZXh0ID8gdGV4dC5zcGxpdCgnXFxuJykgOiBbXVxuXHRcdGxOZXdMaW5lcyA6PSBsTGluZXMuZmlsdGVyKCh4KSA9PiBub3QgeC5tYXRjaCgvXj09PT09XFxzXFxzLykpXG5cdFx0cmVzdWx0U3RyIDo9IGxOZXdMaW5lcy5qb2luKCdcXG4nKVxuXHRcdHJldHVybiByZXN1bHRTdHJcblxuXHRjaGVjayhsZXZlbDogc3RyaW5nKTogdm9pZFxuXHRcdGFzc2VydCBAaExvZ2dlcnNbbGV2ZWxdLCBcIkJhZCBsb2dnZXIgbGV2ZWw6ICcje2xldmVsfSdcIlxuXHRcdHJldHVyblxuXG5leHBvcnQgbG9nZ2VyOiBMb2dnZXJFeCA6PSBuZXcgTG9nZ2VyRXgoKVxuXG4jIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgY2xlYXJMb2cgOj0gKGxldmVsOiBzdHJpbmc/PXVuZGVmKTogdm9pZCA9PlxuXG5cdGxvZ2dlci5jbGVhckxvZygpXG5cdGlmIG5vdCBub3RkZWZpbmVkKGxldmVsKVxuXHRcdGxvZ2dlci5zZXRMZXZlbChsZXZlbClcblx0cmV0dXJuXG5cbiMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBEQkcgIDo9ICguLi5sSXRlbXM6IGFueVtdKTogdm9pZCA9PiBsb2dnZXIub3V0cHV0ICdkZWJ1ZycsIGxJdGVtc1xuZXhwb3J0IExPRyAgOj0gKC4uLmxJdGVtczogYW55W10pOiB2b2lkID0+IGxvZ2dlci5vdXRwdXQgJ2luZm8nLCBsSXRlbXNcbmV4cG9ydCBXQVJOIDo9ICguLi5sSXRlbXM6IGFueVtdKTogdm9pZCA9PiBsb2dnZXIub3V0cHV0ICd3YXJuJywgbEl0ZW1zXG5leHBvcnQgRVJSICA6PSAoLi4ubEl0ZW1zOiBhbnlbXSk6IHZvaWQgPT4gbG9nZ2VyLm91dHB1dCAnZXJyb3InLCBsSXRlbXNcblxuZXhwb3J0IGN1ckxvZ0xldmVsICA6PSAoKTogc3RyaW5nID0+IHJldHVybiBsb2dnZXIuY3VyTGV2ZWwoKVxuZXhwb3J0IHNldExvZ0xldmVsICA6PSAobGV2ZWw6IHN0cmluZyk6IHZvaWQgPT4gbG9nZ2VyLnNldExldmVsKGxldmVsKVxuZXhwb3J0IHB1c2hMb2dMZXZlbCA6PSAobGV2ZWw6IHN0cmluZyk6IHZvaWQgPT4gbG9nZ2VyLnB1c2hMZXZlbChsZXZlbClcbmV4cG9ydCBwb3BMb2dMZXZlbCAgOj0gKCk6IHN0cmluZyA9PiByZXR1cm4gbG9nZ2VyLnBvcExldmVsKClcbmV4cG9ydCBnZXRGdWxsTG9nICAgOj0gKCk6IHN0cmluZyA9PiByZXR1cm4gbG9nZ2VyLmdldEZ1bGxMb2coKVxuZXhwb3J0IGdldExvZyAgICAgICA6PSAoKTogc3RyaW5nID0+IHJldHVybiBsb2dnZXIuZ2V0TG9nKClcbmV4cG9ydCBmbHVzaExvZyAgICAgOj0gKCk6IHZvaWQgPT4gbG9nZ2VyLmZsdXNoKClcbiJdfQ==